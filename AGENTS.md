# Greek & Latin Study — permanent repository instructions

Treat the repository root as authoritative. Do not edit the retired `greek-latin-study-github/` implementation if it appears in old commits.

## Core rule

Preserve existing study behavior unless the requested change explicitly modifies it. New features must not silently break, merge, reset, or reinterpret existing decks, statistics, mastery, review history, authentication, or synchronization behavior.

## App structure and filtering

- The public study navigation has one Greek app and one Latin app. Do not reintroduce separate Henle, vocabulary, grammar, or Decks apps/pages in the primary navigation.
- `/henle` is a compatibility redirect into `/latin`; Henle grammar is studied inside the Latin app.
- Individual imported/custom deck routes under `/decks/:slug` may remain addressable, but there is no standalone `/decks` library page or Decks navigation item.
- Greek card-type filtering is multi-select: uppercase, lowercase, punctuation, and accent marks can be studied singly or in any combination.
- Greek filtering is organized by lesson: Lesson 1 contains Alphabet and Punctuation; Alphabet expands to independent Uppercase and Lowercase choices. Lesson 2 contains Accent Marks. Keep this hierarchy compact with nested disclosures rather than reverting to a flat category list.
- Latin is a unified study surface. Dickinson vocabulary, Henle individual forms, and Henle whole charts can be selected singly or combined in one study pool.
- Latin grammar filters are hierarchical and composable. Broad sections can be narrowed by verb family, voice, and form/mood (for example Verbs + Active Voice + Indicative).
- Henle Part I grammatical sections are Nouns, Adjectives, Adverbs, Numerals, Pronouns, and Verbs. Do not reduce the Henle selector to verbs only.
- Henle Grammar Forms and Henle Whole Charts each have their own compact nested selection controls and independent filter state, so a user may choose different Part I sections for forms and charts in the same mixed session.
- Filters should narrow the cards presented without erasing or replacing stored study history.
- Changing a study filter or direction must return the session to the Start gate before timing resumes.

## Built-in deck invariants

- Built-in source counts are Greek 55, Dickinson Latin 997, Henle 2,062 unique cards across 331 rules, and 248 whole-chart groups.
- Any deck-data change must update and pass the source-count tests deliberately.
- Preserve spelling, accents, breathing marks, macrons, principal parts, gender, and other source forms unless the task explicitly corrects source data.
- Existing source decks remain independently persisted even when the Latin UI interleaves cards from multiple sources.
- Dickinson's staged introduction remains 100 cards initially and 25 additional cards at a time; filtering or mixing with grammar must not silently expose locked Dickinson cards.

## Study directions and progress

- `studyKey` separates Forward, Reverse, and Henle Whole Charts. Never merge their mastery, statistics, review history, or scheduling state.
- Forward and Reverse are logically separate study directions even when they use the same underlying card.
- Preserve per-direction statistics and scheduling.
- A card's displayed flip/front-back behavior must not collapse the logical distinction between Forward and Reverse.
- Mixed Latin sessions may rank cards from multiple persisted sources together, but each review must save to its original deck and study mode.

## Review and mastery behavior

- Correctness and difficulty are separate inputs and must remain separately recorded.
- Review scheduling should continue to consider correctness, difficulty, response time, recency, strength, and due state as implemented by the study engine.
- Staged decks must preserve their configured unlocking behavior. Do not expose locked cards early.
- Mastered cards continue to recur according to the scheduling system; mastery must not remove them permanently from review.
- Priority lists show prompts only. Never reveal answers in Highest-Priority Review.
- Back restores the pre-review snapshot and reuses the review event ID; it must never count both the original grade and the corrected grade.
- Skip must not be treated as a correct answer or mastery event unless explicitly requested.

## Flashcard timing

- The front timer displays hundredths of a second.
- The timer measures only active time spent viewing the unrevealed front of the current card.
- The timer stops when the answer is revealed.
- Time while the browser tab/window is hidden or unfocused must never count.
- A study session begins behind an explicit Start gate. The timer must remain at rest until the user presses Start or any key.
- If the study tab/window loses focus or becomes hidden while an unrevealed card is active, require the Start gate again on return. Do not automatically resume timing merely because focus/visibility returns.
- The keypress used to dismiss the Start gate must not also reveal, grade, skip, or otherwise act on the card.
- Moving normally from one card to the next within an already active, focused study session does not require a new Start gate.
- Correcting a previous grade must preserve the originally captured response time unless the task explicitly changes that behavior.

## Keyboard and interaction behavior

- Space reveals an unrevealed card after the Start gate has been dismissed.
- Number keys continue to map to result/difficulty controls as shown in the UI.
- Enter saves and advances only when the required grading inputs are complete.
- Do not let global study shortcuts interfere with typing in inputs, textareas, selects, editable regions, or other text-entry controls.
- When adding overlays or dialogs, preserve keyboard accessibility and prevent the activating/dismissing key from leaking through to underlying controls.

## Data persistence and synchronization

- Guest/local progress and signed-in/cloud progress must continue to work according to the existing repository design.
- Do not erase or reset user progress as a side effect of UI or deck changes.
- Review corrections must not create duplicate review events.
- Preserve compatibility with existing stored progress whenever practical; migrations must be deliberate and documented.

## Security and Supabase coordination

- Secrets belong in GitHub/Supabase environment settings, never source or browser code.
- The committed `.env.production` may contain only the Supabase project URL and modern browser-safe publishable key; never add a secret or service-role key.
- Database authorization must remain enforced by Supabase RLS, even when the UI hides an action.
- After changing the Supabase schema, apply a new numbered migration and regenerate `src/lib/database.types.ts` from the deployed project.
- Frontend maintainability/performance work should avoid changing `supabase/**`, auth/database types, environment files, migrations, or cloud-data services unless the task explicitly requires it.

## UI preservation

- Preserve the existing visual language and responsive layout unless redesign is explicitly requested.
- New controls should work in both light and dark themes through the existing CSS variables.
- Do not expose answers in previews, priority lists, metadata, aria-labels, or other hidden/accessibility text where the answer is meant to remain concealed.
- Make the flexibility of Greek and Latin study filters obvious in page/home descriptions; users should not have to discover by accident that categories can be combined.

## Performance

- Keep the initial route lightweight. Prefer route-level lazy loading and feature-scoped CSS over loading all feature code/styles on the homepage.
- Do not eagerly load the 1.18 MB Henle source data when a user opens Latin for vocabulary only. Load Henle only after a grammar source is selected.
- Prefer small, stable shared components over duplicated markup, but avoid abstraction that adds runtime work without reducing maintenance risk.
- Before adding a large dependency, verify that the capability cannot be implemented with existing dependencies or platform APIs.
- The production build enforces a bundle budget in `scripts/check-bundle-size.mjs`: main JavaScript must remain at or below 160 KB gzip and total CSS at or below 12 KB gzip. Do not raise these limits merely to make a change pass; first reduce the added payload or document why a deliberate budget increase is warranted.

## Validation before completion

- Run `npm run check` before proposing or merging code changes.
- Fix TypeScript, test, and production-build failures caused by the change before completion.
- For changes affecting timer, grading, Back, direction separation, staged unlocking, priority answers, filtering, mixed-source study, or source data, explicitly verify those invariants in addition to the general check.
- Prefer focused changes over broad refactors unless a refactor is necessary for correctness.
