"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CloudUpload, WifiOff } from "lucide-react";
import { queue, type QueueItem } from "@/lib/photo-queue";
import { confirmUpload, createUploadTicket } from "@/server/actions/photos";

export const QUEUE_EVENT = "photo-queue:changed";
const TICKET_TTL = 90 * 60_000;

let running = false;

/** Drain the queue: ticket → PUT to Storage → confirm row → remove. Every step can be retried. */
async function processQueue(onDone: (number: string) => void) {
  if (running || (typeof navigator !== "undefined" && !navigator.onLine)) return;
  running = true;
  try {
    const items = (await queue.all()).sort((a, b) => a.createdAt - b.createdAt);
    for (const item of items) {
      let it: QueueItem = item;
      try {
        if (!it.uploaded && (!it.path || !it.url || Date.now() - (it.ticketAt ?? 0) > TICKET_TTL)) {
          const t = await createUploadTicket({ deal_id: it.dealId, folder: it.folder as never, file_name: it.name, mime: it.mime as never, size: it.size });
          if (!t.ok) throw new Error(t.error);
          it = { ...it, path: t.path, url: t.url, ticketAt: Date.now() };
          await queue.put(it);
        }
        if (!it.uploaded) {
          const body = new FormData();
          body.append("cacheControl", "3600");
          body.append("", it.blob, it.name);
          const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
          const res = await fetch(it.url!, {
            method: "PUT",
            body,
            headers: { "x-upsert": "false", ...(anon ? { apikey: anon } : {}) },
          });
          if (!res.ok) {
            const text = await res.text();
            if (!/exists|duplicate/i.test(text)) throw new Error(`Upload failed (${res.status})`);
          }
          it = { ...it, uploaded: true };
          await queue.put(it);
        }
        const c = await confirmUpload({
          deal_id: it.dealId,
          folder: it.folder as never,
          path: it.path!,
          mime: it.mime,
          size: it.size,
          title: it.name,
          photo_tag: (it.tag as never) ?? null,
          requirement_id: it.requirementId,
          taken_at: it.takenAt,
          width: it.width,
          height: it.height,
          number: it.dealNumber,
        });
        if (!c.ok) {
          if (/didn't reach storage/.test(c.error ?? "")) await queue.put({ ...it, uploaded: false });
          throw new Error(c.error);
        }
        await queue.remove(it.id);
        onDone(it.dealNumber);
      } catch (e) {
        await queue.put({ ...it, attempts: it.attempts + 1, error: e instanceof Error ? e.message : "Upload failed" });
      } finally {
        window.dispatchEvent(new Event(QUEUE_EVENT));
      }
    }
  } finally {
    running = false;
  }
}

/** Mounted once in the app shell: keeps uploading in the background and shows a small status pill. */
export function PhotoQueueRunner() {
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try {
        const n = (await queue.all()).length;
        if (alive) setCount(n);
      } catch {
        /* IndexedDB unavailable (private mode): nothing queued */
      }
    };
    const kick = () => {
      setOffline(!navigator.onLine);
      void processQueue(() => router.refresh()).then(refresh);
    };
    kick();
    const timer = setInterval(kick, 20_000);
    window.addEventListener("online", kick);
    window.addEventListener("offline", kick);
    window.addEventListener(QUEUE_EVENT, refresh);
    window.addEventListener("photo-queue:kick", kick);
    document.addEventListener("visibilitychange", kick);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener("online", kick);
      window.removeEventListener("offline", kick);
      window.removeEventListener(QUEUE_EVENT, refresh);
      window.removeEventListener("photo-queue:kick", kick);
      document.removeEventListener("visibilitychange", kick);
    };
  }, [router]);

  if (!count) return null;
  return (
    <div className="fixed top-16 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-foreground px-3.5 py-2 text-xs font-semibold text-background shadow-lg lg:top-4">
      {offline ? <WifiOff className="size-4" /> : <CloudUpload className="size-4 animate-pulse" />}
      {count} photo{count === 1 ? "" : "s"} {offline ? "saved, waiting for signal" : "uploading"}
    </div>
  );
}
