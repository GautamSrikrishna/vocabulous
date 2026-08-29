# 🧙 Vocabulous — the Word Wizard

A vocabulary helper for a 10-year-old. Type or say a word and it comes back with the
**meaning, synonyms, antonyms and an example sentence** — in **English or Kannada** — with a
button to hear any of it read aloud.

Powered by [Sarvam AI](https://docs.sarvam.ai), whose models are built for Indic languages.

---

## Setup

```bash
npm install
cp .env.example .env     # then paste your key into .env
npm run dev              # http://localhost:3000
```

Get a key from the [Sarvam dashboard](https://dashboard.sarvam.ai) and put it in `.env`:

```bash
SARVAM_API_KEY=sk_your_real_key_here
```

Until a real key is in place, the app loads and shows *"The wizard has no magic key yet!"*
when you look a word up. Restart the dev server after editing `.env`.

---

## How it works

**The language toggle sets the language of the *answer*, not the question.** He can type
`happy` with ಕನ್ನಡ selected and get the whole answer in Kannada — the wizard works out what
language the word arrived in on its own.

| Feature | What happens |
|---|---|
| 🔤 **Type a word** | Any word, either language, either script. |
| 🎤 **Say a word** | Tap the mic, tap again to stop. The transcript lands in the text box **so he can fix it** before pressing Find out — single-word speech recognition gets it wrong often enough that this step matters. |
| ⌨️ **Kannada typing** | Type `naayi` and a chip offers **ನಾಯಿ**. Tap to use it. Never auto-replaces. |
| 🔊 **Hear it** | Speaker buttons on the word and the example sentence, in the answer language. |
| 🕘 **Recent words** | The last 8 words come back as chips — tap to look one up again. |

If a word has no real opposite, the antonym card says so rather than inventing one. Gibberish
gets *"I don't know that word yet"*, and anything unsuitable for a 10-year-old is declined by
the model and blanked on the server before it can reach the browser.

---

## Where the API key lives

**Server-side only.** Every Sarvam call goes through a Next.js route handler:

| Route | Sarvam endpoint |
|---|---|
| `POST /api/lookup` | `/v1/chat/completions` — strict JSON Schema, re-validated with zod |
| `POST /api/transcribe` | `/speech-to-text` |
| `POST /api/speak` | `/text-to-speech` → returns MP3 bytes |
| `POST /api/transliterate` | `/transliterate` |

Two things keep the key out of the browser, and both are deliberate:

1. **No env var is prefixed `NEXT_PUBLIC_`.** Anything with that prefix is compiled into the
   JS bundle, which is exactly how API keys leak.
2. **`lib/sarvam.ts` imports `server-only`.** If a client component ever imports it, the
   build fails instead of quietly shipping the key.

You can check this yourself at any time:

```bash
npm run build && grep -r "api-subscription-key\|api.sarvam.ai" .next/static/
```

That should find nothing.

---

## Project layout

```
app/
  page.tsx            the single screen
  api/                the four Sarvam proxy routes
  globals.css         the sticker-book theme
lib/
  sarvam.ts           server-only Sarvam client  ← the key lives here
  schema.ts           JSON Schema sent to the model + zod re-validation
  prompts.ts          system prompt (reading age, answer language, safety)
  cache.ts            LRU caches; lookups persist to .cache/ between sessions
  prefs.ts            language + recent words, in localStorage
components/           Wizard, LanguageToggle, WordInput, MicButton, SpeakButton, ResultCards
```

## Notes

- **Microphone** needs `localhost` or HTTPS, so `npm run dev` on this machine is fine.
- **Sarvam matches the upload's MIME type exactly.** `MediaRecorder` stamps blobs
  `audio/webm;codecs=opus`, and that `;codecs=` parameter is rejected with a 400 even though
  bare `audio/webm` is allowed. `speechToText` strips it before uploading — don't remove that.
- **Use `sarvam-105b-conversations`, not plain `sarvam-105b`.** The base model is a *reasoning*
  model: it spends 1300+ tokens thinking before writing anything, so with a normal `max_tokens`
  it hits the limit and returns `content: null` — the lookup fails with no obvious cause. The
  conversational variant answers the same question in ~75 tokens. `sarvam-m` is deprecated.
- **`max_tokens` is capped at 2048** on the starter subscription tier; this app sends 1024.
- **Kannada synonyms for less common words can be wrong.** The model occasionally offers a
  near-miss (it suggested ಕಾಯಿ for ನಾಯಿ once). Worth a glance before the homework is handed in.
- **The lookup cache is written to `.cache/lookups.json`** so it survives restarts. The app
  is started fresh whenever it's needed, so an in-memory-only cache would never warm up and
  every session would re-pay for the previous session's words. Delete the file any time —
  it costs API calls, never correctness. Transliteration stays in memory on purpose: it
  caches half-typed prefixes, which aren't worth keeping.

