import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import {
  ShieldCheck, Users, BarChart3, TrendingUp, BookOpen,
  Calendar, Clock, ChevronRight, Star, Award, PhoneCall, Stethoscope, Filter, Pill
} from "lucide-react";

const COMPETENCIES = [
  { key: "avgActiveListeningEmpathy", label: "Active Listening and Empathy" },
  { key: "avgInformationGathering", label: "Information Gathering" },
  { key: "avgPolicyAdherence", label: "Policy Adherence" },
  { key: "avgCommunicationClarity", label: "Communication Clarity" },
  { key: "avgDeEscalation", label: "De-escalation" },
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

export default function Admin() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && user?.role !== "admin") {
      navigate("/");
    }
  }, [user, loading, navigate]);

  const [sessionModeFilter, setSessionModeFilter] = useState<"all" | "receptionist" | "gp" | "pharmacist">("all");
  const { data: teamStats, isLoading: statsLoading } = trpc.admin.teamStats.useQuery();
  const { data: allSessions, isLoading: sessionsLoading } = trpc.admin.allSessions.useQuery();
  const { data: allUsers, isLoading: usersLoading } = trpc.admin.allUsers.useQuery();

  const filteredSessions = allSessions?.filter(s =>
    sessionModeFilter === "all" || s.scenario?.mode === sessionModeFilter
  );

  if (loading || user?.role !== "admin") {
    return (
      <AppLayout>
        <div className="container py-20 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container py-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
            <p className="text-muted-foreground text-sm">Team performance overview — GP Pathfinder Clinics</p>
          </div>
        </div>

        {/* Team stats */}
        {statsLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-card rounded-xl border border-border p-5 animate-pulse">
                <div className="h-3 bg-muted rounded w-3/4 mb-3" />
                <div className="h-7 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : teamStats ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <div className="bg-card rounded-xl border border-border card-shadow p-5 col-span-2 md:col-span-1">
              <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5" /> Total Sessions
              </div>
              <div className="text-2xl font-bold text-foreground">{teamStats.totalSessions}</div>
            </div>
            <div className="bg-card rounded-xl border border-border card-shadow p-5">
              <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Award className="w-3.5 h-3.5" /> Avg Overall
              </div>
              <div className="text-2xl font-bold text-foreground">{teamStats.avgOverall.toFixed(1)}</div>
            </div>
            {COMPETENCIES.map(({ key, label }) => (
              <div key={key} className="bg-card rounded-xl border border-border card-shadow p-5">
                <div className="text-xs text-muted-foreground mb-1 leading-tight">{label.split(" ").slice(0, 2).join(" ")}</div>
                <div className={cn(
                  "text-2xl font-bold",
                  (teamStats[key] ?? 0) >= 4.0 ? "text-emerald-600" :
                  (teamStats[key] ?? 0) >= 3.0 ? "text-amber-600" : "text-rose-600"
                )}>
                  {(teamStats[key] ?? 0).toFixed(1)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-secondary/50 rounded-xl p-8 text-center mb-8">
            <BarChart3 className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">No completed sessions yet. Stats will appear once staff complete training sessions.</p>
          </div>
        )}

        {/* Competency bar chart */}
        {teamStats && (
          <div className="bg-card rounded-xl border border-border card-shadow p-6 mb-8">
            <h2 className="text-base font-semibold text-foreground mb-5 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Team Competency Averages
            </h2>
            <div className="space-y-4">
              {COMPETENCIES.map(({ key, label }) => {
                const val = teamStats[key] ?? 0;
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm text-foreground">{label}</span>
                      <span className={cn(
                        "text-sm font-semibold",
                        val >= 4.0 ? "text-emerald-600" :
                        val >= 3.0 ? "text-amber-600" : "text-rose-600"
                      )}>
                        {val.toFixed(1)}/5.0
                      </span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2.5">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-700",
                          val >= 4.0 ? "bg-emerald-500" :
                          val >= 3.0 ? "bg-amber-400" : "bg-rose-500"
                        )}
                        style={{ width: `${(val / 5) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Staff overview */}
          <div className="bg-card rounded-xl border border-border card-shadow p-6">
            <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Staff Overview
            </h2>
            {usersLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />)}
              </div>
            ) : allUsers?.length === 0 ? (
              <p className="text-sm text-muted-foreground">No staff registered yet.</p>
            ) : (
              <div className="space-y-2">
                {allUsers?.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/50 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-semibold text-primary">
                        {u.name?.charAt(0)?.toUpperCase() ?? "U"}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{u.name ?? "Unknown"}</div>
                      <div className="text-xs text-muted-foreground">{u.sessionCount} sessions</div>
                    </div>
                    {u.avgScore !== null && (
                      <span className={cn(
                        "text-xs font-semibold",
                        u.avgScore >= 4.0 ? "text-emerald-600" :
                        u.avgScore >= 3.0 ? "text-amber-600" : "text-rose-600"
                      )}>
                        {u.avgScore.toFixed(1)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent sessions */}
          <div className="lg:col-span-2 bg-card rounded-xl border border-border card-shadow p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                Recent Sessions
              </h2>
              <div className="flex gap-1.5">
                {(["all", "receptionist", "gp", "pharmacist"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setSessionModeFilter(m)}
                    className={cn(
                      "flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all border",
                      sessionModeFilter === m
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-muted-foreground border-border hover:border-primary/40"
                    )}
                  >
                    {m === "all" && <Filter className="w-3 h-3" />}
                    {m === "receptionist" && <PhoneCall className="w-3 h-3" />}
                    {m === "gp" && <Stethoscope className="w-3 h-3" />}
                    {m === "pharmacist" && <Pill className="w-3 h-3" />}
                    {m === "all" ? `All (${allSessions?.length ?? 0})` : m === "receptionist" ? `Rec (${allSessions?.filter(s => s.scenario?.mode === "receptionist").length ?? 0})` : m === "gp" ? `GP (${allSessions?.filter(s => s.scenario?.mode === "gp").length ?? 0})` : `Pharm (${allSessions?.filter(s => s.scenario?.mode === "pharmacist").length ?? 0})`}
                  </button>
                ))}
              </div>
            </div>
            {sessionsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}
              </div>
            ) : filteredSessions?.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sessions recorded yet.</p>
            ) : (
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {filteredSessions?.slice(0, 20).map((s) => (
                  <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-secondary/30 transition-colors flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground truncate">{s.scenario?.title ?? "Unknown"}</span>
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
                        {s.scenario?.mode === "receptionist" && (
                          <Badge variant="outline" className="text-xs shrink-0 border-blue-200 text-blue-700 bg-blue-50 flex items-center gap-1">
                            <PhoneCall className="w-3 h-3" /> Rec
                          </Badge>
                        )}
                        {s.scenario?.mode === "gp" && (
                          <Badge variant="outline" className="text-xs shrink-0 border-purple-200 text-purple-700 bg-purple-50 flex items-center gap-1">
                            <Stethoscope className="w-3 h-3" /> GP
                          </Badge>
                        )}
                        {s.scenario?.mode === "pharmacist" && (
                          <Badge variant="outline" className="text-xs shrink-0 border-emerald-200 text-emerald-700 bg-emerald-50 flex items-center gap-1">
                            <Pill className="w-3 h-3" /> Pharm
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                        <span>{(s as any).user?.name ?? "Unknown staff"}</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(s.startedAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDuration(s.durationSeconds)}
                        </span>
                      </div>
                    </div>
                    {s.score && (
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex gap-0.5">
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
                        <span className={cn(
                          "w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold",
                          gradeColour[s.score.overallGrade] ?? "bg-muted text-foreground"
                        )}>
                          {s.score.overallGrade}
                        </span>
                        <Button asChild size="sm" variant="outline" className="gap-1 h-8 text-xs">
                          <Link href={`/scorecard/${s.id}`}>
                            View <ChevronRight className="w-3 h-3" />
                          </Link>
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
