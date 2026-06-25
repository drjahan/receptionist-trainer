import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import {
  TrendingUp, BookOpen, Award, Clock, ChevronRight,
  Star, BarChart3, Calendar
} from "lucide-react";

const COMPETENCIES = [
  { key: "activeListeningEmpathy", label: "Active Listening and Empathy" },
  { key: "informationGathering", label: "Information Gathering" },
  { key: "policyAdherence", label: "Policy Adherence" },
  { key: "communicationClarity", label: "Communication Clarity" },
  { key: "deEscalation", label: "De-escalation" },
] as const;

const gradeColour: Record<string, string> = {
  "A+": "bg-emerald-500 text-white",
  "A": "bg-emerald-400 text-white",
  "B+": "bg-teal-500 text-white",
  "B": "bg-teal-400 text-white",
  "C+": "bg-amber-500 text-white",
  "C": "bg-amber-400 text-white",
  "D": "bg-rose-500 text-white",
};

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatDuration(s: number | null) {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

export default function History() {
  const { data: history, isLoading } = trpc.sessions.myHistory.useQuery();

  const completedSessions = history?.filter(s => s.status === "completed" && s.score) ?? [];

  // Compute averages
  const avgScore = completedSessions.length > 0
    ? completedSessions.reduce((acc, s) => acc + (s.score?.overallScore ?? 0), 0) / completedSessions.length
    : null;

  const competencyAverages = COMPETENCIES.map(({ key, label }) => {
    const avg = completedSessions.length > 0
      ? completedSessions.reduce((acc, s) => acc + ((s.score?.[key] as number) ?? 0), 0) / completedSessions.length
      : null;
    return { key, label, avg };
  });

  return (
    <AppLayout>
      <div className="container py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-1">My Progress</h1>
            <p className="text-muted-foreground">Track your development across all training sessions.</p>
          </div>
          <Button asChild className="gap-2">
            <Link href="/scenarios">
              <BookOpen className="w-4 h-4" />
              Start New Session
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-card rounded-xl border border-border p-6 animate-pulse">
                <div className="h-4 bg-muted rounded w-1/2 mb-3" />
                <div className="h-8 bg-muted rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
              <div className="bg-card rounded-xl border border-border card-shadow p-6">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                  <BookOpen className="w-4 h-4" />
                  Sessions Completed
                </div>
                <div className="text-3xl font-bold text-foreground">{completedSessions.length}</div>
              </div>
              <div className="bg-card rounded-xl border border-border card-shadow p-6">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                  <BarChart3 className="w-4 h-4" />
                  Average Score
                </div>
                <div className="text-3xl font-bold text-foreground">
                  {avgScore !== null ? `${avgScore.toFixed(1)}/5.0` : "—"}
                </div>
              </div>
              <div className="bg-card rounded-xl border border-border card-shadow p-6">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                  <Award className="w-4 h-4" />
                  Best Score
                </div>
                <div className="text-3xl font-bold text-foreground">
                  {completedSessions.length > 0
                    ? `${Math.max(...completedSessions.map(s => s.score?.overallScore ?? 0)).toFixed(1)}/5.0`
                    : "—"}
                </div>
              </div>
            </div>

            {/* Competency averages */}
            {completedSessions.length > 0 && (
              <div className="bg-card rounded-xl border border-border card-shadow p-6 mb-8">
                <h2 className="text-base font-semibold text-foreground mb-5 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  Competency Averages
                </h2>
                <div className="space-y-4">
                  {competencyAverages.map(({ key, label, avg }) => (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm text-foreground">{label}</span>
                        <span className={cn(
                          "text-sm font-semibold",
                          avg && avg >= 4.0 ? "text-emerald-600" :
                          avg && avg >= 3.0 ? "text-amber-600" : "text-rose-600"
                        )}>
                          {avg !== null ? `${avg.toFixed(1)}/5.0` : "—"}
                        </span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-700",
                            avg && avg >= 4.0 ? "bg-emerald-500" :
                            avg && avg >= 3.0 ? "bg-amber-400" : "bg-rose-500"
                          )}
                          style={{ width: avg ? `${(avg / 5) * 100}%` : "0%" }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Session list */}
            <div>
              <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                Session History
              </h2>

              {history?.length === 0 ? (
                <div className="bg-card rounded-xl border border-border card-shadow p-12 text-center">
                  <BookOpen className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                  <h3 className="font-semibold text-foreground mb-1">No sessions yet</h3>
                  <p className="text-sm text-muted-foreground mb-5">Start your first training session to see your progress here.</p>
                  <Button asChild>
                    <Link href="/scenarios">Browse Scenarios</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {history?.map((s) => (
                    <div key={s.id} className="bg-card rounded-xl border border-border card-shadow p-5 flex items-center gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-medium text-foreground truncate">{s.scenario?.title ?? "Unknown Scenario"}</span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs shrink-0",
                              s.status === "completed" ? "border-emerald-200 text-emerald-700 bg-emerald-50" :
                              s.status === "abandoned" ? "border-rose-200 text-rose-700 bg-rose-50" :
                              "border-amber-200 text-amber-700 bg-amber-50"
                            )}
                          >
                            {s.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(s.startedAt)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDuration(s.durationSeconds)}
                          </span>
                          {s.scenario && (
                            <span className="flex items-center gap-1">
                              <BookOpen className="w-3 h-3" />
                              {s.scenario.category}
                            </span>
                          )}
                        </div>
                      </div>

                      {s.score && (
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <div className="text-sm font-semibold text-foreground">{s.score.overallScore.toFixed(1)}/5.0</div>
                            <div className="flex gap-0.5 mt-0.5">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={cn(
                                    "w-3 h-3",
                                    star <= Math.round(s.score!.overallScore)
                                      ? "text-amber-400 fill-amber-400"
                                      : "text-muted stroke-muted-foreground/30"
                                  )}
                                />
                              ))}
                            </div>
                          </div>
                          <span className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold",
                            gradeColour[s.score.overallGrade] ?? "bg-muted text-foreground"
                          )}>
                            {s.score.overallGrade}
                          </span>
                          <Button asChild size="sm" variant="outline" className="gap-1">
                            <Link href={`/scorecard/${s.id}`}>
                              View <ChevronRight className="w-3.5 h-3.5" />
                            </Link>
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
