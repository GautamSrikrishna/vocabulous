export type WizardState = "idle" | "thinking" | "celebrating";

/**
 * The mascot. Drawn inline so there is no image to load and the colours stay
 * tied to the stylesheet. The eyes turn into happy arcs when celebrating.
 */
export function Wizard({ state = "idle" }: { state?: WizardState }) {
  const celebrating = state === "celebrating";

  return (
    <svg
      className={`wizard wizard--${state}`}
      viewBox="0 0 120 120"
      role="img"
      aria-label="A friendly word wizard"
    >
      {/* Sparkles — animated only while thinking or celebrating */}
      <g fill="#ffd166" stroke="#2d2150" strokeWidth="2" strokeLinejoin="round">
        <path className="wizard__sparkle" d="M18 34 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 z" />
        <path className="wizard__sparkle" d="M102 46 l2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5 z" />
        <path className="wizard__sparkle" d="M96 18 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 z" />
      </g>

      <g stroke="#2d2150" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round">
        {/* Hat */}
        <path d="M60 14 C 68 30, 76 44, 82 58 L 38 58 C 44 44, 52 30, 60 14 Z" fill="#7b3ff2" />
        {/* Hat brim */}
        <ellipse cx="60" cy="59" rx="30" ry="7.5" fill="#6a3fd6" />
        {/* Stars on the hat */}
        <path
          d="M60 30 l2.2 5 5.4 .5 -4 3.7 1.2 5.3 -4.8 -2.8 -4.8 2.8 1.2 -5.3 -4 -3.7 5.4 -.5 z"
          fill="#ffd166"
          strokeWidth="2"
        />

        {/* Face */}
        <circle cx="60" cy="76" r="19" fill="#f7c99b" />

        {/* Eyes */}
        {celebrating ? (
          <>
            <path d="M52 73 q3.5 -4 7 0" fill="none" strokeWidth="3" />
            <path d="M61 73 q3.5 -4 7 0" fill="none" strokeWidth="3" />
          </>
        ) : (
          <>
            <circle cx="54.5" cy="73" r="2.6" fill="#2d2150" stroke="none" />
            <circle cx="65.5" cy="73" r="2.6" fill="#2d2150" stroke="none" />
          </>
        )}

        {/* Rosy cheeks */}
        <circle cx="48.5" cy="80" r="3.6" fill="#ff9db0" stroke="none" />
        <circle cx="71.5" cy="80" r="3.6" fill="#ff9db0" stroke="none" />

        {/* Beard */}
        <path
          d="M44 82 q1 14 16 18 q15 -4 16 -18 q-6 5 -16 5 q-10 0 -16 -5 z"
          fill="#fffdf7"
        />
      </g>
    </svg>
  );
}
