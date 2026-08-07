import { NextResponse } from "next/server";

import { SarvamError, speechToText } from "@/lib/sarvam";
import { isLang } from "@/types";

/** ~10 seconds of Opus is well under this; the cap is just a guard rail. */
const MAX_AUDIO_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "I couldn't hear that recording." }, { status: 400 });
  }

  const audio = form.get("audio");
  const lang = form.get("lang");

  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ error: "I didn't catch that — try again! 🎤" }, { status: 400 });
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "That was a bit long! Try a shorter one." }, { status: 413 });
  }
  if (!isLang(lang)) {
    return NextResponse.json({ error: "I'm not sure which language to use." }, { status: 400 });
  }

  try {
    const transcript = await speechToText(audio, lang);
    if (!transcript) {
      return NextResponse.json(
        { error: "I couldn't hear a word there. Try again a bit louder! 🎤" },
        { status: 422 },
      );
    }
    return NextResponse.json({ transcript });
  } catch (error) {
    if (error instanceof SarvamError) {
      console.error(`[transcribe] ${error.message}`);
      return NextResponse.json({ error: error.friendly }, { status: 502 });
    }
    console.error("[transcribe] unexpected error", error);
    return NextResponse.json({ error: "My ears aren't working! Try again. 🎤" }, { status: 500 });
  }
}
