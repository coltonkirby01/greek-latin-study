# Greek & Latin Study — GitHub Pages version

A static GitHub Pages site with:

- Greek I adaptive flashcards: 24 uppercase + 24 lowercase + 4 punctuation + 3 accents.
- Dickinson Latin Core Vocabulary adaptive flashcards.
- Latin staged unlocking: first 100, then groups of 25 after every unlocked card has been answered correctly at least once.
- Right/Wrong and Easy/Medium/Hard tracked separately.
- Per-user cloud progress through Supabase Auth + Postgres when configured.
- Guest mode using browser storage when not signed in.

## 1. Create a Supabase project

Create a project at Supabase, then open **SQL Editor** and run `supabase-schema.sql`.

## 2. Configure authentication

In Supabase Authentication:

- Enable Email (magic link / OTP).
- Optionally enable Google OAuth.
- Add your eventual GitHub Pages URL to the allowed redirect URLs, for example `https://YOURNAME.github.io/YOUR-REPO/`.
- During local testing, also add the local URL you use.

## 3. Add the public browser keys

Edit `config.js`:

```js
window.STUDY_APP_CONFIG = {
  SUPABASE_URL: "https://YOUR-PROJECT.supabase.co",
  SUPABASE_ANON_KEY: "YOUR-PUBLIC-ANON-KEY"
};
```

The browser anon/publishable key is intended to be public. Security depends on Row Level Security, which the included SQL enables.

## 4. Publish with GitHub Pages

Create a repository, copy these files to the repository root, commit, then enable **Settings → Pages → Deploy from a branch** and select the main branch/root folder.

## Notes

The Latin deck requests Dickinson's CSV and falls back to a public Dickinson-derived mirror. The current source list contains fewer than 1,000 rows; the app uses every available source entry rather than fabricating missing vocabulary.

For production use, review `privacy.html`, update contact/privacy details as appropriate, and test authentication from a second browser/device before sharing publicly.
