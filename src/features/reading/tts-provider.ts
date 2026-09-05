import { supabase, supabaseAnonKey, supabaseUrl } from "../../lib/supabase";
import type { ReadingLanguage } from "./reading-service";

export type TtsRequest = {
  text: string;
  language: ReadingLanguage;
  voice?: string;
  pronunciationSystem?: string;
};

export type TtsResult = {
  audio: Blob;
  provider: string;
  pronunciationSystem: string;
};

export interface TtsProvider {
  id: string;
  synthesize(request: TtsRequest): Promise<TtsResult>;
}

/**
 * Optional server-side provider. The public app sends text and preferences to
 * a Supabase Edge Function; the third-party secret never reaches the browser.
 */
export const edgeTtsProvider: TtsProvider = {
  id: "supabase-edge-tts",
  async synthesize(request) {
    if (!supabase) throw new Error("Supabase is not connected.");
    const { data: session } = await supabase.auth.getSession();
    const response = await fetch(`${supabaseUrl}/functions/v1/tts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseAnonKey!,
        Authorization: `Bearer ${session.session?.access_token ?? supabaseAnonKey}`,
      },
      body: JSON.stringify(request),
    });
    if (!response.ok) throw new Error((await response.text()) || "TTS generation failed.");
    return {
      audio: await response.blob(),
      provider: response.headers.get("X-TTS-Provider") ?? "configured-edge-provider",
      pronunciationSystem: response.headers.get("X-Pronunciation-System") ?? "Not specified",
    };
  },
};
