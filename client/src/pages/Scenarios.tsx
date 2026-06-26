import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Clock, ChevronRight, Lock, AlertCircle, Zap, BookOpen, Stethoscope, Phone, Heart, Brain, Wind, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const difficultyConfig = {
  beginner: { label: "Beginner", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  intermediate: { label: "Intermediate", className: "bg-amber-50 text-amber-700 border-amber-200" },
  advanced: { label: "Advanced", className: "bg-rose-50 text-rose-700 border-rose-200" },
};

const receptionistCategoryIcons: Record<string, React.ReactNode> = {
  "Appointment Management": <BookOpen className="w-4 h-4" />,
  "Conflict & De-escalation": <AlertCircle className="w-4 h-4" />,
  "Signposting & Self-Care": <Zap className="w-4 h-4" />,
  "Information & Confidentiality": <Lock className="w-4 h-4" />,
  "Prescriptions & Medication": <BookOpen className="w-4 h-4" />,
  "Safeguarding & Mental Health": <AlertCircle className="w-4 h-4" />,
  "Third Party & Consent": <Lock className="w-4 h-4" />,
};

const clinicianCategoryIcons: Record<string, React.ReactNode> = {
  "Cardiovascular": <Heart className="w-4 h-4" />,
  "Endocrinology": <Activity className="w-4 h-4" />,
  "Mental Health": <Brain className="w-4 h-4" />,
  "Respiratory": <Wind className="w-4 h-4" />,
};

type Mode = "receptionist" | "clinician";

export default function Scenarios() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const [activeMode, setActiveMode] = useState<Mode>("receptionist");
  const { data: scenarios, isLoading } = trpc.scenarios.list.useQuery();
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

  // Filter by active mode
  const filtered = scenarios?.filter((s) => ((s as any).mode ?? "receptionist") === activeMode) ?? [];

  // Group by category
  const grouped = filtered.reduce((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {} as Record<string, typeof filtered>);

  const categoryIcons = activeMode === "clinician" ? clinicianCategoryIcons : receptionistCategoryIcons;

  return (
    <AppLayout>
      <div className="container py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Training Scenarios</h1>
          <p className="text-muted-foreground max-w-xl">
            {activeMode === "receptionist"
              ? "Practise handling real-world patient calls. Each scenario develops specific communication competencies for GP surgery receptionists."
              : "Practise evidence-based clinical consultations grounded in NICE guidelines. Each scenario tests clinical reasoning, communication, and safety-netting."}
          </p>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-2 mb-8 p-1 bg-secondary rounded-xl w-fit">
          <button
            onClick={() => setActiveMode("receptionist")}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
              activeMode === "receptionist"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Phone className="w-4 h-4" />
            Receptionist Training
          </button>
          <button
            onClick={() => setActiveMode("clinician")}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
              activeMode === "clinician"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Stethoscope className="w-4 h-4" />
            Clinician Mode
            <span className="text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5 font-semibold">NICE</span>
          </button>
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

        {activeMode === "clinician" && (
          <div className="mb-8 bg-blue-50 border border-blue-200 rounded-xl p-5 flex items-start gap-4">
            <Stethoscope className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-800 mb-1">NICE-Grounded Clinical Simulations</p>
              <p className="text-sm text-blue-700">
                These consultations are evaluated against 122 chunks of NICE clinical guidelines embedded in our knowledge base.
                Your scoring reflects NICE NG136, NG28, NG222, NG115, CG113, and NG196 — covering hypertension, diabetes, depression, COPD, anxiety, and atrial fibrillation.
              </p>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-card rounded-xl p-6 border border-border animate-pulse">
                <div className="h-4 bg-muted rounded w-1/3 mb-3" />
                <div className="h-6 bg-muted rounded w-3/4 mb-2" />
                <div className="h-4 bg-muted rounded w-full mb-1" />
                <div className="h-4 bg-muted rounded w-5/6" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-10">
            {Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <div className="flex items-center gap-2 mb-5">
                  <div className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center",
                    activeMode === "clinician"
                      ? "bg-blue-100 text-blue-600"
                      : "bg-primary/10 text-primary"
                  )}>
                    {categoryIcons[category] ?? <BookOpen className="w-4 h-4" />}
                  </div>
                  <h2 className="text-lg font-semibold text-foreground">{category}</h2>
                  <span className="text-sm text-muted-foreground">({items.length})</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {items.map((scenario) => {
                    const diff = difficultyConfig[scenario.difficulty];
                    return (
                      <div
                        key={scenario.id}
                        className={cn(
                          "group bg-card rounded-xl border card-shadow hover:card-shadow-lg transition-all duration-200 flex flex-col",
                          activeMode === "clinician"
                            ? "border-blue-100 hover:border-blue-300"
                            : "border-border hover:border-primary/30"
                        )}
                      >
                        <div className="p-6 flex-1">
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <Badge variant="outline" className={cn("text-xs font-medium border", diff.className)}>
                              {diff.label}
                            </Badge>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                              <Clock className="w-3.5 h-3.5" />
                              {scenario.estimatedMinutes} min
                            </div>
                          </div>
                          <h3 className={cn(
                            "font-semibold text-foreground mb-2 transition-colors",
                            activeMode === "clinician"
                              ? "group-hover:text-blue-600"
                              : "group-hover:text-primary"
                          )}>
                            {scenario.title}
                          </h3>
                          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                            {scenario.description}
                          </p>
                          {(scenario.tags as string[]).length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-4">
                              {(scenario.tags as string[]).slice(0, 3).map((tag) => (
                                <span key={tag} className={cn(
                                  "text-xs rounded-full px-2.5 py-0.5",
                                  activeMode === "clinician"
                                    ? "bg-blue-50 text-blue-700"
                                    : "bg-secondary text-secondary-foreground"
                                )}>
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="px-6 pb-5">
                          <Button
                            className={cn(
                              "w-full transition-colors",
                              activeMode === "clinician"
                                ? "bg-blue-600 hover:bg-blue-700 text-white"
                                : "group-hover:bg-primary"
                            )}
                            onClick={() => handleStart(scenario.id)}
                            disabled={createSession.isPending}
                          >
                            {createSession.isPending && createSession.variables?.scenarioId === scenario.id
                              ? "Starting..."
                              : (
                                <>
                                  {activeMode === "clinician" ? "Begin Consultation" : "Begin Scenario"}
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
