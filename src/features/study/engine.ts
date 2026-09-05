import type { CardProgress, DeckProgressEnvelope, DirectionalCardCopy, ReviewDifficulty, ReviewResult, ReviewTransaction, SelectionMode, StagedIntroduction, StudyActivityKind, StudyCard, StudyDirection, StudyModeState, StudyStats } from "./types";

export const MINUTE = 60_000;
export const DAY = 24 * 60 * MINUTE;
export const MAX_INTERVAL_MS = 365 * DAY;
export const MAX_RESPONSE_TIME_MS = 10 * 60 * 1_000;

export function blankCardProgress(): CardProgress { return { presented: 0, reviews: 0, right: 0, wrong: 0, easy: 0, medium: 0, hard: 0, initialMastered: false, streak: 0, bestStreak: 0, lapses: 0, strength: 0, intervalMs: 0, dueAt: 0, lastPresentedAt: 0, lastReviewedAt: 0, lastResult: null, lastDifficulty: null, responseTimeTotalMs: 0, responseTimeCount: 0, lastResponseTimeMs: 0, history: [] }; }
export function createModeState(deckId: string, studyKey: string, cardCount: number, staged?: StagedIntroduction, now = Date.now()): StudyModeState { return { version: 2, deckId, studyKey, createdAt: now, updatedAt: now, currentCardId: null, reviewSequence: [], totalReviews: 0, rightReviews: 0, wrongReviews: 0, unlockedCount: Math.min(cardCount, staged?.initialCount ?? cardCount), lastUnlock: null, cards: {} }; }
export function createEnvelope(deckId: string, now = Date.now()): DeckProgressEnvelope { return { version: 2, deckId, createdAt: now, updatedAt: now, modes: {} }; }
export function getCardProgress(state: StudyModeState, cardId: string) { return state.cards[cardId] ?? blankCardProgress(); }
export function normalizeResponseTime(value: number | undefined | null) { return Number.isFinite(value) ? Math.min(MAX_RESPONSE_TIME_MS, Math.max(0, Math.round(Number(value)))) : 0; }
export function formatResponseTime(value: number) { return `${(normalizeResponseTime(value) / 1_000).toFixed(2)} s`; }
export function responseTimeIntervalFactor(responseTimeMs: number) { const seconds = normalizeResponseTime(responseTimeMs) / 1_000; return seconds <= 4 ? 1 : Math.max(0.4, 1 - Math.log2(seconds / 4) * 0.16); }
export function responseTimePriorityScore(last: number, total: number, count: number) { if (!count) return 0; const seconds = Math.max(normalizeResponseTime(last), total / count) / 1_000; return seconds <= 4 ? 0 : Math.min(36, Math.log2(seconds / 4) * 9); }
export function directionalCopy(card: StudyCard, direction: StudyDirection): DirectionalCardCopy { return direction === "reverse" ? { prompt: card.reverseFront ?? card.back, answer: card.reverseBack ?? card.front, sideLabel: "Reverse" } : { prompt: card.front, answer: card.back, sideLabel: "Forward" }; }
export function cardsAvailableToState(cards: StudyCard[], state: StudyModeState) { return cards.slice(0, Math.min(cards.length, state.unlockedCount)); }

export function priorityScore(card: StudyCard, state: StudyModeState, options: { ignoreRecency?: boolean; now?: number; staged?: StagedIntroduction } = {}) {
  const item = getCardProgress(state, card.id), now = options.now ?? Date.now(); let score = 1;
  if (!item.initialMastered) score += 72;
  if (!item.presented) score += 40;
  if (item.reviews) { score += (item.wrong / item.reviews) * 36 + Math.min(18, item.lapses * 2.7); score += item.lastDifficulty === "hard" ? 20 : item.lastDifficulty === "medium" ? 7 : 1; score += (1 - Math.min(1, item.strength)) * 13; score += responseTimePriorityScore(item.lastResponseTimeMs, item.responseTimeTotalMs, item.responseTimeCount); }
  const interval = Math.max(MINUTE, item.intervalMs || MINUTE);
  score += !item.dueAt || item.dueAt <= now ? 13 + Math.min(42, ((now - (item.dueAt || now)) / interval) * 8) : Math.max(0, 4 - ((item.dueAt - now) / interval) * 4);
  if (!options.ignoreRecency) {
    const fromEnd = state.reviewSequence.slice().reverse().indexOf(card.id);
    const penalties = [120, 90, 60, 36, 20, 10];
    if (fromEnd >= 0 && fromEnd < penalties.length) score -= penalties[fromEnd];
  }
  return score;
}

function avoidRecentAdaptiveCards(cards: StudyCard[], state: StudyModeState) {
  if (cards.length <= 3) return cards;
  const recentLimit = Math.min(4, cards.length - 3);
  const recent: string[] = [];
  for (const id of [...state.reviewSequence].reverse()) {
    if (!recent.includes(id)) recent.push(id);
    if (recent.length >= recentLimit) break;
  }
  if (!recent.length) return cards;
  const recentIds = new Set(recent);
  const filtered = cards.filter((card) => !recentIds.has(card.id));
  return filtered.length >= 3 ? filtered : cards;
}

export function pickNextCard(cards: StudyCard[], state: StudyModeState, selectionMode: SelectionMode, options: { excludeCardId?: string; random?: () => number; staged?: StagedIntroduction } = {}) {
  let available = cardsAvailableToState(cards, state); if (!available.length) return null;
  if (available.length > 1 && options.excludeCardId) available = available.filter((card) => card.id !== options.excludeCardId);
  if (selectionMode === "sequential") { const index = available.findIndex((card) => card.id === state.currentCardId); return available[(index + 1 + available.length) % available.length]; }
  available = avoidRecentAdaptiveCards(available, state);
  const ranked = available.map((card) => ({ card, score: priorityScore(card, state, { staged: options.staged }) })).sort((a, b) => b.score - a.score).slice(0, Math.min(24, available.length));
  const max = ranked[0].score, weights = ranked.map(({ score }) => Math.exp((score - max) / 11)); let chance = (options.random ?? Math.random)() * weights.reduce((sum, weight) => sum + weight, 0);
  for (let index = 0; index < ranked.length; index += 1) { chance -= weights[index]; if (chance <= 0) return ranked[index].card; }
  return ranked[0].card;
}

export function presentCard(state: StudyModeState, card: StudyCard, now = Date.now()) {
  const next = structuredClone(state), item = getCardProgress(next, card.id);
  item.presented += 1; item.lastPresentedAt = now; next.cards[card.id] = item; next.currentCardId = card.id;
  next.reviewSequence = [...next.reviewSequence, card.id].slice(-24); next.updatedAt = now; return next;
}

function scheduleAfterReview(item: CardProgress, result: ReviewResult, difficulty: ReviewDifficulty, now: number) {
  const plan = { hard: { first: 3 * MINUTE, wrong: 30_000, growth: 1.55, gain: 0.07 }, medium: { first: 8 * MINUTE, wrong: 90_000, growth: 2.15, gain: 0.12 }, easy: { first: 20 * MINUTE, wrong: 3 * MINUTE, growth: 3.05, gain: 0.18 } }[difficulty];
  if (result === "wrong") { item.streak = 0; item.lapses += 1; item.strength = Math.max(0, item.strength * 0.52 - 0.05); item.intervalMs = plan.wrong; }
  else { item.streak += 1; item.bestStreak = Math.max(item.bestStreak, item.streak); item.strength = Math.min(1, item.strength + plan.gain + Math.min(0.12, item.streak * 0.015)); item.intervalMs = !item.intervalMs || item.intervalMs < MINUTE || item.lastResult === "wrong" ? plan.first : Math.min(MAX_INTERVAL_MS, Math.max(plan.first, item.intervalMs * plan.growth * (1 + item.strength * 0.45))); if (difficulty === "hard") item.intervalMs = Math.min(item.intervalMs, 7 * DAY * Math.max(1, item.strength)); }
  item.dueAt = now + item.intervalMs;
}

type ReviewInput = { id: string; result: ReviewResult; difficulty: ReviewDifficulty; responseTimeMs: number; reviewedAt?: number; sessionId?: string; sessionStartedAt?: number; sessionName?: string; activityKind?: StudyActivityKind };

export function recordReview(state: StudyModeState, card: StudyCard, review: ReviewInput) {
  const reviewedAt = review.reviewedAt ?? Date.now(), next = structuredClone(state), item = getCardProgress(next, card.id), responseTimeMs = normalizeResponseTime(review.responseTimeMs);
  item.reviews += 1; item[review.result] += 1; item[review.difficulty] += 1; if (review.result === "right") item.initialMastered = true;
  scheduleAfterReview(item, review.result, review.difficulty, reviewedAt);
  item.responseTimeTotalMs += responseTimeMs; item.responseTimeCount += 1; item.lastResponseTimeMs = responseTimeMs;
  item.intervalMs = Math.max(30_000, item.intervalMs * responseTimeIntervalFactor(responseTimeMs)); item.dueAt = reviewedAt + item.intervalMs;
  item.lastReviewedAt = reviewedAt; item.lastResult = review.result; item.lastDifficulty = review.difficulty;
  item.history = [...item.history, { id: review.id, reviewedAt, result: review.result, difficulty: review.difficulty, responseTimeMs, intervalMs: Math.round(item.intervalMs), strength: Number(item.strength.toFixed(4)), sessionId: review.sessionId, sessionStartedAt: review.sessionStartedAt, sessionName: review.sessionName, activityKind: review.activityKind ?? "study" }].slice(-250);
  next.cards[card.id] = item; next.totalReviews += 1; if (review.result === "right") next.rightReviews += 1; else next.wrongReviews += 1; next.updatedAt = reviewedAt; return next;
}

export function maybeUnlockNextBatch(state: StudyModeState, cards: StudyCard[], staged?: StagedIntroduction, now = Date.now()) {
  if (!staged || state.unlockedCount >= cards.length) return state;
  if (!cards.slice(0, state.unlockedCount).every((card) => getCardProgress(state, card.id).initialMastered)) return state;
  const next = structuredClone(state), oldCount = next.unlockedCount; next.unlockedCount = Math.min(cards.length, oldCount + staged.batchSize); next.lastUnlock = { start: oldCount + 1, end: next.unlockedCount, at: now }; next.updatedAt = now; return next;
}

export function ensureCurrentCard(state: StudyModeState, cards: StudyCard[], selectionMode: SelectionMode, staged?: StagedIntroduction) {
  const available = cardsAvailableToState(cards, state); if (state.currentCardId && available.some((card) => card.id === state.currentCardId)) return state;
  const card = pickNextCard(cards, state, selectionMode, { staged }); return card ? presentCard(state, card) : state;
}

export function reviewAndAdvance(state: StudyModeState, cards: StudyCard[], selectionMode: SelectionMode, review: { id?: string; result: ReviewResult; difficulty: ReviewDifficulty; responseTimeMs: number; reviewedAt?: number; sessionId?: string; sessionStartedAt?: number; sessionName?: string; activityKind?: StudyActivityKind }, staged?: StagedIntroduction) {
  const current = cards.find((card) => card.id === state.currentCardId); if (!current) throw new Error("The active card could not be found.");
  const reviewId = review.id ?? crypto.randomUUID(), beforeState = structuredClone(state); let next = recordReview(state, current, { ...review, id: reviewId });
  next = maybeUnlockNextBatch(next, cards, staged, review.reviewedAt); const chosen = pickNextCard(cards, next, selectionMode, { excludeCardId: current.id, staged }); if (chosen) next = presentCard(next, chosen, review.reviewedAt);
  const transaction: ReviewTransaction = { reviewId, cardId: current.id, result: review.result, difficulty: review.difficulty, responseTimeMs: normalizeResponseTime(review.responseTimeMs), beforeState, sessionId: review.sessionId, sessionStartedAt: review.sessionStartedAt, sessionName: review.sessionName, activityKind: review.activityKind ?? "study" }; return { state: next, transaction };
}

export function skipAndAdvance(state: StudyModeState, cards: StudyCard[], selectionMode: SelectionMode, staged?: StagedIntroduction) { const chosen = pickNextCard(cards, state, selectionMode, { excludeCardId: state.currentCardId ?? undefined, staged }); return chosen ? presentCard(state, chosen) : state; }

export function studyStats(cards: StudyCard[], state: StudyModeState): StudyStats {
  const available = cardsAvailableToState(cards, state); let reviewed = 0, everWrong = 0, markedHard = 0, mastered = 0, responseTotal = 0, responseCount = 0, bestStreak = 0;
  for (const card of available) { const item = getCardProgress(state, card.id); if (item.reviews) reviewed += 1; if (item.wrong) everWrong += 1; if (item.hard) markedHard += 1; if (item.initialMastered) mastered += 1; responseTotal += item.responseTimeTotalMs; responseCount += item.responseTimeCount; bestStreak = Math.max(bestStreak, item.bestStreak); }
  return { available: available.length, reviewed, accuracy: state.totalReviews ? state.rightReviews / state.totalReviews : null, everWrong, markedHard, averageResponseTimeMs: responseCount ? responseTotal / responseCount : 0, mastered, totalReviews: state.totalReviews, bestStreak };
}

export function highestPriorityCards(cards: StudyCard[], state: StudyModeState, staged?: StagedIntroduction, limit = 5) { return cardsAvailableToState(cards, state).map((card) => ({ card, progress: getCardProgress(state, card.id), score: priorityScore(card, state, { ignoreRecency: true, staged }) })).sort((a, b) => b.score - a.score).slice(0, limit); }
export function priorityReason(item: CardProgress, now = Date.now()) { if (!item.presented) return "new"; if (!item.initialMastered) return "needs first correct"; if (item.lastResult === "wrong") return "recent mistake"; if (item.lastDifficulty === "hard") return "rated hard"; if (responseTimePriorityScore(item.lastResponseTimeMs, item.responseTimeTotalMs, item.responseTimeCount) >= 9) return "slow recall"; if (item.reviews && item.wrong / item.reviews >= 0.35) return "inconsistent"; if (!item.dueAt || item.dueAt <= now) return "due"; return "review"; }
