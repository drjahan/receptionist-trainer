import { describe, it, expect } from "vitest";

/**
 * Validates that the ElevenLabs API key and Agent ID are correctly configured
 * by calling the signed URL endpoint. A 200 response with a signed_url field
 * confirms both credentials are valid.
 */
describe("ElevenLabs credentials", () => {
  it("should return a signed WebSocket URL from the ElevenLabs API", async () => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const agentId = process.env.ELEVENLABS_AGENT_ID;

    expect(apiKey, "ELEVENLABS_API_KEY must be set").toBeTruthy();
    expect(agentId, "ELEVENLABS_AGENT_ID must be set").toBeTruthy();

    const resp = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
      { headers: { "xi-api-key": apiKey! } }
    );

    expect(resp.status, `ElevenLabs API returned ${resp.status}`).toBe(200);

    const body = await resp.json() as { signed_url?: string };
    expect(body.signed_url, "Response must contain a signed_url field").toBeTruthy();
    expect(body.signed_url).toMatch(/^wss:\/\//);
  }, 15_000);
});
