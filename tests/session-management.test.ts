import { describe, expect, it } from "vitest";
import { createEnvelope, createModeState, presentCard, recordReview } from "../src/features/study/engine";
import { collectManagedSessions, deleteSessionFromEnvelope, renameSessionInEnvelope } from "../src/features/study/session-management";
import type { StudyCard } from "../src/features/study/types";

const cards: StudyCard[] = [
  { id: "one", deckId: "dickinson-latin-core", front: "amō", back: "I love" },
  { id: "two", deckId: "dickinson-latin-core", front: "videō", back: "I see" },
];

function envelopeWithTwoSessions() {
  const envelope = createEnvelope("dickinson-latin-core", 1);
  let mode = createModeState("dickinson-latin-core", "forward", 997, { initialCount: 100, batchSize: 25 }, 1);
  mode.unlockedCount = 150;
  mode = presentCard(mode, cards[0], 10);
  mode = recordReview(mode, cards[0], { id: "r1", result: "right", difficulty: "easy", responseTimeMs: 1_000, reviewedAt: 20, sessionId: "session-a", sessionStartedAt: 5 });
  mode = presentCard(mode, cards[0], 30);
  mode = recordReview(mode, cards[0], { id: "r2", result: "wrong", difficulty: "hard", responseTimeMs: 4_000, reviewedAt: 40, sessionId: "session-b", sessionStartedAt: 25 });
  envelope.modes.forward = mode;
  envelope.updatedAt = mode.updatedAt;
  return envelope;
}

describe("session management", () => {
  it("collects explicit ranked sessions from stored review history", () => {
    const sessions = collectManagedSessions({ "dickinson-latin-core": envelopeWithTwoSessions() });
    expect(sessions.map((session) => session.id).sort()).toEqual(["session-a", "session-b"]);
    expect(sessions[0].language).toBe("Latin");
  });

  it("persists a custom name on every review in the session", () => {
    const mutation = renameSessionInEnvelope(envelopeWithTwoSessions(), "session-a", "Friday quiz practice", 100);
    const review = mutation.envelope.modes.forward.cards.one.history.find((item) => item.id === "r1");
    expect(mutation.changed).toBe(true);
    expect(review?.sessionName).toBe("Friday quiz practice");
  });

  it("deletes only the chosen session, recalculates review stats, and preserves Dickinson unlock progress", () => {
    const mutation = deleteSessionFromEnvelope(envelopeWithTwoSessions(), "session-b", 100);
    const mode = mutation.envelope.modes.forward;
    const progress = mode.cards.one;
    expect(mutation.reviewIds).toEqual(["r2"]);
    expect(progress.history.map((review) => review.id)).toEqual(["r1"]);
    expect(progress.reviews).toBe(1);
    expect(progress.right).toBe(1);
    expect(progress.wrong).toBe(0);
    expect(progress.initialMastered).toBe(true);
    expect(mode.totalReviews).toBe(1);
    expect(mode.rightReviews).toBe(1);
    expect(mode.wrongReviews).toBe(0);
    expect(mode.unlockedCount).toBe(150);
  });
});
