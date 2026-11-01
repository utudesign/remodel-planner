/**
 * Photos never get lost (master prompt rule): every photo waits in IndexedDB until its
 * deal_files row exists. The queue survives closing the app, weak signal and reloads.
 * Browser-only module (no server imports).
 */
export type QueueItem = {
  id: string;
  dealId: string;
  dealNumber: string;
  folder: string;
  tag: string | null;
  requirementId: string | null;
  name: string;
  mime: string;
  size: number;
  blob: Blob;
  takenAt: string | null;
  width: number | null;
  height: number | null;
  path: string | null;
  url: string | null;
  ticketAt: number | null;
  uploaded: boolean;
  attempts: number;
  error: string | null;
  createdAt: number;
  /** v3 D: 400 px JPEG for grids (made on the phone; older queue items have none). */
  thumb?: Blob | null;
  thumbPath?: string | null;
  thumbUrl?: string | null;
  thumbUploaded?: boolean;
};

const DB = "kitchen-sales";
const STORE = "uploads";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    t.oncomplete = () => {
      db.close();
      resolve(r.result);
    };
    t.onerror = () => {
      db.close();
      reject(t.error);
    };
  });
}

export const queue = {
  put: (item: QueueItem) => tx("readwrite", (s) => s.put(item)),
  all: () => tx<QueueItem[]>("readonly", (s) => s.getAll() as IDBRequest<QueueItem[]>),
  remove: (id: string) => tx("readwrite", (s) => s.delete(id)),
};

async function resize(bitmap: ImageBitmap, maxEdge: number, quality: number) {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality));
  return { blob, w, h };
}

/**
 * Resize to 2560 px on the long edge, JPEG ~0.82, plus a 400 px thumbnail (~30–50 KB) for grids
 * (v3 D: grids stop downloading full photos). Drops EXIF (and with it GPS).
 */
export async function preparePhoto(
  file: File,
): Promise<{ blob: Blob; width: number | null; height: number | null; mime: string; thumb: Blob | null }> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") {
    return { blob: file, width: null, height: null, mime: file.type || "application/octet-stream", thumb: null };
  }
  try {
    const bitmap = await createImageBitmap(file);
    const full = await resize(bitmap, 2560, 0.82);
    const small = await resize(bitmap, 400, 0.72).catch(() => ({ blob: null }));
    if (full.blob) return { blob: full.blob, width: full.w, height: full.h, mime: "image/jpeg", thumb: small.blob };
  } catch {
    /* fall through: upload the original */
  }
  return { blob: file, width: null, height: null, mime: file.type, thumb: null };
}

/** Wall-clock EXIF time ("2026-10-22T18:42:05", camera local = Eastern) → ISO with offset. */
export function exifToIso(local: string | null): string | null {
  if (!local) return null;
  const d = new Date(local); // parsed as the phone's local time, which is Eastern for this app
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
