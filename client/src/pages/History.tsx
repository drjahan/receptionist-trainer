import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { useState } from "react";
import {
  TrendingUp, BookOpen, Award, Clock, ChevronRight,
  BarChart3, Calendar, Flame, Target, PhoneCall, Stethoscope, Pill
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, ReferenceLine
} from "recharts";

const COMPETENCIES = [
  { key: "activeListeningEmpathy", label: "Listening & Empathy", colour: "#10b981" },
  { key: "informationGathering",   label: "Info Gathering",       colour: "#3b82f6" },
  { key: "policyAdherence",        label: "Policy Adherence",     colour: "#8b5cf6" },
  { key: "communicationClarity",   label: "Clarity",              colour: "#f59e0b" },
  { key: "deEscalation",           label: "De-escalation",        colour: "#ef4444" },
] as const;

const GRADE_CONFIG: Record<string, { bg: string; text: string }> = {
  "A+": { bg: "bg-emerald-500", text: "text-white" },
  "A":  { bg: "bg-emerald-400", text: "text-white" },
  "B":  { bg: "bg-blue-500",    text: "text-white" },
  "C":  { bg: "bg-amber-500",   text: "text-white" },
  "D":  { bg: "bg-orange-500",  text: "text-white" },
  "F":  { bg: "bg-rose-600",    text: "text-white" },
};

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function formatDuration(s: number | null) {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

export default function History() {
  const { data: history, isLoading } = trpc.sessions.myHistory.useQuery();
  const [modeFilter, setModeFilter] = useState<"all" | "receptionist" | "gp" | "pharmacist">("all");

  const allCompleted = history?.filter(s => s.status === "completed" && s.score) ?? [];
  const completedSessions = modeFilter === "all"
    ? allCompleted
    : allCompleted.filter(s => s.scenario?.mode === modeFilter);
  const receptionistCount = allCompleted.filter(s => s.scenario?.mode === "receptionist").length;
  const gpCount = allCompleted.filter(s => s.scenario?.mode === "gp").length;
  const pharmacistCount = allCompleted.filter(s => s.scenario?.mode === "pharmacist").length;
  const sortedByDate = [...completedSessions].sort((a, b) =>
    new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
  );

  const avgScore = completedSessions.length > 0
    ? completedSessions.reduce((acc, s) => acc + (s.score?.overallScore ?? 0), 0) / completedSessions.length
    : null;

  const bestScore = completedSessions.length > 0
    ? Math.max(...completedSessions.map(s => s.score?.overallScore ?? 0))
    : null;

  // Streak: consecutive sessions with score >= 3.7 (grade B or above)
  const streak = (() => {
    let count = 0;
    for (let i = completedSessions.length - 1; i >= 0; i--) {
      if ((completedSessions[i].score?.overallScore ?? 0) >= 3.7) count++;
      else break;
    }
    return count;
  })();

  // Line chart data: score over time
  const lineData = sortedByDate.map((s, i) => ({
    session: i + 1,
    date: formatDate(s.startedAt),
    score: s.score?.overallScore ?? 0,
    grade: s.score?.overallGrade ?? "",
  }));

  // Bar chart data: competency averages
  const barData = COMPETENCIES.map(({ key, label, colour }) => ({
    name: label,
    avg: completedSessions.length > 0
      ? Math.round(
          completedSessions.reduce((acc, s) => acc + ((s.score?.[key] as number) ?? 0), 0)
          / completedSessions.length * 10
        ) / 10
      : 0,
    colour,
  }));

  // Most improved: compare first half vs second half
  const mostImproved = (() => {
    if (completedSessions.length < 4) return null;
    const half = Math.floor(completedSessions.length / 2);
    const first = completedSessions.slice(0, half);
    const second = completedSessions.slice(half);
    let best = { label: "", delta: 0 };
    for (const { key, label } of COMPETENCIES) {
      const avgFirst = first.reduce((a, s) => a + ((s.score?.[key] as number) ?? 0), 0) / first.length;
      const avgSecond = second.reduce((a, s) => a + ((s.score?.[key] as number) ?? 0), 0) / second.length;
      const delta = avgSecond - avgFirst;
      if (delta > best.delta) best = { label, delta };
    }
    return best.delta > 0 ? best : null;
  })();

  return (
    <AppLayout>
      <div className="container py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
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

        {/* Mode filter tabs */}
        <div className="flex gap-2 mb-8 flex-wrap">
          {(["all", "receptionist", "gp", "pharmacist"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setModeFilter(m)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all border",
                modeFilter === m
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:border-primary/40"
              )}
            >
              {m === "all" && <BookOpen className="w-3.5 h-3.5" />}
              {m === "receptionist" && <PhoneCall className="w-3.5 h-3.5" />}
              {m === "gp" && <Stethoscope className="w-3.5 h-3.5" />}
              {m === "pharmacist" && <Pill className="w-3.5 h-3.5" />}
              {m === "all" ? `All (${allCompleted.length})` : m === "receptionist" ? `Receptionist (${receptionistCount})` : m === "gp" ? `GP (${gpCount})` : `Pharmacist (${pharmacistCount})`}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-card rounded-xl border border-border p-5 animate-pulse">
                <div className="h-3 bg-muted rounded w-2/3 mb-3" />
                <div className="h-7 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-card rounded-xl border border-border shadow-sm p-5">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
                  <BookOpen className="w-3.5 h-3.5" />
                  Sessions Done
                </div>
                <div className="text-3xl font-bold text-foreground">{completedSessions.length}</div>
              </div>
              <div className="bg-card rounded-xl border border-border shadow-sm p-5">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
                  <BarChart3 className="w-3.5 h-3.5" />
                  Average Score
                </div>
                <div className="text-3xl font-bold text-foreground">
                  {avgScore !== null ? avgScore.toFixed(1) : "—"}
                  {avgScore !== null && <span className="text-sm text-muted-foreground font-normal">/5.0</span>}
                </div>
              </div>
              <div className="bg-card rounded-xl border border-border shadow-sm p-5">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
                  <Award className="w-3.5 h-3.5" />
                  Best Score
                </div>
                <div className="text-3xl font-bold text-foreground">
                  {bestScore !== null ? bestScore.toFixed(1) : "—"}
                  {bestScore !== null && <span className="text-sm text-muted-foreground font-normal">/5.0</span>}
                </div>
              </div>
              <div className="bg-card rounded-xl border border-border shadow-sm p-5">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
                  <Flame className="w-3.5 h-3.5 text-orange-500" />
                  Grade B+ Streak
                </div>
                <div className="text-3xl font-bold text-foreground">
                  {streak}
                  <span className="text-sm text-muted-foreground font-normal ml-1">sessions</span>
                </div>
              </div>
            </div>

            {completedSessions.length === 0 ? (
              <div className="bg-card rounded-xl border border-border shadow-sm p-12 text-center">
                <BookOpen className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                <h3 className="font-semibold text-foreground mb-1">No sessions yet</h3>
                <p className="text-sm text-muted-foreground mb-5">Complete your first training session to see your progress here.</p>
                <Button asChild><Link href="/scenarios">Browse Scenarios</Link></Button>
              </div>
            ) : (
              <>
                {/* Score over time line chart */}
                {lineData.length > 1 && (
                  <div className="bg-card rounded-xl border border-border shadow-sm p-6 mb-6">
                    <h2 className="text-base font-semibold text-foreground mb-1 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      Score Over Time
                    </h2>
                    <p className="text-xs text-muted-foreground mb-5">Your overall score across each completed session.</p>
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={lineData} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                          <YAxis domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                          <Tooltip
                            formatter={(v: number, _name: string, item) =>
                              [`${(v as number).toFixed(1)} / 5.0 (${(item?.payload as { grade?: string })?.grade ?? ""})`, "Score"]
                            }
                            contentStyle={{
                              background: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                              fontSize: "12px"
                            }}
                          />
                          <ReferenceLine y={4.3} stroke="#10b981" strokeDasharray="4 4" label={{ value: "A", position: "right", fontSize: 10, fill: "#10b981" }} />
                          <ReferenceLine y={3.7} stroke="#3b82f6" strokeDasharray="4 4" label={{ value: "B", position: "right", fontSize: 10, fill: "#3b82f6" }} />
                          <Line
                            type="monotone"
                            dataKey="score"
                            stroke="hsl(var(--primary))"
                            strokeWidth={2.5}
                            dot={{ r: 4, fill: "hsl(var(--primary))", strokeWidth: 0 }}
                            activeDot={{ r: 6 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    {mostImproved && (
                      <div className="mt-3 flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2">
                        <Target className="w-3.5 h-3.5 shrink-0" />
                        Most improved: <strong>{mostImproved.label}</strong> (+{mostImproved.delta.toFixed(1)} pts vs. your first sessions)
                      </div>
                    )}
                  </div>
                )}

                {/* Competency averages bar chart */}
                <div className="bg-card rounded-xl border border-border shadow-sm p-6 mb-6">
                  <h2 className="text-base font-semibold text-foreground mb-1 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    Competency Averages
                  </h2>
                  <p className="text-xs text-muted-foreground mb-5">Average score per competency across all your sessions.</p>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barData} margin={{ top: 5, right: 10, bottom: 20, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                          angle={-20}
                          textAnchor="end"
                          interval={0}
                        />
                        <YAxis domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                        <Tooltip
                          formatter={(v: number) => [`${v.toFixed(1)} / 5.0`, "Average"]}
                          contentStyle={{
                            background: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                            fontSize: "12px"
                          }}
                        />
                        <ReferenceLine y={3.7} stroke="#6b7280" strokeDasharray="4 4" />
                        <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
                          {barData.map((entry, index) => (
                            <Cell key={index} fill={entry.colour} fillOpacity={0.85} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Session history list */}
                <div>
                  <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    Session History
                  </h2>
                  <div className="space-y-3">
                    {history?.filter(s => modeFilter === "all" || s.scenario?.mode === modeFilter).map((s) => (
                      <div key={s.id} className="bg-card rounded-xl border border-border shadow-sm p-5 flex items-center gap-4 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-medium text-foreground truncate">{s.scenario?.title ?? "Unknown Scenario"}</span>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-xs shrink-0",
                                s.status === "completed" ? "border-emerald-200 text-emerald-700 bg-emerald-50" :
                                "border-amber-200 text-amber-700 bg-amber-50"
                              )}
                            >
                              {s.status}
                            </Badge>
                            {s.scenario?.mode === "receptionist" && (
                              <Badge variant="outline" className="text-xs shrink-0 border-blue-200 text-blue-700 bg-blue-50 flex items-center gap-1">
                                <PhoneCall className="w-3 h-3" /> Receptionist
                              </Badge>
                            )}
                            {s.scenario?.mode === "gp" && (
                              <Badge variant="outline" className="text-xs shrink-0 border-purple-200 text-purple-700 bg-purple-50 flex items-center gap-1">
                                <Stethoscope className="w-3 h-3" /> GP
                              </Badge>
                            )}
                            {s.scenario?.mode === "pharmacist" && (
                              <Badge variant="outline" className="text-xs shrink-0 border-emerald-200 text-emerald-700 bg-emerald-50 flex items-center gap-1">
                                <Pill className="w-3 h-3" /> Pharmacist
                              </Badge>
                            )}
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
                              <div className="text-sm font-semibold text-foreground tabular-nums">{s.score.overallScore.toFixed(1)}/5.0</div>
                            </div>
                            <span className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0",
                              GRADE_CONFIG[s.score.overallGrade]?.bg ?? "bg-muted",
                              GRADE_CONFIG[s.score.overallGrade]?.text ?? "text-foreground"
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
                </div>
              </>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
