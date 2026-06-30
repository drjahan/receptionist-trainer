import { cn } from "@/lib/utils";

// ─── Portrait photo URLs (AI-generated, hosted on Manus CDN) ────────────────
// All URLs use the d2xsxph8kpxj0f.cloudfront.net CDN which is publicly accessible
// without auth — works on Railway and any deployment target.
const PORTRAITS: Record<string, string> = {
  // 8 freshly generated portraits (v2, Jun 2026)
  "anxious-woman":           "https://d2xsxph8kpxj0f.cloudfront.net/310519663716052239/js3eMMpFhsGdJ5siAQTARE/anxious-woman-v2-mQLhZgbDpzJSYLfH7WVX7Z.webp",
  "elderly-man":             "https://d2xsxph8kpxj0f.cloudfront.net/310519663716052239/js3eMMpFhsGdJ5siAQTARE/elderly-man-v2-LYxT5B4vjL93EenpHhW6Jm.webp",
  "frustrated-man":          "https://d2xsxph8kpxj0f.cloudfront.net/310519663716052239/js3eMMpFhsGdJ5siAQTARE/frustrated-man-v2-ZBaU8GhBbMep92UysM3Wqg.webp",
  "young-woman":             "https://d2xsxph8kpxj0f.cloudfront.net/310519663716052239/js3eMMpFhsGdJ5siAQTARE/young-woman-v2-5hwGPUcWjhxQ4Tei7DVK4b.webp",
  "elderly-woman":           "https://d2xsxph8kpxj0f.cloudfront.net/310519663716052239/js3eMMpFhsGdJ5siAQTARE/elderly-woman-v2-SHHzfmPwB57YjU2ZrBf447.webp",
  "concerned-woman":         "https://d2xsxph8kpxj0f.cloudfront.net/310519663716052239/js3eMMpFhsGdJ5siAQTARE/concerned-woman-v2-kVZZvenfNmCQrBLm9hViMD.webp",
  "middle-aged-man":         "https://d2xsxph8kpxj0f.cloudfront.net/310519663716052239/js3eMMpFhsGdJ5siAQTARE/middle-aged-man-v2-A3QGsy4wy3ekVUJDjAKQRP.webp",
  "young-man":               "https://d2xsxph8kpxj0f.cloudfront.net/310519663716052239/js3eMMpFhsGdJ5siAQTARE/young-man-v2-c6YCrpiCru3oRZma4ZqMqk.webp",
  // GP-context portraits (uploaded Jun 2026)
  "middle-aged-woman":       "/manus-storage/middle-aged-woman_afd83698.png",
  "young-south-asian-man":   "/manus-storage/young-south-asian-man_c1d798f4.png",
  "black-woman":             "/manus-storage/black-woman_9ad94444.png",
  "south-asian-elderly-woman": "/manus-storage/south-asian-elderly-woman_28a00403.png",
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
