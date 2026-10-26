// Service Worker — يسمح بتثبيت التطبيق على الجوال ويعرض الإشعارات
// عند تعديل ملفات التطبيق غيّر رقم الإصدار حتى يتحدث عند المستخدمين
const CACHE = "gis-app-v3";
const SHELL = [
  "./", "index.html", "company.html", "gis.html", "maintenance.html", "request.html",
  "css/style.css", "js/core.js", "js/firebase-config.js",
  "js/auth.js", "js/company.js", "js/gis.js", "js/maintenance.js", "js/request.js",
  "manifest.json", "icons/icon-192.png", "icons/icon-512.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

// الشبكة أولاً، والنسخة المحفوظة عند انقطاع الإنترنت (لملفات التطبيق فقط)
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const link = e.notification.data?.link || "index.html";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      for (const c of list) { if ("focus" in c) { c.navigate(link); return c.focus(); } }
      return self.clients.openWindow(link);
    })
  );
});
