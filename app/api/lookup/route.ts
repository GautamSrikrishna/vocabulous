import { NextResponse } from "next/server";

import { CACHE_DIR, PersistentLruCache } from "@/lib/cache";
import { systemPrompt, userPrompt } from "@/lib/prompts";
import { LOOKUP_JSON_SCHEMA, parseLookup, redact } from "@/lib/schema";
import { SarvamError, chatCompletionJson } from "@/lib/sarvam";
import { isLang, type LookupResponse, type LookupResult } from "@/types";

/** Longest word we'll accept — this is a single-word tool, not a translator. */
const MAX_WORD_LENGTH = 60;

const cache = new PersistentLruCache<LookupResult>(`${CACHE_DIR}/lookups.json`, 500);

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "I didn't get a word to look up." }, { status: 400 });
  }

  const { word, outputLang } = (body ?? {}) as { word?: unknown; outputLang?: unknown };

  if (typeof word !== "string" || word.trim() === "") {
    return NextResponse.json({ error: "Type a word first! ✏️" }, { status: 400 });
  }
  if (!isLang(outputLang)) {
    return NextResponse.json({ error: "I'm not sure which language to use." }, { status: 400 });
  }

  const cleanWord = word.trim().slice(0, MAX_WORD_LENGTH);
  const cacheKey = `${outputLang}|${cleanWord.toLowerCase()}`;

  const cached = await cache.get(cacheKey);
  if (cached) {
    return NextResponse.json({ ...cached, lang: outputLang } satisfies LookupResponse);
  }

  const messages = [
    { role: "system" as const, content: systemPrompt(outputLang) },
    { role: "user" as const, content: userPrompt(cleanWord) },
  ];

  try {
    // One retry: strict JSON Schema makes malformed output rare but not impossible.
    let result: LookupResult | null = null;
    for (let attempt = 0; attempt < 2 && result === null; attempt += 1) {
      const raw = await chatCompletionJson({
        messages,
        jsonSchema: LOOKUP_JSON_SCHEMA,
        // Nudge toward a different sample on the retry.
        temperature: attempt === 0 ? 0.3 : 0.6,
      });
      result = parseLookup(raw);
      if (result === null) {
        console.warn(`[lookup] unparseable response for "${cleanWord}" (attempt ${attempt + 1})`);
      }
    }

    if (result === null) {
      return NextResponse.json(
        { error: "My spellbook got muddled! Try that word again. \u{1FA84}" },
        { status: 502 },
      );
    }

    const safe = redact(result);
    if (safe.status === "ok") await cache.set(cacheKey, safe);

    return NextResponse.json({ ...safe, lang: outputLang } satisfies LookupResponse);
  } catch (error) {
    if (error instanceof SarvamError) {
      console.error(`[lookup] ${error.message}`);
      return NextResponse.json({ error: error.friendly }, { status: 502 });
    }
    console.error("[lookup] unexpected error", error);
    return NextResponse.json(
      { error: "My spellbook got stuck! Try again. \u{1FA84}" },
      { status: 500 },
    );
  }
}
