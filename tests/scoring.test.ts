import { describe, expect, it } from "vitest";
import { blankCardProgress } from "../src/features/study/engine";
import { intrinsicCardDifficulty, scoreTier, scoredSession, userProficiencyScore } from "../src/features/study/scoring";
import type { CardProgress, StudyCard } from "../src/features/study/types";

function mastered(overrides: Partial<CardProgress> = {}): CardProgress {
  return { ...blankCardProgress(), reviews: 5, right: 5, easy: 3, medium: 2, initialMastered: true, streak: 5, bestStreak: 5, lastResult: "right", responseTimeCount: 5, responseTimeTotalMs: 10_000, lastResponseTimeMs: 2_000, ...overrides };
}

const greekCards: StudyCard[] = [
  { id: "g2", deckId: "g", front: "a", back: "a", rank: 1, metadata: { lesson: 2, studySource: "grammar-form" } },
  { id: "g5", deckId: "g", front: "b", back: "b", rank: 2, metadata: { lesson: 5, studySource: "grammar-form" } },
];
const latinCards: StudyCard[] = [
  { id: "l1", deckId: "l", front: "sum", back: "be", rank: 1 },
  { id: "l997", deckId: "l", front: "rare", back: "rare", rank: 997 },
];

const greekContext = { language: "Greek" as const, source: "Lesson grammar", cards: greekCards };
const latinContext = { language: "Latin" as const, source: "Dickinson Vocabulary", cards: latinCards };

describe("difficulty and proficiency scoring", () => {
  it("makes later Greek lessons intrinsically harder", () => {
    expect(intrinsicCardDifficulty(greekContext, greekCards[1])).toBeGreaterThan(intrinsicCardDifficulty(greekContext, greekCards[0]));
  });

  it("makes rarer Dickinson vocabulary intrinsically harder", () => {
    expect(intrinsicCardDifficulty(latinContext, latinCards[1])).toBeGreaterThan(intrinsicCardDifficulty(latinContext, latinCards[0]));
  });

  it("does not reward difficulty without demonstrated performance", () => {
    const strong = userProficiencyScore([{ context: greekContext, card: greekCards[1], progress: mastered() }]);
    const weak = userProficiencyScore([{ context: greekContext, card: greekCards[1], progress: mastered({ right: 1, wrong: 4, initialMastered: false, streak: 0, bestStreak: 0, lastResult: "wrong", responseTimeTotalMs: 60_000 }) }]);
    expect(strong.score).toBeGreaterThan(weak.score);
  });

  it("rewards harder accurate sessions more than equally accurate easier sessions", () => {
    const easy = scoredSession(Array.from({ length: 5 }, () => ({ result: "right" as const, responseTimeMs: 2_000, intrinsicDifficulty: 20 })));
    const hard = scoredSession(Array.from({ length: 5 }, () => ({ result: "right" as const, responseTimeMs: 2_000, intrinsicDifficulty: 85 })));
    expect(hard).toBeGreaterThan(easy);
  });

  it("uses stable tier boundaries", () => {
    expect(scoreTier(19)).toBe("Novice");
    expect(scoreTier(20)).toBe("Developing");
    expect(scoreTier(40)).toBe("Proficient");
    expect(scoreTier(60)).toBe("Advanced");
    expect(scoreTier(75)).toBe("Expert");
    expect(scoreTier(90)).toBe("Master");
  });
});
