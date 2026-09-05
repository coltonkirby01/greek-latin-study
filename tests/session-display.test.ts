import { describe, expect, it } from "vitest";
import { currentSessionDisplayName } from "../src/features/study/multi-source-study-session";

describe("current study session display name", () => {
  it("shows a custom session name without appending a time", () => {
    expect(currentSessionDisplayName("Latin", ["Dickinson Vocabulary"], "Friday quiz practice")).toBe("Friday quiz practice");
  });

  it("shows a source-based default name without a timestamp", () => {
    expect(currentSessionDisplayName("Latin", ["Dickinson Vocabulary"])).toBe("Latin · Dickinson Vocabulary");
    expect(currentSessionDisplayName("Latin", ["Dickinson Vocabulary", "Henle Grammar Forms"])).toBe("Latin · Dickinson Vocabulary + Henle Grammar Forms");
  });

  it("uses a stable mixed-study default when more than two sources are active", () => {
    expect(currentSessionDisplayName("Greek", ["Lessons 1–2", "Lesson 3 Vocabulary", "Lesson 3 Grammar"])).toBe("Greek · Mixed study");
  });
});
