export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  // Support both Manus built-in Forge API and standard OpenAI-compatible APIs
  // BUILT_IN_FORGE_API_URL takes precedence; falls back to OPENAI_API_BASE_URL or OpenAI default
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL || process.env.OPENAI_API_BASE_URL || "https://api.openai.com",
  // BUILT_IN_FORGE_API_KEY takes precedence; falls back to OPENAI_API_KEY
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY || process.env.OPENAI_API_KEY || "",
};
