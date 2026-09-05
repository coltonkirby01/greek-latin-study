export type StudyDirection = "forward" | "reverse";
export type SelectionMode = "adaptive" | "sequential";
export type ReviewResult = "right" | "wrong";
export type ReviewDifficulty = "easy" | "medium" | "hard";
export type StudyActivityKind = "study" | "warmup";

export type StudyCard = { id: string; deckId: string; front: string; back: string; reverseFront?: string; reverseBack?: string; category?: string; rank?: number; source?: string; notes?: string; metadata?: Record<string, unknown> };
export type StagedIntroduction = { initialCount: number; batchSize: number };
export type DeckDefinition = { id: string; slug: string; title: string; eyebrow: string; description: string; language: "greek" | "latin" | "other"; cards: StudyCard[]; supportsReverse: boolean; staged?: StagedIntroduction; sourceNote?: string };
export type ReviewRecord = { id: string; reviewedAt: number; result: ReviewResult; difficulty: ReviewDifficulty; responseTimeMs: number; intervalMs: number; strength: number; sessionId?: string; sessionStartedAt?: number; activityKind?: StudyActivityKind };
export type CardProgress = { presented: number; reviews: number; right: number; wrong: number; easy: number; medium: number; hard: number; initialMastered: boolean; streak: number; bestStreak: number; lapses: number; strength: number; intervalMs: number; dueAt: number; lastPresentedAt: number; lastReviewedAt: number; lastResult: ReviewResult | null; lastDifficulty: ReviewDifficulty | null; responseTimeTotalMs: number; responseTimeCount: number; lastResponseTimeMs: number; history: ReviewRecord[] };
export type UnlockNotice = { start: number; end: number; at: number };
export type StudyModeState = { version: 2; deckId: string; studyKey: string; createdAt: number; updatedAt: number; currentCardId: string | null; reviewSequence: string[]; totalReviews: number; rightReviews: number; wrongReviews: number; unlockedCount: number; lastUnlock: UnlockNotice | null; cards: Record<string, CardProgress> };
export type DeckProgressEnvelope = { version: 2; deckId: string; createdAt: number; updatedAt: number; modes: Record<string, StudyModeState> };
export type ReviewTransaction = { reviewId: string; cardId: string; result: ReviewResult; difficulty: ReviewDifficulty; responseTimeMs: number; beforeState: StudyModeState; sessionId?: string; sessionStartedAt?: number; activityKind?: StudyActivityKind };
export type DirectionalCardCopy = { prompt: string; answer: string; sideLabel: string };
export type StudyStats = { available: number; reviewed: number; accuracy: number | null; everWrong: number; markedHard: number; averageResponseTimeMs: number; mastered: number; totalReviews: number; bestStreak: number };
