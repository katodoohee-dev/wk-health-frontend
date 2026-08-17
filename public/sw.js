// Service Worker สำหรับ Web Push — แสดงแจ้งเตือนจริงบนอุปกรณ์เมื่อ backend ส่ง push มา
// ต้อง register จากหน้า /notifications ก่อน (ผ่าน navigator.serviceWorker.register("/sw.js"))

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = { title: "WK Health App", body: "มีการแจ้งเตือนใหม่" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // ถ้า payload ไม่ใช่ JSON ก็ใช้ค่า default ด้านบนแทน ไม่ให้ push พังทั้งก้อน
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag: "wk-health-notification",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("/notifications");
    }),
  );
});
