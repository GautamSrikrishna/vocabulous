import { NextResponse } from "next/server";

import { SarvamError, textToSpeech } from "@/lib/sarvam";
import { isLang } from "@/types";

/** Comfortably covers a word or an example sentence; well under Sarvam's 2500 limit. */
const MAX_TEXT_LENGTH = 300;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "I didn't get anything to say." }, { status: 400 });
  }

  const { text, lang } = (body ?? {}) as { text?: unknown; lang?: unknown };

  if (typeof text !== "string" || text.trim() === "") {
    return NextResponse.json({ error: "There's nothing to read out loud." }, { status: 400 });
  }
  if (!isLang(lang)) {
    return NextResponse.json({ error: "I'm not sure which language to use." }, { status: 400 });
  }

  try {
    const audio = await textToSpeech(text.trim().slice(0, MAX_TEXT_LENGTH), lang);
    return new Response(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audio.byteLength),
        // Same word, same voice, same bytes — let the browser skip the round trip.
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    if (error instanceof SarvamError) {
      console.error(`[speak] ${error.message}`);
      return NextResponse.json({ error: error.friendly }, { status: 502 });
    }
    console.error("[speak] unexpected error", error);
    return NextResponse.json({ error: "My voice went quiet! Try again. 🔊" }, { status: 500 });
  }
}
