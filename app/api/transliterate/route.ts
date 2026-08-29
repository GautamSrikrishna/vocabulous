import { NextResponse } from "next/server";

import { LruCache } from "@/lib/cache";
import { SarvamError, transliterateToScript } from "@/lib/sarvam";
import { isLang } from "@/types";

const MAX_INPUT_LENGTH = 60;

/** Typing is bursty and repetitive, so caching here saves a lot of calls. */
const cache = new LruCache<string>(300);

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Nothing to convert." }, { status: 400 });
  }

  const { text, lang } = (body ?? {}) as { text?: unknown; lang?: unknown };

  if (typeof text !== "string" || text.trim() === "") {
    return NextResponse.json({ error: "Nothing to convert." }, { status: 400 });
  }
  if (!isLang(lang)) {
    return NextResponse.json({ error: "I'm not sure which language to use." }, { status: 400 });
  }

  const cleanText = text.trim().slice(0, MAX_INPUT_LENGTH);
  const cacheKey = `${lang}|${cleanText.toLowerCase()}`;

  const cached = cache.get(cacheKey);
  if (cached !== undefined) {
    return NextResponse.json({ transliterated: cached });
  }

  try {
    const transliterated = await transliterateToScript(cleanText, lang);
    cache.set(cacheKey, transliterated);
    return NextResponse.json({ transliterated });
  } catch (error) {
    if (error instanceof SarvamError) {
      console.error(`[transliterate] ${error.message}`);
    } else {
      console.error("[transliterate] unexpected error", error);
    }
    // This is a convenience feature. If it fails, stay silent rather than
    // showing the child an error for something they didn't ask for.
    return NextResponse.json({ transliterated: "" });
  }
}
