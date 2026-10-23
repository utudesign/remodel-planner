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

/** Resize to 2560 px on the long edge, JPEG ~0.82. Drops EXIF (and with it GPS). */
export async function preparePhoto(file: File): Promise<{ blob: Blob; width: number | null; height: number | null; mime: string }> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") {
    return { blob: file, width: null, height: null, mime: file.type || "application/octet-stream" };
  }
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2560 / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.82));
    if (blob) return { blob, width: w, height: h, mime: "image/jpeg" };
  } catch {
    /* fall through: upload the original */
  }
  return { blob: file, width: null, height: null, mime: file.type };
}

/** Wall-clock EXIF time ("2026-10-22T18:42:05", camera local = Eastern) → ISO with offset. */
export function exifToIso(local: string | null): string | null {
  if (!local) return null;
  const d = new Date(local); // parsed as the phone's local time, which is Eastern for this app
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
