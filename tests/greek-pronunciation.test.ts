import { describe, expect, it } from "vitest";
import { classicalGreekPronunciation } from "../src/features/greek/greek-pronunciation";

describe("Classical Greek pronunciation guide", () => {
  it("romanizes accented vocabulary while preserving vowel length", () => {
    expect(classicalGreekPronunciation("γράφω")).toBe("gráphō");
    expect(classicalGreekPronunciation("ἐθέλω")).toBe("ethélō");
    expect(classicalGreekPronunciation("μή")).toBe("mḗ");
  });

  it("handles vocabulary variants and punctuation without hand-written entries", () => {
    expect(classicalGreekPronunciation("οὐ, οὐκ, οὐχ")).toBe("ou, ouk, oukh");
    expect(classicalGreekPronunciation("καὶ … καί")).toBe("kaì … kaí");
  });
});
