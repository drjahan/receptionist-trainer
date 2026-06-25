import type { Express, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";

const COOKIE_NAME = "rt_session";
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-change-in-production"
);
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

function getCookieOptions(req: Request) {
  const isSecure = req.protocol === "https" || req.headers["x-forwarded-proto"] === "https";
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: (isSecure ? "none" : "lax") as "none" | "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE * 1000, // ms
  };
}

export async function signToken(userId: number): Promise<string> {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<{ userId: number } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return { userId: payload.userId as number };
  } catch {
    return null;
  }
}

export async function getUserFromRequest(req: Request) {
  const token = req.cookies?.[COOKIE_NAME] || 
    req.headers.authorization?.replace("Bearer ", "");
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);
  return result[0] || null;
}

export function registerStandaloneAuthRoutes(app: Express) {
  // Parse cookies
  app.use((req, _res, next) => {
    if (!req.cookies) {
      req.cookies = {};
      const cookieHeader = req.headers.cookie || "";
      cookieHeader.split(";").forEach(pair => {
        const [k, ...v] = pair.trim().split("=");
        if (k) req.cookies[k.trim()] = decodeURIComponent(v.join("="));
      });
    }
    next();
  });

  // POST /api/auth/register
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { name, email, password } = req.body;
      if (!name || !email || !password) {
        return res.status(400).json({ error: "Name, email and password are required" });
      }
      if (password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
      }
      const db = await getDb();
      if (!db) return res.status(500).json({ error: "Database unavailable" });

      // Check if email already exists
      const existing = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
      if (existing.length > 0) {
        return res.status(409).json({ error: "An account with this email already exists" });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      await db.insert(users).values({
        name,
        email: email.toLowerCase(),
        passwordHash,
        loginMethod: "email",
        lastSignedIn: new Date(),
      });

      const newUser = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
      const user = newUser[0];
      if (!user) return res.status(500).json({ error: "Failed to create account" });

      const token = await signToken(user.id);
      res.cookie(COOKIE_NAME, token, getCookieOptions(req));
      return res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (err) {
      console.error("[Auth] Register error:", err);
      return res.status(500).json({ error: "Registration failed" });
    }
  });

  // POST /api/auth/login
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }
      const db = await getDb();
      if (!db) return res.status(500).json({ error: "Database unavailable" });

      const result = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
      const user = result[0];
      if (!user || !user.passwordHash) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Update last signed in
      await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));

      const token = await signToken(user.id);
      res.cookie(COOKIE_NAME, token, getCookieOptions(req));
      return res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (err) {
      console.error("[Auth] Login error:", err);
      return res.status(500).json({ error: "Login failed" });
    }
  });

  // POST /api/auth/logout
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    res.clearCookie(COOKIE_NAME, { ...getCookieOptions(req), maxAge: -1 });
    return res.json({ success: true });
  });

  // GET /api/auth/me
  app.get("/api/auth/me", async (req: Request, res: Response) => {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: "Not authenticated" });
    return res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
  });
}

export { COOKIE_NAME as STANDALONE_COOKIE_NAME };
