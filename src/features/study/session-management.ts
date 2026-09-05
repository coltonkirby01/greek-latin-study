import type { CardProgress, DeckProgressEnvelope, ReviewRecord } from "./types";

export type ManagedSession = {
  id: string;
  language: "Greek" | "Latin";
  sources: string[];
  startedAt: number;
  lastReviewedAt: number;
  reviews: number;
  name?: string;
};

export type SessionMutation = {
  envelope: DeckProgressEnvelope;
  changed: boolean;
  reviewIds: string[];
};

function deckLanguage(deckId: string): "Greek" | "Latin" {
  return deckId.startsWith("greek-") || deckId.startsWith("alpha-omega-") ? "Greek" : "Latin";
}

function sourceLabel(deckId: string, studyKey: string) {
  if (deckId === "greek-i") return "Lessons 1–2 Grammar";
  if (deckId === "alpha-omega-lesson3-vocab") return "Lesson 3 Vocabulary";
  if (deckId === "alpha-omega-lesson3-grammar") return "Lesson 3 Grammar";
  if (deckId === "dickinson-latin-core") return "Dickinson Vocabulary";
  if (deckId === "henle-part1-forms") return studyKey.startsWith("chart") ? "Henle Whole Charts" : "Henle Grammar Forms";
  return deckId;
}

export function collectManagedSessions(envelopes: Record<string, DeckProgressEnvelope | null>) {
  const sessions = new Map<string, ManagedSession>();
  for (const [deckId, envelope] of Object.entries(envelopes)) {
    if (!envelope) continue;
    const language = deckLanguage(deckId);
    for (const [studyKey, mode] of Object.entries(envelope.modes)) {
      const source = sourceLabel(deckId, studyKey);
      for (const progress of Object.values(mode.cards)) {
        for (const review of progress.history) {
          if (!review.sessionId || review.activityKind === "warmup") continue;
          const startedAt = review.sessionStartedAt ?? review.reviewedAt;
          const existing = sessions.get(review.sessionId);
          if (existing) {
            existing.startedAt = Math.min(existing.startedAt, startedAt);
            existing.lastReviewedAt = Math.max(existing.lastReviewedAt, review.reviewedAt);
            existing.reviews += 1;
            if (!existing.sources.includes(source)) existing.sources.push(source);
            if (review.sessionName?.trim()) existing.name = review.sessionName.trim();
          } else {
            sessions.set(review.sessionId, {
              id: review.sessionId,
              language,
              sources: [source],
              startedAt,
              lastReviewedAt: review.reviewedAt,
              reviews: 1,
              name: review.sessionName?.trim() || undefined,
            });
          }
        }
      }
    }
  }
  return [...sessions.values()].sort((a, b) => b.lastReviewedAt - a.lastReviewedAt);
}

export function automaticManagedSessionName(session: ManagedSession, formatter = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" })) {
  const focus = session.sources.length === 1 ? session.sources[0] : session.sources.length ? "Mixed study" : "Study";
  return `${session.language} · ${focus} · ${formatter.format(session.startedAt)}`;
}

export function displayManagedSessionName(session: ManagedSession) {
  return session.name?.trim() || automaticManagedSessionName(session);
}

export function renameSessionInEnvelope(envelope: DeckProgressEnvelope, sessionId: string, name: string, now = Date.now()): SessionMutation {
  const next = structuredClone(envelope);
  let changed = false;
  const reviewIds: string[] = [];
  for (const mode of Object.values(next.modes)) {
    let modeChanged = false;
    for (const progress of Object.values(mode.cards)) {
      progress.history = progress.history.map((review) => {
        if (review.sessionId !== sessionId || review.activityKind === "warmup") return review;
        changed = true;
        modeChanged = true;
        reviewIds.push(review.id);
        return { ...review, sessionName: name };
      });
    }
    if (modeChanged) mode.updatedAt = Math.max(mode.updatedAt, now);
  }
  if (changed) next.updatedAt = Math.max(next.updatedAt, now);
  return { envelope: next, changed, reviewIds };
}

function rebuildProgress(progress: CardProgress, remaining: ReviewRecord[], removedCount: number): CardProgress {
  const next = structuredClone(progress);
  next.history = [...remaining].sort((a, b) => a.reviewedAt - b.reviewedAt);
  next.presented = Math.max(next.history.length, next.presented - removedCount);
  next.reviews = next.history.length;
  next.right = 0;
  next.wrong = 0;
  next.easy = 0;
  next.medium = 0;
  next.hard = 0;
  next.initialMastered = false;
  next.streak = 0;
  next.bestStreak = 0;
  next.lapses = 0;
  next.responseTimeTotalMs = 0;
  next.responseTimeCount = 0;
  next.lastReviewedAt = 0;
  next.lastResult = null;
  next.lastDifficulty = null;
  next.lastResponseTimeMs = 0;
  next.intervalMs = 0;
  next.dueAt = 0;
  next.strength = 0;

  let streak = 0;
  for (const review of next.history) {
    next[review.result] += 1;
    next[review.difficulty] += 1;
    next.responseTimeTotalMs += review.responseTimeMs;
    next.responseTimeCount += 1;
    if (review.result === "right") {
      next.initialMastered = true;
      streak += 1;
    } else {
      streak = 0;
      next.lapses += 1;
    }
    next.bestStreak = Math.max(next.bestStreak, streak);
  }
  next.streak = streak;

  const last = next.history.at(-1);
  if (last) {
    next.lastReviewedAt = last.reviewedAt;
    next.lastResult = last.result;
    next.lastDifficulty = last.difficulty;
    next.lastResponseTimeMs = last.responseTimeMs;
    next.intervalMs = last.intervalMs;
    next.dueAt = last.reviewedAt + last.intervalMs;
    next.strength = last.strength;
  }
  return next;
}

export function deleteSessionFromEnvelope(envelope: DeckProgressEnvelope, sessionId: string, now = Date.now()): SessionMutation {
  const next = structuredClone(envelope);
  let changed = false;
  const reviewIds: string[] = [];

  for (const mode of Object.values(next.modes)) {
    let modeChanged = false;
    for (const [cardId, progress] of Object.entries(mode.cards)) {
      const removed = progress.history.filter((review) => review.sessionId === sessionId && review.activityKind !== "warmup");
      if (!removed.length) continue;
      changed = true;
      modeChanged = true;
      reviewIds.push(...removed.map((review) => review.id));
      const remaining = progress.history.filter((review) => review.sessionId !== sessionId || review.activityKind === "warmup");
      mode.cards[cardId] = rebuildProgress(progress, remaining, removed.length);
    }
    if (modeChanged) {
      const progress = Object.values(mode.cards);
      mode.totalReviews = progress.reduce((sum, card) => sum + card.reviews, 0);
      mode.rightReviews = progress.reduce((sum, card) => sum + card.right, 0);
      mode.wrongReviews = mode.totalReviews - mode.rightReviews;
      mode.updatedAt = Math.max(mode.updatedAt, now);
      // Deliberately preserve unlockedCount: deleting history lowers statistics and
      // recalculates memory, but does not re-lock material the learner already reached.
    }
  }

  if (changed) next.updatedAt = Math.max(next.updatedAt, now);
  return { envelope: next, changed, reviewIds: [...new Set(reviewIds)] };
}
