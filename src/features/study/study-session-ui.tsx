import { Gauge, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";
import { directionalCopy, formatResponseTime, priorityReason, studyStats } from "./engine";
import type { CardProgress, DeckDefinition, DirectionalCardCopy, ReviewDifficulty, ReviewResult, StudyCard, StudyDirection } from "./types";

type Stats = ReturnType<typeof studyStats>;
type Priority = Array<{ card: StudyCard; progress: CardProgress; score: number }>;

function percent(value: number | null) { return value === null ? "—" : `${(value * 100).toFixed(value >= 0.995 ? 0 : 1)}%`; }

export function StudyStartGate({ onStart }: { onStart: () => void }) {
  return <div className="study-start-gate" role="dialog" aria-modal="true" aria-label="Start flashcard timing">
    <div className="study-start-card">
      <p className="eyebrow">Timer paused</p>
      <h2>Ready?</h2>
      <p>The flashcard timer will begin only when you start.</p>
      <button type="button" className="primary-button study-start-button" onClick={onStart}>Start</button>
      <span>or press any key to begin</span>
    </div>
  </div>;
}

export function StudyRatingControls({ revealed, result, difficulty, editing, onReveal, onResult, onDifficulty, onSave }: {
  revealed: boolean;
  result: ReviewResult | null;
  difficulty: ReviewDifficulty | null;
  editing: boolean;
  onReveal: () => void;
  onResult: (value: ReviewResult) => void;
  onDifficulty: (value: ReviewDifficulty) => void;
  onSave: () => void;
}) {
  return <div className="study-controls">
    {!revealed ? <button className="primary-button study-primary" type="button" onClick={onReveal}>Reveal Answer <kbd>Space</kbd></button> : <>
      <div className="rating-grid">
        <fieldset className="rating-box"><legend>Did you get it right?</legend><div className="choice-row two-choices"><button type="button" className="rating-choice right-choice" aria-pressed={result === "right"} onClick={() => onResult("right")}>Right <kbd>1</kbd></button><button type="button" className="rating-choice wrong-choice" aria-pressed={result === "wrong"} onClick={() => onResult("wrong")}>Wrong <kbd>2</kbd></button></div></fieldset>
        <fieldset className="rating-box"><legend>How difficult was it?</legend><div className="choice-row three-choices">{(["easy", "medium", "hard"] as ReviewDifficulty[]).map((value, index) => <button key={value} type="button" className="rating-choice" aria-pressed={difficulty === value} onClick={() => onDifficulty(value)}>{value[0].toUpperCase() + value.slice(1)} <kbd>{index + 3}</kbd></button>)}</div></fieldset>
      </div>
      <button className="primary-button study-primary" type="button" disabled={!result || !difficulty} onClick={onSave}>{editing ? "Save Corrected Grade" : "Save & Next"} <kbd>Enter</kbd></button>
    </>}
  </div>;
}

export function StudySidebar({ deck, cards, copy, direction, stats, priority, priorityPrompt, cardCopy }: {
  deck: DeckDefinition;
  cards: StudyCard[];
  copy: DirectionalCardCopy;
  direction: StudyDirection;
  stats: Stats;
  priority: Priority;
  priorityPrompt?: (card: StudyCard, copy: DirectionalCardCopy) => ReactNode;
  cardCopy?: (card: StudyCard, direction: StudyDirection) => DirectionalCardCopy;
}) {
  const progressPercent = stats.available ? stats.mastered / stats.available * 100 : 0;
  return <aside className="study-sidebar">
    <section className="panel-surface stats-panel">
      <div className="sidebar-heading"><div><p className="eyebrow">{deck.eyebrow}</p><h2>Progress · {copy.sideLabel}</h2></div><Gauge /></div>
      <div className="stats-grid"><div className="stat-tile"><span>Available</span><strong>{stats.available}</strong></div><div className="stat-tile"><span>Reviewed</span><strong>{stats.reviewed}</strong></div><div className="stat-tile"><span>Accuracy</span><strong>{percent(stats.accuracy)}</strong></div><div className="stat-tile"><span>Ever wrong</span><strong>{stats.everWrong}</strong></div><div className="stat-tile"><span>Marked hard</span><strong>{stats.markedHard}</strong></div><div className="stat-tile"><span>Avg. time</span><strong>{formatResponseTime(stats.averageResponseTimeMs)}</strong></div><div className="stat-tile"><span>Mastered once</span><strong>{stats.mastered}</strong></div><div className="stat-tile"><span>Best streak</span><strong>{stats.bestStreak}</strong></div></div>
      <div className="progress-block"><div className="progress-label"><span>{deck.staged && stats.available < deck.cards.length ? "Current unlocked group" : "Initial mastery"}</span><strong>{Math.round(progressPercent)}%</strong></div><div className="progress-track" role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progressPercent}%` }} /></div></div>
    </section>
    <section className="panel-surface priority-panel">
      <div className="sidebar-heading"><div><p className="eyebrow">Prompts only</p><h2>Highest-Priority Review</h2></div><RotateCcw /></div>
      <div className="priority-list">{priority.map(({ card, progress, score }) => { const itemCopy = cardCopy ? cardCopy(card, direction) : directionalCopy(card, direction); return <div className="priority-row" key={`${card.deckId}:${card.id}`}><span className="priority-meta">{card.rank ? `#${card.rank}` : card.category ?? "Card"}</span><span className="priority-prompt">{priorityPrompt ? priorityPrompt(card, itemCopy) : itemCopy.prompt}<small>{priorityReason(progress)}</small></span><span className="priority-score">{Math.max(0, Math.round(score))}</span></div>; })}</div>
      <p className="source-note">Answers remain hidden. Correctness, difficulty, recall time, recency, strength, and due dates all affect priority.</p>
    </section>
  </aside>;
}
