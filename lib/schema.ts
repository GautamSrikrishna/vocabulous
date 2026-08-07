import { z } from "zod";

import type { LookupResult } from "@/types";

/**
 * The lookup contract, in two forms:
 *  - `LOOKUP_JSON_SCHEMA` is sent to Sarvam as a strict `response_format`.
 *  - `lookupSchema` re-validates whatever comes back.
 *
 * The JSON Schema is hand-written rather than generated so that what goes over
 * the wire is exactly what you read here — `strict: true` requires every
 * property listed in `required` and `additionalProperties: false`.
 */
export const LOOKUP_JSON_SCHEMA = {
  name: "vocabulary_lookup",
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "word",
      "partOfSpeech",
      "meaning",
      "synonyms",
      "antonyms",
      "exampleSentence",
      "status",
    ],
    properties: {
      word: {
        type: "string",
        description: "The word, spelled correctly in the output language's script.",
      },
      partOfSpeech: {
        type: "string",
        description: "Noun, verb, adjective… written in the output language.",
      },
      meaning: {
        type: "string",
        description: "One short line a 10-year-old understands.",
      },
      synonyms: {
        type: "array",
        items: { type: "string" },
        description: "1 to 3 common words meaning nearly the same.",
      },
      antonyms: {
        type: "array",
        items: { type: "string" },
        description: "1 to 3 opposites, or an empty array if the word has no true opposite.",
      },
      exampleSentence: {
        type: "string",
        description: "One sentence under 12 words that uses the word.",
      },
      status: {
        type: "string",
        enum: ["ok", "unknown_word", "not_kid_appropriate"],
      },
    },
  },
} as const;

/** Trims strings and drops empty entries so the UI never renders a blank chip. */
const wordList = z
  .array(z.string())
  .max(6)
  .transform((items) => items.map((item) => item.trim()).filter(Boolean).slice(0, 3));

export const lookupSchema = z.object({
  word: z.string().trim(),
  partOfSpeech: z.string().trim(),
  meaning: z.string().trim(),
  synonyms: wordList,
  antonyms: wordList,
  exampleSentence: z.string().trim(),
  status: z.enum(["ok", "unknown_word", "not_kid_appropriate"]),
});

// Compile-time guarantee that the validated shape matches what the UI expects.
const _shapeCheck: LookupResult = {} as z.infer<typeof lookupSchema>;
void _shapeCheck;

/**
 * Parses model output. Returns `null` on anything malformed so the caller can
 * retry once before giving up.
 */
export function parseLookup(raw: string): LookupResult | null {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }

  const parsed = lookupSchema.safeParse(json);
  if (!parsed.success) return null;

  const result = parsed.data;

  // A model can claim "ok" while leaving the useful fields blank. Treat that as
  // not knowing the word rather than showing the child an empty card.
  if (result.status === "ok" && (!result.meaning || !result.exampleSentence)) {
    return { ...result, status: "unknown_word" };
  }

  return result;
}

/** Strips content for the declining statuses, so nothing unsuitable leaves the server. */
export function redact(result: LookupResult): LookupResult {
  if (result.status === "ok") return result;
  return {
    word: result.status === "unknown_word" ? result.word : "",
    partOfSpeech: "",
    meaning: "",
    synonyms: [],
    antonyms: [],
    exampleSentence: "",
    status: result.status,
  };
}
