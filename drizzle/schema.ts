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
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
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
  description: text("description").notNull(),
  patientPersona: text("patientPersona").notNull(), // System prompt for AI patient
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
  role: mysqlEnum("role", ["user", "assistant"]).notNull(), // user = receptionist, assistant = AI patient
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
  // Five competencies, each 1-5
  activeListeningEmpathy: float("activeListeningEmpathy").notNull(),
  informationGathering: float("informationGathering").notNull(),
  policyAdherence: float("policyAdherence").notNull(),
  communicationClarity: float("communicationClarity").notNull(),
  deEscalation: float("deEscalation").notNull(),
  overallScore: float("overallScore").notNull(),
  overallGrade: varchar("overallGrade", { length: 2 }).notNull(), // A, B, C, D, F
  wentWell: text("wentWell").notNull(),
  areasForImprovement: text("areasForImprovement").notNull(),
  detailedFeedback: json("detailedFeedback").$type<Record<string, string>>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Score = typeof scores.$inferSelect;
export type InsertScore = typeof scores.$inferInsert;
