"use client";

import { useCallback, useSyncExternalStore } from "react";

import { isLang, type Lang } from "@/types";

/**
 * Preferences kept in `localStorage`, exposed through `useSyncExternalStore`.
 *
 * That hook rather than an effect, for two reasons: the server has no
 * `localStorage`, so a distinct server snapshot is what keeps hydration honest,
 * and reading storage in an effect would mean a setState cascade on every mount.
 *
 * Every access is wrapped, because storage *throws* rather than returning null
 * in a private window or when a browser is set to block site data. A child who
 * loses their word history should still get a working app.
 */

const LANG_KEY = "vocabulous.lang";
const RECENT_KEY = "vocabulous.recent";

/** Enough to cover a spelling list without turning into a wall of chips. */
export const MAX_RECENT = 8;

/* ---------------------------------------------------------------- store --- */

const listeners = new Set<() => void>();

/**
 * `undefined` means "not read yet". Snapshots must be cached and referentially
 * stable, or `useSyncExternalStore` re-renders forever.
 */
let langCache: Lang | undefined;
let recentCache: string[] | undefined;

/** A frozen shared empty list, so the server snapshot never changes identity. */
const NO_WORDS: string[] = [];

function invalidate() {
  langCache = undefined;
  recentCache = undefined;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // A second window on the same app should not drift out of step.
  if (listeners.size === 1) window.addEventListener("storage", invalidate);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", invalidate);
  };
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Not worth telling anyone about; the value still holds for this session.
  }
}

/* ----------------------------------------------------------------- lang --- */

function getLang(): Lang {
  if (langCache === undefined) {
    const stored = read(LANG_KEY);
    langCache = isLang(stored) ? stored : "en";
  }
  return langCache;
}

/** English until the browser tells us otherwise. */
function getServerLang(): Lang {
  return "en";
}

/** The answer language, remembered across sessions. */
export function useLang(): [Lang, (next: Lang) => void] {
  const lang = useSyncExternalStore(subscribe, getLang, getServerLang);

  const setLang = useCallback((next: Lang) => {
    write(LANG_KEY, next);
    invalidate();
  }, []);

  return [lang, setLang];
}

/* --------------------------------------------------------------- recent --- */

function getRecent(): string[] {
  if (recentCache === undefined) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(read(RECENT_KEY) ?? "[]");
    } catch {
      parsed = null;
    }
    recentCache = Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string").slice(0, MAX_RECENT)
      : NO_WORDS;
  }
  return recentCache;
}

function getServerRecent(): string[] {
  return NO_WORDS;
}

/** The words looked up before, newest first, with a way to add one. */
export function useRecentWords(): [string[], (word: string) => void] {
  const recent = useSyncExternalStore(subscribe, getRecent, getServerRecent);

  const remember = useCallback((word: string) => {
    const trimmed = word.trim();
    if (!trimmed) return;

    const key = trimmed.toLowerCase();
    const next = [trimmed, ...getRecent().filter((item) => item.toLowerCase() !== key)].slice(
      0,
      MAX_RECENT,
    );

    write(RECENT_KEY, JSON.stringify(next));
    invalidate();
  }, []);

  return [recent, remember];
}
