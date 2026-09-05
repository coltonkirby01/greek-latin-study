import { describe, expect, it } from "vitest";
import { currentSessionDisplayName, mostRecentResumableSession } from "../src/features/study/multi-source-study-session";
import type { ManagedSession } from "../src/features/study/session-management";

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

describe("default session selection", () => {
  it("resumes the most recently reviewed explicit session", () => {
    const sessions: ManagedSession[] = [
      { id: "older", language: "Latin", sources: ["Dickinson Vocabulary"], startedAt: 10, lastReviewedAt: 100, reviews: 2 },
      { id: "newer", language: "Latin", sources: ["Henle Grammar Forms"], startedAt: 20, lastReviewedAt: 300, reviews: 3, name: "Current work" },
      { id: "legacy-Latin-0", language: "Latin", sources: ["Dickinson Vocabulary"], startedAt: 30, lastReviewedAt: 500, reviews: 4, inferred: true },
    ];
    expect(mostRecentResumableSession(sessions)?.id).toBe("newer");
  });

  it("returns no default when only inferred legacy sessions exist", () => {
    const sessions: ManagedSession[] = [
      { id: "legacy-Latin-0", language: "Latin", sources: ["Dickinson Vocabulary"], startedAt: 30, lastReviewedAt: 500, reviews: 4, inferred: true },
    ];
    expect(mostRecentResumableSession(sessions)).toBeNull();
  });
});
