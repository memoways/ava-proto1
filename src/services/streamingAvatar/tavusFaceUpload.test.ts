import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseTavusTrainingStoragePath } from "../../../supabase/functions/_shared/streamingAvatarRequest";

const getCachedSession = vi.hoisted(() => vi.fn());
vi.mock("@/services/gameAuth", () => ({ getCachedSession }));

interface FakeOptions {
  endpoint: string;
  headers: Record<string, string>;
  metadata: Record<string, string>;
  chunkSize: number;
  onError: (error: unknown) => void;
  onProgress: (sent: number, total: number) => void;
  onSuccess: () => void;
  onBeforeRequest: (request: { setHeader: (name: string, value: string) => void }) => Promise<void>;
}

const instances = vi.hoisted(() => [] as unknown[]);
vi.mock("tus-js-client", () => {
  class Upload {
    options: FakeOptions;
    started = false;
    aborted = false;
    constructor(public file: unknown, options: FakeOptions) {
      this.options = options;
      instances.push(this);
    }
    findPreviousUploads() {
      return Promise.resolve([]);
    }
    resumeFromPreviousUpload() {}
    start() {
      this.started = true;
    }
    abort() {
      this.aborted = true;
      return Promise.resolve();
    }
  }
  return { Upload };
});

import {
  TAVUS_UPLOAD_CHUNK_BYTES,
  TAVUS_UPLOAD_SIZE_LIMIT_MESSAGE,
  buildTavusTrainingObjectPath,
  checkTavusTrainingFile,
  defaultTavusFaceName,
  describeTavusUploadError,
  uploadTavusTrainingVideo,
} from "./tavusFaceUpload";

const MB = 1024 * 1024;

describe("checkTavusTrainingFile", () => {
  it("accepts mp4 and webm up to 750 MB", () => {
    expect(checkTavusTrainingFile({ name: "a.mp4", type: "video/mp4", size: 750 * MB })).toEqual({
      ok: true,
      contentType: "video/mp4",
    });
    expect(checkTavusTrainingFile({ name: "a.webm", type: "video/webm", size: 10 })).toMatchObject({ ok: true });
  });

  it("falls back on the extension when the browser gives no type", () => {
    expect(checkTavusTrainingFile({ name: "Take.MP4", type: "", size: 10 })).toEqual({
      ok: true,
      contentType: "video/mp4",
    });
  });

  it("refuses other formats, empty files and files over 750 MB", () => {
    expect(checkTavusTrainingFile({ name: "a.mov", type: "video/quicktime", size: 10 }).ok).toBe(false);
    expect(checkTavusTrainingFile({ name: "a.mov", type: "", size: 10 }).ok).toBe(false);
    expect(checkTavusTrainingFile({ name: "a.mp4", type: "video/mp4", size: 0 }).message).toMatch(/vide/);
    const big = checkTavusTrainingFile({ name: "a.mp4", type: "video/mp4", size: 750 * MB + 1 });
    expect(big.ok).toBe(false);
    expect(big.message).toMatch(/750 Mo/);
  });
});

describe("names and paths", () => {
  const now = new Date("2026-11-05T14:30:15.000Z");

  it("proposes « Max — date » by default", () => {
    expect(defaultTavusFaceName("Max", now)).toBe("Max — 2026-11-05");
  });

  it("builds a path the Edge Function accepts", () => {
    const path = buildTavusTrainingObjectPath("max", { name: "Prise n°3 (final).MP4", type: "video/mp4" }, now);
    expect(path).toBe("max/20261105143015-Prise-n-3-final.mp4");
    expect(parseTavusTrainingStoragePath(path)).toBe(path);
  });

  it("keeps webm and survives odd names", () => {
    const path = buildTavusTrainingObjectPath("Emma!", { name: "###.webm", type: "video/webm" }, now);
    expect(path).toBe("emma/20261105143015-video.webm");
    expect(parseTavusTrainingStoragePath(path)).toBe(path);
  });
});

describe("describeTavusUploadError", () => {
  const failure = (status: number, body = "", message = "tus: failed") => ({
    message,
    originalResponse: { getStatus: () => status, getBody: () => body },
  });

  it("points to the URL fallback when Lovable Cloud refuses the size", () => {
    expect(describeTavusUploadError(failure(413))).toBe(TAVUS_UPLOAD_SIZE_LIMIT_MESSAGE);
    expect(describeTavusUploadError(failure(400, '{"message":"The object exceeded the maximum allowed size"}'))).toBe(
      TAVUS_UPLOAD_SIZE_LIMIT_MESSAGE,
    );
    expect(TAVUS_UPLOAD_SIZE_LIMIT_MESSAGE).toMatch(/URL publique/);
  });

  it("explains an authorization refusal and a missing bucket", () => {
    expect(describeTavusUploadError(failure(403))).toMatch(/administrateur/);
    expect(describeTavusUploadError(failure(404, "Bucket not found"))).toMatch(/migration du lot 2/);
  });

  it("keeps a generic message free of links", () => {
    const message = describeTavusUploadError(failure(500, "", "failed at https://x.supabase.co/storage?token=abc"));
    expect(message).toContain("[lien]");
    expect(message).not.toContain("token=abc");
    expect(message).toMatch(/reprend/);
  });
});

describe("uploadTavusTrainingVideo", () => {
  beforeEach(() => {
    instances.length = 0;
    getCachedSession.mockReset();
  });

  const file = () => new File([new Uint8Array(10)], "take.mp4", { type: "video/mp4" });
  const last = () => instances[instances.length - 1] as {
    options: FakeOptions;
    started: boolean;
    aborted: boolean;
  };
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  it("sends the admin token to the private bucket with 6 MB chunks and resolves with the path", async () => {
    getCachedSession.mockResolvedValue({ access_token: "jwt-1" });
    const progress = vi.fn();
    const handle = uploadTavusTrainingVideo(file(), "max/20261105143015-take.mp4", { onProgress: progress });
    await flush();
    const upload = last();
    expect(upload.started).toBe(true);
    expect(upload.options.endpoint).toMatch(/\/storage\/v1\/upload\/resumable$/);
    expect(upload.options.headers.authorization).toBe("Bearer jwt-1");
    expect(upload.options.headers["x-upsert"]).toBe("false");
    expect(upload.options.chunkSize).toBe(TAVUS_UPLOAD_CHUNK_BYTES);
    expect(upload.options.metadata).toMatchObject({
      bucketName: "tavus-training-videos",
      objectName: "max/20261105143015-take.mp4",
      contentType: "video/mp4",
    });

    upload.options.onProgress(5, 10);
    expect(progress).toHaveBeenCalledWith(50);
    upload.options.onSuccess();
    await expect(handle.done).resolves.toBe("max/20261105143015-take.mp4");
  });

  it("refreshes the token on every request of a long upload", async () => {
    getCachedSession.mockResolvedValue({ access_token: "jwt-1" });
    uploadTavusTrainingVideo(file(), "max/x.mp4");
    await flush();
    getCachedSession.mockResolvedValue({ access_token: "jwt-2" });
    const setHeader = vi.fn();
    await last().options.onBeforeRequest({ setHeader });
    expect(setHeader).toHaveBeenCalledWith("authorization", "Bearer jwt-2");
  });

  it("rejects without a session and never starts a transfer", async () => {
    getCachedSession.mockResolvedValue(null);
    const handle = uploadTavusTrainingVideo(file(), "max/x.mp4");
    await expect(handle.done).rejects.toThrow(/reconnectez-vous/);
    expect(instances).toHaveLength(0);
  });

  it("rejects a refused file before any transfer", async () => {
    getCachedSession.mockResolvedValue({ access_token: "jwt" });
    const bad = new File([new Uint8Array(10)], "take.mov", { type: "video/quicktime" });
    await expect(uploadTavusTrainingVideo(bad, "max/x.mp4").done).rejects.toThrow(/mp4 et le webm/);
    expect(instances).toHaveLength(0);
  });

  it("propagates a transfer error and can abort", async () => {
    getCachedSession.mockResolvedValue({ access_token: "jwt" });
    const handle = uploadTavusTrainingVideo(file(), "max/x.mp4");
    await flush();
    const failure = new Error("boom");
    last().options.onError(failure);
    await expect(handle.done).rejects.toBe(failure);
    handle.abort();
    expect(last().aborted).toBe(true);
  });
});
