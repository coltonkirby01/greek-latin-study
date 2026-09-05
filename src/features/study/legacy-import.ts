import { blankCardProgress, createEnvelope, createModeState } from "./engine";
import type { CardProgress, DeckProgressEnvelope, ReviewDifficulty, ReviewResult } from "./types";

type Legacy = Record<string, unknown>;
const number = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
function legacyCard(value: Legacy): CardProgress {
  const next = blankCardProgress();
  next.presented = number(value.presented); next.reviews = number(value.answers); next.right = number(value.right); next.wrong = number(value.wrong);
  next.easy = number(value.easy); next.medium = number(value.medium); next.hard = number(value.hard); next.initialMastered = next.right > 0;
  next.strength = Math.max(0, Math.min(1, number(value.strength) / 12)); next.intervalMs = number(value.intervalMs); next.dueAt = number(value.dueAt);
  next.lastReviewedAt = number(value.lastReviewedAt); next.lastPresentedAt = number(value.lastPresentedAt);
  next.lastResult = ["right", "wrong"].includes(String(value.lastResult)) ? value.lastResult as ReviewResult : null;
  next.lastDifficulty = ["easy", "medium", "hard"].includes(String(value.lastDifficulty)) ? value.lastDifficulty as ReviewDifficulty : null;
  next.lastResponseTimeMs = number(value.lastFrontMs); next.responseTimeTotalMs = number(value.frontTotalMs); next.responseTimeCount = next.reviews;
  return next;
}

export function importProgressFile(value: unknown): DeckProgressEnvelope {
  if (!value || typeof value !== "object") throw new Error("The selected JSON file is not a progress backup.");
  const source = value as Record<string, unknown>;
  if (source.version === 2 && source.deckId && source.modes) return source as unknown as DeckProgressEnvelope;
  if (source.deck_id !== "henle_part1_forms" || !source.progress || typeof source.progress !== "object") throw new Error("This importer accepts this app's v2 backups or a Henle v4 backup.");
  const envelope = createEnvelope("henle-part1-forms"), groups: Record<string, Record<string, CardProgress>> = { "individual:forward": {}, "individual:reverse": {}, chart: {} };
  for (const [key, value] of Object.entries(source.progress as Record<string, Legacy>)) {
    const match = key.match(/^(individual:(?:forward|reverse)|chart):(.+)$/); if (match) groups[match[1]][match[2]] = legacyCard(value);
  }
  for (const [studyKey, cards] of Object.entries(groups)) {
    const mode = createModeState("henle-part1-forms", studyKey, studyKey === "chart" ? 248 : 2_062); mode.cards = cards;
    mode.totalReviews = Object.values(cards).reduce((sum, card) => sum + card.reviews, 0); mode.rightReviews = Object.values(cards).reduce((sum, card) => sum + card.right, 0); mode.wrongReviews = Object.values(cards).reduce((sum, card) => sum + card.wrong, 0);
    mode.updatedAt = Math.max(envelope.updatedAt, ...Object.values(cards).map((card) => card.lastReviewedAt || card.lastPresentedAt || 0)); envelope.modes[studyKey] = mode; envelope.updatedAt = Math.max(envelope.updatedAt, mode.updatedAt);
  }
  return envelope;
}
export function exportProgress(envelope: DeckProgressEnvelope) { return { ...envelope, type: "GreekLatinStudyProgressBackup", exportedAt: new Date().toISOString() }; }
