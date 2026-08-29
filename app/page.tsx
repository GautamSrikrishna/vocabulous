"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { LanguageToggle } from "@/components/LanguageToggle";
import { RecentWords } from "@/components/RecentWords";
import { ResultCards } from "@/components/ResultCards";
import { WordInput } from "@/components/WordInput";
import { Wizard, type WizardState } from "@/components/Wizard";
import { useLang, useRecentWords } from "@/lib/prefs";
import type { ApiErrorBody, Lang, LookupResponse } from "@/types";

const SPELL_MESSAGES = [
  "Mixing the potion…",
  "Checking my spellbook…",
  "Asking the owls…",
  "Stirring up some words…",
];

const NOT_FOUND_MESSAGE = "I don't know that word yet — check the spelling? 🔍";
const NOT_SUITABLE_MESSAGE = "Let's try a different word! 🪄";

type Phase = "idle" | "loading" | "done" | "error";

export default function Home() {
  const [lang, setLang] = useLang();
  const [recent, remember] = useRecentWords();
  const [word, setWord] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<LookupResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [spell, setSpell] = useState(SPELL_MESSAGES[0]);

  /** The word that produced what's on screen — used to redo it in the other language. */
  const [lastWord, setLastWord] = useState("");
  /** Guards against a slow first request overwriting a fast second one. */
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (phase !== "loading") return;
    const timer = setInterval(() => {
      setSpell(SPELL_MESSAGES[Math.floor(Math.random() * SPELL_MESSAGES.length)]);
    }, 1600);
    return () => clearInterval(timer);
  }, [phase]);

  const lookup = useCallback(async (rawWord: string, outputLang: Lang) => {
    const trimmed = rawWord.trim();
    if (!trimmed) return;

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setLastWord(trimmed);
    setPhase("loading");
    setError(null);
    setSpell(SPELL_MESSAGES[Math.floor(Math.random() * SPELL_MESSAGES.length)]);

    try {
      const response = await fetch("/api/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: trimmed, outputLang }),
      });
      const data = (await response.json()) as LookupResponse & Partial<ApiErrorBody>;

      if (requestIdRef.current !== requestId) return; // a newer lookup won

      if (!response.ok) {
        setError(data.error ?? "My spellbook got stuck! Try again. 🪄");
        setPhase("error");
        return;
      }

      if (data.status === "unknown_word") {
        setError(NOT_FOUND_MESSAGE);
        setPhase("error");
        return;
      }
      if (data.status === "not_kid_appropriate") {
        setError(NOT_SUITABLE_MESSAGE);
        setPhase("error");
        return;
      }

      setResult(data);
      setPhase("done");
      remember(trimmed);
    } catch {
      if (requestIdRef.current !== requestId) return;
      setError("I couldn't reach my spellbook. Is the internet working?");
      setPhase("error");
    }
  }, [remember]);

  /** Flipping the toggle re-asks the same word in the new language. */
  function changeLanguage(next: Lang) {
    if (next === lang) return;
    setLang(next);
    setResult(null);
    if (lastWord) void lookup(lastWord, next);
  }

  const wizardState: WizardState =
    phase === "loading" ? "thinking" : phase === "done" ? "celebrating" : "idle";

  return (
    <main className="page">
      <header className="header">
        <Wizard state={wizardState} />
        <h1 className="title">Vocabulous</h1>
        <p className="tagline">Type or say a word — I&rsquo;ll do the rest! ✨</p>
        <LanguageToggle value={lang} onChange={changeLanguage} disabled={phase === "loading"} />
      </header>

      <WordInput
        value={word}
        onChange={setWord}
        onSubmit={(typed) => void lookup(typed, lang)}
        onError={(message) => {
          setError(message);
          setPhase("error");
        }}
        lang={lang}
        busy={phase === "loading"}
      />

      <RecentWords
        words={recent}
        disabled={phase === "loading"}
        onPick={(picked) => {
          setWord(picked);
          void lookup(picked, lang);
        }}
      />

      <div aria-live="polite">
        {phase === "loading" && (
          <div className="status">
            <p className="status__text">{spell}</p>
          </div>
        )}

        {phase === "error" && error && (
          <div className="status">
            <div className="status__card">
              <p>{error}</p>
              {lastWord && (
                <button
                  type="button"
                  className="retry"
                  onClick={() => void lookup(lastWord, lang)}
                >
                  Try again
                </button>
              )}
            </div>
          </div>
        )}

        {phase === "done" && result && <ResultCards result={result} />}
      </div>

      <footer className="footer">
        <p>Made for word wizards in training 🧙</p>
      </footer>
    </main>
  );
}
