import "server-only";

import { LANG_CODES, type Lang } from "@/types";

/**
 * Thin wrappers around the four Sarvam endpoints Vocabulous uses.
 *
 * The `server-only` import above is load-bearing: if a client component ever
 * imports this file (and with it the API key), the build fails instead of
 * quietly shipping the key to the browser.
 *
 * Docs: https://docs.sarvam.ai/api-reference/introduction
 */

const BASE_URL = "https://api.sarvam.ai";
const TIMEOUT_MS = 30_000;

/** An error already phrased for a ten-year-old, plus detail for the server log. */
export class SarvamError extends Error {
  constructor(
    /** Safe to show the child. */
    readonly friendly: string,
    /** Never leaves the server. */
    message: string,
  ) {
    super(message);
    this.name = "SarvamError";
  }
}

const PLACEHOLDER_KEY = "sk_replace_me";

function apiKey(): string {
  const key = process.env.SARVAM_API_KEY?.trim();
  if (!key || key === PLACEHOLDER_KEY) {
    throw new SarvamError(
      "The wizard has no magic key yet! Ask a grown-up to check the setup. \u{1FA84}",
      "SARVAM_API_KEY is missing or still set to the placeholder. Copy .env.example to .env " +
        "and paste a real key from https://dashboard.sarvam.ai, then restart the dev server.",
    );
  }
  return key;
}

function envOr(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback;
}

export const MODELS = {
  /**
   * The `-conversations` variant, not plain `sarvam-105b`, and that matters:
   * the base model is a reasoning model that burns well over a thousand tokens
   * thinking before it writes a single character of the answer. For a word
   * lookup that buys nothing and costs several seconds. This variant answers
   * in ~75 tokens.
   */
  chat: () => envOr("SARVAM_CHAT_MODEL", "sarvam-105b-conversations"),
  stt: () => envOr("SARVAM_STT_MODEL", "saaras:v4"),
  tts: () => envOr("SARVAM_TTS_MODEL", "bulbul:v3"),
  /** Female voice. Speaker names are validated per model — bulbul:v2 names are rejected by v3. */
  ttsSpeaker: () => envOr("SARVAM_TTS_SPEAKER", "shreya").toLowerCase(),
};

const GENERIC_FAILURE = "My spellbook got stuck! Try again. \u{1FA84}";

async function callSarvam(
  path: string,
  init: { body: BodyInit; headers?: Record<string, string> },
): Promise<Response> {
  // Resolved before the try block on purpose: a missing key is a setup problem,
  // and wrapping it in the network handler below would hide the one message
  // that actually tells you how to fix it.
  const key = apiKey();

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { "api-subscription-key": key, ...init.headers },
      body: init.body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new SarvamError(
      "I couldn't reach my spellbook. Is the internet working?",
      `Network failure calling ${path}: ${reason}`,
    );
  }

  if (!response.ok) {
    // Read the body for the log, but never surface it — it can echo request content.
    const detail = await response.text().catch(() => "<unreadable>");
    const friendly =
      response.status === 401 || response.status === 403
        ? "That magic key doesn't work. Ask a grown-up to check it. \u{1FA84}"
        : response.status === 429
          ? "Whoa, so many words! Wait a moment and try again. \u{1F40C}"
          : GENERIC_FAILURE;
    throw new SarvamError(
      friendly,
      `Sarvam ${path} returned ${response.status}: ${detail.slice(0, 500)}`,
    );
  }

  return response;
}

/* ------------------------------------------------------------------ */
/* Chat completions — the word lookup                                  */
/* ------------------------------------------------------------------ */

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

/**
 * Calls chat completions with a strict JSON Schema and returns the raw JSON
 * string. Validating that string against zod is the caller's job — a schema
 * promise from a model is not a guarantee.
 */
export async function chatCompletionJson(options: {
  messages: ChatMessage[];
  jsonSchema: { name: string; schema: Record<string, unknown> };
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const response = await callSarvam("/v1/chat/completions", {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODELS.chat(),
      messages: options.messages,
      temperature: options.temperature ?? 0.3,
      // A lookup uses ~100 tokens, so this is ample headroom while staying
      // under the 2048 ceiling the starter subscription tier enforces.
      max_tokens: options.maxTokens ?? 1024,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: options.jsonSchema.name,
          schema: options.jsonSchema.schema,
          strict: true,
        },
      },
    }),
  });

  const payload = (await response.json()) as {
    choices?: { finish_reason?: string; message?: { content?: string | null } }[];
    usage?: { completion_tokens?: number };
  };
  const choice = payload.choices?.[0];
  const content = choice?.message?.content;

  if (typeof content !== "string" || content.trim() === "") {
    // Worth calling out by name: a reasoning model can spend the whole token
    // budget on hidden reasoning and return `content: null`, which otherwise
    // looks like a generic API failure.
    const ranOut = choice?.finish_reason === "length";
    throw new SarvamError(
      GENERIC_FAILURE,
      ranOut
        ? `Chat completion hit the token limit before writing an answer ` +
          `(model=${MODELS.chat()}, completion_tokens=${payload.usage?.completion_tokens}). ` +
          `This happens with reasoning models — use sarvam-105b-conversations, or raise max_tokens.`
        : `Chat completion returned no content: ${JSON.stringify(payload).slice(0, 500)}`,
    );
  }
  return content;
}

/* ------------------------------------------------------------------ */
/* Speech to text                                                      */
/* ------------------------------------------------------------------ */

/** File extension to send for a given base MIME type. */
const AUDIO_EXTENSIONS: Record<string, string> = {
  "audio/webm": "webm",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/mpeg": "mp3",
};

/**
 * Transcribes a short recording.
 *
 * The container itself is fine — Sarvam accepts WebM/Opus (Chrome) and MP4/AAC
 * (Safari) as-is. What it will not accept is the MIME type `MediaRecorder`
 * actually stamps on the blob: it matches the type string exactly, so
 * `audio/webm` passes but `audio/webm;codecs=opus` is rejected with a 400.
 * Dropping the codec parameter is all that's needed; the bytes are untouched.
 */
export async function speechToText(audio: Blob, lang: Lang): Promise<string> {
  const baseType = audio.type.split(";")[0].trim().toLowerCase() || "audio/webm";
  // `slice` re-labels the blob without reading the bytes into memory.
  const normalised = baseType === audio.type ? audio : audio.slice(0, audio.size, baseType);

  const form = new FormData();
  // Sarvam also looks at the filename extension, so keep the two consistent.
  form.append("file", normalised, `speech.${AUDIO_EXTENSIONS[baseType] ?? "webm"}`);
  form.append("model", MODELS.stt());
  form.append("language_code", LANG_CODES[lang]);

  // No Content-Type header — fetch sets the multipart boundary itself.
  const response = await callSarvam("/speech-to-text", { body: form });
  const payload = (await response.json()) as { transcript?: string };
  return (payload.transcript ?? "").trim();
}

/* ------------------------------------------------------------------ */
/* Text to speech                                                      */
/* ------------------------------------------------------------------ */

/** Synthesises speech and returns raw MP3 bytes. */
export async function textToSpeech(text: string, lang: Lang): Promise<ArrayBuffer> {
  const response = await callSarvam("/text-to-speech", {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      target_language_code: LANG_CODES[lang],
      language_code: LANG_CODES[lang],
      model: MODELS.tts(),
      speaker: MODELS.ttsSpeaker(),
      output_audio_codec: "mp3",
      pace: 0.9, // a touch slower than default — this is for a child learning the word
    }),
  });

  const payload = (await response.json()) as { audios?: string[] };
  const base64 = payload.audios?.[0];
  if (!base64) {
    throw new SarvamError(GENERIC_FAILURE, "Text-to-speech returned an empty audios array.");
  }
  // Copy out of Node's shared Buffer pool so the caller gets a standalone ArrayBuffer.
  const bytes = Buffer.from(base64, "base64");
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/* ------------------------------------------------------------------ */
/* Transliteration — roman letters to Kannada script                   */
/* ------------------------------------------------------------------ */

/** Turns `naayi` into `ನಾಯಿ` so a child can type Kannada on a normal keyboard. */
export async function transliterateToScript(input: string, lang: Lang): Promise<string> {
  const response = await callSarvam("/transliterate", {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input,
      source_language_code: LANG_CODES.en,
      target_language_code: LANG_CODES[lang],
      numerals_format: "international",
    }),
  });

  const payload = (await response.json()) as { transliterated_text?: string };
  return (payload.transliterated_text ?? "").trim();
}
