import { BarChart3, Clock3, Cloud, Laptop } from "lucide-react";
import { Link } from "react-router-dom";
import { loadGreekDeck, loadGreekLesson3GrammarDeck, loadGreekLesson3VocabularyDeck, loadLatinDeck } from "../data/builtin-decks";
import { useAuth } from "../features/auth/auth-context";
import { createModeState, formatResponseTime, studyStats } from "../features/study/engine";
import { loadHenle } from "../features/henle/henle-data";
import { loadProgressEnvelope } from "../features/study/progress-repository";
import type { DeckDefinition, DeckProgressEnvelope, StudyCard, StudyModeState } from "../features/study/types";
import { useAsync } from "../hooks/use-async";
import "./stats-page.css";

type Language = "Greek" | "Latin";
type StatsSource = {
  language: Language;
  source: string;
  mode: string;
  deck: DeckDefinition;
  cards: StudyCard[];
  studyKey: string;
};

type SourceSummary = ReturnType<typeof summarizeSource>;
type RecentReview = {
  language: Language;
  source: string;
  mode: string;
  reviewedAt: number;
  result: "right" | "wrong";
  difficulty: "easy" | "medium" | "hard";
  responseTimeMs: number;
};

function percent(value: number | null) {
  return value === null ? "—" : `${(value * 100).toFixed(value >= 0.995 ? 0 : 1)}%`;
}

function stateFor(source: StatsSource, envelopes: Record<string, DeckProgressEnvelope | null>) {
  return envelopes[source.deck.id]?.modes[source.studyKey]
    ?? createModeState(source.deck.id, source.studyKey, source.deck.cards.length, source.deck.staged);
}

function summarizeSource(source: StatsSource, state: StudyModeState) {
  const stats = studyStats(source.cards, state);
  let easy = 0, medium = 0, hard = 0, responseCount = 0, lastReviewedAt = 0;
  for (const card of source.cards) {
    const progress = state.cards[card.id];
    if (!progress) continue;
    easy += progress.easy;
    medium += progress.medium;
    hard += progress.hard;
    responseCount += progress.responseTimeCount;
    lastReviewedAt = Math.max(lastReviewedAt, progress.lastReviewedAt);
  }
  return { source, state, stats, easy, medium, hard, responseCount, lastReviewedAt };
}

function aggregateLanguage(rows: SourceSummary[]) {
  let totalReviews = 0, rightReviews = 0, reviewed = 0, mastered = 0, everWrong = 0, hardCards = 0, responseTotal = 0, responseCount = 0, bestStreak = 0, lastReviewedAt = 0;
  for (const row of rows) {
    totalReviews += row.state.totalReviews;
    rightReviews += row.state.rightReviews;
    reviewed += row.stats.reviewed;
    mastered += row.stats.mastered;
    everWrong += row.stats.everWrong;
    hardCards += row.stats.markedHard;
    bestStreak = Math.max(bestStreak, row.stats.bestStreak);
    lastReviewedAt = Math.max(lastReviewedAt, row.lastReviewedAt);
    for (const card of row.source.cards) {
      const progress = row.state.cards[card.id];
      if (!progress) continue;
      responseTotal += progress.responseTimeTotalMs;
      responseCount += progress.responseTimeCount;
    }
  }
  return {
    totalReviews,
    accuracy: totalReviews ? rightReviews / totalReviews : null,
    reviewed,
    mastered,
    everWrong,
    hardCards,
    averageResponseTimeMs: responseCount ? responseTotal / responseCount : 0,
    bestStreak,
    lastReviewedAt,
  };
}

function dateTime(value: number) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(value) : "No reviews yet";
}

export function StatsPage() {
  const { user } = useAuth();
  const { value, error, loading } = useAsync(async () => {
    const [greekFoundation, greekVocabulary, greekGrammar, latinVocabulary, henle] = await Promise.all([
      loadGreekDeck(),
      loadGreekLesson3VocabularyDeck(),
      loadGreekLesson3GrammarDeck(),
      loadLatinDeck(),
      loadHenle(),
    ]);

    const sources: StatsSource[] = [
      { language: "Greek", source: "Lessons 1–2", mode: "Forward", deck: greekFoundation, cards: greekFoundation.cards, studyKey: "forward" },
      { language: "Greek", source: "Lessons 1–2", mode: "Reverse", deck: greekFoundation, cards: greekFoundation.cards, studyKey: "reverse" },
      { language: "Greek", source: "Lesson 3 Vocabulary", mode: "Forward", deck: greekVocabulary, cards: greekVocabulary.cards, studyKey: "forward" },
      { language: "Greek", source: "Lesson 3 Vocabulary", mode: "Reverse", deck: greekVocabulary, cards: greekVocabulary.cards, studyKey: "reverse" },
      { language: "Greek", source: "Lesson 3 Grammar", mode: "Forward", deck: greekGrammar, cards: greekGrammar.cards, studyKey: "forward" },
      { language: "Greek", source: "Lesson 3 Grammar", mode: "Reverse", deck: greekGrammar, cards: greekGrammar.cards, studyKey: "reverse" },
      { language: "Latin", source: "Dickinson Vocabulary", mode: "Forward", deck: latinVocabulary, cards: latinVocabulary.cards, studyKey: "forward" },
      { language: "Latin", source: "Dickinson Vocabulary", mode: "Reverse", deck: latinVocabulary, cards: latinVocabulary.cards, studyKey: "reverse" },
      { language: "Latin", source: "Henle Grammar Forms", mode: "Forward", deck: henle.individualDeck, cards: henle.individualDeck.cards, studyKey: "individual:forward" },
      { language: "Latin", source: "Henle Grammar Forms", mode: "Reverse", deck: henle.individualDeck, cards: henle.individualDeck.cards, studyKey: "individual:reverse" },
      { language: "Latin", source: "Henle Whole Charts", mode: "Charts", deck: henle.chartDeck, cards: henle.chartDeck.cards, studyKey: "chart" },
    ];

    const uniqueDeckIds = [...new Set(sources.map((source) => source.deck.id))];
    const loaded = await Promise.all(uniqueDeckIds.map(async (deckId) => [deckId, await loadProgressEnvelope(deckId, user)] as const));
    const envelopes = Object.fromEntries(loaded.map(([deckId, result]) => [deckId, result.envelope])) as Record<string, DeckProgressEnvelope | null>;
    const summaries = sources.map((source) => summarizeSource(source, stateFor(source, envelopes)));

    const recent: RecentReview[] = [];
    for (const row of summaries) {
      for (const card of row.source.cards) {
        const progress = row.state.cards[card.id];
        if (!progress) continue;
        for (const review of progress.history) recent.push({ language: row.source.language, source: row.source.source, mode: row.source.mode, reviewedAt: review.reviewedAt, result: review.result, difficulty: review.difficulty, responseTimeMs: review.responseTimeMs });
      }
    }
    recent.sort((a, b) => b.reviewedAt - a.reviewedAt);
    return { summaries, recent: recent.slice(0, 20) };
  }, [user?.id]);

  if (loading || !value) return <main className="page-shell"><div className="study-loading panel-surface" role="status"><span className="loading-mark">Σ</span><p>Loading your study history…</p></div></main>;

  const greekRows = value.summaries.filter((row) => row.source.language === "Greek");
  const latinRows = value.summaries.filter((row) => row.source.language === "Latin");

  return <main className="page-shell stats-page">
    <header className="stats-hero">
      <div><p className="eyebrow">Continuous memory bank</p><h1>Study Stats</h1><p>Your complete Greek and Latin history is analyzed here whether or not a source is currently selected in a flashcard session.</p></div>
      <div className="stats-sync-note">{user ? <Cloud aria-hidden="true" /> : <Laptop aria-hidden="true" />}<span>{user ? "Showing your synced account progress" : "Showing guest progress saved on this device"}</span></div>
    </header>
    {error && <div className="inline-alert">{error}</div>}

    <LanguageStats language="Greek" rows={greekRows} href="/greek" />
    <LanguageStats language="Latin" rows={latinRows} href="/latin" />

    <section className="panel-surface stats-recent-section">
      <div className="stats-section-heading"><div><p className="eyebrow">Latest activity</p><h2>Recent reviews</h2></div><Clock3 aria-hidden="true" /></div>
      {value.recent.length ? <div className="stats-recent-list">{value.recent.map((review, index) => <div className="stats-recent-row" key={`${review.reviewedAt}:${review.source}:${index}`}>
        <div><strong>{review.language} · {review.source}</strong><span>{review.mode} · {dateTime(review.reviewedAt)}</span></div>
        <div className="stats-review-result"><span className={review.result === "right" ? "is-right" : "is-wrong"}>{review.result}</span><span>{review.difficulty}</span><span>{formatResponseTime(review.responseTimeMs)}</span></div>
      </div>)}</div> : <p className="stats-empty">No saved reviews yet.</p>}
    </section>
  </main>;
}

function LanguageStats({ language, rows, href }: { language: Language; rows: SourceSummary[]; href: string }) {
  const aggregate = aggregateLanguage(rows);
  return <section className="stats-language-section">
    <div className="stats-language-title"><div><p className="eyebrow">{language}</p><h2>{language} memory bank</h2></div><Link className="small-outline-button" to={href}>Open {language}</Link></div>
    <div className="stats-overview-grid">
      <Stat label="Total reviews" value={aggregate.totalReviews.toLocaleString()} />
      <Stat label="Accuracy" value={percent(aggregate.accuracy)} />
      <Stat label="Reviewed card-directions" value={aggregate.reviewed.toLocaleString()} />
      <Stat label="Mastered once" value={aggregate.mastered.toLocaleString()} />
      <Stat label="Ever wrong" value={aggregate.everWrong.toLocaleString()} />
      <Stat label="Marked hard" value={aggregate.hardCards.toLocaleString()} />
      <Stat label="Avg. recall time" value={formatResponseTime(aggregate.averageResponseTimeMs)} />
      <Stat label="Best streak" value={aggregate.bestStreak.toLocaleString()} />
      <Stat label="Last review" value={dateTime(aggregate.lastReviewedAt)} />
    </div>
    <div className="panel-surface stats-table-wrap">
      <div className="stats-section-heading"><div><p className="eyebrow">Source analysis</p><h3>Progress by deck and direction</h3></div><BarChart3 aria-hidden="true" /></div>
      <div className="stats-table-scroll"><table className="stats-table">
        <thead><tr><th>Source</th><th>Mode</th><th>Available</th><th>Reviewed</th><th>Reviews</th><th>Accuracy</th><th>Mastered</th><th>Wrong</th><th>Hard</th><th>Easy / Medium / Hard</th><th>Avg. time</th><th>Best streak</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={`${row.source.source}:${row.source.studyKey}`}><td>{row.source.source}</td><td>{row.source.mode}</td><td>{row.stats.available.toLocaleString()} / {row.source.cards.length.toLocaleString()}</td><td>{row.stats.reviewed.toLocaleString()}</td><td>{row.stats.totalReviews.toLocaleString()}</td><td>{percent(row.stats.accuracy)}</td><td>{row.stats.mastered.toLocaleString()}</td><td>{row.stats.everWrong.toLocaleString()}</td><td>{row.stats.markedHard.toLocaleString()}</td><td>{row.easy.toLocaleString()} / {row.medium.toLocaleString()} / {row.hard.toLocaleString()}</td><td>{formatResponseTime(row.stats.averageResponseTimeMs)}</td><td>{row.stats.bestStreak.toLocaleString()}</td></tr>)}</tbody>
      </table></div>
    </div>
  </section>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="stats-overview-card"><span>{label}</span><strong>{value}</strong></div>;
}
