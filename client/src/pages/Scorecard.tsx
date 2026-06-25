import { useParams, useLocation } from "wouter";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Award, ChevronRight, RotateCcw, TrendingUp, CheckCircle, AlertCircle, Star } from "lucide-react";
import { Link } from "wouter";

const COMPETENCIES = [
  { key: "activeListeningEmpathy", label: "Active Listening and Empathy" },
  { key: "informationGathering", label: "Information Gathering" },
  { key: "policyAdherence", label: "Policy Adherence" },
  { key: "communicationClarity", label: "Communication Clarity" },
  { key: "deEscalation", label: "De-escalation" },
] as const;

function ScoreBar({ score }: { score: number }) {
  const pct = (score / 5) * 100;
  const colour =
    score >= 4.5 ? "bg-emerald-500" :
    score >= 4.0 ? "bg-emerald-400" :
    score >= 3.0 ? "bg-amber-400" :
    score >= 2.0 ? "bg-orange-400" : "bg-rose-500";

  return (
    <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all duration-700", colour)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function GradeBadge({ grade }: { grade: string }) {
  const config: Record<string, string> = {
    "A+": "bg-emerald-500 text-white",
    "A": "bg-emerald-400 text-white",
    "B+": "bg-teal-500 text-white",
    "B": "bg-teal-400 text-white",
    "C+": "bg-amber-500 text-white",
    "C": "bg-amber-400 text-white",
    "D": "bg-rose-500 text-white",
  };
  return (
    <span className={cn("inline-flex items-center justify-center w-16 h-16 rounded-2xl text-2xl font-bold card-shadow-lg", config[grade] ?? "bg-muted text-foreground")}>
      {grade}
    </span>
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

  return (
    <AppLayout>
      <div className="container py-10 max-w-3xl">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-medium mb-4">
            <Award className="w-4 h-4" />
            Session Complete
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Your Scorecard</h1>
          {scenario && (
            <p className="text-muted-foreground">{scenario.title}</p>
          )}
        </div>

        {/* Overall score card */}
        <div className="bg-card rounded-2xl border border-border card-shadow-lg p-8 mb-6 text-center">
          <div className="flex items-center justify-center gap-6 mb-6">
            <GradeBadge grade={score.overallGrade} />
            <div className="text-left">
              <div className="text-4xl font-bold text-foreground">{score.overallScore.toFixed(1)}<span className="text-xl text-muted-foreground font-normal">/5.0</span></div>
              <div className="text-sm text-muted-foreground mt-1">Overall Performance Score</div>
            </div>
          </div>

          {/* Star display */}
          <div className="flex justify-center gap-1 mb-6">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={cn(
                  "w-6 h-6",
                  star <= Math.round(score.overallScore)
                    ? "text-amber-400 fill-amber-400"
                    : "text-muted stroke-muted-foreground/30"
                )}
              />
            ))}
          </div>

          {/* Summary panels */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-800">What went well</span>
              </div>
              <p className="text-sm text-emerald-700 leading-relaxed">{score.wentWell}</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-semibold text-amber-800">Areas for improvement</span>
              </div>
              <p className="text-sm text-amber-700 leading-relaxed">{score.areasForImprovement}</p>
            </div>
          </div>
        </div>

        {/* Competency breakdown */}
        <div className="bg-card rounded-2xl border border-border card-shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-5 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Competency Breakdown
          </h2>
          <div className="space-y-5">
            {COMPETENCIES.map(({ key, label }) => {
              const s = score[key] as number;
              const feedback = detailedFeedback[key];
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-foreground">{label}</span>
                    <span className={cn(
                      "text-sm font-bold",
                      s >= 4.0 ? "text-emerald-600" :
                      s >= 3.0 ? "text-amber-600" : "text-rose-600"
                    )}>
                      {s.toFixed(1)}/5.0
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
