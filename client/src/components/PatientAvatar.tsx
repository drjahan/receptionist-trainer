import { cn } from "@/lib/utils";

// ─── Portrait photo URLs (AI-generated, hosted on Manus CDN) ────────────────
// All URLs use the d2xsxph8kpxj0f.cloudfront.net CDN which is publicly accessible
// without auth — works on Railway and any deployment target.
const PORTRAITS: Record<string, string> = {
  // Batch 1 — freshly generated photorealistic portraits (Jun 2026)
  "anxious-woman":              "https://d2xsxph8kpxj0f.cloudfront.net/310519663716052239/js3eMMpFhsGdJ5siAQTARE/portrait-anxious-woman-Zq3HdwHNVa4qPUfvZwqjf4.webp",
  "elderly-man":                "https://d2xsxph8kpxj0f.cloudfront.net/310519663716052239/js3eMMpFhsGdJ5siAQTARE/portrait-elderly-man-Mtgmk3YPNeLwbGcVrpwTwW.webp",
  "frustrated-man":             "https://d2xsxph8kpxj0f.cloudfront.net/310519663716052239/js3eMMpFhsGdJ5siAQTARE/portrait-frustrated-man-NBZkje5mrefQ7PhbTpsjWd.webp",
  "young-woman":                "https://d2xsxph8kpxj0f.cloudfront.net/310519663716052239/js3eMMpFhsGdJ5siAQTARE/portrait-young-woman-NVVLwn8wUzBADz4GT6wzuf.webp",
  "elderly-woman":              "https://d2xsxph8kpxj0f.cloudfront.net/310519663716052239/js3eMMpFhsGdJ5siAQTARE/portrait-elderly-woman-3tDvz4zPFD4NhkDzDudUr2.webp",
  // Batch 2 — diverse UK patient portraits (Jun 2026)
  "concerned-woman":            "https://d2xsxph8kpxj0f.cloudfront.net/310519663716052239/js3eMMpFhsGdJ5siAQTARE/portrait-concerned-woman-KyugvQ7yKmY9tWdraGV3iJ.webp",
  "middle-aged-man":            "https://d2xsxph8kpxj0f.cloudfront.net/310519663716052239/js3eMMpFhsGdJ5siAQTARE/portrait-middle-aged-man-Bvmuqkuttv7YVbfPA9QKzx.webp",
  "young-man":                  "https://d2xsxph8kpxj0f.cloudfront.net/310519663716052239/js3eMMpFhsGdJ5siAQTARE/portrait-young-man-C8vM7tJEj4WXVxdG258SFF.webp",
  "middle-aged-woman":          "https://d2xsxph8kpxj0f.cloudfront.net/310519663716052239/js3eMMpFhsGdJ5siAQTARE/portrait-middle-aged-woman-Um5AL5dc9xs6cGhN5fS2du.webp",
  "young-south-asian-man":      "https://d2xsxph8kpxj0f.cloudfront.net/310519663716052239/js3eMMpFhsGdJ5siAQTARE/portrait-young-south-asian-man-T6Ypgbsxc9kGLLGHVJSXTz.webp",
  // Batch 3 — South Asian elderly woman and Black British woman (Jun 2026)
  "south-asian-elderly-woman":  "https://d2xsxph8kpxj0f.cloudfront.net/310519663716052239/js3eMMpFhsGdJ5siAQTARE/portrait-south-asian-elderly-woman-c2AiyWCmZkQVgTw4Ghbtp2.webp",
  "black-woman":                "https://d2xsxph8kpxj0f.cloudfront.net/310519663716052239/js3eMMpFhsGdJ5siAQTARE/portrait-black-woman-idRaFdiWzFmQ9uDBgdzXig.webp",
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
