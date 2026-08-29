"use client";

import { useEffect, useRef, useState } from "react";

import { MicButton } from "@/components/MicButton";
import type { Lang } from "@/types";

/** Only offer a Kannada spelling when the child is clearly typing roman letters. */
const ROMAN_ONLY = /^[a-zA-Z][a-zA-Z\s'-]*$/;
const DEBOUNCE_MS = 400;
const MIN_LENGTH_FOR_SUGGESTION = 2;

export function WordInput({
  value,
  onChange,
  onSubmit,
  onError,
  lang,
  busy,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (word: string) => void;
  onError: (message: string) => void;
  lang: Lang;
  busy: boolean;
}) {
  // Stored with the query it came from, so a suggestion for an older word is
  // never shown next to a newer one.
  const [suggestion, setSuggestion] = useState<{ query: string; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmed = value.trim();
  const eligible =
    lang === "kn" && trimmed.length >= MIN_LENGTH_FOR_SUGGESTION && ROMAN_ONLY.test(trimmed);

  /**
   * Kannada script is unreachable on a normal keyboard, so `naayi` gets offered
   * back as ನಾಯಿ. It is only ever a suggestion — silently rewriting what a child
   * typed is confusing, and it would break looking up an English word while the
   * answer language is Kannada.
   */
  useEffect(() => {
    if (!eligible) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/transliterate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: trimmed, lang }),
          signal: controller.signal,
        });
        const data = (await response.json()) as { transliterated?: string };
        const converted = data.transliterated?.trim() ?? "";
        setSuggestion({
          query: trimmed,
          // An unchanged string means there was nothing to convert.
          text: converted.toLowerCase() === trimmed.toLowerCase() ? "" : converted,
        });
      } catch {
        // A missing suggestion is not worth telling anyone about.
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [eligible, trimmed, lang]);

  const shownSuggestion =
    eligible && suggestion?.query === trimmed ? suggestion.text : "";

  function applySuggestion() {
    onChange(shownSuggestion);
    setSuggestion(null);
    inputRef.current?.focus();
  }

  /**
   * The input element is the source of truth at submit time, not React state.
   * A browser can put text in the box without React ever seeing an event —
   * autofill, form restore after a reload or a back-navigation, a password
   * manager, or the child typing before hydration attaches. Gating the button
   * on state that missed all of those strands them in front of a dead button
   * with their word already typed and no way to recover but retyping it.
   *
   * So: never disable on emptiness, read the DOM on the way through, and
   * re-sync state. An empty box just takes the cursor.
   */
  function submit() {
    const typed = (inputRef.current?.value ?? value).trim();
    if (!typed) {
      inputRef.current?.focus();
      return;
    }
    if (typed !== value) onChange(typed);
    onSubmit(typed);
  }

  return (
    <form
      className="search"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <label className="sr-only" htmlFor="word">
        Type a word
      </label>

      <div className="search__row">
        <input
          id="word"
          ref={inputRef}
          className="search__input"
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={lang === "kn" ? "ಪದ ಬರೆಯಿರಿ…" : "Type a word…"}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          maxLength={60}
          disabled={busy}
        />

        <MicButton
          lang={lang}
          disabled={busy}
          onError={onError}
          onTranscript={(transcript) => {
            onChange(transcript);
            inputRef.current?.focus();
          }}
        />
      </div>

      <button type="submit" className="go" disabled={busy}>
        {busy ? "Casting…" : "✨ Find out!"}
      </button>

      {shownSuggestion && (
        <div className="suggest">
          <span className="suggest__label">Did you mean</span>
          <button type="button" className="suggest__chip" lang="kn" onClick={applySuggestion}>
            {shownSuggestion}
          </button>
          <span className="suggest__label">?</span>
        </div>
      )}

      <p className="hint">🎤 Say a word, then check it&rsquo;s right before you tap Find out!</p>
    </form>
  );
}
