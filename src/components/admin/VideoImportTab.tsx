import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2, RefreshCw, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  gumletImportErrorMessage,
  importGumletVideos,
  listMissingGumletVideos,
  type GumletImportResult,
  type GumletListResult,
} from "@/services/gumletImportService";
import { AVA_NOTION_DATABASES } from "@/services/ragService";
import {
  gumletWatchUrl,
  IMPORT_CHARACTERS,
  IMPORT_DIALOGUES,
  IMPORT_NATURES,
  MAX_IMPORT_BATCH,
  type GumletVideo,
  type ImportDefaults,
} from "../../../supabase/functions/_shared/gumletImport";

/** Radix Select refuses an empty value: this stands for "leave the Notion field empty". */
const UNSET = "unset";
const ALL_FOLDERS = "all";
const NO_FOLDER = "none";

function formatDuration(seconds: number | null): string {
  if (!seconds) return "durée inconnue";
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "date inconnue";

/** Only a fully processed Gumlet video can be played, so only it can be imported. */
const isReady = (video: GumletVideo) => video.status === "ready";

export default function VideoImportTab() {
  const [list, setList] = useState<GumletListResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [folder, setFolder] = useState(ALL_FOLDERS);
  const [nature, setNature] = useState(UNSET);
  const [dialogue, setDialogue] = useState(UNSET);
  const [characters, setCharacters] = useState<NonNullable<ImportDefaults["characters"]>>([]);
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState<GumletImportResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const next = await listMissingGumletVideos();
      setList(next);
      const available = new Set(next.videos.map((video) => video.asset_id));
      setSelected((current) => new Set([...current].filter((id) => available.has(id))));
    } catch (error) {
      setLoadError((error as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const folders = useMemo(
    () => [...new Set((list?.videos ?? []).map((video) => video.folder).filter(Boolean))].sort(),
    [list],
  );
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (list?.videos ?? []).filter((video) =>
      (folder === ALL_FOLDERS || (folder === NO_FOLDER ? !video.folder : video.folder === folder))
      && (!query || [video.title, video.description, ...video.tags].join(" ").toLowerCase().includes(query)));
  }, [list, search, folder]);
  const selectable = visible.filter(isReady);
  const allVisibleSelected = selectable.length > 0 && selectable.every((video) => selected.has(video.asset_id));

  const toggle = (ids: string[], checked: boolean) => setSelected((current) => {
    const next = new Set(current);
    ids.forEach((id) => (checked ? next.add(id) : next.delete(id)));
    return next;
  });

  async function runImport() {
    setImporting(true);
    setReport(null);
    try {
      const result = await importGumletVideos([...selected], {
        ...(nature === UNSET ? {} : { nature: nature as ImportDefaults["nature"] }),
        ...(dialogue === UNSET ? {} : { dialogue: dialogue as ImportDefaults["dialogue"] }),
        ...(characters.length ? { characters } : {}),
      });
      setReport(result);
      setSelected(new Set(result.failed.map((failure) => failure.asset_id)));
      if (result.failed.length) toast.error(`${result.failed.length} vidéo(s) non importée(s)`);
      else toast.success(`${result.created.length} fiche(s) créée(s) dans Notion`);
      await load();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setImporting(false);
    }
  }

  const titleOf = (assetId: string) =>
    list?.videos.find((video) => video.asset_id === assetId)?.title ?? assetId;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1.5">
              <CardTitle>Importation vidéo</CardTitle>
              <CardDescription>
                Les vidéos présentes sur Gumlet et absentes de la base Notion « Vidéos AVA ». Chaque import crée une
                fiche « A vérifier » : elle n'entre dans le jeu qu'une fois passée « En ligne » et synchronisée.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <a href={`https://www.notion.so/${AVA_NOTION_DATABASES.videos}`} target="_blank" rel="noreferrer">
                  Ouvrir Vidéos AVA <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <Button variant="outline" onClick={() => void load()} disabled={loading || importing}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Actualiser
              </Button>
            </div>
          </div>
        </CardHeader>
        {list ? (
          <CardContent className="text-sm text-muted-foreground">
            {list.total_gumlet} vidéo(s) sur Gumlet · {list.already_in_notion} déjà dans Notion ·{" "}
            <strong className="text-foreground">{list.total_gumlet - list.already_in_notion} à importer</strong>
            {list.not_shown ? <p>Seules les plus récentes sont affichées : {list.not_shown} autre(s) apparaîtront après import.</p> : null}
            {list.unreadable.length ? <p role="alert">{list.unreadable.length} vidéo(s) illisible(s) chez Gumlet, non affichée(s).</p> : null}
          </CardContent>
        ) : null}
      </Card>

      {loadError ? <p role="alert" className="text-sm text-destructive">{loadError}</p> : null}
      {loading && !list ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Lecture de Gumlet et de Notion…
        </p>
      ) : null}

      {report ? (
        <div role="status" className="space-y-1 rounded-lg border bg-muted/20 px-4 py-3 text-sm">
          <p className="font-medium">
            {report.created.length} créée(s) · {report.skipped.length} déjà présente(s) · {report.failed.length} échec(s)
          </p>
          {report.created.map((page) => (
            <p key={page.asset_id}>
              <a href={page.notion_url} target="_blank" rel="noreferrer" className="underline">{page.title}</a>
            </p>
          ))}
          {report.failed.map((failure) => (
            <p key={failure.asset_id} className="text-destructive">
              {titleOf(failure.asset_id)} : {gumletImportErrorMessage(failure.error)}
            </p>
          ))}
          {report.ignored_properties.length ? (
            <p>Champs absents ou d'un autre type dans Notion, non remplis : {report.ignored_properties.join(", ")}.</p>
          ) : null}
        </div>
      ) : null}

      {list && list.videos.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Aucune nouvelle vidéo : Notion est à jour.</p>
      ) : null}

      {list && list.videos.length > 0 ? (
        <>
          <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/20 px-4 py-3">
            <div className="space-y-1">
              <Label htmlFor="import-nature">Nature</Label>
              <Select value={nature} onValueChange={setNature}>
                <SelectTrigger id="import-nature" className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET}>À remplir dans Notion</SelectItem>
                  {IMPORT_NATURES.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="import-dialogue">Dialogue</Label>
              <Select value={dialogue} onValueChange={setDialogue}>
                <SelectTrigger id="import-dialogue" className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET}>À remplir dans Notion</SelectItem>
                  {IMPORT_DIALOGUES.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <fieldset className="space-y-1">
              <legend className="text-sm font-medium">Personnages</legend>
              <div className="flex min-h-10 flex-wrap items-center gap-3">
                {IMPORT_CHARACTERS.map((name) => (
                  <label key={name} className="flex items-center gap-1.5 text-sm">
                    <Checkbox
                      checked={characters.includes(name)}
                      onCheckedChange={(checked) => setCharacters((current) =>
                        checked === true ? [...current, name] : current.filter((other) => other !== name))}
                    />
                    {name}
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="w-full text-xs text-muted-foreground">Ces valeurs s'appliquent à toutes les vidéos cochées.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Titre, description ou tag"
              aria-label="Rechercher une vidéo"
              className="w-full max-w-xs"
            />
            {folders.length ? (
              <Select value={folder} onValueChange={setFolder}>
                <SelectTrigger className="w-[220px]" aria-label="Dossier Gumlet"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FOLDERS}>Tous les dossiers</SelectItem>
                  <SelectItem value={NO_FOLDER}>Sans dossier</SelectItem>
                  {folders.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : null}
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={allVisibleSelected}
                disabled={selectable.length === 0}
                onCheckedChange={(checked) => toggle(selectable.map((video) => video.asset_id), checked === true)}
              />
              Tout cocher ({selectable.length})
            </label>
            <Button
              className="ml-auto"
              onClick={() => void runImport()}
              disabled={importing || loading || selected.size === 0 || selected.size > MAX_IMPORT_BATCH}
            >
              {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Importer dans Notion ({selected.size})
            </Button>
          </div>
          {selected.size > MAX_IMPORT_BATCH ? (
            <p role="alert" className="text-sm text-destructive">{MAX_IMPORT_BATCH} vidéos au plus par import.</p>
          ) : null}

          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((video) => (
              <li key={video.asset_id} className="overflow-hidden rounded-lg border">
                <label className="block cursor-pointer">
                  {video.thumbnail_url ? (
                    <img src={video.thumbnail_url} alt="" loading="lazy" className="aspect-video w-full bg-muted object-cover" />
                  ) : (
                    <span className="flex aspect-video w-full items-center justify-center bg-muted text-xs text-muted-foreground">Sans vignette</span>
                  )}
                  <span className="flex items-start gap-2 px-3 pt-2">
                    <Checkbox
                      className="mt-0.5"
                      checked={selected.has(video.asset_id)}
                      disabled={!isReady(video) || importing}
                      onCheckedChange={(checked) => toggle([video.asset_id], checked === true)}
                      aria-label={`Sélectionner ${video.title}`}
                    />
                    <span className="break-words text-sm font-medium">{video.title}</span>
                  </span>
                </label>
                <div className="space-y-1 px-3 pb-3 pt-1 text-xs text-muted-foreground">
                  <p>{formatDuration(video.duration_s)} · {formatDate(video.uploaded_at)}</p>
                  <p>
                    {[video.width && video.height ? `${video.width} × ${video.height}` : "", video.folder, video.tags.join(", ")]
                      .filter(Boolean).join(" · ")}
                  </p>
                  {!isReady(video) ? <p>Pas encore prête chez Gumlet ({video.status || "état inconnu"}).</p> : null}
                  <a href={gumletWatchUrl(video.asset_id)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
                    Voir la vidéo <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
