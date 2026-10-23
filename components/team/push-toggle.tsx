"use client";

import { useEffect, useState, useTransition } from "react";
import { BellOff, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { removePushSubscription, savePushSubscription } from "@/server/actions/push";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

type Status = "loading" | "unsupported" | "needs-install" | "off" | "on" | "blocked" | "no-keys";

/** iPhone: push works only after "Add to Home Screen" (iOS 16.4+) and opening the app from there. */
export function PushToggle({ vapidKey }: { vapidKey: string | undefined }) {
  const [status, setStatus] = useState<Status>("loading");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    (async () => {
      if (!vapidKey) return setStatus("no-keys");
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        const ios = /iPhone|iPad/.test(navigator.userAgent);
        const standalone = window.matchMedia("(display-mode: standalone)").matches;
        return setStatus(ios && !standalone ? "needs-install" : "unsupported");
      }
      if (Notification.permission === "denied") return setStatus("blocked");
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.getSubscription();
      setStatus(sub ? "on" : "off");
    })().catch(() => setStatus("unsupported"));
  }, [vapidKey]);

  function enable() {
    start(async () => {
      try {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") return setStatus("blocked");
        const reg = await navigator.serviceWorker.register("/sw.js");
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey!),
        });
        const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
        const r = await savePushSubscription({ endpoint: json.endpoint, keys: json.keys, userAgent: navigator.userAgent });
        setStatus(r?.ok ? "on" : "off");
        setMsg(r?.ok ? (r.message ?? null) : (r?.error ?? "Could not turn on"));
      } catch (e) {
        setMsg((e as Error).message);
      }
    });
  }

  function disable() {
    start(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription({ endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setStatus("off");
    });
  }

  const text: Record<Status, string> = {
    loading: "Checking…",
    unsupported: "This browser can't receive push notifications.",
    "needs-install": "On iPhone: tap Share → Add to Home Screen, open the app from there, then turn notifications on.",
    off: "Get a push on this phone for new leads, @mentions and payments.",
    on: "Push notifications are on for this device.",
    blocked: "Notifications are blocked for this site. Allow them in your phone's settings.",
    "no-keys": "Push isn't configured on the server yet (VAPID keys, see docs/DEPLOY.md).",
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">{text[status]}</p>
      {status === "off" ? (
        <Button onClick={enable} disabled={pending} className="h-11 w-fit">
          <BellRing /> Turn on notifications
        </Button>
      ) : status === "on" ? (
        <Button variant="outline" onClick={disable} disabled={pending} className="h-11 w-fit">
          <BellOff /> Turn off on this device
        </Button>
      ) : null}
      {msg ? <p className="text-sm">{msg}</p> : null}
    </div>
  );
}
