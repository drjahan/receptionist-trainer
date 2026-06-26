import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Clock, ChevronRight, Lock, AlertCircle, Zap, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const difficultyConfig = {
  beginner: { label: "Beginner", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  intermediate: { label: "Intermediate", className: "bg-amber-50 text-amber-700 border-amber-200" },
  advanced: { label: "Advanced", className: "bg-rose-50 text-rose-700 border-rose-200" },
};

const categoryIcons: Record<string, React.ReactNode> = {
  "Appointment Management": <BookOpen className="w-4 h-4" />,
  "Conflict & De-escalation": <AlertCircle className="w-4 h-4" />,
  "Signposting & Self-Care": <Zap className="w-4 h-4" />,
  "Information & Confidentiality": <Lock className="w-4 h-4" />,
  "Prescriptions & Medication": <BookOpen className="w-4 h-4" />,
  "Safeguarding & Mental Health": <AlertCircle className="w-4 h-4" />,
  "Third Party & Consent": <Lock className="w-4 h-4" />,
};

export default function Scenarios() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
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

  // Group by category
  const grouped = scenarios?.reduce((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {} as Record<string, typeof scenarios>) ?? {};

  return (
    <AppLayout>
      <div className="container py-10">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-foreground mb-2">Scenario Library</h1>
          <p className="text-muted-foreground max-w-xl">
            Choose a patient scenario to begin your training session. Each scenario is designed to develop specific communication competencies.
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
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
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
                        className="group bg-card rounded-xl border border-border card-shadow hover:border-primary/30 hover:card-shadow-lg transition-all duration-200 flex flex-col"
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
                            </div>
                          )}
                        </div>
                        <div className="px-6 pb-5">
                          <Button
                            className="w-full group-hover:bg-primary transition-colors"
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
