import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const supabase = isSupabaseConfigured ? createClient<Database>(supabaseUrl!, supabaseAnonKey!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;
export function appUrl(path = "") { const base = import.meta.env.BASE_URL.replace(/^\//, ""); return new URL(`${base}${path.replace(/^\//, "")}`, window.location.origin).toString(); }
