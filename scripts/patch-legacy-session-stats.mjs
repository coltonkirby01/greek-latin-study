import fs from "node:fs";

const path = "src/pages/stats-page.tsx";
let text = fs.readFileSync(path, "utf8");
function replaceOnce(oldValue, newValue, label) {
  if (!text.includes(oldValue)) throw new Error(`Missing expected text: ${label}`);
  text = text.replace(oldValue, newValue);
}

replaceOnce(
  'import { deleteSessionFromEnvelope, renameSessionInEnvelope, sessionCustomNameFromReviews } from "../features/study/session-management";',
  'import { deleteReviewsFromStatsInEnvelope, deleteSessionFromEnvelope, renameReviewsInEnvelope, renameSessionInEnvelope, sessionCustomNameFromReviews } from "../features/study/session-management";',
  "session management imports",
);

replaceOnce(
`  function beginRename(session: SessionSummary) {
    if (session.inferred) return;
    setEditingSessionId(session.id);
    setDraftName(session.name);
    setActionError(null);
  }
  async function saveRename(session: SessionSummary) {
    const name = draftName.trim();
    if (!name || session.inferred) { setEditingSessionId(null); return; }
    if (name === session.name) { setEditingSessionId(null); return; }
    setBusySessionId(session.id); setActionError(null);
    try {
      const saves: Promise<unknown>[] = [];
      for (const envelope of Object.values(loadedValue.envelopes)) {
        if (!envelope) continue;
        const mutation = renameSessionInEnvelope(envelope, session.id, name);
        if (mutation.changed) saves.push(saveProgressEnvelope(mutation.envelope, user));
      }
      await Promise.all(saves);
      setEditingSessionId(null); setDraftName(""); setRevision((current) => current + 1);
    } catch (reason) { setActionError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusySessionId(null); }
  }
  async function deleteSession(session: SessionSummary) {
    if (session.inferred) return;
    const confirmed = window.confirm(\`Delete “\${session.name}” from session history?\\n\\nIts reviews will be removed from Stats and session history only. Card mastery, difficulty, strength, due dates, adaptive priorities, response-time memory, and Dickinson unlock progress will not change.\`);
    if (!confirmed) return;
    setBusySessionId(session.id); setActionError(null);
    try {
      const saves: Promise<unknown>[] = [];
      for (const envelope of Object.values(loadedValue.envelopes)) {
        if (!envelope) continue;
        const mutation = deleteSessionFromEnvelope(envelope, session.id);
        if (mutation.changed) saves.push(saveProgressEnvelope(mutation.envelope, user));
      }
      await Promise.all(saves);
      setSelectedSessions((current) => current === null ? null : new Set([...current].filter((id) => id !== session.id)));
      if (editingSessionId === session.id) { setEditingSessionId(null); setDraftName(""); }
      setRevision((current) => current + 1);
    } catch (reason) { setActionError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusySessionId(null); }
  }`,
`  function reviewIdsForSession(sessionId: string) {
    return loadedValue.events.filter((event) => event.scopeSessionId === sessionId).map((event) => event.reviewId);
  }
  function beginRename(session: SessionSummary) {
    setEditingSessionId(session.id);
    setDraftName(session.name);
    setActionError(null);
  }
  async function saveRename(session: SessionSummary) {
    const name = draftName.trim();
    if (!name) { setEditingSessionId(null); return; }
    if (name === session.name) { setEditingSessionId(null); return; }
    const reviewIds = session.inferred ? reviewIdsForSession(session.id) : [];
    setBusySessionId(session.id); setActionError(null);
    try {
      const saves: Promise<unknown>[] = [];
      for (const envelope of Object.values(loadedValue.envelopes)) {
        if (!envelope) continue;
        const mutation = session.inferred
          ? renameReviewsInEnvelope(envelope, reviewIds, name)
          : renameSessionInEnvelope(envelope, session.id, name);
        if (mutation.changed) saves.push(saveProgressEnvelope(mutation.envelope, user));
      }
      await Promise.all(saves);
      setEditingSessionId(null); setDraftName(""); setRevision((current) => current + 1);
    } catch (reason) { setActionError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusySessionId(null); }
  }
  async function deleteSession(session: SessionSummary) {
    const reviewIds = session.inferred ? reviewIdsForSession(session.id) : [];
    const confirmed = window.confirm(\`Delete “\${session.name}” from session history?\\n\\nIts reviews will be removed from Stats and session history only. Card mastery, difficulty, strength, due dates, adaptive priorities, response-time memory, and Dickinson unlock progress will not change.\`);
    if (!confirmed) return;
    setBusySessionId(session.id); setActionError(null);
    try {
      const saves: Promise<unknown>[] = [];
      for (const envelope of Object.values(loadedValue.envelopes)) {
        if (!envelope) continue;
        const mutation = session.inferred
          ? deleteReviewsFromStatsInEnvelope(envelope, reviewIds)
          : deleteSessionFromEnvelope(envelope, session.id);
        if (mutation.changed) saves.push(saveProgressEnvelope(mutation.envelope, user));
      }
      await Promise.all(saves);
      setSelectedSessions((current) => current === null ? null : new Set([...current].filter((id) => id !== session.id)));
      if (editingSessionId === session.id) { setEditingSessionId(null); setDraftName(""); }
      setRevision((current) => current + 1);
    } catch (reason) { setActionError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusySessionId(null); }
  }`,
  "legacy session handlers",
);

replaceOnce(
`            {editing ? <input autoFocus value={draftName} maxLength={80} aria-label="Session name" disabled={busy} style={{ margin: 0, width: "100%", minWidth: 0, padding: "0.25rem 0.4rem", border: "1px solid var(--line)", borderRadius: "6px", background: "var(--surface)", color: "var(--foreground)", font: "inherit", fontWeight: 700 }} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setDraftName(event.target.value)} onBlur={() => void saveRename(session)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); } if (event.key === "Escape") { event.preventDefault(); setEditingSessionId(null); setDraftName(""); } }} /> : session.inferred ? <strong>{sessionName(session)}</strong> : <strong role="button" tabIndex={0} title="Double-click to rename" onDoubleClick={() => beginRename(session)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === "F2") beginRename(session); }}>{sessionName(session)}</strong>}
            <small>{session.language} · {dateTime(session.startedAt)} · {session.reviews} reviews · score {session.score.toFixed(1)}</small>
          </div>
          <div className="stats-filter-actions"><button className="text-button" type="button" onClick={() => setSelectedSessions(new Set([session.id]))}>Only</button>{!session.inferred && <button className="text-button" type="button" disabled={busy} onClick={() => void deleteSession(session)}>Delete</button>}</div>`,
`            {editing ? <input autoFocus value={draftName} maxLength={80} aria-label="Session name" disabled={busy} style={{ margin: 0, width: "100%", minWidth: 0, padding: "0.25rem 0.4rem", border: "1px solid var(--line)", borderRadius: "6px", background: "var(--surface)", color: "var(--foreground)", font: "inherit", fontWeight: 700 }} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setDraftName(event.target.value)} onBlur={() => void saveRename(session)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); } if (event.key === "Escape") { event.preventDefault(); setEditingSessionId(null); setDraftName(""); } }} /> : <strong role="button" tabIndex={0} title="Double-click to rename" onDoubleClick={() => beginRename(session)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === "F2") beginRename(session); }}>{sessionName(session)}</strong>}
            <small>{session.language} · {dateTime(session.startedAt)} · {session.reviews} reviews · score {session.score.toFixed(1)}{session.inferred ? " · imported legacy history" : ""}</small>
          </div>
          <div className="stats-filter-actions"><button className="text-button" type="button" onClick={() => setSelectedSessions(new Set([session.id]))}>Only</button><button className="text-button" type="button" disabled={busy} onClick={() => void deleteSession(session)}>Delete</button></div>`,
  "legacy picker controls",
);

replaceOnce(
`    <section className="panel-surface stats-recent-section">
      <div className="stats-section-heading"><div><p className="eyebrow">Latest activity</p><h2>Recent reviews</h2></div><Clock3 aria-hidden="true" /></div>`,
`    <section className="panel-surface stats-recent-section">
      <div className="stats-section-heading"><div><p className="eyebrow">Combined review history</p><h2>Recent reviews</h2><p>This is a separate cross-language activity feed combining Greek and Latin reviews.</p></div><Clock3 aria-hidden="true" /></div>`,
  "recent review heading",
);

fs.writeFileSync(path, text);
