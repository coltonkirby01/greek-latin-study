import type { CardProgress, StudyCard } from "./types";

export type ScoreTier = "Novice" | "Developing" | "Proficient" | "Advanced" | "Expert" | "Master";

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function normalizedLogRank(rank: number, maxRank = 1_000) {
  return clamp(Math.log1p(Math.max(1, rank)) / Math.log1p(maxRank), 0, 1);
}

function greekLessonDifficulty(card: StudyCard) {
  const lesson = Number(card.metadata?.lesson ?? 1);
  // The course progresses cumulatively; later lessons therefore carry more base weight.
  return clamp(16 + Math.max(0, lesson - 1) * 8, 12, 88);
}

function dickinsonDifficulty(card: StudyCard) {
  const frequencyRank = Number(card.metadata?.frequencyRank ?? card.rank ?? 1);
  // Rarer vocabulary receives progressively more weight, with a logarithmic curve so
  // the first several hundred ranks still produce meaningful separation.
  return clamp(20 + normalizedLogRank(frequencyRank) * 62, 20, 84);
}

function henleComplexityBonus(card: StudyCard) {
  const source = String(card.metadata?.studySource ?? "");
  const formGroup = String(card.metadata?.formGroup ?? "").toLowerCase();
  const formGroups = Array.isArray(card.metadata?.formGroups) ? card.metadata?.formGroups.map(String).map((value) => value.toLowerCase()) : [];
  const voice = String(card.metadata?.voiceGroup ?? "").toLowerCase();
  const subsection = String(card.metadata?.studySubsection ?? "").toLowerCase();
  const terms = [formGroup, ...formGroups, voice, subsection].join(" ");

  let bonus = source === "grammar-chart" ? 9 : 0;
  if (/subjunctive/.test(terms)) bonus += 6;
  if (/participle|gerundive|gerund|supine/.test(terms)) bonus += 7;
  if (/deponent|semi-deponent|irregular|defective/.test(terms)) bonus += 6;
  if (/passive/.test(terms)) bonus += 3;
  if (/principal parts/.test(terms)) bonus += 3;
  return bonus;
}

function henleDifficulty(card: StudyCard) {
  const rule = Number(card.metadata?.rule ?? card.rank ?? 1);
  // Henle's rules advance through Part I in pedagogical order. Rule progression supplies
  // the base curve; grammatical structure adds weight for especially complex paradigms.
  const progression = clamp(rule / 400, 0, 1);
  return clamp(24 + progression * 52 + henleComplexityBonus(card), 20, 96);
}

export function intrinsicCardDifficulty(card: StudyCard) {
  if (card.deckId === "dickinson-latin-core") return dickinsonDifficulty(card);
  if (card.deckId === "henle-part1-forms") return henleDifficulty(card);
  if (card.deckId.startsWith("greek-") || card.deckId.startsWith("alpha-omega")) return greekLessonDifficulty(card);
  return 35;
}

export function personalCardDifficulty(card: StudyCard, progress: CardProgress) {
  const intrinsic = intrinsicCardDifficulty(card);
  if (!progress.reviews) return intrinsic;
  const wrongRate = progress.wrong / progress.reviews;
  const hardRate = progress.hard / progress.reviews;
  const averageTimeMs = progress.responseTimeCount ? progress.responseTimeTotalMs / progress.responseTimeCount : 0;
  const slow = averageTimeMs <= 4_000 ? 0 : clamp(Math.log2(averageTimeMs / 4_000) * 8, 0, 18);
  return clamp(intrinsic * 0.65 + wrongRate * 20 + hardRate * 12 + slow, 1, 100);
}

export function scoreTier(score: number): ScoreTier {
  if (score >= 90) return "Master";
  if (score >= 78) return "Expert";
  if (score >= 65) return "Advanced";
  if (score >= 50) return "Proficient";
  if (score >= 30) return "Developing";
  return "Novice";
}

export type ScoredReview = {
  card: StudyCard;
  progress: CardProgress;
};

export function userStudyScore(items: ScoredReview[]) {
  const reviewed = items.filter(({ progress }) => progress.reviews > 0);
  if (!reviewed.length) return { score: 0, tier: scoreTier(0) };

  let weightTotal = 0;
  let performanceTotal = 0;
  let masteredWeight = 0;
  let masteredPossible = 0;
  let bestStreak = 0;

  for (const { card, progress } of reviewed) {
    const difficulty = intrinsicCardDifficulty(card);
    const weight = 0.45 + difficulty / 100;
    const accuracy = progress.right / Math.max(1, progress.reviews);
    const averageTimeMs = progress.responseTimeCount ? progress.responseTimeTotalMs / progress.responseTimeCount : 0;
    const speed = averageTimeMs ? clamp(7_000 / Math.max(7_000, averageTimeMs), 0.25, 1) : 0.6;
    const retention = clamp(progress.strength, 0, 1);
    const streak = clamp(progress.bestStreak / 12, 0, 1);
    const performance = accuracy * 0.56 + speed * 0.18 + retention * 0.18 + streak * 0.08;

    performanceTotal += performance * weight;
    weightTotal += weight;
    masteredPossible += weight;
    if (progress.initialMastered) masteredWeight += weight;
    bestStreak = Math.max(bestStreak, progress.bestStreak);
  }

  const weightedPerformance = performanceTotal / Math.max(1, weightTotal);
  const breadth = masteredWeight / Math.max(1, masteredPossible);
  const streakBonus = clamp(bestStreak / 25, 0, 1);
  const score = clamp((weightedPerformance * 0.72 + breadth * 0.23 + streakBonus * 0.05) * 100);
  const rounded = Number(score.toFixed(1));
  return { score: rounded, tier: scoreTier(rounded) };
}

export function sessionPerformanceScore(items: Array<{ card: StudyCard; result: "right" | "wrong"; difficulty: "easy" | "medium" | "hard"; responseTimeMs: number }>) {
  if (!items.length) return 0;
  let earned = 0;
  let possible = 0;
  let streak = 0;
  let bestStreak = 0;

  for (const item of items) {
    const intrinsic = intrinsicCardDifficulty(item.card);
    const weight = 0.5 + intrinsic / 100;
    const correct = item.result === "right" ? 1 : 0;
    const speed = clamp(7_000 / Math.max(7_000, item.responseTimeMs || 7_000), 0.2, 1);
    const selfDifficulty = item.difficulty === "easy" ? 1 : item.difficulty === "medium" ? 0.9 : 0.8;
    if (correct) streak += 1; else streak = 0;
    bestStreak = Math.max(bestStreak, streak);
    earned += (correct * 0.72 + speed * 0.2 + selfDifficulty * 0.08) * weight;
    possible += weight;
  }

  const streakBonus = clamp(bestStreak / Math.max(8, items.length), 0, 1) * 6;
  return Number(clamp((earned / Math.max(1, possible)) * 94 + streakBonus).toFixed(1));
}
