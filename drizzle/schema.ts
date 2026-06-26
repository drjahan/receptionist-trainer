import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  json,
  float,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).unique(), // nullable for standalone auth users
  name: text("name"),
  email: varchar("email", { length: 320 }).unique(),
  passwordHash: varchar("passwordHash", { length: 255 }), // for standalone email/password auth
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Scenarios library
export const scenarios = mysqlTable("scenarios", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  // clinicalSystem: the body system / specialty (e.g. "Urology", "Cardiovascular")
  clinicalSystem: varchar("clinicalSystem", { length: 100 }),
  difficulty: mysqlEnum("difficulty", ["beginner", "intermediate", "advanced"]).notNull(),
  // complexityTier: 1 = simple, 2 = moderate, 3 = complex (maps to difficulty but more granular)
  complexityTier: int("complexityTier").default(1),
  mode: mysqlEnum("mode", ["receptionist", "clinician"]).default("receptionist").notNull(),
  description: text("description").notNull(),
  patientPersona: text("patientPersona").notNull(),
  // comorbidities: list of comorbidities embedded in the case (for cross-referencing scoring)
  comorbidities: json("comorbidities").$type<string[]>().default([]),
  // hiddenCues: patient cues the clinician should detect (for cue-detection scoring)
  hiddenCues: json("hiddenCues").$type<string[]>().default([]),
  // iceElements: the ICE elements seeded in the patient persona (for ICE scoring)
  iceElements: json("iceElements").$type<{ ideas: string; concerns: string; expectations: string }>(),
  learningObjectives: json("learningObjectives").$type<string[]>().notNull(),
  tags: json("tags").$type<string[]>().notNull(),
  estimatedMinutes: int("estimatedMinutes").default(10).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Scenario = typeof scenarios.$inferSelect;
export type InsertScenario = typeof scenarios.$inferInsert;

// Training sessions
export const sessions = mysqlTable("sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  scenarioId: int("scenarioId").notNull(),
  status: mysqlEnum("status", ["active", "completed", "abandoned"]).default("active").notNull(),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  durationSeconds: int("durationSeconds"),
});

export type Session = typeof sessions.$inferSelect;
export type InsertSession = typeof sessions.$inferInsert;

// Chat messages within a session
export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

// Clinical consultation notes submitted by clinicians during a session
export const sessionNotes = mysqlTable("session_notes", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull().unique(),
  userId: int("userId").notNull(),
  // SOAP-structured notes
  subjective: text("subjective"),   // Patient's presenting complaint, history
  objective: text("objective"),     // Examination findings, observations
  assessment: text("assessment"),   // Diagnosis / differential diagnoses
  plan: text("plan"),               // Management plan, prescribing, referrals, safety-netting
  // Free-text fallback if clinician doesn't use SOAP structure
  freeText: text("freeText"),
  submittedAt: timestamp("submittedAt").defaultNow().notNull(),
  // AI feedback on the notes quality (populated at evaluation time)
  notesFeedback: text("notesFeedback"),
  notesScore: float("notesScore"),  // 1.0-5.0
});

export type SessionNote = typeof sessionNotes.$inferSelect;
export type InsertSessionNote = typeof sessionNotes.$inferInsert;

// Competency scores for completed sessions
export const scores = mysqlTable("scores", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull().unique(),
  userId: int("userId").notNull(),
  scenarioId: int("scenarioId").notNull(),
  // Core 5 (receptionist + clinician)
  activeListeningEmpathy: float("activeListeningEmpathy").notNull(),
  informationGathering: float("informationGathering").notNull(),
  policyAdherence: float("policyAdherence").notNull(),
  communicationClarity: float("communicationClarity").notNull(),
  deEscalation: float("deEscalation").notNull(),
  // Clinician-only RCGP domains (nullable for receptionist sessions)
  iceElicitation: float("iceElicitation"),        // ICE: Ideas, Concerns, Expectations
  cueDetection: float("cueDetection"),            // Picking up verbal/non-verbal patient cues
  comorbidityReasoning: float("comorbidityReasoning"), // Cross-referencing comorbidities
  documentationQuality: float("documentationQuality"), // SOAP notes quality (if submitted)
  // Aggregate
  overallScore: float("overallScore").notNull(),
  overallGrade: varchar("overallGrade", { length: 2 }).notNull(),
  wentWell: text("wentWell").notNull(),
  areasForImprovement: text("areasForImprovement").notNull(),
  detailedFeedback: json("detailedFeedback").$type<Record<string, string>>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Score = typeof scores.$inferSelect;
export type InsertScore = typeof scores.$inferInsert;
