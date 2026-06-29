import { useRef, useState, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PhoneOff, Phone, User, Clock, AlertTriangle, Mic, MicOff, Star, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ConversationProvider,
  useConversationControls,
  useConversationStatus,
  useConversationMode,
} from "@elevenlabs/react";

// MessagePayload type inline to avoid direct @elevenlabs/client import
type MessagePayload = { message: string; source: "user" | "ai"; role: string; event_id?: number };

// ─── Outer wrapper — provides ConversationProvider context with stable callbacks ─
export default function Roleplay() {
  const [localMessages, setLocalMessages] = useState<
    { id: number; role: "user" | "assistant"; content: string }[]
  >([]);
  const msgIdRef = useRef(0);

  const handleConnect = useCallback(({ conversationId }: { conversationId: string }) => {
    console.log("ElevenLabs connected, conversationId:", conversationId);
    toast.success("Connected to patient — speak now.");
  }, []);

  const handleDisconnect = useCallback(() => {
    console.log("ElevenLabs disconnected");
  }, []);

  const handleError = useCallback((message: string) => {
    console.error("ElevenLabs error:", message);
    toast.error("Voice connection error. Please try again.");
  }, []);

  const handleMessage = useCallback((msg: MessagePayload) => {
    const id = ++msgIdRef.current;
    setLocalMessages(prev => [
      ...prev,
      { id, role: msg.source === "ai" ? "assistant" : "user", content: msg.message },
    ]);
  }, []);

  return (
    <ConversationProvider
      onConnect={handleConnect}
      onDisconnect={handleDisconnect}
      onError={handleError}
      onMessage={handleMessage}
    >
      <RoleplayInnerWithMessages
        localMessages={localMessages}
        setLocalMessages={setLocalMessages}
      />
    </ConversationProvider>
  );
}

// ─── Props bridge ─────────────────────────────────────────────────────────────
function RoleplayInnerWithMessages({
  localMessages,
  setLocalMessages,
}: {
  localMessages: { id: number; role: "user" | "assistant"; content: string }[];
  setLocalMessages: React.Dispatch<React.SetStateAction<{ id: number; role: "user" | "assistant"; content: string }[]>>;
}) {
  return <RoleplayInnerCore localMessages={localMessages} setLocalMessages={setLocalMessages} />;
}

// ─── Core inner component ─────────────────────────────────────────────────────
function RoleplayInnerCore({
  localMessages,
  setLocalMessages,
}: {
  localMessages: { id: number; role: "user" | "assistant"; content: string }[];
  setLocalMessages: React.Dispatch<React.SetStateAction<{ id: number; role: "user" | "assistant"; content: string }[]>>;
}) {
  const params = useParams<{ sessionId: string }>();
  const sessionId = parseInt(params.sessionId || "0");
  const [, navigate] = useLocation();
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [startTime] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [mouthOpenRatio, setMouthOpenRatio] = useState(0);

  // Google Review constants
  const REVIEW_LINK = "https://g.page/r/CemedDs5bp4FEBM/review";
  const { user: authUser } = useAuth();
  const displayName = authUser?.name ?? "your name";

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: session } = trpc.sessions.get.useQuery({ id: sessionId }, { enabled: !!sessionId });
  const { data: scenario } = trpc.scenarios.get.useQuery(
    { id: session?.scenarioId ?? 0 },
    { enabled: !!session?.scenarioId }
  );

  // ── ElevenLabs Conversational AI (v1.9 provider-based API) ────────────────
  const controls = useConversationControls();
  const { status } = useConversationStatus();
  const { mode } = useConversationMode();
  const getSignedUrlMutation = trpc.chat.getSignedUrl.useMutation();

  const isConnected = status === "connected";
  const isConnecting = status === "connecting";

  // Sync mouth animation from speaking mode
  useEffect(() => {
    const speaking = mode === "speaking";
    setIsSpeaking(speaking);
    if (speaking) {
      let ratio = 0;
      const ramp = setInterval(() => {
        ratio = Math.min(1, ratio + 0.15);
        setMouthOpenRatio(ratio * (0.5 + Math.random() * 0.5));
        if (ratio >= 1) clearInterval(ramp);
      }, 80);
      return () => clearInterval(ramp);
    } else {
      setMouthOpenRatio(0);
    }
  }, [mode]);

  const startCall = useCallback(async () => {
    if (!scenario) return;
    // Step 1: request mic permission synchronously within the user gesture.
    // On iOS Safari, getUserMedia MUST be the very first await — any prior async
    // call breaks the gesture chain and causes NotAllowedError.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop()); // release immediately; ElevenLabs opens its own
    } catch (micErr) {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        toast.error(
          "Microphone access denied. On iPhone/iPad: go to Settings → Safari → Microphone and allow access for this site, then try again.",
          { duration: 9000 }
        );
      } else {
        toast.error(
          "Microphone access denied. Please allow microphone access in your browser settings and try again.",
          { duration: 6000 }
        );
      }
      console.error("getUserMedia failed:", micErr);
      return;
    }
    // Step 2: fetch signed URL and start ElevenLabs session
    try {
      const { signedUrl, systemPrompt } = await getSignedUrlMutation.mutateAsync({ sessionId });
      controls.startSession({
        signedUrl,
        connectionType: "websocket",
        overrides: { agent: { prompt: { prompt: systemPrompt } } },
      });
    } catch (err) {
      console.error("Failed to start voice session:", err);
      toast.error("Could not start call. Please try again.");
    }
  }, [scenario, sessionId, controls, getSignedUrlMutation]);

  const endCall = useCallback(() => {
    controls.endSession();
    setIsSpeaking(false);
    setMouthOpenRatio(0);
  }, [controls]);

  // ── Scoring / evaluation ──────────────────────────────────────────────────
  const saveTranscriptMutation = trpc.chat.saveAndEvaluate.useMutation();
  const evaluateMutation = trpc.scoring.evaluate.useMutation({
    onSuccess: () => {
      navigate(`/scorecard/${sessionId}`);
    },
    onError: () => {
      setIsEvaluating(false);
      toast.error("Failed to evaluate session. Please try again.");
    },
  });

  const handleEndSession = useCallback(async () => {
    endCall();
    setIsEvaluating(true);
    try {
      await saveTranscriptMutation.mutateAsync({
        sessionId,
        messages: localMessages.map(m => ({ role: m.role, content: m.content })),
      });
      evaluateMutation.mutate({ sessionId });
    } catch {
      setIsEvaluating(false);
      toast.error("Failed to save session. Please try again.");
    }
  }, [endCall, sessionId, localMessages, saveTranscriptMutation, evaluateMutation]);

  // ── Timer ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      controls.endSession();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  if (!session || !scenario) {
    return (
      <AppLayout>
        <div className="container py-20 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Loading session...</p>
        </div>
      </AppLayout>
    );
  }

  const canEndSession = localMessages.length >= 2;

  return (
    <AppLayout>
      <div className="container py-6 max-w-4xl">
        {/* Session header */}
        <div className="bg-card rounded-xl border border-border card-shadow p-5 mb-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Phone className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="font-semibold text-foreground">{scenario.title}</h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className="text-xs">{scenario.category}</Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTime(elapsed)}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={cn(
                "flex items-center gap-1.5 text-xs rounded-full px-3 py-1 border",
                isConnected
                  ? "text-emerald-600 bg-emerald-50 border-emerald-200"
                  : isConnecting
                  ? "text-amber-600 bg-amber-50 border-amber-200"
                  : "text-muted-foreground bg-muted border-border"
              )}>
                <span className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  isConnected ? "bg-emerald-500 animate-pulse" : isConnecting ? "bg-amber-400 animate-pulse" : "bg-muted-foreground"
                )} />
                {isConnected ? "Live Session" : isConnecting ? "Connecting…" : "Not Connected"}
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="gap-2" disabled={isEvaluating || !canEndSession}>
                    <PhoneOff className="w-4 h-4" />
                    End &amp; Evaluate
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>End this session?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will close the roleplay and send your conversation to the AI evaluator for scoring. You will receive a detailed competency scorecard.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Continue Practice</AlertDialogCancel>
                    <AlertDialogAction onClick={handleEndSession} className="bg-destructive hover:bg-destructive/90">
                      End &amp; Get Scorecard
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          {/* Scenario brief */}
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
              <span className="font-semibold">Scenario brief: </span>
              {scenario.description}
            </p>
          </div>
        </div>

        {/* Chat area with patient header */}
        <div className="bg-card rounded-xl border border-border card-shadow flex flex-col" style={{ height: "calc(100vh - 380px)", minHeight: "480px" }}>

          {/* Patient header strip */}
          <div className="flex items-center gap-4 px-5 py-4 border-b border-border/50 bg-muted/20 rounded-t-xl shrink-0">
            {/* Animated patient avatar */}
            <div className="relative w-12 h-12 shrink-0">
              <div className={cn(
                "w-12 h-12 rounded-full bg-rose-100 border-2 flex items-center justify-center transition-all duration-200",
                isSpeaking ? "border-rose-400 shadow-lg shadow-rose-200" : "border-rose-200"
              )}>
                <User className={cn("w-6 h-6", isSpeaking ? "text-rose-600" : "text-rose-400")} />
              </div>
              {isSpeaking && (
                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-background animate-pulse" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-foreground truncate">{scenario.title}</p>
                {isSpeaking && (
                  <div className="flex items-end gap-0.5 h-3 shrink-0">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <span
                        key={i}
                        className="w-0.5 rounded-full bg-primary"
                        style={{
                          height: `${Math.max(3, Math.round(mouthOpenRatio * 12 * (0.4 + Math.abs(Math.sin(i * 1.3)) * 0.6)))}px`,
                          transition: "height 0.08s ease",
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isSpeaking
                  ? "Patient is speaking…"
                  : isConnected
                  ? "Listening to you…"
                  : "Press the microphone button to start the call"}
              </p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="text-center">
              <span className="inline-block text-xs text-muted-foreground bg-secondary rounded-full px-4 py-1.5">
                {isConnected
                  ? "You are live — speak naturally. The patient will respond."
                  : "Press the microphone button below to start the roleplay call."}
              </span>
            </div>

            {localMessages.map((msg) => (
              <div
                key={msg.id}
                className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}
              >
                {msg.role === "assistant" && (
                  <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-4 h-4 text-rose-600" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-secondary text-foreground rounded-tl-sm"
                  )}
                >
                  <div className="text-xs font-medium mb-1 opacity-70">
                    {msg.role === "user" ? "You" : "Patient"}
                  </div>
                  {msg.content}
                </div>
                {msg.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                )}
              </div>
            ))}

            {isEvaluating && (
              <div className="text-center py-4">
                <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  Evaluating your performance...
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Call control bar */}
          <div className="border-t border-border p-4 flex flex-col gap-3">
            {/* Google Review reminder — shown when conversation has 4+ messages */}
            {localMessages.length >= 4 && isConnected && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Star className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-amber-800 mb-1">Reminder: Offer a Google Review before ending the call</p>
                    <p className="text-xs text-amber-700 leading-relaxed mb-1.5">
                      Say: <em>&ldquo;If you were happy with the service today, I&rsquo;d really appreciate it if you could leave us a Google review — the link is {REVIEW_LINK} — and if you mention my name, {displayName}, you&rsquo;ll receive a &pound;5 Amazon voucher as a thank you.&rdquo;</em>
                    </p>
                    <a
                      href={REVIEW_LINK}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-amber-700 underline hover:text-amber-900"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {REVIEW_LINK}
                    </a>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-center gap-4">
              {!isConnected ? (
                <Button
                  onClick={startCall}
                  disabled={isConnecting || isEvaluating}
                  size="lg"
                  className="gap-3 px-8 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200"
                >
                  {isConnecting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Connecting…
                    </>
                  ) : (
                    <>
                      <Mic className="w-5 h-5" />
                      Start Call
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={endCall}
                  size="lg"
                  variant="destructive"
                  className="gap-3 px-8 shadow-lg"
                >
                  <MicOff className="w-5 h-5" />
                  End Call
                </Button>
              )}
              {isConnected && (
                <p className="text-xs text-muted-foreground">
                  Hands-free — just speak naturally. ElevenLabs handles everything.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
