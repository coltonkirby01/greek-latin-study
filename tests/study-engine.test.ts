import { describe, expect, it } from "vitest";
import { createEnvelope, createModeState, directionalCopy, formatResponseTime, getCardProgress, maybeUnlockNextBatch, presentCard, priorityScore, recordReview, reviewAndAdvance, skipAndAdvance } from "../src/features/study/engine";
import { mergeProgressEnvelopes } from "../src/features/study/progress-repository";
import { blankTimerLedger, pauseTimer, readTimer, resumeTimer } from "../src/features/study/timer-ledger";
import type { StudyCard } from "../src/features/study/types";

const cards: StudyCard[] = [
  { id: "one", deckId: "test", front: "amō", back: "I love", reverseFront: "I love", reverseBack: "amō", rank: 1 },
  { id: "two", deckId: "test", front: "videō", back: "I see", reverseFront: "I see", reverseBack: "videō", rank: 2 },
];

describe("unified study engine", () => {
  it("formats every timer to hundredths", () => {
    expect(formatResponseTime(3_474)).toBe("3.47 s");
    expect(formatResponseTime(0)).toBe("0.00 s");
  });

  it("does not count time while the timer is paused for a hidden tab", () => {
    let timer = resumeTimer(blankTimerLedger(), 100);
    timer = pauseTimer(timer, 1_100);
    expect(readTimer(timer, 61_100)).toBe(1_000);
    timer = resumeTimer(timer, 61_100);
    expect(readTimer(timer, 61_600)).toBe(1_500);
  });

  it("provides a logical reverse prompt and answer", () => {
    expect(directionalCopy(cards[0], "reverse")).toMatchObject({ prompt: "I love", answer: "amō" });
  });

  it("keeps forward and reverse state independent and merges both for cloud sync", () => {
    const local = createEnvelope("test", 1), remote = createEnvelope("test", 1);
    local.modes.forward = createModeState("test", "forward", 2, undefined, 2);
    remote.modes.reverse = createModeState("test", "reverse", 2, undefined, 3);
    const merged = mergeProgressEnvelopes(local, remote)!;
    expect(Object.keys(merged.modes).sort()).toEqual(["forward", "reverse"]);
    expect(merged.modes.forward.cards).not.toBe(merged.modes.reverse.cards);
  });

  it("records correctness, difficulty, and response time independently", () => {
    let state = presentCard(createModeState("test", "forward", 2, undefined, 1), cards[0], 2);
    state = recordReview(state, cards[0], { id: "r1", result: "wrong", difficulty: "easy", responseTimeMs: 1_234, reviewedAt: 3 });
    expect(getCardProgress(state, "one")).toMatchObject({ wrong: 1, easy: 1, lastResponseTimeMs: 1_234 });
  });

  it("gives slow correct recall a shorter interval and higher priority", () => {
    const base = presentCard(createModeState("test", "forward", 2), cards[0]);
    const fast = recordReview(base, cards[0], { id: "fast", result: "right", difficulty: "easy", responseTimeMs: 2_000, reviewedAt: 10_000 });
    const slow = recordReview(base, cards[0], { id: "slow", result: "right", difficulty: "easy", responseTimeMs: 32_000, reviewedAt: 10_000 });
    expect(getCardProgress(slow, "one").intervalMs).toBeLessThan(getCardProgress(fast, "one").intervalMs);
    expect(priorityScore(cards[0], slow, { ignoreRecency: true, now: 10_001 })).toBeGreaterThan(priorityScore(cards[0], fast, { ignoreRecency: true, now: 10_001 }));
  });

  it("Skip changes cards without grading", () => {
    const state = presentCard(createModeState("test", "forward", 2), cards[0]);
    const skipped = skipAndAdvance(state, cards, "sequential");
    expect(skipped.currentCardId).toBe("two");
    expect(skipped.totalReviews).toBe(0);
  });

  it("Back snapshot permits a corrected grade without double counting", () => {
    const initial = presentCard(createModeState("test", "forward", 2), cards[0]);
    const first = reviewAndAdvance(initial, cards, "sequential", { id: "same-review", result: "right", difficulty: "easy", responseTimeMs: 900, reviewedAt: 10 });
    const corrected = reviewAndAdvance(first.transaction.beforeState, cards, "sequential", { id: first.transaction.reviewId, result: "wrong", difficulty: "hard", responseTimeMs: 900, reviewedAt: 20 });
    expect(corrected.state.totalReviews).toBe(1);
    expect(corrected.state.rightReviews).toBe(0);
    expect(corrected.state.wrongReviews).toBe(1);
  });

  it("unlocks staged vocabulary only after every active card is mastered", () => {
    const staged = { initialCount: 1, batchSize: 1 };
    let state = createModeState("test", "forward", 2, staged, 1);
    expect(maybeUnlockNextBatch(state, cards, staged, 2).unlockedCount).toBe(1);
    state = presentCard(state, cards[0], 3);
    state = recordReview(state, cards[0], { id: "master", result: "right", difficulty: "medium", responseTimeMs: 1_000, reviewedAt: 4 });
    expect(maybeUnlockNextBatch(state, cards, staged, 5).unlockedCount).toBe(2);
  });
});
