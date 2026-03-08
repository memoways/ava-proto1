const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;

interface DeepgramConfig {
  key: string;
  model: string;
  language: string;
}

export async function getDeepgramToken(): Promise<DeepgramConfig> {
  const res = await fetch(
    `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/proxy-stt`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }
  );
  if (!res.ok) throw new Error(`Failed to get Deepgram token: ${res.status}`);
  return res.json();
}

type TranscriptCallback = (text: string, isFinal: boolean) => void;

export class DeepgramSTT {
  private ws: WebSocket | null = null;
  private onTranscript: TranscriptCallback;
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;

  constructor(onTranscript: TranscriptCallback) {
    this.onTranscript = onTranscript;
  }

  async start() {
    const config = await getDeepgramToken();

    // Get microphone
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Connect to Deepgram WebSocket
    const wsUrl = `wss://api.deepgram.com/v1/listen?model=${config.model}&language=${config.language}&smart_format=true&interim_results=true&vad_events=true&endpointing=300`;

    this.ws = new WebSocket(wsUrl, ['token', config.key]);

    this.ws.onopen = () => {
      console.log('[Deepgram] WebSocket connected');
      this.startRecording();
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'Results') {
        const transcript = data.channel?.alternatives?.[0]?.transcript || '';
        if (transcript) {
          const isFinal = data.is_final;
          this.onTranscript(transcript, isFinal);
        }
      }
    };

    this.ws.onerror = (err) => {
      console.error('[Deepgram] WebSocket error:', err);
    };

    this.ws.onclose = () => {
      console.log('[Deepgram] WebSocket closed');
    };
  }

  private startRecording() {
    if (!this.stream || !this.ws) return;

    // Use MediaRecorder to capture audio chunks
    this.mediaRecorder = new MediaRecorder(this.stream, {
      mimeType: 'audio/webm;codecs=opus',
    });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0 && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(event.data);
      }
    };

    this.mediaRecorder.start(250); // Send chunks every 250ms
  }

  stop() {
    if (this.mediaRecorder?.state !== 'inactive') {
      this.mediaRecorder?.stop();
    }
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.ws = null;
    this.mediaRecorder = null;
    this.stream = null;
  }
}
