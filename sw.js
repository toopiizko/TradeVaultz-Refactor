// Minimal SW just to enable Web Share Target on Android Chrome.
// On iOS, Share Target isn't supported — we provide an iOS Shortcut instead.
self.addEventListener("install", (e) => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method === "POST" && url.pathname === "/share") {
    event.respondWith(handleShare(event));
  }
});

async function handleShare(event) {
  try {
    const formData = await event.request.formData();
    const files = formData.getAll("files").filter((f) => f && f.size);
    // Stash files in a cache so the page can pick them up after redirect
    const cache = await caches.open("share-target-v1");
    const stashed = [];
    for (const f of files) {
      const id = `share-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await cache.put(`/__share/${id}`, new Response(f, { headers: { "content-type": f.type || "image/jpeg", "x-filename": f.name || "slip" } }));
      stashed.push(id);
    }
    const params = new URLSearchParams({ ids: stashed.join(",") });
    return Response.redirect(`/share?${params.toString()}`, 303);
  } catch (e) {
    return Response.redirect("/share?error=1", 303);
  }
}
