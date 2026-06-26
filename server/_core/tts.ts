import { ENV } from "./env";

export type TTSVoice = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";

export interface TTSOptions {
  text: string;
  voice?: TTSVoice;
  speed?: number; // 0.25 to 4.0
}

export interface TTSResult {
  audioBase64: string; // base64-encoded MP3
  mimeType: "audio/mpeg";
}

/**
 * Generate speech from text using the OpenAI-compatible TTS endpoint.
 * Returns the audio as a base64-encoded MP3 string suitable for a data URL.
 */
export async function generateSpeech(options: TTSOptions): Promise<TTSResult> {
  const { text, voice = "nova", speed = 1.0 } = options;

  const apiUrl = `${ENV.forgeApiUrl}/v1/audio/speech`;

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ENV.forgeApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1",
      input: text,
      voice,
      speed,
      response_format: "mp3",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`TTS API error ${response.status}: ${errorText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  return {
    audioBase64: base64,
    mimeType: "audio/mpeg",
  };
}
