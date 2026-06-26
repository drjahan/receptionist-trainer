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
  upsertSessionNote,
  getSessionNoteBySessionId,
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
  // ─── UROLOGY ─────────────────────────────────────────────────────────────────
  {
    title: "Simple UTI in a Young Woman",
    category: "Urology",
    clinicalSystem: "Urology",
    complexityTier: 1,
    difficulty: "beginner" as const,
    mode: "clinician" as const,
    comorbidities: [],
    hiddenCues: ["Patient seems embarrassed and hesitant to describe symptoms fully", "Mentions 'it burns when I go' but waits to be asked for more detail"],
    iceElements: { ideas: "Thinks she has a water infection like before", concerns: "Worried it might spread to her kidneys", expectations: "Wants antibiotics today and to feel better quickly" },
    description: "A 24-year-old woman presents with a 2-day history of dysuria, frequency, and suprapubic discomfort. No fever, no loin pain. She has had one previous UTI 2 years ago. Urine dipstick: nitrites positive, leucocytes 2+. A straightforward uncomplicated lower UTI — practise taking a focused history, confirming the diagnosis, and prescribing per NICE NG112.",
    patientPersona: `You are Priya, a 24-year-old student. You've had burning when you wee and needing to go all the time for 2 days. It's quite uncomfortable. You had something similar 2 years ago and got antibiotics. You feel a bit embarrassed talking about it. You don't have a fever, no pain in your back or sides. You are not pregnant. You are not sexually active currently. You are on the contraceptive pill. You are worried it might go to your kidneys if not treated. You want antibiotics today. Start by saying you think you've got a water infection.`,
    learningObjectives: ["Diagnose uncomplicated lower UTI using NICE NG112 criteria", "Prescribe trimethoprim or nitrofurantoin appropriately", "Advise on hydration and analgesia", "Safety-net for worsening symptoms or treatment failure"],
    tags: ["UTI", "urology", "NICE NG112", "dysuria", "uncomplicated"],
    estimatedMinutes: 7,
  },
  {
    title: "Recurrent UTI with Complicating Factors",
    category: "Urology",
    clinicalSystem: "Urology",
    complexityTier: 2,
    difficulty: "intermediate" as const,
    mode: "clinician" as const,
    comorbidities: ["Type 2 diabetes", "Obesity"],
    hiddenCues: ["Patient mentions 'I've had loads of these' — cue to explore recurrence pattern", "Hesitates when asked about blood glucose control — cue to explore diabetes management"],
    iceElements: { ideas: "Thinks her diabetes is making her prone to infections", concerns: "Worried about antibiotic resistance from repeated courses", expectations: "Wants a long-term solution, not just another course of antibiotics" },
    description: "A 52-year-old woman with Type 2 diabetes presents with her fourth UTI in 6 months. She is on metformin. This time she also has mild loin discomfort and a temperature of 37.8°C. You need to assess for upper UTI, consider whether the diabetes is contributing, and plan investigation and prophylaxis per NICE guidance.",
    patientPersona: `You are Carol, a 52-year-old supermarket manager with Type 2 diabetes. You've had 4 UTIs in the last 6 months and you're fed up. This time you have the usual burning and frequency but also a dull ache in your right side and you felt feverish last night. Your temperature this morning was 37.8°C. Your diabetes is not well controlled — your last HbA1c was 68. You are worried about taking more antibiotics as you've heard about resistance. You want something done about the recurrent infections. Start by saying this is your fourth infection this year and you want to know why it keeps happening.`,
    learningObjectives: ["Differentiate upper from lower UTI and assess severity", "Recognise diabetes as a risk factor for recurrent/complicated UTI", "Investigate appropriately: MSU, renal function, consider imaging", "Discuss prophylaxis options and address glycaemic control"],
    tags: ["UTI", "recurrent", "diabetes", "pyelonephritis", "complicated UTI"],
    estimatedMinutes: 12,
  },
  {
    title: "Haematuria with Possible Bladder Cancer",
    category: "Urology",
    clinicalSystem: "Urology",
    complexityTier: 3,
    difficulty: "advanced" as const,
    mode: "clinician" as const,
    comorbidities: ["Ex-smoker", "Hypertension"],
    hiddenCues: ["Patient mentions 'I thought it would just go away' — cue to explore symptom duration and health avoidance", "Mentions he used to work in a dye factory — occupational cue for bladder cancer risk", "Seems anxious but downplaying symptoms — cue for underlying fear of cancer"],
    iceElements: { ideas: "Thinks it might be a kidney stone or infection", concerns: "Terrified it might be cancer but hasn't said so directly", expectations: "Wants reassurance but also wants to know what is going on" },
    description: "A 68-year-old male ex-smoker presents with 3 episodes of painless frank haematuria over 4 weeks. He delayed coming in. He has hypertension and worked in a chemical factory for 20 years. This is a 2-week wait (2WW) cancer pathway scenario — practise recognising red flags, managing the patient's anxiety, and making the correct urgent referral per NICE NG12.",
    patientPersona: `You are Terry, a 68-year-old retired factory worker. You've noticed blood in your urine three times in the last month — it was quite alarming the first time. You put off coming in because you were scared. You don't have any pain when you wee. You smoked 20 cigarettes a day for 30 years and stopped 5 years ago. You worked in a chemical dye factory for 20 years. You are on amlodipine for blood pressure. You are very anxious but you are trying to appear calm. You have not told your wife yet. When the doctor asks about your concerns, you eventually admit you are terrified it might be cancer. Start by saying you've noticed some blood in your urine.`,
    learningObjectives: ["Recognise painless haematuria as a 2WW red flag (NICE NG12)", "Identify occupational and smoking risk factors for bladder cancer", "Manage patient anxiety and explain the 2WW pathway clearly", "Arrange urgent urology referral and interim investigations (MSU, FBC, renal function)"],
    tags: ["haematuria", "bladder cancer", "2WW", "NICE NG12", "red flags", "urology"],
    estimatedMinutes: 15,
  },

  // ─── CARDIOVASCULAR ───────────────────────────────────────────────────────────
  {
    title: "Hypertension Review",
    category: "Cardiovascular",
    clinicalSystem: "Cardiovascular",
    complexityTier: 1,
    difficulty: "beginner" as const,
    mode: "clinician" as const,
    comorbidities: [],
    hiddenCues: ["Patient mentions 'I've been a bit stressed at work' — cue to explore lifestyle factors", "Hesitates when asked about alcohol — cue to explore drinking habits"],
    iceElements: { ideas: "Thinks the tablets are not working", concerns: "Worried about having a stroke like his father", expectations: "Wants to know if he needs stronger tablets" },
    description: "A 58-year-old male attends for a routine hypertension review. His home readings have been consistently 155/95 mmHg despite being on amlodipine 5mg. Assess his cardiovascular risk, review his medication, and discuss lifestyle modifications per NICE NG136.",
    patientPersona: `You are David, a 58-year-old retired teacher. Your home BP readings have been around 155/95 mmHg. You are slightly overweight (BMI 28), you drink 20 units of alcohol per week, and you smoke 5 cigarettes a day. You are resistant to adding more tablets. Your father had a stroke at 62 and you are worried about the same happening to you but you haven't mentioned this yet. If asked about your concerns, you open up about your father. Start by saying you've come for your blood pressure check.`,
    learningObjectives: ["Assess cardiovascular risk factors systematically (NICE NG136)", "Identify the need for medication step-up per NICE guidance", "Discuss lifestyle modifications: salt reduction, alcohol, smoking", "Safety-net and arrange follow-up"],
    tags: ["hypertension", "cardiovascular", "NICE NG136", "medication review"],
    estimatedMinutes: 10,
  },
  {
    title: "Chest Pain — Stable Angina Assessment",
    category: "Cardiovascular",
    clinicalSystem: "Cardiovascular",
    complexityTier: 2,
    difficulty: "intermediate" as const,
    mode: "clinician" as const,
    comorbidities: ["Hypertension", "Hyperlipidaemia", "Ex-smoker"],
    hiddenCues: ["Patient mentions chest tightness 'only when I rush for the bus' — cue to explore exertional pattern", "Mentions his brother had a heart attack at 55 — cue to explore family history and patient anxiety"],
    iceElements: { ideas: "Thinks it might be indigestion or muscle strain", concerns: "Worried it might be his heart but scared to find out", expectations: "Wants to be told it's nothing serious" },
    description: "A 62-year-old male with hypertension and hyperlipidaemia presents with 6 weeks of exertional chest tightness that resolves with rest. He is an ex-smoker. Assess for stable angina, calculate his cardiovascular risk, and plan investigation and management per NICE CG95.",
    patientPersona: `You are Graham, a 62-year-old retired builder. You've been getting a tight feeling in your chest when you walk quickly or climb stairs for about 6 weeks. It goes away when you stop and rest. You have high blood pressure (on ramipril) and high cholesterol (on atorvastatin). You smoked 20 a day for 25 years and stopped 3 years ago. Your brother had a heart attack at 55. You've been putting off coming in because you're scared of what they might find. You think it might be indigestion. When asked directly about your concerns, you admit you're worried about your heart. Start by saying you've been getting some chest tightness when you exert yourself.`,
    learningObjectives: ["Take a systematic chest pain history using SOCRATES", "Identify features of stable angina and calculate QRISK3", "Arrange appropriate investigations: resting ECG, FBC, lipids, exercise tolerance test or CT coronary angiogram", "Initiate GTN spray and refer to rapid access chest pain clinic"],
    tags: ["chest pain", "angina", "cardiovascular", "NICE CG95", "QRISK3"],
    estimatedMinutes: 12,
  },
  {
    title: "Atrial Fibrillation with Multi-Morbidity",
    category: "Cardiovascular",
    clinicalSystem: "Cardiovascular",
    complexityTier: 3,
    difficulty: "advanced" as const,
    mode: "clinician" as const,
    comorbidities: ["Hypertension", "Type 2 diabetes", "CKD stage 3", "Previous TIA"],
    hiddenCues: ["Patient mentions 'I feel a bit wobbly sometimes' — cue to explore falls risk before anticoagulating", "Mentions she stopped her blood pressure tablets as they made her dizzy — cue to explore medication adherence", "Seems overwhelmed by information — cue to check understanding and slow down"],
    iceElements: { ideas: "Thinks her irregular heartbeat is causing her dizziness", concerns: "Very worried about bleeding on blood thinners — her husband bled badly on warfarin", expectations: "Wants to understand all her options before deciding" },
    description: "A 74-year-old female with known AF, hypertension, T2DM, CKD stage 3, and a previous TIA 2 years ago attends for a medication review. Her CHA2DS2-VASc score is 6. She is currently not anticoagulated. She has a HAS-BLED score of 3. Manage the competing risks, address her concerns about bleeding, and optimise her management per NICE NG196 and NG203.",
    patientPersona: `You are Eileen, a 74-year-old retired nurse with AF, high blood pressure, diabetes, mild kidney disease, and a mini-stroke 2 years ago. You are not on blood thinners. You stopped your ramipril 3 months ago because it made you dizzy. You feel wobbly sometimes and have had 2 near-falls. Your husband had a terrible bleed on warfarin and you are very scared of blood thinners. You've heard about newer tablets. You feel overwhelmed when given lots of information at once. You want to understand your options before deciding anything. Start by saying you've come for your medication review.`,
    learningObjectives: ["Calculate CHA2DS2-VASc and HAS-BLED scores and balance stroke vs bleeding risk", "Discuss DOACs with dose adjustment for CKD (NICE NG196)", "Address falls risk as part of anticoagulation decision", "Coordinate multi-morbidity management: AF, hypertension, diabetes, CKD (NICE NG56)"],
    tags: ["AF", "anticoagulation", "multi-morbidity", "CKD", "NICE NG196", "NICE NG56"],
    estimatedMinutes: 15,
  },

  // ─── RESPIRATORY ──────────────────────────────────────────────────────────────
  {
    title: "Asthma Review — Poorly Controlled",
    category: "Respiratory",
    clinicalSystem: "Respiratory",
    complexityTier: 1,
    difficulty: "beginner" as const,
    mode: "clinician" as const,
    comorbidities: [],
    hiddenCues: ["Patient says 'I use my blue inhaler every day' — cue to assess control and step up", "Mentions she uses her inhaler 'before I go to the gym' — cue to explore trigger avoidance"],
    iceElements: { ideas: "Thinks her asthma is just 'a bit worse in winter'", concerns: "Worried about using steroids long-term", expectations: "Wants to know if there is a better inhaler" },
    description: "A 22-year-old female with known asthma attends for her annual review. She uses her salbutamol reliever inhaler daily and has woken at night with wheeze twice in the last month. She is on a low-dose ICS only. Assess control using RCP3 questions, step up treatment per NICE NG80, and check inhaler technique.",
    patientPersona: `You are Aisha, a 22-year-old university student with asthma since childhood. You use your blue (salbutamol) inhaler every day, sometimes twice. You've woken up wheezing twice in the last month. You are on a brown inhaler (beclometasone 100mcg) which you take most days but sometimes forget. You are worried about taking steroids long-term. You exercise regularly and use your blue inhaler before the gym. You haven't had a formal asthma review in 2 years. Start by saying you've come for your asthma check-up.`,
    learningObjectives: ["Assess asthma control using RCP3 questions (NICE NG80)", "Identify poorly controlled asthma and step up to ICS/LABA", "Check inhaler technique and adherence", "Provide written asthma action plan"],
    tags: ["asthma", "respiratory", "NICE NG80", "inhaler", "ICS"],
    estimatedMinutes: 10,
  },
  {
    title: "COPD Exacerbation",
    category: "Respiratory",
    clinicalSystem: "Respiratory",
    complexityTier: 2,
    difficulty: "intermediate" as const,
    mode: "clinician" as const,
    comorbidities: ["COPD", "Ex-smoker"],
    hiddenCues: ["Patient mentions he lives alone — cue to assess social support before deciding on home vs hospital management", "Says 'I've been through worse' — cue to explore previous exacerbation history and self-management"],
    iceElements: { ideas: "Thinks he just needs antibiotics like last time", concerns: "Worried about going to hospital as he has no one to look after his dog", expectations: "Wants to be treated at home" },
    description: "A 67-year-old male with COPD (FEV1 45% predicted) presents with 3 days of increased breathlessness and purulent sputum. O2 sats 91% on air. Assess severity, prescribe appropriately, and determine admission vs home management per NICE NG115.",
    patientPersona: `You are Brian, a 67-year-old ex-smoker with COPD diagnosed 5 years ago. You've had 3 days of worsening breathlessness and green sputum. You are using your salbutamol inhaler every 2 hours. Your home oximeter says 91%. You feel very unwell. You live alone with your dog. You've had 2 previous exacerbations in the last year. You are on tiotropium and salmeterol/fluticasone inhalers. You want to be treated at home. Start by saying you've been struggling to breathe for the last few days.`,
    learningObjectives: ["Assess COPD exacerbation severity using DECAF or clinical criteria (NICE NG115)", "Prescribe antibiotics and oral prednisolone per NICE guidance", "Determine admission vs home management", "Arrange follow-up and review inhaler therapy"],
    tags: ["COPD", "exacerbation", "respiratory", "NICE NG115", "admission decision"],
    estimatedMinutes: 12,
  },
  {
    title: "Breathlessness — Possible Lung Cancer",
    category: "Respiratory",
    clinicalSystem: "Respiratory",
    complexityTier: 3,
    difficulty: "advanced" as const,
    mode: "clinician" as const,
    comorbidities: ["Ex-smoker", "Weight loss", "Haemoptysis"],
    hiddenCues: ["Patient mentions 'I've lost a bit of weight' when asked about appetite — cue to quantify weight loss", "Coughs during the consultation — cue to ask about haemoptysis", "Seems resigned and fatalistic — cue to explore health beliefs and fear of diagnosis"],
    iceElements: { ideas: "Thinks it is just a chest infection or his age", concerns: "Has a strong feeling something serious is wrong but doesn't want to know", expectations: "Came because his wife made him — he is ambivalent about investigation" },
    description: "A 71-year-old male ex-smoker presents with 8 weeks of progressive breathlessness, a new persistent cough, and 5kg unintentional weight loss. He has had one episode of blood-tinged sputum. This is a 2WW lung cancer scenario — practise recognising multiple red flags, managing a patient who is ambivalent about investigation, and making the correct urgent referral per NICE NG12.",
    patientPersona: `You are Ron, a 71-year-old retired lorry driver. You've been getting more breathless over the last 2 months and you've had a new cough that won't go away. Your wife noticed you've lost weight — probably about 5kg. You had some blood in your spit once last week. You smoked 30 a day for 40 years and stopped 3 years ago. You feel like something is seriously wrong but you don't want to know. Your wife made you come. You are fatalistic — 'what will be will be.' When the doctor asks about your concerns, you eventually admit you think it might be cancer. Start by saying your wife made you come because of your cough and breathlessness.`,
    learningObjectives: ["Identify multiple 2WW red flags for lung cancer (NICE NG12)", "Manage a patient ambivalent about investigation sensitively", "Arrange urgent CXR and 2WW referral to respiratory team", "Address patient's health beliefs and fears without being dismissive"],
    tags: ["lung cancer", "2WW", "NICE NG12", "haemoptysis", "weight loss", "red flags"],
    estimatedMinutes: 15,
  },

  // ─── MENTAL HEALTH ────────────────────────────────────────────────────────────
  {
    title: "Anxiety Disorder Assessment",
    category: "Mental Health",
    clinicalSystem: "Mental Health",
    complexityTier: 1,
    difficulty: "beginner" as const,
    mode: "clinician" as const,
    comorbidities: [],
    hiddenCues: ["Patient presents with palpitations — cue to consider anxiety as a cause before ordering cardiac investigations", "Mentions 'I've been to A&E twice' — cue to explore health anxiety"],
    iceElements: { ideas: "Convinced she has a heart problem", concerns: "Worried medication will affect her fertility", expectations: "Wants a talking therapy, not tablets" },
    description: "A 26-year-old female presents with a 3-month history of excessive worry, palpitations, and difficulty sleeping. She has been to A&E twice with normal ECGs. GAD-7 score 14. Assess for GAD, rule out organic causes, and discuss management per NICE CG113.",
    patientPersona: `You are Sophie, a 26-year-old primary school teacher. You've had palpitations, feeling on edge, and poor sleep for 3 months. You are convinced something is wrong with your heart despite two normal A&E ECGs. You worry excessively about work, health, and family. You are trying to conceive and don't want medication. You would prefer therapy. Start by saying you've been having palpitations and you're worried about your heart.`,
    learningObjectives: ["Differentiate GAD from cardiac causes (NICE CG113)", "Use GAD-7 to quantify severity", "Discuss CBT as first-line treatment", "Address health anxiety without reinforcing avoidance"],
    tags: ["anxiety", "GAD", "mental health", "NICE CG113", "palpitations"],
    estimatedMinutes: 10,
  },
  {
    title: "Depression with Somatic Presentation",
    category: "Mental Health",
    clinicalSystem: "Mental Health",
    complexityTier: 2,
    difficulty: "intermediate" as const,
    mode: "clinician" as const,
    comorbidities: ["Anxiety", "Chronic back pain"],
    hiddenCues: ["Patient presents with back pain but seems flat and tearful — cue to screen for depression", "Mentions 'I just don't see the point anymore' — cue to explore suicidal ideation", "Has had 6 GP appointments in 3 months for physical symptoms — cue to consider somatisation"],
    iceElements: { ideas: "Believes the back pain is causing all his problems", concerns: "Worried he will lose his job if he can't work", expectations: "Wants a sick note and a scan for his back" },
    description: "A 44-year-old male presents with persistent back pain for 3 months. He has had 6 appointments for various physical complaints. He appears flat and tearful. PHQ-9 score 18. This scenario tests the clinician's ability to detect depression presenting somatically, explore the psychosocial context, and manage the patient's expectation of a purely physical solution.",
    patientPersona: `You are Steve, a 44-year-old warehouse worker. You've had back pain for 3 months and you've been to the GP several times for it and other symptoms. You feel exhausted, you've lost interest in everything, and you said to your wife last week 'I don't see the point anymore.' When the doctor asks about your mood, you initially deflect back to the back pain. If they persist gently, you open up about feeling hopeless and worthless. You are worried about losing your job. You want a scan and a sick note. You have not thought about harming yourself. Start by asking for a sick note for your back.`,
    learningObjectives: ["Detect depression presenting with somatic symptoms", "Use PHQ-9 and assess suicide risk sensitively", "Manage patient expectations about physical investigations", "Formulate a biopsychosocial management plan"],
    tags: ["depression", "somatic", "PHQ-9", "NICE NG222", "back pain", "somatisation"],
    estimatedMinutes: 15,
  },
  {
    title: "Anxiety-Driven Abdominal Pain — Comorbidity Cross-Reference",
    category: "Mental Health",
    clinicalSystem: "Mental Health",
    complexityTier: 3,
    difficulty: "advanced" as const,
    mode: "clinician" as const,
    comorbidities: ["Generalised Anxiety Disorder", "IBS", "Health anxiety"],
    hiddenCues: ["Patient describes abdominal pain that is worse before stressful events — cue to link anxiety to gut symptoms", "Mentions she has been Googling her symptoms — cue to explore health anxiety and catastrophising", "Seems relieved when the doctor acknowledges the mind-body connection — cue to build on this"],
    iceElements: { ideas: "Convinced she has bowel cancer or Crohn's disease", concerns: "Terrified of having a colonoscopy", expectations: "Wants to be referred to a gastroenterologist and have a scan" },
    description: "A 34-year-old female with known GAD presents with a 4-month history of intermittent abdominal pain, bloating, and altered bowel habit. She has been extensively Googling her symptoms and is convinced she has bowel cancer. This scenario tests the clinician's ability to cross-reference anxiety and gut symptoms, apply the Rome IV criteria for IBS, manage health anxiety, and avoid unnecessary investigation while maintaining safety.",
    patientPersona: `You are Rachel, a 34-year-old marketing manager with known anxiety. You've had abdominal pain, bloating, and your bowels have been unpredictable for 4 months. You've been Googling and you are convinced it is bowel cancer or Crohn's disease. You notice the pain is worse before big presentations at work or when you are stressed, but you haven't connected this to your anxiety. You are terrified of having a colonoscopy. You want a referral and a scan. If the doctor explains the gut-brain connection clearly and kindly, you are initially resistant but gradually open to it. You have no red flag symptoms. Start by saying you've had terrible stomach pain for months and you're worried it's something serious.`,
    learningObjectives: ["Apply Rome IV criteria for IBS and differentiate from organic pathology", "Recognise and address the gut-brain axis in anxiety-driven abdominal symptoms", "Manage health anxiety without dismissing the patient's concerns", "Avoid unnecessary investigation while maintaining appropriate safety-netting"],
    tags: ["IBS", "anxiety", "abdominal pain", "health anxiety", "gut-brain axis", "comorbidity"],
    estimatedMinutes: 15,
  },

  // ─── ENDOCRINOLOGY ────────────────────────────────────────────────────────────
  {
    title: "Type 2 Diabetes Annual Review",
    category: "Endocrinology",
    clinicalSystem: "Endocrinology",
    complexityTier: 1,
    difficulty: "beginner" as const,
    mode: "clinician" as const,
    comorbidities: ["Type 2 diabetes"],
    hiddenCues: ["Patient mentions she's been more thirsty — cue to explore hyperglycaemia symptoms", "Hesitates when asked about her diet — cue to explore dietary habits without judgement"],
    iceElements: { ideas: "Thinks her diabetes is well controlled because she feels OK", concerns: "Worried about her kidneys as her mother had kidney failure", expectations: "Wants to know if her medication needs changing" },
    description: "A 64-year-old female with T2DM presents for her annual review. HbA1c 72 mmol/mol on metformin 1g BD. Urine dip shows microalbuminuria. Review glycaemic control, address the renal finding, and update her management plan per NICE NG28.",
    patientPersona: `You are Margaret, a 64-year-old woman with Type 2 diabetes for 8 years. You are on metformin 1g twice daily. You've been more thirsty recently. You are worried about your kidneys as your mother had kidney failure. You are open to new medication but worried about side effects. You admit to eating more carbohydrates since retiring. Start by saying you've come for your yearly diabetes check.`,
    learningObjectives: ["Interpret HbA1c and identify need for intensification (NICE NG28)", "Assess and address microalbuminuria", "Discuss SGLT2 inhibitor or GLP-1 agonist options", "Complete annual review checklist: eyes, feet, kidneys, BP, lipids"],
    tags: ["diabetes", "HbA1c", "NICE NG28", "annual review", "microalbuminuria"],
    estimatedMinutes: 12,
  },
  {
    title: "Hypothyroidism — Suboptimal Treatment",
    category: "Endocrinology",
    clinicalSystem: "Endocrinology",
    complexityTier: 2,
    difficulty: "intermediate" as const,
    mode: "clinician" as const,
    comorbidities: ["Hypothyroidism", "Depression"],
    hiddenCues: ["Patient mentions fatigue and weight gain — cue to check if these are thyroid or depression symptoms", "Mentions she takes her thyroxine 'whenever I remember' — cue to explore adherence", "Seems low in mood — cue to screen for depression as a comorbidity"],
    iceElements: { ideas: "Thinks her tiredness is because her thyroid tablets aren't working", concerns: "Worried she might have depression on top of her thyroid problem", expectations: "Wants her thyroxine dose increased" },
    description: "A 48-year-old female with hypothyroidism on levothyroxine 100mcg presents with persistent fatigue, weight gain, and low mood. Her TSH is 8.2 mIU/L (elevated). She admits to erratic adherence. PHQ-9 score 12. This scenario tests the clinician's ability to differentiate hypothyroid symptoms from depression, address adherence, and avoid over-medicalising.",
    patientPersona: `You are Linda, a 48-year-old office manager with hypothyroidism. You've been exhausted, you've gained 4kg in 3 months, and you've been feeling very low. You take your thyroxine tablets but not always at the right time — sometimes you forget for a few days. You think your dose needs increasing. When the doctor asks about your mood, you admit you've been crying a lot and feeling hopeless. You are worried you might have depression on top of your thyroid problem. Start by saying you've been exhausted and you think your thyroid tablets aren't working.`,
    learningObjectives: ["Interpret TSH and adjust levothyroxine dose appropriately", "Address medication adherence without judgement", "Screen for depression as a comorbidity using PHQ-9", "Differentiate hypothyroid symptoms from depressive symptoms"],
    tags: ["hypothyroidism", "levothyroxine", "TSH", "depression", "adherence"],
    estimatedMinutes: 12,
  },
  {
    title: "Diabetic Ketoacidosis Risk — Complex T1DM",
    category: "Endocrinology",
    clinicalSystem: "Endocrinology",
    complexityTier: 3,
    difficulty: "advanced" as const,
    mode: "clinician" as const,
    comorbidities: ["Type 1 diabetes", "Eating disorder", "Depression"],
    hiddenCues: ["Patient mentions she has been 'cutting back on insulin to lose weight' — cue to recognise diabulimia", "Seems evasive about her eating habits — cue to explore eating disorder", "HbA1c of 98 mmol/mol — cue to recognise extremely poor control and DKA risk"],
    iceElements: { ideas: "Knows her control is bad but doesn't understand why she can't manage it", concerns: "Terrified of gaining weight on insulin", expectations: "Wants help but is ashamed and scared of being judged" },
    description: "A 19-year-old female with Type 1 diabetes presents with HbA1c 98 mmol/mol, recurrent DKA admissions, and weight loss. She has been deliberately omitting insulin to control her weight (diabulimia). This complex scenario tests the clinician's ability to recognise diabulimia, manage the intersection of T1DM and eating disorder, assess DKA risk, and refer appropriately without alienating a vulnerable patient.",
    patientPersona: `You are Zara, a 19-year-old student with Type 1 diabetes since age 10. You've had 3 DKA admissions in the last year. You've been deliberately not taking your full insulin dose because you gained weight when your control improved. You know this is dangerous but you feel out of control. You are ashamed and scared of being judged. You are also quite low in mood. You are evasive about your eating habits. If the doctor is non-judgemental and shows genuine concern, you gradually open up. If they are critical or lecture you, you shut down. Start by saying you've come because your diabetes nurse told you to see the GP about your HbA1c.`,
    learningObjectives: ["Recognise diabulimia and its life-threatening risks", "Manage the intersection of T1DM and eating disorder sensitively", "Assess immediate DKA risk and safety-net appropriately", "Refer to specialist diabetes team and eating disorder service"],
    tags: ["T1DM", "diabulimia", "eating disorder", "DKA", "complex", "vulnerable patient"],
    estimatedMinutes: 15,
  },

  // ─── MUSCULOSKELETAL ──────────────────────────────────────────────────────────
  {
    title: "Acute Lower Back Pain",
    category: "Musculoskeletal",
    clinicalSystem: "Musculoskeletal",
    complexityTier: 1,
    difficulty: "beginner" as const,
    mode: "clinician" as const,
    comorbidities: [],
    hiddenCues: ["Patient asks for a scan — cue to manage expectations about imaging", "Mentions he has been off work for a week — cue to address occupational impact and provide fit note"],
    iceElements: { ideas: "Thinks he has slipped a disc", concerns: "Worried he will need surgery", expectations: "Wants a scan and strong painkillers" },
    description: "A 38-year-old male presents with 5 days of acute lower back pain after lifting at work. No red flags. Assess for red flags, provide evidence-based advice, and manage expectations about imaging and analgesia per NICE NG59.",
    patientPersona: `You are Mark, a 38-year-old builder who hurt his back lifting heavy materials 5 days ago. The pain is in your lower back and doesn't go down your legs. You've been off work. You think you've slipped a disc and want a scan. You are worried you might need surgery. You have no bladder or bowel problems, no fever, no weight loss. You are taking ibuprofen which helps a bit. Start by saying you've hurt your back at work and you need a scan.`,
    learningObjectives: ["Screen for red flags in acute back pain (NICE NG59)", "Advise on staying active and avoiding bed rest", "Prescribe analgesia appropriately", "Manage expectations about imaging and provide fit note"],
    tags: ["back pain", "MSK", "NICE NG59", "red flags", "analgesia"],
    estimatedMinutes: 8,
  },
  {
    title: "Knee Pain — Osteoarthritis Management",
    category: "Musculoskeletal",
    clinicalSystem: "Musculoskeletal",
    complexityTier: 2,
    difficulty: "intermediate" as const,
    mode: "clinician" as const,
    comorbidities: ["Obesity", "Hypertension"],
    hiddenCues: ["Patient mentions she has stopped going for walks because of the pain — cue to address activity avoidance and deconditioning", "Seems low in mood when discussing her mobility — cue to screen for depression"],
    iceElements: { ideas: "Thinks she needs a knee replacement", concerns: "Worried she will end up in a wheelchair", expectations: "Wants to be referred for surgery" },
    description: "A 62-year-old obese female with hypertension presents with 18 months of bilateral knee pain worse on stairs. X-ray shows moderate OA changes. She has stopped exercising. Manage her OA per NICE NG226, address weight, and discuss the role of physiotherapy before considering surgical referral.",
    patientPersona: `You are Barbara, a 62-year-old retired teacher with painful knees for 18 months. The pain is worse going up stairs. You've stopped walking because it hurts. You are overweight (BMI 34). You have high blood pressure. You think you need a knee replacement and want to be referred. You are worried you will end up unable to walk. When the doctor suggests exercise, you are initially resistant — 'it hurts to move.' If they explain the evidence clearly, you are open to trying. Start by saying your knees are getting worse and you want to be referred for a knee replacement.`,
    learningObjectives: ["Diagnose and stage knee OA using clinical and radiological findings (NICE NG226)", "Discuss non-surgical management: exercise, weight loss, physiotherapy, analgesia", "Address activity avoidance and deconditioning", "Set appropriate expectations about surgical referral criteria"],
    tags: ["osteoarthritis", "knee pain", "MSK", "NICE NG226", "weight management"],
    estimatedMinutes: 12,
  },
  {
    title: "Inflammatory Arthritis — Possible RA",
    category: "Musculoskeletal",
    clinicalSystem: "Musculoskeletal",
    complexityTier: 3,
    difficulty: "advanced" as const,
    mode: "clinician" as const,
    comorbidities: ["Possible RA", "Fatigue", "Anaemia"],
    hiddenCues: ["Patient mentions morning stiffness lasting over an hour — key diagnostic cue for inflammatory arthritis", "Mentions her mother had 'bad arthritis' — cue to explore family history of RA", "Seems anxious about the implications for her job as a pianist — cue to address occupational concerns"],
    iceElements: { ideas: "Thinks she has the same arthritis as her mother", concerns: "Terrified she will lose the use of her hands and can't play piano", expectations: "Wants to be referred quickly and to know what she is dealing with" },
    description: "A 42-year-old female pianist presents with a 3-month history of symmetrical small joint swelling in her hands and feet, morning stiffness lasting 90 minutes, and fatigue. CRP 28, RF positive. This scenario tests the clinician's ability to recognise early RA, arrange appropriate urgent investigations, and make a timely rheumatology referral per NICE NG100.",
    patientPersona: `You are Claire, a 42-year-old professional pianist. You've had painful, swollen joints in your fingers and toes for 3 months. Your hands are very stiff in the morning for about 90 minutes. You are exhausted. Your mother had rheumatoid arthritis and lost the use of her hands. You are terrified the same will happen to you. Your job depends on your hands. You want to be referred urgently. Start by saying you've had painful swollen joints for 3 months and you're worried it might be rheumatoid arthritis.`,
    learningObjectives: ["Recognise early inflammatory arthritis and differentiate from OA", "Arrange appropriate investigations: RF, anti-CCP, CRP, FBC, X-rays", "Make an urgent rheumatology referral per NICE NG100 (within 3 weeks)", "Address occupational concerns and provide interim analgesia"],
    tags: ["rheumatoid arthritis", "inflammatory arthritis", "NICE NG100", "urgent referral", "MSK"],
    estimatedMinutes: 12,
  },

  // ─── DERMATOLOGY ─────────────────────────────────────────────────────────────
  {
    title: "Eczema Management in a Child",
    category: "Dermatology",
    clinicalSystem: "Dermatology",
    complexityTier: 1,
    difficulty: "beginner" as const,
    mode: "clinician" as const,
    comorbidities: [],
    hiddenCues: ["Parent mentions the child is scratching at night — cue to address sleep disturbance and impact on family", "Parent seems stressed and guilty — cue to acknowledge parental burden"],
    iceElements: { ideas: "Thinks the eczema is caused by food allergy", concerns: "Worried about using steroids on her child's skin", expectations: "Wants to know if there is a non-steroid treatment" },
    description: "A mother brings her 4-year-old son with moderate eczema affecting his arms and behind his knees. He is scratching at night. She is worried about steroid use. Assess severity, prescribe appropriately, and provide clear emollient and steroid ladder advice per NICE NG190.",
    patientPersona: `You are the mother of Jake, a 4-year-old boy with eczema on his arms and behind his knees. He scratches at night and it's affecting his sleep and yours. You are worried about putting steroids on his skin — you've read they thin the skin. You think it might be a food allergy. You want a non-steroid treatment if possible. Start by saying Jake's eczema has been really bad lately and you're worried about using the steroid cream.`,
    learningObjectives: ["Assess eczema severity using EASI or IGA score (NICE NG190)", "Prescribe emollients and topical steroids at appropriate potency", "Address parental steroid phobia with evidence-based reassurance", "Advise on trigger avoidance and when to seek help"],
    tags: ["eczema", "dermatology", "NICE NG190", "paediatric", "topical steroids"],
    estimatedMinutes: 10,
  },
  {
    title: "Suspicious Skin Lesion — Possible Melanoma",
    category: "Dermatology",
    clinicalSystem: "Dermatology",
    complexityTier: 2,
    difficulty: "intermediate" as const,
    mode: "clinician" as const,
    comorbidities: ["Fair skin", "History of sunburn"],
    hiddenCues: ["Patient mentions the mole 'has changed colour' — key ABCDE cue", "Mentions he works outdoors — cue to explore UV exposure history", "Seems dismissive of the lesion — cue to manage his minimisation without causing panic"],
    iceElements: { ideas: "Thinks it is just an age spot", concerns: "Worried about having a biopsy", expectations: "Wants to be told it is nothing serious" },
    description: "A 55-year-old male presents with a changing pigmented lesion on his back noticed by his wife. It has irregular borders, mixed colour, and is 8mm. He works outdoors. Apply the ABCDE criteria, assess urgency, and manage the 2WW referral per NICE NG12 while handling the patient's minimisation.",
    patientPersona: `You are Paul, a 55-year-old farmer. Your wife noticed a mole on your back has changed. You think it's just an age spot. You've worked outdoors all your life and had lots of sunburn as a kid. You are dismissive of the lesion but your wife made you come. You are worried about having a biopsy. When the doctor explains the ABCDE criteria and why they are concerned, you become more anxious. Start by saying your wife made you come about a mole on your back.`,
    learningObjectives: ["Apply ABCDE criteria to assess a suspicious pigmented lesion", "Identify features requiring urgent 2WW referral (NICE NG12)", "Manage patient minimisation without causing unnecessary panic", "Advise on sun protection and self-examination"],
    tags: ["melanoma", "skin cancer", "2WW", "NICE NG12", "ABCDE", "dermatology"],
    estimatedMinutes: 10,
  },
  {
    title: "Psoriasis with Psoriatic Arthritis — Comorbidity",
    category: "Dermatology",
    clinicalSystem: "Dermatology",
    complexityTier: 3,
    difficulty: "advanced" as const,
    mode: "clinician" as const,
    comorbidities: ["Psoriasis", "Psoriatic arthritis", "Metabolic syndrome"],
    hiddenCues: ["Patient mentions joint pain in his fingers — cue to screen for psoriatic arthritis", "Mentions he has been drinking more alcohol to cope with the stress of his skin — cue to address alcohol use", "Seems embarrassed about his skin — cue to explore psychological impact"],
    iceElements: { ideas: "Thinks his joint pain is separate from his skin condition", concerns: "Worried his psoriasis will never get better and is affecting his relationships", expectations: "Wants a stronger treatment for his skin" },
    description: "A 45-year-old male with moderate-severe plaque psoriasis presents with worsening skin and new onset finger joint pain and morning stiffness. He has metabolic syndrome. This scenario tests the clinician's ability to recognise psoriatic arthritis as a comorbidity of psoriasis, assess the full systemic burden, and coordinate dermatology and rheumatology referrals per NICE NG65.",
    patientPersona: `You are Kevin, a 45-year-old IT manager with psoriasis for 15 years. Your skin has been much worse recently — large plaques on your elbows, knees, and scalp. You've also had painful, swollen fingers and morning stiffness for 2 months but you thought it was unrelated. You drink about 25 units of alcohol per week to cope with stress. You are overweight with high blood pressure and high cholesterol. You are embarrassed about your skin and it's affecting your relationships. You want stronger treatment. Start by saying your psoriasis is the worst it's ever been and you want something stronger.`,
    learningObjectives: ["Recognise psoriatic arthritis as a comorbidity of psoriasis (NICE NG65)", "Assess the full systemic burden: metabolic syndrome, cardiovascular risk", "Coordinate dermatology and rheumatology referrals", "Address alcohol use and its impact on psoriasis"],
    tags: ["psoriasis", "psoriatic arthritis", "dermatology", "NICE NG65", "comorbidity", "metabolic syndrome"],
    estimatedMinutes: 15,
  },

  // ─── NEUROLOGY ────────────────────────────────────────────────────────────────
  {
    title: "Headache — Tension Type vs Migraine",
    category: "Neurology",
    clinicalSystem: "Neurology",
    complexityTier: 1,
    difficulty: "beginner" as const,
    mode: "clinician" as const,
    comorbidities: [],
    hiddenCues: ["Patient mentions she takes paracetamol every day — cue to identify medication overuse headache", "Mentions the headaches are worse before her period — cue to explore menstrual migraine"],
    iceElements: { ideas: "Thinks she has tension headaches from stress", concerns: "Worried it might be a brain tumour", expectations: "Wants a scan to rule out anything serious" },
    description: "A 28-year-old female presents with a 6-month history of frequent headaches. She takes paracetamol daily. Some headaches are unilateral with nausea. Differentiate tension-type headache from migraine, identify medication overuse headache, and manage per NICE NG150.",
    patientPersona: `You are Hannah, a 28-year-old nurse. You've had headaches almost every day for 6 months. Some are a dull band around your head, but some are one-sided with nausea and light sensitivity. You take paracetamol every day. You are worried it might be a brain tumour and want a scan. You are under a lot of stress at work. Start by saying you've been having terrible headaches for months and you want to know what's causing them.`,
    learningObjectives: ["Differentiate tension-type headache, migraine, and medication overuse headache (NICE NG150)", "Identify and address medication overuse headache", "Prescribe appropriate acute and preventive migraine treatment", "Manage health anxiety about brain tumour without unnecessary scanning"],
    tags: ["headache", "migraine", "neurology", "NICE NG150", "medication overuse"],
    estimatedMinutes: 10,
  },
  {
    title: "Possible TIA — Urgent Assessment",
    category: "Neurology",
    clinicalSystem: "Neurology",
    complexityTier: 2,
    difficulty: "intermediate" as const,
    mode: "clinician" as const,
    comorbidities: ["Hypertension", "Hyperlipidaemia", "Smoker"],
    hiddenCues: ["Patient minimises symptoms — 'it only lasted a few minutes' — cue to recognise TIA as a medical emergency", "Mentions he drove himself to the appointment — cue to address DVLA driving restriction"],
    iceElements: { ideas: "Thinks it was just a funny turn or low blood sugar", concerns: "Worried about losing his driving licence", expectations: "Wants to be told he can go home and it's nothing serious" },
    description: "A 65-year-old male smoker with hypertension presents with a 20-minute episode of right-sided weakness and slurred speech 4 hours ago that fully resolved. He drove himself to the appointment. Recognise TIA as a medical emergency, calculate ABCD2 score, arrange same-day TIA clinic referral, and address driving per NICE NG128.",
    patientPersona: `You are Colin, a 65-year-old lorry driver with high blood pressure and high cholesterol. You had a funny turn this morning — your right arm felt weak and your speech was a bit slurred for about 20 minutes, then it went away. You drove yourself to the GP. You think it was probably low blood sugar or a funny turn. You are worried about losing your driving licence. When the doctor explains it might be a mini-stroke, you are shocked and resistant. Start by saying you had a funny turn this morning but you feel fine now.`,
    learningObjectives: ["Recognise TIA and calculate ABCD2 score (NICE NG128)", "Arrange same-day TIA clinic referral for high-risk patients", "Address DVLA driving restriction and document this", "Initiate aspirin and manage cardiovascular risk factors"],
    tags: ["TIA", "stroke", "neurology", "NICE NG128", "ABCD2", "DVLA"],
    estimatedMinutes: 12,
  },

  // ─── PAEDIATRICS ──────────────────────────────────────────────────────────────
  {
    title: "Febrile Child — Fever Assessment",
    category: "Paediatrics",
    clinicalSystem: "Paediatrics",
    complexityTier: 1,
    difficulty: "beginner" as const,
    mode: "clinician" as const,
    comorbidities: [],
    hiddenCues: ["Parent mentions the child has a non-blanching rash on her leg — critical safety cue for meningococcal disease", "Parent seems very anxious — cue to acknowledge parental concern while acting on the red flag"],
    iceElements: { ideas: "Thinks it is a viral infection", concerns: "Worried it might be meningitis after reading about it online", expectations: "Wants to be reassured it is nothing serious" },
    description: "A mother brings her 18-month-old daughter with a 24-hour history of fever (39.2°C), irritability, and reduced feeding. The child has a non-blanching petechial rash on her left leg. This scenario tests the clinician's ability to recognise a potential red flag for meningococcal disease, act urgently, and manage parental anxiety per NICE NG143.",
    patientPersona: `You are the mother of Lily, an 18-month-old girl. Lily has had a fever of 39.2°C since yesterday, she's been very grumpy, and she's not feeding well. You noticed a small rash on her leg this morning. You've been Googling and you're worried about meningitis. You are very anxious. You think it's probably just a virus. Start by saying Lily has had a fever and you're worried about her.`,
    learningObjectives: ["Recognise non-blanching rash as a red flag for meningococcal disease (NICE NG143)", "Apply the traffic light system for febrile illness in children", "Act urgently: IV/IM benzylpenicillin and 999 transfer", "Manage parental anxiety while taking decisive action"],
    tags: ["paediatrics", "fever", "meningitis", "NICE NG143", "red flags", "non-blanching rash"],
    estimatedMinutes: 10,
  },
  {
    title: "ADHD Assessment — Child",
    category: "Paediatrics",
    clinicalSystem: "Paediatrics",
    complexityTier: 2,
    difficulty: "intermediate" as const,
    mode: "clinician" as const,
    comorbidities: ["Possible ADHD", "Anxiety"],
    hiddenCues: ["Parent mentions the child is also anxious — cue to consider anxiety as a comorbidity or differential", "Parent seems exhausted and at breaking point — cue to acknowledge carer burden", "Mentions school has raised concerns — cue to request school reports as collateral history"],
    iceElements: { ideas: "Convinced her son has ADHD and needs medication", concerns: "Worried about the stigma of an ADHD diagnosis", expectations: "Wants a referral for assessment and possibly medication" },
    description: "A mother brings her 8-year-old son who has been struggling at school with concentration, impulsivity, and disruptive behaviour for 2 years. His teacher has raised concerns. The mother wants an ADHD assessment and medication. Assess for ADHD, consider differentials, and manage the referral pathway per NICE NG87.",
    patientPersona: `You are the mother of Ethan, an 8-year-old boy. Ethan has been struggling at school for 2 years — he can't concentrate, he's impulsive, and he disrupts the class. His teacher has written to you about it. You are exhausted. You are convinced he has ADHD and you want him assessed and possibly medicated. You are also a bit worried about the stigma of a diagnosis. Ethan is also quite anxious. Start by saying Ethan has been really struggling at school and you think he has ADHD.`,
    learningObjectives: ["Assess for ADHD using DSM-5 criteria and collateral history (NICE NG87)", "Consider differentials: anxiety, learning difficulties, family stress", "Explain the CAMHS referral pathway and what to expect", "Support the family while awaiting assessment"],
    tags: ["ADHD", "paediatrics", "NICE NG87", "CAMHS", "school", "behaviour"],
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

        // ─── Fetch submitted SOAP notes for clinician mode ──────────────────────
        let notesSection = "";
        let sessionNotesData = null;
        if (isClinician) {
          sessionNotesData = await getSessionNoteBySessionId(input.sessionId);
          if (sessionNotesData) {
            const parts = [];
            if (sessionNotesData.subjective) parts.push(`S (Subjective): ${sessionNotesData.subjective}`);
            if (sessionNotesData.objective) parts.push(`O (Objective): ${sessionNotesData.objective}`);
            if (sessionNotesData.assessment) parts.push(`A (Assessment): ${sessionNotesData.assessment}`);
            if (sessionNotesData.plan) parts.push(`P (Plan): ${sessionNotesData.plan}`);
            if (parts.length > 0) {
              notesSection = `\n\n--- CLINICIAN'S SUBMITTED SOAP NOTES ---\n${parts.join("\n")}\n--- END OF NOTES ---`;
            }
          }
        }

        // ─── Build mode-specific evaluation prompt ─────────────────────────────
        const systemPrompt = isClinician
          ? `You are an experienced GP trainer and RCGP assessor evaluating a GP registrar or GP's performance in a simulated patient consultation. You must be fair, evidence-based, and constructive in your feedback. You are assessing against the RCGP curriculum competency framework.

The consultation scenario was: "${scenario.title}" — ${scenario.description}${contextSection}${notesSection}

Evaluate the clinician's performance across exactly these SEVEN competencies, scoring each from 1.0 to 5.0 (decimals allowed):

1. Active Listening and Empathy — Did the clinician use patient-centred consulting techniques? Did they demonstrate genuine empathy, acknowledge the patient's emotional state, and create a safe space for the patient to speak?

2. ICE Elicitation (Ideas, Concerns, Expectations) — This is a CRITICAL RCGP competency. Did the clinician explicitly explore:
   - IDEAS: What the patient thinks is causing their problem?
   - CONCERNS: What the patient is most worried about?
   - EXPECTATIONS: What the patient hopes to get from this consultation?
   Failure to elicit ICE should significantly lower this score. Partial elicitation (e.g. only asking about concerns) should score 2.5-3.5. Full ICE elicitation with integration into the management plan scores 4.0+.

3. Cue Detection & Response — Did the clinician pick up on verbal and non-verbal cues the patient dropped? Examples include: a patient mentioning a family member with the same condition (fear of serious illness), a patient hesitating before answering (possible concealment), a patient mentioning a lifestyle factor unprompted (relevant comorbidity cue), or a patient using minimising language ("it's probably nothing"). Did the clinician follow up on these cues sensitively?

4. Clinical Reasoning & Comorbidity Cross-Reference — Did the clinician:
   - Take a systematic history and form an appropriate differential diagnosis?
   - Recognise and cross-reference relevant comorbidities (e.g. anxiety driving somatic symptoms, diabetes complicating infection, depression co-existing with physical illness)?
   - Ask appropriate red flag questions?
   - Demonstrate sound clinical reasoning in their management plan?

5. NICE Guideline Adherence — Did the clinician follow NICE guidelines and evidence-based practice? Were investigations, prescribing, referral decisions, and validated scoring tools (e.g. PHQ-9, GAD-7, CHA2DS2-VASc, QRISK3, ABCD2) used appropriately?

6. Communication Clarity — Were explanations clear, jargon-free, and tailored to the patient's level of understanding? Did the clinician use the "teach-back" technique or check understanding? Did the patient leave knowing their diagnosis, management plan, and what to do next?

7. Safety-Netting & Documentation Quality — Two components:
   a) Safety-netting: Did the clinician provide specific, actionable safety-netting advice (exact red flags to watch for, when to call 999, when to re-attend)? Vague safety-netting ("come back if you're worried") should score lower than specific safety-netting ("if you develop chest pain at rest lasting more than 15 minutes, call 999 immediately").
   b) Documentation: If SOAP notes were submitted, assess their quality — are they accurate, complete, structured, and do they reflect what happened in the consultation? Do they include appropriate safety-netting and follow-up plans? If no notes were submitted, score this component at 1.0.

Scoring guide:
1.0-2.0: Poor — significant clinical or communication failures, patient safety may be compromised
2.1-3.0: Below average — some effort but key gaps in clinical reasoning, NICE adherence, or safety-netting
3.1-3.9: Competent — adequate performance with room to improve
4.0-4.5: Good — strong clinical and communication skills with minor gaps
4.6-5.0: Excellent — exemplary consultation, NICE-concordant management, and robust safety-netting

Return your assessment as JSON.`
          : `You are an expert GP surgery training assessor evaluating a receptionist's performance in a simulated patient call. You must be fair, constructive, and specific in your feedback.\n\nThe scenario was: "${scenario.title}" — ${scenario.description}${contextSection}\nEvaluate the receptionist's performance across exactly these five competencies, scoring each from 1.0 to 5.0 (decimals allowed):\n\n1. Active Listening and Empathy — Did the receptionist acknowledge the patient's feelings, use empathetic language, and demonstrate they were truly listening?\n2. Information Gathering — Did the receptionist ask relevant questions to understand the patient's needs, including any red flag symptoms or identity verification where appropriate?\n3. Policy Adherence — Did the receptionist correctly follow GP surgery policies (e.g., triage process, Pharmacy First, zero-tolerance, confidentiality, DNA policy)?\n4. Communication Clarity — Were explanations clear, jargon-free, and easy to understand? Did the patient leave the call knowing what to do next?\n5. De-escalation — Did the receptionist remain calm, manage tension effectively, and de-escalate any frustration or distress?\n\nScoring guide:\n1.0-2.0: Poor — significant failures, patient likely left worse off\n2.1-3.0: Below average — some effort but key gaps\n3.1-3.9: Competent — adequate performance with room to improve\n4.0-4.5: Good — strong performance with minor gaps\n4.6-5.0: Excellent — exemplary practice\n\nReturn your assessment as JSON.`;

        const userPrompt = isClinician
          ? `Here is the full transcript of the consultation:\n\n${transcript}${notesSection ? "\n\n(SOAP notes have been included in the system prompt above)" : "\n\n(No SOAP notes were submitted by the clinician)"}\n\nPlease evaluate the clinician's performance across all seven RCGP competencies.`
          : `Here is the full transcript of the call:\n\n${transcript}\n\nPlease evaluate the receptionist's performance.`;

        const evaluationResponse = await invokeLLM({
          model: process.env.LLM_MODEL || "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: isClinician ? {
            type: "json_schema" as const,
            json_schema: {
              name: "clinician_evaluation_result",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  activeListeningEmpathy: { type: "number", description: "Score 1.0-5.0" },
                  iceElicitation: { type: "number", description: "Score 1.0-5.0 for ICE elicitation" },
                  cueDetection: { type: "number", description: "Score 1.0-5.0 for verbal/non-verbal cue detection" },
                  clinicalReasoning: { type: "number", description: "Score 1.0-5.0 for clinical reasoning and comorbidity cross-reference" },
                  niceAdherence: { type: "number", description: "Score 1.0-5.0 for NICE guideline adherence" },
                  communicationClarity: { type: "number", description: "Score 1.0-5.0" },
                  safetyNettingDocumentation: { type: "number", description: "Score 1.0-5.0 for safety-netting and documentation quality" },
                  wentWell: { type: "string", description: "2-3 sentences on what the clinician did well" },
                  areasForImprovement: { type: "string", description: "2-3 sentences on specific areas to improve" },
                  activeListeningEmpathyFeedback: { type: "string", description: "Specific feedback" },
                  iceElicitationFeedback: { type: "string", description: "Specific feedback on ICE elicitation — was it done? What was missed?" },
                  cueDetectionFeedback: { type: "string", description: "Specific feedback on cues detected or missed" },
                  clinicalReasoningFeedback: { type: "string", description: "Specific feedback on clinical reasoning and comorbidity handling" },
                  niceAdherenceFeedback: { type: "string", description: "Specific feedback on NICE guideline adherence" },
                  communicationClarityFeedback: { type: "string", description: "Specific feedback" },
                  safetyNettingDocumentationFeedback: { type: "string", description: "Specific feedback on safety-netting and documentation quality" },
                },
                required: [
                  "activeListeningEmpathy", "iceElicitation", "cueDetection", "clinicalReasoning",
                  "niceAdherence", "communicationClarity", "safetyNettingDocumentation",
                  "wentWell", "areasForImprovement",
                  "activeListeningEmpathyFeedback", "iceElicitationFeedback", "cueDetectionFeedback",
                  "clinicalReasoningFeedback", "niceAdherenceFeedback", "communicationClarityFeedback",
                  "safetyNettingDocumentationFeedback",
                ],
                additionalProperties: false,
              },
            },
          } : {
            type: "json_schema" as const,
            json_schema: {
              name: "receptionist_evaluation_result",
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
        const overallScore = isClinician
          ? (
              evaluation.activeListeningEmpathy +
              evaluation.iceElicitation +
              evaluation.cueDetection +
              evaluation.clinicalReasoning +
              evaluation.niceAdherence +
              evaluation.communicationClarity +
              evaluation.safetyNettingDocumentation
            ) / 7
          : (
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

        const scoreData = isClinician ? {
          sessionId: input.sessionId,
          userId: ctx.user.id,
          scenarioId: session.scenarioId,
          // Map clinician domains to the stored columns
          activeListeningEmpathy: evaluation.activeListeningEmpathy,
          informationGathering: evaluation.clinicalReasoning,       // reuse column
          policyAdherence: evaluation.niceAdherence,                // reuse column
          communicationClarity: evaluation.communicationClarity,
          deEscalation: evaluation.safetyNettingDocumentation,      // reuse column
          // Clinician-specific RCGP columns
          iceElicitation: evaluation.iceElicitation,
          cueDetection: evaluation.cueDetection,
          comorbidityReasoning: evaluation.clinicalReasoning,
          documentationQuality: evaluation.safetyNettingDocumentation,
          overallScore: Math.round(overallScore * 10) / 10,
          overallGrade,
          wentWell: evaluation.wentWell,
          areasForImprovement: evaluation.areasForImprovement,
          detailedFeedback: {
            activeListeningEmpathy: evaluation.activeListeningEmpathyFeedback ?? "",
            iceElicitation: evaluation.iceElicitationFeedback ?? "",
            cueDetection: evaluation.cueDetectionFeedback ?? "",
            clinicalReasoning: evaluation.clinicalReasoningFeedback ?? "",
            niceAdherence: evaluation.niceAdherenceFeedback ?? "",
            communicationClarity: evaluation.communicationClarityFeedback ?? "",
            safetyNettingDocumentation: evaluation.safetyNettingDocumentationFeedback ?? "",
          } as Record<string, string>,
        } : {
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

  // ─── Clinical Notes ─────────────────────────────────────────────────────────
  notes: router({
    get: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ ctx, input }) => {
        const session = await getSessionById(input.sessionId);
        if (!session) throw new TRPCError({ code: "NOT_FOUND" });
        if (session.userId !== ctx.user.id && ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        return getSessionNoteBySessionId(input.sessionId);
      }),

    save: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        subjective: z.string().max(5000).optional(),
        objective: z.string().max(5000).optional(),
        assessment: z.string().max(5000).optional(),
        plan: z.string().max(5000).optional(),
        freeText: z.string().max(10000).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const session = await getSessionById(input.sessionId);
        if (!session) throw new TRPCError({ code: "NOT_FOUND" });
        if (session.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        await upsertSessionNote({
          sessionId: input.sessionId,
          userId: ctx.user.id,
          subjective: input.subjective,
          objective: input.objective,
          assessment: input.assessment,
          plan: input.plan,
          freeText: input.freeText,
        });
        return { success: true };
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
