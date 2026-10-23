/* Service worker: Web Push + notification clicks. Kept tiny on purpose (no offline cache yet). */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Kitchen Sales", body: event.data ? event.data.text() : "" };
  }
  // Home-screen icon badge = unread count (iOS 16.4+ web apps, Chrome/Edge).
  const badge =
    typeof data.badge === "number" && self.navigator.setAppBadge
      ? self.navigator.setAppBadge(data.badge).catch(() => {})
      : Promise.resolve();
  event.waitUntil(
    badge.then(() => self.registration.showNotification(data.title || "Kitchen Sales", {
      body: data.body || "",
      tag: data.tag,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url || "/today" },
    })),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/today";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
