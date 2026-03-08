import { useState } from "react";
import { Info, ClipboardList } from "lucide-react";
import type { AudioState } from "@/types";
import SubtitleOverlay from "./SubtitleOverlay";

interface ConversationScreenProps {
  timerFormatted: string;
  timerWarning: boolean;
  trustLevel: number;
  trustThreshold: number;
  audioState: AudioState;
  userSubtitle: string;
  maxSubtitle: string;
  onMicToggle: () => void;
  micActive: boolean;
  micEverStarted: boolean;
  elapsedSeconds: number;
  onEarlyQuestionnaire?: () => void;
}

const statusLabels: Record<AudioState, string> = {
  idle: "En attente…",
  user_speaking: "Max écoute…",
  max_thinking: "Max réfléchit…",
  max_speaking: "Max parle…",
};

const EARLY_QUESTIONNAIRE_DELAY = 240; // 4 minutes

const ConversationScreen = ({
  timerFormatted,
  timerWarning,
  trustLevel,
  trustThreshold,
  audioState,
  userSubtitle,
  maxSubtitle,
  onMicToggle,
  micActive,
  micEverStarted,
  elapsedSeconds,
  onEarlyQuestionnaire,
}: ConversationScreenProps) => {
  const [showInfo, setShowInfo] = useState(false);
  const showQuestionnaire = elapsedSeconds >= EARLY_QUESTIONNAIRE_DELAY && onEarlyQuestionnaire;

  const trustPercent = Math.min(100, (trustLevel / trustThreshold) * 100);

  return (
    <div 
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden"
      style={{
        backgroundImage: 'url(/assets/max-bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* Background overlay */}
      <div className="absolute inset-0 bg-black/40 pointer-events-none" />
      {/* Vignette */}
      <div className="absolute inset-0 cinema-vignette pointer-events-none z-10" />
      <div className="absolute inset-0 cinema-gradient pointer-events-none" />

      {/* HUD: Timer + Trust cartouche — top left */}
      <div className="absolute top-5 left-5 z-20 group">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border/20 bg-black/30 backdrop-blur-sm">
          {/* Timer */}
          <div className="flex flex-col items-center">
            <span className={`font-mono text-sm tabular-nums ${timerWarning ? "text-timer-warning" : "text-muted-foreground/70"}`}>
              {timerFormatted}
            </span>
          </div>

          {/* Separator */}
          <div className="w-px h-5 bg-border/20" />

          {/* Trust gauge */}
          <div className="flex items-center gap-2">
            <div className="w-16 h-1.5 rounded-full bg-border/20 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${trustPercent}%`,
                  background: trustLevel >= trustThreshold
                    ? 'hsl(var(--primary))'
                    : trustLevel > trustThreshold * 0.5
                      ? 'hsl(var(--trust))'
                      : 'hsl(var(--muted-foreground) / 0.4)',
                }}
              />
            </div>
            <span className="font-mono text-[10px] text-muted-foreground/40">
              {trustLevel}/{trustThreshold}
            </span>
          </div>
        </div>

        {/* Hover tooltip */}
        <div className="absolute top-full left-0 mt-2 w-72 px-3 py-2.5 rounded-lg border border-border/30 bg-black/80 backdrop-blur-md text-xs text-muted-foreground/80 leading-relaxed opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-200 z-30">
          <p className="mb-1.5">
            <strong className="text-foreground/90">⏱ Timer</strong> — Temps restant de la session. L'expérience dure 10 minutes maximum.
          </p>
          <p>
            <strong className="text-foreground/90">◆ Confiance</strong> — Niveau de confiance que Max vous accorde. Plus vos réponses sont sincères et engagées, plus la jauge monte. Atteignez le seuil pour débloquer la suite de l'histoire.
          </p>
        </div>
      </div>

      {/* Info button — top right, more visible */}
      <button
        onClick={() => setShowInfo(true)}
        className="absolute top-5 right-5 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-border/30 bg-black/40 text-muted-foreground/70 hover:text-foreground hover:bg-black/60 hover:border-border/50 transition-all backdrop-blur-sm"
        title="À propos du projet"
      >
        <Info size={16} />
      </button>

      {/* Status centered */}
      <div className="relative z-10 flex flex-col items-center gap-4 mt-[40vh]">
        <p className="text-sm font-mono text-muted-foreground animate-fade-in">
          {statusLabels[audioState]}
          {audioState === "max_thinking" && (
            <span className="ml-1">
              <span className="animate-typing-dot-1">.</span>
              <span className="animate-typing-dot-2">.</span>
              <span className="animate-typing-dot-3">.</span>
            </span>
          )}
        </p>

        {/* Mic hint */}
        {audioState === "idle" && !micActive && (
          <p className="text-xs text-muted-foreground/60 animate-fade-in">
            Cliquez sur le micro pour parler à Max
          </p>
        )}
      </div>

      {/* Mic button */}
      <div className="absolute bottom-32 z-20">
        <button
          onClick={onMicToggle}
          className={`flex h-16 w-16 items-center justify-center rounded-full border-2 transition-all ${
            micActive
              ? "border-primary bg-primary/10 text-primary animate-pulse-mic"
              : "border-border bg-secondary text-muted-foreground hover:border-primary/50"
          }`}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" x2="12" y1="19" y2="22" />
          </svg>
        </button>
      </div>

      {/* Early questionnaire tab — appears after 4 min */}
      {showQuestionnaire && (
        <button
          onClick={onEarlyQuestionnaire}
          className="absolute bottom-6 right-6 z-20 flex items-center gap-2 px-3 py-2 rounded-lg border border-border/30 bg-black/40 text-muted-foreground/70 hover:text-foreground hover:bg-black/60 transition-all backdrop-blur-sm text-xs animate-fade-in"
        >
          <ClipboardList size={14} />
          Questionnaire
        </button>
      )}

      {/* Subtitles */}
      <SubtitleOverlay userText={userSubtitle} maxText={maxSubtitle} audioState={audioState} />

      {/* Info Modal */}
      {showInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowInfo(false)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="relative max-w-lg w-full max-h-[80vh] overflow-y-auto rounded-xl border border-border/50 bg-background/95 backdrop-blur-md p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowInfo(false)}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors text-lg"
            >
              ✕
            </button>

            <h2 className="text-lg font-bold mb-1">À propos — "Où est Ava ?"</h2>
            <p className="text-xs text-muted-foreground mb-4">Prototype 1 — Recherche & Développement</p>

            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <p>
                <strong className="text-foreground">Concept.</strong> Vous participez à un prototype d'expérience narrative interactive. 
                Vous êtes en appel avec <strong className="text-foreground">Max</strong>, un personnage fictif de 50 ans dont la fille, Ava, a disparu. 
                Max cherche à comprendre ce qui s'est passé et évalue si vous êtes digne de confiance.
              </p>

              <p>
                <strong className="text-foreground">Comment ça marche.</strong> La conversation est entièrement pilotée par intelligence artificielle : 
                votre voix est transcrite en temps réel (Speech-to-Text), analysée par un modèle de langage qui incarne Max, 
                puis sa réponse est synthétisée en voix (Text-to-Speech). Un "Game Master" IA invisible orchestre l'expérience : 
                il évalue votre niveau de confiance, déclenche des cinématiques et gère la progression narrative.
              </p>

              <p>
                <strong className="text-foreground">Objectif du prototype.</strong> Ce prototype valide le pipeline technique complet 
                d'une conversation voice-to-voice avec un personnage IA autonome. Il teste la mécanique d'interaction, 
                la gestion de la confiance, les triggers narratifs et le système RAG (Retrieval-Augmented Generation) 
                qui alimente Max avec sa mémoire et son univers.
              </p>

              <p>
                <strong className="text-foreground">Ce qu'on teste.</strong> La fluidité de la conversation, 
                la qualité de l'immersion, la latence perçue, et si le format "parler à un personnage IA" 
                crée une expérience engageante. Vos retours via le questionnaire sont essentiels pour itérer.
              </p>

              <p>
                <strong className="text-foreground">Limitations connues.</strong> Les vidéos sont en mode placeholder 
                (écran texte au lieu de vraies cinématiques). L'interface est minimaliste — le focus est sur la mécanique, 
                pas le design final. Desktop uniquement (Chrome recommandé).
              </p>

              <p>
                <strong className="text-foreground">Indicateurs en jeu.</strong> En haut à gauche, le timer indique le temps restant (10 min). 
                La jauge de confiance mesure comment Max vous perçoit : réponses sincères = confiance qui monte, 
                évasives = confiance qui stagne ou baisse. Atteignez le seuil pour débloquer la suite narrative.
              </p>

              <div className="pt-2 border-t border-border/30">
                <p className="text-xs text-muted-foreground/60">
                  Projet Storygami — Prototype de recherche — Mars 2026
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConversationScreen;
