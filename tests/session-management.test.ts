import { describe, expect, it } from "vitest";
import { createEnvelope, createModeState, presentCard, recordReview } from "../src/features/study/engine";
import { automaticManagedSessionName, collectManagedSessions, deleteSessionFromEnvelope, displayManagedSessionName, renameSessionInEnvelope, sessionCustomNameFromReviews } from "../src/features/study/session-management";
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

  it("uses the latest stored custom name when historical reviews contain conflicting names", () => {
    expect(sessionCustomNameFromReviews([
      { reviewedAt: 10, sessionName: "Old name" },
      { reviewedAt: 30, sessionName: "Current name" },
      { reviewedAt: 20, sessionName: "Middle name" },
    ])).toBe("Current name");
  });

  it("formats two-source automatic names consistently with Stats", () => {
    const name = automaticManagedSessionName({ id: "s", language: "Latin", sources: ["Dickinson Vocabulary", "Henle Grammar Forms"], startedAt: 1, lastReviewedAt: 2, reviews: 2 }, { format: () => "DATE" } as Intl.DateTimeFormat);
    expect(name).toBe("Latin · Dickinson Vocabulary + Henle Grammar Forms · DATE");
  });

  it("shows only the custom name after a session is renamed", () => {
    const session = { id: "s", language: "Latin" as const, sources: ["Dickinson Vocabulary"], startedAt: 1, lastReviewedAt: 2, reviews: 2, name: "Friday quiz" };
    expect(displayManagedSessionName(session)).toBe("Friday quiz");
    expect(displayManagedSessionName(session)).not.toContain("Dickinson");
  });

  it("persists a custom name on every review in the session", () => {
    const mutation = renameSessionInEnvelope(envelopeWithTwoSessions(), "session-a", "Friday quiz practice", 100);
    const review = mutation.envelope.modes.forward.cards.one.history.find((item) => item.id === "r1");
    expect(mutation.changed).toBe(true);
    expect(review?.sessionName).toBe("Friday quiz practice");
  });

  it("hides a deleted session from Stats without changing adaptive memory", () => {
    const before = envelopeWithTwoSessions();
    const beforeMode = structuredClone(before.modes.forward);
    const beforeProgress = structuredClone(beforeMode.cards.one);
    const mutation = deleteSessionFromEnvelope(before, "session-b", 100);
    const mode = mutation.envelope.modes.forward;
    const progress = mode.cards.one;

    expect(mutation.reviewIds).toEqual(["r2"]);
    expect(progress.history).toHaveLength(2);
    expect(progress.history.find((review) => review.id === "r2")?.statsExcluded).toBe(true);
    expect(progress.reviews).toBe(beforeProgress.reviews);
    expect(progress.right).toBe(beforeProgress.right);
    expect(progress.wrong).toBe(beforeProgress.wrong);
    expect(progress.easy).toBe(beforeProgress.easy);
    expect(progress.hard).toBe(beforeProgress.hard);
    expect(progress.initialMastered).toBe(beforeProgress.initialMastered);
    expect(progress.strength).toBe(beforeProgress.strength);
    expect(progress.intervalMs).toBe(beforeProgress.intervalMs);
    expect(progress.dueAt).toBe(beforeProgress.dueAt);
    expect(progress.responseTimeTotalMs).toBe(beforeProgress.responseTimeTotalMs);
    expect(mode.totalReviews).toBe(beforeMode.totalReviews);
    expect(mode.rightReviews).toBe(beforeMode.rightReviews);
    expect(mode.wrongReviews).toBe(beforeMode.wrongReviews);
    expect(mode.reviewSequence).toEqual(beforeMode.reviewSequence);
    expect(mode.unlockedCount).toBe(150);
    expect(collectManagedSessions({ "dickinson-latin-core": mutation.envelope }).map((session) => session.id)).toEqual(["session-a"]);
  });
});
