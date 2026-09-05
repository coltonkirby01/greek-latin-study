# Maintenance guide for Codex

Treat the repository root as authoritative. Do not edit the retired `greek-latin-study-github/` implementation if it appears in old commits.

Preserve these invariants:

- Built-in source counts are Greek 55, Dickinson Latin 997, Henle 2,062 unique cards across 331 rules, and 248 whole-chart groups.
- `studyKey` separates Forward, Reverse, and Henle Whole Charts. Never merge their mastery or statistics.
- The front timer shows hundredths, stops on reveal, and pauses when the window or tab is not visible.
- Back restores the pre-review snapshot and reuses the review event ID; it must never count both grades.
- Priority lists show prompts only.
- Secrets belong in GitHub/Supabase environment settings, never source or browser code.
- Database authorization must remain enforced by Supabase RLS, even when the UI hides an action.

Run `npm run check` before proposing or committing changes. Any deck-data change must update and pass the source-count tests deliberately.
