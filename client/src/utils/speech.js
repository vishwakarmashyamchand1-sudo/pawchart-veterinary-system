/**
 * Web Speech API wrapper for audio recording/transcription.
 * Supports English, Hindi (Devanagari script), and Hinglish (Roman-script Hindi)
 * Adapted from doc-automation project's browser-based speech recognition.
 */

export const SUPPORTED_LANGUAGES = [
  { code: "en-US", label: "English (US)", name: "english" },
  { code: "en-IN", label: "English (India)", name: "english" },
  { code: "hi-IN", label: "Hindi (हिंदी)", name: "hindi" },
  { code: "hi", label: "Hinglish (Roman Hindi)", name: "hinglish" },
];

export function createSpeechRecognition({
  language = "en-US",
  onInterim,
  onFinal,
  onError,
  onEnd,
}) {
  const SpeechRecognition =
    typeof window !== "undefined"
      ? window.webkitSpeechRecognition || window.SpeechRecognition
      : null;

  if (!SpeechRecognition) {
    onError?.(
      "Browser doesn't support Web Speech API. Use Chrome, Edge, or Safari.",
    );
    return null;
  }

  let shouldRestart = false;
  let currentInstance = null;
  let restartDelay = 200;

  function createInstance() {
    const rec = new SpeechRecognition();
    rec.lang = language;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.continuous = true;

    rec.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          onFinal?.(result[0].transcript.trim());
        } else {
          interim += result[0].transcript;
        }
      }
      if (interim) onInterim?.(interim);
    };

    rec.onerror = (ev) => {
      // no-speech: silence detected — will auto-restart via onend, ignore
      // aborted: we called stop() intentionally — ignore
      if (ev.error === "no-speech" || ev.error === "aborted") return;

      // network: transient Google speech server hiccup — restart with backoff, no toast
      if (ev.error === "network") {
        restartDelay = 1500;
        return;
      }

      // Fatal errors (audio-capture, not-allowed, service-not-allowed) — notify user
      onError?.(ev.error || "Recognition error");
    };

    rec.onend = () => {
      if (!shouldRestart) {
        onEnd?.();
        return;
      }

      // ALWAYS create a FRESH instance — calling .start() on an ended instance
      // throws InvalidStateError in Chrome and silently kills the session.
      const delay = restartDelay;
      restartDelay = 200;

      setTimeout(() => {
        if (!shouldRestart) return;
        try {
          currentInstance = createInstance();
          currentInstance.start();
        } catch (e) {
          // One retry after a longer pause
          setTimeout(() => {
            if (!shouldRestart) return;
            try {
              currentInstance = createInstance();
              currentInstance.start();
            } catch (e2) {
              onError?.("Could not resume recording. Please stop and restart.");
            }
          }, 1500);
        }
      }, delay);
    };

    return rec;
  }

  return {
    start() {
      shouldRestart = true;
      restartDelay = 200;
      currentInstance = createInstance();
      try {
        currentInstance.start();
      } catch (e) {
        /* ignore */
      }
    },
    stop() {
      shouldRestart = false;
      try {
        currentInstance?.stop();
      } catch (e) {
        /* ignore */
      }
      currentInstance = null;
    },
  };
}
