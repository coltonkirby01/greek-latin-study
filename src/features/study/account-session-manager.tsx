import type { User } from "@supabase/supabase-js";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { deleteReviewEvents, loadProgressEnvelope, saveProgressEnvelope } from "./progress-repository";
import { collectManagedSessions, deleteSessionFromEnvelope, displayManagedSessionName, renameSessionInEnvelope, type ManagedSession } from "./session-management";
import type { DeckProgressEnvelope } from "./types";
import "./session-manager.css";

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

export function SessionManager({ user, onChanged }: { user: User | null; onChanged?: () => void }) {
  const [envelopes, setEnvelopes] = useState<Record<string, DeckProgressEnvelope | null>>({});
  const [loading, setLoading] = useState(true);
  const [busySessionId, setBusySessionId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void Promise.all(managedDeckIds.map(async (deckId) => [deckId, await loadProgressEnvelope(deckId, user)] as const)).then((loaded) => {
      if (!active) return;
      setEnvelopes(Object.fromEntries(loaded.map(([deckId, result]) => [deckId, result.envelope])) as Record<string, DeckProgressEnvelope | null>);
      setLoading(false);
    }).catch((reason) => {
      if (!active) return;
      setError(reason instanceof Error ? reason.message : String(reason));
      setLoading(false);
    });
    return () => { active = false; };
  }, [user?.id]);

  const sessions = useMemo(() => collectManagedSessions(envelopes), [envelopes]);

  function beginRename(session: ManagedSession) {
    setEditingSessionId(session.id);
    setDraftName(displayManagedSessionName(session));
    setError(null);
    setMessage(null);
  }

  function cancelRename() {
    setEditingSessionId(null);
    setDraftName("");
  }

  async function saveName(session: ManagedSession) {
    const name = draftName.trim();
    if (!name) { setError("Session names cannot be blank."); return; }
    if (name === displayManagedSessionName(session)) { cancelRename(); return; }
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
      setEditingSessionId(null);
      setDraftName("");
      setMessage(`Renamed session to “${name}”.`);
      onChanged?.();
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusySessionId(null); }
  }

  async function deleteSession(session: ManagedSession) {
    const name = displayManagedSessionName(session);
    const confirmed = window.confirm(`Delete “${name}” permanently?\n\nThis removes ${session.reviews} review${session.reviews === 1 ? "" : "s"} from your history. Your proficiency and session statistics may decrease. Already-unlocked Dickinson vocabulary will stay unlocked.`);
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
      setMessage(`Deleted “${name}”.`);
      onChanged?.();
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusySessionId(null); }
  }

  return <section className="panel-surface stats-session-manager" aria-labelledby="session-management-title">
    <div className="stats-session-manager-heading">
      <div><p className="eyebrow">Session management</p><h2 id="session-management-title">Your sessions</h2><p>Double-click a session name to rename it. A custom name replaces the automatic name everywhere.</p></div>
    </div>
    {message && <div className="success-alert">{message}</div>}
    {error && <div className="inline-alert">{error}</div>}
    {loading ? <p className="form-help">Loading sessions…</p> : sessions.length ? <div className="stats-managed-session-list">
      {sessions.map((session) => {
        const busy = busySessionId === session.id;
        const editing = editingSessionId === session.id;
        const custom = Boolean(session.name?.trim());
        return <article className="stats-managed-session-row" key={session.id}>
          <div className="stats-managed-session-copy">
            <span className="eyebrow">{session.language}</span>
            {editing ? <div className="stats-session-inline-editor">
              <input autoFocus value={draftName} maxLength={80} aria-label="Session name" onFocus={(event) => event.currentTarget.select()} onChange={(event) => setDraftName(event.target.value)} onKeyDown={(event) => {
                if (event.key === "Enter") { event.preventDefault(); void saveName(session); }
                if (event.key === "Escape") { event.preventDefault(); cancelRename(); }
              }} />
              <button className="icon-button" type="button" title="Save name" aria-label="Save name" disabled={busy || !draftName.trim()} onClick={() => void saveName(session)}><Check /></button>
              <button className="icon-button" type="button" title="Cancel rename" aria-label="Cancel rename" onClick={cancelRename}><X /></button>
            </div> : <button className="stats-session-name-button" type="button" title="Double-click to rename" onDoubleClick={() => beginRename(session)}><strong>{displayManagedSessionName(session)}</strong><Pencil aria-hidden="true" /></button>}
            <small>{session.language} · {sessionDateFormatter.format(session.startedAt)} · {session.reviews} review{session.reviews === 1 ? "" : "s"}{custom ? "" : ` · ${session.sources.join(" + ")}`}</small>
          </div>
          <div className="stats-managed-session-actions">
            <Link className="small-outline-button" to={continueHref(session)}>Continue</Link>
            <button className="small-outline-button stats-delete-session" type="button" disabled={busy} onClick={() => void deleteSession(session)}><Trash2 aria-hidden="true" /> Delete</button>
          </div>
        </article>;
      })}
    </div> : <p className="form-help">No ranked study sessions yet. Complete a review in Greek or Latin to create one.</p>}
  </section>;
}
