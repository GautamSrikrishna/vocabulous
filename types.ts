/**
 * Types shared by the browser and the server.
 *
 * Nothing here imports zod or `server-only`, so client components can pull
 * these in with `import type` and stay lightweight.
 */

/** The two languages the app answers in. The toggle picks the *output* language. */
export type Lang = "en" | "kn";

/** BCP-47 codes Sarvam expects. */
export const LANG_CODES: Record<Lang, string> = {
  en: "en-IN",
  kn: "kn-IN",
};

export const LANG_NAMES: Record<Lang, string> = {
  en: "English",
  kn: "Kannada",
};

export function isLang(value: unknown): value is Lang {
  return value === "en" || value === "kn";
}

/**
 * `unknown_word` and `not_kid_appropriate` are the model's way of declining.
 * Both mean "show a friendly message, not a result card".
 */
export type LookupStatus = "ok" | "unknown_word" | "not_kid_appropriate";

export interface LookupResult {
  /** The word as the wizard understood it, spelled in the output language's script. */
  word: string;
  partOfSpeech: string;
  /** One short kid-friendly line. */
  meaning: string;
  synonyms: string[];
  /** Legitimately empty for words with no true opposite. */
  antonyms: string[];
  exampleSentence: string;
  status: LookupStatus;
}

/** What `/api/lookup` sends back. */
export interface LookupResponse extends LookupResult {
  /** The output language, echoed so the UI can set `lang`/`dir` on the cards. */
  lang: Lang;
}

/** Shape of every error body this app's API routes return. */
export interface ApiErrorBody {
  /** Already phrased for a ten-year-old. Safe to render as-is. */
  error: string;
}
