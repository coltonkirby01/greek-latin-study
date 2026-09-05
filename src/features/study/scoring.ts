import type { CardProgress, StudyCard } from "./types";

export type ScoreTier = "Novice" | "Developing" | "Proficient" | "Advanced" | "Expert" | "Master";
export type DifficultyContext = { language: "Greek" | "Latin"; source: string; cards: StudyCard[] };
export type ScoredCard = { context: DifficultyContext; card: StudyCard; progress: CardProgress };
export type ScoredReview = { result: "right" | "wrong"; responseTimeMs: number; intrinsicDifficulty: number };

function clamp(value: number, min = 0, max = 100) { return Math.min(max, Math.max(min, value)); }

function normalizedRank(card: StudyCard, cards: StudyCard[]) {
  const ranks = cards.map((item) => Number(item.rank)).filter(Number.isFinite);
  const rank = Number(card.rank);
  if (!Number.isFinite(rank) || !ranks.length) return 0;
  const min = Math.min(...ranks), max = Math.max(...ranks);
  return max === min ? 0 : clamp((rank - min) / (max - min), 0, 1);
}

function greekDifficulty(card: StudyCard) {
  const lesson = Math.max(1, Number(card.metadata?.lesson ?? 1));
  const source = String(card.metadata?.studySource ?? "");
  let score = 14 + (lesson - 1) * 12;
  if (source.includes("grammar")) score += 8;
  if (card.category === "Accent marks") score += 5;
  if (card.category?.includes("Punctuation")) score -= 2;
  return clamp(score, 10, 98);
}

function latinVocabularyDifficulty(card: StudyCard, cards: StudyCard[]) {
  const position = normalizedRank(card, cards);
  return clamp(18 + Math.sqrt(position) * 74, 18, 94);
}

function henleComplexityBonus(card: StudyCard) {
  const section = String(card.category ?? "");
  const subsection = String(card.metadata?.studySubsection ?? "");
  const voice = String(card.metadata?.voiceGroup ?? "");
  const rawGroups = card.metadata?.formGroups;
  const formGroups = Array.isArray(rawGroups) ? rawGroups.map(String) : [String(card.metadata?.formGroup ?? "")];
  const text = `${section} ${subsection} ${voice} ${formGroups.join(" ")}`.toLowerCase();
  let bonus = ({ Nouns: 0, Adjectives: 2, Adverbs: 3, Numerals: 5, Pronouns: 7, Verbs: 9 } as Record<string, number>)[section] ?? 0;
  if (text.includes("subjunctive")) bonus += 7;
  if (text.includes("participle")) bonus += 5;
  if (text.includes("gerundive")) bonus += 7;
  else if (text.includes("gerund")) bonus += 5;
  if (text.includes("supine")) bonus += 6;
  if (text.includes("deponent")) bonus += 5;
  if (text.includes("irregular") || text.includes("defective")) bonus += 7;
  if (String(card.metadata?.studySource) === "grammar-chart") bonus += 7;
  return bonus;
}

function henleDifficulty(card: StudyCard, cards: StudyCard[]) {
  const progression = normalizedRank(card, cards);
  return clamp(22 + progression * 58 + henleComplexityBonus(card), 20, 99);
}

export function intrinsicCardDifficulty(context: DifficultyContext, card: StudyCard) {
  if (context.language === "Greek") return greekDifficulty(card);
  if (context.source.includes("Dickinson")) return latinVocabularyDifficulty(card, context.cards);
  if (context.source.includes("Henle")) return henleDifficulty(card, context.cards);
  return clamp(20 + normalizedRank(card, context.cards) * 60, 10, 95);
}

export function scoreTier(score: number): ScoreTier {
  if (score >= 90) return "Master";
  if (score >= 75) return "Expert";
  if (score >= 60) return "Advanced";
  if (score >= 40) return "Proficient";
  if (score >= 20) return "Developing";
  return "Novice";
}

function recallSpeedScore(responseTimeMs: number, intrinsicDifficulty: number) {
  if (!responseTimeMs) return 0;
  const targetMs = 4_500 + intrinsicDifficulty * 55;
  return clamp(targetMs / responseTimeMs, 0, 1);
}

export function userProficiencyScore(cards: ScoredCard[]) {
  const reviewed = cards.filter(({ progress }) => progress.reviews > 0);
  if (!reviewed.length) return { score: 0, tier: "Novice" as ScoreTier, averageDifficulty: 0, hardestMastered: 0 };

  let weightedAccuracy = 0, weightedSpeed = 0, weightedRetention = 0, weightedStreak = 0, weightTotal = 0, challengeTotal = 0, masteredWeight = 0, hardestMastered = 0;
  for (const item of reviewed) {
    const difficulty = intrinsicCardDifficulty(item.context, item.card);
    const weight = 0.65 + difficulty / 100;
    const accuracy = item.progress.right / Math.max(1, item.progress.reviews);
    const averageTime = item.progress.responseTimeTotalMs / Math.max(1, item.progress.responseTimeCount);
    const retention = (item.progress.initialMastered ? 0.65 : 0) + (item.progress.lastResult === "right" ? 0.35 : 0);
    const streak = Math.min(1, item.progress.bestStreak / 12);
    weightedAccuracy += accuracy * weight;
    weightedSpeed += recallSpeedScore(averageTime, difficulty) * weight;
    weightedRetention += retention * weight;
    weightedStreak += streak * weight;
    challengeTotal += difficulty * weight;
    weightTotal += weight;
    if (item.progress.initialMastered) {
      masteredWeight += weight;
      hardestMastered = Math.max(hardestMastered, difficulty);
    }
  }

  const accuracy = weightedAccuracy / weightTotal;
  const speed = weightedSpeed / weightTotal;
  const retention = weightedRetention / weightTotal;
  const streak = weightedStreak / weightTotal;
  const challenge = (challengeTotal / weightTotal) / 100;
  const masteryBreadth = masteredWeight / weightTotal;
  const performance = accuracy * 0.38 + speed * 0.18 + retention * 0.18 + streak * 0.11 + masteryBreadth * 0.15;
  const challengeMultiplier = 0.62 + challenge * 0.38;
  const score = Math.round(clamp(performance * challengeMultiplier * 100, 1, 100));
  return { score, tier: scoreTier(score), averageDifficulty: challenge * 100, hardestMastered };
}

export function scoredSession(reviews: ScoredReview[]) {
  if (!reviews.length) return 0;
  const accuracy = reviews.filter((review) => review.result === "right").length / reviews.length;
  let speed = 0, challenge = 0, streak = 0, bestStreak = 0;
  for (const review of reviews) {
    speed += recallSpeedScore(review.responseTimeMs, review.intrinsicDifficulty);
    challenge += review.intrinsicDifficulty / 100;
    if (review.result === "right") { streak += 1; bestStreak = Math.max(bestStreak, streak); } else streak = 0;
  }
  speed /= reviews.length;
  challenge /= reviews.length;
  const streakScore = Math.min(1, bestStreak / 10);
  const performance = accuracy * 0.55 + speed * 0.25 + streakScore * 0.20;
  return Number(clamp(performance * (0.72 + challenge * 0.28) * 100).toFixed(1));
}
