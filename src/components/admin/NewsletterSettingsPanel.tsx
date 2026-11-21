import { useEffect, useState } from "react";
import { Mail, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  loadNewsletterSettingsFromDB,
  newsletterDefaults,
  saveNewsletterSettingsToDB,
  type NewsletterSettings,
} from "@/services/settingsService";

/** Admin switch for sending « tenu·e au courant » requests to the Memoways newsletter. */
export function NewsletterSettingsPanel() {
  const [settings, setSettings] = useState<NewsletterSettings>(newsletterDefaults);
  const [saved, setSaved] = useState<NewsletterSettings>(newsletterDefaults);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadNewsletterSettingsFromDB().then((value) => {
      setSettings(value);
      setSaved(value);
    });
  }, []);

  async function save() {
    setSaving(true);
    try {
      await saveNewsletterSettingsToDB(settings);
      setSaved(settings);
      toast.success("Réglage newsletter enregistré ✓");
    } catch (err) {
      toast.error("Erreur sauvegarde : " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-3 rounded-lg border p-4" data-testid="newsletter-settings">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Mail className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <h3 className="font-semibold">Nouvelles de Gamiways</h3>
            <p className="text-xs text-muted-foreground">
              Activé, une personne qui laisse son email et coche « Nouvelles de Gamiways » reçoit l’email de confirmation
              de Memoways (double opt-in). Elle n’est abonnée qu’après confirmation ; la liste vit dans Mesh et l’envoi
              dans Plunk. À activer seulement quand le sujet Gamiways est ouvert sur memoways.com.
            </p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => void save()}
          disabled={saving || settings.ENABLED === saved.ENABLED}
        >
          <Save className="mr-1 h-3.5 w-3.5" />Enregistrer
        </Button>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Switch
          checked={settings.ENABLED}
          onCheckedChange={(ENABLED) => setSettings((current) => ({ ...current, ENABLED }))}
          aria-label="Envoyer les demandes Nouvelles de Gamiways"
        />
        Envoyer les demandes à Memoways
      </label>
    </section>
  );
}
