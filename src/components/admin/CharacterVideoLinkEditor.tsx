import { TavusCharacterFields } from "@/components/StreamingAvatarConfigTab";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { adminTabPath } from "@/services/adminNavigation";
import { describeNextCall } from "@/services/callVideoRouting";
import { getDeviceServices } from "@/services/deviceServices";
import { AVATAR_LABELS } from "@/services/effectiveVoice";
import {
  getOutputSettings,
  withCharacterVideoChoice,
  type CharacterVideoChoice,
} from "@/services/streamingAvatar/settings";
import type { CharacterVideoLink, OutputMode, StreamingAvatarSettings } from "@/services/streamingAvatar/types";
import {
  NUANCE_DRIVE_MODES,
  NUANCE_PERSONAS,
  SELECTABLE_STREAMING_AVATAR_PROVIDERS,
  type NuanceDriveMode,
} from "../../../supabase/functions/_shared/streamingAvatarRequest";

const GLOBAL = "__global__";
const NONE = "none";
const DRIVE_LABELS: Record<NuanceDriveMode, string> = {
  verbatim: "Texte d’Ava",
  native: "Conversation Nuance",
};

/** Fields left empty follow the global settings, which carry Max's face and voice. */
function inheritedFields({ link, tavus }: CharacterVideoChoice): string[] {
  switch (link?.provider) {
    case "anam":
    case "heygen":
      return [...(link.avatarId ? [] : ["Avatar ID"]), ...(link.voiceId ? [] : ["Voice ID vidéo"])];
    case "tavus":
      return tavus.faceId ? [] : ["Face ID"];
    case "lemonslice":
      return link.agentId || link.agentImageUrl ? [] : ["Agent ID ou image"];
    default:
      return [];
  }
}

/** One line for the folded « Vidéo » block. */
export function characterVideoSummary({ link, tavus }: CharacterVideoChoice): string {
  if (!link) return "Suit le réglage global";
  if (link.provider === "none") return "Pas de vidéo";
  const label = AVATAR_LABELS[link.provider];
  switch (link.provider) {
    case "tavus":
      return tavus.faceId ? `${label} · Face ${tavus.faceId}` : label;
    case "nuance":
      return link.personaId ? `${label} · ${link.personaId}` : label;
    case "heygen":
    case "anam":
      return link.avatarId ? `${label} · avatar ${link.avatarId}` : label;
    case "lemonslice":
      return link.agentId ? `${label} · agent ${link.agentId}` : label;
  }
}

interface Props {
  characterKey: string;
  characterName: string;
  settings: StreamingAvatarSettings;
  choice: CharacterVideoChoice;
  onChange: (choice: CharacterVideoChoice) => void;
  /** Global switch « Voix / Vidéo »; defaults to the local copy of the stored setting. */
  configuredMode?: OutputMode;
}

/** Video service of one character: global rule, « Pas de vidéo » or a provider and its own fields. */
export function CharacterVideoLinkEditor({ characterKey, characterName, settings, choice, onChange, configuredMode }: Props) {
  const { link } = choice;
  const globalMode = configuredMode ?? getOutputSettings().mode;
  // Desktop following the global switch: the reference case of the admin screens.
  const nextCall = describeNextCall({
    character: characterKey,
    configuredMode: globalMode,
    deviceClass: "desktop",
    deviceServices: getDeviceServices().desktop,
    avatar: withCharacterVideoChoice(settings, characterKey, choice),
  });
  const inherited = characterKey === "max" ? [] : inheritedFields(choice);
  const setLink = (next: CharacterVideoLink | null) => onChange({ ...choice, link: next });
  /** An emptied field is removed so the character follows the global value again. */
  const patch = (field: string, value: string | number | undefined) => {
    const next: Record<string, unknown> = { ...link, [field]: value };
    if (value === undefined || value === "") delete next[field];
    setLink(next as unknown as CharacterVideoLink);
  };
  const textField = (label: string, field: string, value: string | undefined, global: string) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        aria-label={`${label} ${characterName}`}
        value={value ?? ""}
        placeholder={global ? `Global (${global})` : "Réglage global (vide)"}
        onChange={(event) => patch(field, event.target.value)}
      />
    </div>
  );

  return (
    <div className="space-y-2 rounded border p-2">
      <label className="text-xs font-medium">Service vidéo</label>
      <Select
        value={link?.provider ?? GLOBAL}
        onValueChange={(value) => setLink(value === GLOBAL ? null : { provider: value } as CharacterVideoLink)}
      >
        <SelectTrigger aria-label={`Service vidéo ${characterName}`}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={GLOBAL}>Suivre le réglage global</SelectItem>
          <SelectItem value={NONE}>Pas de vidéo (voix seule)</SelectItem>
          {SELECTABLE_STREAMING_AVATAR_PROVIDERS.map((provider) => (
            <SelectItem key={provider} value={provider}>{AVATAR_LABELS[provider]}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {link?.provider === "nuance" && (
        <div className="grid gap-2 md:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-xs">Persona</Label>
            <Select value={link.personaId ?? GLOBAL} onValueChange={(value) => patch("personaId", value === GLOBAL ? undefined : value)}>
              <SelectTrigger aria-label={`Persona ${characterName}`}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={GLOBAL}>Global ({settings.nuance.personaId})</SelectItem>
                {NUANCE_PERSONAS.map((persona) => <SelectItem key={persona} value={persona}>{persona}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Expressivité (0 à 2)</Label>
            <Input
              aria-label={`Expressivité ${characterName}`}
              type="number"
              min={0}
              max={2}
              step={0.1}
              value={link.expressiveness ?? ""}
              placeholder={`Global (${settings.nuance.expressiveness})`}
              onChange={(event) => patch("expressiveness", event.target.value === ""
                ? undefined
                : Math.min(2, Math.max(0, Number(event.target.value))))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Mode</Label>
            <Select value={link.drive ?? GLOBAL} onValueChange={(value) => patch("drive", value === GLOBAL ? undefined : value)}>
              <SelectTrigger aria-label={`Mode Nuance ${characterName}`}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={GLOBAL}>Global ({DRIVE_LABELS[settings.nuance.drive]})</SelectItem>
                {NUANCE_DRIVE_MODES.map((mode) => <SelectItem key={mode} value={mode}>{DRIVE_LABELS[mode]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-amber-300/90 md:col-span-3">
            Nuance parle anglais avec la voix de la persona. En « Conversation Nuance », il répond avec son propre texte.
          </p>
        </div>
      )}
      {link?.provider === "heygen" && (
        <div className="grid gap-2 md:grid-cols-2">
          {textField("Avatar ID", "avatarId", link.avatarId, settings.heygen.avatarId)}
          {textField("Voice ID vidéo", "voiceId", link.voiceId, settings.heygen.voiceId)}
        </div>
      )}
      {link?.provider === "anam" && (
        <div className="grid gap-2 md:grid-cols-2">
          {textField("Avatar ID", "avatarId", link.avatarId, settings.anam.avatarId)}
          {textField("Voice ID vidéo", "voiceId", link.voiceId, settings.anam.voiceId)}
        </div>
      )}
      {link?.provider === "lemonslice" && (
        <div className="grid gap-2 md:grid-cols-2">
          {textField("Agent ID", "agentId", link.agentId, settings.lemonslice.agentId)}
          {textField("Image (URL https)", "agentImageUrl", link.agentImageUrl, settings.lemonslice.agentImageUrl)}
        </div>
      )}
      {link?.provider === "tavus" && (
        <TavusCharacterFields
          title={`${characterName} sur Tavus`}
          value={settings.tavus}
          override={choice.tavus}
          onChange={(tavus) => onChange({ ...choice, tavus })}
        />
      )}

      {inherited.length > 0 && (
        <p role="alert" className="text-xs text-amber-300/90">
          Encore vide : {inherited.join(", ")}. {characterName} prendrait alors le réglage global, celui de Max.
        </p>
      )}

      <p className="text-xs" data-testid={`next-call-${characterKey}`}>
        <span className="font-medium">Prochain appel sur ordinateur :</span> {nextCall}
      </p>
      <p className="text-xs text-muted-foreground">
        L’interrupteur global sur « Voix seule » coupe la vidéo pour tous les personnages. Quand il est sur « Avatar vidéo » :
        {" "}« Pas de vidéo » donne un appel en voix seule, un fournisseur ouvre ce fournisseur, « Suivre le réglage global »
        {" "}fait suivre l’appareil à Max et laisse les autres personnages en voix. Un appareil réglé sur « voix » reste en voix.
        {" "}La vidéo reste celle du personnage qui ouvre l’appel : après un passage à un autre personnage, l’appel continue en voix.
        Secrets, délais et qualité : <a className="underline" href={adminTabPath("streaming-avatar")}>Streaming Avatar Config</a>.
      </p>
    </div>
  );
}
