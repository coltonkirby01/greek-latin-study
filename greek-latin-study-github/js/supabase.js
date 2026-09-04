import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const cfg = window.STUDY_APP_CONFIG || {};
export const authConfigured = Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
export const supabase = authConfigured ? createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
}) : null;

export async function getUser(){
  if(!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user || null;
}
export async function signInGoogle(){
  if(!supabase) throw new Error('Authentication is not configured.');
  const redirectTo = location.origin + location.pathname;
  const { error } = await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo}});
  if(error) throw error;
}
export async function signInEmail(email){
  if(!supabase) throw new Error('Authentication is not configured.');
  const emailRedirectTo = location.origin + location.pathname;
  const { error } = await supabase.auth.signInWithOtp({email,options:{emailRedirectTo}});
  if(error) throw error;
}
export async function signOut(){ if(supabase) await supabase.auth.signOut(); }
