import { ArrowLeft, Cloud, Laptop, SkipForward, Timer } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/auth-context";
import { createEnvelope, createModeState, directionalCopy, formatResponseTime, getCardProgress, maybeUnlockNextBatch, presentCard, priorityScore, recordReview } from "./engine";
import { deleteReviewEvent, loadLocalEnvelope, loadProgressEnvelope, mergeProgressEnvelopes, saveProgressEnvelope, upsertReviewEvent } from "./progress-repository";
import { intrinsicCardDifficulty } from "./scoring";
import { collectManagedSessions, displayManagedSessionName, sessionDeckIdsForLanguage, type ManagedSession } from "./session-management";
import "./study-gate.css";
import { StudyRatingControls, StudySidebar, StudyStartGate } from "./study-session-ui";
import { studyShortcut } from "./study-shortcuts";
import type { DeckDefinition, DeckProgressEnvelope, DirectionalCardCopy, ReviewDifficulty, ReviewResult, ReviewTransaction, SelectionMode, StudyActivityKind, StudyCard, StudyDirection, StudyModeState, StudyStats } from "./types";
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
type SessionMeta = { id: string; startedAt: number; name?: string };
type WarmupMeta = SessionMeta & { remaining: number; total: number };
const WARMUP_CARDS = 5;
const makeSession = (): SessionMeta => ({ id: crypto.randomUUID(), startedAt: Date.now() });

const PropsDefaults = { forward: "Forward", reverse: "Reverse" } as const;

type Props = {
  deck: DeckDefinition;
  sources: StudySourceDefinition[];
  direction: StudyDirection;
  onDirectionChange?: (direction: StudyDirection) => void;
  directionLabels?: { forward: string; reverse: string };
  resetKey: string;
  resumeSession?: SessionMeta | null;
  cardMeta?: (card: StudyCard, source: StudySourceDefinition) => string;
  renderFront?: (card: StudyCard, copy: DirectionalCardCopy, source: StudySourceDefinition) => ReactNode;
  renderBack?: (card: StudyCard, copy: DirectionalCardCopy, source: StudySourceDefinition) => ReactNode;
  priorityPrompt?: (card: StudyCard, copy: DirectionalCardCopy) => ReactNode;
};

function candidateKey(candidate: Candidate) { return `${candidate.source.id}:${candidate.card.id}`; }
export function retainSelectedCandidate(current: Candidate | null, sources: StudySourceDefinition[]) {
  if (!current) return null;
  const source = sources.find((item) => item.id === current.source.id);
  const card = source?.cards.find((item) => item.id === current.card.id);
  return source && card ? { source, card } : null;
}

function sessionLabel(session: ManagedSession) { return displayManagedSessionName(session); }

export function mostRecentResumableSession(sessions: readonly ManagedSession[]) {
  return [...sessions]
    .filter((session) => !session.inferred)
    .sort((a, b) => b.lastReviewedAt - a.lastReviewedAt || b.startedAt - a.startedAt)[0] ?? null;
}

export function sessionWasDeleted(envelopes: Record<string, DeckProgressEnvelope | null | undefined>, sessionId: string) {
  return Object.values(envelopes).some((envelope) => envelope?.deletedSessionIds?.includes(sessionId));
}

export function currentSessionDisplayName(language: "Greek" | "Latin", sources: readonly string[], customName?: string) {
  const custom = customName?.trim();
  if (custom) return custom;
  const uniqueSources = [...new Set(sources.filter(Boolean))];
  const focus = uniqueSources.length === 1 ? uniqueSources[0] : uniqueSources.length === 2 ? uniqueSources.join(" + ") : "Mixed study";
  return `${language} · ${focus}`;
}

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

function avoidRecentlyPresentedCandidates(candidates: Candidate[], modeFor: (source: StudySourceDefinition) => StudyModeState) {
  if (candidates.length <= 3) return candidates;
  const recentLimit = Math.min(4, candidates.length - 3);
  const recentKeys = new Set(
    candidates
      .map((candidate) => ({ key: candidateKey(candidate), at: getCardProgress(modeFor(candidate.source), candidate.card.id).lastPresentedAt }))
      .filter((item) => item.at > 0)
      .sort((a, b) => b.at - a.at)
      .slice(0, recentLimit)
      .map((item) => item.key),
  );
  if (!recentKeys.size) return candidates;
  const filtered = candidates.filter((candidate) => !recentKeys.has(candidateKey(candidate)));
  return filtered.length >= 3 ? filtered : candidates;
}

export function MultiSourceStudySession({ deck, sources, direction, onDirectionChange, directionLabels = PropsDefaults, resetKey, resumeSession, cardMeta, renderFront, renderBack, priorityPrompt }: Props) {
  const { user } = useAuth();
  const [envelopes, setEnvelopes] = useState<Record<string, DeckProgressEnvelope>>({});
  const envelopesRef = useRef<Record<string, DeckProgressEnvelope>>({});
  const persistQueue = useRef<Promise<void>>(Promise.resolve());
  const [ready, setReady] = useState(false);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("adaptive");
  const [current, setCurrent] = useState<Candidate | null>(null);
  const [revealed, setRevealed] = useState(false), [reviewFront, setReviewFront] = useState(false), [result, setResult] = useState<ReviewResult | null>(null), [difficulty, setDifficulty] = useState<ReviewDifficulty | null>(null);
  const [capturedTimeMs, setCapturedTimeMs] = useState<number | null>(null), [lastTransaction, setLastTransaction] = useState<MixedReviewTransaction | null>(null), [editingTransaction, setEditingTransaction] = useState<MixedReviewTransaction | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("loading"), [notice, setNotice] = useState<string | null>(() => resumeSession ? "Continuing the selected past session. Your long-term memory and adaptive priorities are unchanged." : null);
  const [backtracking, setBacktracking] = useState(false), [startGateOpen, setStartGateOpen] = useState(true);
  const [session, setSession] = useState<SessionMeta>(() => resumeSession ?? makeSession());
  const [warmup, setWarmup] = useState<WarmupMeta | null>(null);
  const sessionChoiceInitialized = useRef(Boolean(resumeSession));

  const sessionLanguage: "Greek" | "Latin" = deck.language === "greek" ? "Greek" : "Latin";
  const sessionDeckIds = useMemo(() => sessionDeckIdsForLanguage(sessionLanguage), [sessionLanguage]);
  const deckIdsKey = useMemo(() => [...new Set([...sessionDeckIds, ...sources.map((source) => source.deck.id)])].sort().join("|"), [sessionDeckIds, sources]);
  const selectionSignature = useMemo(() => `${resetKey}::${sources.map((source) => `${source.id}:${source.studyKey}:${source.cards.length}`).join("|")}`, [resetKey, sources]);
  const sessionCatalog = useMemo(() => collectManagedSessions(envelopes).filter((item) => item.language === sessionLanguage), [envelopes, sessionLanguage]);
  const currentManagedSession = useMemo(() => sessionCatalog.find((item) => !item.inferred && item.id === session.id) ?? null, [session.id, sessionCatalog]);
  const currentSessionName = useMemo(() => currentSessionDisplayName(
    sessionLanguage,
    currentManagedSession?.sources ?? sources.map((source) => source.label),
    currentManagedSession?.name ?? session.name,
  ), [currentManagedSession, session.name, sessionLanguage, sources]);

  useEffect(() => {
    if (!ready || sessionChoiceInitialized.current) return;
    sessionChoiceInitialized.current = true;
    const latest = mostRecentResumableSession(sessionCatalog);
    if (!latest) return;
    setSession({ id: latest.id, startedAt: latest.startedAt, name: latest.name });
    setNotice(`Continuing ${sessionLabel(latest)}. Adaptive review still uses your full long-term history.`);
  }, [ready, sessionCatalog]);

  useEffect(() => {
    if (!ready || !sessionChoiceInitialized.current || !sessionWasDeleted(envelopes, session.id)) return;
    clearResumeUrl();
    const latest = mostRecentResumableSession(sessionCatalog);
    if (latest) {
      setSession({ id: latest.id, startedAt: latest.startedAt, name: latest.name });
      setNotice(`The previous session was deleted. Continuing ${sessionLabel(latest)} instead.`);
      return;
    }
    setSession(makeSession());
    setNotice("The previous session was deleted. A new session will begin with your next saved review.");
  // clearResumeUrl is stable browser plumbing and intentionally omitted.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envelopes, ready, session.id, sessionCatalog]);

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
    const deckIds = [...new Set([...sessionDeckIds, ...sources.map((source) => source.deck.id)])];
    setReady(false); setCurrent(null); setStartGateOpen(true); setSyncStatus("loading");
    void Promise.all(deckIds.map(async (deckId) => ({ deckId, loaded: await loadProgressEnvelope(deckId, user) }))).then((loadedDecks) => {
      if (!active) return;
      const next: Record<string, DeckProgressEnvelope> = {};
      let syncError = false;
      for (const { deckId, loaded } of loadedDecks) {
        let envelope = loaded.envelope ?? createEnvelope(deckId);
        for (const source of sources.filter((item) => item.deck.id === deckId)) {
          if (!envelope.modes[source.studyKey]) envelope = { ...envelope, modes: { ...envelope.modes, [source.studyKey]: createModeState(deckId, source.studyKey, source.deck.cards.length, source.deck.staged) } };
        }
        next[deckId] = envelope;
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

  useEffect(() => {
    if (!ready) return;
    const refreshSessionCatalog = () => {
      const next = { ...envelopesRef.current };
      let changed = false;
      for (const deckId of sessionDeckIds) {
        const local = loadLocalEnvelope(deckId);
        if (!local) continue;
        const merged = mergeProgressEnvelopes(next[deckId] ?? null, local);
        if (!merged) continue;
        next[deckId] = merged;
        changed = true;
      }
      if (changed) { envelopesRef.current = next; setEnvelopes(next); }
    };
    window.addEventListener("storage", refreshSessionCatalog);
    window.addEventListener("focus", refreshSessionCatalog);
    return () => { window.removeEventListener("storage", refreshSessionCatalog); window.removeEventListener("focus", refreshSessionCatalog); };
  }, [ready, sessionDeckIds]);

  function allCandidates() {
    const items: Candidate[] = [];
    for (const source of sources) {
      const state = modeFor(source);
      for (const card of availableCards(source, state)) items.push({ source, card });
    }
    return items;
  }

  function personalizedScore(candidate: Candidate) {
    const state = modeFor(candidate.source);
    const base = priorityScore(candidate.card, state, { ignoreRecency: false });
    if (deck.language !== "greek" && deck.language !== "latin") return base;
    const intrinsic = intrinsicCardDifficulty({ language: deck.language === "greek" ? "Greek" : "Latin", source: candidate.source.label.includes("vocabulary") ? "Dickinson Vocabulary" : candidate.source.label.includes("chart") ? "Henle Whole Charts" : candidate.source.label.includes("Grammar") || candidate.source.label.includes("form") ? "Henle Grammar Forms" : candidate.source.label, cards: candidate.source.deck.cards }, candidate.card);
    return base + intrinsic * 0.12;
  }

  function chooseNext(exclude?: Candidate | null, mode: SelectionMode = selectionMode, personalized = false) {
    let candidates = allCandidates();
    if (!candidates.length) return null;
    if (exclude && candidates.length > 1) candidates = candidates.filter((candidate) => candidateKey(candidate) !== candidateKey(exclude));
    if (mode !== "sequential") candidates = avoidRecentlyPresentedCandidates(candidates, modeFor);
    if (personalized) {
      const reviewed = candidates.filter((candidate) => getCardProgress(modeFor(candidate.source), candidate.card.id).reviews > 0);
      const pool = reviewed.length ? reviewed : candidates;
      return [...pool].sort((a, b) => personalizedScore(b) - personalizedScore(a))[0] ?? null;
    }
    if (mode === "sequential") {
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
  function resetUi() { setRevealed(false); setReviewFront(false); setBacktracking(false); setResult(null); setDifficulty(null); setCapturedTimeMs(null); setEditingTransaction(null); }

  useEffect(() => {
    if (!ready) return;
    resetUi(); setLastTransaction(null); setWarmup(null); setStartGateOpen(true);
    const retained = retainSelectedCandidate(current, sources);
    if (retained) { setCurrent(retained); return; }
    setCurrent(null);
    const selected = chooseNext();
    if (selected) present(selected);
    // Filter changes keep the current card whenever it remains in the new pool.
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

  function reveal() { if (!current || revealed || editingTransaction || startGateOpen) return; setBacktracking(false); setReviewFront(false); setCapturedTimeMs(timer.capture()); setRevealed(true); }
  function toggleReviewFace() { if (revealed) setReviewFront((value) => !value); }
  function changeOrder(next: SelectionMode) { setSelectionMode(next); if (!current) return; resetUi(); setStartGateOpen(true); const selected = chooseNext(current, next, Boolean(warmup)); if (selected) present(selected); }
  function skip() { if (!current || editingTransaction) return; const previous = current; resetUi(); const selected = chooseNext(previous, selectionMode, Boolean(warmup)); if (selected) present(selected); }
  function clearResumeUrl() {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("session") && !url.searchParams.has("sessionStartedAt")) return;
    url.searchParams.delete("session"); url.searchParams.delete("sessionStartedAt");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }
  function continueSession(id: string) {
    const previous = sessionCatalog.find((item) => item.id === id && !item.inferred);
    if (!previous) return;
    sessionChoiceInitialized.current = true;
    clearResumeUrl();
    setWarmup(null); setSession({ id: previous.id, startedAt: previous.startedAt, name: previous.name }); setLastTransaction(null); resetUi(); setStartGateOpen(true);
    setNotice(`Continuing ${sessionLabel(previous)}. Adaptive review still uses your full long-term history.`);
  }
  function startNewSession() {
    sessionChoiceInitialized.current = true;
    clearResumeUrl();
    setWarmup(null); setSession(makeSession()); setLastTransaction(null); resetUi(); setStartGateOpen(true);
    const selected = chooseNext(current);
    if (selected) present(selected);
    setNotice("New session started. Card priorities still use your full long-term history.");
  }
  function startWarmup() {
    if (!current) return;
    const meta = { ...makeSession(), remaining: WARMUP_CARDS, total: WARMUP_CARDS };
    setWarmup(meta); setLastTransaction(null); resetUi(); setStartGateOpen(false);
    const selected = chooseNext(current, "adaptive", true);
    if (selected) present(selected);
    setNotice("Personalized warm-up started: five high-priority cards before the ranked session.");
  }
  function back() {
    if (!lastTransaction) return;
    const source = sources.find((item) => item.id === lastTransaction.sourceId);
    if (!source) return;
    const card = source.deck.cards.find((item) => item.id === lastTransaction.cardId);
    if (!card) return;
    const transaction = lastTransaction;
    setLastTransaction(null); setEditingTransaction(transaction); setResult(transaction.result); setDifficulty(transaction.difficulty); setCapturedTimeMs(transaction.responseTimeMs); setBacktracking(true); setRevealed(false); setReviewFront(false); setCurrent({ source, card });
    saveMode(source, transaction.beforeState, { deleteReviewId: transaction.reviewId });
    requestAnimationFrame(() => requestAnimationFrame(() => setRevealed(true)));
    setNotice("Previous grade undone. Choose the corrected result and save it.");
  }
  function saveNext() {
    if (!current || !result || !difficulty) return;
    const source = current.source, state = modeFor(source), reviewedAt = Date.now(), reviewId = editingTransaction?.reviewId ?? crypto.randomUUID(), responseTimeMs = capturedTimeMs ?? timer.capture();
    const beforeState = editingTransaction?.beforeState ?? structuredClone(state);
    const activityKind: StudyActivityKind = editingTransaction?.activityKind ?? (warmup ? "warmup" : "study");
    const activeMeta = activityKind === "warmup" && warmup ? warmup : session;
    const sessionId = editingTransaction?.sessionId ?? activeMeta.id, sessionStartedAt = editingTransaction?.sessionStartedAt ?? activeMeta.startedAt, sessionName = editingTransaction?.sessionName ?? activeMeta.name;
    let next = recordReview(state, current.card, { id: reviewId, result, difficulty, responseTimeMs, reviewedAt, sessionId, sessionStartedAt, sessionName, activityKind });
    next = maybeUnlockNextBatch(next, source.deck.cards, source.deck.staged, reviewedAt);
    const transaction: MixedReviewTransaction = { reviewId, cardId: current.card.id, result, difficulty, responseTimeMs, beforeState, sourceId: source.id, deckId: source.deck.id, studyKey: source.studyKey, sessionId, sessionStartedAt, sessionName, activityKind };
    const corrected = Boolean(editingTransaction), unlocked = next.lastUnlock?.at === reviewedAt ? next.lastUnlock : null;
    saveMode(source, next, { review: transaction }); setLastTransaction(transaction); resetUi();

    if (warmup && !editingTransaction) {
      if (warmup.remaining <= 1) {
        setWarmup(null); setStartGateOpen(true);
        const selected = chooseNext(current, selectionMode, false); if (selected) present(selected);
        setNotice("Warm-up complete. Your five reviews strengthened long-term memory but are excluded from ranked session scores. Continue the current session when ready.");
        return;
      }
      setWarmup({ ...warmup, remaining: warmup.remaining - 1 });
      const selected = chooseNext(current, "adaptive", true); if (selected) present(selected);
      setNotice(`Warm-up: ${warmup.remaining - 1} card${warmup.remaining - 1 === 1 ? "" : "s"} remaining.`);
      return;
    }

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
      const shortcut = studyShortcut({
        key: event.key,
        startGateOpen,
        revealed,
        result,
        difficulty,
        typingTarget: Boolean(target?.closest("input, textarea, select, [contenteditable='true'], [role='textbox'], [role='listbox']")),
        controlsTarget: Boolean(target?.closest(".session-toolbar, .study-start-card")),
      });
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

  if (!ready) return <div className="study-loading panel-surface" role="status"><span className="loading-mark">A</span><p>Preparing study…</p></div>;
  if (!current || !copy) return <div className="study-loading panel-surface" role="status"><span className="loading-mark">A</span><p>No cards match these selections. Open Choose cards and widen the study set.</p></div>;
  const currentMeta = cardMeta?.(current.card, current.source);
  const showingAnswer = revealed && !reviewFront;
  const gated = startGateOpen && !revealed && !editingTransaction;
  const sessionControlValue = "__current__";
  const selectableSessions = sessionCatalog.filter((item) => item.id !== session.id);

  return <div className="study-grid" data-testid="study-session" data-study-key={current.source.studyKey}>
    <section className={`study-panel panel-surface ${gated ? "is-gated" : ""}`} aria-label={`${deck.title} study card`}>
      {gated && <StudyStartGate onStart={() => setStartGateOpen(false)} onWarmup={startWarmup} />}
      <div className="study-toolbar session-toolbar">
        <div className="toolbar-control-group">
          {onDirectionChange && <div className="segmented-control" aria-label="Study direction">{(["forward", "reverse"] as StudyDirection[]).map((value) => <button key={value} type="button" aria-pressed={direction === value} onClick={() => onDirectionChange(value)}>{directionLabels[value]}</button>)}</div>}
          <label className="compact-select-label"><span className="sr-only">Card order</span><select value={selectionMode} onChange={(event) => changeOrder(event.target.value as SelectionMode)}><option value="adaptive">Adaptive review</option><option value="sequential">Sequential</option></select></label>
          <label className="compact-select-label"><span className="sr-only">Study session</span><select value={sessionControlValue} disabled={Boolean(editingTransaction)} onChange={(event) => { const value = event.target.value; if (value === "__new__") startNewSession(); else if (value !== "__current__") continueSession(value); }}><option value="__current__">{currentSessionName}</option><option value="__new__">Start new session</option>{selectableSessions.map((item) => <option key={item.id} value={item.id} disabled={item.inferred}>{sessionLabel(item)}</option>)}</select></label>
          <button type="button" className="small-outline-button" onClick={() => setStartGateOpen(true)} disabled={revealed || Boolean(editingTransaction) || startGateOpen}>Pause timer</button>
          <Link className="small-outline-button" to="/stats">Stats</Link>
        </div>
        <div className={`storage-status ${syncStatus === "error" ? "storage-error" : ""}`}>{user ? <Cloud aria-hidden="true" /> : <Laptop aria-hidden="true" />}<span>{warmup ? `Warm-up · ${warmup.total - warmup.remaining + 1} of ${warmup.total}` : syncStatus === "loading" ? "Loading progress" : syncStatus === "syncing" ? "Syncing…" : syncStatus === "error" ? "Saved locally; cloud sync needs attention" : user ? "Cloud progress synced" : "Guest progress on this device"}</span></div>
      </div>
      {notice && <button className="inline-notice" type="button" onClick={() => setNotice(null)}>{notice}</button>}
      <div className="flashcard-meta"><div className="card-meta-details"><span className="stage-chip">{warmup ? "Warm-up" : current.source.label}</span>{current.card.category && <span>{current.card.category}</span>}{currentMeta && <span>{currentMeta}</span>}<span className="front-timer" aria-label={`Front-card response time ${formatResponseTime(capturedTimeMs ?? timer.elapsedMs)}`}><Timer aria-hidden="true" /> {formatResponseTime(capturedTimeMs ?? timer.elapsedMs)}</span>{editingTransaction && <span className="editing-chip">Correcting previous grade</span>}</div><div className="card-nav-actions"><button type="button" className="small-outline-button" disabled={!lastTransaction} onClick={back}><ArrowLeft /> Back</button><button type="button" className="small-outline-button" disabled={Boolean(editingTransaction)} onClick={skip}>Skip <SkipForward /></button></div></div>
      <div className={`flashcard-scene ${showingAnswer ? "is-flipped" : ""} ${backtracking ? "is-backtracking" : ""}`}>
        <div className="flashcard-inner">
          <button type="button" className="flashcard-face flashcard-front-face" onClick={() => revealed ? setReviewFront(false) : reveal()} aria-label={revealed ? "Return to answer" : "Reveal answer"} aria-hidden={showingAnswer} tabIndex={showingAnswer ? -1 : 0}><span className="card-side">Question</span>{renderFront ? renderFront(current.card, copy, current.source) : <span className="study-prompt">{copy.prompt}</span>}</button>
          <div className="flashcard-face flashcard-back-face" aria-hidden={!showingAnswer}><span className="card-side">Answer</span>{renderBack ? renderBack(current.card, copy, current.source) : <span className="answer-block"><strong className="study-answer">{copy.answer}</strong>{current.card.notes && <span className="answer-notes">{current.card.notes}</span>}</span>}</div>
        </div>
      </div>
      <StudyRatingControls revealed={revealed} result={result} difficulty={difficulty} editing={Boolean(editingTransaction)} onReveal={reveal} onFlip={toggleReviewFace} onResult={setResult} onDifficulty={setDifficulty} onSave={saveNext} />
    </section>
    <StudySidebar deck={deck} cards={visibleCandidates.map((candidate) => candidate.card)} copy={copy} direction={direction} stats={stats} priority={priority} priorityPrompt={priorityPrompt} cardCopy={(card) => { const source = sourceByCard.get(`${card.deckId}:${card.id}`); return directionalCopy(card, source?.direction ?? direction); }} />
  </div>;
}