import * as tus from "tus-js-client";
import { supabase } from "@/integrations/supabase/client";
import { getCachedSession } from "@/services/gameAuth";
import {
  TAVUS_TRAINING_BUCKET,
  TAVUS_TRAINING_VIDEO_MAX_BYTES,
  TAVUS_TRAINING_VIDEO_TYPES,
} from "../../../supabase/functions/_shared/streamingAvatarRequest";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/** Supabase resumable uploads require exactly 6 MB chunks. */
export const TAVUS_UPLOAD_CHUNK_BYTES = 6 * 1024 * 1024;

export const TAVUS_UPLOAD_SIZE_LIMIT_MESSAGE =
  "Lovable Cloud refuse ce fichier : sa limite de taille d'objet est inférieure à celle de Tavus (750 Mo). " +
  "Téléversez la vidéo ailleurs (lien public https valable au moins 24 h) et collez l'URL dans le champ « ou URL publique ».";

export interface TavusVideoCheck {
  ok: boolean;
  /** French message for the admin when the file is refused. */
  message?: string;
  /** Canonical MIME type (the browser may leave it empty). */
  contentType?: string;
}

const MEGABYTE = 1024 * 1024;

export function formatTavusVideoSize(bytes: number): string {
  return bytes >= 1024 * MEGABYTE
    ? `${(bytes / (1024 * MEGABYTE)).toFixed(1)} Go`
    : `${Math.max(1, Math.round(bytes / MEGABYTE))} Mo`;
}

function videoTypeOf(file: { name: string; type: string }): string {
  const declared = file.type.toLowerCase();
  if ((TAVUS_TRAINING_VIDEO_TYPES as readonly string[]).includes(declared)) return declared;
  if (declared) return "";
  const name = file.name.toLowerCase();
  if (name.endsWith(".mp4")) return "video/mp4";
  if (name.endsWith(".webm")) return "video/webm";
  return "";
}

/** Client-side pre-check against the Tavus limits (mp4/webm, at most 750 MB). */
export function checkTavusTrainingFile(file: { name: string; type: string; size: number }): TavusVideoCheck {
  const contentType = videoTypeOf(file);
  if (!contentType) {
    return { ok: false, message: "Format refusé : Tavus n'accepte que le mp4 et le webm." };
  }
  if (!Number.isFinite(file.size) || file.size <= 0) {
    return { ok: false, message: "Le fichier est vide." };
  }
  if (file.size > TAVUS_TRAINING_VIDEO_MAX_BYTES) {
    return {
      ok: false,
      message: `Fichier trop lourd (${formatTavusVideoSize(file.size)}) : Tavus accepte 750 Mo au maximum.`,
    };
  }
  return { ok: true, contentType };
}

/** Default Face name, e.g. « Max — 2026-11-05 ». */
export function defaultTavusFaceName(characterLabel: string, now: Date = new Date()): string {
  return `${characterLabel} — ${now.toISOString().slice(0, 10)}`;
}

function slugify(name: string): string {
  const stem = name.replace(/\.[^.]+$/, "");
  const slug = stem
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "video";
}

/**
 * Object path inside the training bucket: `<character>/<timestamp>-<name>.mp4`.
 * A timestamp makes every upload unique, so a resumable upload never overwrites another take.
 */
export function buildTavusTrainingObjectPath(
  characterKey: string,
  file: { name: string; type: string },
  now: Date = new Date(),
): string {
  const stamp = now.toISOString().replace(/\D/g, "").slice(0, 14);
  const extension = videoTypeOf(file) === "video/webm" ? "webm" : "mp4";
  const folder = characterKey.toLowerCase().replace(/[^a-z0-9_-]/g, "") || "face";
  return `${folder}/${stamp}-${slugify(file.name)}.${extension}`;
}

/** Who the browser acts as (never the token): enough to tell an admin from an anonymous session. */
export interface TavusUploadIdentity {
  email: string | null;
  anonymous: boolean;
  host: string;
}

interface UploadFailure {
  originalResponse?: { getStatus?: () => number; getBody?: () => string } | null;
  message?: string;
  identity?: TavusUploadIdentity;
  /** Message of the standard (non-resumable) upload tried after a refused TUS creation. */
  fallbackError?: string;
}

/** Storage reports a refused policy as HTTP 400 with `"statusCode":"403"` in the body. */
export function isTavusPolicyRefusal(error: unknown): boolean {
  const failure = (error ?? {}) as UploadFailure;
  const status = failure.originalResponse?.getStatus?.() ?? 0;
  const body = (failure.originalResponse?.getBody?.() ?? "").toLowerCase();
  return status === 401 || status === 403 || body.includes("accessdenied") || body.includes("row-level security");
}

/** Server `message` of a Storage JSON error body, links removed and bounded. */
function serverMessage(body: string): string {
  try {
    const parsed = JSON.parse(body) as { message?: unknown; error?: unknown };
    const text = typeof parsed.message === "string" ? parsed.message : typeof parsed.error === "string" ? parsed.error : "";
    return text.replace(/https?:\/\/\S+/g, "[lien]").slice(0, 160);
  } catch {
    return "";
  }
}

function describeIdentity(identity?: TavusUploadIdentity): string {
  if (!identity) return "";
  const who = identity.anonymous ? "session anonyme" : identity.email ?? "compte inconnu";
  return ` Compte utilisé : ${who} (${identity.host}).`;
}

/** Turns a tus failure into an admin message; a size refusal points to the URL fallback. */
export function describeTavusUploadError(error: unknown): string {
  const failure = (error ?? {}) as UploadFailure;
  const status = failure.originalResponse?.getStatus?.() ?? 0;
  const rawBody = failure.originalResponse?.getBody?.() ?? "";
  const body = rawBody.toLowerCase();
  if (status === 413 || body.includes("maximum allowed size") || body.includes("entity too large")) {
    return TAVUS_UPLOAD_SIZE_LIMIT_MESSAGE;
  }
  if (isTavusPolicyRefusal(error)) {
    const detail = serverMessage(rawBody);
    const fallback = failure.fallbackError
      ? ` L'envoi direct a aussi été refusé (${failure.fallbackError.replace(/https?:\/\/\S+/g, "[lien]").slice(0, 160)}).`
      : "";
    return (
      `Le stockage refuse l'écriture dans « ${TAVUS_TRAINING_BUCKET} »${detail ? ` (${detail})` : ""}.` +
      fallback +
      describeIdentity(failure.identity) +
      " Il faut un compte administrateur sur l'environnement Lovable Cloud de ce site, avec les politiques du bucket appliquées."
    );
  }
  if (status === 404 && body.includes("bucket")) {
    return "Le stockage « tavus-training-videos » est introuvable : la migration du lot 2 n'est pas appliquée dans Lovable Cloud.";
  }
  const detail = (failure.message ?? "").replace(/https?:\/\/\S+/g, "[lien]").slice(0, 200);
  const server = serverMessage(rawBody);
  return (
    `Le téléversement a échoué${detail ? ` : ${detail}` : "."}` +
    (server ? ` Réponse du stockage : ${server}.` : "") +
    " Relancez-le : il reprend là où il s'est arrêté."
  );
}

/** Claims useful to diagnose a refusal; the token itself is never read out. */
export function tavusUploadIdentity(
  session: { access_token?: string; user?: { email?: string | null; is_anonymous?: boolean } } | null,
  host = typeof window === "undefined" ? "" : window.location.host,
): TavusUploadIdentity {
  let anonymous = session?.user?.is_anonymous === true;
  try {
    const payload = JSON.parse(atob((session?.access_token ?? "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (payload?.is_anonymous === true) anonymous = true;
  } catch {
    // Not a readable JWT: keep what the session object says.
  }
  return { email: session?.user?.email ?? null, anonymous, host };
}

export interface TavusUploadHandle {
  /** Resolves with the bucket-relative object path once the whole file is stored. */
  done: Promise<string>;
  abort: () => void;
}

/**
 * Resumable (TUS) upload to the private `tavus-training-videos` bucket with the admin's own
 * session token (the bucket policies are admin-only). Never touches Tavus: it only stores
 * the video; training is a separate, explicit action.
 */
export function uploadTavusTrainingVideo(
  file: File,
  objectPath: string,
  options: { onProgress?: (percent: number) => void; onFallback?: () => void } = {},
): TavusUploadHandle {
  let upload: tus.Upload | null = null;
  let aborted = false;
  const done = new Promise<string>((resolve, reject) => {
    void getCachedSession().then((session) => {
      if (aborted) return reject(new Error("Téléversement annulé."));
      if (!session?.access_token) {
        return reject(new Error("Session administrateur introuvable : reconnectez-vous."));
      }
      const check = checkTavusTrainingFile(file);
      if (!check.ok) return reject(new Error(check.message));
      upload = new tus.Upload(file, {
        endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        headers: {
          authorization: `Bearer ${session.access_token}`,
          apikey: SUPABASE_PUBLISHABLE_KEY,
          "x-upsert": "false",
        },
        // A long upload outlives the 1 h token: always send the current one.
        onBeforeRequest: async (request) => {
          const current = await getCachedSession();
          if (current?.access_token) request.setHeader("authorization", `Bearer ${current.access_token}`);
        },
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        chunkSize: TAVUS_UPLOAD_CHUNK_BYTES,
        metadata: {
          bucketName: TAVUS_TRAINING_BUCKET,
          objectName: objectPath,
          contentType: check.contentType!,
          cacheControl: "3600",
        },
        onError: (error) => {
          const identity = tavusUploadIdentity(session);
          if (!isTavusPolicyRefusal(error) || aborted) return reject(Object.assign(error, { identity }));
          // The resumable endpoint refused the policy: try the standard upload the portraits use.
          // Not resumable, but it separates a TUS-only refusal from a refused account/environment.
          options.onFallback?.();
          void supabase.storage
            .from(TAVUS_TRAINING_BUCKET)
            .upload(objectPath, file, { contentType: check.contentType, upsert: false })
            .then(({ error: directError }) => {
              if (directError) {
                return reject(Object.assign(error, { identity, fallbackError: directError.message }));
              }
              options.onProgress?.(100);
              resolve(objectPath);
            })
            .catch((directError: unknown) =>
              reject(Object.assign(error, { identity, fallbackError: String((directError as Error)?.message ?? directError) })),
            );
        },
        onProgress: (sent, total) => options.onProgress?.(total ? Math.round((sent / total) * 100) : 0),
        onSuccess: () => resolve(objectPath),
      });
      void upload.findPreviousUploads().then((previous) => {
        // Resume the previous attempt of this very object only (same path = same file).
        const same = previous.find((entry) => entry.metadata?.objectName === objectPath);
        if (same) upload!.resumeFromPreviousUpload(same);
        upload!.start();
      });
    });
  });
  return {
    done,
    abort: () => {
      aborted = true;
      void upload?.abort(true);
    },
  };
}
