import type { Session, User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { appUrl, isSupabaseConfigured, supabase } from "../../lib/supabase";

type AuthContextValue = { configured: boolean; loading: boolean; session: Session | null; user: User | null; isAdmin: boolean; recoveryMode: boolean; signInWithPassword(email: string, password: string): Promise<void>; signUp(email: string, password: string): Promise<void>; signInWithGoogle(): Promise<void>; sendPasswordReset(email: string): Promise<void>; updatePassword(password: string): Promise<void>; signOut(): Promise<void> };
const AuthContext = createContext<AuthContextValue | null>(null);
async function readAdmin(user: User | null) { if (!supabase || !user) return false; const { data, error } = await supabase.rpc("is_admin"); return error ? false : data === true; }

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null), [isAdmin, setIsAdmin] = useState(false), [loading, setLoading] = useState(isSupabaseConfigured), [recoveryMode, setRecoveryMode] = useState(false);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth.getSession().then(async ({ data }) => { if (!active) return; setSession(data.session); setIsAdmin(await readAdmin(data.session?.user ?? null)); setLoading(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((event, next) => { if (!active) return; setSession(next); setRecoveryMode(event === "PASSWORD_RECOVERY"); void readAdmin(next?.user ?? null).then(setIsAdmin); });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);
  const signInWithPassword = useCallback(async (email: string, password: string) => { if (!supabase) throw new Error("Cloud accounts have not been connected yet."); const { error } = await supabase.auth.signInWithPassword({ email, password }); if (error) throw error; }, []);
  const signUp = useCallback(async (email: string, password: string) => { if (!supabase) throw new Error("Cloud accounts have not been connected yet."); const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: appUrl("account") } }); if (error) throw error; }, []);
  const signInWithGoogle = useCallback(async () => { if (!supabase) throw new Error("Cloud accounts have not been connected yet."); const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: appUrl("account") } }); if (error) throw error; }, []);
  const sendPasswordReset = useCallback(async (email: string) => { if (!supabase) throw new Error("Cloud accounts have not been connected yet."); const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: appUrl("account?reset=1") }); if (error) throw error; }, []);
  const updatePassword = useCallback(async (password: string) => { if (!supabase) throw new Error("Cloud accounts have not been connected yet."); const { error } = await supabase.auth.updateUser({ password }); if (error) throw error; setRecoveryMode(false); }, []);
  const signOut = useCallback(async () => { if (!supabase) return; const { error } = await supabase.auth.signOut(); if (error) throw error; }, []);
  const value = useMemo<AuthContextValue>(() => ({ configured: isSupabaseConfigured, loading, session, user: session?.user ?? null, isAdmin, recoveryMode, signInWithPassword, signUp, signInWithGoogle, sendPasswordReset, updatePassword, signOut }), [isAdmin, loading, recoveryMode, session, signInWithPassword, signUp, signInWithGoogle, sendPasswordReset, updatePassword, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() { const context = useContext(AuthContext); if (!context) throw new Error("useAuth must be used within AuthProvider."); return context; }
