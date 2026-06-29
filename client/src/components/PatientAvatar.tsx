import { cn } from "@/lib/utils";

// ─── Portrait photo URLs (AI-generated, hosted on Manus storage) ─────────────
// 8 portraits shared with Dental Academy + 4 new GP-context portraits
const PORTRAITS: Record<string, string> = {
  "anxious-woman":           "/manus-storage/anxious-woman_7cbbb983.png",
  "elderly-man":             "/manus-storage/elderly-man_08477041.png",
  "frustrated-man":          "/manus-storage/frustrated-man_13263915.png",
  "young-woman":             "/manus-storage/young-woman_a9fcd408.png",
  "elderly-woman":           "/manus-storage/elderly-woman_3012951b.png",
  "concerned-woman":         "/manus-storage/concerned-woman_afcf243d.png",
  "middle-aged-man":         "/manus-storage/middle-aged-man_686dbf16.png",
  "young-man":               "/manus-storage/young-man_25c64cbb.png",
  // GP-context portraits (generated for Coach AI)
  "middle-aged-woman":       "/manus-storage/middle-aged-woman_2e0d7fde.png",
  "young-south-asian-man":   "/manus-storage/young-south-asian-man_ac3d82a0.png",
  "black-woman":             "/manus-storage/black-woman_ccba71fc.png",
  "south-asian-elderly-woman": "/manus-storage/south-asian-elderly-woman_218a0714.png",
};

// ─── Category → portrait key mapping (GP Pathfinder context) ─────────────────
function getPortraitKey(category: string): string {
  const cat = category.toLowerCase();

  // Receptionist scenarios
  if (cat.includes("appointment management"))          return "anxious-woman";
  if (cat.includes("signposting") || cat.includes("self-care") || cat.includes("pharmacy first")) return "young-woman";
  if (cat.includes("conflict") || cat.includes("de-escalation"))                                  return "frustrated-man";
  if (cat.includes("information") || cat.includes("confidentiality"))                             return "concerned-woman";
  if (cat.includes("prescriptions") || cat.includes("medication"))                                return "young-south-asian-man";
  if (cat.includes("safeguarding") || cat.includes("mental health"))                              return "black-woman";
  if (cat.includes("third party") || cat.includes("consent"))                                     return "elderly-woman";
  if (cat.includes("digital") || cat.includes("technology"))                                      return "young-man";
  if (cat.includes("patient rights") || cat.includes("dignity"))                                  return "middle-aged-woman";
  if (cat.includes("communication") || cat.includes("accessibility") || cat.includes("inclusion")) return "elderly-man";
  if (cat.includes("home visit") || cat.includes("urgent care"))                                  return "elderly-man";
  if (cat.includes("complaints") || cat.includes("feedback"))                                     return "middle-aged-man";
  if (cat.includes("fit note") || cat.includes("documentation"))                                  return "middle-aged-man";
  if (cat.includes("registration") || cat.includes("eligibility"))                                return "young-south-asian-man";
  if (cat.includes("preventive") || cat.includes("immunis"))                                      return "young-woman";
  if (cat.includes("administration"))                                                              return "concerned-woman";
  if (cat.includes("acute") || cat.includes("emergency"))                                         return "anxious-woman";

  // GP clinician scenarios
  if (cat.includes("cardiovascular") || cat.includes("cardiology"))                               return "middle-aged-man";
  if (cat.includes("respiratory"))                                                                 return "elderly-man";
  if (cat.includes("neurology"))                                                                   return "middle-aged-woman";
  if (cat.includes("gynaecology") || cat.includes("women's health"))                              return "young-woman";
  if (cat.includes("infectious") || cat.includes("antibiotic"))                                   return "young-south-asian-man";
  if (cat.includes("haematology"))                                                                 return "middle-aged-woman";
  if (cat.includes("geriatrics") || cat.includes("frailty"))                                      return "south-asian-elderly-woman";
  if (cat.includes("allergy"))                                                                     return "young-woman";
  if (cat.includes("musculoskeletal"))                                                             return "middle-aged-man";
  if (cat.includes("endocrinology") || cat.includes("diabetes"))                                  return "south-asian-elderly-woman";
  if (cat.includes("nephrology") || cat.includes("renal") || cat.includes("urology"))             return "elderly-man";
  if (cat.includes("mental health") || cat.includes("psychiatry"))                                return "black-woman";
  if (cat.includes("paediatric"))                                                                  return "young-woman";
  if (cat.includes("men's health"))                                                                return "young-man";
  if (cat.includes("dermatology"))                                                                 return "middle-aged-woman";
  if (cat.includes("gastroenterology"))                                                            return "middle-aged-man";
  if (cat.includes("pain"))                                                                        return "elderly-woman";

  // Pharmacist scenarios
  if (cat.includes("drug interaction") || cat.includes("mhra") || cat.includes("safety alert"))  return "young-south-asian-man";
  if (cat.includes("inhaler") || cat.includes("adherence"))                                       return "elderly-man";
  if (cat.includes("anticoagulation") || cat.includes("dmard") || cat.includes("controlled drug")) return "elderly-woman";
  if (cat.includes("deprescribing") || cat.includes("medication reconciliation"))                 return "south-asian-elderly-woman";
  if (cat.includes("structured medication") || cat.includes("smr"))                               return "middle-aged-woman";
  if (cat.includes("new medicines") || cat.includes("nms"))                                       return "young-man";

  // MRCGP / CSA scenarios
  if (cat.includes("mrcgp") || cat.includes("csa"))                                               return "concerned-woman";
  if (cat.includes("ethics"))                                                                      return "elderly-woman";
  if (cat.includes("shared decision"))                                                             return "middle-aged-man";
  if (cat.includes("telephone triage"))                                                            return "anxious-woman";
  if (cat.includes("referral"))                                                                    return "middle-aged-man";

  // Default fallback
  return "anxious-woman";
}

// ─── Component ───────────────────────────────────────────────────────────────
interface PatientAvatarProps {
  category: string;
  isSpeaking: boolean;
  mouthOpenRatio: number; // 0–1
  className?: string;
}

export default function PatientAvatar({
  category,
  isSpeaking,
  mouthOpenRatio,
  className,
}: PatientAvatarProps) {
  const portraitKey = getPortraitKey(category);
  const portraitUrl = PORTRAITS[portraitKey] ?? PORTRAITS["anxious-woman"];

  return (
    <div className={cn("flex flex-col items-center gap-2 shrink-0", className)}>
      {/* Portrait with speaking ring */}
      <div className="relative">
        {/* Animated speaking ring */}
        <div
          className={cn(
            "absolute -inset-1 rounded-full transition-all duration-150",
            isSpeaking
              ? "ring-4 ring-primary/60 ring-offset-2 ring-offset-background animate-pulse"
              : "ring-2 ring-border/40 ring-offset-1 ring-offset-background"
          )}
          style={{
            transform: isSpeaking ? `scale(${1 + mouthOpenRatio * 0.04})` : "scale(1)",
          }}
        />

        {/* Portrait photo */}
        <img
          src={portraitUrl}
          alt="Patient"
          className="w-20 h-20 rounded-full object-cover object-top shadow-md border-2 border-background"
          style={{
            filter: isSpeaking ? "brightness(1.05)" : "brightness(1)",
            transition: "filter 0.15s ease",
          }}
        />

        {/* Speaking status dot */}
        <span
          className={cn(
            "absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full border-2 border-background shadow transition-colors duration-300",
            isSpeaking ? "bg-emerald-500 animate-pulse" : "bg-slate-300"
          )}
        />
      </div>

      {/* Speaking waveform */}
      <div className="flex items-end gap-0.5 h-4">
        {isSpeaking ? (
          [0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="w-1 rounded-full bg-primary"
              style={{
                height: `${Math.max(3, Math.round(mouthOpenRatio * 14 * (0.4 + Math.abs(Math.sin(i * 1.3)) * 0.6)))}px`,
                transition: "height 0.08s ease",
              }}
            />
          ))
        ) : (
          [0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="w-1 h-1 rounded-full bg-border" />
          ))
        )}
      </div>
    </div>
  );
}
