"use client";

import { useEffect } from "react";

import { Wizard } from "@/components/Wizard";

/**
 * The last line of defence: a render-time throw anywhere on the page lands
 * here instead of on Next's error screen, which is a wall of stack frames in
 * development and a bare "Application error" in production. Neither is any use
 * to a ten-year-old sitting alone with their homework.
 *
 * `retry` (stable since Next 16.3) re-renders the segment; `reset` would only
 * clear the boundary without re-fetching.
 */
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    // The detail belongs in the terminal, not on screen.
    console.error("[page] unhandled error", error);
  }, [error]);

  return (
    <main className="page">
      <header className="header">
        <Wizard state="idle" />
        <h1 className="title">Oh no!</h1>
        <p className="tagline">My spell went wrong. That&rsquo;s my fault, not yours! 🪄</p>
      </header>

      <div className="status">
        <div className="status__card">
          <p>Let&rsquo;s try that again.</p>
          <button type="button" className="retry" onClick={() => retry()}>
            Try again
          </button>
        </div>
      </div>

      <footer className="footer">
        <p>If it keeps happening, ask a grown-up to check the wizard&rsquo;s spellbook.</p>
      </footer>
    </main>
  );
}
