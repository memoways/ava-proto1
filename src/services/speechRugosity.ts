/**
 * Rugosité de parole par personnage (réglage admin, 0 à 3).
 * 0 = comportement actuel : aucune consigne injectée.
 * Elle module la place des ruptures permises par la fiche, selon ses
 * déclencheurs — jamais les faits, le canon ni une rotation des états.
 */
export function normalizeRugosite(raw: unknown): number {
  const value = Math.round(Number(raw));
  return Number.isFinite(value) ? Math.min(3, Math.max(0, value)) : 0;
}

/** Names always come from the current character sheet, never a shared catalogue. */
export function selectSpeechState(raw: unknown, states: Array<{ name: string }>): string | null {
  if (typeof raw !== "string") return null;
  const name = states.find(state => state.name.toLocaleLowerCase("fr") === raw.trim().toLocaleLowerCase("fr"))?.name;
  return name ?? null;
}

/** Consigne injectée dans le prompt du personnage quand la rugosité > 0. */
export function rugositySpeechDirective(level: number): string {
  switch (normalizeRugosite(level)) {
    case 1:
      return "Rugosité 1/3 : laisse une place légère aux ruptures permises par ta fiche, selon ses déclencheurs. Une réponse nette reste possible ; aucun état ni tic obligatoire.";
    case 2:
      return "Rugosité 2/3 : laisse davantage de place aux ruptures permises par ta fiche, selon ses déclencheurs. Une réponse nette reste possible ; aucun état ni tic obligatoire.";
    case 3:
      return "Rugosité 3/3 : laisse pleinement leur place aux ruptures permises par ta fiche, selon ses déclencheurs. Une réponse nette reste possible ; aucun état ni tic obligatoire.";
    default:
      return "";
  }
}

/** Consigne injectée dans le prompt du GM pour le choix de l'état suivant. */
export function rugosityDirectorDirective(level: number): string {
  switch (normalizeRugosite(level)) {
    case 1:
      return "Rugosité réglée à 1/3 : place légère aux ruptures permises par la fiche, selon ses déclencheurs. Une réponse nette reste possible ; aucun état à privilégier systématiquement.";
    case 2:
      return "Rugosité réglée à 2/3 : davantage de place aux ruptures permises par la fiche, selon ses déclencheurs. Une réponse nette reste possible ; aucun état à privilégier systématiquement.";
    case 3:
      return "Rugosité réglée à 3/3 : pleine place aux ruptures permises par la fiche, selon ses déclencheurs. Une réponse nette reste possible ; aucun état à privilégier systématiquement.";
    default:
      return "Rugosité réglée à 0/3 : reste sobre, comportement actuel.";
  }
}
