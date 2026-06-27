import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import {
  Clock, ChevronRight, Lock, AlertCircle, Zap, BookOpen,
  Stethoscope, PhoneCall, Heart, Brain, Baby, Activity,
  Pill, Users, Search, Filter
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useState, useMemo } from "react";

const difficultyConfig = {
  beginner: { label: "Beginner", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  intermediate: { label: "Intermediate", className: "bg-amber-50 text-amber-700 border-amber-200" },
  advanced: { label: "Advanced", className: "bg-rose-50 text-rose-700 border-rose-200" },
};

const modeConfig = {
  receptionist: {
    label: "Receptionist",
    icon: <PhoneCall className="w-3.5 h-3.5" />,
    className: "bg-blue-50 text-blue-700 border-blue-200",
    description: "Telephone triage, appointment management, de-escalation, signposting",
  },
  clinician: {
    label: "Clinician",
    icon: <Stethoscope className="w-3.5 h-3.5" />,
    className: "bg-purple-50 text-purple-700 border-purple-200",
    description: "Clinical consultations, diagnosis, management, MRCGP/CSA-style cases",
  },
};

const clinicalSystemIcons: Record<string, React.ReactNode> = {
  "Cardiology": <Heart className="w-4 h-4" />,
  "Respiratory": <Activity className="w-4 h-4" />,
  "Mental Health": <Brain className="w-4 h-4" />,
  "Paediatrics": <Baby className="w-4 h-4" />,
  "Endocrinology": <Pill className="w-4 h-4" />,
  "Musculoskeletal": <Activity className="w-4 h-4" />,
  "Neurology": <Brain className="w-4 h-4" />,
  "Geriatrics": <Users className="w-4 h-4" />,
  "Gastroenterology": <Activity className="w-4 h-4" />,
  "Women's Health": <Users className="w-4 h-4" />,
  "Men's Health": <Users className="w-4 h-4" />,
  "Dermatology": <Activity className="w-4 h-4" />,
  "Urology": <Activity className="w-4 h-4" />,
  "Acute": <AlertCircle className="w-4 h-4" />,
  "Pain Management": <Pill className="w-4 h-4" />,
};

const categoryIcons: Record<string, React.ReactNode> = {
  "Appointment Management": <BookOpen className="w-4 h-4" />,
  "Conflict & De-escalation": <AlertCircle className="w-4 h-4" />,
  "Signposting & Self-Care": <Zap className="w-4 h-4" />,
  "Information & Confidentiality": <Lock className="w-4 h-4" />,
  "Prescriptions & Medication": <Pill className="w-4 h-4" />,
  "Safeguarding & Mental Health": <AlertCircle className="w-4 h-4" />,
  "Third Party & Consent": <Lock className="w-4 h-4" />,
  "Accessibility & Inclusion": <Users className="w-4 h-4" />,
  "Digital Access & Technology": <Activity className="w-4 h-4" />,
  "Complaints & Feedback": <AlertCircle className="w-4 h-4" />,
  "Administration & Registration": <BookOpen className="w-4 h-4" />,
  "Referrals & Secondary Care": <ChevronRight className="w-4 h-4" />,
};

type Mode = "all" | "receptionist" | "clinician";

export default function Scenarios() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const { data: scenarios, isLoading } = trpc.scenarios.list.useQuery();
  const [activeMode, setActiveMode] = useState<Mode>("all");
  const [activeSystem, setActiveSystem] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const createSession = trpc.sessions.create.useMutation({
    onSuccess: (data) => {
      navigate(`/roleplay/${data.sessionId}`);
    },
    onError: () => {
      toast.error("Failed to start session. Please try again.");
    },
  });

  const handleStart = (scenarioId: number) => {
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }
    createSession.mutate({ scenarioId });
  };

  const clinicalSystems = useMemo(() => {
    if (!scenarios) return [];
    const systems = new Set<string>();
    scenarios.forEach((s) => {
      if (s.clinicalSystem) systems.add(s.clinicalSystem as string);
    });
    return Array.from(systems).sort();
  }, [scenarios]);

  const filtered = useMemo(() => {
    if (!scenarios) return [];
    return scenarios.filter((s) => {
      const modeMatch = activeMode === "all" || s.mode === activeMode;
      const systemMatch = activeSystem === "all" || s.clinicalSystem === activeSystem;
      const searchMatch =
        !searchQuery ||
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.tags as string[]).some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
      return modeMatch && systemMatch && searchMatch;
    });
  }, [scenarios, activeMode, activeSystem, searchQuery]);

  const grouped = useMemo(() => {
    return filtered.reduce((acc, s) => {
      const key = s.category;
      if (!acc[key]) acc[key] = [];
      acc[key].push(s);
      return acc;
    }, {} as Record<string, typeof filtered>);
  }, [filtered]);

  const totalCount = scenarios?.length ?? 0;
  const receptionistCount = scenarios?.filter((s) => s.mode === "receptionist").length ?? 0;
  const clinicianCount = scenarios?.filter((s) => s.mode === "clinician").length ?? 0;

  return (
    <AppLayout>
      <div className="container py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Scenario Library</h1>
          <p className="text-muted-foreground max-w-2xl">
            {totalCount} training scenarios grounded in NICE, SIGN, BTS, and RCGP guidelines.
            Choose your role and begin a training session.
          </p>
        </div>

        {!isAuthenticated && !loading && (
          <div className="mb-8 bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-center gap-4">
            <Lock className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">Sign in to start training</p>
              <p className="text-sm text-amber-700">You need to be signed in to launch a scenario and track your progress.</p>
            </div>
            <Button asChild size="sm" className="ml-auto shrink-0 bg-amber-600 hover:bg-amber-700 text-white">
              <a href={getLoginUrl()}>Sign in</a>
            </Button>
          </div>
        )}

        {/* Mode selector */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {(["all", "receptionist", "clinician"] as Mode[]).map((mode) => {
            const isActive = activeMode === mode;
            const count = mode === "all" ? totalCount : mode === "receptionist" ? receptionistCount : clinicianCount;
            return (
              <button
                key={mode}
                onClick={() => { setActiveMode(mode); setActiveSystem("all"); }}
                className={cn(
                  "rounded-xl border p-4 text-left transition-all duration-200",
                  isActive
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border bg-card hover:border-primary/40"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  {mode === "all" ? (
                    <BookOpen className="w-4 h-4 text-primary" />
                  ) : mode === "receptionist" ? (
                    <PhoneCall className="w-4 h-4 text-blue-600" />
                  ) : (
                    <Stethoscope className="w-4 h-4 text-purple-600" />
                  )}
                  <span className={cn("font-semibold text-sm", isActive ? "text-primary" : "text-foreground")}>
                    {mode === "all" ? "All Scenarios" : modeConfig[mode].label}
                  </span>
                  <span className="ml-auto text-xs font-medium text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                    {count}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {mode === "all"
                    ? "Browse the full library across all roles and clinical systems"
                    : modeConfig[mode].description}
                </p>
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-8">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search scenarios, tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
          {(activeMode === "clinician" || activeMode === "all") && clinicalSystems.length > 0 && (
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <select
                value={activeSystem}
                onChange={(e) => setActiveSystem(e.target.value)}
                className="text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              >
                <option value="all">All Systems</option>
                {clinicalSystems.map((sys) => (
                  <option key={sys} value={sys}>{sys}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-center text-sm text-muted-foreground">
            {filtered.length} scenario{filtered.length !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Scenarios */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="bg-card rounded-xl p-6 border border-border animate-pulse">
                <div className="h-4 bg-muted rounded w-1/3 mb-3" />
                <div className="h-6 bg-muted rounded w-3/4 mb-2" />
                <div className="h-4 bg-muted rounded w-full mb-1" />
                <div className="h-4 bg-muted rounded w-5/6" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No scenarios match your filters.</p>
            <Button variant="ghost" size="sm" className="mt-3" onClick={() => { setActiveMode("all"); setActiveSystem("all"); setSearchQuery(""); }}>
              Clear filters
            </Button>
          </div>
        ) : (
          <div className="space-y-10">
            {Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    {categoryIcons[category] ?? clinicalSystemIcons[category] ?? <BookOpen className="w-4 h-4" />}
                  </div>
                  <h2 className="text-lg font-semibold text-foreground">{category}</h2>
                  <span className="text-sm text-muted-foreground">({items.length})</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {items.map((scenario) => {
                    const diff = difficultyConfig[scenario.difficulty as keyof typeof difficultyConfig];
                    const mode = modeConfig[scenario.mode as keyof typeof modeConfig];
                    return (
                      <div
                        key={scenario.id}
                        className="group bg-card rounded-xl border border-border card-shadow hover:border-primary/30 hover:card-shadow-lg transition-all duration-200 flex flex-col"
                      >
                        <div className="p-6 flex-1">
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div className="flex flex-wrap gap-1.5">
                              {diff && (
                                <Badge variant="outline" className={cn("text-xs font-medium border", diff.className)}>
                                  {diff.label}
                                </Badge>
                              )}
                              {mode && (
                                <Badge variant="outline" className={cn("text-xs font-medium border flex items-center gap-1", mode.className)}>
                                  {mode.icon}
                                  {mode.label}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                              <Clock className="w-3.5 h-3.5" />
                              {scenario.estimatedMinutes} min
                            </div>
                          </div>
                          <h3 className="font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
                            {scenario.title}
                          </h3>
                          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                            {scenario.description}
                          </p>
                          {(scenario.tags as string[]).length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-4">
                              {(scenario.tags as string[]).slice(0, 3).map((tag) => (
                                <span key={tag} className="text-xs bg-secondary text-secondary-foreground rounded-full px-2.5 py-0.5">
                                  {tag}
                                </span>
                              ))}
                              {(scenario.tags as string[]).length > 3 && (
                                <span className="text-xs text-muted-foreground px-1">
                                  +{(scenario.tags as string[]).length - 3} more
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="px-6 pb-5">
                          <Button
                            className="w-full"
                            onClick={() => handleStart(scenario.id)}
                            disabled={createSession.isPending}
                          >
                            {createSession.isPending && createSession.variables?.scenarioId === scenario.id
                              ? "Starting..."
                              : (
                                <>
                                  Begin Scenario
                                  <ChevronRight className="w-4 h-4 ml-1" />
                                </>
                              )}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
