import { useParams, useLocation } from "wouter";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Award, ChevronRight, RotateCcw, TrendingUp, CheckCircle, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { useEffect, useState } from "react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, Tooltip
} from "recharts";

const COMPETENCIES = [
  { key: "activeListeningEmpathy", label: "Listening & Empathy", short: "Listening" },
  { key: "informationGathering", label: "Information Gathering", short: "Info Gathering" },
  { key: "policyAdherence", label: "Policy Adherence", short: "Policy" },
  { key: "communicationClarity", label: "Communication Clarity", short: "Clarity" },
  { key: "deEscalation", label: "De-escalation", short: "De-escalation" },
  { key: "googleReviewOffer", label: "Google Review Offer", short: "Review" },
] as const;

const GRADE_CONFIG: Record<string, { bg: string; text: string; ring: string; label: string }> = {
  "A+": { bg: "bg-emerald-500", text: "text-white", ring: "#10b981", label: "Excellent" },
  "A":  { bg: "bg-emerald-400", text: "text-white", ring: "#34d399", label: "Very Good" },
  "B":  { bg: "bg-blue-500",    text: "text-white", ring: "#3b82f6", label: "Good" },
  "C":  { bg: "bg-amber-500",   text: "text-white", ring: "#f59e0b", label: "Needs Improvement" },
  "D":  { bg: "bg-orange-500",  text: "text-white", ring: "#f97316", label: "Below Standard" },
  "F":  { bg: "bg-rose-600",    text: "text-white", ring: "#e11d48", label: "Unsatisfactory" },
};

function RingGauge({ score, grade }: { score: number; grade: string }) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 100); return () => clearTimeout(t); }, []);

  const cfg = GRADE_CONFIG[grade] ?? GRADE_CONFIG["C"];
  const pct = score / 5;
  const radius = 54;
  const circ = 2 * Math.PI * radius;
  const dash = animated ? pct * circ : 0;

  return (
    <div className="relative w-36 h-36 mx-auto">
      <svg viewBox="0 0 128 128" className="w-full h-full -rotate-90">
        <circle cx="64" cy="64" r={radius} fill="none" stroke="currentColor"
          strokeWidth="10" className="text-muted/20" />
        <circle cx="64" cy="64" r={radius} fill="none" stroke={cfg.ring}
          strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ transition: "stroke-dasharray 1.2s cubic-bezier(0.23,1,0.32,1)" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-foreground leading-none">{score.toFixed(1)}</span>
        <span className="text-xs text-muted-foreground mt-0.5">out of 5.0</span>
      </div>
    </div>
  );
}

function ScoreBar({ score }: { score: number }) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 300); return () => clearTimeout(t); }, []);
  const pct = (score / 5) * 100;
  const colour =
    score >= 4.7 ? "bg-emerald-500" :
    score >= 4.3 ? "bg-emerald-400" :
    score >= 3.7 ? "bg-blue-500" :
    score >= 3.0 ? "bg-amber-400" : "bg-rose-500";

  return (
    <div className="w-full bg-secondary rounded-full h-2.5 overflow-hidden">
      <div
        className={cn("h-full rounded-full", colour)}
        style={{
          width: animated ? `${pct}%` : "0%",
          transition: "width 0.9s cubic-bezier(0.23,1,0.32,1)"
        }}
      />
    </div>
  );
}

export default function Scorecard() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = parseInt(params.sessionId || "0");
  const [, navigate] = useLocation();

  const { data: score, isLoading } = trpc.scoring.getScore.useQuery(
    { sessionId },
    { enabled: !!sessionId }
  );
  const { data: session } = trpc.sessions.get.useQuery(
    { id: sessionId },
    { enabled: !!sessionId }
  );
  const { data: scenario } = trpc.scenarios.get.useQuery(
    { id: session?.scenarioId ?? 0 },
    { enabled: !!session?.scenarioId }
  );

  if (isLoading || !score) {
    return (
      <AppLayout>
        <div className="container py-20 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your scorecard...</p>
        </div>
      </AppLayout>
    );
  }

  const detailedFeedback = score.detailedFeedback as Record<string, string>;
  const cfg = GRADE_CONFIG[score.overallGrade] ?? GRADE_CONFIG["C"];

  const radarData = COMPETENCIES.map(({ key, short }) => ({
    subject: short,
    score: score[key] as number,
    fullMark: 5,
  }));

  return (
    <AppLayout>
      <div className="container py-10 max-w-3xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-medium mb-4">
            <Award className="w-4 h-4" />
            Session Complete
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-1">Your Scorecard</h1>
          {scenario && <p className="text-muted-foreground">{scenario.title}</p>}
        </div>

        {/* Overall grade card */}
        <div className="bg-card rounded-2xl border border-border shadow-sm p-8 mb-6">
          <div className="flex flex-col sm:flex-row items-center gap-8">
            {/* Ring gauge */}
            <div className="flex flex-col items-center gap-3 shrink-0">
              <RingGauge score={score.overallScore} grade={score.overallGrade} />
              <div className={cn("px-5 py-1.5 rounded-full text-lg font-bold", cfg.bg, cfg.text)}>
                {score.overallGrade}
              </div>
              <span className="text-sm text-muted-foreground">{cfg.label}</span>
            </div>

            {/* Radar chart */}
            <div className="flex-1 w-full h-52">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <Tooltip
                    formatter={(v: number) => [`${v.toFixed(1)} / 5.0`, "Score"]}
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px"
                    }}
                  />
                  <Radar
                    name="Score"
                    dataKey="score"
                    stroke={cfg.ring}
                    fill={cfg.ring}
                    fillOpacity={0.25}
                    dot={{ r: 3, fill: cfg.ring }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Summary panels */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">What went well</span>
              </div>
              <p className="text-sm text-emerald-700 dark:text-emerald-400 leading-relaxed">{score.wentWell}</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">Areas for improvement</span>
              </div>
              <p className="text-sm text-amber-700 dark:text-amber-400 leading-relaxed">{score.areasForImprovement}</p>
            </div>
          </div>
        </div>

        {/* Competency breakdown */}
        <div className="bg-card rounded-2xl border border-border shadow-sm p-6 mb-6">
          <h2 className="text-base font-semibold text-foreground mb-5 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Competency Breakdown
          </h2>
          <div className="space-y-5">
            {COMPETENCIES.map(({ key, label }) => {
              const s = score[key] as number;
              const feedback = detailedFeedback?.[key];
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-foreground">{label}</span>
                    <span className={cn(
                      "text-sm font-bold tabular-nums",
                      s >= 4.3 ? "text-emerald-600" :
                      s >= 3.7 ? "text-blue-600" :
                      s >= 3.0 ? "text-amber-600" : "text-rose-600"
                    )}>
                      {s.toFixed(1)}<span className="text-muted-foreground font-normal">/5.0</span>
                    </span>
                  </div>
                  <ScoreBar score={s} />
                  {feedback && (
                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{feedback}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Grading scale legend */}
        <div className="bg-muted/40 rounded-xl border border-border p-4 mb-6">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Grading Scale</p>
          <div className="flex flex-wrap gap-2">
            {[
              { grade: "A+", range: "4.7–5.0", colour: "bg-emerald-500" },
              { grade: "A",  range: "4.3–4.69", colour: "bg-emerald-400" },
              { grade: "B",  range: "3.7–4.29", colour: "bg-blue-500" },
              { grade: "C",  range: "3.0–3.69", colour: "bg-amber-500" },
              { grade: "D",  range: "2.0–2.99", colour: "bg-orange-500" },
              { grade: "F",  range: "< 2.0",    colour: "bg-rose-600" },
            ].map(({ grade, range, colour }) => (
              <div key={grade} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={cn("w-5 h-5 rounded flex items-center justify-center text-white text-[10px] font-bold", colour)}>{grade}</span>
                <span>{range}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 justify-center">
          <Button asChild variant="outline" className="gap-2">
            <Link href="/scenarios">
              <RotateCcw className="w-4 h-4" />
              Try Another Scenario
            </Link>
          </Button>
          <Button asChild className="gap-2">
            <Link href="/history">
              <TrendingUp className="w-4 h-4" />
              View My Progress
              <ChevronRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
