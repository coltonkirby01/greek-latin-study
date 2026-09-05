import type { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import type { DeckProgressEnvelope, ReviewDifficulty, ReviewResult } from "./types";

const localKey = (deckId: string) => `greek-latin-study:deck:${deckId}:v2`;
function safeParse(raw: string | null) { try { return raw ? JSON.parse(raw) as DeckProgressEnvelope : null; } catch { return null; } }
function persistableEnvelope(envelope: DeckProgressEnvelope): DeckProgressEnvelope { const { pendingDeletedReviewIds: _pending, ...persisted } = envelope; return persisted; }
export function loadLocalEnvelope(deckId: string) { return safeParse(localStorage.getItem(localKey(deckId))); }
export function saveLocalEnvelope(envelope: DeckProgressEnvelope) { const persisted = persistableEnvelope(envelope); localStorage.setItem(localKey(persisted.deckId), JSON.stringify(persisted)); }
export function mergeProgressEnvelopes(local: DeckProgressEnvelope | null, remote: DeckProgressEnvelope | null) {
  if (!local) return remote;
  if (!remote) return local;
  const modes = { ...remote.modes };
  for (const [key, mode] of Object.entries(local.modes)) {
    if (!modes[key] || mode.updatedAt > modes[key].updatedAt) modes[key] = mode;
  }
  return { ...remote, updatedAt: Math.max(local.updatedAt, remote.updatedAt), modes } satisfies DeckProgressEnvelope;
}
export async function loadProgressEnvelope(deckId: string, user: User | null) {
  const local = loadLocalEnvelope(deckId); if (!supabase || !user) return { envelope: local, source: "local" as const, syncError: null };
  const { data, error } = await supabase.from("user_deck_states").select("state, updated_at").eq("user_id", user.id).eq("deck_id", deckId).maybeSingle();
  if (error) return { envelope: local, source: "local" as const, syncError: error.message };
  const remote = data?.state as DeckProgressEnvelope | null | undefined, winner = mergeProgressEnvelopes(local, remote ?? null);
  if (winner) {
    saveLocalEnvelope(winner);
    const needsPush = !remote || Object.entries(winner.modes).some(([key, mode]) => !remote.modes[key] || mode.updatedAt > remote.modes[key].updatedAt);
    if (needsPush) await saveProgressEnvelope(winner, user);
  }
  return { envelope: winner ?? null, source: remote ? "cloud" as const : "local" as const, syncError: null };
}
export async function saveProgressEnvelope(envelope: DeckProgressEnvelope, user: User | null) {
  const pendingDeletedReviewIds = [...new Set(envelope.pendingDeletedReviewIds ?? [])];
  const persisted = persistableEnvelope(envelope);
  saveLocalEnvelope(persisted);
  if (!supabase || !user) return { cloud: false };
  const { error } = await supabase.from("user_deck_states").upsert({ user_id: user.id, deck_id: persisted.deckId, state: persisted, updated_at: new Date(persisted.updatedAt).toISOString() }, { onConflict: "user_id,deck_id" });
  if (error) throw error;
  if (pendingDeletedReviewIds.length) await deleteReviewEvents(user, pendingDeletedReviewIds);
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
