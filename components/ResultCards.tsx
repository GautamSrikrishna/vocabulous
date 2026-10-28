"use client";

import { SpeakButton } from "@/components/SpeakButton";
import type { Lang, LookupResponse } from "@/types";

/** Card headings in both languages, so the whole screen switches together. */
const LABELS = {
  en: {
    meaning: "What it means",
    synonym: "Same-team words",
    antonym: "Opposite words",
    sentence: "Use it in a sentence",
    noAntonym: "This word doesn't really have an opposite!",
    noSynonym: "I couldn't find a good match for this one.",
    hearWord: "Hear the word",
    hearSentence: "Hear the sentence",
    tryYourOwn: "Now make your own! ✏️",
  },
  kn: {
    meaning: "ಅರ್ಥ",
    synonym: "ಸಮಾನಾರ್ಥಕ ಪದಗಳು",
    antonym: "ವಿರುದ್ಧಾರ್ಥಕ ಪದಗಳು",
    sentence: "ವಾಕ್ಯದಲ್ಲಿ ಬಳಸಿ",
    noAntonym: "ಈ ಪದಕ್ಕೆ ವಿರುದ್ಧಾರ್ಥಕ ಪದವಿಲ್ಲ!",
    noSynonym: "ಈ ಪದಕ್ಕೆ ಸರಿಯಾದ ಸಮಾನಾರ್ಥಕ ಪದ ಸಿಗಲಿಲ್ಲ.",
    hearWord: "ಪದವನ್ನು ಕೇಳಿ",
    hearSentence: "ವಾಕ್ಯವನ್ನು ಕೇಳಿ",
    tryYourOwn: "ಈಗ ನೀನೇ ಒಂದು ವಾಕ್ಯ ಮಾಡು! ✏️",
  },
} as const satisfies Record<Lang, Record<string, string>>;

function WordChips({ words, emptyText, lang }: { words: string[]; emptyText: string; lang: Lang }) {
  if (words.length === 0) {
    return (
      <p className="card__empty" lang={lang}>
        {emptyText}
      </p>
    );
  }
  return (
    <ul className="card__chips">
      {words.map((word) => (
        <li key={word} className="card__chip" lang={lang}>
          {word}
        </li>
      ))}
    </ul>
  );
}

export function ResultCards({ result }: { result: LookupResponse }) {
  const { lang } = result;
  const text = LABELS[lang];

  return (
    <div className="results">
      <div className="headword">
        <h2 className="headword__word" lang={lang}>
          {result.word}
        </h2>
        {result.partOfSpeech && (
          <span className="headword__pos" lang={lang}>
            {result.partOfSpeech}
          </span>
        )}
        <SpeakButton text={result.word} lang={lang} label={text.hearWord} />
      </div>

      <section className="card card--meaning">
        <h3 className="card__title" lang={lang}>
          <span aria-hidden="true">💛</span> {text.meaning}
        </h3>
        <p className="card__body" lang={lang}>
          {result.meaning}
        </p>
      </section>

      <section className="card card--synonym">
        <h3 className="card__title" lang={lang}>
          <span aria-hidden="true">💚</span> {text.synonym}
        </h3>
        <WordChips words={result.synonyms} emptyText={text.noSynonym} lang={lang} />
      </section>

      <section className="card card--antonym">
        <h3 className="card__title" lang={lang}>
          <span aria-hidden="true">❤️</span> {text.antonym}
        </h3>
        <WordChips words={result.antonyms} emptyText={text.noAntonym} lang={lang} />
      </section>

      <section className="card card--sentence">
        <h3 className="card__title" lang={lang}>
          <span aria-hidden="true">💜</span> {text.sentence}
        </h3>
        <ol className="card__sentences">
          {result.exampleSentences.map((sentence, i) => (
            <li key={sentence} className="card__sentence">
              <p className="card__body" lang={lang}>
                {sentence}
              </p>
              <SpeakButton text={sentence} lang={lang} label={`${text.hearSentence} ${i + 1}`} />
            </li>
          ))}
        </ol>
        <p className="card__nudge" lang={lang}>
          {text.tryYourOwn}
        </p>
      </section>
    </div>
  );
}
