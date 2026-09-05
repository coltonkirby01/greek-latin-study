import type { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import type { DeckProgressEnvelope, ReviewDifficulty, ReviewResult } from "./types";

const localKey = (deckId: string) => `greek-latin-study:deck:${deckId}:v2`;
function safeParse(raw: string | null) { try { return raw ? JSON.parse(raw) as DeckProgressEnvelope : null; } catch { return null; } }
function rawLocalEnvelope(deckId: string) { return safeParse(localStorage.getItem(localKey(deckId))); }
function uniqueReviewIds(...groups: Array<readonly string[] | undefined>) { return [...new Set(groups.flatMap((group) => group ?? []).filter(Boolean))]; }

export function removeDeletedReviewHistory(envelope: DeckProgressEnvelope, reviewIds: readonly string[]) {
  const deleted = new Set(reviewIds);
  if (!deleted.size) return envelope;
  let envelopeChanged = false;
  const modes = Object.fromEntries(Object.entries(envelope.modes).map(([studyKey, mode]) => {
    let modeChanged = false;
    const cards = Object.fromEntries(Object.entries(mode.cards).map(([cardId, progress]) => {
      const history = progress.history.filter((review) => !deleted.has(review.id));
      if (history.length === progress.history.length) return [cardId, progress];
      modeChanged = true;
      envelopeChanged = true;
      return [cardId, { ...progress, history }];
    }));
    return [studyKey, modeChanged ? { ...mode, cards } : mode];
  }));
  return envelopeChanged ? { ...envelope, modes } : envelope;
}

export function excludeDeletedSessionHistory(envelope: DeckProgressEnvelope, reviewIds: readonly string[], sessionIds: readonly string[]) {
  const excludedReviews = new Set(reviewIds), excludedSessions = new Set(sessionIds);
  if (!excludedReviews.size && !excludedSessions.size) return envelope;
  let envelopeChanged = false;
  const modes = Object.fromEntries(Object.entries(envelope.modes).map(([studyKey, mode]) => {
    let modeChanged = false;
    const cards = Object.fromEntries(Object.entries(mode.cards).map(([cardId, progress]) => {
      let historyChanged = false;
      const history = progress.history.map((review) => {
        if (!excludedReviews.has(review.id) && !(review.sessionId && excludedSessions.has(review.sessionId))) return review;
        const alreadyExcluded = review.statsExcluded && !review.sessionId && !review.sessionStartedAt && !review.sessionName;
        if (alreadyExcluded) return review;
        const { sessionId: _sessionId, sessionStartedAt: _sessionStartedAt, sessionName: _sessionName, ...learningReview } = review;
        historyChanged = true;
        return { ...learningReview, statsExcluded: true };
      });
      if (!historyChanged) return [cardId, progress];
      modeChanged = true;
      envelopeChanged = true;
      return [cardId, { ...progress, history }];
    }));
    return [studyKey, modeChanged ? { ...mode, cards } : mode];
  }));
  return envelopeChanged ? { ...envelope, modes } : envelope;
}

function preparedEnvelope(envelope: DeckProgressEnvelope, extraDeletedIds: readonly string[] = [], keepPending = true): DeckProgressEnvelope {
  const pendingDeletedReviewIds = uniqueReviewIds(envelope.pendingDeletedReviewIds);
  const deletedReviewIds = uniqueReviewIds(envelope.deletedReviewIds, pendingDeletedReviewIds, extraDeletedIds);
  const sessionDeletedReviewIds = uniqueReviewIds(envelope.sessionDeletedReviewIds);
  const deletedSessionIds = uniqueReviewIds(envelope.deletedSessionIds);
  const withoutPhysicallyDeleted = removeDeletedReviewHistory(envelope, deletedReviewIds);
  const sanitized = excludeDeletedSessionHistory(withoutPhysicallyDeleted, sessionDeletedReviewIds, deletedSessionIds);
  const { deletedReviewIds: _deleted, pendingDeletedReviewIds: _pending, sessionDeletedReviewIds: _sessionDeleted, deletedSessionIds: _deletedSessions, ...base } = sanitized;
  return {
    ...base,
    ...(deletedReviewIds.length ? { deletedReviewIds } : {}),
    ...(keepPending && pendingDeletedReviewIds.length ? { pendingDeletedReviewIds } : {}),
    ...(sessionDeletedReviewIds.length ? { sessionDeletedReviewIds } : {}),
    ...(deletedSessionIds.length ? { deletedSessionIds } : {}),
  };
}

function sameReviewIds(left: readonly string[] | undefined, right: readonly string[] | undefined) {
  const a = new Set(left ?? []), b = new Set(right ?? []);
  return a.size === b.size && [...a].every((id) => b.has(id));
}

export function loadLocalEnvelope(deckId: string) {
  const local = rawLocalEnvelope(deckId);
  return local ? preparedEnvelope(local) : null;
}

export function saveLocalEnvelope(envelope: DeckProgressEnvelope) {
  const current = rawLocalEnvelope(envelope.deckId);
  const deletedReviewIds = uniqueReviewIds(current?.deletedReviewIds, current?.pendingDeletedReviewIds);
  const sessionDeletedReviewIds = uniqueReviewIds(current?.sessionDeletedReviewIds, envelope.sessionDeletedReviewIds);
  const deletedSessionIds = uniqueReviewIds(current?.deletedSessionIds, envelope.deletedSessionIds);
  const persisted = preparedEnvelope({ ...envelope, sessionDeletedReviewIds, deletedSessionIds }, deletedReviewIds);
  localStorage.setItem(localKey(persisted.deckId), JSON.stringify(persisted));
}

export function mergeProgressEnvelopes(local: DeckProgressEnvelope | null, remote: DeckProgressEnvelope | null) {
  const deletedReviewIds = uniqueReviewIds(local?.deletedReviewIds, local?.pendingDeletedReviewIds, remote?.deletedReviewIds, remote?.pendingDeletedReviewIds);
  const pendingDeletedReviewIds = uniqueReviewIds(local?.pendingDeletedReviewIds, remote?.pendingDeletedReviewIds);
  const sessionDeletedReviewIds = uniqueReviewIds(local?.sessionDeletedReviewIds, remote?.sessionDeletedReviewIds);
  const deletedSessionIds = uniqueReviewIds(local?.deletedSessionIds, remote?.deletedSessionIds);
  const cleanLocal = local ? preparedEnvelope({ ...local, pendingDeletedReviewIds, sessionDeletedReviewIds, deletedSessionIds }, deletedReviewIds) : null;
  const cleanRemote = remote ? preparedEnvelope({ ...remote, pendingDeletedReviewIds, sessionDeletedReviewIds, deletedSessionIds }, deletedReviewIds) : null;
  if (!cleanLocal) return cleanRemote;
  if (!cleanRemote) return cleanLocal;
  const modes = { ...cleanRemote.modes };
  for (const [key, mode] of Object.entries(cleanLocal.modes)) {
    if (!modes[key] || mode.updatedAt > modes[key].updatedAt) modes[key] = mode;
  }
  return preparedEnvelope({ ...cleanRemote, updatedAt: Math.max(cleanLocal.updatedAt, cleanRemote.updatedAt), modes, pendingDeletedReviewIds, sessionDeletedReviewIds, deletedSessionIds }, deletedReviewIds);
}

export async function loadProgressEnvelope(deckId: string, user: User | null) {
  const local = loadLocalEnvelope(deckId); if (!supabase || !user) return { envelope: local, source: "local" as const, syncError: null };
  const { data, error } = await supabase.from("user_deck_states").select("state, updated_at").eq("user_id", user.id).eq("deck_id", deckId).maybeSingle();
  if (error) return { envelope: local, source: "local" as const, syncError: error.message };
  const remote = data?.state as DeckProgressEnvelope | null | undefined, winner = mergeProgressEnvelopes(local, remote ?? null);
  if (winner) {
    saveLocalEnvelope(winner);
    const needsPush = !remote
      || Object.entries(winner.modes).some(([key, mode]) => !remote.modes[key] || mode.updatedAt > remote.modes[key].updatedAt)
      || !sameReviewIds(winner.deletedReviewIds, remote.deletedReviewIds)
      || !sameReviewIds(winner.sessionDeletedReviewIds, remote.sessionDeletedReviewIds)
      || !sameReviewIds(winner.deletedSessionIds, remote.deletedSessionIds)
      || Boolean(winner.pendingDeletedReviewIds?.length);
    if (needsPush) await saveProgressEnvelope(winner, user);
  }
  return { envelope: winner ?? null, source: remote ? "cloud" as const : "local" as const, syncError: null };
}

export async function saveProgressEnvelope(envelope: DeckProgressEnvelope, user: User | null) {
  const current = rawLocalEnvelope(envelope.deckId);
  const pendingDeletedReviewIds = uniqueReviewIds(current?.pendingDeletedReviewIds, envelope.pendingDeletedReviewIds);
  const deletedReviewIds = uniqueReviewIds(current?.deletedReviewIds, current?.pendingDeletedReviewIds, envelope.deletedReviewIds, pendingDeletedReviewIds);
  const sessionDeletedReviewIds = uniqueReviewIds(current?.sessionDeletedReviewIds, envelope.sessionDeletedReviewIds);
  const deletedSessionIds = uniqueReviewIds(current?.deletedSessionIds, envelope.deletedSessionIds);
  const localPersisted = preparedEnvelope({ ...envelope, pendingDeletedReviewIds, sessionDeletedReviewIds, deletedSessionIds }, deletedReviewIds, true);
  localStorage.setItem(localKey(localPersisted.deckId), JSON.stringify(localPersisted));
  if (!supabase || !user) return { cloud: false };

  const cloudPersisted = preparedEnvelope(localPersisted, deletedReviewIds, false);
  const { error } = await supabase.from("user_deck_states").upsert({ user_id: user.id, deck_id: cloudPersisted.deckId, state: cloudPersisted, updated_at: new Date(cloudPersisted.updatedAt).toISOString() }, { onConflict: "user_id,deck_id" });
  if (error) throw error;
  if (pendingDeletedReviewIds.length) {
    await deleteReviewEvents(user, pendingDeletedReviewIds);
    const latest = rawLocalEnvelope(envelope.deckId);
    if (latest) {
      const completed = new Set(pendingDeletedReviewIds);
      const remaining = (latest.pendingDeletedReviewIds ?? []).filter((id) => !completed.has(id));
      const cleaned = preparedEnvelope({ ...latest, pendingDeletedReviewIds: remaining }, deletedReviewIds, true);
      localStorage.setItem(localKey(cleaned.deckId), JSON.stringify(cleaned));
    }
  }
  return { cloud: true };
}

export async function upsertReviewEvent(user: User | null, event: { id: string; deckId: string; studyKey: string; cardId: string; result: ReviewResult; difficulty: ReviewDifficulty; responseTimeMs: number; reviewedAt: number }) { if (!supabase || !user) return; const { error } = await supabase.from("review_events").upsert({ id: event.id, user_id: user.id, deck_id: event.deckId, study_key: event.studyKey, card_id: event.cardId, result: event.result, difficulty: event.difficulty, response_time_ms: event.responseTimeMs, reviewed_at: new Date(event.reviewedAt).toISOString() }); if (error) throw error; }
export async function deleteReviewEvent(user: User | null, reviewId: string) { if (!supabase || !user) return; const { error } = await supabase.from("review_events").delete().eq("id", reviewId); if (error) throw error; }
export async function deleteReviewEvents(user: User | null, reviewIds: string[]) {
  if (!supabase || !user || !reviewIds.length) return;
  const uniqueIds = [...new Set(reviewIds)];
  for (let index = 0; index < uniqueIds.length; index += 200) {
    const batch = uniqueIds.slice(index, index + 200);
    const { error } = await supabase.from("review_events").delete().eq("user_id", user.id).in("id", batch);
    if (error) throw error;
  }
}
export function replaceLocalEnvelope(envelope: DeckProgressEnvelope) { saveLocalEnvelope(envelope); }