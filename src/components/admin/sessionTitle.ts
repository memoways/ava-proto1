const ENV_LABELS: Record<string, string> = {
  prod: "Production",
  "sandbox-ulrich": "Ulrich",
  "sandbox-benoit": "Benoît",
  "sandbox-romed": "Romed",
};

interface TitleInput {
  environment_id: string;
  started_at: string | null;
  duration_seconds: number | null;
  game_over_reason: string | null;
  ended_at: string | null;
  conversation_log: Array<{ role?: string; content?: string }> | null;
  test_invitation_id?: string | null;
  tester_label?: string | null;
}

export function accountLabel(s: Pick<TitleInput, "environment_id" | "tester_label" | "test_invitation_id">): string {
  if (s.test_invitation_id && s.tester_label) return `Testeur ${s.tester_label}`;
  return ENV_LABELS[s.environment_id] ?? s.environment_id;
}

export function describeSession(s: TitleInput): string {
  const log = s.conversation_log ?? [];
  const userTurns = log.filter((m) => m.role === "user").length;
  const parts: string[] = [];
  if (userTurns === 0) parts.push("vide");
  else if (userTurns <= 3) parts.push(`test court (${userTurns} tours)`);
  else if (userTurns <= 10) parts.push(`échange moyen (${userTurns} tours)`);
  else parts.push(`longue conversation (${userTurns} tours)`);

  const reason = (s.game_over_reason ?? "").toLowerCase();
  const text = log.map((m) => m.content ?? "").join(" ").toLowerCase();
  if (reason.includes("timeout") || text.includes("timeout")) parts.push("timeout");
  if (/(error|erreur|fail|échec)/.test(reason) || /\[(error|erreur)/.test(text)) parts.push("erreurs");
  if (!s.ended_at) parts.push("non terminée");
  else if (reason && !parts.includes("timeout") && !parts.includes("erreurs")) parts.push(`fin : ${s.game_over_reason}`);
  return parts.join(", ");
}

export function autoSessionTitle(s: TitleInput): string {
  const date = s.started_at
    ? new Date(s.started_at).toLocaleString("fr-CH", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "date inconnue";
  return `${accountLabel(s)} · ${date} · ${describeSession(s)}`;
}
