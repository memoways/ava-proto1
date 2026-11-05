import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight, Loader2, RefreshCw, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  getTavusFaceStatus,
  listTavusFaces,
  trainTavusFace,
  type TavusFace,
} from "@/services/streamingAvatar/api";
import {
  TAVUS_FACE_POLL_MS,
  canAssignTavusFace,
  charactersUsingTavusFace,
  hasTavusFaceInProgress,
  isTavusFacePreview,
  mergeTavusFace,
  tavusFaceStageLabel,
} from "@/services/streamingAvatar/tavusFaceAdmin";
import {
  buildTavusTrainingObjectPath,
  checkTavusTrainingFile,
  defaultTavusFaceName,
  describeTavusUploadError,
  formatTavusVideoSize,
  uploadTavusTrainingVideo,
  type TavusUploadHandle,
} from "@/services/streamingAvatar/tavusFaceUpload";
import type { TavusCharacterOverride } from "@/services/streamingAvatar";

interface Props {
  /** Per-character overrides (to show who already uses a Face). */
  characters: Record<string, TavusCharacterOverride>;
  /** Character keys that can receive a Face, with their label (Max, Emma). */
  characterLabels: Record<string, string>;
  /** Writes `tavus.characters.<key>.faceId`; the admin still presses « Sauvegarder ». */
  onAssign: (characterKey: string, faceId: string) => void;
}

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Admin block: store a training video, start the Phoenix-4.5 training on an explicit
 * confirmation (real cost and quota on the Tavus account), follow the Faces, attach one.
 */
export default function TavusFaceTrainer({ characters, characterLabels, onAssign }: Props) {
  const characterKeys = Object.keys(characterLabels);
  const [open, setOpen] = useState(false);
  const [targetKey, setTargetKey] = useState(characterKeys[0] ?? "max");
  const targetLabel = characterLabels[targetKey] ?? targetKey;

  const [faceName, setFaceName] = useState(() => defaultTavusFaceName(targetLabel));
  const [nameEdited, setNameEdited] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [training, setTraining] = useState(false);
  const [trainError, setTrainError] = useState<string | null>(null);

  const [faces, setFaces] = useState<TavusFace[]>([]);
  const [loadingFaces, setLoadingFaces] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const uploadRef = useRef<TavusUploadHandle | null>(null);
  // Same file keeps the same object path, so a failed transfer resumes instead of restarting.
  const pendingPathRef = useRef<string | null>(null);
  const loadedRef = useRef(false);
  const facesRef = useRef<TavusFace[]>([]);
  facesRef.current = faces;

  useEffect(() => () => uploadRef.current?.abort(), []);

  // The suggested name follows the target character until the admin types their own.
  useEffect(() => {
    if (!nameEdited) setFaceName(defaultTavusFaceName(targetLabel));
  }, [nameEdited, targetLabel]);

  const refreshFaces = useCallback(async () => {
    setLoadingFaces(true);
    setListError(null);
    try {
      setFaces(await listTavusFaces());
    } catch (error) {
      setListError(errorText(error));
    } finally {
      setLoadingFaces(false);
    }
  }, []);

  useEffect(() => {
    if (open && !loadedRef.current) {
      loadedRef.current = true;
      void refreshFaces();
    }
  }, [open, refreshFaces]);

  // Polling every 30 s, only while the block is open and a Face is still training.
  const polling = open && hasTavusFaceInProgress(faces);
  useEffect(() => {
    if (!polling) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      for (const face of facesRef.current.filter((entry) => entry.status === "started")) {
        void getTavusFaceStatus(face.faceId)
          .then((fresh) => setFaces((current) => mergeTavusFace(current, { ...face, ...fresh })))
          .catch(() => {});
      }
    }, TAVUS_FACE_POLL_MS);
    return () => window.clearInterval(timer);
  }, [polling]);

  const chooseFile = (selected: File | null) => {
    uploadRef.current?.abort();
    pendingPathRef.current = null;
    setUploadedPath(null);
    setUploadError(null);
    setProgress(0);
    setUploading(false);
    if (!selected) {
      setFile(null);
      setFileError(null);
      return;
    }
    const check = checkTavusTrainingFile(selected);
    setFile(check.ok ? selected : null);
    setFileError(check.ok ? null : check.message ?? "Fichier refusé.");
  };

  const startUpload = async () => {
    if (!file) return;
    pendingPathRef.current ??= buildTavusTrainingObjectPath(targetKey, file);
    setUploading(true);
    setUploadError(null);
    setNotice(null);
    setProgress(0);
    const handle = uploadTavusTrainingVideo(file, pendingPathRef.current, {
      onProgress: setProgress,
      onFallback: () => setNotice("Envoi direct en cours (non reprenable) : le stockage a refusé l'envoi reprenable."),
    });
    uploadRef.current = handle;
    try {
      setUploadedPath(await handle.done);
      setProgress(100);
      toast.success("Vidéo téléversée. Aucun entraînement n'est lancé tant que vous ne le confirmez pas.");
    } catch (error) {
      setUploadError(describeTavusUploadError(error));
    } finally {
      setUploading(false);
    }
  };

  const trimmedUrl = videoUrl.trim();
  const urlInvalid = trimmedUrl !== "" && !/^https:\/\/\S+$/i.test(trimmedUrl);
  const bothSources = Boolean(uploadedPath) && trimmedUrl !== "";
  const name = faceName.trim();
  const canTrain = name !== "" && !training && !uploading && !bothSources && !urlInvalid && (Boolean(uploadedPath) || trimmedUrl !== "");

  const startTraining = async () => {
    setConfirming(false);
    setTraining(true);
    setTrainError(null);
    try {
      const face = await trainTavusFace(
        uploadedPath && !trimmedUrl
          ? { faceName: name, storagePath: uploadedPath }
          : { faceName: name, videoUrl: trimmedUrl },
      );
      setFaces((current) => mergeTavusFace(current, face));
      toast.success(`Entraînement lancé : « ${face.name || name} ». Aperçu en quelques minutes.`);
      setUploadedPath(null);
      setFile(null);
      setVideoUrl("");
      setProgress(0);
      pendingPathRef.current = null;
    } catch (error) {
      setTrainError(errorText(error));
    } finally {
      setTraining(false);
    }
  };

  const assign = (face: TavusFace) => {
    onAssign(targetKey, face.faceId);
    toast.success(`Face attribué à ${targetLabel} (Face ID ${face.faceId}). Cliquez sur « Sauvegarder » pour l'enregistrer.`);
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="space-y-3 rounded-md border p-3">
      <CollapsibleTrigger className="group flex w-full items-center gap-2 text-left">
        <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]:rotate-90" />
        <span className="text-sm font-medium">Entraîner un Face (vidéo)</span>
        <span className="text-xs text-muted-foreground">Phoenix-4.5 · aperçu en minutes, affinage en quelques heures</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4">
        <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
          <li>mp4 ou webm, 1080p minimum, 25 images/s minimum, 750 Mo au maximum.</li>
          <li>30 s en parlant, puis 30 s immobile, lèvres fermées, regard caméra ; visage sérieux, sans sourire.</li>
          <li>L'entraînement consomme le quota et le budget du compte Tavus : il ne part qu'après votre confirmation.</li>
        </ul>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="tavus-face-name">Nom du Face</Label>
            <Input
              id="tavus-face-name"
              value={faceName}
              maxLength={80}
              onChange={(event) => {
                setNameEdited(true);
                setFaceName(event.target.value);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>Personnage cible</Label>
            <Select value={targetKey} onValueChange={setTargetKey}>
              <SelectTrigger aria-label="Personnage cible"><SelectValue /></SelectTrigger>
              <SelectContent>
                {characterKeys.map((key) => (
                  <SelectItem key={key} value={key}>{characterLabels[key]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Le bouton « Attribuer » de la liste écrit le Face de ce personnage.</p>
          </div>
        </div>

        <div className="space-y-2 rounded-md border border-dashed p-3">
          <p className="text-sm font-medium">1. Téléverser la vidéo</p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center rounded border border-border bg-muted px-3 py-1.5 text-xs font-medium hover:bg-muted/80">
              {file ? "Changer de vidéo" : "Choisir une vidéo"}
              <input
                type="file"
                aria-label="Vidéo d'entraînement"
                accept="video/mp4,video/webm,.mp4,.webm"
                disabled={uploading}
                onChange={(event) => {
                  const selected = event.target.files?.[0] ?? null;
                  event.target.value = "";
                  chooseFile(selected);
                }}
                className="hidden"
              />
            </label>
            {file && <span className="text-xs text-muted-foreground">{file.name} · {formatTavusVideoSize(file.size)}</span>}
            {file && !uploadedPath && (
              <Button size="sm" variant="outline" onClick={startUpload} disabled={uploading}>
                {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                {uploadError ? "Reprendre le téléversement" : "Téléverser"}
              </Button>
            )}
            {uploading && (
              <Button size="sm" variant="ghost" onClick={() => uploadRef.current?.abort()}>Annuler</Button>
            )}
          </div>
          {(uploading || uploadedPath) && (
            <div className="space-y-1">
              <Progress value={progress} aria-label="Progression du téléversement" />
              <p className="text-xs text-muted-foreground">
                {uploadedPath ? "Vidéo stockée dans le bucket privé (aucun entraînement lancé)." : `${progress} %`}
              </p>
            </div>
          )}
          {notice && uploading && <p className="text-xs text-muted-foreground">{notice}</p>}
          {fileError && <p className="text-xs text-destructive">{fileError}</p>}
          {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="tavus-face-url">… ou URL publique de la vidéo</Label>
          <Input
            id="tavus-face-url"
            value={videoUrl}
            placeholder="https://… (lien direct, valable au moins 24 h)"
            onChange={(event) => setVideoUrl(event.target.value)}
          />
          {urlInvalid && <p className="text-xs text-destructive">Le lien doit commencer par https://.</p>}
          {bothSources && (
            <p className="text-xs text-destructive">Une seule source : videz l'URL ou changez de vidéo.</p>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">2. Lancer l'entraînement</p>
          <Button onClick={() => setConfirming(true)} disabled={!canTrain}>
            {training && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Lancer l'entraînement
          </Button>
          {trainError && <p className="text-xs text-destructive">{trainError}</p>}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Faces du compte Tavus</p>
            <Button size="sm" variant="outline" onClick={refreshFaces} disabled={loadingFaces}>
              {loadingFaces ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Rafraîchir
            </Button>
          </div>
          {polling && <p className="text-xs text-muted-foreground">Suivi automatique toutes les 30 s tant qu'un entraînement est en cours.</p>}
          {listError && <p className="text-xs text-destructive">{listError}</p>}
          {!listError && !loadingFaces && faces.length === 0 && (
            <p className="text-xs text-muted-foreground">Aucun Face renvoyé par Tavus.</p>
          )}
          <ul className="space-y-2">
            {faces.map((face) => {
              const users = charactersUsingTavusFace(characters, face.faceId);
              return (
                <li key={face.faceId} className="space-y-2 rounded-md border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{face.name || "Sans nom"}</p>
                      <p className="break-all text-xs text-muted-foreground">
                        {face.faceId}{face.modelName ? ` · ${face.modelName}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {users.map((key) => (
                        <Badge key={key} variant="secondary">Attribué à {characterLabels[key] ?? key}</Badge>
                      ))}
                      <Button size="sm" disabled={!canAssignTavusFace(face)} onClick={() => assign(face)}>
                        Attribuer à {targetLabel}
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs">{tavusFaceStageLabel(face)}</p>
                  {face.stage === "training" && face.progressPercent !== null && (
                    <Progress value={face.progressPercent} aria-label={`Entraînement de ${face.name || face.faceId}`} />
                  )}
                  {isTavusFacePreview(face) && (
                    <p className="text-xs text-muted-foreground">
                      Aperçu filigrané : utilisable pour les essais ; le Face final remplace l'aperçu à la fin de l'affinage.
                    </p>
                  )}
                  {face.errorMessage && <p className="text-xs text-destructive">{face.errorMessage}</p>}
                </li>
              );
            })}
          </ul>
        </div>
      </CollapsibleContent>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Lancer l'entraînement de « {name} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cela crée un Face Phoenix-4.5 chez Tavus à partir de {uploadedPath && !trimmedUrl ? "la vidéo téléversée" : "l'URL indiquée"} ;
              le quota et le budget du compte Tavus sont consommés et il n'y a pas d'annulation depuis Ava.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => void startTraining()}>Lancer l'entraînement</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Collapsible>
  );
}
