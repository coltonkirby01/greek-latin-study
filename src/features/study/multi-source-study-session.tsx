import { ArrowLeft, Cloud, Laptop, SkipForward, Timer } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/auth-context";
import { createEnvelope, createModeState, directionalCopy, formatResponseTime, getCardProgress, maybeUnlockNextBatch, presentCard, priorityScore, recordReview } from "./engine";
import { deleteReviewEvent, loadProgressEnvelope, saveProgressEnvelope, upsertReviewEvent } from "./progress-repository";
import "./study-gate.css";
import { StudyRatingControls, StudySidebar, StudyStartGate } from "./study-session-ui";
import { studyShortcut } from "./study-shortcuts";
import type { DeckDefinition, DeckProgressEnvelope, DirectionalCardCopy, ReviewDifficulty, ReviewResult, ReviewTransaction, SelectionMode, StudyCard, StudyDirection, StudyModeState, StudyStats } from "./types";
import { useResponseTimer } from "./use-response-timer";

export type StudySourceDefinition = {
  id: string;
  label: string;
  deck: DeckDefinition;
  cards: StudyCard[];
  studyKey: string;
  direction: StudyDirection;
};

type Candidate = { source: StudySourceDefinition; card: StudyCard };
type MixedReviewTransaction = ReviewTransaction & { sourceId: string; deckId: string; studyKey: string };
type SyncStatus = "loading" | "local" | "syncing" | "cloud" | "error";

type Props = {
  deck: DeckDefinition;
  sources: StudySourceDefinition[];
  direction: StudyDirection;
  onDirectionChange?: (direction: StudyDirection) => void;
  directionLabels?: { forward: string; reverse: string };
  resetKey: string;
  cardMeta?: (card: StudyCard, source: StudySourceDefinition) => string;
  renderFront?: (card: StudyCard, copy: DirectionalCardCopy, source: StudySourceDefinition) => ReactNode;
  renderBack?: (card: StudyCard, copy: DirectionalCardCopy, source: StudySourceDefinition) => ReactNode;
  priorityPrompt?: (card: StudyCard, copy: DirectionalCardCopy) => ReactNode;
};

function candidateKey(candidate: Candidate) { return `${candidate.source.id}:${candidate.card.id}`; }

function availableCards(source: StudySourceDefinition, state: StudyModeState) {
  if (!source.deck.staged) return source.cards;
  const unlocked = new Set(source.deck.cards.slice(0, state.unlockedCount).map((card) => card.id));
  return source.cards.filter((card) => unlocked.has(card.id));
}

function aggregateStats(candidates: Candidate[], states: Map<string, StudyModeState>): StudyStats {
  let reviewed = 0, everWrong = 0, markedHard = 0, mastered = 0, totalReviews = 0, rightReviews = 0, responseTotal = 0, responseCount = 0, bestStreak = 0;
  for (const { source, card } of candidates) {
    const state = states.get(source.id);
    if (!state) continue;
    const item = getCardProgress(state, card.id);
    if (item.reviews) reviewed += 1;
    if (item.wrong) everWrong += 1;
    if (item.hard) markedHard += 1;
    if (item.initialMastered) mastered += 1;
    totalReviews += item.reviews;
    rightReviews += item.right;
    responseTotal += item.responseTimeTotalMs;
    responseCount += item.responseTimeCount;
    bestStreak = Math.max(bestStreak, item.bestStreak);
  }
  return { available: candidates.length, reviewed, accuracy: totalReviews ? rightReviews / totalReviews : null, everWrong, markedHard, averageResponseTimeMs: responseCount ? responseTotal / responseCount : 0, mastered, totalReviews, bestStreak };
}

export function MultiSourceStudySession({ deck, sources, direction, onDirectionChange, directionLabels = { forward: "Forward", reverse: "Reverse" }, resetKey, cardMeta, renderFront, renderBack, priorityPrompt }: Props) {
  const { user } = useAuth();
  const [envelopes, setEnvelopes] = useState<Record<string, DeckProgressEnvelope>>({});
  const envelopesRef = useRef<Record<string, DeckProgressEnvelope>>({});
  const persistQueue = useRef<Promise<void>>(Promise.resolve());
  const [ready, setReady] = useState(false);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("adaptive");
  const [current, setCurrent] = useState<Candidate | null>(null);
  const [revealed, setRevealed] = useState(false), [result, setResult] = useState<ReviewResult | null>(null), [difficulty, setDifficulty] = useState<ReviewDifficulty | null>(null);
  const [capturedTimeMs, setCapturedTimeMs] = useState<number | null>(null), [lastTransaction, setLastTransaction] = useState<MixedReviewTransaction | null>(null), [editingTransaction, setEditingTransaction] = useState<MixedReviewTransaction | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("loading"), [notice, setNotice] = useState<string | null>(null);
  const [backtracking, setBacktracking] = useState(false), [startGateOpen, setStartGateOpen] = useState(true);

  const deckIdsKey = useMemo(() => [...new Set(sources.map((source) => source.deck.id))].sort().join("|"), [sources]);
  const selectionSignature = useMemo(() => `${resetKey}::${sources.map((source) => `${source.id}:${source.studyKey}:${source.cards.map((card) => card.id).join(",")}`).join("||")}`, [resetKey, sources]);

  const modeFor = useCallback((source: StudySourceDefinition) => {
    const envelope = envelopesRef.current[source.deck.id];
    return envelope?.modes[source.studyKey] ?? createModeState(source.deck.id, source.studyKey, source.deck.cards.length, source.deck.staged);
  }, []);

  const saveMode = useCallback((source: StudySourceDefinition, nextMode: StudyModeState, options?: { review?: MixedReviewTransaction; deleteReviewId?: string }) => {
    const currentEnvelope = envelopesRef.current[source.deck.id] ?? createEnvelope(source.deck.id);
    const nextEnvelope: DeckProgressEnvelope = { ...currentEnvelope, updatedAt: Math.max(Date.now(), nextMode.updatedAt), modes: { ...currentEnvelope.modes, [source.studyKey]: nextMode } };
    const nextEnvelopes = { ...envelopesRef.current, [source.deck.id]: nextEnvelope };
    envelopesRef.current = nextEnvelopes;
    setEnvelopes(nextEnvelopes);
    setSyncStatus(user ? "syncing" : "local");
    persistQueue.current = persistQueue.current.catch(() => undefined).then(async () => {
      await saveProgressEnvelope(nextEnvelope, user);
      if (options?.deleteReviewId) await deleteReviewEvent(user, options.deleteReviewId);
      if (options?.review) {
        const review = options.review;
        await upsertReviewEvent(user, { id: review.reviewId, deckId: source.deck.id, studyKey: source.studyKey, cardId: review.cardId, result: review.result, difficulty: review.difficulty, responseTimeMs: review.responseTimeMs, reviewedAt: nextMode.cards[review.cardId]?.history.at(-1)?.reviewedAt ?? Date.now() });
      }
      setSyncStatus(user ? "cloud" : "local");
    }).catch(() => setSyncStatus("error"));
  }, [user]);

  useEffect(() => {
    let active = true;
    const uniqueDecks = [...new Map(sources.map((source) => [source.deck.id, source.deck])).values()];
    setReady(false); setCurrent(null); setStartGateOpen(true); setSyncStatus("loading");
    void Promise.all(uniqueDecks.map(async (sourceDeck) => ({ sourceDeck, loaded: await loadProgressEnvelope(sourceDeck.id, user) }))).then((loadedDecks) => {
      if (!active) return;
      const next: Record<string, DeckProgressEnvelope> = {};
      let syncError = false;
      for (const { sourceDeck, loaded } of loadedDecks) {
        let envelope = loaded.envelope ?? createEnvelope(sourceDeck.id);
        for (const source of sources.filter((item) => item.deck.id === sourceDeck.id)) {
          if (!envelope.modes[source.studyKey]) envelope = { ...envelope, modes: { ...envelope.modes, [source.studyKey]: createModeState(sourceDeck.id, source.studyKey, sourceDeck.cards.length, sourceDeck.staged) } };
        }
        next[sourceDeck.id] = envelope;
        if (loaded.syncError) syncError = true;
      }
      envelopesRef.current = next; setEnvelopes(next); setReady(true); setSyncStatus(syncError ? "error" : user ? "cloud" : "local");
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckIdsKey, user?.id]);

  useEffect(() => {
    if (!ready) return;
    for (const source of sources) {
      const envelope = envelopesRef.current[source.deck.id] ?? createEnvelope(source.deck.id);
      if (envelope.modes[source.studyKey]) continue;
      saveMode(source, createModeState(source.deck.id, source.studyKey, source.deck.cards.length, source.deck.staged));
    }
  }, [ready, saveMode, selectionSignature, sources]);

  function allCandidates() {
    const items: Candidate[] = [];
    for (const source of sources) {
      const state = modeFor(source);
      for (const card of availableCards(source, state)) items.push({ source, card });
    }
    return items;
  }

  function chooseNext(exclude?: Candidate | null) {
    let candidates = allCandidates();
    if (!candidates.length) return null;
    if (exclude && candidates.length > 1) candidates = candidates.filter((candidate) => candidateKey(candidate) !== candidateKey(exclude));
    if (selectionMode === "sequential") {
      if (!current) return candidates[0];
      const index = candidates.findIndex((candidate) => candidateKey(candidate) === candidateKey(current));
      return candidates[(index + 1 + candidates.length) % candidates.length];
    }
    const ranked = candidates.map((candidate) => ({ candidate, score: priorityScore(candidate.card, modeFor(candidate.source)) })).sort((a, b) => b.score - a.score).slice(0, Math.min(24, candidates.length));
    const max = ranked[0].score, weights = ranked.map(({ score }) => Math.exp((score - max) / 11));
    let chance = Math.random() * weights.reduce((sum, weight) => sum + weight, 0);
    for (let index = 0; index < ranked.length; index += 1) { chance -= weights[index]; if (chance <= 0) return ranked[index].candidate; }
    return ranked[0].candidate;
  }

  function present(candidate: Candidate) {
    const state = modeFor(candidate.source);
    saveMode(candidate.source, presentCard(state, candidate.card));
    setCurrent(candidate);
  }

  function resetUi() { setRevealed(false); setBacktracking(false); setResult(null); setDifficulty(null); setCapturedTimeMs(null); setEditingTransaction(null); }

  useEffect(() => {
    if (!ready) return;
    resetUi(); setLastTransaction(null); setStartGateOpen(true); setCurrent(null);
    const selected = chooseNext();
    if (selected) present(selected);
    // The selection signature changes only when the selected study pool/direction changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, selectionSignature]);

  const currentState = current ? modeFor(current.source) : null;
  const copy = current ? directionalCopy(current.card, current.source.direction) : null;
  const timer = useResponseTimer(current && currentState ? `${current.source.deck.id}:${current.source.studyKey}:${current.card.id}:${getCardProgress(currentState, current.card.id).lastPresentedAt}` : null, Boolean(current && currentState && !revealed && !editingTransaction && !startGateOpen));

  const states = useMemo(() => {
    const map = new Map<string, StudyModeState>();
    for (const source of sources) {
      const state = envelopes[source.deck.id]?.modes[source.studyKey];
      if (state) map.set(source.id, state);
    }
    return map;
  }, [envelopes, sources]);
  const visibleCandidates = useMemo(() => sources.flatMap((source) => { const state = states.get(source.id); return state ? availableCards(source, state).map((card) => ({ source, card })) : []; }), [sources, states]);
  const stats = useMemo(() => aggregateStats(visibleCandidates, states), [states, visibleCandidates]);
  const priority = useMemo(() => visibleCandidates.map(({ source, card }) => ({ card, progress: getCardProgress(states.get(source.id) ?? modeFor(source), card.id), score: priorityScore(card, states.get(source.id) ?? modeFor(source), { ignoreRecency: true }) })).sort((a, b) => b.score - a.score).slice(0, 5), [modeFor, states, visibleCandidates]);
  const sourceByCard = useMemo(() => new Map(sources.flatMap((source) => source.cards.map((card) => [`${card.deckId}:${card.id}`, source] as const))), [sources]);

  function reveal() { if (!current || revealed || editingTransaction || startGateOpen) return; setBacktracking(false); setCapturedTimeMs(timer.capture()); setRevealed(true); }
  function changeOrder(next: SelectionMode) { setSelectionMode(next); if (!current) return; resetUi(); setStartGateOpen(true); const selected = chooseNext(current); if (selected) present(selected); }
  function skip() { if (!current || editingTransaction) return; const previous = current; resetUi(); const selected = chooseNext(previous); if (selected) present(selected); }
  function back() {
    if (!lastTransaction) return;
    const source = sources.find((item) => item.id === lastTransaction.sourceId);
    if (!source) return;
    const card = source.deck.cards.find((item) => item.id === lastTransaction.cardId);
    if (!card) return;
    const transaction = lastTransaction;
    setLastTransaction(null); setEditingTransaction(transaction); setResult(transaction.result); setDifficulty(transaction.difficulty); setCapturedTimeMs(transaction.responseTimeMs); setBacktracking(true); setRevealed(false); setCurrent({ source, card });
    saveMode(source, transaction.beforeState, { deleteReviewId: transaction.reviewId });
    requestAnimationFrame(() => requestAnimationFrame(() => setRevealed(true)));
    setNotice("Previous grade undone. Choose the corrected result and save it.");
  }
  function saveNext() {
    if (!current || !result || !difficulty) return;
    const source = current.source, state = modeFor(source), reviewedAt = Date.now(), reviewId = editingTransaction?.reviewId ?? crypto.randomUUID(), responseTimeMs = capturedTimeMs ?? timer.capture();
    const beforeState = editingTransaction?.beforeState ?? structuredClone(state);
    let next = recordReview(state, current.card, { id: reviewId, result, difficulty, responseTimeMs, reviewedAt });
    next = maybeUnlockNextBatch(next, source.deck.cards, source.deck.staged, reviewedAt);
    const transaction: MixedReviewTransaction = { reviewId, cardId: current.card.id, result, difficulty, responseTimeMs, beforeState, sourceId: source.id, deckId: source.deck.id, studyKey: source.studyKey };
    const corrected = Boolean(editingTransaction), unlocked = next.lastUnlock?.at === reviewedAt ? next.lastUnlock : null;
    saveMode(source, next, { review: transaction }); setLastTransaction(transaction); resetUi();
    const selected = chooseNext(current); if (selected) present(selected);
    setNotice(unlocked ? `New vocabulary cards unlocked: ${unlocked.start}–${unlocked.end}.` : corrected ? "Previous grade corrected." : "Progress saved.");
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
      if (shortcut.type === "result") { setResult(shortcut.value); return; }
      if (shortcut.type === "difficulty") { setDifficulty(shortcut.value); return; }
      event.preventDefault(); saveNext();
    }
    window.addEventListener("keydown", keydown); return () => window.removeEventListener("keydown", keydown);
  });

  if (!ready) return <div className="study-loading panel-surface" role="status"><span className="loading-mark">A</span><p>Preparing Latin study…</p></div>;
  if (!current || !copy) return <div className="study-loading panel-surface" role="status"><span className="loading-mark">A</span><p>No cards match these selections. Open Choose cards and widen the study set.</p></div>;
  const currentMeta = cardMeta?.(current.card, current.source);

  return <div className="study-grid" data-testid="study-session" data-study-key={current.source.studyKey}>
    <section className="study-panel panel-surface" aria-label={`${deck.title} study card`}>
      {startGateOpen && !revealed && !editingTransaction && <StudyStartGate onStart={() => setStartGateOpen(false)} />}
      <div className="study-toolbar session-toolbar">
        <div className="toolbar-control-group">
          {onDirectionChange && <div className="segmented-control" aria-label="Study direction">{(["forward", "reverse"] as StudyDirection[]).map((value) => <button key={value} type="button" aria-pressed={direction === value} onClick={() => onDirectionChange(value)}>{directionLabels[value]}</button>)}</div>}
          <label className="compact-select-label"><span className="sr-only">Card order</span><select value={selectionMode} onChange={(event) => changeOrder(event.target.value as SelectionMode)}><option value="adaptive">Adaptive review</option><option value="sequential">Sequential</option></select></label>
        </div>
        <div className={`storage-status ${syncStatus === "error" ? "storage-error" : ""}`}>{user ? <Cloud aria-hidden="true" /> : <Laptop aria-hidden="true" />}<span>{syncStatus === "loading" ? "Loading progress" : syncStatus === "syncing" ? "Syncing…" : syncStatus === "error" ? "Saved locally; cloud sync needs attention" : user ? "Cloud progress synced" : "Guest progress on this device"}</span></div>
      </div>
      {notice && <button className="inline-notice" type="button" onClick={() => setNotice(null)}>{notice}</button>}
      <div className="flashcard-meta"><div className="card-meta-details"><span className="stage-chip">{current.source.label}</span>{current.card.category && <span>{current.card.category}</span>}{currentMeta && <span>{currentMeta}</span>}<span className="front-timer" aria-label={`Front-card response time ${formatResponseTime(capturedTimeMs ?? timer.elapsedMs)}`}><Timer aria-hidden="true" /> {formatResponseTime(capturedTimeMs ?? timer.elapsedMs)}</span>{editingTransaction && <span className="editing-chip">Correcting previous grade</span>}</div><div className="card-nav-actions"><button type="button" className="small-outline-button" disabled={!lastTransaction} onClick={back}><ArrowLeft /> Back</button><button type="button" className="small-outline-button" disabled={Boolean(editingTransaction)} onClick={skip}>Skip <SkipForward /></button></div></div>
      <div className={`flashcard-scene ${revealed ? "is-flipped" : ""} ${backtracking ? "is-backtracking" : ""}`}>
        <div className="flashcard-inner">
          <button type="button" className="flashcard-face flashcard-front-face" onClick={reveal} aria-label="Reveal answer" aria-hidden={revealed} tabIndex={revealed ? -1 : 0}><span className="card-side">Question</span>{renderFront ? renderFront(current.card, copy, current.source) : <span className="study-prompt">{copy.prompt}</span>}</button>
          <div className="flashcard-face flashcard-back-face" aria-hidden={!revealed}><span className="card-side">Answer</span>{renderBack ? renderBack(current.card, copy, current.source) : <span className="answer-block"><strong className="study-answer">{copy.answer}</strong>{current.card.notes && <span className="answer-notes">{current.card.notes}</span>}</span>}</div>
        </div>
      </div>
      <StudyRatingControls revealed={revealed} result={result} difficulty={difficulty} editing={Boolean(editingTransaction)} onReveal={reveal} onResult={setResult} onDifficulty={setDifficulty} onSave={saveNext} />
    </section>
    <StudySidebar deck={deck} cards={visibleCandidates.map((candidate) => candidate.card)} copy={copy} direction={direction} stats={stats} priority={priority} priorityPrompt={priorityPrompt} cardCopy={(card) => { const source = sourceByCard.get(`${card.deckId}:${card.id}`); return directionalCopy(card, source?.direction ?? direction); }} />
  </div>;
}
