"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ApiErrorBody, Lang } from "@/types";

/** Plenty for one word, and a hard stop if the button is left running. */
const MAX_RECORDING_MS = 10_000;

/** Below this the recording is almost certainly silence or a stray tap. */
const MIN_BLOB_BYTES = 1_000;

/** Sarvam accepts all of these directly, so nothing is transcoded in the browser. */
const PREFERRED_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

function pickMimeType(): string | undefined {
  return PREFERRED_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

/**
 * Checked at click time rather than on mount: the APIs don't exist during
 * server rendering, and testing for them in an effect would mean a render pass
 * where the button briefly disagrees with the server's markup.
 */
function canRecord(): boolean {
  return (
    typeof MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

/**
 * Tap to start, tap again to stop. The transcript is handed back to the parent
 * to drop into the text box — it deliberately does not run the lookup, because
 * single-word recognition is wrong often enough that the child should see and
 * fix the word before the wizard answers.
 */
export function MicButton({
  lang,
  onTranscript,
  onError,
  disabled,
}: {
  lang: Lang;
  onTranscript: (transcript: string) => void;
  onError: (message: string) => void;
  disabled?: boolean;
}) {
  const [recording, setRecording] = useState(false);
  const [sending, setSending] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      clearTimer();
      recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    },
    [clearTimer],
  );

  const send = useCallback(
    async (blob: Blob) => {
      setSending(true);
      try {
        const form = new FormData();
        form.append("audio", blob, "speech");
        form.append("lang", lang);

        const response = await fetch("/api/transcribe", { method: "POST", body: form });
        const data = (await response.json()) as { transcript?: string } & Partial<ApiErrorBody>;

        if (!response.ok) {
          onError(data.error ?? "I couldn't hear that — try again! 🎤");
          return;
        }
        if (data.transcript) onTranscript(data.transcript);
      } catch {
        onError("I couldn't hear that — try again! 🎤");
      } finally {
        setSending(false);
      }
    },
    [lang, onError, onTranscript],
  );

  const stop = useCallback(() => {
    clearTimer();
    recorderRef.current?.stop();
  }, [clearTimer]);

  const start = useCallback(async () => {
    if (!canRecord()) {
      onError("This browser can't record sound — you can type the word instead! ⌨️");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      const denied = error instanceof DOMException && error.name === "NotAllowedError";
      onError(
        denied
          ? "I need permission to use the microphone. Ask a grown-up to allow it! 🎤"
          : "I couldn't find a microphone on this device.",
      );
      return;
    }

    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      recorderRef.current = null;
      setRecording(false);

      const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
      if (blob.size < MIN_BLOB_BYTES) {
        onError("That was very quiet! Try saying the word again. 🎤");
        return;
      }
      void send(blob);
    };

    recorderRef.current = recorder;
    recorder.start();
    setRecording(true);
    timerRef.current = setTimeout(stop, MAX_RECORDING_MS);
  }, [onError, send, stop]);

  const label = recording ? "Stop recording" : "Say the word out loud";

  return (
    <button
      type="button"
      className={`mic${recording ? " mic--recording" : ""}`}
      onClick={() => (recording ? stop() : void start())}
      disabled={disabled || sending}
      aria-label={label}
      title={label}
      aria-pressed={recording}
    >
      <span aria-hidden="true">{sending ? "⏳" : recording ? "⏹️" : "🎤"}</span>
    </button>
  );
}
