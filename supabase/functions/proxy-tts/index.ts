import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { enforceGameRequest } from "../_shared/gameRequestGuard.ts";
import { buildElevenLabsModelParts } from "../_shared/elevenLabsModels.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface TTSRequest {
  text: string;
  voiceId?: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  speed?: number;
  useSpeakerBoost?: boolean;
  languageCode?: string;
  applyTextNormalization?: "auto" | "on" | "off";
  seed?: number;
  // Request stitching — prosodic context for natural inter-sentence flow
  previousText?: string;
  nextText?: string;
  /** `list_models`: returns the TTS models this account can use (ids and names only, never the key). */
  action?: "list_models";
  // Output format / latency tuning (overridable per call)
  outputFormat?: string;
  optimizeStreamingLatency?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  const denied = await enforceGameRequest(req, "proxy-tts", corsHeaders);
  if (denied) return denied;

  try {
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    if (!ELEVENLABS_API_KEY) {
      throw new Error('ELEVENLABS_API_KEY is not configured');
    }

    const body: TTSRequest = await req.json();

    if (body.action === 'list_models') {
      const listed = await fetch('https://api.elevenlabs.io/v1/models', { headers: { 'xi-api-key': ELEVENLABS_API_KEY } });
      const raw = await listed.text();
      if (!listed.ok) {
        return new Response(JSON.stringify({ error: `ElevenLabs error: ${listed.status}`, details: raw }),
          { status: listed.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const models = (JSON.parse(raw) as Array<{ model_id: string; name?: string; can_do_text_to_speech?: boolean }>)
        .filter((m) => m.can_do_text_to_speech)
        .map((m) => ({ id: m.model_id, name: m.name }));
      return new Response(JSON.stringify({ models }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!body.text || body.text.trim() === '') {
      throw new Error('Text is required');
    }

    const voiceId = body.voiceId || Deno.env.get('ELEVENLABS_VOICE_ID') || '';
    if (!voiceId) {
      throw new Error('Voice ID is required');
    }

    // Model-dependent parts: v3/v4 refuse optimize_streaming_latency (400 unsupported_model) and
    // stitching, deprecated Turbo ids are mapped to Flash, text is cut at the model limit.
    const parts = buildElevenLabsModelParts({
      text: body.text,
      modelId: body.modelId,
      optimizeStreamingLatency: body.optimizeStreamingLatency,
      previousText: body.previousText,
      nextText: body.nextText,
    });
    const modelId = parts.modelId;

    const voiceSettings = {
      stability: body.stability ?? 0.5,
      similarity_boost: body.similarityBoost ?? 0.75,
      style: body.style ?? 0.3,
      use_speaker_boost: body.useSpeakerBoost ?? true,
      speed: body.speed ?? 1.0,
    };

    // Defaults: prioritize diction and prosody. Latency optimizations can degrade quality.
    const outputFormat = body.outputFormat || 'mp3_44100_128';
    const languageCode = body.languageCode || 'fr';
    const applyTextNormalization = body.applyTextNormalization || 'on';

    const stitching = parts.stitching;
    const queryString = new URLSearchParams({ output_format: outputFormat, ...parts.query }).toString();

    console.log(`[proxy-tts] model=${modelId} voice=${voiceId} lang=${languageCode} norm=${applyTextNormalization} stab=${voiceSettings.stability} sim=${voiceSettings.similarity_boost} style=${voiceSettings.style} speed=${voiceSettings.speed} fmt=${outputFormat} lat=${parts.query.optimize_streaming_latency ?? 'omitted'} seed=${body.seed ?? "none"} stitch=${Object.keys(stitching).join('+') || 'none'} text=${parts.text.length}chars${parts.truncated ? '(truncated)' : ''}`);

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?${queryString}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: parts.text,
          model_id: modelId,
          language_code: languageCode,
          apply_text_normalization: applyTextNormalization,
          voice_settings: voiceSettings,
          ...(typeof body.seed === "number" ? { seed: body.seed } : {}),
          ...stitching,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[proxy-tts] ElevenLabs error [${response.status}]:`, errorText);
      return new Response(
        JSON.stringify({ error: `ElevenLabs error: ${response.status}`, details: errorText }),
        {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/mpeg',
        ...(response.headers.get('request-id') ? { 'X-ElevenLabs-Request-Id': response.headers.get('request-id')! } : {}),
        'Transfer-Encoding': 'chunked',
      },
    });

  } catch (error: unknown) {
    console.error('[proxy-tts] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
