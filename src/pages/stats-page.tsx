import { BarChart3, Clock3, Cloud, Gauge, Laptop, TrendingUp } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { loadGreekDeck, loadGreekLesson3GrammarDeck, loadGreekLesson3VocabularyDeck, loadLatinDeck } from "../data/builtin-decks";
import { useAuth } from "../features/auth/auth-context";
import { blankCardProgress, createModeState, directionalCopy, formatResponseTime, studyStats } from "../features/study/engine";
import { loadHenle } from "../features/henle/henle-data";
import { loadProgressEnvelope, saveProgressEnvelope } from "../features/study/progress-repository";
import { intrinsicCardDifficulty, scoredSession, userProficiencyScore } from "../features/study/scoring";
import type { CardProgress, DeckDefinition, DeckProgressEnvelope, ReviewRecord, StudyActivityKind, StudyCard, StudyDirection, StudyModeState } from "../features/study/types";
import { useAsync } from "../hooks/use-async";
import "./stats-page.css";

type Language = "Greek" | "Latin";
type StatsSource = {
  language: Language;
  source: string;
  mode: string;
  direction: StudyDirection;
  deck: DeckDefinition;
  cards: StudyCard[];
  studyKey: string;
};

type SourceSummary = ReturnType<typeof summarizeSource>;
type CardPerformance = ReturnType<typeof summarizeCard>;
type ReviewEvent = {
  language: Language;
  source: string;
  mode: string;
  sourceKey: string;
  cardKey: string;
  cardId: string;
  reviewId: string;
  prompt: string;
  reviewedAt: number;
  result: "right" | "wrong";
  difficulty: "easy" | "medium" | "hard";
  responseTimeMs: number;
  intrinsicDifficulty: number;
  review: ReviewRecord;
  sessionId?: string;
  sessionStartedAt?: number;
  sessionName?: string;
  activityKind?: StudyActivityKind;
  scopeSessionId?: string;
};
type SessionSummary = {
  id: string;
  language: Language;
  name: string;
  startedAt: number;
  endedAt: number;
  reviews: number;
  right: number;
  wrong: number;
  easy: number;
  medium: number;
  hard: number;
  totalTimeMs: number;
  averageTimeMs: number;
  averageCardDifficulty: number;
  accuracy: number;
  score: number;
  inferred: boolean;
  changeFromPrevious: number | null;
};
type TrendPoint = { label: string; value: number };

const CARD_PREVIEW = 12;
const CARD_STEP = 25;
const sessionDateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
const weekFormatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

function percent(value: number | null) { return value === null ? "—" : `${(value * 100).toFixed(value >= 0.995 ? 0 : 1)}%`; }
function difficultyLabel(value: number) { return `${Math.round(value)}/100`; }
function sourceKey(source: StatsSource) { return `${source.language}::${source.source}::${source.studyKey}`; }
function cardKey(source: StatsSource, card: StudyCard) { return `${sourceKey(source)}::${card.id}`; }

function formatDuration(ms: number) {
  if (!ms) return "0 s";
  const seconds = ms / 1_000;
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 2 : 1)} s`;
  const minutes = Math.floor(seconds / 60), remaining = Math.round(seconds % 60);
  if (minutes < 60) return `${minutes}m ${remaining}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function dateTime(value: number) { return value ? sessionDateFormatter.format(value) : "No reviews yet"; }

function stateFor(source: StatsSource, envelopes: Record<string, DeckProgressEnvelope | null>) {
  return envelopes[source.deck.id]?.modes[source.studyKey] ?? createModeState(source.deck.id, source.studyKey, source.deck.cards.length, source.deck.staged);
}

function summarizeSource(source: StatsSource, state: StudyModeState) {
  const stats = studyStats(source.cards, state);
  let easy = 0, medium = 0, hard = 0, responseCount = 0, responseTotalMs = 0, lastReviewedAt = 0;
  for (const card of source.cards) {
    const progress = state.cards[card.id];
    if (!progress) continue;
    easy += progress.easy; medium += progress.medium; hard += progress.hard;
    responseCount += progress.responseTimeCount; responseTotalMs += progress.responseTimeTotalMs;
    lastReviewedAt = Math.max(lastReviewedAt, progress.lastReviewedAt);
  }
  return { source, state, stats, easy, medium, hard, responseCount, responseTotalMs, lastReviewedAt };
}

function difficultyValue(value: ReviewRecord["difficulty"]) { return value === "easy" ? 1 : value === "medium" ? 2 : 3; }
function periodPerformance(history: ReviewRecord[]) {
  if (!history.length) return { accuracy: 0, averageTimeMs: 0, averageDifficulty: 0 };
  return {
    accuracy: history.filter((review) => review.result === "right").length / history.length,
    averageTimeMs: history.reduce((sum, review) => sum + review.responseTimeMs, 0) / history.length,
    averageDifficulty: history.reduce((sum, review) => sum + difficultyValue(review.difficulty), 0) / history.length,
  };
}
function improvementScore(progress: CardProgress) {
  if (progress.history.length < 4) return null;
  const split = Math.floor(progress.history.length / 2), early = periodPerformance(progress.history.slice(0, split)), recent = periodPerformance(progress.history.slice(-split));
  const accuracyGain = recent.accuracy - early.accuracy;
  const speedGain = Math.max(-1, Math.min(1, (early.averageTimeMs - recent.averageTimeMs) / Math.max(1_000, early.averageTimeMs)));
  const difficultyGain = Math.max(-1, Math.min(1, (early.averageDifficulty - recent.averageDifficulty) / 2));
  return accuracyGain * 60 + speedGain * 25 + difficultyGain * 15;
}

function summarizeCard(source: StatsSource, card: StudyCard, progress: CardProgress) {
  const accuracy = progress.reviews ? progress.right / progress.reviews : null;
  const averageTimeMs = progress.responseTimeCount ? progress.responseTimeTotalMs / progress.responseTimeCount : 0;
  const wrongRate = progress.reviews ? progress.wrong / progress.reviews : 0, hardRate = progress.reviews ? progress.hard / progress.reviews : 0;
  const slowPenalty = averageTimeMs > 4_000 ? Math.min(20, Math.log2(averageTimeMs / 4_000) * 8) : 0;
  const hardestScore = progress.reviews ? wrongRate * 55 + hardRate * 25 + slowPenalty : 0;
  const intrinsicDifficulty = intrinsicCardDifficulty({ language: source.language, source: source.source, cards: source.cards }, card);
  return { source, card, progress, prompt: directionalCopy(card, source.direction).prompt, accuracy, averageTimeMs, totalTimeMs: progress.responseTimeTotalMs, hardestScore, intrinsicDifficulty, improvement: improvementScore(progress) };
}

function aggregateLanguage(rows: SourceSummary[]) {
  let totalReviews = 0, rightReviews = 0, reviewed = 0, mastered = 0, everWrong = 0, hardCards = 0, responseTotal = 0, responseCount = 0, bestStreak = 0, lastReviewedAt = 0;
  for (const row of rows) {
    totalReviews += row.state.totalReviews; rightReviews += row.state.rightReviews; reviewed += row.stats.reviewed; mastered += row.stats.mastered; everWrong += row.stats.everWrong; hardCards += row.stats.markedHard;
    responseTotal += row.responseTotalMs; responseCount += row.responseCount; bestStreak = Math.max(bestStreak, row.stats.bestStreak); lastReviewedAt = Math.max(lastReviewedAt, row.lastReviewedAt);
  }
  return { totalReviews, accuracy: totalReviews ? rightReviews / totalReviews : null, reviewed, mastered, everWrong, hardCards, totalRecallTimeMs: responseTotal, averageResponseTimeMs: responseCount ? responseTotal / responseCount : 0, bestStreak, lastReviewedAt };
}

function automaticSessionName(language: Language, reviews: ReviewEvent[], startedAt: number) {
  const sources = [...new Set(reviews.map((review) => review.source))];
  const focus = sources.length === 1 ? sources[0] : sources.length === 2 ? sources.join(" + ") : "Mixed study";
  return `${language} · ${focus} · ${sessionDateFormatter.format(startedAt)}`;
}

function summarizeSession(id: string, language: Language, reviews: ReviewEvent[], inferred: boolean): SessionSummary {
  const startedAt = Math.min(...reviews.map((review) => review.sessionStartedAt ?? review.reviewedAt)), endedAt = Math.max(...reviews.map((review) => review.reviewedAt));
  const right = reviews.filter((review) => review.result === "right").length, easy = reviews.filter((review) => review.difficulty === "easy").length, medium = reviews.filter((review) => review.difficulty === "medium").length, hard = reviews.filter((review) => review.difficulty === "hard").length;
  const totalTimeMs = reviews.reduce((sum, review) => sum + review.responseTimeMs, 0);
  const customName = reviews.find((review) => review.sessionName?.trim())?.sessionName?.trim();
  return {
    id, language, name: customName || automaticSessionName(language, reviews, startedAt), startedAt, endedAt, reviews: reviews.length, right, wrong: reviews.length - right, easy, medium, hard, totalTimeMs,
    averageTimeMs: totalTimeMs / reviews.length,
    averageCardDifficulty: reviews.reduce((sum, review) => sum + review.intrinsicDifficulty, 0) / reviews.length,
    accuracy: right / reviews.length,
    score: scoredSession(reviews.map((review) => ({ result: review.result, responseTimeMs: review.responseTimeMs, intrinsicDifficulty: review.intrinsicDifficulty }))),
    inferred, changeFromPrevious: null,
  };
}

function buildSessions(rawEvents: ReviewEvent[]) {
  const events = rawEvents.map((event) => ({ ...event }));
  const sessions: SessionSummary[] = [];
  for (const language of ["Greek", "Latin"] as Language[]) {
    const languageEvents = events.filter((event) => event.language === language && event.activityKind !== "warmup").sort((a, b) => a.reviewedAt - b.reviewedAt);
    const explicit = new Map<string, ReviewEvent[]>(), legacy: ReviewEvent[] = [];
    for (const event of languageEvents) {
      if (event.sessionId) {
        event.scopeSessionId = event.sessionId;
        explicit.set(event.sessionId, [...(explicit.get(event.sessionId) ?? []), event]);
      } else legacy.push(event);
    }
    for (const [id, reviews] of explicit) sessions.push(summarizeSession(id, language, reviews, false));
    let inferredIndex = 0, bucket: ReviewEvent[] = [];
    const closeBucket = () => {
      if (!bucket.length) return;
      const id = `legacy-${language}-${inferredIndex++}`;
      for (const event of bucket) event.scopeSessionId = id;
      sessions.push(summarizeSession(id, language, bucket, true));
      bucket = [];
    };
    for (const event of legacy) {
      const previous = bucket.at(-1);
      if (previous && event.reviewedAt - previous.reviewedAt > 30 * 60_000) closeBucket();
      bucket.push(event);
    }
    closeBucket();
  }
  for (const language of ["Greek", "Latin"] as Language[]) {
    const chronological = sessions.filter((session) => session.language === language).sort((a, b) => a.startedAt - b.startedAt);
    chronological.forEach((session, index) => { session.changeFromPrevious = index ? Number((session.score - chronological[index - 1].score).toFixed(1)) : null; });
  }
  return { sessions, events };
}

function scopedProgress(reviews: ReviewRecord[]) {
  const progress = blankCardProgress(), history = [...reviews].sort((a, b) => a.reviewedAt - b.reviewedAt);
  progress.presented = history.length; progress.reviews = history.length; progress.responseTimeCount = history.length;
  let streak = 0;
  for (const review of history) {
    progress[review.result] += 1; progress[review.difficulty] += 1; progress.responseTimeTotalMs += review.responseTimeMs;
    if (review.result === "right") { streak += 1; progress.initialMastered = true; } else { streak = 0; progress.lapses += 1; }
    progress.bestStreak = Math.max(progress.bestStreak, streak);
  }
  progress.streak = streak; progress.history = history;
  const last = history.at(-1);
  if (last) {
    progress.lastReviewedAt = last.reviewedAt; progress.lastResult = last.result; progress.lastDifficulty = last.difficulty; progress.lastResponseTimeMs = last.responseTimeMs; progress.intervalMs = last.intervalMs; progress.strength = last.strength;
  }
  return progress;
}

function cardsForScope(allCards: CardPerformance[], events: ReviewEvent[], allSessions: boolean) {
  if (allSessions) return allCards;
  const histories = new Map<string, ReviewRecord[]>();
  for (const event of events) histories.set(event.cardKey, [...(histories.get(event.cardKey) ?? []), event.review]);
  return allCards.flatMap((card) => {
    const history = histories.get(cardKey(card.source, card.card));
    return history?.length ? [summarizeCard(card.source, card.card, scopedProgress(history))] : [];
  });
}

function summariesForScope(allRows: SourceSummary[], cards: CardPerformance[], allSessions: boolean) {
  if (allSessions) return allRows;
  const bySource = new Map<string, CardPerformance[]>();
  for (const card of cards) bySource.set(sourceKey(card.source), [...(bySource.get(sourceKey(card.source)) ?? []), card]);
  return allRows.map((row) => {
    const state = createModeState(row.source.deck.id, row.source.studyKey, row.source.deck.cards.length, row.source.deck.staged);
    state.unlockedCount = row.state.unlockedCount;
    for (const card of bySource.get(sourceKey(row.source)) ?? []) state.cards[card.card.id] = card.progress;
    state.totalReviews = Object.values(state.cards).reduce((sum, progress) => sum + progress.reviews, 0);
    state.rightReviews = Object.values(state.cards).reduce((sum, progress) => sum + progress.right, 0);
    state.wrongReviews = state.totalReviews - state.rightReviews;
    state.updatedAt = Math.max(0, ...Object.values(state.cards).map((progress) => progress.lastReviewedAt));
    return summarizeSource(row.source, state);
  });
}

function proficiency(cards: CardPerformance[]) {
  return userProficiencyScore(cards.map((card) => ({ context: { language: card.source.language, source: card.source.source, cards: card.source.cards }, card: card.card, progress: card.progress })));
}

function weeklyTrendData(sessions: SessionSummary[]) {
  const buckets = new Map<number, SessionSummary[]>();
  for (const session of sessions) {
    const date = new Date(session.startedAt), day = (date.getDay() + 6) % 7;
    date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - day);
    const key = date.getTime(); buckets.set(key, [...(buckets.get(key) ?? []), session]);
  }
  const weeks = [...buckets.entries()].sort(([a], [b]) => a - b);
  const score: TrendPoint[] = [], time: TrendPoint[] = [];
  for (const [week, items] of weeks) {
    const reviews = items.reduce((sum, item) => sum + item.reviews, 0), totalTime = items.reduce((sum, item) => sum + item.totalTimeMs, 0);
    score.push({ label: weekFormatter.format(week), value: items.reduce((sum, item) => sum + item.score, 0) / items.length });
    time.push({ label: weekFormatter.format(week), value: reviews ? totalTime / reviews / 1_000 : 0 });
  }
  return { score, time };
}

export function StatsPage() {
  const { user } = useAuth();
  const [selectedSessions, setSelectedSessions] = useState<Set<string> | null>(null);
  const [sessionNameOverrides, setSessionNameOverrides] = useState<Record<string, string>>({});
  const [renameError, setRenameError] = useState<string | null>(null);
  const [savingSessionId, setSavingSessionId] = useState<string | null>(null);

  const { value, error, loading } = useAsync(async () => {
    const [greekFoundation, greekVocabulary, greekGrammar, latinVocabulary, henle] = await Promise.all([loadGreekDeck(), loadGreekLesson3VocabularyDeck(), loadGreekLesson3GrammarDeck(), loadLatinDeck(), loadHenle()]);
    const sources: StatsSource[] = [
      { language: "Greek", source: "Lessons 1–2", mode: "Forward", direction: "forward", deck: greekFoundation, cards: greekFoundation.cards, studyKey: "forward" },
      { language: "Greek", source: "Lessons 1–2", mode: "Reverse", direction: "reverse", deck: greekFoundation, cards: greekFoundation.cards, studyKey: "reverse" },
      { language: "Greek", source: "Lesson 3 Vocabulary", mode: "Forward", direction: "forward", deck: greekVocabulary, cards: greekVocabulary.cards, studyKey: "forward" },
      { language: "Greek", source: "Lesson 3 Vocabulary", mode: "Reverse", direction: "reverse", deck: greekVocabulary, cards: greekVocabulary.cards, studyKey: "reverse" },
      { language: "Greek", source: "Lesson 3 Grammar", mode: "Forward", direction: "forward", deck: greekGrammar, cards: greekGrammar.cards, studyKey: "forward" },
      { language: "Greek", source: "Lesson 3 Grammar", mode: "Reverse", direction: "reverse", deck: greekGrammar, cards: greekGrammar.cards, studyKey: "reverse" },
      { language: "Latin", source: "Dickinson Vocabulary", mode: "Forward", direction: "forward", deck: latinVocabulary, cards: latinVocabulary.cards, studyKey: "forward" },
      { language: "Latin", source: "Dickinson Vocabulary", mode: "Reverse", direction: "reverse", deck: latinVocabulary, cards: latinVocabulary.cards, studyKey: "reverse" },
      { language: "Latin", source: "Henle Grammar Forms", mode: "Forward", direction: "forward", deck: henle.individualDeck, cards: henle.individualDeck.cards, studyKey: "individual:forward" },
      { language: "Latin", source: "Henle Grammar Forms", mode: "Reverse", direction: "reverse", deck: henle.individualDeck, cards: henle.individualDeck.cards, studyKey: "individual:reverse" },
      { language: "Latin", source: "Henle Whole Charts", mode: "Charts", direction: "forward", deck: henle.chartDeck, cards: henle.chartDeck.cards, studyKey: "chart" },
    ];
    const uniqueDeckIds = [...new Set(sources.map((source) => source.deck.id))];
    const loaded = await Promise.all(uniqueDeckIds.map(async (deckId) => [deckId, await loadProgressEnvelope(deckId, user)] as const));
    const envelopes = Object.fromEntries(loaded.map(([deckId, result]) => [deckId, result.envelope])) as Record<string, DeckProgressEnvelope | null>;
    const summaries = sources.map((source) => summarizeSource(source, stateFor(source, envelopes)));
    const cards = summaries.flatMap((row) => row.source.cards.map((card) => { const progress = row.state.cards[card.id]; return progress?.reviews ? summarizeCard(row.source, card, progress) : null; }).filter((item): item is CardPerformance => Boolean(item)));
    const rawEvents: ReviewEvent[] = [];
    for (const card of cards) for (const review of card.progress.history) rawEvents.push({
      language: card.source.language, source: card.source.source, mode: card.source.mode, sourceKey: sourceKey(card.source), cardKey: cardKey(card.source, card.card), cardId: card.card.id, reviewId: review.id,
      prompt: card.prompt, reviewedAt: review.reviewedAt, result: review.result, difficulty: review.difficulty, responseTimeMs: review.responseTimeMs, intrinsicDifficulty: card.intrinsicDifficulty, review,
      sessionId: review.sessionId, sessionStartedAt: review.sessionStartedAt, sessionName: review.sessionName, activityKind: review.activityKind,
    });
    const { sessions, events } = buildSessions(rawEvents);
    events.sort((a, b) => b.reviewedAt - a.reviewedAt);
    return { summaries, cards, sessions, events, envelopes };
  }, [user?.id]);

  const sessionIds = useMemo(() => value?.sessions.map((session) => session.id) ?? [], [value?.sessions]);
  const allSessionsSelected = selectedSessions === null;
  const scopedEvents = useMemo(() => {
    if (!value) return [];
    return allSessionsSelected ? value.events : value.events.filter((event) => event.scopeSessionId && (selectedSessions?.has(event.scopeSessionId) ?? false));
  }, [allSessionsSelected, selectedSessions, value]);
  const scopedCards = useMemo(() => value ? cardsForScope(value.cards, scopedEvents, allSessionsSelected) : [], [allSessionsSelected, scopedEvents, value]);
  const scopedRows = useMemo(() => value ? summariesForScope(value.summaries, scopedCards, allSessionsSelected) : [], [allSessionsSelected, scopedCards, value]);
  const scopedSessions = useMemo(() => value ? (allSessionsSelected ? value.sessions : value.sessions.filter((session) => selectedSessions?.has(session.id) ?? false)) : [], [allSessionsSelected, selectedSessions, value]);

  if (loading || !value) return <main className="page-shell"><div className="study-loading panel-surface" role="status"><span className="loading-mark">Σ</span><p>Loading your study history…</p></div></main>;

  function sessionName(session: SessionSummary) { return sessionNameOverrides[session.id] ?? session.name; }
  function toggleSession(id: string, checked: boolean) {
    const next = selectedSessions === null ? new Set(sessionIds) : new Set(selectedSessions);
    if (checked) next.add(id); else next.delete(id);
    setSelectedSessions(next.size === sessionIds.length ? null : next);
  }
  async function renameSession(session: SessionSummary) {
    const snapshot = value;
    if (!snapshot) return;
    const requested = window.prompt("Rename this study session", sessionName(session));
    const nextName = requested?.trim();
    if (!nextName || nextName === sessionName(session)) return;
    setRenameError(null); setSavingSessionId(session.id);
    try {
      const reviewIds = new Set(snapshot.events.filter((event) => event.scopeSessionId === session.id).map((event) => event.reviewId));
      const now = Date.now(), saves: Promise<unknown>[] = [];
      for (const envelope of Object.values(snapshot.envelopes)) {
        if (!envelope) continue;
        const nextEnvelope = structuredClone(envelope); let changed = false;
        for (const mode of Object.values(nextEnvelope.modes)) {
          let modeChanged = false;
          for (const progress of Object.values(mode.cards)) {
            progress.history = progress.history.map((review) => reviewIds.has(review.id) ? (modeChanged = true, changed = true, { ...review, sessionName: nextName }) : review);
          }
          if (modeChanged) mode.updatedAt = Math.max(mode.updatedAt, now);
        }
        if (changed) { nextEnvelope.updatedAt = Math.max(nextEnvelope.updatedAt, now); saves.push(saveProgressEnvelope(nextEnvelope, user)); }
      }
      await Promise.all(saves);
      setSessionNameOverrides((current) => ({ ...current, [session.id]: nextName }));
    } catch (reason) { setRenameError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setSavingSessionId(null); }
  }

  const greekRows = scopedRows.filter((row) => row.source.language === "Greek"), latinRows = scopedRows.filter((row) => row.source.language === "Latin");
  const greekCards = scopedCards.filter((card) => card.source.language === "Greek"), latinCards = scopedCards.filter((card) => card.source.language === "Latin");
  const greekSessions = scopedSessions.filter((session) => session.language === "Greek"), latinSessions = scopedSessions.filter((session) => session.language === "Latin");
  const overall = proficiency(scopedCards), greekScore = proficiency(greekCards), latinScore = proficiency(latinCards);
  const trends = weeklyTrendData(scopedSessions);
  const filterLabel = allSessionsSelected ? "All sessions" : `${selectedSessions?.size ?? 0} of ${value.sessions.length} sessions`;

  return <main className="page-shell stats-page">
    <header className="stats-hero">
      <div><p className="eyebrow">Continuous memory bank</p><h1>Study Stats</h1><p>Your complete Greek and Latin history is analyzed here. Use the session filter to compare one session, several sessions together, or your complete history.</p></div>
      <div className="stats-sync-note">{user ? <Cloud aria-hidden="true" /> : <Laptop aria-hidden="true" />}<span>{user ? "Showing your synced account progress" : "Showing guest progress saved on this device"}</span></div>
    </header>
    {(error || renameError) && <div className="inline-alert">{error ?? renameError}</div>}

    <section className="panel-surface stats-session-filter">
      <div className="stats-section-heading"><div><p className="eyebrow">Stats scope</p><h2>Choose sessions</h2><p>{filterLabel}. Every score, card analysis, trend, and review list below follows this selection.</p></div><div className="stats-filter-actions"><button className="small-outline-button" type="button" onClick={() => setSelectedSessions(null)}>All</button><button className="small-outline-button" type="button" onClick={() => setSelectedSessions(new Set())}>Clear</button></div></div>
      {value.sessions.length ? <div className="stats-session-picker">{[...value.sessions].sort((a, b) => b.startedAt - a.startedAt).map((session) => <div className="stats-session-choice" key={session.id}><label><input type="checkbox" checked={allSessionsSelected || (selectedSessions?.has(session.id) ?? false)} onChange={(event) => toggleSession(session.id, event.target.checked)} /><span><strong>{sessionName(session)}</strong><small>{session.language} · {dateTime(session.startedAt)} · {session.reviews} reviews · score {session.score.toFixed(1)}</small></span></label><button className="text-button" type="button" onClick={() => setSelectedSessions(new Set([session.id]))}>Only</button></div>)}</div> : <p className="stats-empty">Complete reviews to create sessions.</p>}
    </section>

    <section className="panel-surface stats-score-banner">
      <div className="stats-score-main"><Gauge aria-hidden="true" /><div><span>Overall proficiency</span><strong>{overall.score}</strong><em>{overall.tier}</em></div></div>
      <div className="stats-score-breakdown"><div><span>Greek</span><strong>{greekScore.score}</strong><em>{greekScore.tier}</em></div><div><span>Latin</span><strong>{latinScore.score}</strong><em>{latinScore.tier}</em></div><div><span>Avg. reviewed difficulty</span><strong>{difficultyLabel(overall.averageDifficulty)}</strong></div><div><span>Hardest mastered</span><strong>{difficultyLabel(overall.hardestMastered)}</strong></div></div>
    </section>

    <section className="stats-trend-grid">
      <TrendChart title="Session score by week" subtitle="Average ranked-session score" points={trends.score} format={(value) => value.toFixed(1)} />
      <TrendChart title="Recall time by week" subtitle="Average active front-side time" points={trends.time} format={(value) => `${value.toFixed(value < 10 ? 2 : 1)} s`} lowerIsBetter />
    </section>

    <LanguageStats language="Greek" rows={greekRows} cards={greekCards} sessions={greekSessions} href="/greek" sessionName={sessionName} onRenameSession={renameSession} savingSessionId={savingSessionId} />
    <LanguageStats language="Latin" rows={latinRows} cards={latinCards} sessions={latinSessions} href="/latin" sessionName={sessionName} onRenameSession={renameSession} savingSessionId={savingSessionId} />

    <section className="panel-surface stats-recent-section">
      <div className="stats-section-heading"><div><p className="eyebrow">Latest activity</p><h2>Recent reviews</h2></div><Clock3 aria-hidden="true" /></div>
      {scopedEvents.length ? <div className="stats-recent-list">{scopedEvents.slice(0, 12).map((review, index) => <div className="stats-recent-row" key={`${review.reviewedAt}:${review.source}:${index}`}><div><strong>{review.prompt}</strong><span>{review.language} · {review.source} · {review.mode} · difficulty {difficultyLabel(review.intrinsicDifficulty)} · {dateTime(review.reviewedAt)}{review.activityKind === "warmup" ? " · warm-up" : ""}</span></div><div className="stats-review-result"><span className={review.result === "right" ? "is-right" : "is-wrong"}>{review.result}</span><span>{review.difficulty}</span><span>{formatResponseTime(review.responseTimeMs)}</span></div></div>)}</div> : <p className="stats-empty">No reviews match the selected sessions.</p>}
    </section>
  </main>;
}

function LanguageStats({ language, rows, cards, sessions, href, sessionName, onRenameSession, savingSessionId }: { language: Language; rows: SourceSummary[]; cards: CardPerformance[]; sessions: SessionSummary[]; href: string; sessionName: (session: SessionSummary) => string; onRenameSession: (session: SessionSummary) => Promise<void>; savingSessionId: string | null }) {
  const [cardLimit, setCardLimit] = useState(CARD_PREVIEW);
  const aggregate = aggregateLanguage(rows), score = proficiency(cards);
  const hardest = [...cards].filter((card) => card.progress.reviews >= 2).sort((a, b) => b.hardestScore - a.hardestScore).slice(0, 8);
  const difficultMastered = [...cards].filter((card) => card.progress.initialMastered).sort((a, b) => b.intrinsicDifficulty - a.intrinsicDifficulty).slice(0, 8);
  const slowest = [...cards].sort((a, b) => b.averageTimeMs - a.averageTimeMs).slice(0, 8);
  const improved = [...cards].filter((card) => (card.improvement ?? 0) > 0).sort((a, b) => (b.improvement ?? 0) - (a.improvement ?? 0)).slice(0, 8);
  const mostReviewed = [...cards].sort((a, b) => b.progress.reviews - a.progress.reviews).slice(0, 8);
  const cardRows = [...cards].sort((a, b) => b.totalTimeMs - a.totalTimeMs), rankedSessions = [...sessions].sort((a, b) => b.score - a.score || b.reviews - a.reviews);
  const visibleCardCount = Math.min(cardLimit, cardRows.length);

  return <section className="stats-language-section">
    <div className="stats-language-title"><div><p className="eyebrow">{language}</p><h2>{language} memory bank</h2></div><Link className="small-outline-button" to={href}>Open {language}</Link></div>
    <div className="stats-overview-grid">
      <Stat label="Proficiency score" value={`${score.score} · ${score.tier}`} /><Stat label="Avg. card difficulty" value={difficultyLabel(score.averageDifficulty)} /><Stat label="Hardest mastered" value={difficultyLabel(score.hardestMastered)} />
      <Stat label="Total reviews" value={aggregate.totalReviews.toLocaleString()} /><Stat label="Accuracy" value={percent(aggregate.accuracy)} /><Stat label="Total active recall time" value={formatDuration(aggregate.totalRecallTimeMs)} /><Stat label="Avg. recall time" value={formatResponseTime(aggregate.averageResponseTimeMs)} /><Stat label="Study sessions" value={sessions.length.toLocaleString()} /><Stat label="Reviewed card-directions" value={aggregate.reviewed.toLocaleString()} /><Stat label="Mastered once" value={aggregate.mastered.toLocaleString()} /><Stat label="Ever wrong" value={aggregate.everWrong.toLocaleString()} /><Stat label="Marked hard" value={aggregate.hardCards.toLocaleString()} /><Stat label="Best streak" value={aggregate.bestStreak.toLocaleString()} /><Stat label="Last review" value={dateTime(aggregate.lastReviewedAt)} />
    </div>

    <div className="stats-analysis-grid">
      <RankedCards title="Hardest for you" subtitle="Wrong answers, hard ratings, and slow recall" cards={hardest} metric={(card) => `${percent(card.accuracy)} · ${formatResponseTime(card.averageTimeMs)}`} />
      <RankedCards title="Highest difficulty mastered" subtitle="Intrinsic difficulty from lesson/rank/Henle progression" cards={difficultMastered} metric={(card) => difficultyLabel(card.intrinsicDifficulty)} />
      <RankedCards title="Most improved" subtitle="Compares early vs. recent accuracy, speed, and ratings" cards={improved} metric={(card) => `+${Math.round(card.improvement ?? 0)} improvement`} icon={<TrendingUp aria-hidden="true" />} />
      <RankedCards title="Slowest recall" subtitle="Highest average active front-side time" cards={slowest} metric={(card) => `${formatResponseTime(card.averageTimeMs)} avg.`} />
      <RankedCards title="Most reviewed" subtitle="Cards receiving the most repetitions" cards={mostReviewed} metric={(card) => `${card.progress.reviews} reviews`} />
    </div>

    <div className="panel-surface stats-table-wrap">
      <div className="stats-section-heading"><div><p className="eyebrow">Session analysis</p><h3>Session rankings</h3><p>Use Continue to reopen an explicit past session. Rename gives every session a custom title while preserving its history and ranking.</p></div><TrendingUp aria-hidden="true" /></div>
      {rankedSessions.length ? <div className="stats-table-scroll"><table className="stats-table stats-session-table"><thead><tr><th>Rank</th><th>Session</th><th>Reviews</th><th>Accuracy</th><th>Avg. difficulty</th><th>Total time</th><th>Avg. time</th><th>Score</th><th>Vs. previous</th><th>Actions</th></tr></thead><tbody>{rankedSessions.map((session, index) => <tr key={session.id}><td>#{index + 1}</td><td><strong>{sessionName(session)}</strong><span className="stats-session-date">{dateTime(session.startedAt)}{session.inferred ? " · legacy inferred" : ""}</span></td><td>{session.reviews}</td><td>{percent(session.accuracy)}</td><td>{difficultyLabel(session.averageCardDifficulty)}</td><td>{formatDuration(session.totalTimeMs)}</td><td>{formatResponseTime(session.averageTimeMs)}</td><td><strong>{session.score.toFixed(1)}</strong></td><td>{session.changeFromPrevious === null ? "—" : `${session.changeFromPrevious >= 0 ? "+" : ""}${session.changeFromPrevious.toFixed(1)}`}</td><td><div className="stats-session-actions">{!session.inferred && <Link className="small-outline-button" to={`${href}?session=${encodeURIComponent(session.id)}&sessionStartedAt=${session.startedAt}`}>Continue</Link>}<button className="small-outline-button" type="button" disabled={savingSessionId === session.id} onClick={() => void onRenameSession(session)}>{savingSessionId === session.id ? "Saving…" : "Rename"}</button></div></td></tr>)}</tbody></table></div> : <p className="stats-empty">No sessions match this Stats selection.</p>}
    </div>

    <div className="panel-surface stats-table-wrap">
      <div className="stats-section-heading"><div><p className="eyebrow">Source analysis</p><h3>Progress by deck and direction</h3></div><BarChart3 aria-hidden="true" /></div>
      <div className="stats-table-scroll"><table className="stats-table"><thead><tr><th>Source</th><th>Mode</th><th>Available</th><th>Reviewed</th><th>Reviews</th><th>Accuracy</th><th>Mastered</th><th>Wrong</th><th>Hard</th><th>Easy / Medium / Hard</th><th>Total time</th><th>Avg. time</th><th>Best streak</th></tr></thead><tbody>{rows.map((row) => <tr key={`${row.source.source}:${row.source.studyKey}`}><td>{row.source.source}</td><td>{row.source.mode}</td><td>{row.stats.available.toLocaleString()} / {row.source.cards.length.toLocaleString()}</td><td>{row.stats.reviewed.toLocaleString()}</td><td>{row.stats.totalReviews.toLocaleString()}</td><td>{percent(row.stats.accuracy)}</td><td>{row.stats.mastered.toLocaleString()}</td><td>{row.stats.everWrong.toLocaleString()}</td><td>{row.stats.markedHard.toLocaleString()}</td><td>{row.easy.toLocaleString()} / {row.medium.toLocaleString()} / {row.hard.toLocaleString()}</td><td>{formatDuration(row.responseTotalMs)}</td><td>{formatResponseTime(row.stats.averageResponseTimeMs)}</td><td>{row.stats.bestStreak.toLocaleString()}</td></tr>)}</tbody></table></div>
    </div>

    <div className="panel-surface stats-table-wrap">
      <div className="stats-section-heading"><div><p className="eyebrow">Card-by-card preview</p><h3>Time, difficulty, and performance</h3><p>Showing {visibleCardCount.toLocaleString()} of {cardRows.length.toLocaleString()} reviewed card-directions, sorted by total active recall time.</p></div><Clock3 aria-hidden="true" /></div>
      {cardRows.length ? <><div className="stats-table-scroll"><table className="stats-table stats-card-table"><thead><tr><th>Card</th><th>Source</th><th>Mode</th><th>Intrinsic difficulty</th><th>Reviews</th><th>Accuracy</th><th>Total time</th><th>Avg. time</th><th>Last time</th><th>Wrong</th><th>Hard</th><th>Best streak</th><th>Last reviewed</th></tr></thead><tbody>{cardRows.slice(0, visibleCardCount).map((card) => <tr key={`${card.source.source}:${card.source.studyKey}:${card.card.id}`}><td className="stats-card-prompt">{card.prompt}</td><td>{card.source.source}</td><td>{card.source.mode}</td><td>{difficultyLabel(card.intrinsicDifficulty)}</td><td>{card.progress.reviews}</td><td>{percent(card.accuracy)}</td><td>{formatDuration(card.totalTimeMs)}</td><td>{formatResponseTime(card.averageTimeMs)}</td><td>{formatResponseTime(card.progress.lastResponseTimeMs)}</td><td>{card.progress.wrong}</td><td>{card.progress.hard}</td><td>{card.progress.bestStreak}</td><td>{dateTime(card.progress.lastReviewedAt)}</td></tr>)}</tbody></table></div><div className="stats-card-controls">{visibleCardCount < cardRows.length && <button className="small-outline-button" type="button" onClick={() => setCardLimit((value) => Math.min(cardRows.length, value + CARD_STEP))}>Show more</button>}{visibleCardCount < cardRows.length && <button className="small-outline-button" type="button" onClick={() => setCardLimit(cardRows.length)}>Show all</button>}{cardLimit > CARD_PREVIEW && <button className="text-button" type="button" onClick={() => setCardLimit(CARD_PREVIEW)}>Collapse to preview</button>}</div></> : <p className="stats-empty">No reviewed cards match this selection.</p>}
    </div>
  </section>;
}

function TrendChart({ title, subtitle, points, format, lowerIsBetter = false }: { title: string; subtitle: string; points: TrendPoint[]; format: (value: number) => string; lowerIsBetter?: boolean }) {
  if (!points.length) return <section className="panel-surface stats-trend-panel"><h3>{title}</h3><p>{subtitle}</p><span className="stats-empty">No session data in this scope.</span></section>;
  const values = points.map((point) => point.value), min = Math.min(...values), max = Math.max(...values), range = Math.max(1, max - min);
  const coordinates = points.map((point, index) => ({ ...point, x: points.length === 1 ? 50 : 6 + index * (88 / (points.length - 1)), y: 38 - ((point.value - min) / range) * 30 }));
  return <section className="panel-surface stats-trend-panel"><div className="stats-trend-heading"><div><h3>{title}</h3><p>{subtitle}{lowerIsBetter ? " · lower is better" : ""}</p></div><strong>{format(points.at(-1)?.value ?? 0)}</strong></div><svg className="stats-trend-chart" viewBox="0 0 100 44" role="img" aria-label={`${title}. Latest value ${format(points.at(-1)?.value ?? 0)}.`}><polyline points={coordinates.map((point) => `${point.x},${point.y}`).join(" ")} /><g>{coordinates.map((point) => <circle key={`${point.label}:${point.x}`} cx={point.x} cy={point.y} r="1.6"><title>{point.label}: {format(point.value)}</title></circle>)}</g></svg><div className="stats-trend-axis"><span>{points[0].label}</span><span>{points.at(-1)?.label}</span></div></section>;
}

function RankedCards({ title, subtitle, cards, metric, icon }: { title: string; subtitle: string; cards: CardPerformance[]; metric: (card: CardPerformance) => string; icon?: ReactNode }) {
  return <section className="panel-surface stats-ranked-panel"><div className="stats-ranked-heading"><div><h3>{title}</h3><p>{subtitle}</p></div>{icon}</div>{cards.length ? <ol>{cards.map((card) => <li key={`${card.source.source}:${card.source.studyKey}:${card.card.id}`}><div><strong>{card.prompt}</strong><span>{card.source.source} · {card.source.mode} · difficulty {difficultyLabel(card.intrinsicDifficulty)}</span></div><em>{metric(card)}</em></li>)}</ol> : <p className="stats-empty">More review history is needed for this analysis.</p>}</section>;
}
function Stat({ label, value }: { label: string; value: string }) { return <div className="stats-overview-card"><span>{label}</span><strong>{value}</strong></div>; }
