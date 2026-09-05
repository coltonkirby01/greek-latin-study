# Greek & Latin Study — permanent repository instructions

The canonical GitHub repository is `coltonkirby01/greeklatinstudy`; its GitHub Pages base path is `/greeklatinstudy/` unless a custom domain is configured.

Treat the repository root as authoritative. Do not edit the retired `greek-latin-study-github/` implementation if it appears in old commits.

## Core rule

Preserve existing study behavior unless the requested change explicitly modifies it. New features must not silently break, merge, reset, or reinterpret existing decks, statistics, mastery, review history, authentication, synchronization, timing, filtering, or session behavior.

## App structure and filtering

- The primary public navigation is Home, Greek, Latin, Stats, and Reading. Stats is a first-class navigation destination, not something users should have to discover only inside a study page.
- The public study navigation has one Greek app and one Latin app. Do not reintroduce separate Henle, vocabulary, grammar, or Decks apps/pages in the primary navigation.
- `/henle` is a compatibility redirect into `/latin`; Henle grammar is studied inside the Latin app.
- Individual imported/custom deck routes under `/decks/:slug` may remain addressable, but there is no standalone `/decks` library page or Decks navigation item.
- Greek and Latin selectors use a vertical accordion/drop-down hierarchy, not dense side-by-side settings panels.
- Every expandable filter heading has a checkbox visible while the disclosure is closed. That parent checkbox selects or clears everything beneath the heading; users must not have to open a dropdown merely to choose all or none. Partially selected parents show an indeterminate/mixed state.
- Expanding/opening a dropdown is independent from selecting its parent. Users must be able to open an unchecked parent and select one or several child boxes without first selecting the entire parent.
- Selecting a child beneath an unchecked parent activates only the necessary child path, not every sibling in that parent.
- Filters narrow the current study pool only. Deselecting a source or child must never erase or reset stored mastery, history, scheduling, timing, or statistics for those cards.
- Changing a study filter or direction returns the active study surface to the Start gate before timing resumes.

### Greek selector

- Greek has top-level quick selectors for All Vocabulary and All Grammar; narrower lesson selectors remain independently adjustable.
- All Grammar includes Lesson 1 Alphabet and Punctuation, Lesson 2 Accent Marks, and all current Lesson 3 grammar paradigms. The only material currently classified as Greek vocabulary is Lesson 3 Vocabulary.
- Greek filtering is organized by lesson.
- Lesson 1 contains Alphabet and Punctuation. Alphabet expands to independent Uppercase and Lowercase choices. Alphabet and punctuation are Grammar, not vocabulary.
- Lesson 2 contains Accent Marks. Accent marks are Grammar, not vocabulary.
- The only current Greek vocabulary source is Lesson 3 Vocabulary.
- Greek Lesson 3 contains separate Vocabulary and Grammar headings. Lesson 3 Grammar currently contains Present Active Indicative, Present Active Infinitive, and Present Active Imperative from the παιδεύω paradigm.
- Keep Lesson 3 vocabulary progress separate from paradigm/form progress even when both are mixed in one session.
- Greek card types remain multi-select. Lesson material, vocabulary, grammar, punctuation, accents, and future lesson categories may be combined in one adaptive session without merging their stored histories.

### Latin selector

- Latin is a unified study surface. There is exactly one Latin vocabulary source/control: the Dickinson Latin Core Vocabulary. Do not create separate "Latin vocabulary" and "Dickinson vocabulary" boxes for the same source.
- Latin vocabulary, Henle individual forms, and Henle whole charts can be selected singly or combined in one study pool.
- Henle Grammar Forms and Henle Whole Charts each have their own compact vertical dropdown and independent filter state, so a user may choose different Part I sections for forms and charts in the same mixed session.
- Do not put a redundant "Parts of speech" dropdown inside Dickinson Vocabulary or a redundant "Part 1 sections" / "Parts of speech" dropdown inside either Henle source. Once a source is opened, users should reach the meaningful category parents directly.
- Opening a Henle dropdown may load Henle source data, but opening alone must not select the source.
- Latin grammar filters are hierarchical and composable. Broad sections can be narrowed by verb family, voice, and form/mood (for example Verbs + Active Voice + Indicative).
- Henle Part I grammatical sections are Nouns, Adjectives, Adverbs, Numerals, Pronouns, and Verbs. Do not reduce the Henle selector to verbs only.

## Built-in deck invariants

- Built-in source counts are Greek Lessons 1–2: 55 cards; Greek Lesson 3 Vocabulary: 11 cards; Greek Lesson 3 Grammar: 11 form cards; Dickinson Latin: 997; Henle: 2,062 unique cards across 331 rules; Henle Whole Charts: 248 groups.
- Greek Lesson 3 grammar categories are Present Active Indicative, Present Active Infinitive, and Present Active Imperative unless the course source is deliberately expanded.
- Any deck-data change must update and pass the source-count tests deliberately.
- Preserve spelling, accents, breathing marks, macrons, principal parts, gender, and other source forms unless the task explicitly corrects source data.
- Existing source decks remain independently persisted even when Greek or Latin UI sessions interleave cards from multiple sources.
- Dickinson's staged introduction remains 100 cards initially and 25 additional cards at a time; filtering or mixing with grammar must not silently expose locked Dickinson cards.

## Study directions and progress

- `studyKey` separates Forward, Reverse, and Henle Whole Charts. Never merge their mastery, statistics, review history, or scheduling state.
- Forward and Reverse are logically separate study directions even when they use the same underlying card.
- Preserve per-direction statistics and scheduling.
- A card's displayed flip/front-back behavior must not collapse the logical distinction between Forward and Reverse.
- Mixed Greek and Latin sessions may rank cards from multiple persisted sources together, but each review must save to its original deck and study mode.
- Direction and card order (Adaptive/Sequential) remain adjustable while the Start gate is open. Changing them must not start the timer.

## Sessions and warm-ups

- A new study session is a performance window layered on top of continuous long-term mastery. Starting a new session must never reset mastery, due dates, intervals, response-time history, or adaptive priorities.
- Reviews belonging to a normal session carry a stable session ID/start time so sessions can be compared in Stats.
- Normal sessions may also carry a persistent custom session name. Renaming a session changes only its display identity; it must not change its session ID, review membership, mastery, scheduling, ranking data, or long-term memory. Everywhere a custom name exists, show only that custom name; do not append the old automatic/timestamped name.
- Sessions without custom names receive useful automatic names based on language, source/focus, and date/time rather than opaque IDs or purely generic labels.
- Users can deliberately continue a past ranked session. Continuing reuses that session's original ID, start time, and custom name when present, while card selection still uses the user's current long-term mastery, due state, speed, accuracy, and adaptive priorities.
- Both Greek and Latin study toolbars expose one compact Session dropdown in the control position previously used by the standalone New session button. That menu lets the user keep the current session, start a new session, or select a resumable past session.
- Do not reintroduce a separate New session button beside the Session dropdown unless explicitly requested; starting a new session belongs in that menu.
- The Stats session table also provides an explicit Continue action for resumable non-legacy sessions, so users can resume either from Stats or directly inside Greek/Latin.
- A resumed session can use the user's current filter selection; resuming must not restore or overwrite old filter state unless explicitly requested.
- The Start gate offers a Personalized Warm-up. The default warm-up contains 5 reviewed cards.
- Warm-up selection is adaptive/personalized and should favor due, slow, difficult, recently missed, or otherwise high-priority cards from the currently selected material.
- Warm-up reviews DO update the continuous long-term memory bank and scheduling because they are real recall practice.
- Warm-up reviews are tagged separately and MUST NOT inflate or distort ranked main-session scores.
- After the warm-up completes, return to the Start gate and create a fresh ranked session window.

## Review and mastery behavior

- Correctness and difficulty are separate inputs and must remain separately recorded.
- Review scheduling continues to consider correctness, difficulty, response time, recency, strength, and due state as implemented by the study engine.
- Staged decks preserve their configured unlocking behavior. Do not expose locked cards early.
- Mastered cards continue to recur according to the scheduling system; mastery must not remove them permanently from review.
- Priority lists show prompts only. Never reveal answers in Highest-Priority Review.
- Back restores the pre-review snapshot and reuses the review event ID; it must never count both the original grade and the corrected grade.
- Back preserves the original response time and the review's session/warm-up classification unless explicitly changed.
- Skip must not be treated as a correct answer or mastery event unless explicitly requested.

## Flashcard timing

- The front timer displays hundredths of a second.
- The timer measures only active time spent viewing the unrevealed front of the current card.
- The timer stops when the answer is revealed.
- Time while the browser tab/window is hidden or unfocused must never count.
- A study session begins behind an explicit Start gate. The timer remains at rest until the user presses Start or a non-control key.
- The Start gate also has an explicit Pause/Start-gate path available without leaving the browser tab.
- If the study tab/window loses focus or becomes hidden while an unrevealed card is active, require the Start gate again on return. Do not automatically resume timing merely because focus/visibility returns.
- The keypress used to dismiss the Start gate must not also reveal, grade, skip, save, or otherwise act on the card.
- Toolbar controls and Start-gate buttons retain normal keyboard behavior while the gate is open; interacting with them must not be misinterpreted as the global "press any key to start" gesture.
- Moving normally from one card to the next within an already active, focused study session does not require a new Start gate.
- Correcting a previous grade preserves the originally captured response time unless the task explicitly changes that behavior.
- After Reveal, flipping back to the question side and then to the answer side does not restart or add time to the timer.

## Keyboard and interaction behavior

- Space reveals an unrevealed card after the Start gate has been dismissed.
- After reveal, R = Right and W = Wrong.
- After reveal, 1 = Easy, 2 = Medium, and 3 = Hard.
- After reveal, Enter flips between question and answer without saving and without adding response time.
- After both correctness and difficulty are selected, Space = Save & Next.
- Do not let global study shortcuts interfere with typing in inputs, textareas, selects, editable regions, listboxes, toolbar controls, or Start-gate controls.
- When adding overlays or dialogs, preserve keyboard accessibility and prevent the activating/dismissing key from leaking through to underlying controls.

## Continuous memory and synchronization

- Each user has a continuous Greek and Latin memory bank across sessions and logins.
- Deselecting a source, lesson, part of speech, grammar category, direction, or other filter must never delete that source's stored progress.
- Guest/local progress and signed-in/cloud progress continue to work according to the existing repository design.
- Do not erase or reset user progress as a side effect of UI or deck changes.
- Review corrections must not create duplicate review events.
- Preserve compatibility with existing stored progress whenever practical; migrations must be deliberate and documented.

## Stats, intrinsic difficulty, and proficiency score

- `/stats` is one unified Stats page covering both Greek and Latin and appears in the primary navigation. Greek and Latin study pages may also link to it.
- Stats text must remain legible in both light and dark themes. Use foreground/muted-foreground text variables for text; do not use a background fill token such as `--muted` as a text color.
- Stats include per-card total recall time, average/last recall time, accuracy, reviews, mistakes, difficulty ratings, best streak, last review, hardest cards, slowest cards, most reviewed cards, and most improved cards.
- The card-by-card Stats table is a compact preview by default rather than rendering every reviewed card at once. Keep Show more, Show all, and Collapse-to-preview controls so deep inspection is available without overwhelming the page.
- Stats retain Forward/Reverse separation and include Henle Whole Charts as their own study mode.
- Stats rank explicit study sessions. Legacy history without explicit session IDs may be grouped into inferred sessions without altering stored data.
- The Stats page provides a multi-select session scope. Users can view all sessions, one session, or any selected combination; the proficiency summaries, card analysis, recent reviews, and trend views must follow the selected scope.
- Session management belongs directly inside Stats > Choose sessions; do not add a separate session-management card/panel. Double-click an explicit session name there for Finder/Explorer-style inline renaming, and keep Delete in the same row.
- Deleting a session removes it from Stats/session history only. Its reviews remain part of continuous study memory and MUST NOT change card mastery, strength, intervals, due dates, adaptive priority inputs, response-time memory, review sequence, or Dickinson unlock progress. The visible Stats/proficiency calculations should be recomputed from the sessions that remain.
- Explicit resumable sessions retain Continue actions in the session rankings. Custom session names persist with review history and survive reload/login synchronization.
- Stats include lightweight trend graphs for session score and active recall time over time. Avoid large charting dependencies when simple native/SVG rendering is sufficient.
- Intrinsic card difficulty is separate from the user's Easy/Medium/Hard rating.
- Greek intrinsic difficulty rises with lesson progression; grammar may add complexity. Later lessons should generally be worth more than earlier lessons.
- Dickinson vocabulary intrinsic difficulty rises with frequency rank/rarity. Rarer words should generally be worth more than very common words.
- Henle intrinsic difficulty follows rule progression plus grammatical complexity encoded in section/subsection, voice, mood/form, special/irregular families, and whole-chart reconstruction.
- The unified proficiency score is 1–100 with tier labels: Novice, Developing, Proficient, Advanced, Expert, Master.
- A high score must require demonstrated performance, not merely attempting hard material. Difficulty raises potential reward, while accuracy, active recall speed, retention/mastery breadth, and streaks determine whether that reward is earned.
- Stats show overall, Greek, and Latin proficiency plus reviewed difficulty and hardest mastered material.
- Ranked session scores account for intrinsic difficulty, accuracy, speed, and streaks. Warm-up activity is excluded from ranked session scoring.

## Security, authentication, and Supabase coordination

- Secrets belong in GitHub/Supabase environment settings, never source or browser code.
- The committed `.env.production` may contain only the Supabase project URL and modern browser-safe publishable key; never add a secret or service-role key.
- Database authorization remains enforced by Supabase RLS, even when the UI hides an action.
- A Google-authenticated user may add email/password sign-in from the Account page by setting a password on the already authenticated Supabase user. This must preserve the same Supabase user ID, progress, sessions, and stats; do not create a second account simply because the user wants another sign-in method.
- Supabase's same-verified-email identity behavior should be preserved. Never implement custom account merging by moving progress between unrelated user IDs unless explicitly designed and reviewed as a migration.
- Password-setting UI must require an authenticated user, use Supabase Auth's user update flow, and never expose or persist the password in application storage.
- After changing the Supabase schema, apply a new numbered migration and regenerate `src/lib/database.types.ts` from the deployed project.
- Frontend maintainability/performance work should avoid changing `supabase/**`, auth/database types, environment files, migrations, or cloud-data services unless the task explicitly requires it.

## UI preservation

- Preserve the existing visual language and responsive layout unless redesign is explicitly requested.
- New controls work in both light and dark themes through existing CSS variables.
- Do not expose answers in previews, priority lists, metadata, aria-labels, or other hidden/accessibility text where the answer is meant to remain concealed.
- Make the flexibility of Greek and Latin study filters obvious in page/home descriptions; users should not have to discover by accident that categories can be combined.
- On the home page, Greek and Latin use written display titles rather than generic A/Α glyphs. Keep the Greek and Latin count/status badge area blank unless explicitly requested otherwise.
- Home descriptions credit the actual flashcard sources and retain source/purchase links. Greek purchase references must point to the fifth edition of Anne H. Groton's *From Alpha to Omega*, not the fourth edition used by the supplied online source.
- When signed in, the header Account control is a compact initials avatar rather than the user's full email address. Preserve an accessible Account label/title without displaying the email as the main navigation text.

## Performance and maintainability

- Keep the initial route lightweight. Prefer route-level lazy loading and feature-scoped CSS over loading all feature code/styles on the homepage.
- Do not eagerly load the ~1.18 MB Henle source data when a user opens Latin for vocabulary only. Opening a Henle disclosure may trigger the load because its child choices require the data; selecting vocabulary alone must not.
- Avoid repeated whole-deck scans in render loops where a stable cache or memoized derived value can preserve behavior more cheaply.
- Prefer small, stable shared components over duplicated markup, but avoid abstraction that adds runtime work without reducing maintenance risk.
- Preserve source data as external/static data rather than embedding thousands of cards into page components.
- Before adding a large dependency, verify that the capability cannot be implemented with existing dependencies or platform APIs.
- The production build enforces the bundle budget in `scripts/check-bundle-size.mjs`: main JavaScript must remain at or below 160 KB gzip and total CSS at or below 12 KB gzip. Do not raise these limits merely to make a change pass; first reduce the added payload or document why a deliberate budget increase is warranted.
- Refactors whose purpose is maintainability/performance must not change user-visible study behavior unless explicitly requested.

## Validation before completion

- Run `npm run check` before proposing or merging code changes.
- Fix TypeScript, test, and production-build failures caused by the change before completion.
- For changes affecting timer, grading, Back, direction separation, staged unlocking, priority answers, filtering, mixed-source study, sessions, warm-ups, scoring, authentication, or source data, explicitly verify those invariants in addition to the general check.
- Add or update focused regression tests for pure logic whenever practical.
- Prefer focused changes over broad refactors unless a refactor is necessary for correctness, maintainability, or measured performance.
