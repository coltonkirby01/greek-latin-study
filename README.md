# Greek & Latin Study

A permanent, maintainable edition of the Greek & Latin Study web application. It preserves the scholarly cream-and-burgundy appearance and active-recall workflow of the original ChatGPT Site while adding a shared flashcard engine, complete Henle grammar data, independent bidirectional learning histories, cloud-ready accounts, deck administration, and reading/audio practice.

The original ChatGPT Site remains intact. This repository is the source of truth for the GitHub edition.

## Included study material

| Study area | Source count | Modes |
| --- | ---: | --- |
| Greek I | 55 cards | Symbol → Name; Name → Symbol |
| Dickinson Latin Core | 997 entries | Latin → English; English → Latin; staged 100 then 25 |
| Henle Part I Forms | 2,062 unique cards; 331 rules | Prompt → Form; Form → Identify |
| Henle Whole Charts | 248 multi-form rule groups | Reconstruct complete chart |

The Henle JSON is generated from the exact supplied `Henle_Part1_Forms_Full_App...html` data object. Runtime validation and automated tests fail if its required counts or unique IDs change unexpectedly.

## Stack

- React 19, TypeScript, Vite
- React Router with a GitHub Pages 404 fallback
- Supabase Auth, Postgres, Row Level Security, Storage, and optional Edge Functions
- Vitest for review logic, import parsing, reading synchronization, and source-count protection
- GitHub Actions for test, build, and Pages deployment

The app remains usable without Supabase: all built-in decks and guest progress work locally. The production deployment is connected to the owner's **Latin Greek** Supabase project for accounts, cloud progress, administrator-created decks, saved readings, and private audio storage.

## Project map

```text
src/
  components/              navigation and shared site layout
  data/                    built-in deck loaders and CSV parser
  features/
    auth/                  Supabase session and administrator status
    decks/                 cloud deck service and CSV/XLSX/JSON importer
    henle/                 authoritative data adapter and chart renderer
    reading/               passages, timing model, audio storage, TTS provider interface
    study/                 timer, adaptive scheduler, progress, Back/Skip, shared UI
  pages/                   route-level screens
public/data/               versioned built-in source data
supabase/migrations/       complete schema and RLS policies
supabase/functions/tts/    optional secret-bearing TTS proxy
tests/                     invariant and behavior tests
```

## Local development

Requires Node 22 or newer.

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` when using another Supabase project locally:

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
```

The repository's `.env.production` contains only the project URL and a modern Supabase **publishable** key. Publishable keys are designed for browser exposure; authorization still comes from RLS. Never put a secret key, service-role key, or TTS provider credential in any `VITE_` variable or committed file. CI environment variables can override this file when moving the deployment to another project.

Run all automated checks:

```bash
npm run check
```

Build the repository-path deployment exactly as GitHub Pages does:

```bash
npm run build:pages
```

## Flashcard data model

All ordinary decks become a `DeckDefinition` containing `StudyCard` records. A card has a stable ID, forward front/back, optional explicit reverse prompt/answer, category, rank, source, notes, and extensible metadata. Administrator-created records use the same model when loaded from Supabase.

If `reverse_prompt` is blank, a normal imported deck uses Back as the reverse question and Front as the reverse answer. For ambiguous grammar material, supply an explicit Reverse Prompt or use a specialized adapter such as Henle.

New ordinary decks automatically inherit:

- forward and optional reverse modes
- smooth 3D card flip and reverse return motion
- hundredths-of-a-second front timer
- hidden-tab/window-blur timing pause
- Reveal, Right/Wrong, Easy/Medium/Hard, Save & Next
- Back with true grade rollback, and ungraded Skip
- adaptive or sequential ordering
- top-five prompt-only priority review
- per-direction statistics and cloud-ready progress

### Separate directions

One deck has a progress envelope containing independent `modes`, keyed by `studyKey`. Greek and vocabulary use `forward` and `reverse`; Henle uses `individual:forward`, `individual:reverse`, and `chart`. Each mode owns its card strength, due date, response-time totals, history, counters, and unlocked stage. Cloud/local reconciliation merges modes by each mode's update time instead of falsely combining their mastery.

### Timer

The timer starts when a question is presented, updates every 10 ms, and formats with `toFixed(2)` as, for example, `3.47 s`. Reveal captures and freezes the elapsed front-side time. `visibilitychange`, window `blur`, and window `focus` pause/resume accumulation so time spent elsewhere is not charged. Reduced-motion settings suppress card animations but do not alter timing.

### Adaptive review

Scheduling is intentionally transparent rather than a black box. Correctness has the strongest effect; difficulty selects the starting interval and growth factor; current strength and streak expand successful intervals; Wrong creates a lapse and short interval. Slow response applies a logarithmic interval penalty after four seconds and adds review priority. Priority also includes whether a card is new, mastered once, due/overdue, inconsistent, recently wrong, hard, and recently shown.

Cards never disappear after one success. Initial mastery controls staged introduction; all mastered cards continue returning according to due dates and adaptive priority.

### Back and Skip

Every saved review keeps a transaction containing the exact pre-review mode snapshot. Back restores that snapshot, deletes the cloud review event, and reopens the card for correction. The corrected grade reuses the same review UUID, so the mistaken and corrected ratings can never count as two reviews. Skip presents another card without changing review, accuracy, or difficulty counts.

## Supabase setup

The production project already has all repository migrations applied. For a fresh replacement project:

1. Create a Supabase project; do not enable a paid plan unless you have deliberately approved it.
2. Apply the numbered files in `supabase/migrations/` in order. Migration 0002 hardens administrator authorization; migration 0003 optimizes RLS evaluation without changing access.
3. In Authentication, enable Email. Set the Site URL to the deployed GitHub Pages URL and add both the deployed `/account` URL and local development URL to Redirect URLs.
4. Create your account once, copy its UUID from Authentication → Users, and insert that exact UUID into `public.admin_users`.
5. Replace the public values in `.env.production`, or provide `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` through the deployment environment. Use the project URL and public publishable key only.
6. Add the same values to `.env.local` for local development.

The migration creates:

- `decks`, `deck_categories`, and `cards` for reusable administrator-created decks
- `user_deck_states` for the current sparse state of every mode
- `review_events` for individual review audit/sync records
- `readings` for private passage metadata and timing arrays
- private `reading-audio` Storage with a 50 MB object limit
- `admin_users` with self-visible membership checks used directly by administrator-only RLS policies

Every private row policy compares `user_id` to `(select auth.uid())`, allowing Postgres to initialize the identity once per query. Deck/card writes additionally require a matching self-visible row in `admin_users`. The administrator page refusing access is only a usability layer; RLS remains authoritative if someone manually calls an endpoint or visits `/admin`. Supabase's security advisor reports no findings, and its performance advisor reports no actionable RLS warnings after the hardening migrations.

### Email/password, reset, and Google

Email/password signup, secure Supabase sessions, logout, and password recovery are implemented. Passwords are handled by Supabase Auth and are never stored by this application. Google OAuth is wired but must be explicitly enabled in the Supabase Authentication provider settings with Google client credentials and the callback URL Supabase displays. Until configured, the Google button returns the provider error rather than pretending to work.

### Guest migration and backup

Guest state is always kept locally first. On sign-in, each local and cloud mode is reconciled independently by its update time, then saved back to the account. Saved guest readings are also uploaded to the signed-in account. The Account page exports v2 JSON backups and imports both v2 backups and the original Henle v4 backup format. Browser same-origin rules prevent a new GitHub domain from directly reading the original Site's localStorage, so migration is explicit instead of silently discarding or covertly reaching across origins.

## Deck administration and imports

Only a row in `admin_users` grants access. The administrator area can:

- create a deck and edit its title, slug, subject, language, description, reverse behavior, and optional staged-introduction configuration
- import CSV, XLSX, or JSON and preview the first ten parsed cards before writing
- append or deliberately replace cards
- add categories, add/edit/delete individual cards, and move cards up or down
- publish or unpublish a deck

CSV requires `Front` and `Back`. Optional columns are `Category`, `Rank`, `Source`, `Notes`, and `Reverse Prompt`. See `public/sample-deck.csv`. JSON accepts an array or `{ "cards": [...] }`; case-insensitive equivalents of the same field names are recognized. XLSX uses its first sheet and first row as headers.

Published cloud decks appear in the Deck Library and run through the same `StudySession` component as the built-in decks. Specialized formats should adapt source data into `StudyCard` and supply custom front/back renderers, as `HenlePage` does; they should not fork timer, grading, sync, or scheduling logic.

## Reading & Audio

Users can create, save, edit, and delete Greek or Latin passages. The reading player includes Play, Pause, Restart, playback speed, Previous Sentence, Next Sentence, large text, current-word highlighting, and automatic scroll-to-word behavior.

Audio is provider-neutral:

1. With no attached file, browser speech synthesis produces audio. Word highlighting listens to the browser's real speech-boundary events—not a guessed JavaScript interval.
2. Manually uploaded or teacher-recorded audio is stored privately in Supabase Storage.
3. Imported word timing metadata uses `{ index, startMs, endMs }` and drives highlighting from the media element's real current time.
4. `TtsProvider` and the optional `supabase/functions/tts` proxy support a future external provider without exposing its secret to frontend code.

When uploaded audio has no timings, the app deliberately does not fake karaoke synchronization. Greek browser voices are labeled as device/browser voices and warn that `el-*` generally means Modern Greek; the UI never presents a Modern Greek voice as Classical, Koine, or Erasmian. Saved readings record the selected pronunciation label.

The Edge Function remains inactive until an owner-approved provider is selected. Then deploy it and set server-only `TTS_API_URL`, `TTS_API_KEY`, `TTS_PROVIDER_LABEL`, and `TTS_PRONUNCIATION_LABEL` secrets. Provider request/response mapping may need a small adapter because vendor APIs differ.

## Deployment

The `pages.yml` workflow runs tests and a production build for every pull request. A push to `main` additionally uploads `dist` and deploys GitHub Pages. `build:pages` sets the correct `/greek-latin-study/` base path, and the post-build script creates `404.html` so direct client routes work on Pages.

The repository originally used legacy branch publishing. Until the owner changes **Settings → Pages → Build and deployment → Source** to **GitHub Actions**, the compiled deploy job waits for that legacy job to finish and then replaces its output. Branch-specific concurrency labels keep pull-request checks from cancelling the live `main` deployment. Once the source is set to GitHub Actions, the same workflow continues normally and the legacy wait exits immediately.

Recommended branch practice:

- keep `main` deployable and protected after initial setup
- make ordinary changes on short-lived `feature/...` or `fix/...` branches
- require the `check` job before merging
- use deliberate data-change commits for source deck replacements

## Testing status

`docs/TEST-CHECKLIST.md` records the exact verification state. Unit/data/build tests run without external accounts. Supabase authentication, cross-device sync, storage upload, admin RLS, and the live Pages URL require one configured Supabase/GitHub deployment before their final integration checks can truthfully pass.
