/**
 * Rugosité de parole par personnage (réglage admin, 0 à 3).
 * 0 = comportement actuel : aucune consigne injectée.
 * Elle module la fréquence des états bloqués, des ruptures et la tolérance
 * au silence — jamais les faits ni le canon.
 */
export function normalizeRugosite(raw: unknown): number {
  const value = Math.round(Number(raw));
  return Number.isFinite(value) ? Math.min(3, Math.max(0, value)) : 0;
}

/** Names always come from the current character sheet, never a shared catalogue. */
export function selectSpeechState(raw: unknown, states: Array<{ name: string }>, recent: Array<string | null> = []): string | null {
  if (typeof raw !== "string") return null;
  const name = states.find(state => state.name.toLocaleLowerCase("fr") === raw.trim().toLocaleLowerCase("fr"))?.name;
  if (!name) return null;
  const previous = recent.slice(0, 2);
  return previous.length === 2 && previous.every(state => state === name) ? null : name;
}

/** Consigne injectée dans le prompt du personnage quand la rugosité > 0. */
export function rugositySpeechDirective(level: number): string {
  switch (normalizeRugosite(level)) {
    case 1:
      return "Rugosité 1/3 : de temps en temps, laisse passer une hésitation, une phrase qui se reprend ou un court silence. Ne lisse pas tout.";
    case 2:
      return "Rugosité 2/3 : souvent, ta parole se trouble — phrases reprises, mots qui manquent, silences. Ne cherche pas la fluidité.";
    case 3:
      return "Rugosité 3/3 : ta parole est rugueuse — blocages, ruptures et silences longs sont fréquents et acceptés. Ne cherche jamais la fluidité.";
    default:
      return "";
  }
}

/** Consigne injectée dans le prompt du GM pour le choix de l'état suivant. */
export function rugosityDirectorDirective(level: number): string {
  switch (normalizeRugosite(level)) {
    case 1:
      return "Rugosité réglée à 1/3 : tu peux parfois proposer un état hésitant ou retenu.";
    case 2:
      return "Rugosité réglée à 2/3 : propose souvent des états troublés, des ruptures ou du silence.";
    case 3:
      return "Rugosité réglée à 3/3 : privilégie les états bloqués, les ruptures et les silences longs.";
    default:
      return "Rugosité réglée à 0/3 : reste sobre, comportement actuel.";
  }
}
