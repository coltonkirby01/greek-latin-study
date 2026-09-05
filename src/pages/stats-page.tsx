import { BarChart3, Clock3, Cloud, Gauge, Laptop, TrendingUp } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { loadGreekDeck, loadGreekLesson3GrammarDeck, loadGreekLesson3VocabularyDeck, loadLatinDeck } from "../data/builtin-decks";
import { useAuth } from "../features/auth/auth-context";
import { createModeState, directionalCopy, formatResponseTime, studyStats } from "../features/study/engine";
import { loadHenle } from "../features/henle/henle-data";
import { loadProgressEnvelope } from "../features/study/progress-repository";
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
  prompt: string;
  reviewedAt: number;
  result: "right" | "wrong";
  difficulty: "easy" | "medium" | "hard";
  responseTimeMs: number;
  intrinsicDifficulty: number;
  sessionId?: string;
  sessionStartedAt?: number;
  activityKind?: StudyActivityKind;
};
type SessionSummary = {
  id: string;
  language: Language;
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

function percent(value: number | null) { return value === null ? "—" : `${(value * 100).toFixed(value >= 0.995 ? 0 : 1)}%`; }
function difficultyLabel(value: number) { return `${Math.round(value)}/100`; }

function formatDuration(ms: number) {
  if (!ms) return "0 s";
  const seconds = ms / 1_000;
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 2 : 1)} s`;
  const minutes = Math.floor(seconds / 60), remaining = Math.round(seconds % 60);
  if (minutes < 60) return `${minutes}m ${remaining}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

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

function summarizeSession(id: string, language: Language, reviews: ReviewEvent[], inferred: boolean): SessionSummary {
  const startedAt = Math.min(...reviews.map((review) => review.sessionStartedAt ?? review.reviewedAt)), endedAt = Math.max(...reviews.map((review) => review.reviewedAt));
  const right = reviews.filter((review) => review.result === "right").length, easy = reviews.filter((review) => review.difficulty === "easy").length, medium = reviews.filter((review) => review.difficulty === "medium").length, hard = reviews.filter((review) => review.difficulty === "hard").length;
  const totalTimeMs = reviews.reduce((sum, review) => sum + review.responseTimeMs, 0);
  return {
    id, language, startedAt, endedAt, reviews: reviews.length, right, wrong: reviews.length - right, easy, medium, hard, totalTimeMs,
    averageTimeMs: totalTimeMs / reviews.length,
    averageCardDifficulty: reviews.reduce((sum, review) => sum + review.intrinsicDifficulty, 0) / reviews.length,
    accuracy: right / reviews.length,
    score: scoredSession(reviews.map((review) => ({ result: review.result, responseTimeMs: review.responseTimeMs, intrinsicDifficulty: review.intrinsicDifficulty }))),
    inferred, changeFromPrevious: null,
  };
}

function buildSessions(events: ReviewEvent[]) {
  const sessions: SessionSummary[] = [];
  for (const language of ["Greek", "Latin"] as Language[]) {
    const languageEvents = events.filter((event) => event.language === language && event.activityKind !== "warmup").sort((a, b) => a.reviewedAt - b.reviewedAt);
    const explicit = new Map<string, ReviewEvent[]>(), legacy: ReviewEvent[] = [];
    for (const event of languageEvents) event.sessionId ? explicit.set(event.sessionId, [...(explicit.get(event.sessionId) ?? []), event]) : legacy.push(event);
    for (const [id, reviews] of explicit) sessions.push(summarizeSession(id, language, reviews, false));
    let inferredIndex = 0, bucket: ReviewEvent[] = [];
    for (const event of legacy) {
      const previous = bucket.at(-1);
      if (previous && event.reviewedAt - previous.reviewedAt > 30 * 60_000) { sessions.push(summarizeSession(`legacy-${language}-${inferredIndex++}`, language, bucket, true)); bucket = []; }
      bucket.push(event);
    }
    if (bucket.length) sessions.push(summarizeSession(`legacy-${language}-${inferredIndex}`, language, bucket, true));
  }
  for (const language of ["Greek", "Latin"] as Language[]) {
    const chronological = sessions.filter((session) => session.language === language).sort((a, b) => a.startedAt - b.startedAt);
    chronological.forEach((session, index) => { session.changeFromPrevious = index ? Number((session.score - chronological[index - 1].score).toFixed(1)) : null; });
  }
  return sessions;
}

function proficiency(cards: CardPerformance[]) {
  return userProficiencyScore(cards.map((card) => ({ context: { language: card.source.language, source: card.source.source, cards: card.source.cards }, card: card.card, progress: card.progress })));
}
function dateTime(value: number) { return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(value) : "No reviews yet"; }

export function StatsPage() {
  const { user } = useAuth();
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
    const events: ReviewEvent[] = [];
    for (const card of cards) for (const review of card.progress.history) events.push({ language: card.source.language, source: card.source.source, mode: card.source.mode, prompt: card.prompt, reviewedAt: review.reviewedAt, result: review.result, difficulty: review.difficulty, responseTimeMs: review.responseTimeMs, intrinsicDifficulty: card.intrinsicDifficulty, sessionId: review.sessionId, sessionStartedAt: review.sessionStartedAt, activityKind: review.activityKind });
    events.sort((a, b) => b.reviewedAt - a.reviewedAt);
    return { summaries, cards, sessions: buildSessions(events), recent: events.slice(0, 30) };
  }, [user?.id]);

  if (loading || !value) return <main className="page-shell"><div className="study-loading panel-surface" role="status"><span className="loading-mark">Σ</span><p>Loading your study history…</p></div></main>;

  const greekRows = value.summaries.filter((row) => row.source.language === "Greek"), latinRows = value.summaries.filter((row) => row.source.language === "Latin");
  const greekCards = value.cards.filter((card) => card.source.language === "Greek"), latinCards = value.cards.filter((card) => card.source.language === "Latin");
  const greekSessions = value.sessions.filter((session) => session.language === "Greek"), latinSessions = value.sessions.filter((session) => session.language === "Latin");
  const overall = proficiency(value.cards), greekScore = proficiency(greekCards), latinScore = proficiency(latinCards);

  return <main className="page-shell stats-page">
    <header className="stats-hero">
      <div><p className="eyebrow">Continuous memory bank</p><h1>Study Stats</h1><p>Your complete Greek and Latin history is analyzed here whether or not a source is currently selected. Card difficulty is intrinsic to the material; your score rewards accurate, fast, retained mastery of progressively harder material.</p></div>
      <div className="stats-sync-note">{user ? <Cloud aria-hidden="true" /> : <Laptop aria-hidden="true" />}<span>{user ? "Showing your synced account progress" : "Showing guest progress saved on this device"}</span></div>
    </header>
    {error && <div className="inline-alert">{error}</div>}

    <section className="panel-surface stats-score-banner">
      <div className="stats-score-main"><Gauge aria-hidden="true" /><div><span>Overall proficiency</span><strong>{overall.score}</strong><em>{overall.tier}</em></div></div>
      <div className="stats-score-breakdown"><div><span>Greek</span><strong>{greekScore.score}</strong><em>{greekScore.tier}</em></div><div><span>Latin</span><strong>{latinScore.score}</strong><em>{latinScore.tier}</em></div><div><span>Avg. reviewed difficulty</span><strong>{difficultyLabel(overall.averageDifficulty)}</strong></div><div><span>Hardest mastered</span><strong>{difficultyLabel(overall.hardestMastered)}</strong></div></div>
    </section>

    <LanguageStats language="Greek" rows={greekRows} cards={greekCards} sessions={greekSessions} href="/greek" />
    <LanguageStats language="Latin" rows={latinRows} cards={latinCards} sessions={latinSessions} href="/latin" />

    <section className="panel-surface stats-recent-section">
      <div className="stats-section-heading"><div><p className="eyebrow">Latest activity</p><h2>Recent reviews</h2></div><Clock3 aria-hidden="true" /></div>
      {value.recent.length ? <div className="stats-recent-list">{value.recent.map((review, index) => <div className="stats-recent-row" key={`${review.reviewedAt}:${review.source}:${index}`}><div><strong>{review.prompt}</strong><span>{review.language} · {review.source} · {review.mode} · difficulty {difficultyLabel(review.intrinsicDifficulty)} · {dateTime(review.reviewedAt)}{review.activityKind === "warmup" ? " · warm-up" : ""}</span></div><div className="stats-review-result"><span className={review.result === "right" ? "is-right" : "is-wrong"}>{review.result}</span><span>{review.difficulty}</span><span>{formatResponseTime(review.responseTimeMs)}</span></div></div>)}</div> : <p className="stats-empty">No saved reviews yet.</p>}
    </section>
  </main>;
}

function LanguageStats({ language, rows, cards, sessions, href }: { language: Language; rows: SourceSummary[]; cards: CardPerformance[]; sessions: SessionSummary[]; href: string }) {
  const [cardLimit, setCardLimit] = useState(100);
  const aggregate = aggregateLanguage(rows), score = proficiency(cards);
  const hardest = [...cards].filter((card) => card.progress.reviews >= 2).sort((a, b) => b.hardestScore - a.hardestScore).slice(0, 8);
  const difficultMastered = [...cards].filter((card) => card.progress.initialMastered).sort((a, b) => b.intrinsicDifficulty - a.intrinsicDifficulty).slice(0, 8);
  const slowest = [...cards].sort((a, b) => b.averageTimeMs - a.averageTimeMs).slice(0, 8);
  const improved = [...cards].filter((card) => (card.improvement ?? 0) > 0).sort((a, b) => (b.improvement ?? 0) - (a.improvement ?? 0)).slice(0, 8);
  const mostReviewed = [...cards].sort((a, b) => b.progress.reviews - a.progress.reviews).slice(0, 8);
  const cardRows = [...cards].sort((a, b) => b.totalTimeMs - a.totalTimeMs), rankedSessions = [...sessions].sort((a, b) => b.score - a.score || b.reviews - a.reviews);

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
      <div className="stats-section-heading"><div><p className="eyebrow">Session analysis</p><h3>Session rankings</h3><p>Ranked sessions reward accuracy, speed, streaks, and harder material. Warm-ups strengthen memory but do not enter this ranking.</p></div><TrendingUp aria-hidden="true" /></div>
      {rankedSessions.length ? <div className="stats-table-scroll"><table className="stats-table"><thead><tr><th>Rank</th><th>Started</th><th>Reviews</th><th>Accuracy</th><th>Avg. difficulty</th><th>Total time</th><th>Avg. time</th><th>Right / Wrong</th><th>Easy / Medium / Hard</th><th>Score</th><th>Vs. previous</th></tr></thead><tbody>{rankedSessions.map((session, index) => <tr key={session.id}><td>#{index + 1}</td><td>{dateTime(session.startedAt)}{session.inferred ? <span className="stats-legacy-note"> inferred</span> : null}</td><td>{session.reviews}</td><td>{percent(session.accuracy)}</td><td>{difficultyLabel(session.averageCardDifficulty)}</td><td>{formatDuration(session.totalTimeMs)}</td><td>{formatResponseTime(session.averageTimeMs)}</td><td>{session.right} / {session.wrong}</td><td>{session.easy} / {session.medium} / {session.hard}</td><td><strong>{session.score.toFixed(1)}</strong></td><td>{session.changeFromPrevious === null ? "—" : `${session.changeFromPrevious >= 0 ? "+" : ""}${session.changeFromPrevious.toFixed(1)}`}</td></tr>)}</tbody></table></div> : <p className="stats-empty">Complete reviews to create ranked study sessions.</p>}
    </div>

    <div className="panel-surface stats-table-wrap">
      <div className="stats-section-heading"><div><p className="eyebrow">Source analysis</p><h3>Progress by deck and direction</h3></div><BarChart3 aria-hidden="true" /></div>
      <div className="stats-table-scroll"><table className="stats-table"><thead><tr><th>Source</th><th>Mode</th><th>Available</th><th>Reviewed</th><th>Reviews</th><th>Accuracy</th><th>Mastered</th><th>Wrong</th><th>Hard</th><th>Easy / Medium / Hard</th><th>Total time</th><th>Avg. time</th><th>Best streak</th></tr></thead><tbody>{rows.map((row) => <tr key={`${row.source.source}:${row.source.studyKey}`}><td>{row.source.source}</td><td>{row.source.mode}</td><td>{row.stats.available.toLocaleString()} / {row.source.cards.length.toLocaleString()}</td><td>{row.stats.reviewed.toLocaleString()}</td><td>{row.stats.totalReviews.toLocaleString()}</td><td>{percent(row.stats.accuracy)}</td><td>{row.stats.mastered.toLocaleString()}</td><td>{row.stats.everWrong.toLocaleString()}</td><td>{row.stats.markedHard.toLocaleString()}</td><td>{row.easy.toLocaleString()} / {row.medium.toLocaleString()} / {row.hard.toLocaleString()}</td><td>{formatDuration(row.responseTotalMs)}</td><td>{formatResponseTime(row.stats.averageResponseTimeMs)}</td><td>{row.stats.bestStreak.toLocaleString()}</td></tr>)}</tbody></table></div>
    </div>

    <div className="panel-surface stats-table-wrap">
      <div className="stats-section-heading"><div><p className="eyebrow">Card-by-card</p><h3>Time, difficulty, and performance for every reviewed card</h3><p>Sorted by total active recall time. Forward and Reverse remain separate memory records.</p></div><Clock3 aria-hidden="true" /></div>
      {cardRows.length ? <><div className="stats-table-scroll"><table className="stats-table stats-card-table"><thead><tr><th>Card</th><th>Source</th><th>Mode</th><th>Intrinsic difficulty</th><th>Reviews</th><th>Accuracy</th><th>Total time</th><th>Avg. time</th><th>Last time</th><th>Wrong</th><th>Hard</th><th>Best streak</th><th>Last reviewed</th></tr></thead><tbody>{cardRows.slice(0, cardLimit).map((card) => <tr key={`${card.source.source}:${card.source.studyKey}:${card.card.id}`}><td className="stats-card-prompt">{card.prompt}</td><td>{card.source.source}</td><td>{card.source.mode}</td><td>{difficultyLabel(card.intrinsicDifficulty)}</td><td>{card.progress.reviews}</td><td>{percent(card.accuracy)}</td><td>{formatDuration(card.totalTimeMs)}</td><td>{formatResponseTime(card.averageTimeMs)}</td><td>{formatResponseTime(card.progress.lastResponseTimeMs)}</td><td>{card.progress.wrong}</td><td>{card.progress.hard}</td><td>{card.progress.bestStreak}</td><td>{dateTime(card.progress.lastReviewedAt)}</td></tr>)}</tbody></table></div>{cardRows.length > cardLimit && <button className="small-outline-button stats-load-more" type="button" onClick={() => setCardLimit((value) => value + 100)}>Show 100 more ({(cardRows.length - cardLimit).toLocaleString()} remaining)</button>}</> : <p className="stats-empty">No reviewed cards yet.</p>}
    </div>
  </section>;
}

function RankedCards({ title, subtitle, cards, metric, icon }: { title: string; subtitle: string; cards: CardPerformance[]; metric: (card: CardPerformance) => string; icon?: ReactNode }) {
  return <section className="panel-surface stats-ranked-panel"><div className="stats-ranked-heading"><div><h3>{title}</h3><p>{subtitle}</p></div>{icon}</div>{cards.length ? <ol>{cards.map((card) => <li key={`${card.source.source}:${card.source.studyKey}:${card.card.id}`}><div><strong>{card.prompt}</strong><span>{card.source.source} · {card.source.mode} · difficulty {difficultyLabel(card.intrinsicDifficulty)}</span></div><em>{metric(card)}</em></li>)}</ol> : <p className="stats-empty">More review history is needed for this analysis.</p>}</section>;
}
function Stat({ label, value }: { label: string; value: string }) { return <div className="stats-overview-card"><span>{label}</span><strong>{value}</strong></div>; }
