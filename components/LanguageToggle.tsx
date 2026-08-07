"use client";

import type { Lang } from "@/types";

/**
 * Picks the language of the *answer*. The word itself can be typed in either
 * language — the wizard works that out on its own.
 */
export function LanguageToggle({
  value,
  onChange,
  disabled,
}: {
  value: Lang;
  onChange: (lang: Lang) => void;
  disabled?: boolean;
}) {
  return (
    <div className="toggle" role="group" aria-label="Answer language">
      <button
        type="button"
        className="toggle__option"
        aria-pressed={value === "en"}
        disabled={disabled}
        onClick={() => onChange("en")}
      >
        ABC
      </button>
      <button
        type="button"
        className="toggle__option"
        aria-pressed={value === "kn"}
        disabled={disabled}
        onClick={() => onChange("kn")}
        lang="kn"
      >
        ಕನ್ನಡ
      </button>
    </div>
  );
}
