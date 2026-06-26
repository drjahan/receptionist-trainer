import { useEffect, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Send, PhoneOff, Phone, User, Bot, Clock, AlertTriangle, Mic, MicOff, Loader2, Volume2, VolumeX } from "lucide-react";
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

export default function Roleplay() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = parseInt(params.sessionId || "0");
  const [, navigate] = useLocation();
  const [input, setInput] = useState("");
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [startTime] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ─── Voice recording state ────────────────────────────────────────────────
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // ─── TTS (patient voice output) state ─────────────────────────────────────
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { data: session } = trpc.sessions.get.useQuery({ id: sessionId }, { enabled: !!sessionId });
  const { data: scenario } = trpc.scenarios.get.useQuery(
    { id: session?.scenarioId ?? 0 },
    { enabled: !!session?.scenarioId }
  );
  const { data: messages, refetch: refetchMessages } = trpc.chat.getMessages.useQuery(
    { sessionId },
    { enabled: !!sessionId }
  );

  const sendMessage = trpc.chat.sendMessage.useMutation({
    onSuccess: (data) => {
      refetchMessages();
      setInput("");
      // Auto-play TTS audio if enabled and returned
      if (data.audioBase64) {
        const src = `data:audio/mpeg;base64,${data.audioBase64}`;
        if (audioRef.current) {
          audioRef.current.pause();
        }
        const audio = new Audio(src);
        audioRef.current = audio;
        audio.play().catch(() => {
          toast.info("Tap anywhere to enable audio playback.");
        });
      }
    },
    onError: () => toast.error("Failed to send message. Please try again."),
  });

  const evaluateMutation = trpc.scoring.evaluate.useMutation({
    onSuccess: () => {
      navigate(`/scorecard/${sessionId}`);
    },
    onError: () => {
      setIsEvaluating(false);
      toast.error("Failed to evaluate session. Please try again.");
    },
  });

  // Timer
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const handleSend = () => {
    if (!input.trim() || sendMessage.isPending) return;
    sendMessage.mutate({ sessionId, content: input.trim(), ttsEnabled });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const uploadAudio = trpc.voice.uploadAudio.useMutation();
  const transcribeAudio = trpc.voice.transcribe.useMutation();

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        if (blob.size < 500) return;
        setIsTranscribing(true);
        try {
          const arrayBuffer = await blob.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...Array.from(new Uint8Array(arrayBuffer))));
          const { url } = await uploadAudio.mutateAsync({ audioBase64: base64, mimeType });
          const { text } = await transcribeAudio.mutateAsync({ audioUrl: url });
          if (text?.trim()) {
            setInput(prev => prev ? prev + " " + text.trim() : text.trim());
          }
        } catch {
          toast.error("Voice transcription failed. Please type your response.");
        } finally {
          setIsTranscribing(false);
        }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      toast.error("Microphone access denied. Please allow microphone access to use voice input.");
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleEndSession = () => {
    setIsEvaluating(true);
    evaluateMutation.mutate({ sessionId });
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
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Session
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="gap-2" disabled={isEvaluating || (messages?.length ?? 0) < 2}>
                    <PhoneOff className="w-4 h-4" />
                    End & Evaluate
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
                      End & Get Scorecard
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

        {/* Chat area */}
        <div className="bg-card rounded-xl border border-border card-shadow flex flex-col" style={{ height: "calc(100vh - 380px)", minHeight: "400px" }}>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Opening instruction */}
            <div className="text-center">
              <span className="inline-block text-xs text-muted-foreground bg-secondary rounded-full px-4 py-1.5">
                The patient is calling. Respond as you would on the telephone.
              </span>
            </div>

            {messages?.map((msg) => (
              <div
                key={msg.id}
                className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}
              >
                {msg.role === "assistant" && (
                  <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-4 h-4 text-rose-600" />
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
                    {msg.role === "user" ? "You (Receptionist)" : "Patient"}
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

            {sendMessage.isPending && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-rose-600" />
                </div>
                <div className="bg-secondary rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="text-xs font-medium mb-1 opacity-70">Patient</div>
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}

            {isEvaluating && (
              <div className="text-center py-4">
                <div className="inline-flex items-center gap-2 text-sm text-muted-foreground bg-secondary rounded-full px-5 py-2">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  Evaluating your performance...
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="border-t border-border p-4">
            <div className="flex gap-3 items-end">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isTranscribing ? "Transcribing your voice..." : "Type your response or use the microphone..."}
                className="resize-none min-h-[60px] max-h-[120px] text-sm"
                disabled={sendMessage.isPending || isEvaluating || session.status !== "active" || isTranscribing}
              />
              {/* TTS speaker toggle */}
              <Button
                onClick={() => setTtsEnabled(v => !v)}
                disabled={isEvaluating || session.status !== "active"}
                size="icon"
                variant={ttsEnabled ? "default" : "outline"}
                className="h-[60px] w-12 shrink-0"
                title={ttsEnabled ? "Patient voice ON — click to mute" : "Patient voice OFF — click to hear patient speak"}
              >
                {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </Button>
              {/* Microphone button */}
              <Button
                onClick={isRecording ? handleStopRecording : handleStartRecording}
                disabled={isEvaluating || session.status !== "active" || isTranscribing || sendMessage.isPending}
                size="icon"
                variant={isRecording ? "destructive" : "outline"}
                className={`h-[60px] w-12 shrink-0 transition-all ${isRecording ? "animate-pulse" : ""}`}
                title={isRecording ? "Stop recording" : "Start voice input"}
              >
                {isTranscribing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isRecording ? (
                  <MicOff className="w-4 h-4" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
              </Button>
              {/* Send button */}
              <Button
                onClick={handleSend}
                disabled={!input.trim() || sendMessage.isPending || isEvaluating}
                size="icon"
                className="h-[60px] w-12 shrink-0"
              >
                {sendMessage.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {isRecording ? (
                <span className="text-destructive font-medium">Recording... Click the microphone button to stop and transcribe.</span>
              ) : (
                <>Tip: Click the <Mic className="w-3 h-3 inline" /> microphone to speak, or type your response. Click <strong>End &amp; Evaluate</strong> when ready.</>
              )}
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
