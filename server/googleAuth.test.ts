import { describe, it, expect } from "vitest";

describe("Google OAuth credentials", () => {
  it("GOOGLE_CLIENT_ID is set and has the correct format", () => {
    const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
    expect(clientId.length).toBeGreaterThan(0);
    // Google client IDs end with .apps.googleusercontent.com
    expect(clientId).toMatch(/\.apps\.googleusercontent\.com$/);
  });

  it("GOOGLE_CLIENT_SECRET is set and has the correct format", () => {
    const secret = process.env.GOOGLE_CLIENT_SECRET ?? "";
    expect(secret.length).toBeGreaterThan(0);
    // Google client secrets start with GOCSPX-
    expect(secret).toMatch(/^GOCSPX-/);
  });
});
