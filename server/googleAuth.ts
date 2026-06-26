/**
 * Google OAuth 2.0 routes
 * GET  /api/oauth/google          → redirect to Google consent screen
 * GET  /api/oauth/google/callback → exchange code, upsert user, set rt_session cookie
 *
 * Uses the same rt_session JWT cookie and signToken() as standaloneAuth.ts so
 * the existing getUserFromRequest() / tRPC context works without any changes.
 */

import type { Express, Request, Response } from "express";
import { google } from "googleapis";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { signToken, STANDALONE_COOKIE_NAME } from "./standaloneAuth";

const COOKIE_NAME = STANDALONE_COOKIE_NAME; // "rt_session"
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getCookieOptions(req: Request) {
  const isSecure =
    req.protocol === "https" ||
    req.headers["x-forwarded-proto"] === "https";
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: (isSecure ? "none" : "lax") as "none" | "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_MS,
  };
}

function getOAuthClient(redirectUri: string) {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );
}

function getRedirectUri(req: Request): string {
  const proto =
    req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:3000";
  return `${proto}://${host}/api/oauth/google/callback`;
}

export function registerGoogleAuthRoutes(app: Express) {
  // ── Step 1: Redirect to Google ────────────────────────────────────────────
  app.get("/api/oauth/google", (req: Request, res: Response) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      console.error("[GoogleAuth] GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set");
      return res.status(500).send("Google OAuth is not configured on this server.");
    }

    const redirectUri = getRedirectUri(req);
    const oauthClient = getOAuthClient(redirectUri);

    // Generate a random CSRF state token and store in a short-lived cookie
    const state = randomBytes(16).toString("hex");
    const isSecure = req.protocol === "https" || req.headers["x-forwarded-proto"] === "https";
    res.cookie("google_oauth_state", state, {
      httpOnly: true,
      secure: isSecure,
      sameSite: isSecure ? "none" : "lax",
      maxAge: 10 * 60 * 1000, // 10 minutes
      path: "/",
    });

    const authUrl = oauthClient.generateAuthUrl({
      access_type: "offline",
      scope: ["openid", "email", "profile"],
      prompt: "select_account",
      state,
    });

    return res.redirect(302, authUrl);
  });

  // ── Step 2: Handle callback from Google ──────────────────────────────────
  app.get("/api/oauth/google/callback", async (req: Request, res: Response) => {
    const code = req.query.code as string | undefined;
    const error = req.query.error as string | undefined;
    const returnedState = req.query.state as string | undefined;

    if (error || !code) {
      console.error("[GoogleAuth] OAuth error or missing code:", error);
      return res.redirect(302, "/login?error=google_auth_failed");
    }

    // Verify CSRF state
    const cookies = req.cookies ?? {};
    const savedState = cookies["google_oauth_state"];
    if (!savedState || savedState !== returnedState) {
      console.error("[GoogleAuth] State mismatch — possible CSRF attack");
      return res.redirect(302, "/login?error=state_mismatch");
    }
    // Clear the state cookie
    res.clearCookie("google_oauth_state", { path: "/" });

    try {
      const redirectUri = getRedirectUri(req);
      const oauthClient = getOAuthClient(redirectUri);

      // Exchange code for tokens
      const { tokens } = await oauthClient.getToken(code);
      oauthClient.setCredentials(tokens);

      // Get user profile from Google
      const oauth2 = google.oauth2({ version: "v2", auth: oauthClient });
      const { data: googleUser } = await oauth2.userinfo.get();

      if (!googleUser.email) {
        return res.redirect(302, "/login?error=no_email");
      }

      const db = await getDb();
      if (!db) {
        return res.redirect(302, "/login?error=db_unavailable");
      }

      // Upsert user — find by email, create if not found
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.email, googleUser.email.toLowerCase()))
        .limit(1);

      let userId: number;

      if (existing.length > 0) {
        // Update last sign-in and name
        await db
          .update(users)
          .set({
            name: googleUser.name || existing[0].name,
            lastSignedIn: new Date(),
            loginMethod: "google",
          })
          .where(eq(users.id, existing[0].id));
        userId = existing[0].id;
      } else {
        // Create new user
        const result = await db.insert(users).values({
          name: googleUser.name || googleUser.email,
          email: googleUser.email.toLowerCase(),
          loginMethod: "google",
          lastSignedIn: new Date(),
        });
        userId = (result[0] as any).insertId as number;
      }

      // Mint the same JWT cookie as standaloneAuth
      const token = await signToken(userId);
      res.cookie(COOKIE_NAME, token, getCookieOptions(req));

      return res.redirect(302, "/scenarios");
    } catch (err) {
      console.error("[GoogleAuth] Callback error:", err);
      return res.redirect(302, "/login?error=google_auth_failed");
    }
  });
}
