import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import AppLayout from "@/components/AppLayout";
import { BookOpen, TrendingUp, Award, Users, ChevronRight, MessageSquare, BarChart3, Mic, Brain, Stethoscope, Sparkles } from "lucide-react";

const AVATAR_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663716052239/js3eMMpFhsGdJ5siAQTARE/avatar-placeholder-nSr6tiGEAQuHgXHvciQfbi.webp";

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

const roadmapItems = [
  {
    icon: Mic,
    title: "Voice Interaction",
    description: "Speak directly to the AI patient and hear their response — just like a real phone call.",
    status: "coming-soon",
  },
  {
    icon: Sparkles,
    title: "Talking Avatar",
    description: "A photorealistic AI avatar that lip-syncs responses in real time, powered by our DGX GPU engine.",
    status: "coming-soon",
  },
  {
    icon: Stethoscope,
    title: "Clinician Mode",
    description: "Role-play patient consultations grounded in NICE guidelines and RCGP frameworks for clinical staff.",
    status: "coming-soon",
  },
  {
    icon: Brain,
    title: "Policy-Grounded Scoring",
    description: "Every assessment cross-referenced against GP Pathfinder policies via our AI knowledge base.",
    status: "in-progress",
  },
];

export default function Home() {
  const { isAuthenticated, loading } = useAuth();

  return (
    <AppLayout>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[oklch(0.20_0.08_260)] via-[oklch(0.22_0.07_255)] to-[oklch(0.18_0.05_280)] text-primary-foreground">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_oklch(0.55_0.12_195_/_0.15),_transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_oklch(0.45_0.15_290_/_0.10),_transparent_60%)]" />
        <div className="container relative py-16 md:py-24">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            {/* Left: Text */}
            <div>
              <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-3 py-1.5 text-sm font-medium mb-6 border border-white/20">
                <img
                  src="/manus-storage/gp-pathfinder-logo_dfe74db8.png"
                  alt="GP Pathfinder"
                  className="h-5 w-auto object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <span className="text-white/90">GP Pathfinder Clinics</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-5 text-white">
                Train Smarter.<br />
                <span className="text-[oklch(0.78_0.14_195)]">Serve Patients Better.</span>
              </h1>
              <p className="text-lg text-white/75 leading-relaxed mb-8 max-w-lg">
                An AI-powered coaching platform that prepares your receptionists and clinicians for every patient interaction — from urgent calls to complex consultations.
              </p>
              {!loading && (
                <div className="flex flex-wrap gap-3">
                  {isAuthenticated ? (
                    <Button asChild size="lg" className="bg-white text-[oklch(0.22_0.08_260)] hover:bg-white/90 font-semibold shadow-lg">
                      <Link href="/scenarios">
                        Start Training <ChevronRight className="w-4 h-4 ml-1" />
                      </Link>
                    </Button>
                  ) : (
                    <Button asChild size="lg" className="bg-white text-[oklch(0.22_0.08_260)] hover:bg-white/90 font-semibold shadow-lg">
                      <a href={getLoginUrl()}>
                        Sign In to Start Training <ChevronRight className="w-4 h-4 ml-1" />
                      </a>
                    </Button>
                  )}
                  <Button asChild variant="outline" size="lg" className="border-white/30 text-white hover:bg-white/10 bg-transparent">
                    <Link href="/scenarios">
                      View Scenarios
                    </Link>
                  </Button>
                </div>
              )}
            </div>

            {/* Right: Avatar Preview */}
            <div className="flex justify-center md:justify-end">
              <div className="relative">
                {/* Glow ring */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[oklch(0.65_0.18_195_/_0.4)] to-[oklch(0.55_0.20_290_/_0.4)] blur-2xl scale-110" />
                <div className="relative rounded-2xl overflow-hidden border border-white/20 shadow-2xl w-64 md:w-80">
                  <img
                    src={AVATAR_URL}
                    alt="GP Pathfinder AI Coach Avatar"
                    className="w-full h-auto object-cover"
                  />
                  {/* Coming soon overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[oklch(0.78_0.18_195)] animate-pulse" />
                      <span className="text-white text-sm font-medium">Talking Avatar — Coming Soon</span>
                    </div>
                    <p className="text-white/60 text-xs mt-1">Voice-enabled AI patient roleplay</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 md:py-20">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">Everything you need to excel</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              A complete training environment built specifically for NHS GP surgery staff.
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

      {/* Roadmap / Coming Soon */}
      <section className="py-16 md:py-20">
        <div className="container">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-primary/10 rounded-full px-4 py-1.5 text-sm font-medium text-primary mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              Platform Roadmap
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">What's coming next</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              The platform is evolving rapidly. Here is what is being built right now.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {roadmapItems.map((item) => (
              <div key={item.title} className="relative bg-card rounded-xl p-6 border border-border card-shadow">
                <div className="absolute top-4 right-4">
                  {item.status === "in-progress" ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      In progress
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                      Coming soon
                    </span>
                  )}
                </div>
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <item.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2 pr-20">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      {!loading && !isAuthenticated && (
        <section className="py-16">
          <div className="container">
            <div className="bg-gradient-to-br from-[oklch(0.25_0.08_260)] to-[oklch(0.20_0.07_280)] rounded-2xl p-8 md:p-12 text-center text-white overflow-hidden relative">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_oklch(0.55_0.12_195_/_0.2),_transparent_60%)]" />
              <div className="relative">
                <Users className="w-10 h-10 mx-auto mb-4 opacity-80" />
                <h2 className="text-2xl md:text-3xl font-bold mb-3">Ready to begin?</h2>
                <p className="text-white/75 mb-8 max-w-md mx-auto">
                  Sign in with your GP Pathfinder account to access the full training library.
                </p>
                <Button asChild size="lg" className="bg-white text-[oklch(0.22_0.08_260)] hover:bg-white/90 font-semibold shadow-lg">
                  <a href={getLoginUrl()}>Sign in to get started</a>
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}
    </AppLayout>
  );
}
