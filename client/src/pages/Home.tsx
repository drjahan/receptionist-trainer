import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import AppLayout from "@/components/AppLayout";
import { BookOpen, TrendingUp, Award, Users, ChevronRight, MessageSquare, BarChart3 } from "lucide-react";

const features = [
  {
    icon: BookOpen,
    title: "Scenario Library",
    description: "Practice with a curated library of realistic patient scenarios — from urgent demands to sensitive mental health calls.",
  },
  {
    icon: MessageSquare,
    title: "AI Patient Roleplay",
    description: "Engage in realistic back-and-forth conversations with an AI patient that responds authentically to your approach.",
  },
  {
    icon: BarChart3,
    title: "Competency Scoring",
    description: "Receive detailed feedback across five key competencies with actionable insights after every session.",
  },
  {
    icon: TrendingUp,
    title: "Progress Tracking",
    description: "Monitor your development over time and identify areas where you are growing strongest.",
  },
];

const competencies = [
  "Active Listening and Empathy",
  "Information Gathering",
  "Policy Adherence",
  "Communication Clarity",
  "De-escalation",
];

export default function Home() {
  const { isAuthenticated, loading } = useAuth();

  return (
    <AppLayout>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary via-[oklch(0.22_0.07_255)] to-[oklch(0.18_0.05_260)] text-primary-foreground">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_oklch(0.55_0.12_195_/_0.15),_transparent_60%)]" />
        <div className="container relative py-20 md:py-28">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-2 py-1.5 text-sm font-medium mb-6 border border-white/20">
              <img src="/manus-storage/GP_Pathfinder_Ai_Final_v2_527ddc9c.png" alt="GP Pathfinder Ai" className="h-6 w-auto object-contain" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-5">
              Train Smarter.<br />
              <span className="text-[oklch(0.75_0.12_195)]">Serve Patients Better.</span>
            </h1>
            <p className="text-lg text-white/75 leading-relaxed mb-8 max-w-xl">
              An AI-powered training platform that prepares your receptionists for every patient interaction — from urgent calls to sensitive conversations.
            </p>
            {!loading && (
              <div className="flex flex-wrap gap-3">
                {isAuthenticated ? (
                  <Button asChild size="lg" className="bg-white text-primary hover:bg-white/90 font-semibold">
                    <Link href="/scenarios">
                      Start Training <ChevronRight className="w-4 h-4 ml-1" />
                    </Link>
                  </Button>
                ) : (
                  <Button asChild size="lg" className="bg-white text-primary hover:bg-white/90 font-semibold">
                    <a href={getLoginUrl()}>
                      Get Started <ChevronRight className="w-4 h-4 ml-1" />
                    </a>
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 md:py-20">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">Everything you need to excel</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              A complete training environment built specifically for NHS GP surgery receptionists.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f) => (
              <div key={f.title} className="bg-card rounded-xl p-6 card-shadow border border-border hover:border-primary/20 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Competencies */}
      <section className="py-16 bg-secondary/40">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-primary/10 rounded-full px-4 py-1.5 text-sm font-medium text-primary mb-6">
              <Award className="w-3.5 h-3.5" />
              Five Core Competencies
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
              Assessed across what matters most
            </h2>
            <p className="text-muted-foreground mb-10">
              Every session is evaluated against five evidence-based competencies aligned with NHS primary care standards.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {competencies.map((c, i) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-2 bg-white border border-border rounded-full px-4 py-2 text-sm font-medium text-foreground card-shadow"
                >
                  <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold shrink-0">
                    {i + 1}
                  </span>
                  {c}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      {!loading && !isAuthenticated && (
        <section className="py-16">
          <div className="container">
            <div className="bg-primary rounded-2xl p-8 md:p-12 text-center text-primary-foreground">
              <Users className="w-10 h-10 mx-auto mb-4 opacity-80" />
              <h2 className="text-2xl md:text-3xl font-bold mb-3">Ready to begin?</h2>
              <p className="text-white/75 mb-8 max-w-md mx-auto">
                Sign in with your GP Pathfinder account to access the full training library.
              </p>
              <Button asChild size="lg" className="bg-white text-primary hover:bg-white/90 font-semibold">
                <a href={getLoginUrl()}>Sign in to get started</a>
              </Button>
            </div>
          </div>
        </section>
      )}
    </AppLayout>
  );
}
