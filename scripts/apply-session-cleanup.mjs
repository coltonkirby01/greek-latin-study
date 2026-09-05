import fs from "node:fs";

function read(path) { return fs.readFileSync(path, "utf8"); }
function write(path, content) { fs.writeFileSync(path, content); }
function replaceOrThrow(content, oldValue, newValue, label) {
  if (!content.includes(oldValue)) throw new Error(`Missing expected text: ${label}`);
  return content.replace(oldValue, newValue);
}

// Review records can be hidden from session/stat history without touching adaptive memory.
{
  const path = "src/features/study/types.ts";
  let text = read(path);
  text = replaceOrThrow(
    text,
    "activityKind?: StudyActivityKind }",
    "activityKind?: StudyActivityKind; statsExcluded?: boolean }",
    "ReviewRecord statsExcluded flag",
  );
  write(path, text);
}

// Deleting a session now marks its reviews as excluded from Stats/session history only.
{
  const path = "src/features/study/session-management.ts";
  let text = read(path);
  text = replaceOrThrow(text, "import type { CardProgress, DeckProgressEnvelope, ReviewRecord } from \"./types\";", "import type { DeckProgressEnvelope, ReviewRecord } from \"./types\";", "session-management import");
  text = replaceOrThrow(text, "if (!review.sessionId || review.activityKind === \"warmup\") continue;", "if (!review.sessionId || review.activityKind === \"warmup\" || review.statsExcluded) continue;", "managed session exclusion");
  const tailPattern = /function rebuildProgress[\s\S]*?export function deleteSessionFromEnvelope[\s\S]*?\n}\n$/;
  if (!tailPattern.test(text)) throw new Error("Could not locate old destructive session deletion implementation");
  text = text.replace(tailPattern, `export function deleteSessionFromEnvelope(envelope: DeckProgressEnvelope, sessionId: string, now = Date.now()): SessionMutation {\n  const next = structuredClone(envelope);\n  let changed = false;\n  const reviewIds: string[] = [];\n\n  for (const mode of Object.values(next.modes)) {\n    let modeChanged = false;\n    for (const progress of Object.values(mode.cards)) {\n      progress.history = progress.history.map((review) => {\n        if (review.sessionId !== sessionId || review.activityKind === \"warmup\" || review.statsExcluded) return review;\n        changed = true;\n        modeChanged = true;\n        reviewIds.push(review.id);\n        return { ...review, statsExcluded: true };\n      });\n    }\n    if (modeChanged) mode.updatedAt = Math.max(mode.updatedAt, now);\n  }\n\n  // Card counters, strength, intervals, due dates, response-time memory, review\n  // sequence, mastery, and staged unlocks are intentionally untouched. The\n  // session disappears from history/Stats but remains part of adaptive memory.\n  if (changed) next.updatedAt = Math.max(next.updatedAt, now);\n  return { envelope: next, changed, reviewIds: [...new Set(reviewIds)] };\n}\n`);
  write(path, text);
}

// Study-app session names show exactly one display name, and deleted sessions are not resumable.
{
  const path = "src/features/study/multi-source-study-session.tsx";
  let text = read(path);
  text = replaceOrThrow(text, "type ResumableSession = SessionMeta & { lastReviewedAt: number; reviews: number; sourceLabels: string[] };", "type ResumableSession = SessionMeta & { lastReviewedAt: number; reviews: number; sourceLabels: string[]; nameReviewedAt?: number };", "resumable session name timestamp");
  text = replaceOrThrow(
    text,
    `function sessionLabel(session: ResumableSession, language: string) {\n  const focus = session.sourceLabels.length === 1 ? session.sourceLabels[0] : session.sourceLabels.length ? \"Mixed study\" : \"Study\";\n  const name = session.name?.trim() || \`\${language} · \${focus}\`;\n  return \`\${name} · \${sessionDateFormatter.format(session.startedAt)} · \${session.reviews} review\${session.reviews === 1 ? \"\" : \"s\"}\`;\n}`,
    `function sessionLabel(session: ResumableSession, language: string) {\n  const customName = session.name?.trim();\n  if (customName) return customName;\n  const focus = session.sourceLabels.length === 1 ? session.sourceLabels[0] : session.sourceLabels.length ? \"Mixed study\" : \"Study\";\n  return \`\${language} · \${focus} · \${sessionDateFormatter.format(session.startedAt)}\`;\n}`,
    "single session display name",
  );
  text = replaceOrThrow(text, "if (!review.sessionId || review.activityKind === \"warmup\") continue;", "if (!review.sessionId || review.activityKind === \"warmup\" || review.statsExcluded) continue;", "resumable session exclusion");
  text = replaceOrThrow(text, "if (review.sessionName?.trim()) existing.name = review.sessionName.trim();", "if (review.sessionName?.trim() && review.reviewedAt >= (existing.nameReviewedAt ?? 0)) { existing.name = review.sessionName.trim(); existing.nameReviewedAt = review.reviewedAt; }", "latest resumable custom name");
  text = replaceOrThrow(text, "} else sessions.set(review.sessionId, { id: review.sessionId, startedAt, name: review.sessionName?.trim() || undefined, lastReviewedAt: review.reviewedAt, reviews: 1, sourceLabels: [source.label] });", "} else sessions.set(review.sessionId, { id: review.sessionId, startedAt, name: review.sessionName?.trim() || undefined, nameReviewedAt: review.sessionName?.trim() ? review.reviewedAt : undefined, lastReviewedAt: review.reviewedAt, reviews: 1, sourceLabels: [source.label] });", "initial resumable custom name timestamp");
  text = replaceOrThrow(text, "if (meta.name) existing.name = meta.name;", "if (meta.name) { existing.name = meta.name; existing.nameReviewedAt = reviewedAt; }", "append resumable custom name timestamp");
  text = replaceOrThrow(text, "} else next.push({ ...meta, lastReviewedAt: reviewedAt, reviews: 1, sourceLabels: [sourceLabel] });", "} else next.push({ ...meta, nameReviewedAt: meta.name ? reviewedAt : undefined, lastReviewedAt: reviewedAt, reviews: 1, sourceLabels: [sourceLabel] });", "new resumable custom name timestamp");
  write(path, text);
}

// Put all session management directly into Stats > Choose sessions.
{
  const path = "src/pages/stats-page.tsx";
  let text = read(path);
  text = replaceOrThrow(text, "import { loadProgressEnvelope } from \"../features/study/progress-repository\";", "import { loadProgressEnvelope, saveProgressEnvelope } from \"../features/study/progress-repository\";", "stats progress imports");
  text = replaceOrThrow(text, "import { sessionCustomNameFromReviews } from \"../features/study/session-management\";", "import { deleteSessionFromEnvelope, renameSessionInEnvelope, sessionCustomNameFromReviews } from \"../features/study/session-management\";", "stats session-management imports");
  text = replaceOrThrow(
    text,
    `function cardsForScope(allCards: CardPerformance[], events: ReviewEvent[], allSessions: boolean) {\n  if (allSessions) return allCards;`,
    `function cardsForScope(allCards: CardPerformance[], events: ReviewEvent[]) {`,
    "scope cards from visible review events",
  );
  text = replaceOrThrow(
    text,
    `function summariesForScope(allRows: SourceSummary[], cards: CardPerformance[], allSessions: boolean) {\n  if (allSessions) return allRows;`,
    `function summariesForScope(allRows: SourceSummary[], cards: CardPerformance[]) {`,
    "scope summaries from visible review events",
  );
  text = replaceOrThrow(
    text,
    `  const { user } = useAuth();\n  const [selectedSessions, setSelectedSessions] = useState<Set<string> | null>(null);`,
    `  const { user } = useAuth();\n  const [selectedSessions, setSelectedSessions] = useState<Set<string> | null>(null);\n  const [revision, setRevision] = useState(0);\n  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);\n  const [draftName, setDraftName] = useState(\"\");\n  const [busySessionId, setBusySessionId] = useState<string | null>(null);\n  const [actionError, setActionError] = useState<string | null>(null);`,
    "stats session action state",
  );
  text = replaceOrThrow(
    text,
    `    const rawEvents: ReviewEvent[] = [];\n    for (const card of cards) for (const review of card.progress.history) rawEvents.push({\n      language: card.source.language, source: card.source.source, mode: card.source.mode, sourceKey: sourceKey(card.source), cardKey: cardKey(card.source, card.card), cardId: card.card.id, reviewId: review.id,\n      prompt: card.prompt, reviewedAt: review.reviewedAt, result: review.result, difficulty: review.difficulty, responseTimeMs: review.responseTimeMs, intrinsicDifficulty: card.intrinsicDifficulty, review,\n      sessionId: review.sessionId, sessionStartedAt: review.sessionStartedAt, sessionName: review.sessionName, activityKind: review.activityKind,\n    });`,
    `    const rawEvents: ReviewEvent[] = [];\n    for (const card of cards) for (const review of card.progress.history) {\n      if (review.statsExcluded) continue;\n      rawEvents.push({\n        language: card.source.language, source: card.source.source, mode: card.source.mode, sourceKey: sourceKey(card.source), cardKey: cardKey(card.source, card.card), cardId: card.card.id, reviewId: review.id,\n        prompt: card.prompt, reviewedAt: review.reviewedAt, result: review.result, difficulty: review.difficulty, responseTimeMs: review.responseTimeMs, intrinsicDifficulty: card.intrinsicDifficulty, review,\n        sessionId: review.sessionId, sessionStartedAt: review.sessionStartedAt, sessionName: review.sessionName, activityKind: review.activityKind,\n      });\n    }`,
    "stats hidden review filter",
  );
  text = replaceOrThrow(text, "    return { summaries, cards, sessions, events };\n  }, [user?.id]);", "    return { summaries, cards, sessions, events, envelopes };\n  }, [user?.id, revision]);", "stats reload after session mutation");
  text = replaceOrThrow(text, "const scopedCards = useMemo(() => value ? cardsForScope(value.cards, scopedEvents, allSessionsSelected) : [], [allSessionsSelected, scopedEvents, value]);", "const scopedCards = useMemo(() => value ? cardsForScope(value.cards, scopedEvents) : [], [scopedEvents, value]);", "scoped cards calculation");
  text = replaceOrThrow(text, "const scopedRows = useMemo(() => value ? summariesForScope(value.summaries, scopedCards, allSessionsSelected) : [], [allSessionsSelected, scopedCards, value]);", "const scopedRows = useMemo(() => value ? summariesForScope(value.summaries, scopedCards) : [], [scopedCards, value]);", "scoped rows calculation");
  text = replaceOrThrow(
    text,
    `  function toggleSession(id: string, checked: boolean) {\n    const next = selectedSessions === null ? new Set(sessionIds) : new Set(selectedSessions);\n    if (checked) next.add(id); else next.delete(id);\n    setSelectedSessions(next.size === sessionIds.length ? null : next);\n  }\n\n\n  const greekRows`,
    `  function toggleSession(id: string, checked: boolean) {\n    const next = selectedSessions === null ? new Set(sessionIds) : new Set(selectedSessions);\n    if (checked) next.add(id); else next.delete(id);\n    setSelectedSessions(next.size === sessionIds.length ? null : next);\n  }\n  function beginRename(session: SessionSummary) {\n    if (session.inferred) return;\n    setEditingSessionId(session.id);\n    setDraftName(session.name);\n    setActionError(null);\n  }\n  async function saveRename(session: SessionSummary) {\n    const name = draftName.trim();\n    if (!name || session.inferred) { setEditingSessionId(null); return; }\n    if (name === session.name) { setEditingSessionId(null); return; }\n    setBusySessionId(session.id); setActionError(null);\n    try {\n      const saves: Promise<unknown>[] = [];\n      for (const envelope of Object.values(value.envelopes)) {\n        if (!envelope) continue;\n        const mutation = renameSessionInEnvelope(envelope, session.id, name);\n        if (mutation.changed) saves.push(saveProgressEnvelope(mutation.envelope, user));\n      }\n      await Promise.all(saves);\n      setEditingSessionId(null); setDraftName(\"\"); setRevision((current) => current + 1);\n    } catch (reason) { setActionError(reason instanceof Error ? reason.message : String(reason)); }\n    finally { setBusySessionId(null); }\n  }\n  async function deleteSession(session: SessionSummary) {\n    if (session.inferred) return;\n    const confirmed = window.confirm(\`Delete “\${session.name}” from session history?\\n\\nIts reviews will be removed from Stats and session history only. Card mastery, difficulty, strength, due dates, adaptive priorities, response-time memory, and Dickinson unlock progress will not change.\`);\n    if (!confirmed) return;\n    setBusySessionId(session.id); setActionError(null);\n    try {\n      const saves: Promise<unknown>[] = [];\n      for (const envelope of Object.values(value.envelopes)) {\n        if (!envelope) continue;\n        const mutation = deleteSessionFromEnvelope(envelope, session.id);\n        if (mutation.changed) saves.push(saveProgressEnvelope(mutation.envelope, user));\n      }\n      await Promise.all(saves);\n      setSelectedSessions((current) => current === null ? null : new Set([...current].filter((id) => id !== session.id)));\n      if (editingSessionId === session.id) { setEditingSessionId(null); setDraftName(\"\"); }\n      setRevision((current) => current + 1);\n    } catch (reason) { setActionError(reason instanceof Error ? reason.message : String(reason)); }\n    finally { setBusySessionId(null); }\n  }\n\n  const greekRows`,
    "stats inline rename/delete handlers",
  );
  text = replaceOrThrow(text, "    {error && <div className=\"inline-alert\">{error}</div>}", "    {(error || actionError) && <div className=\"inline-alert\">{actionError || error}</div>}", "stats action error");
  const oldPicker = `      {value.sessions.length ? <div className=\"stats-session-picker\">{[...value.sessions].sort((a, b) => b.startedAt - a.startedAt).map((session) => <div className=\"stats-session-choice\" key={session.id}><label><input type=\"checkbox\" checked={allSessionsSelected || (selectedSessions?.has(session.id) ?? false)} onChange={(event) => toggleSession(session.id, event.target.checked)} /><span><strong>{sessionName(session)}</strong><small>{session.language} · {dateTime(session.startedAt)} · {session.reviews} reviews · score {session.score.toFixed(1)}</small></span></label><button className=\"text-button\" type=\"button\" onClick={() => setSelectedSessions(new Set([session.id]))}>Only</button></div>)}</div> : <p className=\"stats-empty\">Complete reviews to create sessions.</p>}`;
  const newPicker = `      {value.sessions.length ? <div className=\"stats-session-picker\">{[...value.sessions].sort((a, b) => b.startedAt - a.startedAt).map((session) => {\n        const editing = editingSessionId === session.id, busy = busySessionId === session.id;\n        return <div className=\"stats-session-choice\" key={session.id}>\n          <input type=\"checkbox\" aria-label={\`Include \${session.name} in Stats\`} checked={allSessionsSelected || (selectedSessions?.has(session.id) ?? false)} onChange={(event) => toggleSession(session.id, event.target.checked)} />\n          <div style={{ minWidth: 0, flex: \"1 1 auto\", display: \"grid\", gap: \"0.14rem\" }}>\n            {editing ? <input autoFocus value={draftName} maxLength={80} aria-label=\"Session name\" disabled={busy} style={{ margin: 0, width: \"100%\", minWidth: 0, padding: \"0.25rem 0.4rem\", border: \"1px solid var(--line)\", borderRadius: \"6px\", background: \"var(--surface)\", color: \"var(--foreground)\", font: \"inherit\", fontWeight: 700 }} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setDraftName(event.target.value)} onBlur={() => void saveRename(session)} onKeyDown={(event) => { if (event.key === \"Enter\") { event.preventDefault(); event.currentTarget.blur(); } if (event.key === \"Escape\") { event.preventDefault(); setEditingSessionId(null); setDraftName(\"\"); } }} /> : session.inferred ? <strong>{sessionName(session)}</strong> : <strong role=\"button\" tabIndex={0} title=\"Double-click to rename\" onDoubleClick={() => beginRename(session)} onKeyDown={(event) => { if (event.key === \"Enter\" || event.key === \"F2\") beginRename(session); }}>{sessionName(session)}</strong>}\n            <small>{session.language} · {dateTime(session.startedAt)} · {session.reviews} reviews · score {session.score.toFixed(1)}</small>\n          </div>\n          <div className=\"stats-filter-actions\"><button className=\"text-button\" type=\"button\" onClick={() => setSelectedSessions(new Set([session.id]))}>Only</button>{!session.inferred && <button className=\"text-button\" type=\"button\" disabled={busy} onClick={() => void deleteSession(session)}>Delete</button>}</div>\n        </div>;\n      })}</div> : <p className=\"stats-empty\">Complete reviews to create sessions.</p>}`;
  text = replaceOrThrow(text, oldPicker, newPicker, "inline choose-sessions management");
  text = replaceOrThrow(text, "Session names are managed in Account and appear here automatically.", "Double-click a session name under Choose sessions to rename it. Deleting a session changes Stats only, not adaptive study memory.", "session ranking help text");
  text = replaceOrThrow(text, "<Link className=\"small-outline-button\" to=\"/account\">Manage</Link>", "", "remove Stats Manage link");
  write(path, text);
}

// Remove the separate Stats management wrapper and route directly to the lean Stats page.
{
  const path = "src/app.tsx";
  let text = read(path);
  text = replaceOrThrow(text, "const StatsHubPage = lazy(async () => ({ default: (await import(\"./pages/stats-hub-page\")).StatsHubPage }));", "const StatsPage = lazy(async () => ({ default: (await import(\"./pages/stats-page\")).StatsPage }));", "Stats route import");
  text = replaceOrThrow(text, "<Route path=\"stats\" element={<StatsHubPage />} />", "<Route path=\"stats\" element={<StatsPage />} />", "Stats route component");
  write(path, text);
  fs.rmSync("src/pages/stats-hub-page.tsx");
  fs.rmSync("src/features/study/account-session-manager.tsx");
}

// Regression tests: session deletion must not rewrite adaptive memory.
{
  const path = "tests/session-management.test.ts";
  let text = read(path);
  const oldTest = /  it\("deletes only the chosen session, recalculates review stats, and preserves Dickinson unlock progress", \(\) => \{[\s\S]*?\n  \}\);\n\}\);\n$/;
  if (!oldTest.test(text)) throw new Error("Could not locate destructive session-deletion regression test");
  text = text.replace(oldTest, `  it("hides a deleted session from Stats without changing adaptive memory", () => {\n    const before = envelopeWithTwoSessions();\n    const beforeMode = structuredClone(before.modes.forward);\n    const beforeProgress = structuredClone(beforeMode.cards.one);\n    const mutation = deleteSessionFromEnvelope(before, "session-b", 100);\n    const mode = mutation.envelope.modes.forward;\n    const progress = mode.cards.one;\n\n    expect(mutation.reviewIds).toEqual(["r2"]);\n    expect(progress.history).toHaveLength(2);\n    expect(progress.history.find((review) => review.id === "r2")?.statsExcluded).toBe(true);\n    expect(progress.reviews).toBe(beforeProgress.reviews);\n    expect(progress.right).toBe(beforeProgress.right);\n    expect(progress.wrong).toBe(beforeProgress.wrong);\n    expect(progress.easy).toBe(beforeProgress.easy);\n    expect(progress.hard).toBe(beforeProgress.hard);\n    expect(progress.initialMastered).toBe(beforeProgress.initialMastered);\n    expect(progress.strength).toBe(beforeProgress.strength);\n    expect(progress.intervalMs).toBe(beforeProgress.intervalMs);\n    expect(progress.dueAt).toBe(beforeProgress.dueAt);\n    expect(progress.responseTimeTotalMs).toBe(beforeProgress.responseTimeTotalMs);\n    expect(mode.totalReviews).toBe(beforeMode.totalReviews);\n    expect(mode.rightReviews).toBe(beforeMode.rightReviews);\n    expect(mode.wrongReviews).toBe(beforeMode.wrongReviews);\n    expect(mode.reviewSequence).toEqual(beforeMode.reviewSequence);\n    expect(mode.unlockedCount).toBe(150);\n    expect(collectManagedSessions({ "dickinson-latin-core": mutation.envelope }).map((session) => session.id)).toEqual(["session-a"]);\n  });\n});\n`);
  write(path, text);
}

// Make the new session semantics permanent repository guidance.
{
  const path = "AGENTS.md";
  let text = read(path);
  text = replaceOrThrow(
    text,
    "- Normal sessions may also carry a persistent custom session name. Renaming a session changes only its display identity; it must not change its session ID, review membership, mastery, scheduling, ranking data, or long-term memory.",
    "- Normal sessions may also carry a persistent custom session name. Renaming a session changes only its display identity; it must not change its session ID, review membership, mastery, scheduling, ranking data, or long-term memory. Everywhere a custom name exists, show only that custom name; do not append the old automatic/timestamped name.",
    "custom session name display rule",
  );
  text = replaceOrThrow(
    text,
    "- The Stats page provides a multi-select session scope. Users can view all sessions, one session, or any selected combination; the proficiency summaries, card analysis, recent reviews, and trend views must follow the selected scope.\n- Session rows expose clear names, Rename actions, and Continue actions for explicit resumable sessions. Custom session names persist with review history and survive reload/login synchronization.",
    "- The Stats page provides a multi-select session scope. Users can view all sessions, one session, or any selected combination; the proficiency summaries, card analysis, recent reviews, and trend views must follow the selected scope.\n- Session management belongs directly inside Stats > Choose sessions; do not add a separate session-management card/panel. Double-click an explicit session name there for Finder/Explorer-style inline renaming, and keep Delete in the same row.\n- Deleting a session removes it from Stats/session history only. Its reviews remain part of continuous study memory and MUST NOT change card mastery, strength, intervals, due dates, adaptive priority inputs, response-time memory, review sequence, or Dickinson unlock progress. The visible Stats/proficiency calculations should be recomputed from the sessions that remain.\n- Explicit resumable sessions retain Continue actions in the session rankings. Custom session names persist with review history and survive reload/login synchronization.",
    "Stats session management rules",
  );
  write(path, text);
}
