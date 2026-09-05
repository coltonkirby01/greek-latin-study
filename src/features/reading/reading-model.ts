import type { WordTiming } from "./reading-service";

export type ReadingToken = {
  value: string;
  wordIndex: number | null;
  start: number;
  end: number;
};

export type SentenceRange = {
  text: string;
  start: number;
  end: number;
  firstWord: number;
  lastWord: number;
};

export function tokenizeReading(text: string) {
  const tokens: ReadingToken[] = [];
  let cursor = 0;
  let wordIndex = 0;
  for (const value of text.match(/\s+|[^\s]+/gu) ?? []) {
    const isWord = /\S/u.test(value);
    tokens.push({ value, wordIndex: isWord ? wordIndex++ : null, start: cursor, end: cursor + value.length });
    cursor += value.length;
  }
  return tokens;
}

export function sentenceRanges(text: string, tokens = tokenizeReading(text)) {
  const fallback = [{ segment: text, index: 0 }];
  const Segmenter = (Intl as typeof Intl & { Segmenter?: new (locale?: string, options?: { granularity: "sentence" }) => { segment(input: string): Iterable<{ segment: string; index: number }> } }).Segmenter;
  const segments = Segmenter
    ? [...new Segmenter(undefined, { granularity: "sentence" }).segment(text)]
    : fallback;
  return segments.filter((item) => item.segment.trim()).map((item) => {
    const start = item.index;
    const end = start + item.segment.length;
    const words = tokens.filter((token) => token.wordIndex !== null && token.start >= start && token.start < end);
    return {
      text: item.segment,
      start,
      end,
      firstWord: words[0]?.wordIndex ?? 0,
      lastWord: words.at(-1)?.wordIndex ?? 0,
    } satisfies SentenceRange;
  });
}

export function activeWordAt(timings: WordTiming[], currentTimeMs: number) {
  return timings.find((timing) => currentTimeMs >= timing.startMs && currentTimeMs < timing.endMs)?.index ?? null;
}

export function wordAtCharacter(tokens: ReadingToken[], characterIndex: number) {
  return tokens.find((token) => token.wordIndex !== null && characterIndex >= token.start && characterIndex < token.end)?.wordIndex ?? null;
}
