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
  FileImage,
  Mic,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronRight,
  RotateCcw,
  ClipboardList,
  History,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { Link } from "wouter";
import AppLayout from "@/components/AppLayout";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = "upload" | "review" | "results";

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
          <p className="text-xs text-muted-foreground mt-0.5 italic">Assessed from EMIS screenshot if provided</p>
        )}
      </div>
      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0 ${scoreBg}`}>
        {scoreLabel}
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

  // Audio upload state
  const [dragOverAudio, setDragOverAudio] = useState(false);
  const [selectedAudioFile, setSelectedAudioFile] = useState<File | null>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // EMIS screenshot state
  const [dragOverEmis, setDragOverEmis] = useState(false);
  const [selectedEmisFile, setSelectedEmisFile] = useState<File | null>(null);
  const emisInputRef = useRef<HTMLInputElement>(null);

  // Stored EMIS screenshot base64 (echoed back from upload, passed to evaluate)
  const [emisScreenshotBase64, setEmisScreenshotBase64] = useState<string | null>(null);
  const [emisScreenshotMimeType, setEmisScreenshotMimeType] = useState<string | null>(null);

  // Form fields
  const [clinicianName, setClinicianName] = useState("");
  const [emisNumber, setEmisNumber] = useState("");
  const [auditDate, setAuditDate] = useState(new Date().toISOString().split("T")[0]);

  const { data: criteria } = trpc.callAudit.getCriteria.useQuery();
  const { data: auditHistory } = trpc.callAudit.list.useQuery();

  const uploadMutation = trpc.callAudit.upload.useMutation({
    onSuccess: (data) => {
      setAuditId(data.auditId);
      setTranscript(data.transcript);
      // Store echoed EMIS screenshot for the evaluate step
      if (data.emisScreenshotBase64) {
        setEmisScreenshotBase64(data.emisScreenshotBase64);
        setEmisScreenshotMimeType(data.emisScreenshotMimeType ?? "image/png");
      }
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

  // ── Audio file selection ──────────────────────────────────────────────────

  const handleAudioFileSelect = useCallback((file: File) => {
    const allowedExts = ["mp3", "wav", "m4a", "mp4"];
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!allowedExts.includes(ext ?? "")) {
      toast.error("Please upload an MP3, WAV, or M4A audio file");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Audio file must be under 25 MB");
      return;
    }
    setSelectedAudioFile(file);
  }, []);

  const handleAudioDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOverAudio(false);
    const file = e.dataTransfer.files[0];
    if (file) handleAudioFileSelect(file);
  }, [handleAudioFileSelect]);

  // ── EMIS screenshot file selection ───────────────────────────────────────

  const handleEmisFileSelect = useCallback((file: File) => {
    const allowedExts = ["png", "jpg", "jpeg", "pdf"];
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!allowedExts.includes(ext ?? "")) {
      toast.error("Please upload a PNG, JPG, or PDF screenshot");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Screenshot must be under 5 MB");
      return;
    }
    setSelectedEmisFile(file);
  }, []);

  const handleEmisDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOverEmis(false);
    const file = e.dataTransfer.files[0];
    if (file) handleEmisFileSelect(file);
  }, [handleEmisFileSelect]);

  // ── Upload handler ────────────────────────────────────────────────────────

  const handleUpload = async () => {
    if (!selectedAudioFile) return;

    // Read audio as base64
    const audioBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(selectedAudioFile);
    });

    // Optionally read EMIS screenshot as base64
    let emisBase64: string | undefined;
    let emisMime: string | undefined;
    if (selectedEmisFile) {
      emisBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(selectedEmisFile);
      });
      emisMime = selectedEmisFile.type || "image/png";
    }

    uploadMutation.mutate({
      clinicianName: clinicianName || undefined,
      emisNumber: emisNumber || undefined,
      auditDate: auditDate || undefined,
      audioBase64,
      audioMimeType: selectedAudioFile.type || "audio/mpeg",
      audioFilename: selectedAudioFile.name,
      emisScreenshotBase64: emisBase64,
      emisScreenshotMimeType: emisMime,
    });
  };

  const handleEvaluate = () => {
    if (!auditId) return;
    evaluateMutation.mutate({
      auditId,
      transcriptOverride: transcript,
      emisScreenshotBase64: emisScreenshotBase64 ?? undefined,
      emisScreenshotMimeType: emisScreenshotMimeType ?? undefined,
    });
  };

  const handleReset = () => {
    setStep("upload");
    setAuditId(null);
    setTranscript("");
    setAuditResult(null);
    setSelectedAudioFile(null);
    setSelectedEmisFile(null);
    setEmisScreenshotBase64(null);
    setEmisScreenshotMimeType(null);
    setClinicianName("");
    setEmisNumber("");
    setAuditDate(new Date().toISOString().split("T")[0]);
  };

  const steps: { id: Step; label: string }[] = [
    { id: "upload", label: "Upload & Transcribe" },
    { id: "review", label: "Review" },
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

              {/* Metadata fields */}
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

              {/* Audio upload zone */}
              <div>
                <label className="text-xs font-semibold text-foreground block mb-2 flex items-center gap-1.5">
                  <FileAudio className="w-3.5 h-3.5" />
                  Audio Recording <span className="text-red-500">*</span>
                </label>
                <div
                  className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
                    dragOverAudio ? "border-primary bg-primary/5" :
                    selectedAudioFile ? "border-emerald-400 bg-emerald-50/30" :
                    "border-border hover:border-primary/50 hover:bg-muted/30"
                  }`}
                  onDragOver={e => { e.preventDefault(); setDragOverAudio(true); }}
                  onDragLeave={() => setDragOverAudio(false)}
                  onDrop={handleAudioDrop}
                  onClick={() => audioInputRef.current?.click()}
                >
                  <input
                    ref={audioInputRef}
                    type="file"
                    accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/m4a,audio/mp4"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleAudioFileSelect(f); }}
                  />
                  {selectedAudioFile ? (
                    <div className="flex flex-col items-center gap-2">
                      <FileAudio className="w-8 h-8 text-emerald-500" />
                      <p className="font-medium text-foreground text-sm">{selectedAudioFile.name}</p>
                      <p className="text-xs text-muted-foreground">{(selectedAudioFile.size / 1024 / 1024).toFixed(1)} MB</p>
                      <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); setSelectedAudioFile(null); }}>Remove</Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Mic className="w-8 h-8 text-muted-foreground" />
                      <p className="font-medium text-foreground text-sm">Drop audio file here or click to browse</p>
                      <p className="text-xs text-muted-foreground">MP3, WAV, or M4A — max 25 MB</p>
                    </div>
                  )}
                </div>
              </div>

              {/* EMIS screenshot upload zone */}
              <div>
                <label className="text-xs font-semibold text-foreground block mb-2 flex items-center gap-1.5">
                  <FileImage className="w-3.5 h-3.5" />
                  EMIS Record Screenshot <span className="text-muted-foreground font-normal">(optional — improves documentation scoring)</span>
                </label>
                <div
                  className={`border-2 border-dashed rounded-xl p-5 text-center transition-colors cursor-pointer ${
                    dragOverEmis ? "border-violet-400 bg-violet-50/30" :
                    selectedEmisFile ? "border-violet-400 bg-violet-50/30" :
                    "border-border hover:border-violet-300 hover:bg-muted/20"
                  }`}
                  onDragOver={e => { e.preventDefault(); setDragOverEmis(true); }}
                  onDragLeave={() => setDragOverEmis(false)}
                  onDrop={handleEmisDrop}
                  onClick={() => emisInputRef.current?.click()}
                >
                  <input
                    ref={emisInputRef}
                    type="file"
                    accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleEmisFileSelect(f); }}
                  />
                  {selectedEmisFile ? (
                    <div className="flex flex-col items-center gap-2">
                      <FileImage className="w-7 h-7 text-violet-500" />
                      <p className="font-medium text-foreground text-sm">{selectedEmisFile.name}</p>
                      <p className="text-xs text-muted-foreground">{(selectedEmisFile.size / 1024).toFixed(0)} KB</p>
                      <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); setSelectedEmisFile(null); }}>Remove</Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <FileImage className="w-7 h-7 text-muted-foreground/60" />
                      <p className="text-sm text-muted-foreground">Drop EMIS screenshot here or click to browse</p>
                      <p className="text-xs text-muted-foreground">PNG, JPG, or PDF — max 5 MB</p>
                    </div>
                  )}
                </div>
                {selectedEmisFile && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-violet-700">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Ensure patient name and NHS number are cropped or redacted before uploading</span>
                  </div>
                )}
              </div>

              {/* GDPR consent reminder */}
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900 space-y-2">
                <p className="font-bold text-amber-900">GDPR &amp; Data Protection Notice</p>
                <p>
                  These audits are conducted for <strong>clinical supervision purposes only</strong> and do not form part of any patient record.
                </p>
                <p>
                  When uploading an EMIS or clinical system screenshot, please ensure that all <strong>patient-identifiable details</strong> — including name, date of birth, NHS number, and address — are <strong>cropped or redacted</strong> before upload.
                </p>
                <p>
                  For your assurance: we operate an <strong>on-premises AI processing computer at Utopia House</strong> that automatically strips patient-identifiable information from the audio recording before any data leaves the building. Any information transmitted for cloud-based transcription and analysis is <strong>fully anonymised</strong> and relates to the clinician's consultation technique only.
                </p>
                <p>
                  Please also ensure you have obtained <strong>explicit consent</strong> from all parties prior to recording the consultation.
                </p>
              </div>

              <Button
                className="w-full"
                disabled={!selectedAudioFile || uploadMutation.isPending}
                onClick={handleUpload}
              >
                {uploadMutation.isPending ? (
                  <><Spinner className="w-4 h-4 mr-2" /> Uploading &amp; transcribing…</>
                ) : (
                  <><Upload className="w-4 h-4 mr-2" /> Upload and Transcribe</>
                )}
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
                Review and correct the transcript below before evaluation. You can edit any errors, particularly medical terms or drug names.
              </p>
              {emisScreenshotBase64 && (
                <div className="flex items-center gap-2 rounded-lg bg-violet-50 border border-violet-200 px-3 py-2 text-xs text-violet-800">
                  <FileImage className="w-4 h-4 shrink-0" />
                  <span>EMIS screenshot attached — documentation criteria will be scored by GPT-4o Vision</span>
                </div>
              )}
              <Textarea
                value={transcript}
                onChange={e => setTranscript(e.target.value)}
                className="min-h-[300px] font-mono text-sm"
                placeholder="Transcript will appear here..."
              />
              <Button
                className="w-full"
                disabled={!transcript.trim() || evaluateMutation.isPending}
                onClick={handleEvaluate}
              >
                {evaluateMutation.isPending ? (
                  <><Spinner className="w-4 h-4 mr-2" /> Evaluating against audit criteria...</>
                ) : (
                  "Evaluate Against Audit Criteria"
                )}
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
                      {emisScreenshotBase64 && (
                        <Badge className="bg-violet-100 text-violet-800 border-violet-200">
                          <FileImage className="w-3 h-3 mr-1" /> EMIS screenshot included
                        </Badge>
                      )}
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
                  Scored 0 (not done) · 1 (partial) · 2 (done well) · N/A (cannot be assessed)
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
