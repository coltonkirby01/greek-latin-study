import type { DeckProgressEnvelope, ReviewRecord } from "./types";

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
  if (deckId === "greek-i") return "Lessons 1–2";
  if (deckId === "alpha-omega-lesson3-vocab") return "Lesson 3 Vocabulary";
  if (deckId === "alpha-omega-lesson3-grammar") return "Lesson 3 Grammar";
  if (deckId === "dickinson-latin-core") return "Dickinson Vocabulary";
  if (deckId === "henle-part1-forms") return studyKey.startsWith("chart") ? "Henle Whole Charts" : "Henle Grammar Forms";
  return deckId;
}

export function sessionCustomNameFromReviews(reviews: Array<Pick<ReviewRecord, "sessionName" | "reviewedAt">>) {
  let latest: { name: string; reviewedAt: number } | null = null;
  for (const review of reviews) {
    const name = review.sessionName?.trim();
    if (!name) continue;
    if (!latest || review.reviewedAt >= latest.reviewedAt) latest = { name, reviewedAt: review.reviewedAt };
  }
  return latest?.name;
}

export function collectManagedSessions(envelopes: Record<string, DeckProgressEnvelope | null>) {
  const sessions = new Map<string, ManagedSession>();
  const namedReviews = new Map<string, Array<Pick<ReviewRecord, "sessionName" | "reviewedAt">>>();
  for (const [deckId, envelope] of Object.entries(envelopes)) {
    if (!envelope) continue;
    const language = deckLanguage(deckId);
    for (const [studyKey, mode] of Object.entries(envelope.modes)) {
      const source = sourceLabel(deckId, studyKey);
      for (const progress of Object.values(mode.cards)) {
        for (const review of progress.history) {
          if (!review.sessionId || review.activityKind === "warmup" || review.statsExcluded) continue;
          const startedAt = review.sessionStartedAt ?? review.reviewedAt;
          const existing = sessions.get(review.sessionId);
          if (existing) {
            existing.startedAt = Math.min(existing.startedAt, startedAt);
            existing.lastReviewedAt = Math.max(existing.lastReviewedAt, review.reviewedAt);
            existing.reviews += 1;
            if (!existing.sources.includes(source)) existing.sources.push(source);
          } else {
            sessions.set(review.sessionId, {
              id: review.sessionId,
              language,
              sources: [source],
              startedAt,
              lastReviewedAt: review.reviewedAt,
              reviews: 1,
            });
          }
          if (review.sessionName?.trim()) {
            namedReviews.set(review.sessionId, [...(namedReviews.get(review.sessionId) ?? []), review]);
          }
        }
      }
    }
  }
  for (const [sessionId, reviews] of namedReviews) {
    const session = sessions.get(sessionId);
    if (session) session.name = sessionCustomNameFromReviews(reviews);
  }
  return [...sessions.values()].sort((a, b) => b.lastReviewedAt - a.lastReviewedAt);
}

export function automaticManagedSessionName(session: ManagedSession, formatter = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" })) {
  const focus = session.sources.length === 1 ? session.sources[0] : session.sources.length === 2 ? session.sources.join(" + ") : "Mixed study";
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

export function deleteSessionFromEnvelope(envelope: DeckProgressEnvelope, sessionId: string, now = Date.now()): SessionMutation {
  const next = structuredClone(envelope);
  let changed = false;
  const reviewIds: string[] = [];

  for (const mode of Object.values(next.modes)) {
    let modeChanged = false;
    for (const progress of Object.values(mode.cards)) {
      progress.history = progress.history.map((review) => {
        if (review.sessionId !== sessionId || review.activityKind === "warmup" || review.statsExcluded) return review;
        changed = true;
        modeChanged = true;
        reviewIds.push(review.id);
        return { ...review, statsExcluded: true };
      });
    }
    if (modeChanged) mode.updatedAt = Math.max(mode.updatedAt, now);
  }

  // Card counters, strength, intervals, due dates, response-time memory, review
  // sequence, mastery, and staged unlocks are intentionally untouched. The
  // session disappears from history/Stats but remains part of adaptive memory.
  if (changed) next.updatedAt = Math.max(next.updatedAt, now);
  return { envelope: next, changed, reviewIds: [...new Set(reviewIds)] };
}
