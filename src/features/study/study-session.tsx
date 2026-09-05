import { ArrowLeft, Cloud, Laptop, SkipForward, Timer } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/auth-context";
import { createEnvelope, createModeState, directionalCopy, ensureCurrentCard, formatResponseTime, highestPriorityCards, pickNextCard, presentCard, reviewAndAdvance, skipAndAdvance, studyStats } from "./engine";
import { deleteReviewEvent, loadProgressEnvelope, saveProgressEnvelope, upsertReviewEvent } from "./progress-repository";
import "./study-gate.css";
import { StudyRatingControls, StudySidebar, StudyStartGate } from "./study-session-ui";
import { studyShortcut } from "./study-shortcuts";
import type { DeckDefinition, DeckProgressEnvelope, DirectionalCardCopy, ReviewDifficulty, ReviewResult, ReviewTransaction, SelectionMode, StudyCard, StudyDirection, StudyModeState } from "./types";
import { useResponseTimer } from "./use-response-timer";

type Props = { deck: DeckDefinition; cards?: StudyCard[]; studyKey: string; direction: StudyDirection; onDirectionChange?: (direction: StudyDirection) => void; directionLabels?: { forward: string; reverse: string }; toolbarExtra?: ReactNode; cardMeta?: (card: StudyCard) => string; renderFront?: (card: StudyCard, copy: DirectionalCardCopy) => ReactNode; renderBack?: (card: StudyCard, copy: DirectionalCardCopy) => ReactNode; priorityPrompt?: (card: StudyCard, copy: DirectionalCardCopy) => ReactNode };
type SyncStatus = "loading" | "local" | "syncing" | "cloud" | "error";

export function StudySession({ deck, cards = deck.cards, studyKey, direction, onDirectionChange, directionLabels = { forward: "Forward", reverse: "Reverse" }, toolbarExtra, cardMeta, renderFront, renderBack, priorityPrompt }: Props) {
  const { user } = useAuth();
  const [envelope, setEnvelope] = useState<DeckProgressEnvelope | null>(null);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("adaptive");
  const [revealed, setRevealed] = useState(false), [reviewFront, setReviewFront] = useState(false), [result, setResult] = useState<ReviewResult | null>(null), [difficulty, setDifficulty] = useState<ReviewDifficulty | null>(null);
  const [capturedTimeMs, setCapturedTimeMs] = useState<number | null>(null), [lastTransaction, setLastTransaction] = useState<ReviewTransaction | null>(null), [editingTransaction, setEditingTransaction] = useState<ReviewTransaction | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("loading"), [notice, setNotice] = useState<string | null>(null);
  const [backtracking, setBacktracking] = useState(false);
  const [startGateOpen, setStartGateOpen] = useState(true);
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
    if (lastStudyKey.current !== studyKey) { lastStudyKey.current = studyKey; setLastTransaction(null); setEditingTransaction(null); setRevealed(false); setReviewFront(false); setResult(null); setDifficulty(null); setCapturedTimeMs(null); setStartGateOpen(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studyKey, cardSignature]);

  const modeState = envelope?.modes[studyKey] ?? null, current = modeState ? cards.find((card) => card.id === modeState.currentCardId) ?? null : null;
  const timer = useResponseTimer(current && modeState ? `${studyKey}:${current.id}:${modeState.cards[current.id]?.lastPresentedAt ?? 0}` : null, Boolean(current && modeState && !revealed && !editingTransaction && !startGateOpen));
  const stats = useMemo(() => modeState ? studyStats(cards, modeState) : null, [cards, modeState]);
  const priority = useMemo(() => modeState ? highestPriorityCards(cards, modeState, deck.staged, 5) : [], [cards, deck.staged, modeState]);
  const copy = current ? directionalCopy(current, direction) : null;

  function resetUi() { setRevealed(false); setReviewFront(false); setBacktracking(false); setResult(null); setDifficulty(null); setCapturedTimeMs(null); setEditingTransaction(null); }
  function reveal() { if (!current || revealed || editingTransaction || startGateOpen) return; setBacktracking(false); setReviewFront(false); setCapturedTimeMs(timer.capture()); setRevealed(true); }
  function toggleReviewFace() { if (revealed) setReviewFront((value) => !value); }
  function changeOrder(next: SelectionMode) { setSelectionMode(next); if (!modeState || !current) return; const selected = pickNextCard(cards, modeState, next, { excludeCardId: current.id, staged: deck.staged }); if (selected) { resetUi(); void saveMode(presentCard(modeState, selected)); } }
  function skip() { if (!modeState || editingTransaction) return; resetUi(); void saveMode(skipAndAdvance(modeState, cards, selectionMode, deck.staged)); }
  function back() { if (!lastTransaction || !modeState) return; const transaction = lastTransaction; setLastTransaction(null); setEditingTransaction(transaction); setResult(transaction.result); setDifficulty(transaction.difficulty); setCapturedTimeMs(transaction.responseTimeMs); setBacktracking(true); setRevealed(false); setReviewFront(false); void saveMode(transaction.beforeState, { deleteReviewId: transaction.reviewId }); requestAnimationFrame(() => requestAnimationFrame(() => setRevealed(true))); setNotice("Previous grade undone. Choose the corrected result and save it."); }
  function saveNext() {
    if (!modeState || !current || !result || !difficulty) return; const reviewedAt = Date.now(), reviewId = editingTransaction?.reviewId, source = editingTransaction?.beforeState ?? modeState;
    const applied = reviewAndAdvance(source, cards, selectionMode, { id: reviewId, result, difficulty, responseTimeMs: capturedTimeMs ?? timer.capture(), reviewedAt }, deck.staged);
    const corrected = Boolean(editingTransaction); setLastTransaction(applied.transaction); resetUi(); void saveMode(applied.state, { review: applied.transaction });
    setNotice(applied.state.lastUnlock?.at === reviewedAt ? `New cards unlocked: ${applied.state.lastUnlock.start}–${applied.state.lastUnlock.end}.` : corrected ? "Previous grade corrected." : "Progress saved.");
  }

  useEffect(() => {
    function requireRestart() { if (!revealed && !editingTransaction) setStartGateOpen(true); }
    function visibility() { if (document.visibilityState === "hidden") requireRestart(); }
    window.addEventListener("blur", requireRestart); document.addEventListener("visibilitychange", visibility);
    return () => { window.removeEventListener("blur", requireRestart); document.removeEventListener("visibilitychange", visibility); };
  }, [editingTransaction, revealed]);

  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const shortcut = studyShortcut({ key: event.key, startGateOpen, revealed, result, difficulty, typingTarget: Boolean(target?.closest("input, textarea, select, [contenteditable='true'], [role='textbox'], [role='listbox']")) });
      if (!shortcut) return;
      if (shortcut.type === "start") { event.preventDefault(); setStartGateOpen(false); return; }
      if (shortcut.type === "reveal") { event.preventDefault(); reveal(); return; }
      if (shortcut.type === "flip") { event.preventDefault(); toggleReviewFace(); return; }
      if (shortcut.type === "result") { setResult(shortcut.value); return; }
      if (shortcut.type === "difficulty") { setDifficulty(shortcut.value); return; }
      event.preventDefault(); saveNext();
    }
    window.addEventListener("keydown", keydown); return () => window.removeEventListener("keydown", keydown);
  });

  if (!modeState || !current || !copy || !stats) return <div className="study-loading panel-surface" role="status"><span className="loading-mark">{deck.language === "greek" ? "α" : "A"}</span><p>{cards.length ? "Preparing this study mode…" : "No cards match these filters."}</p></div>;
  const currentMeta = cardMeta?.(current);
  const showingAnswer = revealed && !reviewFront;

  return <div className="study-grid" data-testid="study-session" data-study-key={studyKey}>
    <section className="study-panel panel-surface" aria-label={`${deck.title} study card`}>
      {startGateOpen && !revealed && !editingTransaction && <StudyStartGate onStart={() => setStartGateOpen(false)} />}
      <div className="study-toolbar session-toolbar">
        <div className="toolbar-control-group">
          {deck.supportsReverse && onDirectionChange && <div className="segmented-control" aria-label="Study direction">{(["forward", "reverse"] as StudyDirection[]).map((value) => <button key={value} type="button" aria-pressed={direction === value} onClick={() => onDirectionChange(value)}>{directionLabels[value]}</button>)}</div>}
          <label className="compact-select-label"><span className="sr-only">Card order</span><select value={selectionMode} onChange={(event) => changeOrder(event.target.value as SelectionMode)}><option value="adaptive">Adaptive review</option><option value="sequential">Sequential</option></select></label>
          <button type="button" className="small-outline-button" onClick={() => setStartGateOpen(true)} disabled={revealed || editingTransaction || startGateOpen}>Pause timer</button>
          <Link className="small-outline-button" to="/stats">Stats</Link>
          {toolbarExtra}
        </div>
        <div className={`storage-status ${syncStatus === "error" ? "storage-error" : ""}`}>{user ? <Cloud aria-hidden="true" /> : <Laptop aria-hidden="true" />}<span>{syncStatus === "loading" ? "Loading progress" : syncStatus === "syncing" ? "Syncing…" : syncStatus === "error" ? "Saved locally; cloud sync needs attention" : user ? "Cloud progress synced" : "Guest progress on this device"}</span></div>
      </div>
      {notice && <button className="inline-notice" type="button" onClick={() => setNotice(null)}>{notice}</button>}
      <div className="flashcard-meta"><div className="card-meta-details"><span className="stage-chip">{copy.sideLabel}</span>{current.category && <span>{current.category}</span>}{currentMeta && <span>{currentMeta}</span>}<span className="front-timer" aria-label={`Front-card response time ${formatResponseTime(capturedTimeMs ?? timer.elapsedMs)}`}><Timer aria-hidden="true" /> {formatResponseTime(capturedTimeMs ?? timer.elapsedMs)}</span>{editingTransaction && <span className="editing-chip">Correcting previous grade</span>}</div><div className="card-nav-actions"><button type="button" className="small-outline-button" disabled={!lastTransaction} onClick={back}><ArrowLeft /> Back</button><button type="button" className="small-outline-button" disabled={Boolean(editingTransaction)} onClick={skip}>Skip <SkipForward /></button></div></div>
      <div className={`flashcard-scene ${showingAnswer ? "is-flipped" : ""} ${backtracking ? "is-backtracking" : ""}`}>
        <div className="flashcard-inner">
          <button type="button" className="flashcard-face flashcard-front-face" onClick={() => revealed ? setReviewFront(false) : reveal()} aria-label={revealed ? "Return to answer" : "Reveal answer"} aria-hidden={showingAnswer} tabIndex={showingAnswer ? -1 : 0}><span className="card-side">Question</span>{renderFront ? renderFront(current, copy) : <span className={`study-prompt ${deck.language === "greek" ? "greek-script" : ""}`}>{copy.prompt}</span>}</button>
          <div className="flashcard-face flashcard-back-face" aria-hidden={!showingAnswer}><span className="card-side">Answer</span>{renderBack ? renderBack(current, copy) : <span className="answer-block"><strong className={deck.language === "greek" ? "greek-answer-title" : "study-answer"}>{copy.answer}</strong>{current.notes && <span className="answer-notes">{current.notes}</span>}</span>}</div>
        </div>
      </div>
      <StudyRatingControls revealed={revealed} result={result} difficulty={difficulty} editing={Boolean(editingTransaction)} onReveal={reveal} onFlip={toggleReviewFace} onResult={setResult} onDifficulty={setDifficulty} onSave={saveNext} />
    </section>
    <StudySidebar deck={deck} cards={cards} copy={copy} direction={direction} stats={stats} priority={priority} priorityPrompt={priorityPrompt} />
  </div>;
}
