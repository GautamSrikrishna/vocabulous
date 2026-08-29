"use client";

/** Kannada block. Used only to tag a chip's language for screen readers. */
const KANNADA = /[ಀ-೿]/;

/**
 * The words already looked up, newest first. Homework revisits the same
 * spelling list for days, so this turns the second evening into a tap.
 *
 * Picking one re-runs it in whatever language the toggle is set to now — the
 * chips store what was typed, not what came back.
 */
export function RecentWords({
  words,
  onPick,
  disabled,
}: {
  words: string[];
  onPick: (word: string) => void;
  disabled?: boolean;
}) {
  if (words.length === 0) return null;

  return (
    <section className="recent" aria-label="Words you looked up before">
      <h2 className="recent__title">Words you&rsquo;ve looked up</h2>
      <ul className="recent__list">
        {words.map((word) => (
          <li key={word.toLowerCase()}>
            <button
              type="button"
              className="recent__chip"
              lang={KANNADA.test(word) ? "kn" : "en"}
              disabled={disabled}
              onClick={() => onPick(word)}
            >
              {word}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
