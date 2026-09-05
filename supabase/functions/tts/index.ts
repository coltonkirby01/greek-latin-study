// Optional paid/provider-backed TTS proxy. It is intentionally inactive until
// the owner chooses a provider and supplies secrets with `supabase secrets set`.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  const endpoint = Deno.env.get("TTS_API_URL");
  const apiKey = Deno.env.get("TTS_API_KEY");
  const provider = Deno.env.get("TTS_PROVIDER_LABEL") || "Configured TTS provider";
  const pronunciation = Deno.env.get("TTS_PRONUNCIATION_LABEL") || "Not specified";
  if (!endpoint || !apiKey) {
    return new Response("No paid TTS provider has been enabled. Set TTS_API_URL and TTS_API_KEY only after owner approval.", { status: 503, headers: corsHeaders });
  }

  const body = await request.json();
  if (!body?.text || !["greek", "latin"].includes(body.language)) return new Response("Invalid TTS request", { status: 400, headers: corsHeaders });
  const upstream = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text: body.text, language: body.language, voice: body.voice, pronunciationSystem: body.pronunciationSystem }),
  });
  if (!upstream.ok) return new Response(`TTS provider error: ${await upstream.text()}`, { status: 502, headers: corsHeaders });
  return new Response(upstream.body, {
    headers: {
      ...corsHeaders,
      "Content-Type": upstream.headers.get("Content-Type") || "audio/mpeg",
      "X-TTS-Provider": provider,
      "X-Pronunciation-System": pronunciation,
    },
  });
});
