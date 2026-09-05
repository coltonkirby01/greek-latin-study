# Production authentication setup

The application code already supports email/password signup and sign-in, password recovery, persistent Supabase sessions, logout, and Google OAuth. This checklist contains the external dashboard settings needed for the production deployment.

## Production values

| Setting | Exact value |
| --- | --- |
| Application URL / Supabase Site URL | `https://coltonkirby01.github.io/greeklatinstudy/` |
| Application account callback | `https://coltonkirby01.github.io/greeklatinstudy/account` |
| Password-recovery callback | `https://coltonkirby01.github.io/greeklatinstudy/account?reset=1` |
| Google authorized JavaScript origin | `https://coltonkirby01.github.io` |
| Google authorized redirect URI | `https://wqgvpgmudouftyhnvvpr.supabase.co/auth/v1/callback` |

The Google redirect URI is the Supabase Auth callback, not the GitHub Pages account URL. Google returns to Supabase first; Supabase validates the response and returns the browser to the application account callback.

## 1. Supabase URL configuration

In **Supabase Dashboard → Authentication → URL Configuration**:

1. Set **Site URL** to the application URL above.
2. Add the application account callback to **Redirect URLs**.
3. Add the password-recovery callback to **Redirect URLs**.
4. For local development, also add `http://localhost:5173/**`.

Keep production redirect entries exact. A broad production wildcard is unnecessary for this application.

## 2. Google Auth Platform

In the Google Cloud project that will own the sign-in configuration:

1. Open **Google Auth Platform** and configure Branding with the public app name **Greek & Latin Study**, a support email, and a developer contact email.
2. Choose an **External** audience so ordinary Google accounts can sign in. While the app is in Testing, add the accounts that should be able to test it. Publish the app to Production when it should be available to any Google account.
3. Request only the standard identity scopes: `openid`, `userinfo.email`, and `userinfo.profile`.
4. Create an OAuth client with application type **Web application**.
5. Add the exact authorized JavaScript origin and authorized redirect URI from the table above. The JavaScript origin must not include `/greeklatinstudy/` or any other path.
6. Copy the generated Client ID and Client secret directly into Supabase. Do not commit the secret, put it in a `VITE_` variable, or send it in chat.

## 3. Enable Google in Supabase

In **Supabase Dashboard → Authentication → Sign In / Providers → Google**:

1. Turn on **Enable Sign in with Google**.
2. Paste the Google OAuth Client ID.
3. Paste the Google OAuth Client secret.
4. Save.

No source-code or GitHub Actions secret change is required. The browser receives only the existing Supabase publishable key; the Google client secret stays in Supabase's provider configuration.

## 4. Verify the live flows

Open the production [Account page](https://coltonkirby01.github.io/greeklatinstudy/account) in a private/incognito window and verify:

1. **Continue with Google** reaches Google's account chooser and returns to the Account page as a signed-in learner.
2. Sign out, sign in with email/password, reload, and confirm the session persists.
3. Request a password-reset email and confirm the link returns to the Account page with the new-password form.
4. Study and grade one card, sign out, sign back in, and confirm the same progress is restored.

## Administrator access

Google sign-in creates a normal learner account by design. Administrator access is a separate database grant in `public.admin_users`; this prevents every authenticated user from becoming a deck administrator. Grant it only after confirming the exact account UUID in **Authentication → Users**. Row Level Security remains authoritative even if someone visits `/admin` directly.

