import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  getPrivacyPreferences,
  savePrivacyPreferences,
  type PrivacyPreferences,
} from "@/services/privacyConsent";

export default function Privacy() {
  const [preferences, setPreferences] = useState<PrivacyPreferences | null>(() => getPrivacyPreferences());

  const setAnalytics = (analyticsAllowed: boolean) => {
    setPreferences(savePrivacyPreferences({
      voiceAndStorageAcknowledged: preferences?.voiceAndStorageAcknowledged === true,
      analyticsAllowed,
    }));
  };

  return (
    <main className="min-h-screen bg-background px-6 py-12 text-foreground">
      <article className="mx-auto max-w-3xl space-y-8">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">AVA Proto 1 — tests internes</p>
          <h1 className="font-serif text-4xl">Confidentialité et données</h1>
          <p className="text-sm text-muted-foreground">Version du 13 juillet 2026</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Ce qui est nécessaire à l’expérience</h2>
          <p>
            Le microphone est utilisé uniquement lorsque tu déclenches un enregistrement. L’audio est transmis au
            fournisseur de transcription sélectionné par l’équipe. La transcription sert ensuite à générer la réponse
            du personnage via les services narratifs, puis cette réponse est transformée en voix.
          </p>
          <p>
            La conversation, le rôle choisi, le questionnaire et les mesures techniques sont enregistrés dans Supabase
            sous un identifiant pseudonyme. Ils servent à analyser la qualité du prototype et ne doivent pas contenir
            d’informations que tu ne souhaites pas partager.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Mesures optionnelles</h2>
          <p>
            Avec ton accord, PostHog Cloud EU et Grain reçoivent uniquement des événements techniques structurés :
            étapes du parcours, durées, erreurs et état de persistance. L’autocapture, les cartes de chaleur et les
            enregistrements de session sont désactivés. Les transcriptions et réponses libres ne sont pas envoyées à ces outils.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setAnalytics(true)} disabled={preferences?.analyticsAllowed === true}>
              Autoriser les mesures
            </Button>
            <Button variant="outline" onClick={() => setAnalytics(false)} disabled={preferences?.analyticsAllowed !== true}>
              Refuser les mesures
            </Button>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Durée et droits</h2>
          <p>
            Les données des campagnes de test ont une durée de conservation cible de 30 jours. La purge automatique et
            la procédure de suppression doivent être activées avant l’ouverture à des testeurs externes. Tu peux demander
            l’accès ou la suppression de ta session auprès du responsable qui t’a transmis l’invitation au test.
          </p>
        </section>

        <p className="text-sm text-muted-foreground">
          Aucun choix analytics n’empêche d’utiliser l’expérience. Le traitement vocal et la conservation de la session
          restent nécessaires au protocole de test.
        </p>

        <Button asChild variant="secondary">
          <Link to="/">Retour à l’expérience</Link>
        </Button>
      </article>
    </main>
  );
}
