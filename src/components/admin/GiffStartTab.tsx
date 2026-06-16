/** Admin — Démarrage GIFF : édite la variante et les textes du flow court. */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  GIFF_START_DEFAULTS,
  loadGiffStartSettingsFromDB,
  saveGiffStartSettings,
  type AvaStartVariant,
  type GiffStartSettings,
} from "@/services/giffStartSettings";

const VARIANTS: { value: AvaStartVariant; label: string; hint: string }[] = [
  { value: "gm_host", label: "GM host (texte)", hint: "Bandeau « Game Master » visible sur chaque écran d'onboarding." },
  { value: "gm_invisible", label: "GM invisible", hint: "Aucun marqueur GM, écrans neutres." },
  { value: "voiceover_hybrid", label: "Voix off hybride", hint: "Phrase d'intro stylée « voix off » sans GM visible." },
];

export default function GiffStartTab() {
  const [s, setS] = useState<GiffStartSettings>(GIFF_START_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const loaded = await loadGiffStartSettingsFromDB();
      setS(loaded);
      setLoading(false);
    })();
  }, []);

  const update = <K extends keyof GiffStartSettings>(key: K, value: GiffStartSettings[K]) =>
    setS((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveGiffStartSettings(s);
      toast({ title: "Démarrage GIFF enregistré", description: "Les nouveaux paramètres s'appliquent à la prochaine session." });
    } catch (err) {
      toast({ title: "Échec d'enregistrement", description: String(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => setS({ ...GIFF_START_DEFAULTS });

  if (loading) return <p className="text-sm text-muted-foreground">Chargement…</p>;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Démarrage GIFF</h2>
        <p className="text-sm text-muted-foreground">
          Configure le démarrage court (&lt; 45s) de l'expérience pour l'installation GIFF. Voir{" "}
          <em>PRD — Démarrage AVA pour installation GIFF</em>.
        </p>
      </div>

      <div className="rounded-lg border p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base">Utiliser le flow GIFF court</Label>
            <p className="text-xs text-muted-foreground">
              Si désactivé, l'ancien flow long (création complète de personnage) reste actif.
            </p>
          </div>
          <Switch checked={s.use_giff_flow} onCheckedChange={(v) => update("use_giff_flow", v)} />
        </div>

        <div className="space-y-2">
          <Label>Variante active</Label>
          <Select
            value={s.active_start_variant}
            onValueChange={(v) => update("active_start_variant", v as AvaStartVariant)}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {VARIANTS.map((v) => (
                <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {VARIANTS.find((v) => v.value === s.active_start_variant)?.hint}
          </p>
        </div>

        <div className="space-y-2">
          <Label>Durée cible (secondes)</Label>
          <Input
            type="number"
            min={15}
            max={120}
            value={s.max_start_duration_seconds}
            onChange={(e) => update("max_start_duration_seconds", Number(e.target.value) || 45)}
          />
        </div>
      </div>

      <div className="rounded-lg border p-4 space-y-4">
        <h3 className="font-semibold">Textes UX</h3>

        <div className="space-y-2">
          <Label>Accueil</Label>
          <Input value={s.welcome_text} onChange={(e) => update("welcome_text", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Promesse</Label>
          <Textarea rows={2} value={s.promise_text} onChange={(e) => update("promise_text", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Rappel court (si « non » ou « rappel »)</Label>
          <Textarea rows={4} value={s.teaser_text_short} onChange={(e) => update("teaser_text_short", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Question / posture</Label>
          <Textarea rows={2} value={s.posture_question} onChange={(e) => update("posture_question", e.target.value)} />
        </div>
        <div className="flex items-center justify-between">
          <Label>Activer le bouton « Me laisser surprendre »</Label>
          <Switch checked={s.allow_surprise_me} onCheckedChange={(v) => update("allow_surprise_me", v)} />
        </div>
      </div>

      <div className="rounded-lg border p-4 space-y-4">
        <h3 className="font-semibold">Textes spécifiques aux variantes</h3>
        <div className="space-y-2">
          <Label>GM host — intro</Label>
          <Textarea rows={2} value={s.gm_host_intro_text} onChange={(e) => update("gm_host_intro_text", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>GM host — passage de main</Label>
          <Textarea rows={2} value={s.gm_host_handoff_text} onChange={(e) => update("gm_host_handoff_text", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Voix off — phrase d'intro</Label>
          <Textarea rows={2} value={s.voiceover_intro_text} onChange={(e) => update("voiceover_intro_text", e.target.value)} />
        </div>
      </div>

      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </Button>
        <Button variant="outline" onClick={handleReset}>
          Reset aux valeurs PRD
        </Button>
      </div>
    </div>
  );
}
