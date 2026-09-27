// Us — service worker (web only, registered from src/lib/push.ts).
// Only handles Web Push: shows the notification and opens the right screen.
// No offline caching (the app always talks to Supabase anyway).
/* eslint-disable no-restricted-globals */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Payload from supabase/functions/_shared/notify.ts:
//   { title, body, url, tag }
// ALWAYS shows a notification — iOS revokes the subscription if a push
// doesn't. If an Us window is open and visible, it ALSO gets the payload
// (postMessage "us:push") so the app can show its in-app banner.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: event.data ? event.data.text() : "Us" };
  }
  const title = data.title || "Us";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag || undefined, // same tag replaces the older one (grouping)
    renotify: !!data.tag,
    data: { url: data.url || "/" },
  };
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      (async () => {
        try {
          const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
          for (const client of windows) {
            if (client.focused || client.visibilityState === "visible") {
              client.postMessage({ type: "us:push", payload: { title, body: options.body, url: options.data.url, tag: data.tag || "" } });
            }
          }
        } catch (e) {}
      })(),
    ]),
  );
});

// Tap → focus an open Us window and send it to the deep link (the app
// navigates with the router), or open a new window at that URL.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = (event.notification.data && event.notification.data.url) || "/";
  const target = new URL(path, self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).origin !== self.location.origin) continue;
        try {
          await client.focus();
        } catch (e) {}
        client.postMessage({ type: "us:navigate", url: path });
        return;
      }
      await self.clients.openWindow(target);
    })(),
  );
});
