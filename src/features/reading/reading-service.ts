import type { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";

export type ReadingLanguage = "greek" | "latin";
export type WordTiming = {
  index: number;
  startMs: number;
  endMs: number;
};

export type Reading = {
  id: string;
  title: string;
  language: ReadingLanguage;
  text: string;
  audioPath: string | null;
  audioUrl: string | null;
  audioProvider: string;
  pronunciationSystem: string;
  wordTimings: WordTiming[];
  playbackRate: number;
  createdAt: string;
  updatedAt: string;
};

const localKey = "greek-latin-study:readings:v1";

function localReadings() {
  try { return JSON.parse(localStorage.getItem(localKey) || "[]") as Reading[]; }
  catch { return []; }
}

function writeLocal(readings: Reading[]) {
  localStorage.setItem(localKey, JSON.stringify(readings));
}

function fromRow(row: Record<string, unknown>): Reading {
  return {
    id: String(row.id),
    title: String(row.title),
    language: row.language as ReadingLanguage,
    text: String(row.text),
    audioPath: row.audio_path ? String(row.audio_path) : null,
    audioUrl: null,
    audioProvider: String(row.audio_provider ?? "none"),
    pronunciationSystem: String(row.pronunciation_system ?? "Not specified"),
    wordTimings: Array.isArray(row.word_timings) ? row.word_timings as WordTiming[] : [],
    playbackRate: Number(row.playback_rate ?? 1),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

async function addSignedUrl(reading: Reading) {
  if (!reading.audioPath || !supabase) return reading;
  const { data } = await supabase.storage.from("reading-audio").createSignedUrl(reading.audioPath, 3_600);
  return { ...reading, audioUrl: data?.signedUrl ?? null };
}

export async function listReadings(user: User | null) {
  if (!supabase || !user) return localReadings();
  const local = localReadings();
  if (local.length) {
    const { error: migrationError } = await supabase.from("readings").upsert(local.map((item) => ({
      id: item.id, user_id: user.id, title: item.title, language: item.language, text: item.text,
      audio_path: item.audioPath, audio_provider: item.audioProvider,
      pronunciation_system: item.pronunciationSystem, word_timings: item.wordTimings,
      playback_rate: item.playbackRate, created_at: item.createdAt || new Date().toISOString(), updated_at: item.updatedAt || new Date().toISOString(),
    })), { onConflict: "id" });
    if (migrationError) throw migrationError;
  }
  const { data, error } = await supabase.from("readings").select("*").order("updated_at", { ascending: false });
  if (error) throw error;
  return Promise.all((data ?? []).map((row) => addSignedUrl(fromRow(row))));
}

export async function saveReading(reading: Partial<Reading> & Pick<Reading, "title" | "language" | "text">, user: User | null) {
  const now = new Date().toISOString();
  const complete: Reading = {
    id: reading.id || crypto.randomUUID(),
    title: reading.title,
    language: reading.language,
    text: reading.text,
    audioPath: reading.audioPath ?? null,
    audioUrl: reading.audioUrl ?? null,
    audioProvider: reading.audioProvider ?? "none",
    pronunciationSystem: reading.pronunciationSystem ?? "Not specified",
    wordTimings: reading.wordTimings ?? [],
    playbackRate: reading.playbackRate ?? 1,
    createdAt: reading.createdAt ?? now,
    updatedAt: now,
  };
  if (!supabase || !user) {
    const readings = localReadings();
    const existing = readings.findIndex((item) => item.id === complete.id);
    if (existing >= 0) readings[existing] = complete;
    else readings.unshift(complete);
    writeLocal(readings);
    return complete;
  }
  const { data, error } = await supabase.from("readings").upsert({
    id: complete.id, user_id: user.id, title: complete.title, language: complete.language,
    text: complete.text, audio_path: complete.audioPath, audio_provider: complete.audioProvider,
    pronunciation_system: complete.pronunciationSystem, word_timings: complete.wordTimings,
    playback_rate: complete.playbackRate, updated_at: complete.updatedAt,
  }).select("*").single();
  if (error) throw error;
  return addSignedUrl(fromRow(data));
}

export async function deleteReading(reading: Reading, user: User | null) {
  if (!supabase || !user) {
    writeLocal(localReadings().filter((item) => item.id !== reading.id));
    return;
  }
  if (reading.audioPath) await supabase.storage.from("reading-audio").remove([reading.audioPath]);
  const { error } = await supabase.from("readings").delete().eq("id", reading.id);
  if (error) throw error;
}

export async function uploadReadingAudio(file: File, user: User) {
  if (!supabase) throw new Error("Supabase is not connected.");
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `${user.id}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from("reading-audio").upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  const { data } = await supabase.storage.from("reading-audio").createSignedUrl(path, 3_600);
  return { path, url: data?.signedUrl ?? null };
}

export function parseTimings(raw: string, wordCount: number) {
  if (!raw.trim()) return [];
  const value = JSON.parse(raw) as unknown;
  if (!Array.isArray(value)) throw new Error("Timing JSON must be an array.");
  return value.map((entry, index) => {
    const item = entry as Record<string, unknown>;
    const startMs = Number(item.startMs ?? Number(item.start ?? 0) * 1_000);
    const endMs = Number(item.endMs ?? Number(item.end ?? 0) * 1_000);
    const wordIndex = Number(item.index ?? index);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs || wordIndex < 0 || wordIndex >= wordCount) throw new Error(`Invalid timing entry ${index + 1}.`);
    return { index: wordIndex, startMs, endMs };
  });
}
