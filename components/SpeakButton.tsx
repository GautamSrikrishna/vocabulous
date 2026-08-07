"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { Lang } from "@/types";

/**
 * Reads a word or sentence out loud in the answer language.
 *
 * The fetched MP3 is kept for as long as the text doesn't change, so pressing
 * the button five times in a row — which a child absolutely will — costs one
 * API call.
 */
export function SpeakButton({
  text,
  lang,
  label,
}: {
  text: string;
  lang: Lang;
  label: string;
}) {
  const [playing, setPlaying] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cacheRef = useRef<{ key: string; url: string } | null>(null);

  const releaseCache = useCallback(() => {
    if (cacheRef.current) {
      URL.revokeObjectURL(cacheRef.current.url);
      cacheRef.current = null;
    }
  }, []);

  // Drop the cached audio whenever the thing being spoken changes.
  const cacheKey = `${lang}|${text}`;
  useEffect(() => {
    if (cacheRef.current && cacheRef.current.key !== cacheKey) releaseCache();
  }, [cacheKey, releaseCache]);

  useEffect(
    () => () => {
      audioRef.current?.pause();
      releaseCache();
    },
    [releaseCache],
  );

  const play = useCallback(async () => {
    if (playing || !text.trim()) return;
    setPlaying(true);

    try {
      let url = cacheRef.current?.key === cacheKey ? cacheRef.current.url : null;

      if (!url) {
        const response = await fetch("/api/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, lang }),
        });
        if (!response.ok) throw new Error(`speak failed: ${response.status}`);

        url = URL.createObjectURL(await response.blob());
        releaseCache();
        cacheRef.current = { key: cacheKey, url };
      }

      const audio = new Audio(url);
      audioRef.current = audio;
      audio.addEventListener("ended", () => setPlaying(false), { once: true });
      audio.addEventListener("error", () => setPlaying(false), { once: true });
      await audio.play();
    } catch {
      // Nothing to say to the child here — a silent button is better than an
      // error box for something they can simply press again.
      setPlaying(false);
    }
  }, [cacheKey, lang, playing, releaseCache, text]);

  return (
    <button
      type="button"
      className={`speak${playing ? " speak--playing" : ""}`}
      onClick={() => void play()}
      disabled={playing}
      aria-label={label}
      title={label}
    >
      <span aria-hidden="true">🔊</span>
    </button>
  );
}
