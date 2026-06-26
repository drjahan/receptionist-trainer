import { z } from "zod";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { invokeLLM } from "./_core/llm";
import { transcribeAudio } from "./_core/voiceTranscription";
import { generateSpeech } from "./_core/tts";
import { storagePut } from "./storage";
import { retrieveRelevantPolicies, formatPolicyContext, formatClinicalContext, getVectorDbStats } from "./vectorSearch";
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

const SEED_SCENARIOS = [
  {
    title: "The Urgent Demander",
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

const SEED_CLINICAL_SCENARIOS = [
  {
    title: "Hypertension Review",
    category: "Cardiovascular",
    difficulty: "intermediate" as const,
    mode: "clinician" as const,
    description: "A 58-year-old male patient attends for a routine hypertension review. His home readings have been consistently 155/95 mmHg despite being on amlodipine 5mg. You need to assess his cardiovascular risk, review his medication, and discuss lifestyle modifications in line with NICE NG136.",
    patientPersona: `You are David, a 58-year-old retired teacher attending your GP for a blood pressure review. You've been on amlodipine for 2 years. Your home BP readings have been around 155/95 mmHg. You are slightly overweight (BMI 28), you drink 20 units of alcohol per week, and you smoke 5 cigarettes a day. You are not particularly worried but you are a bit resistant to adding more tablets. You are open to lifestyle advice if it is explained clearly. You do not have any chest pain, shortness of breath, or visual disturbances. You have not had any ankle swelling. If asked about your diet, you admit to eating a lot of salty food. Start by saying you've come for your blood pressure check.`,
    learningObjectives: [
      "Assess cardiovascular risk factors systematically (NICE NG136)",
      "Identify the need for medication step-up per NICE guidance",
      "Discuss lifestyle modifications: salt reduction, alcohol, smoking, exercise",
      "Safety-net appropriately and arrange follow-up",
    ],
    tags: ["hypertension", "cardiovascular", "NICE NG136", "medication review"],
    estimatedMinutes: 10,
  },
  {
    title: "Type 2 Diabetes Annual Review",
    category: "Endocrinology",
    difficulty: "intermediate" as const,
    mode: "clinician" as const,
    description: "A 64-year-old female patient attends for her annual diabetes review. Her HbA1c has risen to 72 mmol/mol on metformin 1g BD. She has microalbuminuria on her urine dip. You need to review her glycaemic control, address the renal finding, and update her management plan per NICE NG28.",
    patientPersona: `You are Margaret, a 64-year-old woman with Type 2 diabetes diagnosed 8 years ago. You are on metformin 1g twice daily. You've noticed your energy levels are lower recently and you've been more thirsty. You are worried about your kidneys as your mother had kidney failure. You are not on any other medications. Your last eye screening was 6 months ago and was normal. You are not sure what your HbA1c means. You are open to new medication but worried about side effects. If asked about your diet, you admit to eating more carbohydrates since retiring. Start by saying you've come for your yearly diabetes check.`,
    learningObjectives: [
      "Interpret HbA1c and identify need for intensification (NICE NG28)",
      "Assess and address microalbuminuria — consider ACE inhibitor",
      "Discuss SGLT2 inhibitor or GLP-1 agonist options per NICE guidance",
      "Complete annual review checklist: eyes, feet, kidneys, BP, lipids",
    ],
    tags: ["diabetes", "HbA1c", "NICE NG28", "annual review", "microalbuminuria"],
    estimatedMinutes: 12,
  },
  {
    title: "Depression Presentation",
    category: "Mental Health",
    difficulty: "intermediate" as const,
    mode: "clinician" as const,
    description: "A 32-year-old male presents with a 6-week history of low mood, poor sleep, and reduced concentration affecting his work. He scores 16 on PHQ-9 (moderately severe). You need to assess risk, establish a diagnosis, and formulate a management plan in line with NICE NG222.",
    patientPersona: `You are James, a 32-year-old software developer. You've been feeling very low for about 6 weeks. You're sleeping only 4-5 hours a night, you've lost interest in things you used to enjoy, and you've been struggling to concentrate at work. You feel worthless and like a burden to your family. When asked directly about suicidal thoughts, you admit to passive thoughts of not wanting to wake up but you have no active plan or intent. You have no previous history of mental health problems. You drink 15 units of alcohol per week. You are reluctant to take antidepressants as you think they are addictive. You would consider therapy. Start by saying you've been struggling with your mood and your wife encouraged you to come in.`,
    learningObjectives: [
      "Use PHQ-9 to assess severity and guide management (NICE NG222)",
      "Conduct thorough suicide risk assessment sensitively",
      "Discuss stepped care model: CBT, antidepressants, or combined",
      "Address alcohol use as a contributing factor",
    ],
    tags: ["depression", "mental health", "PHQ-9", "NICE NG222", "suicide risk"],
    estimatedMinutes: 15,
  },
  {
    title: "COPD Exacerbation",
    category: "Respiratory",
    difficulty: "advanced" as const,
    mode: "clinician" as const,
    description: "A 67-year-old male with known COPD presents with increased breathlessness and purulent sputum for 3 days. He is on a LABA/LAMA inhaler. You need to assess severity, decide on antibiotic and steroid prescribing, and determine if hospital admission is required per NICE NG115.",
    patientPersona: `You are Brian, a 67-year-old ex-smoker with COPD (diagnosed 5 years ago, FEV1 45% predicted). You've had 3 days of worsening breathlessness and your sputum has turned green. You are using your salbutamol inhaler every 2 hours. Your resting oxygen saturation is 91% (you tell the doctor this from your home oximeter). You feel very unwell. You live alone. You are worried about going to hospital as you have a dog at home. You have had 2 previous exacerbations in the last year. You are on tiotropium and salmeterol/fluticasone inhalers. Start by saying you've been struggling to breathe for the last few days and it's getting worse.`,
    learningObjectives: [
      "Assess COPD exacerbation severity using DECAF or clinical criteria (NICE NG115)",
      "Prescribe antibiotics and oral prednisolone per NICE guidance",
      "Determine admission vs. home management decision",
      "Review inhaler technique and escalate therapy if appropriate",
    ],
    tags: ["COPD", "exacerbation", "respiratory", "NICE NG115", "admission decision"],
    estimatedMinutes: 12,
  },
  {
    title: "Anxiety Disorder Assessment",
    category: "Mental Health",
    difficulty: "beginner" as const,
    mode: "clinician" as const,
    description: "A 26-year-old female presents with a 3-month history of excessive worry, palpitations, and difficulty sleeping. She is concerned she has a heart problem. You need to assess for generalised anxiety disorder, rule out organic causes, and discuss management options per NICE CG113.",
    patientPersona: `You are Sophie, a 26-year-old primary school teacher. You've been having palpitations, feeling on edge all the time, and struggling to sleep for about 3 months. You are convinced something is wrong with your heart. You've been to A&E twice with palpitations and were told your ECG was normal. You worry excessively about many things — your job, your health, your family. You have a GAD-7 score of 14 (moderate-severe). You are not depressed. You don't drink alcohol or use recreational drugs. You are reluctant to take medication as you are trying to conceive. You would prefer a talking therapy. Start by saying you've been having palpitations and you're worried about your heart.`,
    learningObjectives: [
      "Differentiate GAD from cardiac causes and other anxiety disorders (NICE CG113)",
      "Use GAD-7 to quantify severity and guide management",
      "Discuss CBT as first-line treatment for GAD",
      "Address health anxiety and reassure appropriately without reinforcing avoidance",
    ],
    tags: ["anxiety", "GAD", "mental health", "NICE CG113", "palpitations"],
    estimatedMinutes: 10,
  },
  {
    title: "Atrial Fibrillation — New Diagnosis",
    category: "Cardiovascular",
    difficulty: "advanced" as const,
    mode: "clinician" as const,
    description: "A 72-year-old female is found to have an irregular pulse during a routine appointment. An ECG confirms atrial fibrillation. She has hypertension and type 2 diabetes. You need to assess stroke risk using CHA2DS2-VASc, discuss anticoagulation, and plan rate/rhythm control per NICE NG196.",
    patientPersona: `You are Eileen, a 72-year-old retired nurse. You came in for a routine blood pressure check and were told your pulse is irregular. You have hypertension (on ramipril) and type 2 diabetes (on metformin). You have never had a stroke or TIA. You are not on any blood thinners. You are worried about taking warfarin as your husband had a bad bleed on it. You have heard about newer blood thinners. You feel slightly breathless on exertion but thought it was just your age. Your heart rate is 88 bpm and irregular. Start by saying you came for a blood pressure check but were told something is wrong with your heart rhythm.`,
    learningObjectives: [
      "Calculate CHA2DS2-VASc score and determine anticoagulation need (NICE NG196)",
      "Discuss DOACs vs warfarin — explain benefits and bleeding risk",
      "Assess rate vs rhythm control strategy",
      "Arrange echocardiogram, thyroid function, and cardiology referral appropriately",
    ],
    tags: ["atrial fibrillation", "anticoagulation", "CHA2DS2-VASc", "NICE NG196", "DOAC"],
    estimatedMinutes: 12,
  },
];

async function seedScenariosIfEmpty() {
  const existing = await getAllScenarios();
  if (existing.length > 0) {
    // Check if clinical scenarios need seeding
    const hasClinical = existing.some((s) => (s as any).mode === "clinician");
    if (!hasClinical) {
      const db = await import("./db").then(m => m.getDb());
      if (!db) return;
      const { scenarios: scenariosTable } = await import("../drizzle/schema");
      for (const s of SEED_CLINICAL_SCENARIOS) {
        await db.insert(scenariosTable).values(s);
      }
    }
    return;
  }
  const db = await import("./db").then(m => m.getDb());
  if (!db) return;
  const { scenarios: scenariosTable } = await import("../drizzle/schema");
  for (const s of SEED_SCENARIOS) {
    await db.insert(scenariosTable).values(s);
  }
  for (const s of SEED_CLINICAL_SCENARIOS) {
    await db.insert(scenariosTable).values(s);
  }
}

// ─── Admin guard ─────────────────────────────────────────────────────────────

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  return next({ ctx });
});

// ─── Router ───────────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,
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
      .input(z.object({ sessionId: z.number(), content: z.string().min(1).max(2000), ttsEnabled: z.boolean().optional() }))
      .mutation(async ({ ctx, input }) => {
        const session = await getSessionById(input.sessionId);
        if (!session) throw new TRPCError({ code: "NOT_FOUND" });
        if (session.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        if (session.status !== "active") throw new TRPCError({ code: "BAD_REQUEST", message: "Session is not active" });

        const scenario = await getScenarioById(session.scenarioId);
        if (!scenario) throw new TRPCError({ code: "NOT_FOUND" });

        // Save user message
        await addMessage({ sessionId: input.sessionId, role: "user", content: input.content });

        // Get conversation history for context
        const history = await getMessagesBySessionId(input.sessionId);

        const isClinician = (scenario as any).mode === "clinician";

        // Build messages for LLM
        const llmMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
          {
            role: "system",
            content: isClinician
              ? `${scenario.patientPersona}

IMPORTANT INSTRUCTIONS:
- You are playing the patient character described above in a GP consultation simulation.
- Respond naturally as this patient would in a face-to-face GP appointment.
- Keep responses concise (2-4 sentences) as this is a consultation simulation.
- Do not break character or acknowledge that this is a training exercise.
- Do not give medical advice or diagnoses yourself — you are the patient, not the doctor.
- React authentically to how the clinician handles the consultation — if they are empathetic, thorough, and explain things clearly, respond positively; if they are dismissive, miss important points, or fail to explain, react as the patient naturally would.
- If the clinician asks about symptoms not yet mentioned, answer honestly based on your character description.`
              : `${scenario.patientPersona}

IMPORTANT INSTRUCTIONS:
- You are playing the patient character described above. Stay in character throughout.
- Respond naturally as this patient would in a real telephone call to a GP surgery.
- Keep responses concise (2-4 sentences) as this is a phone call simulation.
- Do not break character or acknowledge that this is a training exercise.
- Do not give medical advice or diagnoses.
- React authentically to how the receptionist handles the call — if they are empathetic and follow good practice, respond positively; if they are dismissive or make errors, react as the patient naturally would.`,
          },
          ...history.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
        ];

        // Get AI patient response
        const response = await invokeLLM({ messages: llmMessages, model: process.env.LLM_MODEL || "gpt-4o-mini" });
        const aiContent = (response.choices[0]?.message?.content as string) || "I'm sorry, could you repeat that?";

        // Save AI response
        await addMessage({ sessionId: input.sessionId, role: "assistant", content: aiContent });

        // Generate TTS audio if requested
        let audioBase64: string | undefined;
        if (input.ttsEnabled) {
          try {
            const ttsResult = await generateSpeech({ text: aiContent, voice: "nova" });
            audioBase64 = ttsResult.audioBase64;
          } catch (err) {
            // TTS failure is non-fatal — return text only
            console.error("[TTS] Failed to generate speech:", err);
          }
        }

        return { content: aiContent, audioBase64 };
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

        const isClinician = (scenario as any).mode === "clinician";
        const speakerLabel = isClinician ? "CLINICIAN" : "RECEPTIONIST";
        const transcript = history.map(m => `${m.role === "user" ? speakerLabel : "PATIENT"}: ${m.content}`).join("\n");

        // ─── RAG: Retrieve relevant chunks (clinical or policy) ─────────────────
        const ragQuery = `${scenario.title}: ${scenario.description}. ${history.slice(0, 4).map(m => m.content).join(" ")}`;
        let contextSection = "";
        if (isClinician) {
          const clinicalChunks = await retrieveRelevantPolicies(ragQuery, {
            topK: 5,
            category: "clinical",
            minSimilarity: 0.2,
          });
          const clinicalContext = formatClinicalContext(clinicalChunks);
          contextSection = clinicalContext ? `\n\n${clinicalContext}\n` : "";
        } else {
          const policyChunks = await retrieveRelevantPolicies(ragQuery, {
            topK: 4,
            category: "non-clinical",
            minSimilarity: 0.25,
          });
          const policyContext = formatPolicyContext(policyChunks);
          contextSection = policyContext ? `\n\n${policyContext}\n` : "";
        }

        // ─── Build mode-specific evaluation prompt ─────────────────────────────
        const systemPrompt = isClinician
          ? `You are an experienced GP trainer and clinical educator evaluating a GP registrar or GP's performance in a simulated patient consultation. You must be fair, evidence-based, and constructive in your feedback.

The consultation scenario was: "${scenario.title}" — ${scenario.description}${contextSection}
Evaluate the clinician's performance across exactly these five competencies, scoring each from 1.0 to 5.0 (decimals allowed):

1. Active Listening and Empathy — Did the clinician demonstrate patient-centred consulting, acknowledge the patient's concerns and ideas/concerns/expectations (ICE), and use empathetic language throughout?
2. Information Gathering & Clinical Reasoning — Did the clinician take a systematic history, ask relevant red flag questions, form an appropriate differential diagnosis, and gather sufficient information to justify their management plan?
3. NICE Guideline Adherence — Did the clinician follow NICE guidelines and evidence-based practice for this condition? Were investigations, prescribing, referral decisions, and scoring tools (e.g. PHQ-9, GAD-7, CHA2DS2-VASc) used appropriately?
4. Communication Clarity — Were explanations clear, jargon-free, and tailored to the patient? Did the patient understand their diagnosis, management plan, and what to do next?
5. Safety-Netting & De-escalation — Did the clinician provide clear safety-netting advice (when to seek urgent help, red flags to watch for)? Did they manage patient anxiety sensitively and de-escalate any distress or resistance?

Scoring guide:
1.0-2.0: Poor — significant clinical or communication failures, patient safety may be compromised
2.1-3.0: Below average — some effort but key gaps in clinical reasoning, NICE adherence, or safety-netting
3.1-3.9: Competent — adequate performance with room to improve
4.0-4.5: Good — strong clinical and communication skills with minor gaps
4.6-5.0: Excellent — exemplary consultation, NICE-concordant management, and robust safety-netting

Return your assessment as JSON.`
          : `You are an expert GP surgery training assessor evaluating a receptionist's performance in a simulated patient call. You must be fair, constructive, and specific in your feedback.\n\nThe scenario was: "${scenario.title}" — ${scenario.description}${contextSection}\nEvaluate the receptionist's performance across exactly these five competencies, scoring each from 1.0 to 5.0 (decimals allowed):\n\n1. Active Listening and Empathy — Did the receptionist acknowledge the patient's feelings, use empathetic language, and demonstrate they were truly listening?\n2. Information Gathering — Did the receptionist ask relevant questions to understand the patient's needs, including any red flag symptoms or identity verification where appropriate?\n3. Policy Adherence — Did the receptionist correctly follow GP surgery policies (e.g., triage process, Pharmacy First, zero-tolerance, confidentiality, DNA policy)?\n4. Communication Clarity — Were explanations clear, jargon-free, and easy to understand? Did the patient leave the call knowing what to do next?\n5. De-escalation — Did the receptionist remain calm, manage tension effectively, and de-escalate any frustration or distress?\n\nScoring guide:\n1.0-2.0: Poor — significant failures, patient likely left worse off\n2.1-3.0: Below average — some effort but key gaps\n3.1-3.9: Competent — adequate performance with room to improve\n4.0-4.5: Good — strong performance with minor gaps\n4.6-5.0: Excellent — exemplary practice\n\nReturn your assessment as JSON.`;

        const userPrompt = isClinician
          ? `Here is the full transcript of the consultation:\n\n${transcript}\n\nPlease evaluate the clinician's performance.`
          : `Here is the full transcript of the call:\n\n${transcript}\n\nPlease evaluate the receptionist's performance.`;

        const evaluationResponse = await invokeLLM({
          model: process.env.LLM_MODEL || "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
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
                  wentWell: { type: "string", description: "2-3 sentences on what the receptionist did well" },
                  areasForImprovement: { type: "string", description: "2-3 sentences on specific areas to improve" },
                  activeListeningEmpathyFeedback: { type: "string", description: "Specific feedback for this competency" },
                  informationGatheringFeedback: { type: "string", description: "Specific feedback for this competency" },
                  policyAdherenceFeedback: { type: "string", description: "Specific feedback for this competency" },
                  communicationClarityFeedback: { type: "string", description: "Specific feedback for this competency" },
                  deEscalationFeedback: { type: "string", description: "Specific feedback for this competency" },
                },
                required: [
                  "activeListeningEmpathy", "informationGathering", "policyAdherence",
                  "communicationClarity", "deEscalation", "wentWell", "areasForImprovement",
                  "activeListeningEmpathyFeedback", "informationGatheringFeedback",
                  "policyAdherenceFeedback", "communicationClarityFeedback", "deEscalationFeedback",
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
          evaluation.deEscalation
        ) / 5;

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

  // ─── Voice Interface ─────────────────────────────────────────────────────────
  voice: router({
    // Upload audio blob and get back a storage URL
    uploadAudio: protectedProcedure
      .input(z.object({
        audioBase64: z.string(),        // base64-encoded audio
        mimeType: z.string().default("audio/webm"),
      }))
      .mutation(async ({ ctx, input }) => {
        const buffer = Buffer.from(input.audioBase64, "base64");
        if (buffer.byteLength > 16 * 1024 * 1024) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Audio file exceeds 16 MB limit" });
        }
        const ext = input.mimeType.includes("webm") ? "webm"
          : input.mimeType.includes("mp4") ? "mp4"
          : input.mimeType.includes("ogg") ? "ogg"
          : "wav";
        const key = `voice/${ctx.user.id}/${Date.now()}.${ext}`;
        const { url } = await storagePut(key, buffer, input.mimeType);
        return { url, key };
      }),

    // Transcribe an uploaded audio file via Whisper
    transcribe: protectedProcedure
      .input(z.object({
        audioUrl: z.string(),
        language: z.string().optional(),
        sessionId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await transcribeAudio({
          audioUrl: input.audioUrl,
          language: input.language ?? "en",
          prompt: "GP surgery receptionist training call. Transcribe accurately.",
        });
        if ("error" in result) {
          throw new TRPCError({ code: "BAD_REQUEST", message: result.error });
        }
        return { text: result.text, language: result.language, duration: result.duration };
      }),
  }),
});

export type AppRouter = typeof appRouter;
