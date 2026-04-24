import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
  // Request stitching — prosodic context for natural inter-sentence flow
  previousText?: string;
  nextText?: string;
  // Output format / latency tuning (overridable per call)
  outputFormat?: string;
  optimizeStreamingLatency?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    if (!ELEVENLABS_API_KEY) {
      throw new Error('ELEVENLABS_API_KEY is not configured');
    }

    const body: TTSRequest = await req.json();
    
    if (!body.text || body.text.trim() === '') {
      throw new Error('Text is required');
    }

    const voiceId = body.voiceId || Deno.env.get('ELEVENLABS_VOICE_ID') || '';
    if (!voiceId) {
      throw new Error('Voice ID is required');
    }

    const modelId = body.modelId || 'eleven_turbo_v2_5';

    const voiceSettings = {
      stability: body.stability ?? 0.5,
      similarity_boost: body.similarityBoost ?? 0.75,
      style: body.style ?? 0.3,
      use_speaker_boost: body.useSpeakerBoost ?? true,
      speed: body.speed ?? 1.0,
    };

    // Defaults: HD audio + moderate streaming latency for natural prosody
    const outputFormat = body.outputFormat || 'mp3_44100_128';
    const optimizeLatency = body.optimizeStreamingLatency ?? 2;

    const stitching = {
      ...(body.previousText && body.previousText.trim() ? { previous_text: body.previousText.slice(-500) } : {}),
      ...(body.nextText && body.nextText.trim() ? { next_text: body.nextText.slice(0, 500) } : {}),
    };

    console.log(`[proxy-tts] model=${modelId} voice=${voiceId} stab=${voiceSettings.stability} sim=${voiceSettings.similarity_boost} style=${voiceSettings.style} speed=${voiceSettings.speed} fmt=${outputFormat} lat=${optimizeLatency} stitch=${Object.keys(stitching).join('+') || 'none'} text=${body.text.length}chars`);

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=${outputFormat}&optimize_streaming_latency=${optimizeLatency}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: body.text,
          model_id: modelId,
          voice_settings: voiceSettings,
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
