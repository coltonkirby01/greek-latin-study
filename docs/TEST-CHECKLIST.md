# Migration test checklist

Last local verification: 2026-09-05 UTC.

Legend: ✅ passed; 🟡 implemented, external configuration/integration test pending; ⬜ not yet tested.

## Source integrity

- ✅ Greek source has 55 cards.
- ✅ Dickinson source has 997 entries.
- ✅ Attached Henle source has 2,062 unique cards and 331 unique rules.
- ✅ All 2,062 Henle cards have supplied reverse prompts and answers.
- ✅ Whole-chart grouping yields 248 chart exercises.
- ✅ Attached Henle application's canonical deck JSON checksum matches the migrated source.

## Shared study behavior

- ✅ Forward and Reverse use distinct `studyKey` state objects.
- ✅ Directional state remains separate during local/cloud envelope reconciliation.
- ✅ Question timer formats to hundredths.
- ✅ Timer accumulation pauses/resumes on tab visibility and window focus events (logic inspection plus timer model; browser QA below).
- ✅ Reveal captures front-side time.
- ✅ Correctness and Easy/Medium/Hard are independent dimensions.
- ✅ Slow correct responses reduce interval and increase priority.
- ✅ Wrong, Hard, due state, recency, strength, and mastery affect scheduling/priority.
- ✅ Skip advances without grading.
- ✅ Back snapshot allows a corrected result with one review total.
- ✅ Staged vocabulary advances only after all active cards have a correct answer.
- ✅ Highest-Priority Review component renders prompts and reasons, never answer fields.
- ✅ Keyboard handler implements Space, 1–5, and Enter and excludes inputs, selects, textareas, and editable controls.
- ✅ Reduced-motion CSS disables card transition motion.

## Deck modes

- ✅ Greek Forward/Reverse wired to one shared study interface.
- ✅ Dickinson Forward/Reverse wired with independent staged unlocks.
- ✅ Henle Individual Forward/Reverse wired with independent progress.
- ✅ Henle Whole Charts has an independent `chart` study key.
- ✅ Henle category, subsection, voice, and exact rule filters are present.
- ✅ Adaptive and sequential selection are present in every study session.

## Importer and administration

- ✅ Sample CSV parses Front, Back, Category, Rank, and Reverse Prompt.
- ✅ JSON array imports parse.
- ✅ XLSX parser and preview path build successfully.
- ✅ Create/edit metadata, category, card editing/deletion/reordering, publish/unpublish UI builds.
- ✅ SQL RLS restricts writes to `is_admin()` and rejects ordinary-user access by policy inspection.
- 🟡 Create/upload/preview/publish/open/study/delete-sample integration test requires the Supabase project.

## Accounts and cloud

- ✅ Email/password, signup, logout, password-reset, and Google OAuth code builds.
- ✅ Local-first sparse progress and per-mode cloud merge are covered by tests.
- ✅ Admin protection exists in both UI and RLS.
- 🟡 Account creation, email delivery, session persistence, cross-session/device sync, and password reset require the Supabase project.
- 🟡 Google login requires owner-provided Google OAuth configuration.

## Reading & Audio

- ✅ Passage create/save/list/edit/delete code builds with local and cloud repositories.
- ✅ Browser TTS Play/Pause/Restart/speed and sentence controls build.
- ✅ Uploaded audio controls and private Storage path build.
- ✅ Supplied timing metadata maps real playback time to the active word in tests.
- ✅ Browser TTS highlighting uses speech-boundary events, not guessed intervals.
- ✅ Active word scrolls into view.
- ✅ Modern/device Greek pronunciation is explicitly labeled and never called Classical.
- 🟡 Durable audio upload and saved cross-device readings require the Supabase project.
- 🟡 External provider TTS remains intentionally disabled pending owner approval and a credential.

## Build and visual QA

- ✅ TypeScript production build succeeds.
- ✅ GitHub Pages base-path build succeeds.
- ✅ Automated tests pass.
- ⬜ Desktop browser workflow QA.
- ⬜ Mobile viewport workflow QA.
- ⬜ Live GitHub Pages workflow/deployment.
