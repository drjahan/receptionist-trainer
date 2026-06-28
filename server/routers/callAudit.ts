/**
 * Call Audit Router
 * Handles upload, transcription, and AI evaluation of real telephone consultations
 * against the GP Pathfinder pharmacist supervision criteria.
 *
 * Audio is transcribed directly from the uploaded base64 buffer via Whisper.
 * No S3 / Manus Forge presign is required — works on Railway with OPENAI_API_KEY.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { ENV } from "../_core/env";
import {
  createCallAudit,
  getCallAuditById,
  updateCallAudit,
  getCallAuditsByUserId,
} from "../db";

// ─── Audit criteria definition ────────────────────────────────────────────────
// Derived from the GP Pathfinder Pharmacist Supervision Form (Nov 2025)

export const AUDIT_CRITERIA = [
  // Part A — Consultation suitability
  { id: "suitability_scope", section: "Consultation Suitability", label: "Consultation was within the pharmacist's scope of practice", audioAssessable: true },
  { id: "suitability_appropriate", section: "Consultation Suitability", label: "Appropriate triage / escalation to GP where needed", audioAssessable: true },

  // Part B — History taking
  { id: "history_presenting", section: "History Taking", label: "Presenting complaint clearly established", audioAssessable: true },
  { id: "history_hpc", section: "History Taking", label: "History of presenting complaint explored (onset, duration, severity, associated symptoms)", audioAssessable: true },
  { id: "history_pmh", section: "History Taking", label: "Relevant past medical history obtained", audioAssessable: true },
  { id: "history_medications", section: "History Taking", label: "Current medications (including OTC, herbal, supplements) reviewed", audioAssessable: true },
  { id: "history_allergies", section: "History Taking", label: "Allergies and adverse drug reactions checked", audioAssessable: true },
  { id: "history_social", section: "History Taking", label: "Relevant social history (smoking, alcohol, occupation) noted", audioAssessable: true },

  // Part C — Clinical assessment
  { id: "clinical_red_flags", section: "Clinical Assessment", label: "Red flag symptoms screened for and acted upon appropriately", audioAssessable: true },
  { id: "clinical_diagnosis", section: "Clinical Assessment", label: "Working diagnosis / differential clearly articulated", audioAssessable: true },
  { id: "clinical_evidence", section: "Clinical Assessment", label: "Management plan consistent with evidence-based guidelines (NICE, BNF, MHRA)", audioAssessable: true },

  // Part D — Prescribing / treatment
  { id: "prescribing_dose", section: "Prescribing & Treatment", label: "Correct drug, dose, frequency, and duration selected", audioAssessable: true },
  { id: "prescribing_interactions", section: "Prescribing & Treatment", label: "Drug interactions and contraindications checked", audioAssessable: true },
  { id: "prescribing_monitoring", section: "Prescribing & Treatment", label: "Monitoring requirements communicated to patient", audioAssessable: true },

  // Part E — Communication
  { id: "comms_explanation", section: "Communication", label: "Diagnosis and management plan explained clearly in plain language", audioAssessable: true },
  { id: "comms_safety_netting", section: "Communication", label: "Safety netting advice given (when to seek further help, red flags to watch for)", audioAssessable: true },
  { id: "comms_consent", section: "Communication", label: "Patient consent and understanding confirmed", audioAssessable: true },

  // Part F — Documentation (cannot be assessed from audio alone)
  { id: "documentation_emis", section: "Documentation", label: "EMIS record updated accurately and contemporaneously", audioAssessable: false },
  { id: "documentation_coding", section: "Documentation", label: "Correct Read/SNOMED codes applied", audioAssessable: false },
] as const;

export type CriterionId = typeof AUDIT_CRITERIA[number]["id"];

// ─── Internal: transcribe audio buffer directly via Whisper ──────────────────

async function transcribeBuffer(
  audioBuffer: Buffer,
  mimeType: string,
  filename: string,
): Promise<string> {
  const forgeUrl = ENV.forgeApiUrl?.replace(/\/+$/, "") ?? "https://api.openai.com";
  const forgeKey = ENV.forgeApiKey;

  if (!forgeKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Transcription API key not configured on this server.",
    });
  }

  const formData = new FormData();
  const blob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType });
  formData.append("file", blob, filename);
  formData.append("model", "whisper-1");
  formData.append("response_format", "text");
  formData.append(
    "prompt",
    "This is a UK NHS GP surgery telephone consultation between a clinician and a patient. Transcribe accurately including medical terminology, drug names, and dosages.",
  );

  const resp = await fetch(`${forgeUrl}/v1/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${forgeKey}` },
    body: formData,
  });

  if (!resp.ok) {
    const msg = await resp.text().catch(() => resp.statusText);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Transcription failed (${resp.status}): ${msg}`,
    });
  }

  return (await resp.text()).trim();
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const callAuditRouter = router({

  // Return the criteria list for the frontend to render
  getCriteria: protectedProcedure.query(() => {
    return AUDIT_CRITERIA.map(c => ({ ...c }));
  }),

  // List all audits for the current user
  list: protectedProcedure.query(async ({ ctx }) => {
    return getCallAuditsByUserId(ctx.user.id);
  }),

  // Step 1 — Upload audio and transcribe in one step (no S3 required)
  upload: protectedProcedure
    .input(z.object({
      clinicianName: z.string().optional(),
      emisNumber: z.string().optional(),
      auditDate: z.string().optional(),
      audioBase64: z.string(),
      audioMimeType: z.string().default("audio/mpeg"),
      audioFilename: z.string().default("consultation.mp3"),
    }))
    .mutation(async ({ ctx, input }) => {
      const audioBuffer = Buffer.from(input.audioBase64, "base64");

      // Validate size (25 MB limit)
      const sizeMb = audioBuffer.length / (1024 * 1024);
      if (sizeMb > 25) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `File is ${sizeMb.toFixed(1)} MB — maximum allowed is 25 MB.`,
        });
      }

      // Create audit record first (status = pending)
      const auditId = await createCallAudit({
        userId: ctx.user.id,
        clinicianName: input.clinicianName ?? null,
        emisNumber: input.emisNumber ?? null,
        auditDate: input.auditDate ?? null,
        audioUrl: null,   // not storing audio on Railway
        status: "pending",
      });

      // Transcribe directly from buffer
      const transcript = await transcribeBuffer(
        audioBuffer,
        input.audioMimeType,
        input.audioFilename,
      );

      await updateCallAudit(auditId, { transcript, status: "transcribed" });

      return { auditId, transcript };
    }),

  // Step 2 — Evaluate the transcript against the audit criteria
  evaluate: protectedProcedure
    .input(z.object({
      auditId: z.number(),
      transcriptOverride: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const audit = await getCallAuditById(input.auditId);
      if (!audit) throw new TRPCError({ code: "NOT_FOUND", message: "Audit record not found" });
      if (audit.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });

      const transcript = input.transcriptOverride ?? audit.transcript;
      if (!transcript?.trim()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No transcript available for evaluation" });
      }

      // Build criteria list for the prompt (audio-assessable only)
      const assessableCriteria = AUDIT_CRITERIA.filter(c => c.audioAssessable);
      const criteriaJson = assessableCriteria.map(c => `"${c.id}": <0|1|2>`).join(",\n  ");

      const systemPrompt = `You are an experienced NHS clinical supervisor assessing a pharmacist telephone consultation against the GP Pathfinder supervision criteria.

Scoring scale:
- 2 = Done well — criterion clearly met
- 1 = Partial — criterion partially met or unclear
- 0 = Not done — criterion not met or absent
- null = Cannot be assessed from audio alone (use for documentation criteria)

You must return ONLY valid JSON with no markdown, no explanation, no preamble.`;

      const userPrompt = `Evaluate this telephone consultation transcript against the GP Pathfinder pharmacist supervision criteria.

TRANSCRIPT:
${transcript}

Return this exact JSON structure (no markdown, no extra text):
{
  "consultationSuitability": "<green|amber|red>",
  "workingDiagnosis": "<green|amber|red>",
  "redFlagsLight": "<green|amber|red>",
  "treatmentFollowUp": "<green|amber|red>",
  "criteriaScores": {
  ${criteriaJson}
  },
  "clinicalStrengths": "<2-4 sentences on what the clinician did well>",
  "clinicalConcerns": "<2-4 sentences on clinical learning points or concerns>",
  "nonClinicalConcerns": "<1-2 sentences on communication or professionalism issues, or 'None identified'>",
  "additionalNotes": "<any other relevant supervisor observations, or 'None'>"
}

Traffic light guidance:
- green = satisfactory, no concerns
- amber = minor concern, monitor / discuss at next supervision
- red = significant concern, requires immediate discussion or remediation`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        model: "gpt-4o",
      });

      const raw = response.choices[0]?.message?.content as string | undefined;
      if (!raw) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "LLM returned empty response" });
      }

      let parsed: {
        consultationSuitability: string;
        workingDiagnosis: string;
        redFlagsLight: string;
        treatmentFollowUp: string;
        criteriaScores: Record<string, number | null>;
        clinicalStrengths: string;
        clinicalConcerns: string;
        nonClinicalConcerns: string;
        additionalNotes: string;
      };

      try {
        const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        parsed = JSON.parse(cleaned);
      } catch {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to parse evaluation response" });
      }

      // Persist results
      await updateCallAudit(input.auditId, {
        transcript: input.transcriptOverride ?? audit.transcript,
        consultationSuitability: parsed.consultationSuitability,
        workingDiagnosis: parsed.workingDiagnosis,
        redFlagsLight: parsed.redFlagsLight,
        treatmentFollowUp: parsed.treatmentFollowUp,
        criteriaScores: parsed.criteriaScores,
        clinicalStrengths: parsed.clinicalStrengths,
        clinicalConcerns: parsed.clinicalConcerns,
        nonClinicalConcerns: parsed.nonClinicalConcerns,
        additionalNotes: parsed.additionalNotes,
        status: "evaluated",
      });

      return getCallAuditById(input.auditId);
    }),
});
