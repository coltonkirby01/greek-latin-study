import fs from "node:fs";

function patch(path, transform) {
  const before = fs.readFileSync(path, "utf8");
  const after = transform(before);
  if (after === before) throw new Error(`No changes made to ${path}`);
  fs.writeFileSync(path, after);
}

patch("src/styles.css", (text) => {
  const oldRule = ".compact-select-label select, .henle-format-bar select, .henle-format-bar input { min-height: 40px; padding: 0.45rem 2rem 0.45rem 0.7rem; border: 1px solid var(--border); border-radius: 999px; color: var(--foreground); background: var(--panel-2); }";
  if (!text.includes(oldRule)) throw new Error("Compact select rule not found");
  const newRule = `.compact-select-label {
  position: relative;
  display: inline-flex;
  align-items: center;
  min-width: 0;
}
.compact-select-label::after {
  content: "";
  position: absolute;
  right: 0.95rem;
  width: 0.42rem;
  height: 0.42rem;
  border-right: 2px solid var(--ink-soft);
  border-bottom: 2px solid var(--ink-soft);
  transform: translateY(-18%) rotate(45deg);
  pointer-events: none;
}
.compact-select-label:has(select:disabled)::after { opacity: 0.45; }
.compact-select-label select {
  min-height: 40px;
  max-width: min(25rem, 46vw);
  padding: 0.45rem 2.75rem 0.45rem 0.8rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--foreground);
  background: var(--panel-2);
  appearance: none;
  -webkit-appearance: none;
  cursor: pointer;
}
.compact-select-label select:disabled { cursor: default; opacity: 0.65; }
.henle-format-bar select, .henle-format-bar input { min-height: 40px; padding: 0.45rem 2rem 0.45rem 0.7rem; border: 1px solid var(--border); border-radius: 999px; color: var(--foreground); background: var(--panel-2); }`;
  let next = text.replace(oldRule, newRule);
  const mobileNeedle = "  .study-toolbar {\n    align-items: flex-start;\n    flex-direction: column;\n  }";
  if (!next.includes(mobileNeedle)) throw new Error("Study toolbar mobile rule not found");
  next = next.replace(mobileNeedle, `${mobileNeedle}\n\n  .toolbar-control-group,\n  .compact-select-label,\n  .compact-select-label select {\n    width: 100%;\n    max-width: none;\n  }`);
  return next;
});

patch("src/pages/stats-page.css", (text) => {
  const oldRule = `.stats-recent-section {
  display: grid;
  gap: 1rem;
}`;
  if (!text.includes(oldRule)) throw new Error("Recent section rule not found");
  return text.replace(oldRule, `.stats-recent-section {
  position: relative;
  margin-top: 1.25rem;
  padding: 1.35rem;
  display: grid;
  gap: 1rem;
  border-top: 4px solid var(--burgundy);
  border-color: color-mix(in srgb, var(--burgundy) 36%, var(--line));
  border-top-color: var(--burgundy);
  background: color-mix(in srgb, var(--panel) 88%, var(--accent));
  box-shadow: 0 18px 44px color-mix(in srgb, var(--burgundy) 8%, transparent);
}

.stats-recent-section .stats-section-heading {
  padding-bottom: 0.95rem;
  border-bottom: 1px solid color-mix(in srgb, var(--burgundy) 24%, var(--line));
}

.stats-recent-section .stats-section-heading h2 {
  font-family: var(--font-serif);
  font-size: clamp(1.45rem, 2.4vw, 1.9rem);
}

.stats-recent-section .stats-section-heading > svg {
  width: 1.35rem;
  height: 1.35rem;
  color: var(--burgundy);
}`);
});

patch("AGENTS.md", (text) => {
  const statsNeedle = "- Session management belongs directly inside Stats > Choose sessions; do not add a separate session-management card/panel. Double-click an explicit session name there for Finder/Explorer-style inline renaming, and keep Delete in the same row.";
  if (!text.includes(statsNeedle)) throw new Error("Stats session invariant not found");
  let next = text.replace(statsNeedle, `${statsNeedle}\n- Legacy/inferred session buckets created from pre-session-ID review history must also be renameable and deletable from Stats > Choose sessions. Their storage origin (local or cloud) must not make them unmanageable.`);
  const recentNeedle = "- Stats include lightweight trend graphs for session score and active recall time over time. Avoid large charting dependencies when simple native/SVG rendering is sufficient.";
  if (!next.includes(recentNeedle)) throw new Error("Stats trend invariant not found");
  next = next.replace(recentNeedle, `${recentNeedle}\n- Recent Reviews is a combined Greek + Latin activity feed, visually separated from both language-specific Stats sections.`);
  const toolbarNeedle = "- Both Greek and Latin study toolbars expose one compact Session dropdown in the control position previously used by the standalone New session button. That menu lets the user keep the current session, start a new session, or select a resumable past session.";
  if (!next.includes(toolbarNeedle)) throw new Error("Toolbar session invariant not found");
  return next.replace(toolbarNeedle, `${toolbarNeedle}\n- Toolbar select controls (including Adaptive/Sequential and Session) use a clean, fully visible dropdown indicator with enough right-side padding; never let the arrow crowd or clip against the rounded edge.`);
});
