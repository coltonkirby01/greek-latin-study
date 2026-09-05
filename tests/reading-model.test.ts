import { describe, expect, it } from "vitest";
import { activeWordAt, sentenceRanges, tokenizeReading, wordAtCharacter } from "../src/features/reading/reading-model";

describe("timestamp-driven reading", () => {
  it("maps audio time to supplied word timestamps without guessing", () => {
    const timings = [{ index: 0, startMs: 0, endMs: 400 }, { index: 1, startMs: 400, endMs: 900 }];
    expect(activeWordAt(timings, 650)).toBe(1);
    expect(activeWordAt(timings, 1_000)).toBeNull();
  });
  it("maps real speech boundary character offsets to words", () => {
    const tokens = tokenizeReading("Κάμηλος θεασαμένη.");
    expect(wordAtCharacter(tokens, 0)).toBe(0);
    expect(wordAtCharacter(tokens, 9)).toBe(1);
    expect(sentenceRanges("Gallia est. Roma manet.", tokenizeReading("Gallia est. Roma manet."))).toHaveLength(2);
  });
});
