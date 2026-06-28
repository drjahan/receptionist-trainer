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
  difficulty: mysqlEnum("difficulty", ["beginner", "intermediate", "advanced"]).notNull(),
  mode: mysqlEnum("mode", ["receptionist", "gp", "pharmacist"]).default("receptionist").notNull(),
  clinicalSystem: varchar("clinicalSystem", { length: 100 }),
  description: text("description").notNull(),
  patientPersona: text("patientPersona").notNull(),
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

// Competency scores for completed sessions
export const scores = mysqlTable("scores", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull().unique(),
  userId: int("userId").notNull(),
  scenarioId: int("scenarioId").notNull(),
  activeListeningEmpathy: float("activeListeningEmpathy").notNull(),
  informationGathering: float("informationGathering").notNull(),
  policyAdherence: float("policyAdherence").notNull(),
  communicationClarity: float("communicationClarity").notNull(),
  deEscalation: float("deEscalation").notNull(),
  googleReviewOffer: float("googleReviewOffer").notNull().default(1.0),
  overallScore: float("overallScore").notNull(),
  overallGrade: varchar("overallGrade", { length: 2 }).notNull(),
  wentWell: text("wentWell").notNull(),
  areasForImprovement: text("areasForImprovement").notNull(),
  detailedFeedback: json("detailedFeedback").$type<Record<string, string>>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Score = typeof scores.$inferSelect;
export type InsertScore = typeof scores.$inferInsert;

// Call audit records — real telephone consultation assessments
export const callAudits = mysqlTable("call_audits", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  clinicianName: varchar("clinicianName", { length: 255 }),
  emisNumber: varchar("emisNumber", { length: 64 }),
  auditDate: varchar("auditDate", { length: 32 }),
  audioUrl: text("audioUrl"),
  transcript: text("transcript"),
  consultationSuitability: varchar("consultationSuitability", { length: 16 }),
  workingDiagnosis: varchar("workingDiagnosis", { length: 16 }),
  redFlagsLight: varchar("redFlagsLight", { length: 16 }),
  treatmentFollowUp: varchar("treatmentFollowUp", { length: 16 }),
  criteriaScores: json("criteriaScores").$type<Record<string, number | null>>(),
  clinicalStrengths: text("clinicalStrengths"),
  clinicalConcerns: text("clinicalConcerns"),
  nonClinicalConcerns: text("nonClinicalConcerns"),
  additionalNotes: text("additionalNotes"),
  status: mysqlEnum("status", ["pending", "transcribed", "evaluated"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CallAudit = typeof callAudits.$inferSelect;
export type InsertCallAudit = typeof callAudits.$inferInsert;
