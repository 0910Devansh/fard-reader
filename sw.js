// Offline support: every file the app needs is stored on the phone at install.
const CACHE = 'fard-reader-v20.7';
const FILES = [
 "./",
 "index.html",
 "app.js",
 "engine.js",
 "translit.js",
 "manifest.webmanifest",
 "icon-192.png",
 "icon-512.png",
 "vendor/pdf.min.mjs",
 "vendor/pdf.worker.min.mjs",
 "vendor/tesseract-worker.min.js",
 "vendor/tesseract.esm.min.js",
 "vendor/standard_fonts/FoxitDingbats.pfb",
 "vendor/standard_fonts/FoxitFixed.pfb",
 "vendor/standard_fonts/FoxitFixedBold.pfb",
 "vendor/standard_fonts/FoxitFixedBoldItalic.pfb",
 "vendor/standard_fonts/FoxitFixedItalic.pfb",
 "vendor/standard_fonts/FoxitSerif.pfb",
 "vendor/standard_fonts/FoxitSerifBold.pfb",
 "vendor/standard_fonts/FoxitSerifBoldItalic.pfb",
 "vendor/standard_fonts/FoxitSerifItalic.pfb",
 "vendor/standard_fonts/FoxitSymbol.pfb",
 "vendor/standard_fonts/LICENSE_FOXIT",
 "vendor/standard_fonts/LICENSE_LIBERATION",
 "vendor/standard_fonts/LiberationSans-Bold.ttf",
 "vendor/standard_fonts/LiberationSans-BoldItalic.ttf",
 "vendor/standard_fonts/LiberationSans-Italic.ttf",
 "vendor/standard_fonts/LiberationSans-Regular.ttf",
 "vendor/lang/pan.traineddata",
 "vendor/core/tesseract-core-lstm.wasm.js",
 "vendor/core/tesseract-core-simd-lstm.wasm.js"
];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request)));
});
