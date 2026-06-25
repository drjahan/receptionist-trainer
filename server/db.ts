import { eq, desc, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, scenarios, sessions, messages, scores, InsertSession, InsertMessage, InsertScore } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt));
}

// ─── Scenarios ────────────────────────────────────────────────────────────────

export async function getAllScenarios() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(scenarios).orderBy(scenarios.id);
}

export async function getScenarioById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(scenarios).where(eq(scenarios.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Sessions ────────────────────────────────────────────────────────────────

export async function createSession(data: InsertSession) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(sessions).values(data);
  return result[0].insertId as number;
}

export async function getSessionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getSessionsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sessions).where(eq(sessions.userId, userId)).orderBy(desc(sessions.startedAt));
}

export async function getAllSessions() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sessions).orderBy(desc(sessions.startedAt));
}

export async function completeSession(id: number, durationSeconds: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(sessions).set({ status: "completed", completedAt: new Date(), durationSeconds }).where(eq(sessions.id, id));
}

export async function abandonSession(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(sessions).set({ status: "abandoned" }).where(eq(sessions.id, id));
}

// ─── Messages ────────────────────────────────────────────────────────────────

export async function addMessage(data: InsertMessage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(messages).values(data);
  return result[0].insertId as number;
}

export async function getMessagesBySessionId(sessionId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(messages).where(eq(messages.sessionId, sessionId)).orderBy(messages.createdAt);
}

// ─── Scores ───────────────────────────────────────────────────────────────────

export async function saveScore(data: InsertScore) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(scores).values(data);
  return result[0].insertId as number;
}

export async function getScoreBySessionId(sessionId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(scores).where(eq(scores.sessionId, sessionId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getScoresByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(scores).where(eq(scores.userId, userId)).orderBy(desc(scores.createdAt));
}

export async function getAllScores() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(scores).orderBy(desc(scores.createdAt));
}
