/**
 * « Nouvelles de Gamiways » — inscription depuis AVA.
 *
 * Memoways gère la newsletter (double opt-in, Mesh, Plunk). AVA transmet seulement la
 * demande d'une personne qui a coché la case : elle reçoit ensuite un email de
 * confirmation et n'est abonnée qu'après l'avoir confirmé. Aucun secret, aucune preuve
 * stockée ici ; un échec ne bloque jamais le questionnaire.
 */
import { loadNewsletterSettingsFromDB, newsletterDefaults, type NewsletterSettings } from "./settingsService";

export const GAMIWAYS_NEWS_CONSENT_FR =
  "Je souhaite recevoir les Nouvelles de Gamiways (dont AVA) par email. Un email de confirmation me sera envoyé ; je peux me désinscrire à tout moment.";

export type NewsletterRequestResult = "requested" | "skipped" | "failed";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function requestGamiwaysNews(input: {
  email: string | undefined;
  optIn: boolean;
  locale?: "fr" | "en";
  source?: "ava-questionnaire" | "ava-landing";
  settings?: NewsletterSettings;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<NewsletterRequestResult> {
  const email = input.email?.trim() ?? "";
  if (!input.optIn || !EMAIL.test(email) || email.length > 254) return "skipped";
  let settings = input.settings;
  if (!settings) {
    try {
      settings = await loadNewsletterSettingsFromDB();
    } catch {
      settings = newsletterDefaults;
    }
  }
  if (!settings.ENABLED) return "skipped";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 8000);
  try {
    const response = await (input.fetchImpl ?? fetch)(settings.SUBSCRIBE_URL, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: "gamiways",
        email,
        firstName: "",
        lastName: "",
        consent: true,
        locale: input.locale ?? "fr",
        source: input.source ?? "ava-questionnaire",
        website: "",
      }),
      signal: controller.signal,
    });
    // 202 is the same for new, pending or limited addresses: nothing more is learned.
    return response.status === 202 ? "requested" : "failed";
  } catch {
    return "failed";
  } finally {
    clearTimeout(timer);
  }
}
