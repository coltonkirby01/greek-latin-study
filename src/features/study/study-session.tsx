import { ArrowLeft, Cloud, Gauge, Laptop, RotateCcw, SkipForward, Timer } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/auth-context";
import { createEnvelope, createModeState, directionalCopy, ensureCurrentCard, formatResponseTime, highestPriorityCards, pickNextCard, presentCard, priorityReason, reviewAndAdvance, skipAndAdvance, studyStats } from "./engine";
import { deleteReviewEvent, loadProgressEnvelope, saveProgressEnvelope, upsertReviewEvent } from "./progress-repository";
import type { DeckDefinition, DeckProgressEnvelope, DirectionalCardCopy, ReviewDifficulty, ReviewResult, ReviewTransaction, SelectionMode, StudyCard, StudyDirection, StudyModeState } from "./types";
import { useResponseTimer } from "./use-response-timer";

type Props = { deck: DeckDefinition; cards?: StudyCard[]; studyKey: string; direction: StudyDirection; onDirectionChange?: (direction: StudyDirection) => void; directionLabels?: { forward: string; reverse: string }; toolbarExtra?: ReactNode; cardMeta?: (card: StudyCard) => string; renderFront?: (card: StudyCard, copy: DirectionalCardCopy) => ReactNode; renderBack?: (card: StudyCard, copy: DirectionalCardCopy) => ReactNode; priorityPrompt?: (card: StudyCard, copy: DirectionalCardCopy) => ReactNode };
type SyncStatus = "loading" | "local" | "syncing" | "cloud" | "error";
function percent(value: number | null) { return value === null ? "—" : `${(value * 100).toFixed(value >= 0.995 ? 0 : 1)}%`; }

export function StudySession({ deck, cards = deck.cards, studyKey, direction, onDirectionChange, directionLabels = { forward: "Forward", reverse: "Reverse" }, toolbarExtra, cardMeta, renderFront, renderBack, priorityPrompt }: Props) {
  const { user } = useAuth();
  const [envelope, setEnvelope] = useState<DeckProgressEnvelope | null>(null);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("adaptive");
  const [revealed, setRevealed] = useState(false), [result, setResult] = useState<ReviewResult | null>(null), [difficulty, setDifficulty] = useState<ReviewDifficulty | null>(null);
  const [capturedTimeMs, setCapturedTimeMs] = useState<number | null>(null), [lastTransaction, setLastTransaction] = useState<ReviewTransaction | null>(null), [editingTransaction, setEditingTransaction] = useState<ReviewTransaction | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("loading"), [notice, setNotice] = useState<string | null>(null);
  const [backtracking, setBacktracking] = useState(false);
  const lastStudyKey = useRef(studyKey);

  const saveMode = useCallback(async (nextMode: StudyModeState, options?: { review?: ReviewTransaction; deleteReviewId?: string }) => {
    if (!envelope) return; const nextEnvelope: DeckProgressEnvelope = { ...envelope, updatedAt: Math.max(Date.now(), nextMode.updatedAt), modes: { ...envelope.modes, [studyKey]: nextMode } };
    setEnvelope(nextEnvelope); setSyncStatus(user ? "syncing" : "local");
    try { await saveProgressEnvelope(nextEnvelope, user); if (options?.deleteReviewId) await deleteReviewEvent(user, options.deleteReviewId); if (options?.review) { const review = options.review; await upsertReviewEvent(user, { id: review.reviewId, deckId: deck.id, studyKey, cardId: review.cardId, result: review.result, difficulty: review.difficulty, responseTimeMs: review.responseTimeMs, reviewedAt: nextMode.cards[review.cardId]?.history.at(-1)?.reviewedAt ?? Date.now() }); } setSyncStatus(user ? "cloud" : "local"); } catch { setSyncStatus("error"); }
  }, [deck.id, envelope, studyKey, user]);

  useEffect(() => {
    let active = true; setSyncStatus("loading");
    void loadProgressEnvelope(deck.id, user).then((loaded) => { if (!active) return; let next = loaded.envelope ?? createEnvelope(deck.id); const existing = next.modes[studyKey] ?? createModeState(deck.id, studyKey, deck.cards.length, deck.staged); const ready = ensureCurrentCard(existing, cards, selectionMode, deck.staged); next = { ...next, updatedAt: Math.max(next.updatedAt, ready.updatedAt), modes: { ...next.modes, [studyKey]: ready } }; setEnvelope(next); setSyncStatus(loaded.syncError ? "error" : user ? "cloud" : "local"); void saveProgressEnvelope(next, user).catch(() => setSyncStatus("error")); });
    return () => { active = false; }; // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck.id, user?.id]);

  const cardSignature = cards.map((card) => card.id).join("|");
  useEffect(() => {
    if (!envelope) return; const existing = envelope.modes[studyKey] ?? createModeState(deck.id, studyKey, deck.cards.length, deck.staged); let ready = existing;
    if (!cards.some((card) => card.id === existing.currentCardId)) { const selected = pickNextCard(cards, existing, selectionMode, { staged: deck.staged }); if (selected) ready = presentCard(existing, selected); }
    if (ready !== existing || !envelope.modes[studyKey]) void saveMode(ready);
    if (lastStudyKey.current !== studyKey) { lastStudyKey.current = studyKey; setLastTransaction(null); setEditingTransaction(null); setRevealed(false); setResult(null); setDifficulty(null); setCapturedTimeMs(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studyKey, cardSignature]);

  const modeState = envelope?.modes[studyKey] ?? null, current = modeState ? cards.find((card) => card.id === modeState.currentCardId) ?? null : null;
  const timer = useResponseTimer(current && modeState ? `${studyKey}:${current.id}:${modeState.cards[current.id]?.lastPresentedAt ?? 0}` : null, Boolean(current && modeState && !revealed && !editingTransaction));
  const stats = useMemo(() => modeState ? studyStats(cards, modeState) : null, [cards, modeState]);
  const priority = useMemo(() => modeState ? highestPriorityCards(cards, modeState, deck.staged, 5) : [], [cards, deck.staged, modeState]);
  const copy = current ? directionalCopy(current, direction) : null;

  function resetUi() { setRevealed(false); setBacktracking(false); setResult(null); setDifficulty(null); setCapturedTimeMs(null); setEditingTransaction(null); }
  function reveal() { if (!current || revealed || editingTransaction) return; setBacktracking(false); setCapturedTimeMs(timer.capture()); setRevealed(true); }
  function changeOrder(next: SelectionMode) { setSelectionMode(next); if (!modeState || !current) return; const selected = pickNextCard(cards, modeState, next, { excludeCardId: current.id, staged: deck.staged }); if (selected) { resetUi(); void saveMode(presentCard(modeState, selected)); } }
  function skip() { if (!modeState || editingTransaction) return; resetUi(); void saveMode(skipAndAdvance(modeState, cards, selectionMode, deck.staged)); }
  function back() { if (!lastTransaction || !modeState) return; const transaction = lastTransaction; setLastTransaction(null); setEditingTransaction(transaction); setResult(transaction.result); setDifficulty(transaction.difficulty); setCapturedTimeMs(transaction.responseTimeMs); setBacktracking(true); setRevealed(false); void saveMode(transaction.beforeState, { deleteReviewId: transaction.reviewId }); requestAnimationFrame(() => requestAnimationFrame(() => setRevealed(true))); setNotice("Previous grade undone. Choose the corrected result and save it."); }
  function saveNext() {
    if (!modeState || !current || !result || !difficulty) return; const reviewedAt = Date.now(), reviewId = editingTransaction?.reviewId, source = editingTransaction?.beforeState ?? modeState;
    const applied = reviewAndAdvance(source, cards, selectionMode, { id: reviewId, result, difficulty, responseTimeMs: capturedTimeMs ?? timer.capture(), reviewedAt }, deck.staged);
    const corrected = Boolean(editingTransaction); setLastTransaction(applied.transaction); resetUi(); void saveMode(applied.state, { review: applied.transaction });
    setNotice(applied.state.lastUnlock?.at === reviewedAt ? `New cards unlocked: ${applied.state.lastUnlock.start}–${applied.state.lastUnlock.end}.` : corrected ? "Previous grade corrected." : "Progress saved.");
  }

  useEffect(() => {
    function keydown(event: KeyboardEvent) { const target = event.target as HTMLElement | null; if (target?.closest("input, textarea, select, [contenteditable='true'], [role='textbox'], [role='listbox']")) return; if (event.key === " " && !revealed) { event.preventDefault(); reveal(); return; } if (!revealed) return; if (event.key === "1") setResult("right"); else if (event.key === "2") setResult("wrong"); else if (event.key === "3") setDifficulty("easy"); else if (event.key === "4") setDifficulty("medium"); else if (event.key === "5") setDifficulty("hard"); else if (event.key === "Enter" && result && difficulty) { event.preventDefault(); saveNext(); } }
    window.addEventListener("keydown", keydown); return () => window.removeEventListener("keydown", keydown);
  });

  if (!modeState || !current || !copy || !stats) return <div className="study-loading panel-surface" role="status"><span className="loading-mark">{deck.language === "greek" ? "α" : "A"}</span><p>{cards.length ? "Preparing this study mode…" : "No cards match these filters."}</p></div>;
  const progressPercent = stats.available ? stats.mastered / stats.available * 100 : 0, currentMeta = cardMeta?.(current);

  return (
    <div className="study-grid" data-testid="study-session" data-study-key={studyKey}>
      <section className="study-panel panel-surface" aria-label={`${deck.title} study card`}>
        <div className="study-toolbar session-toolbar">
          <div className="toolbar-control-group">
            {deck.supportsReverse && onDirectionChange && <div className="segmented-control" aria-label="Study direction">{(["forward", "reverse"] as StudyDirection[]).map((value) => <button key={value} type="button" aria-pressed={direction === value} onClick={() => onDirectionChange(value)}>{directionLabels[value]}</button>)}</div>}
            <label className="compact-select-label"><span className="sr-only">Card order</span><select value={selectionMode} onChange={(event) => changeOrder(event.target.value as SelectionMode)}><option value="adaptive">Adaptive review</option><option value="sequential">Sequential</option></select></label>
            {toolbarExtra}
          </div>
          <div className={`storage-status ${syncStatus === "error" ? "storage-error" : ""}`}>{user ? <Cloud aria-hidden="true" /> : <Laptop aria-hidden="true" />}<span>{syncStatus === "loading" ? "Loading progress" : syncStatus === "syncing" ? "Syncing…" : syncStatus === "error" ? "Saved locally; cloud sync needs attention" : user ? "Cloud progress synced" : "Guest progress on this device"}</span></div>
        </div>
        {notice && <button className="inline-notice" type="button" onClick={() => setNotice(null)}>{notice}</button>}
        <div className="flashcard-meta"><div className="card-meta-details"><span className="stage-chip">{copy.sideLabel}</span>{current.category && <span>{current.category}</span>}{currentMeta && <span>{currentMeta}</span>}<span className="front-timer" aria-label={`Front-card response time ${formatResponseTime(capturedTimeMs ?? timer.elapsedMs)}`}><Timer aria-hidden="true" /> {formatResponseTime(capturedTimeMs ?? timer.elapsedMs)}</span>{editingTransaction && <span className="editing-chip">Correcting previous grade</span>}</div><div className="card-nav-actions"><button type="button" className="small-outline-button" disabled={!lastTransaction} onClick={back}><ArrowLeft /> Back</button><button type="button" className="small-outline-button" disabled={Boolean(editingTransaction)} onClick={skip}>Skip <SkipForward /></button></div></div>
        <div className={`flashcard-scene ${revealed ? "is-flipped" : ""} ${backtracking ? "is-backtracking" : ""}`}>
          <div className="flashcard-inner">
            <button type="button" className="flashcard-face flashcard-front-face" onClick={reveal} aria-label="Reveal answer" aria-hidden={revealed} tabIndex={revealed ? -1 : 0}><span className="card-side">Question</span>{renderFront ? renderFront(current, copy) : <span className={`study-prompt ${deck.language === "greek" ? "greek-script" : ""}`}>{copy.prompt}</span>}</button>
            <div className="flashcard-face flashcard-back-face" aria-hidden={!revealed}><span className="card-side">Answer</span>{renderBack ? renderBack(current, copy) : <span className="answer-block"><strong className={deck.language === "greek" ? "greek-answer-title" : "study-answer"}>{copy.answer}</strong>{current.notes && <span className="answer-notes">{current.notes}</span>}</span>}</div>
          </div>
        </div>
        <div className="study-controls">
          {!revealed ? <button className="primary-button study-primary" type="button" onClick={reveal}>Reveal Answer <kbd>Space</kbd></button> : <>
            <div className="rating-grid">
              <fieldset className="rating-box"><legend>Did you get it right?</legend><div className="choice-row two-choices"><button type="button" className="rating-choice right-choice" aria-pressed={result === "right"} onClick={() => setResult("right")}>Right <kbd>1</kbd></button><button type="button" className="rating-choice wrong-choice" aria-pressed={result === "wrong"} onClick={() => setResult("wrong")}>Wrong <kbd>2</kbd></button></div></fieldset>
              <fieldset className="rating-box"><legend>How difficult was it?</legend><div className="choice-row three-choices">{(["easy", "medium", "hard"] as ReviewDifficulty[]).map((value, index) => <button key={value} type="button" className="rating-choice" aria-pressed={difficulty === value} onClick={() => setDifficulty(value)}>{value[0].toUpperCase() + value.slice(1)} <kbd>{index + 3}</kbd></button>)}</div></fieldset>
            </div>
            <button className="primary-button study-primary" type="button" disabled={!result || !difficulty} onClick={saveNext}>{editingTransaction ? "Save Corrected Grade" : "Save & Next"} <kbd>Enter</kbd></button>
          </>}
        </div>
      </section>
      <aside className="study-sidebar">
        <section className="panel-surface stats-panel"><div className="sidebar-heading"><div><p className="eyebrow">{deck.eyebrow}</p><h2>Progress · {copy.sideLabel}</h2></div><Gauge /></div>
          <div className="stats-grid"><div className="stat-tile"><span>Available</span><strong>{stats.available}</strong></div><div className="stat-tile"><span>Reviewed</span><strong>{stats.reviewed}</strong></div><div className="stat-tile"><span>Accuracy</span><strong>{percent(stats.accuracy)}</strong></div><div className="stat-tile"><span>Ever wrong</span><strong>{stats.everWrong}</strong></div><div className="stat-tile"><span>Marked hard</span><strong>{stats.markedHard}</strong></div><div className="stat-tile"><span>Avg. time</span><strong>{formatResponseTime(stats.averageResponseTimeMs)}</strong></div><div className="stat-tile"><span>Mastered once</span><strong>{stats.mastered}</strong></div><div className="stat-tile"><span>Best streak</span><strong>{stats.bestStreak}</strong></div></div>
          <div className="progress-block"><div className="progress-label"><span>{deck.staged && stats.available < deck.cards.length ? "Current unlocked group" : "Initial mastery"}</span><strong>{Math.round(progressPercent)}%</strong></div><div className="progress-track" role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progressPercent}%` }} /></div></div>
        </section>
        <section className="panel-surface priority-panel"><div className="sidebar-heading"><div><p className="eyebrow">Prompts only</p><h2>Highest-Priority Review</h2></div><RotateCcw /></div><div className="priority-list">{priority.map(({ card, progress, score }) => { const itemCopy = directionalCopy(card, direction); return <div className="priority-row" key={card.id}><span className="priority-meta">{card.rank ? `#${card.rank}` : card.category ?? "Card"}</span><span className="priority-prompt">{priorityPrompt ? priorityPrompt(card, itemCopy) : itemCopy.prompt}<small>{priorityReason(progress)}</small></span><span className="priority-score">{Math.max(0, Math.round(score))}</span></div>; })}</div><p className="source-note">Answers remain hidden. Correctness, difficulty, recall time, recency, strength, and due dates all affect priority.</p></section>
      </aside>
    </div>
  );
}
