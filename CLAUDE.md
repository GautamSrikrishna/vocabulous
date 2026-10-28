# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

## Commands

```bash
npm run dev      # http://localhost:3000
npm run build
npm run lint     # eslint (flat config, eslint-config-next)
npx tsc --noEmit # typecheck; `next build` also typechecks
```

There is no test suite. Verification is `npm run build` plus manual use of the app — the interesting failure modes (Sarvam rejecting a MIME type, a reasoning model returning `content: null`, a wrong Kannada synonym) are all live-API behaviours.

Requires a real `SARVAM_API_KEY` in `.env` (`cp .env.example .env`). Without one every lookup fails with *"The wizard has no magic key yet!"* — that is the intended message, not a bug. Restart the dev server after editing `.env`.

## Architecture

A single-screen Next.js App Router app. One client page, four server route handlers, one server-only Sarvam client.

```
app/page.tsx        the whole UI state machine (idle → loading → done/error)
app/api/*/route.ts  lookup, transcribe, speak, transliterate — thin validate-and-proxy layers
lib/sarvam.ts       the only file that touches the API key
lib/schema.ts       JSON Schema sent to the model + zod re-validation + redaction
lib/prompts.ts      system prompt
types.ts            shared client/server types (imports nothing heavyweight, by design)
```

**The key never reaches the browser, and two mechanisms enforce that.** No env var is prefixed `NEXT_PUBLIC_`, and `lib/sarvam.ts` imports `server-only` so a client-component import fails the build instead of shipping the key. Keep both when touching that file. Audit with:

```bash
npm run build && grep -r "api-subscription-key\|api.sarvam.ai" .next/static/
```

**The language toggle sets the output language, not the input language.** The model is told to identify the incoming word in any language/script and answer entirely in the selected one. `lib/prompts.ts` carries worked translate-don't-transliterate examples because without them "happy" comes back as ಹ್ಯಾಪಿ rather than ಸಂತೋಷ. Flipping the toggle re-runs the last lookup in the new language.

**Model output is never trusted.** `LOOKUP_JSON_SCHEMA` goes out as a strict `response_format`; the response is re-parsed through zod in `parseLookup` (returns `null` → the lookup route retries once at a higher temperature). `redact()` blanks every field for `unknown_word` and `not_kid_appropriate` on the server, so unsuitable content never crosses the wire. An `ok` status with an empty meaning or example is downgraded to `unknown_word`.

**Errors are two-sided.** `SarvamError` carries a `friendly` message already phrased for a ten-year-old and a `message` that stays in the server log. Routes log the latter and return only the former. Never surface a raw upstream body — it can echo request content. Follow this pattern in any new route.

**Caching is layered and none of it has a correctness role.** `/api/lookup` uses `PersistentLruCache`, which writes to `.cache/lookups.json` (gitignored) so the cache survives the restart-per-session usage pattern — bump `FILE_VERSION` in `lib/cache.ts` whenever `LookupResult` changes shape, or stale entries reach the UI unvalidated. `/api/transliterate` stays in memory deliberately (it caches half-typed prefixes). Plus `Cache-Control: private, max-age=3600` on the MP3 and a per-`SpeakButton` blob URL.

**Client preferences go through `lib/prefs.ts`, not `useEffect`.** Language and recent words live in `localStorage`, read via `useSyncExternalStore` with a distinct server snapshot. The repo lints with `react-hooks/set-state-in-effect`, so seeding state from storage in an effect is a lint error, not a style preference. Every storage access is wrapped — it throws, rather than returning null, when a browser blocks site data.

## Gotchas that will silently break things

- **Use `sarvam-105b-conversations`, not `sarvam-105b`.** The base model reasons for 1300+ tokens before writing, blows through `max_tokens`, and returns `content: null` — which looks like a generic API failure. `sarvam-105b-conversations` answers in ~75 tokens. `sarvam-m` is deprecated.
- **`max_tokens` is capped at 4096** on the starter tier; this app sends 1024.
- **Sarvam matches the upload MIME type exactly.** `MediaRecorder` stamps `audio/webm;codecs=opus`, which is rejected with a 400 even though bare `audio/webm` is fine. `speechToText` strips the `;codecs=` parameter and keeps the filename extension consistent with the type — don't remove that.
- **TTS speaker names are validated per model, and on `bulbul:v4-flash` per language too.** v4-flash speakers are persona IDs (`nupur_en_kids`, `chaitra_kn_narration`) and reject v3 short names (`shreya`, `shubh`), just as v3 rejected v2's `anushka`. So there's one speaker per answer language (`SARVAM_TTS_SPEAKER_EN` / `_KN`). Changing `SARVAM_TTS_MODEL` means changing both speakers with it. Kannada voices are listed in `.env.example`.
- **Microphone needs `localhost` or HTTPS.**
- **The lookup cache will make a prompt or model change look like it did nothing.** The cache key is `lang|word` — it carries no prompt or model version. So after editing `lib/prompts.ts`, or changing `SARVAM_CHAT_MODEL`, every word already looked up keeps returning the *old* answer from `.cache/lookups.json`, on disk, across restarts. Run `rm -rf .cache` before testing any change to how the model is asked.
- **`app/error.tsx` takes `retry`, not `reset`.** `retry` became stable in Next 16.3.0 and re-fetches; `reset` only clears the boundary. Older examples in training data use `reset`.
- **`npm install <pkg>@x.y.z` silently loosens a pin to `^x.y.z`.** `next` and `eslint-config-next` are pinned to exact versions on purpose, because Next minors change behaviour this app relies on. Upgrade them with `npm install --save-exact`, and check the `package.json` diff before committing.

## Product conventions

- **Transcripts and transliterations are suggestions, never auto-applied.** The mic drops its transcript into the text box for the child to fix before submitting; the Kannada chip must be tapped. Single-word recognition is wrong often enough that both matter.
- **Every user-visible string is written for a 10-year-old**, in both English and Kannada — see the `LABELS` map in `ResultCards.tsx`. Add new copy in both languages.
- **Transliterate failures stay silent** (`/api/transliterate` returns `{ transliterated: "" }` on error): it's a convenience the child didn't ask for, so it must not produce an error card.
- **Three example sentences, deliberately varied.** The child uses them as patterns for writing their own sentences, so one isn't enough and three near-copies are no better. The prompt asks for a different topic each and, where the language allows, the word in a different position. The "Now make your own!" line under them is part of that loop.
- **Empty `antonyms` is a legitimate result** ("dog", "Tuesday"), rendered as a friendly line rather than an error. The prompt explicitly forbids inventing one.
- **Styling is hand-written CSS in `app/globals.css`** — a "sticker book" system of CSS custom properties (chunky radii, 3px outlines, hard offset shadows, tap targets sized for a tablet). No Tailwind, no CSS modules. Reuse the tokens at the top of that file.
- **`Baloo_Tamma_2` covers both Latin and Kannada**, which is why English and Kannada answers look like one app. Set `lang` on any element rendering answer text.
