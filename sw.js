// Service worker for the Town Almanac PWA — cache-first with network fallback.
const CACHE_NAME = "almanac-v7";

// Base path the SW is served from, so it works whether the app is hosted at the
// domain root or in a subfolder.
const getBasePath = () => {
	const swPath = self.location.pathname;
	return swPath.substring(0, swPath.lastIndexOf("/") + 1);
};
const basePath = getBasePath();

// App shell + data precached on install. Villager images are precached too, but
// only after the shell (see install) so the app is usable while images fill in.
const STATIC_FILES = [
	"./",
	"index.html",
	"manifest.json",
	"resources/styles.css",
	"resources/script.js",
	"resources/events.json",
	"resources/villagers.json",
	"resources/almanac_icon.png",
	"resources/fonts/fredoka-latin.woff2",
	"resources/fonts/baloo2-latin.woff2"
];

// Resolve a relative app path against the SW base path.
const resolve = (url) => {
	if (url === "./") return new URL(basePath, self.location.href).href;
	return new URL(url, new URL(basePath, self.location.href)).href;
};

// Cache a list of URLs, skipping any already cached. Uses allSettled so one
// failed fetch never rejects the whole batch.
const cacheUrls = (cache, urls) =>
	Promise.allSettled(
		urls.map((url) =>
			cache.match(url).then((existing) => {
				if (existing) return;
				return fetch(url, { cache: "no-cache" }).then((res) => {
					if (!res.ok) throw new Error("HTTP " + res.status);
					return cache.put(url, res);
				});
			})
		)
	);

// Mirror of script.js slug() so image URLs match what the app requests.
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

// Build the villager image URL list from the cached villagers.json.
const villagerImageUrls = (cache) =>
	cache.match(resolve("resources/villagers.json"))
		.then((res) => (res ? res.json() : fetch(resolve("resources/villagers.json")).then((r) => r.json())))
		.then((villagers) =>
			villagers.map((v) => resolve("resources/images/villagers/" + slug(v.name) + ".webp"))
		)
		.catch(() => []);

// Install — cache the shell only if not already cached, so a redeploy doesn't
// overwrite a working install. Bump CACHE_NAME to ship a fresh shell. Villager
// images are precached only after the shell finishes, so the app shell is ready
// first and images backfill behind it.
self.addEventListener("install", (event) => {
	self.skipWaiting();
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) =>
			cacheUrls(cache, STATIC_FILES.map(resolve))
				.then(() => villagerImageUrls(cache))
				.then((imageUrls) => cacheUrls(cache, imageUrls))
		)
	);
});

// Activate — drop caches from older versions, then take control.
self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
			.then(() => self.clients.claim())
	);
});

// Fetch — cache first, fall back to network (and cache what we fetch). Any image
// not yet precached at install time still gets picked up here on first view.
self.addEventListener("fetch", (event) => {
	if (!event.request.url.startsWith("http")) return;

	event.respondWith(
		caches.match(event.request).then((cached) => {
			if (cached) return cached;

			// Navigation miss: serve the cached app shell so the page renders
			// from cache offline even if the launch URL doesn't byte-match a key.
			if (event.request.mode === "navigate") {
				const shellUrl = new URL(basePath, self.location.href).href;
				return caches.match(shellUrl)
					.then((shell) => shell || caches.match("index.html"))
					.then((shell) => shell || fetch(event.request));
			}

			return fetch(event.request).then((res) => {
				if (!res || res.status !== 200 || res.type === "error") return res;
				const copy = res.clone();
				caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
				return res;
			});
		})
	);
});
