import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import {
  Upload,
  FileAudio,
  Mic,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronRight,
  RotateCcw,
  ClipboardList,
  History,
  Phone,
} from "lucide-react";
import { Link } from "wouter";
import AppLayout from "@/components/AppLayout";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = "upload" | "review" | "evaluate" | "results";

interface AuditResult {
  id: number;
  clinicianName?: string | null;
  emisNumber?: string | null;
  auditDate?: string | null;
  transcript?: string | null;
  consultationSuitability?: string | null;
  workingDiagnosis?: string | null;
  redFlagsLight?: string | null;
  treatmentFollowUp?: string | null;
  criteriaScores?: Record<string, number | null> | null;
  clinicalStrengths?: string | null;
  clinicalConcerns?: string | null;
  nonClinicalConcerns?: string | null;
  additionalNotes?: string | null;
  status: string;
  createdAt: Date;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TrafficLight({ status, label }: { status: string | null | undefined; label: string }) {
  const colour =
    status === "green" ? "bg-emerald-500" :
    status === "amber" ? "bg-amber-400" :
    status === "red" ? "bg-red-500" :
    "bg-slate-300";

  const textColour =
    status === "green" ? "text-emerald-700" :
    status === "amber" ? "text-amber-700" :
    status === "red" ? "text-red-700" :
    "text-slate-500";

  const statusLabel =
    status === "green" ? "Satisfactory" :
    status === "amber" ? "Minor Concern" :
    status === "red" ? "Significant Concern" :
    "Not Assessed";

  return (
    <div className="flex flex-col items-center gap-2 p-4 rounded-xl border bg-card">
      <div className={`w-10 h-10 rounded-full ${colour} shadow-md`} />
      <p className="text-xs font-medium text-center text-foreground leading-tight">{label}</p>
      <span className={`text-xs font-semibold ${textColour}`}>{statusLabel}</span>
    </div>
  );
}

function CriterionRow({
  label,
  section,
  score,
  audioAssessable,
}: {
  label: string;
  section: string;
  score: number | null | undefined;
  audioAssessable: boolean;
}) {
  const icon =
    score === 2 ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" /> :
    score === 1 ? <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" /> :
    score === 0 ? <XCircle className="w-5 h-5 text-red-500 shrink-0" /> :
    <span className="w-5 h-5 rounded-full bg-slate-200 inline-block shrink-0" />;

  const scoreLabel =
    score === 2 ? "Done well" :
    score === 1 ? "Partial" :
    score === 0 ? "Not done" :
    "N/A";

  const scoreBg =
    score === 2 ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
    score === 1 ? "bg-amber-50 text-amber-700 border-amber-200" :
    score === 0 ? "bg-red-50 text-red-700 border-red-200" :
    "bg-slate-50 text-slate-500 border-slate-200";

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/50 last:border-0">
      <div className="mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{section}</p>
        <p className="text-sm text-foreground mt-0.5">{label}</p>
        {!audioAssessable && (
          <p className="text-xs text-muted-foreground mt-0.5 italic">Cannot be assessed from audio alone</p>
        )}
      </div>
      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0 ${scoreBg}`}>
        {audioAssessable ? scoreLabel : "N/A"}
      </span>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CallAudit() {
  const [step, setStep] = useState<Step>("upload");
  const [auditId, setAuditId] = useState<number | null>(null);
  const [transcript, setTranscript] = useState("");
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [clinicianName, setClinicianName] = useState("");
  const [emisNumber, setEmisNumber] = useState("");
  const [auditDate, setAuditDate] = useState(new Date().toISOString().split("T")[0]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: criteria } = trpc.callAudit.getCriteria.useQuery();
  const { data: auditHistory } = trpc.callAudit.list.useQuery();

  const uploadMutation = trpc.callAudit.upload.useMutation({
    onSuccess: (data) => {
      setAuditId(data.auditId);
      setTranscript(data.transcript);
      setStep("review");
      toast.success("Transcription complete — please review before evaluating");
    },
    onError: (err) => toast.error(`Upload failed: ${err.message}`),
  });

  const evaluateMutation = trpc.callAudit.evaluate.useMutation({
    onSuccess: (data) => {
      if (data) {
        setAuditResult(data as AuditResult);
        setStep("results");
        toast.success("Audit evaluation complete");
      }
    },
    onError: (err) => toast.error(`Evaluation failed: ${err.message}`),
  });

  const handleFileSelect = useCallback((file: File) => {
    const allowedExts = ["mp3", "wav", "m4a", "mp4"];
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!allowedExts.includes(ext ?? "")) {
      toast.error("Please upload an MP3, WAV, or M4A audio file");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error("File must be under 25 MB");
      return;
    }
    setSelectedFile(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleUpload = async () => {
    if (!selectedFile) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadMutation.mutate({
        clinicianName: clinicianName || undefined,
        emisNumber: emisNumber || undefined,
        auditDate: auditDate || undefined,
        audioBase64: base64,
        audioMimeType: selectedFile.type || "audio/mpeg",
        audioFilename: selectedFile.name,
      });
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleEvaluate = () => {
    if (!auditId) return;
    evaluateMutation.mutate({ auditId, transcriptOverride: transcript });
  };

  const handleReset = () => {
    setStep("upload");
    setAuditId(null);
    setTranscript("");
    setAuditResult(null);
    setSelectedFile(null);
    setClinicianName("");
    setEmisNumber("");
    setAuditDate(new Date().toISOString().split("T")[0]);
  };

  const steps: { id: Step; label: string }[] = [
    { id: "upload", label: "Upload & Transcribe" },
    { id: "review", label: "Review" },
    { id: "evaluate", label: "Evaluate" },
    { id: "results", label: "Results" },
  ];

  const stepIndex = steps.findIndex(s => s.id === step);

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground font-medium">Call Audit</span>
          </div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
              <Phone className="w-5 h-5 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Consultation Call Audit</h1>
          </div>
          <p className="text-muted-foreground text-sm ml-12">
            Upload a telephone consultation recording to receive a structured audit against the GP Pathfinder clinical supervision criteria.
          </p>
        </div>

        {/* Step progress */}
        <div className="flex items-center gap-1 mb-8">
          {steps.map((s, i) => (
            <div key={s.id} className="flex items-center gap-1 flex-1">
              <div className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                i < stepIndex ? "text-emerald-600" :
                i === stepIndex ? "text-primary" :
                "text-muted-foreground"
              }`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  i < stepIndex ? "bg-emerald-500 text-white" :
                  i === stepIndex ? "bg-primary text-primary-foreground" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {i < stepIndex ? "✓" : i + 1}
                </div>
                <span className="hidden sm:block">{s.label}</span>
              </div>
              {i < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-1 rounded ${i < stepIndex ? "bg-emerald-400" : "bg-muted"}`} />
              )}
            </div>
          ))}
        </div>

        {/* ── Step: Upload ── */}
        {step === "upload" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Upload className="w-5 h-5" />
                Upload Consultation Recording
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Clinician Name</label>
                  <Input placeholder="e.g. Emma Eddie" value={clinicianName} onChange={e => setClinicianName(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">EMIS Number</label>
                  <Input placeholder="e.g. 12345" value={emisNumber} onChange={e => setEmisNumber(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Audit Date</label>
                  <Input type="date" value={auditDate} onChange={e => setAuditDate(e.target.value)} />
                </div>
              </div>

              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                  dragOver ? "border-primary bg-primary/5" :
                  selectedFile ? "border-emerald-400 bg-emerald-50/30" :
                  "border-border hover:border-primary/50 hover:bg-muted/30"
                }`}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/m4a,audio/mp4"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
                />
                {selectedFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <FileAudio className="w-10 h-10 text-emerald-500" />
                    <p className="font-medium text-foreground">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(1)} MB</p>
                    <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); setSelectedFile(null); }}>Remove</Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Mic className="w-10 h-10 text-muted-foreground" />
                    <p className="font-medium text-foreground">Drop audio file here or click to browse</p>
                    <p className="text-sm text-muted-foreground">MP3, WAV, or M4A — max 25 MB</p>
                  </div>
                )}
              </div>

              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                <strong>Consent reminder:</strong> Ensure you have obtained explicit consent from all parties before uploading a recording. Audio files are processed securely and used solely for this audit.
              </div>

              <Button className="w-full" disabled={!selectedFile || uploadMutation.isPending} onClick={handleUpload}>
                {uploadMutation.isPending ? <><Spinner className="w-4 h-4 mr-2" /> Uploading…</> : <><Upload className="w-4 h-4 mr-2" /> Upload and Continue</>}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Step: Review transcript ── */}
        {step === "review" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ClipboardList className="w-5 h-5" />
                Review Transcript
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Review and correct the transcript below before evaluation. You can edit any errors, particularly medical terms or names.
              </p>
              <Textarea
                value={transcript}
                onChange={e => setTranscript(e.target.value)}
                className="min-h-[300px] font-mono text-sm"
                placeholder="Transcript will appear here…"
              />
              <Button className="w-full" disabled={!transcript.trim() || evaluateMutation.isPending} onClick={handleEvaluate}>
                {evaluateMutation.isPending ? <><Spinner className="w-4 h-4 mr-2" /> Evaluating against audit criteria…</> : "Evaluate Against Audit Criteria"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Step: Results ── */}
        {step === "results" && auditResult && (
          <div className="space-y-6">
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-foreground">
                      {auditResult.clinicianName ? `Audit — ${auditResult.clinicianName}` : "Consultation Audit"}
                    </h2>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {auditResult.emisNumber && <Badge variant="outline">EMIS: {auditResult.emisNumber}</Badge>}
                      {auditResult.auditDate && <Badge variant="outline">{auditResult.auditDate}</Badge>}
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Evaluated</Badge>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleReset}>
                    <RotateCcw className="w-4 h-4 mr-1" /> New Audit
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Part A — Red/Green/Amber Light Domains</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Green = satisfactory · Amber = minor concern · Red = significant concern</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <TrafficLight status={auditResult.consultationSuitability} label="Consultation Suitability" />
                  <TrafficLight status={auditResult.workingDiagnosis} label="Working Diagnosis" />
                  <TrafficLight status={auditResult.redFlagsLight} label="Red Flags" />
                  <TrafficLight status={auditResult.treatmentFollowUp} label="Treatment & Follow-up" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Part B — Detailed Criteria Scores</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Scored 0 (not done) · 1 (partial) · 2 (done well) · N/A (cannot be assessed from audio)
                </p>
              </CardHeader>
              <CardContent>
                {criteria?.map(c => (
                  <CriterionRow
                    key={c.id}
                    label={c.label}
                    section={c.section}
                    score={auditResult.criteriaScores?.[c.id] ?? null}
                    audioAssessable={c.audioAssessable}
                  />
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Part C — Supervisor Narrative</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {auditResult.clinicalStrengths && (
                  <div>
                    <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1">Clinical Strengths</p>
                    <p className="text-sm text-foreground leading-relaxed">{auditResult.clinicalStrengths}</p>
                  </div>
                )}
                {auditResult.clinicalConcerns && (
                  <div>
                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Clinical Concerns / Learning Points</p>
                    <p className="text-sm text-foreground leading-relaxed">{auditResult.clinicalConcerns}</p>
                  </div>
                )}
                {auditResult.nonClinicalConcerns && (
                  <div>
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Non-Clinical Concerns</p>
                    <p className="text-sm text-foreground leading-relaxed">{auditResult.nonClinicalConcerns}</p>
                  </div>
                )}
                {auditResult.additionalNotes && (
                  <div>
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Additional Notes</p>
                    <p className="text-sm text-foreground leading-relaxed">{auditResult.additionalNotes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {auditResult.transcript && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Full Transcript</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed max-h-64 overflow-y-auto">
                    {auditResult.transcript}
                  </pre>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Audit history */}
        {step === "upload" && auditHistory && auditHistory.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
              <History className="w-4 h-4" /> Recent Audits
            </h2>
            <div className="space-y-2">
              {auditHistory.slice(0, 5).map(a => (
                <div
                  key={a.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => {
                    setAuditId(a.id);
                    if (a.status === "evaluated") {
                      setAuditResult(a as AuditResult);
                      setStep("results");
                    } else if (a.status === "transcribed" && a.transcript) {
                      setTranscript(a.transcript);
                      setStep("review");
                    } else {
                      setStep("upload");
                    }
                  }}
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{a.clinicianName ?? "Unnamed clinician"}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.auditDate ?? new Date(a.createdAt).toLocaleDateString("en-GB")}
                      {a.emisNumber ? ` · EMIS ${a.emisNumber}` : ""}
                    </p>
                  </div>
                  <Badge className={
                    a.status === "evaluated" ? "bg-emerald-100 text-emerald-800 border-emerald-200" :
                    a.status === "transcribed" ? "bg-blue-100 text-blue-800 border-blue-200" :
                    "bg-slate-100 text-slate-600 border-slate-200"
                  }>
                    {a.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
