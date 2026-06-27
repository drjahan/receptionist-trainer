import { useState } from "react";
import { useParams, useLocation } from "wouter";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  FileText,
  AlertTriangle,
  CheckSquare,
  MessageSquare,
  BookOpen,
  Pill,
  Stethoscope,
  Star,
  ChevronRight,
  Loader2,
  ArrowLeft,
  Play,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────────

interface KeyMedication {
  name: string;
  indication: string;
  keyPoints: string[];
}

interface Guideline {
  name: string;
  keyPoints: string[];
}

interface IceFramework {
  ideas: string;
  concerns: string;
  expectations: string;
}

interface PharmacistCribSheet {
  scenarioSummary: string;
  keyMedications: KeyMedication[];
  relevantGuidelines: Guideline[];
  redFlags: string[];
  communicationTips: string[];
  checklistItems: string[];
  googleReviewReminder: string;
}

interface GPCribSheet {
  scenarioSummary: string;
  differentialDiagnosis: string[];
  relevantGuidelines: Guideline[];
  redFlags: string[];
  iceFramework: IceFramework;
  communicationTips: string[];
  checklistItems: string[];
  googleReviewReminder: string;
}

interface ReceptionistCribSheet {
  scenarioSummary: string;
  relevantPolicies: Guideline[];
  redFlags: string[];
  communicationTips: string[];
  checklistItems: string[];
  googleReviewReminder: string;
}

type CribSheetData = PharmacistCribSheet | GPCribSheet | ReceptionistCribSheet;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isPharmacistSheet(data: CribSheetData): data is PharmacistCribSheet {
  return "keyMedications" in data;
}

function isGPSheet(data: CribSheetData): data is GPCribSheet {
  return "differentialDiagnosis" in data;
}

function modeLabel(mode: string) {
  if (mode === "pharmacist") return "Pharmacist";
  if (mode === "gp") return "GP";
  return "Receptionist";
}

function modeBadgeVariant(mode: string): "default" | "secondary" | "outline" {
  if (mode === "pharmacist") return "default";
  if (mode === "gp") return "secondary";
  return "outline";
}

// ─── Section components ───────────────────────────────────────────────────────

function SectionCard({
  icon,
  title,
  children,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  accent?: string;
}) {
  return (
    <Card className={`border-l-4 ${accent ?? "border-l-blue-500"}`}>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">{children}</CardContent>
    </Card>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
          <ChevronRight className="h-3.5 w-3.5 mt-0.5 text-slate-400 flex-shrink-0" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function GuidelineList({ items }: { items: Guideline[] }) {
  return (
    <div className="space-y-3">
      {items.map((g, i) => (
        <div key={i}>
          <p className="text-sm font-medium text-slate-800 mb-1">{g.name}</p>
          <BulletList items={g.keyPoints} />
        </div>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CribSheet() {
  const { scenarioId } = useParams<{ scenarioId: string }>();
  const [, navigate] = useLocation();
  const id = parseInt(scenarioId ?? "0", 10);

  const scenarioQuery = trpc.scenarios.get.useQuery({ id }, { enabled: !!id });
  const createSession = trpc.sessions.create.useMutation();
  const generateCrib = trpc.cribSheet.generate.useMutation();

  const [cribResult, setCribResult] = useState<{
    scenarioTitle: string;
    mode: string;
    cribSheet: CribSheetData;
  } | null>(null);

  const scenario = scenarioQuery.data;

  async function handleGenerate() {
    if (!id) return;
    try {
      const result = await generateCrib.mutateAsync({ scenarioId: id });
      setCribResult({
        scenarioTitle: result.scenarioTitle,
        mode: result.mode as string,
        cribSheet: result.cribSheet as CribSheetData,
      });
    } catch {
      toast.error("Failed to generate crib sheet. Please try again.");
    }
  }

  async function handleStartRoleplay() {
    if (!id) return;
    try {
      const { sessionId } = await createSession.mutateAsync({ scenarioId: id });
      navigate(`/roleplay/${sessionId}`);
    } catch {
      toast.error("Failed to start session. Please try again.");
    }
  }

  if (scenarioQuery.isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </AppLayout>
    );
  }

  if (!scenario) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto px-4 py-12 text-center">
          <p className="text-slate-500">Scenario not found.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/scenarios")}>
            Back to Scenarios
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            className="mb-4 -ml-2 text-slate-500 hover:text-slate-700"
            onClick={() => navigate("/scenarios")}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Scenarios
          </Button>

          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant={modeBadgeVariant(scenario.mode as string)}>
                  {modeLabel(scenario.mode as string)}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {scenario.category}
                </Badge>
                <Badge variant="outline" className="text-xs capitalize">
                  {scenario.difficulty}
                </Badge>
              </div>
              <h1 className="text-2xl font-bold text-slate-900">{scenario.title}</h1>
              <p className="text-slate-500 text-sm mt-1">{scenario.description}</p>
            </div>
          </div>
        </div>

        <Separator className="mb-6" />

        {/* Generate / Start buttons */}
        {!cribResult ? (
          <div className="flex flex-col sm:flex-row gap-3 mb-8">
            <Button
              onClick={handleGenerate}
              disabled={generateCrib.isPending}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              {generateCrib.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating crib sheet…
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Generate Pre-Consultation Crib Sheet
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleStartRoleplay}
              disabled={createSession.isPending}
              className="flex-1"
            >
              {createSession.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Skip to Role-play
            </Button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-3 mb-8">
            <Button
              onClick={handleStartRoleplay}
              disabled={createSession.isPending}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              {createSession.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Start Role-play Now
            </Button>
            <Button
              variant="outline"
              onClick={handleGenerate}
              disabled={generateCrib.isPending}
              className="flex-1"
            >
              {generateCrib.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              Regenerate
            </Button>
          </div>
        )}

        {/* Crib sheet content */}
        {cribResult && (
          <div className="space-y-4">
            {/* Scenario summary */}
            <SectionCard
              icon={<BookOpen className="h-4 w-4 text-blue-600" />}
              title="Scenario Summary"
              accent="border-l-blue-500"
            >
              <p className="text-sm text-slate-700 leading-relaxed">
                {cribResult.cribSheet.scenarioSummary}
              </p>
            </SectionCard>

            {/* Pharmacist: key medications */}
            {isPharmacistSheet(cribResult.cribSheet) && cribResult.cribSheet.keyMedications?.length > 0 && (
              <SectionCard
                icon={<Pill className="h-4 w-4 text-purple-600" />}
                title="Key Medications"
                accent="border-l-purple-500"
              >
                <div className="space-y-4">
                  {cribResult.cribSheet.keyMedications.map((med, i) => (
                    <div key={i}>
                      <p className="text-sm font-semibold text-slate-800">
                        {med.name}
                        <span className="font-normal text-slate-500 ml-2">— {med.indication}</span>
                      </p>
                      <BulletList items={med.keyPoints} />
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* GP: differential diagnosis */}
            {isGPSheet(cribResult.cribSheet) && cribResult.cribSheet.differentialDiagnosis?.length > 0 && (
              <SectionCard
                icon={<Stethoscope className="h-4 w-4 text-indigo-600" />}
                title="Differential Diagnosis"
                accent="border-l-indigo-500"
              >
                <BulletList items={cribResult.cribSheet.differentialDiagnosis} />
              </SectionCard>
            )}

            {/* GP: ICE framework */}
            {isGPSheet(cribResult.cribSheet) && cribResult.cribSheet.iceFramework && (
              <SectionCard
                icon={<MessageSquare className="h-4 w-4 text-teal-600" />}
                title="Likely Patient ICE"
                accent="border-l-teal-500"
              >
                <div className="space-y-2">
                  <div>
                    <span className="text-xs font-semibold text-teal-700 uppercase tracking-wide">Ideas</span>
                    <p className="text-sm text-slate-700 mt-0.5">{cribResult.cribSheet.iceFramework.ideas}</p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-teal-700 uppercase tracking-wide">Concerns</span>
                    <p className="text-sm text-slate-700 mt-0.5">{cribResult.cribSheet.iceFramework.concerns}</p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-teal-700 uppercase tracking-wide">Expectations</span>
                    <p className="text-sm text-slate-700 mt-0.5">{cribResult.cribSheet.iceFramework.expectations}</p>
                  </div>
                </div>
              </SectionCard>
            )}

            {/* Guidelines / Policies */}
            {isPharmacistSheet(cribResult.cribSheet) && cribResult.cribSheet.relevantGuidelines?.length > 0 && (
              <SectionCard
                icon={<BookOpen className="h-4 w-4 text-blue-600" />}
                title="Relevant Guidelines"
                accent="border-l-blue-500"
              >
                <GuidelineList items={cribResult.cribSheet.relevantGuidelines} />
              </SectionCard>
            )}
            {isGPSheet(cribResult.cribSheet) && cribResult.cribSheet.relevantGuidelines?.length > 0 && (
              <SectionCard
                icon={<BookOpen className="h-4 w-4 text-blue-600" />}
                title="Relevant Guidelines"
                accent="border-l-blue-500"
              >
                <GuidelineList items={cribResult.cribSheet.relevantGuidelines} />
              </SectionCard>
            )}
            {!isPharmacistSheet(cribResult.cribSheet) && !isGPSheet(cribResult.cribSheet) &&
              (cribResult.cribSheet as ReceptionistCribSheet).relevantPolicies?.length > 0 && (
              <SectionCard
                icon={<BookOpen className="h-4 w-4 text-blue-600" />}
                title="Relevant Policies"
                accent="border-l-blue-500"
              >
                <GuidelineList items={(cribResult.cribSheet as ReceptionistCribSheet).relevantPolicies} />
              </SectionCard>
            )}

            {/* Red flags */}
            {cribResult.cribSheet.redFlags?.length > 0 && (
              <SectionCard
                icon={<AlertTriangle className="h-4 w-4 text-red-600" />}
                title="Red Flags"
                accent="border-l-red-500"
              >
                <ul className="space-y-1.5">
                  {cribResult.cribSheet.redFlags.map((flag, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-red-700">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                      <span>{flag}</span>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            )}

            {/* Communication tips */}
            {cribResult.cribSheet.communicationTips?.length > 0 && (
              <SectionCard
                icon={<MessageSquare className="h-4 w-4 text-amber-600" />}
                title="Communication Tips"
                accent="border-l-amber-500"
              >
                <BulletList items={cribResult.cribSheet.communicationTips} />
              </SectionCard>
            )}

            {/* Checklist */}
            {cribResult.cribSheet.checklistItems?.length > 0 && (
              <SectionCard
                icon={<CheckSquare className="h-4 w-4 text-green-600" />}
                title="Before You Finish — Checklist"
                accent="border-l-green-500"
              >
                <ul className="space-y-1.5">
                  {cribResult.cribSheet.checklistItems.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                      <CheckSquare className="h-3.5 w-3.5 mt-0.5 text-green-500 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            )}

            {/* Google Review reminder */}
            {cribResult.cribSheet.googleReviewReminder && (
              <SectionCard
                icon={<Star className="h-4 w-4 text-yellow-500" />}
                title="Google Review Reminder"
                accent="border-l-yellow-400"
              >
                <p className="text-sm text-slate-700">{cribResult.cribSheet.googleReviewReminder}</p>
                <p className="text-xs text-slate-500 mt-2">
                  Link:{" "}
                  <a
                    href="https://g.page/r/CemedDs5bp4FEBM/review"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline"
                  >
                    https://g.page/r/CemedDs5bp4FEBM/review
                  </a>
                </p>
              </SectionCard>
            )}

            {/* Start button at bottom */}
            <div className="pt-2">
              <Button
                onClick={handleStartRoleplay}
                disabled={createSession.isPending}
                className="w-full bg-green-600 hover:bg-green-700 py-6 text-base"
              >
                {createSession.isPending ? (
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                ) : (
                  <Play className="h-5 w-5 mr-2" />
                )}
                I'm Ready — Start Role-play
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
