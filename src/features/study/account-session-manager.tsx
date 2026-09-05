import type { User } from "@supabase/supabase-js";
import { Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { deleteReviewEvents, loadProgressEnvelope, saveProgressEnvelope } from "./progress-repository";
import { collectManagedSessions, deleteSessionFromEnvelope, displayManagedSessionName, renameSessionInEnvelope, type ManagedSession } from "./session-management";
import type { DeckProgressEnvelope } from "./types";

const managedDeckIds = [
  "greek-i",
  "alpha-omega-lesson3-vocab",
  "alpha-omega-lesson3-grammar",
  "dickinson-latin-core",
  "henle-part1-forms",
] as const;

const sessionDateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

function continueHref(session: ManagedSession) {
  const base = session.language === "Greek" ? "/greek" : "/latin";
  const query = new URLSearchParams({ session: session.id, sessionStartedAt: String(session.startedAt) });
  return `${base}?${query.toString()}`;
}

export function AccountSessionManager({ user }: { user: User }) {
  const [envelopes, setEnvelopes] = useState<Record<string, DeckProgressEnvelope | null>>({});
  const [draftNames, setDraftNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busySessionId, setBusySessionId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void Promise.all(managedDeckIds.map(async (deckId) => [deckId, await loadProgressEnvelope(deckId, user)] as const)).then((loaded) => {
      if (!active) return;
      const next = Object.fromEntries(loaded.map(([deckId, result]) => [deckId, result.envelope])) as Record<string, DeckProgressEnvelope | null>;
      setEnvelopes(next);
      const sessions = collectManagedSessions(next);
      setDraftNames(Object.fromEntries(sessions.map((session) => [session.id, displayManagedSessionName(session)])));
      setLoading(false);
    }).catch((reason) => {
      if (!active) return;
      setError(reason instanceof Error ? reason.message : String(reason));
      setLoading(false);
    });
    return () => { active = false; };
  }, [user]);

  const sessions = useMemo(() => collectManagedSessions(envelopes), [envelopes]);

  async function saveName(session: ManagedSession) {
    const name = (draftNames[session.id] ?? "").trim();
    if (!name) { setError("Session names cannot be blank."); return; }
    setBusySessionId(session.id); setError(null); setMessage(null);
    try {
      const nextEnvelopes = { ...envelopes };
      const saves: Promise<unknown>[] = [];
      for (const [deckId, envelope] of Object.entries(envelopes)) {
        if (!envelope) continue;
        const mutation = renameSessionInEnvelope(envelope, session.id, name);
        if (!mutation.changed) continue;
        nextEnvelopes[deckId] = mutation.envelope;
        saves.push(saveProgressEnvelope(mutation.envelope, user));
      }
      await Promise.all(saves);
      setEnvelopes(nextEnvelopes);
      setMessage(`Renamed session to “${name}”.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusySessionId(null); }
  }

  async function deleteSession(session: ManagedSession) {
    const name = displayManagedSessionName(session);
    const confirmed = window.confirm(`Delete “${name}” permanently?\n\nThis removes ${session.reviews} review${session.reviews === 1 ? "" : "s"} from your history. Your proficiency and session statistics may decrease, and affected cards will be recalculated from the reviews that remain. Already-unlocked Dickinson vocabulary will stay unlocked.`);
    if (!confirmed) return;
    setBusySessionId(session.id); setError(null); setMessage(null);
    try {
      const nextEnvelopes = { ...envelopes };
      const saves: Promise<unknown>[] = [];
      const reviewIds: string[] = [];
      for (const [deckId, envelope] of Object.entries(envelopes)) {
        if (!envelope) continue;
        const mutation = deleteSessionFromEnvelope(envelope, session.id);
        if (!mutation.changed) continue;
        nextEnvelopes[deckId] = mutation.envelope;
        reviewIds.push(...mutation.reviewIds);
        saves.push(saveProgressEnvelope(mutation.envelope, user));
      }
      await Promise.all(saves);
      await deleteReviewEvents(user, reviewIds);
      setEnvelopes(nextEnvelopes);
      setDraftNames((current) => { const next = { ...current }; delete next[session.id]; return next; });
      setMessage(`Deleted “${name}” and ${reviewIds.length} saved review${reviewIds.length === 1 ? "" : "s"}.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusySessionId(null); }
  }

  return <section className="account-activity panel-surface account-session-manager">
    <p className="eyebrow">Session management</p>
    <h2>Rename, continue, or delete study sessions</h2>
    <p className="form-help">Session names appear in Greek, Latin, and Stats. Deleting a session permanently removes those reviews from your history and can lower your proficiency score. It does not re-lock Dickinson vocabulary you already reached.</p>
    {message && <div className="success-alert">{message}</div>}
    {error && <div className="inline-alert">{error}</div>}
    {loading ? <p className="form-help">Loading sessions…</p> : sessions.length ? <div className="account-session-list">
      {sessions.map((session) => {
        const currentName = displayManagedSessionName(session);
        const draftName = draftNames[session.id] ?? currentName;
        const busy = busySessionId === session.id;
        return <article className="account-session-row" key={session.id}>
          <div className="account-session-copy">
            <span className="eyebrow">{session.language}</span>
            <strong>{currentName}</strong>
            <small>{session.sources.join(" + ")} · {sessionDateFormatter.format(session.startedAt)} · {session.reviews} review{session.reviews === 1 ? "" : "s"}</small>
          </div>
          <div className="auth-form account-session-name-field"><label><span>Custom session name</span><input value={draftName} maxLength={80} onChange={(event) => setDraftNames((current) => ({ ...current, [session.id]: event.target.value }))} /></label></div>
          <div className="account-session-actions">
            <button className="secondary-button" type="button" disabled={busy || !draftName.trim() || draftName.trim() === currentName} onClick={() => void saveName(session)}>{busy ? "Saving…" : "Save name"}</button>
            <Link className="secondary-button" to={continueHref(session)}>Continue</Link>
            <button className="secondary-button account-delete-session" type="button" disabled={busy} onClick={() => void deleteSession(session)}><Trash2 aria-hidden="true" /> Delete</button>
          </div>
        </article>;
      })}
    </div> : <p className="form-help">No ranked study sessions yet. Complete a review in Greek or Latin to create one.</p>}
  </section>;
}
