# Migration test checklist

Last CI verification: 2026-09-05 UTC.

Legend: ✅ passed; 🟡 implemented, external configuration/integration test pending; ⬜ not yet tested.

## Source integrity

- ✅ Greek Lessons 1–2 source has 55 cards.
- ✅ Greek Lesson 3 Vocabulary has 11 cards.
- ✅ Greek Lesson 3 Grammar has 11 form cards across Present Active Indicative, Infinitive, and Imperative.
- ✅ Dickinson source has 997 entries.
- ✅ Henle source has 2,062 unique cards and 331 unique rules.
- ✅ All 2,062 Henle cards have supplied reverse prompts and answers.
- ✅ Whole-chart grouping yields 248 chart exercises.
- ✅ Henle application's canonical deck JSON checksum matches the migrated source.

## Shared study behavior

- ✅ Forward and Reverse use distinct `studyKey` state objects.
- ✅ Directional state remains separate during local/cloud envelope reconciliation.
- ✅ Question timer formats to hundredths.
- ✅ Timer accumulation excludes hidden/unfocused time and requires the Start gate again after focus/visibility loss.
- ✅ Manual Pause timer reopens the Start gate without resetting elapsed front time.
- ✅ Start-gate dismissal does not leak its first keypress into reveal/grading controls.
- ✅ Forward/Reverse and Adaptive/Sequential controls remain usable while the Start gate is open and do not start timing.
- ✅ Reveal captures and freezes front-side time.
- ✅ Enter flips between revealed answer/question faces without restarting timing.
- ✅ R/W map to Right/Wrong; 1/2/3 map to Easy/Medium/Hard; Space reveals on front and saves after both rating dimensions are chosen.
- ✅ Correctness and Easy/Medium/Hard are independent dimensions.
- ✅ Slow correct responses reduce interval and increase priority.
- ✅ Wrong, Hard, due state, recency, strength, and mastery affect scheduling/priority.
- ✅ Skip advances without grading.
- ✅ Back snapshot allows a corrected result with one review total and preserves review metadata.
- ✅ Staged vocabulary advances only after all active cards have a correct answer.
- ✅ Highest-Priority Review renders prompts and reasons, never answer fields.
- ✅ Global keyboard shortcuts exclude form/editing controls and Start-gate/toolbar controls.
- ✅ Reduced-motion CSS disables card transition motion.

## Unified Greek and Latin filters

- ✅ Primary navigation has one Greek app and one Latin app; no standalone Decks page/nav item.
- ✅ Every disclosure parent has a visible select-all checkbox with mixed-state support.
- ✅ Parent selection and disclosure expansion are independent.
- ✅ An unchecked parent can be opened and one child can be selected without activating all siblings.
- ✅ Greek All Vocabulary selects only current Lesson 3 vocabulary.
- ✅ Greek All Grammar selects Lesson 2 accent marks and Lesson 3 grammar; alphabet and punctuation are not vocabulary.
- ✅ Greek Lesson 1 contains Alphabet (Uppercase/Lowercase) and Punctuation; Lesson 2 contains Accent Marks; Lesson 3 separates Vocabulary and Grammar.
- ✅ Latin has one Dickinson vocabulary control, not duplicate Latin/Dickinson vocabulary controls.
- ✅ Henle Grammar Forms and Whole Charts have independent Part I filters covering Nouns, Adjectives, Adverbs, Numerals, Pronouns, and Verbs.
- ✅ Henle verb filters can narrow by voice, mood/form, and verb family.
- ✅ Opening an unchecked Henle section loads its child choices without selecting the parent.
- ✅ Henle data remains deferred when Latin is used for vocabulary only.
- ✅ Filter changes never delete stored mastery/history for deselected material.

## Sessions, warm-up, and statistics

- ✅ New Session creates a new performance window without resetting long-term mastery or adaptive priorities.
- ✅ Normal reviews carry session identifiers in stored review history.
- ✅ Personalized Warm-up contains five reviewed cards and favors high-priority/due/slow/difficult material.
- ✅ Every warm-up card uses personalized adaptive selection.
- ✅ Warm-up reviews update long-term scheduling/history but are tagged separately from ranked sessions.
- ✅ Warm-up completion returns to the Start gate with a fresh ranked session.
- ✅ Unified `/stats` route covers Greek and Latin and is linked from study sessions.
- ✅ Stats include per-card total/average/last recall time, accuracy, reviews, mistakes, difficulty ratings, streaks, and last review.
- ✅ Stats include hardest-for-user, slowest, most reviewed, most improved, and highest-difficulty-mastered analysis.
- ✅ Intrinsic Greek difficulty rises with lesson progression; Dickinson difficulty rises with rarity/frequency rank; Henle difficulty combines progression and encoded grammatical complexity.
- ✅ Proficiency score is 1–100 with Novice, Developing, Proficient, Advanced, Expert, and Master tiers.
- ✅ Difficulty alone cannot raise proficiency without demonstrated accuracy/retention/speed.
- ✅ Session rankings incorporate accuracy, speed, streaks, and intrinsic difficulty and exclude warm-up reviews.

## Deck modes

- ✅ Greek Forward/Reverse wired to one shared study interface.
- ✅ Dickinson Forward/Reverse wired with independent staged unlocks.
- ✅ Henle Individual Forward/Reverse wired with independent progress.
- ✅ Henle Whole Charts has an independent `chart` study key.
- ✅ Adaptive and sequential selection are present in every study session.

## Importer and administration

- ✅ Sample CSV parses Front, Back, Category, Rank, and Reverse Prompt.
- ✅ JSON array imports parse.
- ✅ XLSX parser and preview path build successfully.
- ✅ Create/edit metadata, category, card editing/deletion/reordering, publish/unpublish UI builds.
- ✅ SQL RLS restricts writes to authenticated `admin_users` members and rejects ordinary-user access by policy inspection.
- ✅ Production Supabase schema and private `reading-audio` bucket created.
- ✅ Administrator authorization hardened to self-visible membership rows; Supabase security advisor reports no findings.
- ✅ RLS identity checks use initialization plans and administrator command policies do not overlap; no actionable RLS performance warnings remain.
- 🟡 Create/upload/preview/publish/open/study/delete-sample integration test requires the owner's first authenticated administrator account.

## Accounts and cloud

- ✅ Email/password, signup, logout, password-reset, and Google OAuth code builds.
- ✅ Local-first sparse progress and per-mode cloud merge are covered by tests.
- ✅ Admin protection exists in both UI and RLS.
- ✅ Production frontend is connected with the project's modern browser-safe publishable key.
- ✅ Production Supabase contains one confirmed email/password account with a recorded sign-in (verified without exposing its identity on 2026-09-05).
- 🟡 Session persistence, cross-session/device sync, and password reset still require the owner's live browser verification.
- 🔴 Google login is wired in the application but the Supabase Google provider remains disabled pending the owner-created Google OAuth Client ID and secret. Exact settings are in `docs/AUTH-SETUP.md`.

## Reading & Audio

- ✅ Passage create/save/list/edit/delete code builds with local and cloud repositories.
- ✅ Browser TTS Play/Pause/Restart/speed and sentence controls build.
- ✅ Uploaded audio controls and private Storage path build.
- ✅ Supplied timing metadata maps real playback time to the active word in tests.
- ✅ Browser TTS highlighting uses speech-boundary events, not guessed intervals.
- ✅ Active word scrolls into view.
- ✅ Modern/device Greek pronunciation is explicitly labeled and never called Classical.
- 🟡 Durable audio upload and saved cross-device readings require live Supabase verification.
- 🟡 External provider TTS remains intentionally disabled pending owner approval and a credential.

## Build and visual QA

- ✅ Automated test suite passes.
- ✅ TypeScript production build succeeds.
- ✅ GitHub Pages base-path build succeeds.
- ✅ Production bundle stays within the enforced JavaScript and CSS budgets.
- ✅ Feature CSS for Home, filters/timer, and Stats is route/feature split rather than added to the initial global payload.
- ✅ Desktop browser workflow QA previously passed for navigation, timer start/freeze, grading, corrected Back, Skip, per-direction persistence, Henle, Whole Charts, keyboard controls, and saved-reading reload.
- ⬜ Manual browser QA of the new unified filters, warm-up, and Stats score after deployment.
- ⬜ Mobile viewport workflow QA.
- 🟡 Repository may still have the prior legacy branch publisher enabled; GitHub Actions is the preferred Pages source to eliminate redundant publishing work.
