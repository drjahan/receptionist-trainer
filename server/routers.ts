import { z } from "zod";
import { systemRouter } from "./_core/systemRouter";
import { callAuditRouter } from "./routers/callAudit";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { invokeLLM } from "./_core/llm";
import { retrieveRelevantPolicies, formatPolicyContext, getVectorDbStats } from "./vectorSearch";
import { ALL_SCENARIOS_V2 as ALL_SCENARIOS } from "./scenarioSeeds";
import {
  getAllScenarios,
  getScenarioById,
  createSession,
  getSessionById,
  getSessionsByUserId,
  getAllSessions,
  completeSession,
  abandonSession,
  addMessage,
  getMessagesBySessionId,
  saveScore,
  getScoreBySessionId,
  getScoresByUserId,
  getAllScores,
  getAllUsers,
} from "./db";

// ─── Seed scenarios helper (called on first load) ────────────────────────────

const SEED_SCENARIOS_LEGACY = [
  {
    title: "__REPLACED__",
    category: "Appointment Management",
    difficulty: "intermediate" as const,
    description: "An anxious parent calls demanding an urgent same-day appointment for their child who has a high fever. All routine slots are full. The receptionist must triage effectively, explain the process, and remain calm under pressure.",
    patientPersona: `You are Sarah, a worried mother calling a GP surgery. Your 4-year-old son has had a fever of 39.5°C since last night and you are very anxious. You are demanding to see a doctor today and are becoming increasingly frustrated. You are not aggressive but you are persistent and emotional. If the receptionist is calm, empathetic and explains the process clearly, you gradually calm down. If they are dismissive or robotic, you become more upset. You do not know about the duty doctor or triage system. You want reassurance above all else. Start the call by saying you need an urgent appointment today.`,
    learningObjectives: ["Triage effectively using red flag questions", "Explain the duty doctor/triage process clearly", "Demonstrate empathy with an anxious parent", "Remain calm under emotional pressure"],
    tags: ["urgent", "triage", "paediatric", "empathy"],
    estimatedMinutes: 8,
  },
  {
    title: "The Pharmacy Signpost",
    category: "Signposting & Self-Care",
    difficulty: "beginner" as const,
    description: "An elderly patient calls requesting antibiotics for a sore throat. The receptionist must politely explain the Pharmacy First scheme and handle resistance from a patient who insists on seeing the GP.",
    patientPersona: `You are Derek, a 72-year-old retired man calling your GP surgery. You have had a sore throat for two days and you want antibiotics. You are polite but stubborn. You believe you always need antibiotics for a sore throat and you are not aware of the Pharmacy First scheme. When told about the pharmacy, you initially resist — you say "I've always seen the doctor for this" and "I don't trust the pharmacist to sort this out." If the receptionist explains the scheme clearly and with respect for your experience, you gradually come around. You are not rude, just set in your ways. Start the call by asking for an appointment to get antibiotics for your sore throat.`,
    learningObjectives: ["Explain the Pharmacy First scheme confidently", "Handle patient resistance respectfully", "Avoid unnecessary GP appointments", "Maintain a warm, respectful tone with elderly patients"],
    tags: ["pharmacy first", "signposting", "elderly", "self-care"],
    estimatedMinutes: 6,
  },
  {
    title: "The Aggressive Caller",
    category: "Conflict & De-escalation",
    difficulty: "advanced" as const,
    description: "A patient is furious about a delayed referral and uses raised voice and mild swearing. The receptionist must apply the zero-tolerance policy, attempt de-escalation, and correctly manage the call.",
    patientPersona: `You are Marcus, a 45-year-old man who has been waiting 6 weeks for a hospital referral that still hasn't come through. You are genuinely angry and frustrated. You use raised voice and occasionally mild swearing (e.g. "this is bloody ridiculous"). You are not threatening but you are very confrontational. If the receptionist acknowledges your frustration and takes concrete action (e.g. offers to chase the referral, escalate to a GP), you start to calm down. If they are dismissive, robotic, or lecture you about behaviour without acknowledging your problem, you escalate further. You respond well to genuine empathy and action. Start the call already frustrated, saying you've been waiting weeks for a referral and nothing has happened.`,
    learningObjectives: ["Apply zero-tolerance policy appropriately", "De-escalate a confrontational caller", "Acknowledge frustration without accepting abuse", "Take concrete action to resolve the underlying issue"],
    tags: ["conflict", "de-escalation", "zero-tolerance", "referral"],
    estimatedMinutes: 10,
  },
  {
    title: "The Test Results Request",
    category: "Information & Confidentiality",
    difficulty: "beginner" as const,
    description: "A patient calls asking for their blood test results. The receptionist must verify identity correctly, explain the results process, and maintain patient confidentiality throughout.",
    patientPersona: `You are Patricia, a 58-year-old woman calling to ask about blood test results you had done last week. You are calm and polite. You are not sure why you had the tests done — your GP just asked you to. You do not know what the results mean. If the receptionist asks for your date of birth and address to verify your identity, you are happy to provide them. You want to know if the results are back and if they are normal. You are slightly anxious about what the results might show. Start the call by asking if your blood test results are back yet.`,
    learningObjectives: ["Verify patient identity using correct protocol", "Explain the results process clearly", "Maintain confidentiality", "Manage patient anxiety with empathy"],
    tags: ["results", "confidentiality", "identity verification", "communication"],
    estimatedMinutes: 5,
  },
  {
    title: "The Prescription Confusion",
    category: "Prescriptions & Medication",
    difficulty: "intermediate" as const,
    description: "A patient is confused about their repeat prescription — they believe it has been sent to the pharmacy but it hasn't. The receptionist must investigate, explain the process, and manage expectations.",
    patientPersona: `You are James, a 50-year-old man who takes medication for high blood pressure. You ordered your repeat prescription online three days ago and went to the pharmacy today, but they said it hasn't arrived. You are confused and slightly annoyed — you need your medication. You are not aggressive, just frustrated and worried about running out. You don't understand the prescription process well. If the receptionist is helpful and explains what may have happened and what they can do, you are relieved. Start the call explaining that you ordered your prescription but the pharmacy doesn't have it.`,
    learningObjectives: ["Investigate prescription status systematically", "Explain the repeat prescription process clearly", "Manage patient expectations about timelines", "Offer practical next steps"],
    tags: ["prescription", "pharmacy", "process", "medication"],
    estimatedMinutes: 7,
  },
  {
    title: "The Mental Health Crisis",
    category: "Safeguarding & Mental Health",
    difficulty: "advanced" as const,
    description: "A distressed patient calls saying they are struggling and need to speak to someone urgently. The receptionist must respond with compassion, follow the correct safeguarding pathway, and ensure the patient is safe.",
    patientPersona: `You are Emma, a 28-year-old woman who is calling because you are feeling very low and overwhelmed. You say you need to speak to someone urgently. You are tearful and your voice is shaky. You are not in immediate danger but you are struggling significantly. You feel like no one is listening to you. If the receptionist is warm, takes you seriously, and follows the right process (e.g. urgent GP callback, signposting to crisis line), you feel heard and slightly more settled. If they are dismissive or try to book you a routine appointment, you become more distressed. Start the call saying you really need to speak to someone today as you are not coping.`,
    learningObjectives: ["Respond to mental health distress with compassion", "Follow the correct urgent mental health pathway", "Assess urgency without being clinical or cold", "Signpost to appropriate crisis support"],
    tags: ["mental health", "safeguarding", "urgent", "empathy"],
    estimatedMinutes: 10,
  },
  {
    title: "The DNA Follow-Up",
    category: "Appointment Management",
    difficulty: "beginner" as const,
    description: "A patient who missed their appointment (Did Not Attend) calls to rebook. The receptionist must follow the DNA policy, explain it kindly, and rebook appropriately.",
    patientPersona: `You are Kevin, a 35-year-old man who missed his GP appointment last week because he forgot. You feel slightly embarrassed. You want to rebook. You are not sure if there is a penalty for missing appointments. You are cooperative and polite. If the receptionist explains the DNA policy kindly and without making you feel judged, you are grateful. Start the call by saying you missed your appointment last week and want to rebook.`,
    learningObjectives: ["Apply the DNA policy consistently and kindly", "Rebook appropriately without judgement", "Explain the impact of missed appointments diplomatically", "Maintain a welcoming tone"],
    tags: ["DNA", "appointment", "policy", "rebooking"],
    estimatedMinutes: 5,
  },
  {
    title: "The Carer Enquiry",
    category: "Third Party & Consent",
    difficulty: "intermediate" as const,
    description: "An adult child calls on behalf of their elderly parent to discuss the parent's health. The receptionist must navigate consent and confidentiality carefully while being helpful.",
    patientPersona: `You are Helen, a 55-year-old woman calling about your 82-year-old mother, Dorothy. You are her main carer. You want to know about your mother's recent appointment and whether her medication has been changed. You believe you have the right to this information as her carer. You are not on the system as an authorised third party. You are not aggressive but you are persistent. If the receptionist explains the consent process kindly and offers a way forward (e.g. asking your mother to call, or adding you to the system), you are understanding. Start the call asking about your mother Dorothy's recent appointment.`,
    learningObjectives: ["Navigate third-party consent correctly", "Explain confidentiality without being dismissive", "Offer a constructive way forward", "Balance helpfulness with policy compliance"],
    tags: ["consent", "confidentiality", "carer", "third party"],
    estimatedMinutes: 7,
  },
];

async function seedScenariosIfEmpty() {
  const existing = await getAllScenarios();
  if (existing.length >= ALL_SCENARIOS.length) return;
  const db = await import("./db").then(m => m.getDb());
  if (!db) return;
  const { scenarios: scenariosTable } = await import("../drizzle/schema");
  // Clear and re-seed to ensure we have the full library
  await db.delete(scenariosTable);
  for (const s of ALL_SCENARIOS) {
    await db.insert(scenariosTable).values({
      title: s.title,
      category: s.category,
      difficulty: s.difficulty,
      mode: s.mode,
      clinicalSystem: s.clinicalSystem ?? null,
      description: s.description,
      patientPersona: s.patientPersona,
      learningObjectives: s.learningObjectives,
      tags: s.tags,
      estimatedMinutes: s.estimatedMinutes,
    });
  }
  console.log(`[Seed] Seeded ${ALL_SCENARIOS.length} scenarios`);
}

// ─── Admin guard ─────────────────────────────────────────────────────────────

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  return next({ ctx });
});

// ─── Router ───────────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,
  callAudit: callAuditRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      // Standalone auth logout is handled by /api/auth/logout REST endpoint
      // This tRPC endpoint is kept for frontend compatibility
      return { success: true } as const;
    }),
  }),

  // ─── Scenarios ──────────────────────────────────────────────────────────────
  scenarios: router({
    list: publicProcedure.query(async () => {
      await seedScenariosIfEmpty();
      return getAllScenarios();
    }),
    get: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      const scenario = await getScenarioById(input.id);
      if (!scenario) throw new TRPCError({ code: "NOT_FOUND" });
      return scenario;
    }),
  }),

  // ─── Sessions ───────────────────────────────────────────────────────────────
  sessions: router({
    create: protectedProcedure
      .input(z.object({ scenarioId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const scenario = await getScenarioById(input.scenarioId);
        if (!scenario) throw new TRPCError({ code: "NOT_FOUND", message: "Scenario not found" });
        const sessionId = await createSession({ userId: ctx.user.id, scenarioId: input.scenarioId });
        return { sessionId };
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const session = await getSessionById(input.id);
        if (!session) throw new TRPCError({ code: "NOT_FOUND" });
        if (session.userId !== ctx.user.id && ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        return session;
      }),

    myHistory: protectedProcedure.query(async ({ ctx }) => {
      const userSessions = await getSessionsByUserId(ctx.user.id);
      const result = await Promise.all(
        userSessions.map(async (s) => {
          const scenario = await getScenarioById(s.scenarioId);
          const score = await getScoreBySessionId(s.id);
          return { ...s, scenario, score };
        })
      );
      return result;
    }),

    complete: protectedProcedure
      .input(z.object({ id: z.number(), durationSeconds: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const session = await getSessionById(input.id);
        if (!session) throw new TRPCError({ code: "NOT_FOUND" });
        if (session.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        await completeSession(input.id, input.durationSeconds);
        return { success: true };
      }),

    abandon: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const session = await getSessionById(input.id);
        if (!session) throw new TRPCError({ code: "NOT_FOUND" });
        if (session.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        await abandonSession(input.id);
        return { success: true };
      }),
  }),

  // ─── Messages & AI Chat ─────────────────────────────────────────────────────
  chat: router({
    getMessages: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ ctx, input }) => {
        const session = await getSessionById(input.sessionId);
        if (!session) throw new TRPCError({ code: "NOT_FOUND" });
        if (session.userId !== ctx.user.id && ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        return getMessagesBySessionId(input.sessionId);
      }),

    sendMessage: protectedProcedure
      .input(z.object({ sessionId: z.number(), content: z.string().min(1).max(2000) }))
      .mutation(async ({ ctx, input }) => {
        const session = await getSessionById(input.sessionId);
        if (!session) throw new TRPCError({ code: "NOT_FOUND" });
        if (session.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        if (session.status !== "active") throw new TRPCError({ code: "BAD_REQUEST", message: "Session is not active" });

        const scenario = await getScenarioById(session.scenarioId);
        if (!scenario) throw new TRPCError({ code: "NOT_FOUND" });

        // Save receptionist message
        await addMessage({ sessionId: input.sessionId, role: "user", content: input.content });

        // Get conversation history for context
        const history = await getMessagesBySessionId(input.sessionId);

        // Build mode-specific system prompt
        const chatMode = (scenario.mode as string);
        const isClinicianMode = chatMode === "gp";
        const isPharmacistMode = chatMode === "pharmacist";
        const googleReviewInstruction = `- IMPORTANT — Google Review: If the staff member offers you a personalised Google Review link at the end of the consultation and mentions their name (e.g. "If you were happy with the service today, I'd really appreciate it if you could leave us a Google review — here is the link: https://g.page/r/CemedDs5bp4FEBM/review — and if you mention my name, [name], you'll receive a £5 Amazon voucher as a thank you"), respond warmly and positively. If they do NOT offer this at the end, do not bring it up yourself — but the assessor will note the omission.`;
        const systemPrompt = isClinicianMode
          ? `${scenario.patientPersona}

IMPORTANT INSTRUCTIONS:
- You are playing the patient character described above in a GP clinical consultation simulation.
- Respond naturally as this patient would in a real GP appointment (face-to-face or telephone).
- Keep responses realistic and conversational (2-5 sentences). Reveal information gradually — do not volunteer all symptoms at once.
- Do not break character or acknowledge that this is a training exercise.
- Do not give medical advice, diagnoses, or suggest treatments to the clinician.
- React authentically to the clinician's approach — if they use ICE (ideas, concerns, expectations) and are empathetic, open up more; if they are dismissive or miss cues, be less forthcoming.
- If the clinician asks a direct question, answer it honestly as the patient would.
- Hidden cues should only be revealed if the clinician asks the right questions.
${googleReviewInstruction}`
          : isPharmacistMode
          ? `${scenario.patientPersona}

IMPORTANT INSTRUCTIONS:
- You are playing the patient character described above in a pharmacist consultation simulation.
- Respond naturally as this patient would in a real pharmacy or GP surgery pharmacist consultation.
- Keep responses realistic and conversational (2-5 sentences). Do not volunteer all information at once.
- Do not break character or acknowledge that this is a training exercise.
- Do not give medical advice, diagnoses, or suggest treatments to the pharmacist.
- React authentically to the pharmacist's approach — if they are empathetic, explain things clearly, and address your concerns, open up more; if they are dismissive or use jargon, be less forthcoming or more anxious.
- If the pharmacist asks a direct question, answer it honestly as the patient would.
- Show realistic patient concerns about medication changes, side effects, or stopping tablets.
${googleReviewInstruction}`
          : `${scenario.patientPersona}

IMPORTANT INSTRUCTIONS:
- You are playing the patient character described above. Stay in character throughout.
- Respond naturally as this patient would in a real telephone call to a GP surgery.
- Keep responses concise (2-4 sentences) as this is a phone call simulation.
- Do not break character or acknowledge that this is a training exercise.
- Do not give medical advice or diagnoses.
- React authentically to how the receptionist handles the call — if they are empathetic and follow good practice, respond positively; if they are dismissive or make errors, react as the patient naturally would.
${googleReviewInstruction}`;

        // Build messages for LLM
        const llmMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
          {
            role: "system",
            content: systemPrompt,
          },
          ...history.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
        ];

        // Get AI patient response
        const response = await invokeLLM({ messages: llmMessages, model: process.env.LLM_MODEL || "gpt-4o-mini" });
        const aiContent = (response.choices[0]?.message?.content as string) || "I'm sorry, could you repeat that?";

        // Save AI response
        await addMessage({ sessionId: input.sessionId, role: "assistant", content: aiContent });

        return { content: aiContent };
      }),

    // ─── ElevenLabs signed URL with dynamic patient persona override ─────────
    getSignedUrl: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const session = await getSessionById(input.sessionId);
        if (!session) throw new TRPCError({ code: "NOT_FOUND" });
        if (session.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        const scenario = await getScenarioById(session.scenarioId);
        if (!scenario) throw new TRPCError({ code: "NOT_FOUND" });

        const apiKey = process.env.ELEVENLABS_API_KEY;
        const agentId = process.env.ELEVENLABS_AGENT_ID;
        if (!apiKey || !agentId) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "ElevenLabs not configured" });
        }

        const chatMode = (scenario.mode as string);
        const isClinicianMode = chatMode === "gp";
        const isPharmacistMode = chatMode === "pharmacist";
        const googleReviewInstruction = `- IMPORTANT — Google Review: If the staff member offers you a personalised Google Review link at the end of the consultation and mentions their name (e.g. "If you were happy with the service today, I'd really appreciate it if you could leave us a Google review — here is the link: https://g.page/r/CemedDs5bp4FEBM/review — and if you mention my name, [name], you'll receive a £5 Amazon voucher as a thank you"), respond warmly and positively. If they do NOT offer this at the end, do not bring it up yourself.`;

        const systemPrompt = isClinicianMode
          ? `${scenario.patientPersona}\nIMPORTANT INSTRUCTIONS:\n- You are playing the patient character described above in a GP clinical consultation simulation.\n- Respond naturally as this patient would in a real GP appointment (face-to-face or telephone).\n- Keep responses realistic and conversational (2-5 sentences). Reveal information gradually — do not volunteer all symptoms at once.\n- Do not break character or acknowledge that this is a training exercise.\n- Do not give medical advice, diagnoses, or suggest treatments to the clinician.\n- React authentically to the clinician's approach — if they use ICE (ideas, concerns, expectations) and are empathetic, open up more; if they are dismissive or miss cues, be less forthcoming.\n- If the clinician asks a direct question, answer it honestly as the patient would.\n${googleReviewInstruction}`
          : isPharmacistMode
          ? `${scenario.patientPersona}\nIMPORTANT INSTRUCTIONS:\n- You are playing the patient character described above in a pharmacist consultation simulation.\n- Respond naturally as this patient would in a real pharmacy or GP surgery pharmacist consultation.\n- Keep responses realistic and conversational (2-5 sentences). Do not volunteer all information at once.\n- Do not break character or acknowledge that this is a training exercise.\n- Do not give medical advice, diagnoses, or suggest treatments to the pharmacist.\n- React authentically to the pharmacist's approach — if they are empathetic and explain things clearly, open up more; if they are dismissive, be less forthcoming.\n${googleReviewInstruction}`
          : `${scenario.patientPersona}\nIMPORTANT INSTRUCTIONS:\n- You are playing the patient character described above. Stay in character throughout.\n- Respond naturally as this patient would in a real telephone call to a GP surgery.\n- Keep responses concise (2-4 sentences) as this is a phone call simulation.\n- Do not break character or acknowledge that this is a training exercise.\n- Do not give medical advice or diagnoses.\n- React authentically to how the receptionist handles the call — if they are empathetic and follow good practice, respond positively; if they are dismissive or make errors, react as the patient naturally would.\n${googleReviewInstruction}`;

        // Get signed URL from ElevenLabs
        const resp = await fetch(
          `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
          { headers: { "xi-api-key": apiKey } }
        );
        if (!resp.ok) {
          const errText = await resp.text();
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `ElevenLabs error: ${errText}` });
        }
        const { signed_url } = await resp.json() as { signed_url: string };
        return { signedUrl: signed_url, systemPrompt };
      }),

    // ─── Save ElevenLabs transcript + mark session complete ───────────────────
    saveAndEvaluate: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        messages: z.array(z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string(),
        })),
      }))
      .mutation(async ({ ctx, input }) => {
        const session = await getSessionById(input.sessionId);
        if (!session) throw new TRPCError({ code: "NOT_FOUND" });
        if (session.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        // Persist all ElevenLabs messages to the DB so scoring.evaluate can read them
        for (const msg of input.messages) {
          await addMessage({ sessionId: input.sessionId, role: msg.role, content: msg.content });
        }
        // Mark session complete (duration unknown for voice sessions — use 0 as placeholder)
        await completeSession(input.sessionId, 0);
        return { ok: true };
      }),
  }),

  // ─── Scoring Engine ─────────────────────────────────────────────────────────
  scoring: router({
    evaluate: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const session = await getSessionById(input.sessionId);
        if (!session) throw new TRPCError({ code: "NOT_FOUND" });
        if (session.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });

        // Check if already scored
        const existing = await getScoreBySessionId(input.sessionId);
        if (existing) return existing;

        const scenario = await getScenarioById(session.scenarioId);
        if (!scenario) throw new TRPCError({ code: "NOT_FOUND" });

        const history = await getMessagesBySessionId(input.sessionId);
        if (history.length < 2) throw new TRPCError({ code: "BAD_REQUEST", message: "Not enough conversation to evaluate" });

        const scenarioMode = (scenario.mode as string);
        const isClinicianEval = scenarioMode === "gp";
        const isPharmacistEval = scenarioMode === "pharmacist";
        const speakerLabel = isClinicianEval ? "CLINICIAN" : isPharmacistEval ? "PHARMACIST" : "RECEPTIONIST";
        const transcript = history.map(m => `${m.role === "user" ? speakerLabel : "PATIENT"}: ${m.content}`).join("\n");

        // ─── RAG: Retrieve relevant policy chunks ──────────────
        const ragQuery = `${scenario.title}: ${scenario.description}. ${history.slice(0, 4).map(m => m.content).join(" ")}`;
        const policyChunks = await retrieveRelevantPolicies(ragQuery, {
          topK: 4,
          category: isClinicianEval || isPharmacistEval ? "clinical" : "non-clinical",
          minSimilarity: 0.25,
        });
        const policyContext = formatPolicyContext(policyChunks);
        const policySection = policyContext ? `\n\n${policyContext}\n` : "";

        // ─── Build mode-specific evaluation prompt ─────────────────────
        const evaluationSystemPrompt = isPharmacistEval
          ? `You are an experienced clinical pharmacist trainer and GPhC assessor evaluating a pharmacist's performance in a simulated patient consultation. Be fair, constructive, and specific.

The scenario was: "${scenario.title}" — ${scenario.description}${policySection}
Learning objectives: ${scenario.learningObjectives.join("; ")}

Evaluate the pharmacist's performance across exactly these six competencies, scoring each from 1.0 to 5.0 (decimals allowed):

1. Active Listening and Empathy — Did the pharmacist demonstrate patient-centred communication, acknowledge concerns, and build rapport? Did they use open questions and check understanding?
2. Medication Review Quality — Was the medication review systematic and thorough? Did they apply STOPP/START criteria, identify drug interactions, check monitoring requirements, and address adherence?
3. Clinical Safety and Governance — Did the pharmacist identify and act on safety issues (MHRA alerts, contraindications, toxicity signs, monitoring gaps)? Were escalation decisions appropriate?
4. Communication Clarity — Were explanations clear, jargon-free, and tailored to the patient? Was shared decision-making used for any medication changes?
5. Deprescribing and Optimisation — Did the pharmacist identify opportunities to deprescribe, simplify the regimen, or switch to safer alternatives where appropriate?
6. Google Review Offer — Did the staff member offer the patient a personalised Google Review link at the end of the consultation, mentioning their own name and the £5 Amazon voucher incentive? This is a mandatory practice requirement for all GP Pathfinder Clinics staff worldwide. Score 5.0 if they offered it clearly with their name; 3.0 if they offered it without their name; 1.0 if they did not offer it at all. Review link: https://g.page/r/CemedDs5bp4FEBM/review

Scoring guide:
1.0-2.0: Unsafe or significantly below GPhC standard — patient at risk
2.1-3.0: Below standard — significant gaps in pharmaceutical knowledge or skills
3.1-3.9: Competent — meets minimum GPhC standard with room to improve
4.0-4.5: Good — above standard, minor gaps only
4.6-5.0: Excellent — advanced clinical pharmacist standard

Return your assessment as JSON.`
          : isClinicianEval
          ? `You are an experienced GP trainer and MRCGP examiner evaluating a GP clinician's performance in a simulated patient consultation. Be fair, constructive, and specific.

The scenario was: "${scenario.title}" — ${scenario.description}${policySection}
Learning objectives: ${scenario.learningObjectives.join("; ")}

Evaluate the clinician's performance across exactly these six competencies, scoring each from 1.0 to 5.0 (decimals allowed):

1. Active Listening and Empathy — Did the clinician use ICE (ideas, concerns, expectations), demonstrate empathy, and build rapport?
2. Information Gathering — Did the clinician take a systematic history, identify red flags, and elicit the presenting complaint fully?
3. Clinical Management — Was the management plan appropriate, evidence-based (NICE/SIGN/BTS guidelines), and safe? Were red flags acted upon correctly?
4. Communication Clarity — Were explanations clear, jargon-free, and appropriate to the patient? Was shared decision making used?
5. Safety Netting — Did the clinician provide appropriate safety-net advice, follow-up arrangements, and identify when to escalate?
6. Google Review Offer — Did the staff member offer the patient a personalised Google Review link at the end of the consultation, mentioning their own name and the £5 Amazon voucher incentive? This is a mandatory practice requirement for all GP Pathfinder Clinics staff worldwide. Score 5.0 if they offered it clearly with their name; 3.0 if they offered it without their name; 1.0 if they did not offer it at all. Review link: https://g.page/r/CemedDs5bp4FEBM/review

Scoring guide:
1.0-2.0: Unsafe or significantly below standard — patient at risk
2.1-3.0: Below standard — significant gaps in knowledge or skills
3.1-3.9: Competent — meets minimum standard with room to improve
4.0-4.5: Good — above standard, minor gaps only
4.6-5.0: Excellent — MRCGP/CSA distinction standard

Return your assessment as JSON.`
          : `You are an expert GP surgery training assessor evaluating a receptionist's performance in a simulated patient call. You must be fair, constructive, and specific in your feedback.

The scenario was: "${scenario.title}" — ${scenario.description}${policySection}
Evaluate the receptionist's performance across exactly these six competencies, scoring each from 1.0 to 5.0 (decimals allowed):

1. Active Listening and Empathy — Did the receptionist acknowledge the patient's feelings, use empathetic language, and demonstrate they were truly listening?
2. Information Gathering — Did the receptionist ask relevant questions to understand the patient's needs, including any red flag symptoms or identity verification where appropriate?
3. Policy Adherence — Did the receptionist correctly follow GP surgery policies (e.g., triage process, Pharmacy First, zero-tolerance, confidentiality, DNA policy)?
4. Communication Clarity — Were explanations clear, jargon-free, and easy to understand? Did the patient leave the call knowing what to do next?
5. De-escalation — Did the receptionist remain calm, manage tension effectively, and de-escalate any frustration or distress?
6. Google Review Offer — Did the receptionist offer the patient a personalised Google Review link at the end of the call, mentioning their own name and the £5 Amazon voucher incentive? This is a mandatory requirement for all GP Pathfinder Clinics staff worldwide. Score 5.0 if they offered it clearly with their name; 3.0 if they offered it without their name; 1.0 if they did not offer it at all. Review link: https://g.page/r/CemedDs5bp4FEBM/review

Scoring guide:
1.0-2.0: Poor — significant failures, patient likely left worse off
2.1-3.0: Below average — some effort but key gaps
3.1-3.9: Competent — adequate performance with room to improve
4.0-4.5: Good — strong performance with minor gaps
4.6-5.0: Excellent — exemplary practice

Return your assessment as JSON.`;

        const evaluationUserPrompt = isPharmacistEval
          ? `Here is the full transcript of the pharmacist consultation:\n\n${transcript}\n\nPlease evaluate the pharmacist's performance.`
          : isClinicianEval
          ? `Here is the full transcript of the consultation:\n\n${transcript}\n\nPlease evaluate the clinician's performance.`
          : `Here is the full transcript of the call:\n\n${transcript}\n\nPlease evaluate the receptionist's performance.`;

        const evaluationResponse = await invokeLLM({
          model: process.env.LLM_MODEL || "gpt-4o-mini",
          messages: [
            { role: "system", content: evaluationSystemPrompt },
            { role: "user", content: evaluationUserPrompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "evaluation_result",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  activeListeningEmpathy: { type: "number", description: "Score 1.0-5.0" },
                  informationGathering: { type: "number", description: "Score 1.0-5.0" },
                  policyAdherence: { type: "number", description: "Score 1.0-5.0" },
                  communicationClarity: { type: "number", description: "Score 1.0-5.0" },
                  deEscalation: { type: "number", description: "Score 1.0-5.0" },
                  wentWell: { type: "string", description: "2-3 sentences on what went well" },
                  areasForImprovement: { type: "string", description: "2-3 sentences on specific areas to improve" },
                  activeListeningEmpathyFeedback: { type: "string", description: "Specific feedback for this competency" },
                  informationGatheringFeedback: { type: "string", description: "Specific feedback for this competency" },
                  policyAdherenceFeedback: { type: "string", description: "Specific feedback for this competency" },
                  communicationClarityFeedback: { type: "string", description: "Specific feedback for this competency" },
                  deEscalationFeedback: { type: "string", description: "Specific feedback for this competency" },
                  googleReviewOffer: { type: "number", description: "Score 1.0-5.0 for Google Review offer" },
                  googleReviewOfferFeedback: { type: "string", description: "Specific feedback: did they offer the Google Review link with their name and mention the £5 voucher?" },
                },
                required: [
                  "activeListeningEmpathy", "informationGathering", "policyAdherence",
                  "communicationClarity", "deEscalation", "googleReviewOffer", "wentWell", "areasForImprovement",
                  "activeListeningEmpathyFeedback", "informationGatheringFeedback",
                  "policyAdherenceFeedback", "communicationClarityFeedback", "deEscalationFeedback",
                  "googleReviewOfferFeedback",
                ],
                additionalProperties: false,
              },
            },
          },
        });

        const raw = evaluationResponse.choices[0]?.message?.content as string | undefined;
        if (!raw) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to get evaluation" });

        const evaluation = JSON.parse(raw);
        const overallScore = (
          evaluation.activeListeningEmpathy +
          evaluation.informationGathering +
          evaluation.policyAdherence +
          evaluation.communicationClarity +
          evaluation.deEscalation +
          evaluation.googleReviewOffer
        ) / 6;

        // Recalibrated thresholds — more discriminating for staff induction
        const overallGrade =
          overallScore >= 4.7 ? "A+" :
          overallScore >= 4.3 ? "A" :
          overallScore >= 3.7 ? "B" :
          overallScore >= 3.0 ? "C" :
          overallScore >= 2.0 ? "D" : "F";

        const scoreData = {
          sessionId: input.sessionId,
          userId: ctx.user.id,
          scenarioId: session.scenarioId,
          activeListeningEmpathy: evaluation.activeListeningEmpathy,
          informationGathering: evaluation.informationGathering,
          policyAdherence: evaluation.policyAdherence,
          communicationClarity: evaluation.communicationClarity,
          deEscalation: evaluation.deEscalation,
          googleReviewOffer: evaluation.googleReviewOffer,
          overallScore: Math.round(overallScore * 10) / 10,
          overallGrade,
          wentWell: evaluation.wentWell,
          areasForImprovement: evaluation.areasForImprovement,
          detailedFeedback: {
            activeListeningEmpathy: evaluation.activeListeningEmpathyFeedback,
            informationGathering: evaluation.informationGatheringFeedback,
            policyAdherence: evaluation.policyAdherenceFeedback,
            communicationClarity: evaluation.communicationClarityFeedback,
            deEscalation: evaluation.deEscalationFeedback,
            googleReviewOffer: evaluation.googleReviewOfferFeedback,
          },
        };

        await saveScore(scoreData);
        // Mark session complete
        const startTime = session.startedAt.getTime();
        const duration = Math.round((Date.now() - startTime) / 1000);
        await completeSession(input.sessionId, duration);

        return getScoreBySessionId(input.sessionId);
      }),

    getScore: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ ctx, input }) => {
        const session = await getSessionById(input.sessionId);
        if (!session) throw new TRPCError({ code: "NOT_FOUND" });
        if (session.userId !== ctx.user.id && ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        return getScoreBySessionId(input.sessionId);
      }),
  }),

  // ─── Admin ───────────────────────────────────────────────────────────────────
  admin: router({
    allSessions: adminProcedure.query(async () => {
      const allSess = await getAllSessions();
      const result = await Promise.all(
        allSess.map(async (s) => {
          const scenario = await getScenarioById(s.scenarioId);
          const score = await getScoreBySessionId(s.id);
          const db = await import("./db").then(m => m.getDb());
          let user = null;
          if (db) {
            const { users: usersTable } = await import("../drizzle/schema");
            const { eq } = await import("drizzle-orm");
            const u = await db.select().from(usersTable).where(eq(usersTable.id, s.userId)).limit(1);
            user = u[0] || null;
          }
          return { ...s, scenario, score, user };
        })
      );
      return result;
    }),

    allUsers: adminProcedure.query(async () => {
      const allUsers = await getAllUsers();
      const result = await Promise.all(
        allUsers.map(async (u) => {
          const userScores = await getScoresByUserId(u.id);
          const avgScore = userScores.length > 0
            ? userScores.reduce((acc, s) => acc + s.overallScore, 0) / userScores.length
            : null;
          return { ...u, sessionCount: userScores.length, avgScore: avgScore ? Math.round(avgScore * 10) / 10 : null };
        })
      );
      return result;
    }),

    vectorDbStats: adminProcedure.query(async () => {
      return getVectorDbStats();
    }),

    searchPolicies: adminProcedure
      .input(z.object({
        query: z.string().min(1).max(500),
        category: z.enum(["clinical", "non-clinical", "all"]).default("all"),
        topK: z.number().min(1).max(20).default(5),
      }))
      .query(async ({ input }) => {
        return retrieveRelevantPolicies(input.query, {
          topK: input.topK,
          category: input.category,
          minSimilarity: 0.2,
        });
      }),

    teamStats: adminProcedure.query(async () => {
      const allScores = await getAllScores();
      if (allScores.length === 0) return null;
      const avg = (key: keyof typeof allScores[0]) =>
        Math.round((allScores.reduce((acc, s) => acc + (s[key] as number), 0) / allScores.length) * 10) / 10;
      return {
        totalSessions: allScores.length,
        avgOverall: avg("overallScore"),
        avgActiveListeningEmpathy: avg("activeListeningEmpathy"),
        avgInformationGathering: avg("informationGathering"),
        avgPolicyAdherence: avg("policyAdherence"),
        avgCommunicationClarity: avg("communicationClarity"),
        avgDeEscalation: avg("deEscalation"),
      };
    }),
  }),

  // ─── Crib Sheet Generator ─────────────────────────────────────────────────────────────────────────
  cribSheet: router({
    generate: protectedProcedure
      .input(z.object({ scenarioId: z.number() }))
      .mutation(async ({ input }) => {
        const scenario = await getScenarioById(input.scenarioId);
        if (!scenario) throw new TRPCError({ code: "NOT_FOUND", message: "Scenario not found" });

        const isPharmacist = (scenario.mode as string) === "pharmacist";
        const isGP = (scenario.mode as string) === "gp";

        const systemPrompt = isPharmacist
          ? `You are an expert clinical pharmacist trainer. Generate a concise, structured pre-consultation crib sheet for a pharmacist about to role-play the following scenario. The crib sheet should help the pharmacist prepare for the consultation and remember key clinical points.

Format the response as a JSON object with these exact fields:
- scenarioSummary: string (2-3 sentences describing the scenario and key challenge)
- keyMedications: array of objects with { name: string, indication: string, keyPoints: string[] }
- relevantGuidelines: array of objects with { name: string, keyPoints: string[] }
- redFlags: string[] (safety issues to watch for)
- communicationTips: string[] (patient-centred communication advice for this specific patient)
- checklistItems: string[] (things to cover before ending the consultation)
- googleReviewReminder: string (reminder to offer Google Review with name and £5 voucher)`
          : isGP
          ? `You are an expert GP trainer and MRCGP examiner. Generate a concise, structured pre-consultation crib sheet for a GP about to role-play the following scenario. The crib sheet should help the GP prepare for the consultation and remember key clinical points.

Format the response as a JSON object with these exact fields:
- scenarioSummary: string (2-3 sentences describing the scenario and key challenge)
- differentialDiagnosis: string[] (top 3-5 differentials to consider)
- relevantGuidelines: array of objects with { name: string, keyPoints: string[] }
- redFlags: string[] (red flags to actively exclude)
- iceFramework: object with { ideas: string, concerns: string, expectations: string } (likely patient ICE for this scenario)
- communicationTips: string[] (communication advice for this specific patient)
- checklistItems: string[] (things to cover before ending the consultation)
- googleReviewReminder: string (reminder to offer Google Review with name and £5 voucher)`
          : `You are an expert GP surgery trainer. Generate a concise, structured pre-consultation crib sheet for a receptionist about to role-play the following scenario.

Format the response as a JSON object with these exact fields:
- scenarioSummary: string (2-3 sentences describing the scenario and key challenge)
- relevantPolicies: array of objects with { name: string, keyPoints: string[] }
- redFlags: string[] (red flags requiring urgent escalation)
- communicationTips: string[] (communication advice for this specific patient)
- checklistItems: string[] (things to cover before ending the call)
- googleReviewReminder: string (reminder to offer Google Review with name and £5 voucher)`;

        const userPrompt = `Scenario: ${scenario.title}
Mode: ${scenario.mode}
Category: ${scenario.category}
Difficulty: ${scenario.difficulty}
Description: ${scenario.description}
Patient Persona: ${scenario.patientPersona}
Learning Objectives: ${scenario.learningObjectives.join("; ")}
Tags: ${scenario.tags.join(", ")}`;

        const response = await invokeLLM({
          model: process.env.LLM_MODEL || "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
        });

        const raw = response.choices[0]?.message?.content as string | undefined;
        if (!raw) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to generate crib sheet" });

        return {
          scenarioId: scenario.id,
          scenarioTitle: scenario.title,
          mode: scenario.mode,
          cribSheet: JSON.parse(raw),
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
