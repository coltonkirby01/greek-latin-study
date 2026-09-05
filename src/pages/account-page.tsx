import { Cloud, Download, FileUp, KeyRound, LogOut, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../features/auth/auth-context";
import { exportProgress, importProgressFile } from "../features/study/legacy-import";
import { loadLocalEnvelope, loadProgressEnvelope, replaceLocalEnvelope, saveProgressEnvelope } from "../features/study/progress-repository";

type View = "signin" | "signup" | "reset";
const deckNames = [["greek-i", "Greek I"], ["dickinson-latin-core", "Dickinson Latin"], ["henle-part1-forms", "Henle Grammar"]] as const;
function download(name: string, value: unknown) { const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" })), link = document.createElement("a"); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url); }

export function AccountPage() {
  const auth = useAuth();
  const [view, setView] = useState<View>("signin"), [email, setEmail] = useState(""), [password, setPassword] = useState(""), [message, setMessage] = useState<string | null>(null), [error, setError] = useState<string | null>(null), [working, setWorking] = useState(false);
  const [accountPassword, setAccountPassword] = useState(""), [accountPasswordConfirm, setAccountPasswordConfirm] = useState("");
  const localDecks = useMemo(() => deckNames.map(([id, label]) => ({ id, label, envelope: loadLocalEnvelope(id) })), [message]);
  const providers = useMemo(() => {
    const values = new Set<string>();
    for (const provider of auth.user?.app_metadata?.providers ?? []) if (typeof provider === "string") values.add(provider);
    for (const identity of auth.user?.identities ?? []) values.add(identity.provider);
    return values;
  }, [auth.user]);

  useEffect(() => {
    if (!auth.user) return;
    void Promise.all(deckNames.map(([id]) => loadProgressEnvelope(id, auth.user))).catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)));
  }, [auth.user]);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setWorking(true); setError(null);
    try {
      if (auth.recoveryMode) { await auth.updatePassword(password); setMessage("Password updated."); }
      else if (view === "signin") { await auth.signInWithPassword(email, password); setMessage("Signed in."); }
      else if (view === "signup") { await auth.signUp(email, password); setMessage("Account created. Check your email if confirmation is enabled."); }
      else { await auth.sendPasswordReset(email); setMessage("Password-reset email sent if the account exists."); }
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setWorking(false); }
  }

  async function saveAccountPassword(event: React.FormEvent) {
    event.preventDefault(); setError(null); setMessage(null);
    if (accountPassword.length < 8) { setError("Use a password with at least 8 characters."); return; }
    if (accountPassword !== accountPasswordConfirm) { setError("The two passwords do not match."); return; }
    setWorking(true);
    try {
      await auth.updatePassword(accountPassword);
      setAccountPassword(""); setAccountPasswordConfirm("");
      setMessage(`Email-and-password sign-in is now enabled for ${auth.user?.email ?? "this account"}. It uses the same account and study history as Google sign-in.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setWorking(false); }
  }

  async function importFile(file: File | undefined) {
    if (!file) return;
    try {
      const envelope = importProgressFile(JSON.parse(await file.text()));
      replaceLocalEnvelope(envelope); await saveProgressEnvelope(envelope, auth.user);
      setMessage(`Imported ${envelope.deckId} progress${auth.user ? " and synced it" : " locally"}.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  }

  if (auth.loading) return <main className="page-shell"><div className="study-loading panel-surface"><p>Loading account…</p></div></main>;

  if (auth.user) return <main className="page-shell account-page">
    <div className="account-layout">
      <section className="account-identity panel-surface">
        <div className="account-avatar">{(auth.user.email?.[0] ?? "A").toUpperCase()}</div>
        <div className="account-name-block"><p className="eyebrow">Signed-in learner</p><h1>{auth.user.email}</h1><p>Progress is cached locally and synchronized to your private account.</p></div>
        <span className="private-badge"><ShieldCheck /> Private progress</span>
      </section>
      {message && <div className="success-alert">{message}</div>}
      {error && <div className="inline-alert">{error}</div>}

      <section className="account-activity panel-surface">
        <p className="eyebrow">Sign-in methods</p>
        <h2>One account, multiple ways to sign in</h2>
        <p className="form-help">{providers.has("google") ? "Google is connected. Add a password below to sign in with this same email and keep the same user, progress, sessions, and stats." : "You can set or change the password for this account here. If you later use Google with the same verified email, Supabase can associate it with the same user."}</p>
        <div className="account-methods">
          <span className="private-badge">Google · {providers.has("google") ? "Connected" : "Not connected"}</span>
          <span className="private-badge">Email · {auth.user.email}</span>
          <span className="private-badge">Password · {providers.has("email") ? "Enabled" : "Set below"}</span>
        </div>
        <form className="auth-form account-password-form" onSubmit={saveAccountPassword}>
          <label><span>{providers.has("email") ? "New password" : "Add a password"}</span><input type="password" minLength={8} autoComplete="new-password" required value={accountPassword} onChange={(event) => setAccountPassword(event.target.value)} /></label>
          <label><span>Confirm password</span><input type="password" minLength={8} autoComplete="new-password" required value={accountPasswordConfirm} onChange={(event) => setAccountPasswordConfirm(event.target.value)} /></label>
          <button className="primary-button form-submit" disabled={working}>{working ? "Saving…" : providers.has("email") ? "Change password" : "Enable email + password sign-in"}</button>
        </form>
      </section>

      <section className="account-activity panel-surface">
        <p className="eyebrow">Portable by design</p><h2>Progress backup &amp; migration</h2><p className="form-help">Import this app's backup or a Henle v4 backup. Directional histories remain independent.</p>
        <div className="backup-grid">{localDecks.map(({ id, label, envelope }) => <button key={id} type="button" className="secondary-button" disabled={!envelope} onClick={() => envelope && download(`${id}-progress.json`, exportProgress(envelope))}><Download /> Export {label}</button>)}<label className="file-button secondary-button"><FileUp /> Import progress JSON<input type="file" accept=".json" onChange={(event) => void importFile(event.target.files?.[0])} /></label></div>
      </section>
      <section className="account-actions panel-surface"><div><Cloud /><p>Cloud sync covers every study direction and saved reading.</p></div><button className="secondary-button" type="button" onClick={() => void auth.signOut()}><LogOut /> Sign out</button></section>
    </div>
  </main>;

  return <main className="page-shell account-page"><section className="signed-out-account panel-surface auth-panel"><div className="callout-icon"><KeyRound /></div><p className="eyebrow">Private cloud progress</p><h1>{auth.recoveryMode ? "Choose a new password" : view === "signup" ? "Create your study account" : view === "reset" ? "Reset your password" : "Continue your study anywhere"}</h1>{!auth.configured ? <div className="setup-note">Account screens are ready, but this deployment has not yet been connected to Supabase. Guest study works now.</div> : <>{message && <div className="success-alert">{message}</div>}{error && <div className="inline-alert">{error}</div>}<form className="auth-form" onSubmit={submit}>{!auth.recoveryMode && <label><span>Email</span><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>}{(auth.recoveryMode || view !== "reset") && <label><span>{auth.recoveryMode ? "New password" : "Password"}</span><input type="password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>}<button className="primary-button form-submit" disabled={working}>{working ? "Working…" : auth.recoveryMode ? "Update password" : view === "signin" ? "Sign in" : view === "signup" ? "Create account" : "Send reset link"}</button></form>{!auth.recoveryMode && view !== "reset" && <button className="secondary-button google-button" type="button" onClick={() => void auth.signInWithGoogle().catch((reason) => setError(reason.message))}>Continue with Google</button>}<div className="auth-switches"><button type="button" onClick={() => setView(view === "signup" ? "signin" : "signup")}>{view === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}</button><button type="button" onClick={() => setView(view === "reset" ? "signin" : "reset")}>{view === "reset" ? "Back to sign in" : "Forgot password?"}</button></div></>}<div className="migration-box"><strong>Bring existing Henle progress</strong><span>Use Save Backup in the v4 HTML app, then import that JSON here.</span><label className="file-button secondary-button"><FileUp /> Import backup<input type="file" accept=".json" onChange={(event) => void importFile(event.target.files?.[0])} /></label></div></section></main>;
}
