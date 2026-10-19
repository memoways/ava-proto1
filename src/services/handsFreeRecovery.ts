/**
 * Reprise automatique du micro en conversation mains libres.
 *
 * Une coupure du flux STT (WebSocket fermée, erreur fournisseur, capture
 * remplacée pendant un transfert de personnage…) ne doit pas obliger le joueur
 * à réactiver le micro : la conversation vit dans l'état de la page, seul le
 * flux audio est à rouvrir. Logique pure, sans dépendance au navigateur.
 */

export const MIC_RECOVERY_DELAYS_MS = [300, 1_000, 2_500] as const;

/** Nombre de contrôles consécutifs « micro mort » avant de relancer la capture. */
export const MIC_WATCHDOG_STRIKES = 2;

export interface MicRecoveryPolicy {
  /** Délai avant la prochaine tentative, ou `null` quand le budget est épuisé. */
  next(): number | null;
  /** Le micro a de nouveau livré de la parole : le budget est rendu. */
  reset(): void;
  readonly attempts: number;
}

export function createMicRecoveryPolicy(delays: readonly number[] = MIC_RECOVERY_DELAYS_MS): MicRecoveryPolicy {
  let attempts = 0;
  return {
    get attempts() { return attempts; },
    next() {
      if (attempts >= delays.length) return null;
      return delays[attempts++];
    },
    reset() { attempts = 0; },
  };
}

export interface MicWatchdogSnapshot {
  /** Le joueur (ou une reprise) a demandé un micro ouvert. */
  listening: boolean;
  ended: boolean;
  /** Vidéo, appel ou transfert en cours : le micro est volontairement coupé. */
  blocked: boolean;
  /** Une ouverture du micro est déjà en cours ou programmée. */
  starting: boolean;
  /** Le fournisseur STT courant est connecté. */
  sttActive: boolean;
}

/** Le micro devrait écouter, mais plus aucun flux STT n'est connecté. */
export function isMicSilentlyDead(snapshot: MicWatchdogSnapshot): boolean {
  if (!snapshot.listening || snapshot.ended || snapshot.blocked || snapshot.starting) return false;
  return !snapshot.sttActive;
}
