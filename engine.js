// Varaha Fard scanner - engine. A line-by-line port of land_scan.py (the tested Mac tool).
// Everything runs on the device: pdf.js renders pages, tesseract.js reads Gurmukhi.
import * as pdfjsLib from './vendor/pdf.min.mjs';
import Tesseract from './vendor/tesseract.esm.min.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.min.mjs', import.meta.url).href;
const TABLE_W = 1813;
const BASE = new URL('./', import.meta.url).href;

// ---------------- OCR workers ----------------
let scheduler = null;
export async function initOCR(nWorkers, onStatus) {
  if (scheduler) return;
  scheduler = Tesseract.createScheduler();
  for (let i = 0; i < nWorkers; i++) {
    onStatus && onStatus(`Loading reader ${i + 1} of ${nWorkers}...`);
    const w = await Tesseract.createWorker('pan', 1, {
      workerPath: BASE + 'vendor/tesseract-worker.min.js', corePath: BASE + 'vendor/core',
      langPath: BASE + 'vendor/lang', gzip: false, cacheMethod: 'none', workerBlobURL: false,
    });
    await w.setParameters({ tessedit_pageseg_mode: '7', textord_noise_rejrows: '0' });
    scheduler.addWorker(w);
  }
}
async function ocrMany(canvases) {
  const res = await Promise.all(canvases.map(c => scheduler.addJob('recognize', c)));
  for (const c of canvases) { c.width = 0; c.height = 0; }
  return res.map(r => r.data.text.trim().replace(/\n/g, ' '));
}

// ---------------- image helpers (img = {w, h, d: RGBA Uint8ClampedArray}) ----------------
function grayOf(img) {
  const { w, h, d } = img, g = new Uint8Array(w * h);
  for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = (d[j] * 299 + d[j + 1] * 587 + d[j + 2] * 114) / 1000;
  return g;
}
function binarize(img, dropRed, thr = 150) {
  const { w, h, d } = img, bw = new Uint8Array(w * h), red = new Uint8Array(w * h);
  for (let i = 0, j = 0; i < bw.length; i++, j += 4) {
    const r = d[j], g = d[j + 1], b = d[j + 2];
    const isRed = r > 140 && g < 130 && b < 130 && r - g > 60;
    red[i] = isRed ? 1 : 0;
    let v = (r + g + b) / 3 < thr ? 0 : 255;
    if (isRed) v = dropRed ? 255 : 0;
    bw[i] = v;
  }
  return { bw, red };
}
function crop(bw, W, x0, y0, x1, y1) {
  const w = Math.max(0, x1 - x0), h = Math.max(0, y1 - y0), out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) out.set(bw.subarray((y0 + y) * W + x0, (y0 + y) * W + x0 + w), y * w);
  return { a: out, w, h };
}
function groups(idx, gap = 3) {
  const g = [];
  for (const i of idx) { if (g.length && i - g[g.length - 1][g[g.length - 1].length - 1] <= gap) g[g.length - 1].push(i); else g.push([i]); }
  return g;
}
const last = g => g[g.length - 1];
// remove table ruling lines (they make Tesseract skip text lines)
function unrule({ a, w, h }, f = 1) {
  const L = Math.floor(w * 0.8), V = 45 * f, out = a.slice();
  if (w >= L && L > 0) for (let y = 0; y < h; y++) {
    let run = 0;
    for (let x = 0; x <= w; x++) {
      if (x < w && a[y * w + x] === 0) { run++; continue; }
      if (run >= L) for (let k = x - run; k < x; k++) out[y * w + k] = 255;
      run = 0;
    }
  }
  if (h >= V) for (let x = 0; x < w; x++) {
    let run = 0;
    for (let y = 0; y <= h; y++) {
      if (y < h && a[y * w + x] === 0) { run++; continue; }
      if (run >= V) for (let k = y - run; k < y; k++) out[k * w + x] = 255;
      run = 0;
    }
  }
  return { a: out, w, h };
}
function lineBands({ a, w, h }, minH = 9) {
  const rows = new Array(h);
  for (let y = 0; y < h; y++) { let any = false; for (let x = 0; x < w; x++) if (a[y * w + x] === 0) { any = true; break; } rows[y] = any; }
  const bands = []; let y = 0;
  while (y < h) {
    if (rows[y]) { const s = y; while (y < h && rows[y]) y++; bands.push([s, y]); }
    y++;
  }
  const merged = [];
  for (const b of bands) {
    const m = merged[merged.length - 1];
    if (m && (b[1] - b[0] < minH || m[1] - m[0] < minH) && b[0] - m[1] <= 4) m[1] = b[1]; else merged.push(b);
  }
  return merged.filter(b => b[1] - b[0] >= minH);
}
function rows(img, a, b) { a = Math.max(0, a); b = Math.min(img.h, b); return { a: img.a.slice(a * img.w, b * img.w), w: img.w, h: b - a }; }
// scale a line up and put it on a white margin, like the Mac tool does
function pad({ a, w, h }, scale) {
  const src = document.createElement('canvas'); src.width = w; src.height = h;
  const sx = src.getContext('2d'), id = sx.createImageData(w, h);
  for (let i = 0; i < a.length; i++) { const v = a[i]; id.data[4 * i] = v; id.data[4 * i + 1] = v; id.data[4 * i + 2] = v; id.data[4 * i + 3] = 255; }
  sx.putImageData(id, 0, 0);
  const c = document.createElement('canvas'); c.width = w * scale + 40; c.height = h * scale + 30;
  const cx = c.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, c.width, c.height);
  cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high';
  cx.drawImage(src, 20, 15, w * scale, h * scale);
  return c;
}
function columnLines(bw, W, x0, x1, y0, y1, hi = null) {
  const arr = unrule(crop(bw, W, x0, y0, x1, y1));
  return lineBands(arr).map(([a, b]) => {
    if (!hi) return { y: y0 + a, img: pad(rows(arr, a - 3, b + 3), 2) };
    const f = hi.f, ya = Math.max(0, y0 + a - 3), yb = Math.min(y1, y0 + b + 3);
    return { y: y0 + a, img: pad(unrule(crop(hi.bw, hi.W, x0 * f, ya * f, x1 * f, yb * f), f), 1) };
  });
}

// ---------------- table grid ----------------
function findGrid(img) {
  const g = grayOf(img), { w, h } = img;
  const dark = new Uint8Array(w * h); for (let i = 0; i < dark.length; i++) dark[i] = g[i] < 110 ? 1 : 0;
  const rowIdx = [];
  for (let y = 0; y < h; y++) { let s = 0; for (let x = 0; x < w; x++) s += dark[y * w + x]; if (s > w * 0.5) rowIdx.push(y); }
  const hl = groups(rowIdx);
  if (hl.length < 2) return null;
  const b0 = last(hl[0]) + 3, b1 = hl[1][0] - 2, bh = b1 - b0;
  if (bh < 8) return null;
  const colIdx = [];
  for (let x = 0; x < w; x++) { let s = 0; for (let y = b0; y < b1; y++) s += dark[y * w + x]; if (s > bh * 0.85) colIdx.push(x); }
  const xs = groups(colIdx).map(q => q[0]);
  if (xs.length !== 9) return null;
  const unit = (xs[8] - xs[0]) / TABLE_W;
  const below = hl.slice(2).filter(q => 60 * unit < q[0] - last(hl[1]) && q[0] - last(hl[1]) < 170 * unit);
  const top = below.length ? last(below[0]) + 3 : last(hl[1]) + 3;
  let y = top, gap = 0;
  while (y < h && gap <= 5) {
    let on = false; for (let x = xs[0]; x < xs[0] + 3; x++) if (dark[y * w + x]) { on = true; break; }
    gap = on ? 0 : gap + 1; y++;
  }
  return { x: xs, top, bottom: y - gap - 2, tableTop: hl[0][0] };
}

// ---------------- pages ----------------
function canvasToImg(c) {
  const w = c.width, h = c.height, d = c.getContext('2d').getImageData(0, 0, w, h).data;
  c.width = 0; c.height = 0;                       // release the canvas now
  return { w, h, d };
}
async function renderPage(page, scale) {
  const vp = page.getViewport({ scale }), c = document.createElement('canvas');
  c.width = Math.round(vp.width); c.height = Math.round(vp.height);
  // intent 'print': pdf.js then draws without waiting for screen repaints (requestAnimationFrame),
  // which Chrome stops in background tabs - so reading continues while the user does something else
  await page.render({ canvasContext: c.getContext('2d'), viewport: vp, intent: 'print' }).promise;
  return { img: canvasToImg(c), vp };
}
async function scannedImage(page) {
  const ops = await page.getOperatorList(), O = pdfjsLib.OPS, idx = [];
  ops.fnArray.forEach((f, i) => { if (f === O.paintImageXObject || f === O.paintInlineImageXObject || f === O.paintImageXObjectRepeat) idx.push(i); });
  let o = null;
  for (const i of idx) {
    if (ops.fnArray[i] !== O.paintImageXObject) continue;
    const name = ops.argsArray[i][0], store = name.startsWith('g_') ? page.commonObjs : page.objs;
    const im = await new Promise(res => store.get(name, res));
    if (!o || im.width * im.height > o.width * o.height) o = im;
  }
  if (!o || o.width < 800) return null;             // e.g. only a QR code: not a scanned page
  const c = document.createElement('canvas'); c.width = o.width; c.height = o.height;
  const cx = c.getContext('2d');
  if (o.bitmap) cx.drawImage(o.bitmap, 0, 0);
  else {
    const id = cx.createImageData(o.width, o.height), n = o.width * o.height, s = o.data;
    if (o.kind === 3) id.data.set(s);
    else if (o.kind === 2) for (let i = 0; i < n; i++) { id.data[4*i] = s[3*i]; id.data[4*i+1] = s[3*i+1]; id.data[4*i+2] = s[3*i+2]; id.data[4*i+3] = 255; }
    else return null;
    cx.putImageData(id, 0, 0);
  }
  return canvasToImg(c);
}
function scaleImg(img, s) {
  const src = document.createElement('canvas'); src.width = img.w; src.height = img.h;
  src.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(img.d), img.w, img.h), 0, 0);
  const c = document.createElement('canvas'); c.width = Math.round(img.w * s); c.height = Math.round(img.h * s);
  const cx = c.getContext('2d'); cx.imageSmoothingQuality = 'high'; cx.drawImage(src, 0, 0, c.width, c.height);
  return canvasToImg(c);
}
// -> {img, grid, words}; words = text-layer words in pixels (digital PDFs only; their digits are exact)
const HEAD_ITEM = /^\s*(?:ਖ\S*\s*ਨੰ\/|ਮਾਲ\/ਪੱਤੀ\S*(?:\s+\S+){0,3}|ਖਤੌਨੀ|ਨੰਬਰ\/\s*\S*|ਲਗਾਨ|ਮਾਲਕ ਦਾ .*|ਕਾਸ਼ਤਕਾਰ ਦਾ .*|\S*ੰਚਾਈ ਦਾ.*|ਸਾਧਨ|ਮੁਰੱਬਾ ਅਤੇ.*|ਰਕਬਾ ਅਤੇ.*|\S*ਸ਼ੇਸ ਕਥਨ)\s*$/;
async function loadPage(pdf, n) {
  const page = await pdf.getPage(n);
  const tc = await page.getTextContent();
  const textChars = tc.items.reduce((s, it) => s + (it.str || '').trim().length, 0);
  // a scanned Fard has (almost) no text layer; a downloaded one has text (and maybe a small QR image)
  let img = textChars < 50 ? await scannedImage(page) : null, words = null, hiImg = null;
  if (!img) {
    let r = await renderPage(page, 100 / 72);
    const g = findGrid(r.img);
    const scale = g ? (100 * TABLE_W / (g.x[8] - g.x[0])) / 72 : 250 / 72;
    r = await renderPage(page, scale); img = r.img;
    hiImg = (await renderPage(page, scale * 2)).img;
    words = [];
    // column headings are their own text items. On some Fards the first khewat of a page starts on the same line as
    // the second heading line ('ਮਾਲ/ਪੱਤੀ, ਨੰਬ' next to '671/ 630', 'ਨੰਬਰ/ ਲਗ' next to '1281'), and the two would be read as
    // one line and dropped as heading text - losing that khewat. Leave the heading items out (only in the heading band).
    const hy = it => it.transform[5];
    const kh = tc.items.find(it => /^ਖ\S*\s*ਨੰ\/$/.test((it.str || '').trim()));
    const isHeading = it => kh && Math.abs(hy(it) - hy(kh)) <= 25 && HEAD_ITEM.test(it.str);
    for (const it of tc.items) {
      if (!it.str || !it.str.trim() || isHeading(it)) continue;
      const [x, y] = r.vp.convertToViewportPoint(it.transform[4], it.transform[5]);
      const hgt = (it.height || Math.hypot(it.transform[2], it.transform[3])) * scale;
      const wid = it.width * scale, total = it.str.length || 1;
      let pos = 0;
      for (const part of it.str.split(/(\s+)/)) {
        if (part.trim()) words.push([x + wid * pos / total, y - hgt, x + wid * (pos + part.length) / total, y + hgt * 0.2, part]);
        pos += part.length;
      }
    }
  }
  // the 'Not For Legal Purpose' watermark is part of some text layers; it must not be read as table text
  if (words) words = words.filter(w => !/^(not|for|legal|purpose)$/i.test(w[4]));
  let bigha = false;
  if (words && isBigha(words.map(w => w[4]).join(' '))) { bigha = true; words = words.map(w => [w[0], w[1], w[2], w[3], toKanal(w[4])]); }
  let grid = findGrid(img);
  if (grid) {
    const s = TABLE_W / (grid.x[8] - grid.x[0]);
    if (Math.abs(s - 1) > 0.03) {
      img = scaleImg(img, s); grid = findGrid(img); hiImg = null;
      if (words) words = words.map(w => [w[0] * s, w[1] * s, w[2] * s, w[3] * s, w[4]]);
    }
  }
  page.cleanup();
  if (hiImg && (hiImg.w !== img.w * 2 || hiImg.h !== img.h * 2)) hiImg = null;   // keep coordinates exact
  return { img, grid, words, hiImg, bigha };
}

// ---------------- reading numbers ----------------
const STRIP = s => s.replace(/^[ ._\-!|'"]+|[ ._\-!|'"]+$/g, '');
const FRAC = /(\d+)\s*\/\s*(\d+)/;
// 'ਰਕਬਾ N ਕਨਾਲ N ਮਰਲਾ' - first letter may be misread (ਚਕਬਾ), so anchor on ...ਕਬਾ
const TOTAL = /\S?ਕਬਾ\s*(?:q\s*)?(\d+)\s*ਕਨਾਲ\s*(\d+)\s*ਮਰਲਾ/;      // some text layers have a stray 'q' glyph: 'ਰਕਬਾ q 149 ਕਨਾਲ'
// the word ਰਕਬਾ itself (first letter may be misread) - not names like ਗੁਰਇਕਬਾਲ; a totals row also says ਕਨਾਲ/ਮਰਲਾ
const RAKBA = /(?:^|\s)\S?ਕਬਾ(?=\s|\d|$)[^]*(?:ਕਨਾਲ|ਮਰਲਾ)/;
// khewat header = first line under a rule in column 1: '25/ 18', '25 18' (slash lost) or '25'
// khatauni may carry a sub-number: '837/1'
const KHEWAT_PAT = /^\D{0,2}(\d+)(?:\s*\/.*|\s+\d+)?$/, KHATAUNI_PAT = /^\D{0,2}(\d+(?:\s*\/\s*\d+)?)\D{0,2}$/;
function bestVote(votes) { let best = null, n = 0; for (const [k, v] of votes) if (v > n) { best = k; n = v; } return [best, n]; }

async function numberVote(ctx, x0, x1, y, pat, first) {
  if (ctx.words) { const m = STRIP(bandText(ctx.words, x0, x1, y)).match(pat); if (m) return m[1]; }  // digital: exact
  const votes = new Map(), m0 = STRIP(first || '').match(pat);
  if (m0) votes.set(m0[1], 1);
  const imgs = [];
  for (const drop of [true, false]) {
    const bw = ctx.bin(drop, 150);
    const arr = unrule(crop(bw, ctx.W, x0, y - 4, x1, y + 24));
    for (const s of [2, 3, 4]) imgs.push(pad(arr, s));
  }
  for (const t of await ocrMany(imgs)) { const m = STRIP(t).match(pat); if (m) votes.set(m[1], (votes.get(m[1]) || 0) + 1); }
  if (!votes.size) return null;
  const [best, n] = bestVote(votes);
  return n >= 2 ? best : null;
}
function firstLinesBelowRules(bw, W, x0, x1, top, bot, lineYs) {
  const idx = [];
  for (let y = top; y < bot; y++) { let s = 0; for (let x = x0; x < x1; x++) if (bw[y * W + x] === 0) s++; if (s >= 0.8 * (x1 - x0)) idx.push(y - top); }
  const rules = [top, ...groups(idx).map(g => top + last(g))], out = new Set();
  for (const r of rules) { const nxt = lineYs.filter(y => r < y + 8 && y + 8 <= r + 30); if (nxt.length) out.add(Math.min(...nxt)); }
  return [...out].sort((a, b) => a - b);
}
const pickFrac = t => { const m = t.match(FRAC); return m ? `${m[1]}/${m[2]}` : null; };
const HISSA_DIGITS = /\d+(?=[\s|\[\]!_.,:;'"“”]*\S*ਸ[ਾੇ])/;
const putFrac = (t, k) => FRAC.test(t) ? t.replace(FRAC, k) : HISSA_DIGITS.test(t) ? t.replace(HISSA_DIGITS, k) : t.replace(/\d{3,}/, k);
const pickTotal = t => { const m = t.match(TOTAL); return m ? `${m[1]}-${m[2]}` : null; };
const putTotal = (t, k) => { const [a, b] = k.split('-'); return t.replace(TOTAL, `ਰਕਬਾ ${a} ਕਨਾਲ ${b} ਮਰਲਾ`); };

// scanned pages: re-read lines 3 more ways and take the majority number
async function vote(ctx, col, lines, pick, put) {
  const todo = lines.map(([y, t], i) => [i, y, t]).filter(([, , t]) => pick(t) !== null || /\d{3,}/.test(t) || (pick === pickFrac && HISSA_DIGITS.test(t)));
  if (!todo.length) return lines;
  const variants = [[true, 150, 3], [true, 130, 2], [true, 170, 3]], imgs = [];
  for (const [drop, thr, s] of variants) {
    const bw = ctx.bin(drop, thr);
    for (const [, y] of todo) {
      const arr = unrule(crop(bw, ctx.W, col[0], y - 3, col[1], y + 26));
      const band = lineBands(arr), [a, b] = band.length ? band[0] : [0, arr.h];
      imgs.push(pad(rows(arr, a - 3, b + 3), s));
    }
  }
  const reads = await ocrMany(imgs), out = lines.slice();
  todo.forEach(([i, y, t], j) => {
    const votes = new Map();
    for (const c of [t, ...variants.map((_, k) => reads[k * todo.length + j])]) { const key = pick(c); if (key) votes.set(key, (votes.get(key) || 0) + 1); }
    if (votes.size) out[i] = [y, put(t, bestVote(votes)[0])];
  });
  return out;
}
function bandText(words, x0, x1, y, h = 24) {
  return words.filter(w => x0 <= (w[0] + w[2]) / 2 && (w[0] + w[2]) / 2 <= x1 && y - 3 <= (w[1] + w[3]) / 2 && (w[1] + w[3]) / 2 <= y + h)
    .sort((a, b) => a[0] - b[0]).map(w => w[4]).join(' ');
}
// digital pages: take the digits from the text layer
function snapNumbers(words, lines, x0, x1, pick, put) {
  return lines.map(([y, t]) => {
    if (pick(t) !== null || /\d{3,}/.test(t) || (pick === pickFrac && /\d/.test(t))) { const k = pick(bandText(words, x0, x1, y)); if (k) t = put(t, k); }
    return [y, t];
  });
}

// ---------------- totals, hectares, khasras ----------------
const M2_PER_MARLA = 25.29285;                       // 1 kanal = 20 marla = 505.857 m2
// Patiala-side Fards use bigha-biswa (1 bigha = 20 biswa; 1 biswa = 5/3 marla = 42.15475 m2, checked against the
// hectare figures printed in such Fards). Their text is read with the same kanal-marla rules; only the m2 differs.
const M2_PER_BISWA = M2_PER_MARLA * 5 / 3;
let unitM2 = M2_PER_MARLA;
const agrees = (marla, m2) => Math.abs(marla * unitM2 - m2) <= 1 + m2 * 1e-4;
const BIGHA = /(?:ਬਿ|ਸਬ|ਬ)[ਗਘ]ਾ/g, BISWA = /(?:ਬਿ|ਸਬ|ਬ)ਸ?ਵਾ(?=\s|$|\))/g;   // ਬਿਗਾ / ਬਿਸਵਾ (text layers: ਸਬਗਾ / ਸਬਸਵਾ)
const isBigha = t => /\d\s*(?:ਬਿ|ਸਬ|ਬ)[ਗਘ]ਾ\s*\d/.test(t);
const toKanal = t => t.replace(BIGHA, 'ਕਨਾਲ').replace(BISWA, 'ਮਰਲਾ');
// 'ਰਕਬਾ 38 ਕਨਾਲ 8 ਮਰਲਾ (1 ਹੈਕਟੇਅਰ 94 ਏਅਰ 24.91 ...' -> [kanal, marla, m2 or null]
const TOTAL_HA = /\S?ਕਬਾ\s*(\d+)\s*ਕਨਾਲ\s*(\d+)\s*ਮਰਲਾ\s*\(?\s*(\d+)\s*\S*\s*(\d+)\s*\S*\s*(\d+(?:\.\d+)?)/;
// after '... ਮਰਲਾ': '(4 ਹੈਕਟੇਅਰ 50 ਏਅਰ 21.28' -> hectare, are, optional centiare (strict: words between numbers)
const HA = /ਮਰਲਾ\s*\(?\s*(?:q\s*)?(\d+)\s+\S+\s+(\d+)(?:\s+\S+\s+(\d+(?:\.\d+)?))?/;
function parseTotal(t) {
  const k = t.match(TOTAL); if (!k) return null;
  const h = t.slice(k.index).match(HA);
  if (!h) return [+k[1], +k[2], null, null];
  const base = (+h[1]) * 10000 + (+h[2]) * 100;
  return [+k[1], +k[2], h[3] !== undefined ? base + parseFloat(h[3]) : null, base];
}
const KM_HA = /(\d+)\s*ਕਨਾ\S*\s*(\d+)\s*ਮਰ\S*(?:\s*\(?\s*(\d+)\s+\S+\s+(\d+)(?:\s+\S+\s+(\d+(?:\.\d+)?))?)?/;
function parseKM(t) {
  const m = t.match(KM_HA); if (!m) return null;
  const base = m[3] !== undefined ? (+m[3]) * 10000 + (+m[4]) * 100 : null;
  return [+m[1], +m[2], base !== null && m[5] !== undefined ? base + parseFloat(m[5]) : null, base];
}
const validKM = t => t && t[1] < 20 ? t : null;       // 20 marla = 1 kanal, so 'M' is always 0-19
// text layer only (exact digits): a number can come in pieces ('ਰਕਬਾ 18 0 ਕਨਾਲ' = 180), and a few Fards print
// 20 marla or more ('120 ਕਨਾਲ 20 ਮਰਲਾ' = 121 K - 0 M); -> [kanal, marla, m2, ha+are, note]
function parseTotalText(t) {
  let tot = parseTotal(t), note = '';
  const sp = t.match(/\S?ਕਬਾ\s*(?:q\s*)?(\d+(?:\s+\d+)+)\s*ਕਨਾਲ/);
  if (sp) {
    const j = parseTotal(t.replace(sp[1], sp[1].replace(/\s+/g, '')));
    const off = r => r && r[2] !== null ? Math.abs((r[0] * 20 + r[1]) * unitM2 - r[2]) : Infinity;
    if (j && (!tot || off(j) < off(tot))) tot = j;
  }
  if (tot && tot[1] >= 20) { note = `total printed as ${tot[0]} kanal ${tot[1]} marla (= ${tot[0] + Math.floor(tot[1] / 20)} K - ${tot[1] % 20} M)`; tot = [tot[0] + Math.floor(tot[1] / 20), tot[1] % 20, tot[2], tot[3]]; }
  return tot && [...tot, note];
}
// khatauni total in column 7: '19-15 (0-99-90.68)' -> [kanal, marla, m2 or null]
function parseKtotal(t) {
  const m = t.match(/(\d+)\s*-\s*(\d+)\s*\(\s*(\d+)\s*-\s*(\d+)\s*-\s*(\d+(?:\.\d+)?)/);
  if (m) return [+m[1], +m[2], (+m[3]) * 10000 + (+m[4]) * 100 + parseFloat(m[5])];
  const k = t.match(/^\D*(\d+)\s*-\s*(\d+)/); return k ? [+k[1], +k[2], null] : null;
}
// group text-layer words into lines (digital PDFs)
function textLines(words, x0, x1, y0, y1, tol = 6) {
  const cy = w => (w[1] + w[3]) / 2, cx = w => (w[0] + w[2]) / 2;
  const ws = words.filter(w => cx(w) >= x0 && cx(w) <= x1 && cy(w) >= y0 && cy(w) <= y1).sort((a, b) => cy(a) - cy(b));
  const out = [];
  for (const w of ws) { const L = out.find(l => Math.abs(l.cy - cy(w)) <= tol); if (L) L.ws.push(w); else out.push({ cy: cy(w), ws: [w] }); }
  return out.map(l => ({ y: Math.round(l.cy) - 10, x: Math.min(...l.ws.map(w => w[0])),
                         text: l.ws.sort((a, b) => a[0] - b[0]).map(w => w[4]).join(' ') }));
}
// text-layer words from a starting word onward (a total can wrap onto 1-2 more lines)
function textFrom(words, x0, yc, width = 420, below = 75) {
  const ws = words.filter(w => w[0] >= x0 - 5 && w[0] <= x0 + width && (w[1] + w[3]) / 2 >= yc - 6 && (w[1] + w[3]) / 2 <= yc + below);
  return textLines(ws, -1e9, 1e9, -1e9, 1e9).map(l => l.text).join(' ');
}
const KITTE = /ਕ(?:ਿੱ|ਿ|ੱ)?ਤ\S?\s*(\d+)/;              // ਕਿਤੇ / ਕਿੱਤੇ (text layers may show ਸਕੱਤੇ)
const MIZAN_KITTE = /ਜਾਨ\s+\S*ਕ\S*\s*(\d+)/;
const PART = /(?:ਮਿਨ|\Sਮਨ)(?=\s|$)/;                 // ਮਿਨ (part); text layers show ਸਮਨ, ਵਮਨ ...
function khasraFrom(t, lastMur) {
  if (/ਕੁਲ|ਸਾਲਮ|ਮਿਜਾਨ/.test(t) || KITTE.test(t)) return null;
  const part = PART.test(t) ? ' (min)' : '';
  t = t.replace(new RegExp(PART.source, 'g'), ' ');
  let m = t.match(/(?:(\d+)\s*)?\/\/\s*(\d+(?:\s*\/\s*\d+)*)/);
  if (m) { const mur = m[1] || lastMur; return { mur, text: (mur ? mur : '') + '//' + m[2].replace(/\s+/g, '') + part }; }
  m = t.match(/^\s*(\d+(?:\/\d+)*)\s*$/);
  return m ? { mur: lastMur, text: m[1] + part } : null;
}

// ---------------- page header: year, pind, tehsil, zilla ----------------
// 'ਜਮਾਂਬੰਦੀ - 2021 - 2022   ਪਿੰਡ - ਮੰਡੇਰ   ਹੱਦਬਸਤ ਨੰਬਰ - 178   ਤਹਿਸੀਲ - ਬਰੇਟਾ   ਜ਼ਿਲਾ - ਮਾਨਸਾ'
const cleanPlace = s => (s || '').replace(/[.\-–:|_“”"'()\[\]]+/g, ' ').replace(/\s+/g, ' ').trim();
export function parseHeader(t) {
  const y = t.match(/((?:19|20)\d\d)\s*\D{0,4}\s*((?:19|20)\d\d)/);
  const v = t.match(/ਪਿੰ?ਡ\s*[-–:.]*\s*(.+?)\s+(?:\S*ਬਸਤ|ਹੱ?ਦ|ਹਦ|ਨੰਬਰ)/);   // OCR may read ਹੱਦਬਸਤ as ਹੱਟਬਸਤ
  const te = t.match(/ਤ\S{0,2}ਸੀ\S?ਲ\s*[-–:.]*\s*(.+?)\s+(?:ਜ਼?ਿ\S?ਲ|ਜ਼ਿ|ਜਿ|ਜ਼ਲ|\Sٞ)/);
  const d = t.match(/(?:ਜ਼?ਿ\S?ਲ\S*|ਜਿਲ\S*)\s*[-–:.]*\s*(.+)$/);
  return { year: y ? `${y[1]}-${y[2]}` : '', pind: cleanPlace(v && v[1]), tehsil: cleanPlace(te && te[1]),
           zilla: cleanPlace(d && d[1]).replace(/\s*(Not|For|Legal|Purpose).*$/i, '') };
}
async function readHeader(img, grid, words, bw) {
  const W = img.w, y1 = grid.tableTop - 2, y0 = Math.max(0, grid.tableTop - 80);
  if (y1 - y0 < 12) return null;
  const x0 = Math.max(0, grid.x[0] - 60), x1 = Math.min(W, grid.x[8] + 60);
  const arr = crop(bw, W, x0, y0, x1, y1), bands = lineBands(arr);
  if (!bands.length) return null;
  const texts = await ocrMany(bands.map(([a, b]) => pad(rows(arr, a - 3, b + 3), 2)));
  const t = texts.find(x => /ਜਮਾ|ਪਿੰਡ|ਤਹਿਸੀਲ|ਜ਼ਿਲਾ|ਜਿਲਾ/.test(x)) || texts.join(' ');
  const h = parseHeader(t);
  if (words) {                   // year digits from the text layer when available (exact)
    const yrs = words.filter(w => /^(19|20)\d\d$/.test(w[4]) && (w[1] + w[3]) / 2 > y0 && (w[1] + w[3]) / 2 < y1).sort((a, b) => a[0] - b[0]);
    if (yrs.length >= 2) h.year = `${yrs[0][4]}-${yrs[1][4]}`;
  }
  return h;
}

// ---------------- one page -> events ----------------
const GURMUKHI = /[\u0A00-\u0A7F]/g;
export function isText(t) {
  const core = t.replace(/[\s.,:;'"“”|!_\-–—]/g, '');
  const g = (core.match(GURMUKHI) || []).length, d = (core.match(/\p{Nd}/gu) || []).length;
  return core.length >= 3 && g + d >= 0.7 * core.length;
}
// ਆੜ ਰਹਿਨ; text layers show it as ਆੜ ਰਸਹਨ, ਆੜ ਰਮਹਨ, ਆੜ ਰਸਿਨ, ਆٟ ਰਸਹਨ
const MORTGAGE_NOTE = /ਆ\S?\s*ਰ(?:[ਸਿੀਮ]?ਹ[ਿੀ]?|ਸ[ਿੀ])ਨ/;
const SHAMLAT = /(?:ਸ਼|ਸ)ਾਮਿ?ਲਾ[ਤਟਿ]/;                 // ਸ਼ਾਮਲਾਤ: village common land, owned by the patti, not by persons
const HEADING = /ਖੇਵਟ|ਮਾਲ\/ਪੱਤੀ|ਖਤੌਨੀ|ਲਗਾਨ|ਮਾਲਕ ਦਾ|ਵੇਰਵਾ|ਨਾਂ ਅਤੇ|ਸਿੰਚਾਈ|ਸਾਧਨ|ਰਕਬਾ ਅਤੇ|ਦੀ ਕਿਸਮ|ਭੌਂ ਦੀ|^ਕਿਸਮ|^ਮਾਲ$|ਨੰਬਰ\//;

async function scanPage(pg, { img, grid, words, hiImg, bigha }) {
  const events = [], x = grid.x, top = grid.top, bot = grid.bottom, W = img.w;
  const cache = new Map();
  const ctx = { W, words, bin: (drop, thr) => { const k = drop + ':' + thr; if (!cache.has(k)) cache.set(k, binarize(img, drop, thr).bw); return cache.get(k); } };
  const { bw, red } = binarize(img, true); cache.set('true:150', bw);
  const header = await readHeader(img, grid, words, bw);
  if (header) events.push([pg, -1e6, 'header', header]);
  if (bot - top < 20) return events;          // e.g. a spill-over page with only the headings and one short line
  const hi = hiImg ? { bw: binarize(hiImg, true).bw, W: hiImg.w, f: 2 } : null;
  const cols = { 1: [x[0] + 2, x[1] - 2], 2: [x[1] + 2, x[2] - 2], 3: [x[2] + 2, x[3] - 1], 67: [x[5] + 2, x[7] - 2],
                 5: [x[4] + 2, x[5] - 2], 7: [x[6] + 2, x[7] - 2] };
  cols[6] = [x[5] + 2, x[6] - 2];
  const jobs = [], imgs = [];
  for (const c of (words ? [1, 2, 3, 67, 5] : [1, 2, 3, 67, 5, 7, 6])) {
    const src = c === 6 ? ctx.bin(false, 150) : bw;
    for (const l of columnLines(src, W, cols[c][0], cols[c][1], top, bot, c === 3 ? hi : null)) { jobs.push([c, l.y]); imgs.push(l.img); }
  }
  let texts = await ocrMany(imgs);
  if (!bigha && isBigha(texts.join(' '))) bigha = true;              // scanned copies: units from the OCR text
  if (bigha) { texts = texts.map(toKanal); events.push([pg, -1e6 + 1, 'unit', 'bigha']); }
  unitM2 = bigha ? M2_PER_BISWA : M2_PER_MARLA;
  const lines = { 1: [], 2: [], 3: [], 67: [], 5: [], 7: [], 6: [] }, headEnd = top + 140, first = new Map();
  jobs.forEach(([c, y], i) => { const t = texts[i]; first.set(c + ':' + y, t); if (t && !(y < headEnd && HEADING.test(t) && !SHAMLAT.test(t))) lines[c].push([y, t]); });
  let tot67 = lines[67].filter(([, t]) => RAKBA.test(t));
  if (!words) {
    lines[3] = await vote(ctx, cols[3], lines[3], pickFrac, putFrac);
    lines[3] = await vote(ctx, cols[3], lines[3], pickTotal, putTotal);
    tot67 = await vote(ctx, cols[67], tot67, pickTotal, putTotal);
  } else {
    lines[3] = snapNumbers(words, lines[3], ...cols[3], pickFrac, putFrac);
    lines[3] = snapNumbers(words, lines[3], x[2], x[8], pickTotal, putTotal);
    tot67 = snapNumbers(words, tot67, x[2], x[8], pickTotal, putTotal);
  }
  const ys = c => jobs.filter(([cc]) => cc === c).map(([, y]) => y);
  const col1Text = words ? textLines(words, ...cols[1], top, bot).map(l => [l.y, l.text]) : lines[1];
  const wrapped = y => {           // '106 947' then '5/' on the next line = khewat 1065; '97- 85' then '98/' = khewat 97-98
    const a = col1Text.find(([yy]) => Math.abs(yy - y) <= 8), b = col1Text.find(([yy]) => yy > y + 8 && yy <= y + 45);
    if (!a || !b || a[1].includes('/')) return null;
    const m1 = a[1].match(/^\D{0,2}(\d+)(\s*-)?/), m2 = b[1].match(/^\D{0,2}(\d+)\s*\//);
    return m1 && m2 ? m1[1] + (m1[2] ? '-' : '') + m2[1] : null;
  };
  // khewat header candidates: first line under a table rule, plus any 'NNN/' line in column 1
  // (some pages have no rule under the column headings, so a khewat starting at the top follows the heading text)
  const kCand = firstLinesBelowRules(bw, W, ...cols[1], top, bot, ys(1));
  // strict: just 'NNN/' (+ old number or ਮਿਨ), not red (red = later notes), and a wrapped '106' + '5/' uses the upper line
  // ('287/ 334,' - a list of numbers may end in a comma)
  const HDR = words ? /^\d+\s*\/(?:\s*\d+)?[,.]?(?:\s*\S*ਮ\S*ਨ)?\s*$/ : /^\D{0,2}\d+\s*\/\s*\d*\s*\S{0,4}$/;
  const redIn = y => { let n = 0; for (let yy = Math.max(top, y); yy < Math.min(bot, y + 22); yy++) for (let xx = cols[1][0]; xx < cols[1][1]; xx++) n += red[yy * W + xx]; return n > 15; };
  const isNum = t => /^\D{0,2}\d+(\s*-)?(\s+\d+)?\s*$/.test(t);
  const subNo = new Map();
  for (const [y, t] of col1Text) {
    if (!HDR.test(t) || redIn(y)) continue;
    const above = col1Text.filter(([yy]) => yy < y && yy >= y - 40).pop();
    // '542/' then '505/' then '1': the second line is the old number of the same khewat, not a new one
    if (above && HDR.test(above[1])) {
      // '194/ 180' then '1/': the header already carries its old number, so a short 'N/' below is a sub-number (194/1)
      if (/^\D{0,2}\d+\s*\/\s*\d+/.test(above[1]) && /^\d{1,2}\s*\/\s*$/.test(t)) subNo.set(above[0], t.replace(/\D/g, ''));
      continue;
    }
    const cy = above && isNum(above[1]) ? above[0] : y;
    if (!kCand.some(c => Math.abs(c - cy) <= 10)) kCand.push(cy);
  }
  kCand.sort((a, b) => a - b);
  // the old khewat number printed with the new one ('671/ 630' = khewat 671, old 630), shown as the record prints it;
  // the khewat itself is still identified by its new number everywhere else
  const MIN = /^\S*ਮ\S*\s?ਨ$/;
  const oldOf = y => {
    const L = col1Text.filter(([yy]) => yy >= y - 8 && yy <= y + 45);
    if (!L.length) return null;
    const t0 = L[0][1].trim(), t1 = L[1] ? L[1][1].trim() : '', t2 = L[2] ? L[2][1].trim() : '';
    let m, old = null, used = 0;
    if ((m = t0.match(/^\D{0,2}\d+(?:\s*-\s*\d*)?\s*\/\s*(\d+)\s*[,.]?\s*(\S*ਮ\S*\s?ਨ)?/))) { old = m[1]; if (m[2]) old += ' ਮਿਨ'; }
    else if (/^\D{0,2}\d+\s*\/\s*$/.test(t0) && (m = t1.match(/^\D{0,2}(\d+)\s*(\/)?\s*$/))) {   // '542/' then '505/' then '1'
      old = m[1]; used = 1; if (m[2] && /^\d{1,3}$/.test(t2)) { old += '/' + t2; used = 2; }
    }
    else if (!t0.includes('/') && (m = t0.match(/^\D{0,2}\d+(?:\s*-)?\s+(\d+)\s*$/))) { old = m[1]; used = 1; }   // '106 947' then '5/' (header on 2 lines)
    else if (!t0.includes('/') && (m = t1.match(/^\D{0,2}\d+\s*\/\s*(\d+)\s*(\S*ਮ\S*\s?ਨ)?/))) { old = m[1]; used = 1; if (m[2]) old += ' ਮਿਨ'; }  // '112' then '4/ 1061'
    if (old && !/ਮਿਨ/.test(old) && L[used + 1] && MIN.test(L[used + 1][1].trim())) old += ' ਮਿਨ';   // 'ਮਿਨ' on the line below
    return old && old.replace(/\D/g, '').length <= 7 ? old : null;
  };
  const khewatYs = [];
  for (const y of kCand) {
    const no = words ? (wrapped(y) || await numberVote(ctx, ...cols[1], y, KHEWAT_PAT, first.get('1:' + y)))
                     : (await numberVote(ctx, ...cols[1], y, KHEWAT_PAT, first.get('1:' + y)) || wrapped(y));
    const sub = [...subNo].find(([sy]) => Math.abs(sy - y) <= 10);
    if (no && no !== '0') {
      events.push([pg, y - 8, 'khewat', sub ? `${no}/${sub[1]}` : no]); khewatYs.push(y);
      const old = oldOf(y); if (old) events.push([pg, y - 7.9, 'khewat_old', old]);
    }
  }
  const mizanY = [];
  const withNext = (arr, y) => arr.filter(([yy]) => yy >= y && yy <= y + 60).map(([, t]) => t).join(' ');
  if (words) {                    // digital: totals straight from the text layer (exact digits)
    for (const L of textLines(words, x[0], x[7], top, bot)) {
      const i = L.text.search(/\S?ਕਬਾ\s*(?:q\s*)?\d+(?:\s+\d+)*\s*ਕਨਾਲ/);
      if (i < 0) continue;
      const w0 = words.find(w => /ਕਬਾ/.test(w[4]) && Math.abs((w[1] + w[3]) / 2 - (L.y + 10)) <= 6 && w[0] >= L.x - 1);
      const tot = validKM(parseTotalText(w0 ? textFrom(words, w0[0], L.y + 10) : L.text.slice(i)));
      if (tot) {
        // the khewat's own khasra count on the totals row: 'ਮਿਜਾਨ ਕਿਤੇ 55' (text layers show ਸਮਜਾਨ ਸਕਤੇ)
        const mk = L.text.match(MIZAN_KITTE);
        if (mk) events.push([pg, L.y - 1, 'mkitte', +mk[1]]);
        events.push([pg, L.y, 'total', [tot[0], tot[1], tot[2], true, tot[3], tot[4]]]); mizanY.push(L.y);
      }
    }
    // some Fards print a one-line totals row as 'ਮਿਜਾਨ ਕਿਤੇ 1  ਮਜਰੂਆ 120 ਕਨਾਲ 16 ਮਰਲਾ (..)  120 ਕਨਾਲ 16 ਮਰਲਾ (..) ਚਾਹੀ ਰਕਬਾ 120 ਕਨਾਲ
    // 16 ਮਰਲਾ (..)', with the 'ਰਕਬਾ' total at the right end: its figures run past column 7, so the row as cut above ends
    // in a bare 'ਰਕਬਾ'. Read on from each 'ਰਕਬਾ' of that row, whole width
    for (const L of textLines(words, x[0], x[7], top, bot)) {
      const mk = L.text.match(MIZAN_KITTE);
      if (!mk || mizanY.some(my => Math.abs(my - L.y) < 20)) continue;
      let tot = null;
      for (const w0 of words.filter(w => /ਕਬਾ/.test(w[4]) && Math.abs((w[1] + w[3]) / 2 - (L.y + 10)) <= 6 && w[0] >= L.x - 1).sort((a, b) => a[0] - b[0]))
        if ((tot = validKM(parseTotalText(textFrom(words, w0[0], L.y + 10))))) break;
      if (tot) {
        events.push([pg, L.y - 1, 'mkitte', +mk[1]]);
        events.push([pg, L.y, 'total', [tot[0], tot[1], tot[2], true, tot[3], tot[4]]]); mizanY.push(L.y);
      }
    }
  }
  const both = [...lines[3].map(l => [...l, 3]), ...tot67.map(l => [...l, 67])].sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
  for (const [y, t, c] of both) {
    if (RAKBA.test(t) && t.match(TOTAL)) {
      if (!words) {
        const tt = validKM(parseTotal(t));  // the total's own line only (the next line may be another row)
        events.push([pg, y, 'total', tt && [tt[0], tt[1], tt[2], false, tt[3]]]); mizanY.push(y);
      }
      else if (!mizanY.some(my => Math.abs(my - y) < 20)) {
        // OCR found the totals row; take its digits from the text layer at that spot
        const tl = validKM(parseKM(textFrom(words, cols[c][0], y + 10)));
        const tt = tl || validKM(parseTotal(t));
        events.push([pg, y, 'total', tt && [tt[0], tt[1], tt[2], !!tl, tt[3]]]); mizanY.push(y);
      }
    }
    else if (RAKBA.test(t)) { if (!mizanY.some(my => Math.abs(my - y) < 20)) { events.push([pg, y, 'total', null]); mizanY.push(y); } }
    else if (c === 3 && isText(t)) events.push([pg, y, 'owner_line', t]);
  }
  const col2Text = words ? textLines(words, ...cols[2], top, bot).map(l => [l.y, l.text]) : lines[2];
  const tCand = firstLinesBelowRules(bw, W, ...cols[2], top, bot, ys(2));
  for (const ky of khewatYs) {
    const hit = col2Text.find(([y, t]) => Math.abs(y - ky) <= 12 && KHATAUNI_PAT.test(t));
    if (hit && !tCand.some(c => Math.abs(c - hit[0]) <= 10)) tCand.push(hit[0]);
  }
  tCand.sort((a, b) => a - b);
  for (const y of tCand) {
    if (mizanY.every(my => Math.abs(y - my) > 15)) {
      const no = await numberVote(ctx, ...cols[2], y, KHATAUNI_PAT, first.get('2:' + y));
      if (no) events.push([pg, y, 'khatauni', no.replace(/\s+/g, '')]);
    }
  }
  // khatauni 'ਕੁਲ' rows: digital -> from the text layer; scanned -> from OCR of column 5
  cols[6] = cols[6] || [x[5] + 2, x[6] - 2];
  const col6 = words ? textLines(words, ...cols[6], top, bot).map(l => [l.y, l.text]) : lines[6];
  const kitteAt = y => col6.some(([yy, t]) => Math.abs(yy - y) <= 12 && KITTE.test(t));
  const kulRows = [];
  const addKul = y => { if (!kulRows.some(k => Math.abs(k[0] - y) < 12)) kulRows.push([y, 'ਕੁਲ']); };
  col6.filter(([, t]) => KITTE.test(t) && !/ਜਾਨ|ਸਾਲਮ/.test(t)).forEach(([y]) => addKul(y));
  for (const [y5, t5] of kulRows) {
    if (!t5.startsWith('ਕੁਲ') || mizanY.some(my => Math.abs(y5 - my) < 15) || !kitteAt(y5)) continue;
    const src = words ? textLines(words, ...cols[7], y5 - 2, y5 + 64).map(l => l.text).join(' ')
                      : withNext(lines[7].filter(([y]) => y >= y5 - 10), y5 - 10);
    const kt = parseKtotal(src);
    if (kt) events.push([pg, y5, 'ktotal', [kt[0], kt[1], !!words || (kt[2] !== null && agrees(kt[0] * 20 + kt[1], kt[2]))]]);
  }
  const col7 = words ? textLines(words, ...cols[7], top, bot).map(l => [l.y, l.text]) : lines[7];
  // a khasra row starts its own area in column 7 ('7-15'); a wrapped piece sits next to '(0-39-20.39)'
  const newRow = y => col7.some(([yy, t]) => Math.abs(yy - y) <= 16 && /^[^\d(]{0,2}\d+\s*-\s*\d+/.test(t));
  const areaAt = y => { const L = col7.find(([yy, t]) => Math.abs(yy - y) <= 16 && /^[^\d(]{0,2}\d+\s*-\s*\d+/.test(t));
                        const m = L && L[1].match(/(\d+)\s*-\s*(\d+)/); return m ? +m[1] * 20 + +m[2] : null; };
  const CONT = /^\s*(\d+(?:\/\d+)*\/?)?\s*(ਮਿਨ|\Sਮਨ)?\s*$/;           // e.g. '3', '1', '2', 'ਮਿਨ' under a khasra
  let lastKh = null;
  for (const [y, t] of col6) {
    if (mizanY.some(my => Math.abs(my - y) < 15)) { lastKh = null; continue; }
    const kc = t.match(KITTE);
    if (kc && !/ਮਿਜਾਨ/.test(t)) { events.push([pg, y, 'kitte', +kc[1]]); lastKh = null; continue; }
    if (/ਕਨਾ|ਮਰਲਾ|ਹੈਕਟੇਅਰ|ਏਅਰ/.test(t)) { lastKh = null; continue; }   // area-summary boxes are not khasras
    if (newRow(y)) { lastKh = [pg, y, 'khasra_line', [t, !!words, areaAt(y)]]; events.push(lastKh); continue; }
    const c = t.match(CONT);                                            // wrapped end of the khasra above
    if (lastKh && c && (c[1] || c[2]) && y - lastKh[1] <= 40) { lastKh[3][0] += (c[1] || '') + (c[2] ? ' ' + c[2] : ''); lastKh[1] = y; }
  }
  const rr = [];
  for (let y = top; y < bot; y++) {
    let a = 0, b = 0;
    for (let xx = cols[3][0]; xx < cols[3][1]; xx++) a += red[y * W + xx];
    for (let xx = x[7] + 2; xx < x[8] - 2; xx++) b += red[y * W + xx];
    if (a > 3 || b > 3) rr.push(y - top);
  }
  for (const g of groups(rr, 6)) events.push([pg, top + g[0], 'mutation', null]);
  // remarks (column 8) naming a mortgage, in any ink colour: 'ਆੜ ਰਹਿਨ' (text layers show ਆੜ ਰਸਹਨ, ਆٟ ਰਸਿਨ ...)
  if (words) for (const L of textLines(words, x[7] + 2, x[8] - 2, top, bot))
    if (MORTGAGE_NOTE.test(L.text)) events.push([pg, L.y, 'mortgage_note', null]);
  // the land-records site sometimes fails to print a khewat's table: 'Error: Subreport could not be shown.'
  // in the owner table (columns 2-7) or only in the remarks (column 8)
  if (words) for (const w of words) if (/^Subreport$/i.test(w[4])) events.push([pg, w[1] + 5, 'print_error', w[0] < x[7] ? 'table' : 'remarks']);
  return events;
}

function editDistance(a, b) {
  const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i, ...new Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}

// ---------------- exact fractions ----------------
const gcd = (a, b) => { a = a < 0n ? -a : a; while (b) [a, b] = [b, a % b]; return a; };
const frac = (n, d) => { n = BigInt(n); d = BigInt(d); const g = gcd(n, d) || 1n; return [n / g, d / g]; };
const fadd = (p, q) => frac(p[0] * q[1] + q[0] * p[1], p[1] * q[1]);
const fstr = f => f[1] === 1n ? `${f[0]}` : `${f[0]}/${f[1]}`;
function roundHalfEven(n, d) {            // n/d rounded to an integer, ties to even (like Python round)
  let q = n / d, r = n - q * d;
  if (2n * r > d || (2n * r === d && q % 2n === 1n)) q += 1n;
  return q;
}
export function km(marla) {               // marla as [n, d] fraction or number -> "K - M" text
  const m100 = Array.isArray(marla) ? roundHalfEven(marla[0] * 100n, marla[1]) : BigInt(Math.round(marla * 100));
  let k = m100 / 2000n, rest = m100 - k * 2000n;
  if (rest >= 2000n) { k += 1n; rest = 0n; }
  return `${k} K - ${Number(rest) / 100} M`;
}

// ---------------- events -> khewats ----------------
// a share fraction ends an owner entry; 'ਹਿੱਸਾ' after it is optional (OCR can put stray marks like '|' in between)
const SHARE = /(\d+)\s*\/\s*(\d+)(?:[\s|\[\]!_.,:;'"“”]*\S*ਸ[ਾੇ]\S*)?/g;
const BILLA = /ਬਿੱ?ਲਾ\s?ਰਾਹਿਨ/;                       // ਬਿੱਲਾਰਾਹਿਨ = unmortgaged: always an owner
const cleanName = s => s.replace(/[_“”"|!\[\]]/g, ' ').replace(new RegExp(BILLA.source, 'g'), ' ')
  .replace(/\s+/g, ' ').replace(/^[ ,.\-]+|[ ,.\-]+$/g, '');

// text that is never part of an owner entry: dates and area/total wording (cut the line there)
const NOT_OWNER_TEXT = /ਤਾਰੀਖ|ਮਿਤੀ|ਕਨਾਲ|ਮਰਲਾ|ਹੈਕਟੇਅਰ|ਸੈਂਟੇਅਰ|ਮਜਰੂਆ|ਮਜ਼ਰੂਆ|ਗੈਰਮਜ|ਸਾਲਮ/;
// a mortgaged part of the owner above: 'ਵਾ ਨੀਂਜ ਰਾਹਿਨ 1/12 ਹਿੱਸਾ'
const isMortgagePart = o => /^ਵਾ?\s/.test(o.name) && /ਰਾਹ[ਿੀ]ਨ/.test(o.name) && o.name.split(' ').length <= 4;
// role labels: ਬਿੱਲਾਰਾਹਿਨ (unmortgaged), ਰਾਹਿਨ/ਰਾਹਿਨਾਨ (mortgagor/s), ਮੁਰਤਹਿਨ/ਮੁਰਤਹਿਨਾਨ (mortgagee/s).
// In these Fards a label follows the share it describes: '<name> 1/4 ਹਿੱਸਾ ਮੁਰਤਹਿਨ <next name> ...'
const ROLE = '(?:ਬਿੱ?ਲਾ\\s?ਰਾਹਿਨ|ਰਾਹ[ਿੀ]ਨ(?:ਾਨ)?|ਮ[ੁੂ]ਰਤਹ[ਿੀ]ਨ(?:ਾਨ)?)';
const ROLE_LEAD = new RegExp(`^[\\s|.,:;_!\\[\\]'"“”-]*(?:ਹਿੱ?ਸ[ਾੇ]\\s+)?(${ROLE})(?=\\s|$)`);
function splitRole(raw) {                        // -> [label at the start (belongs to the entry before), the rest]
  const m = raw.match(ROLE_LEAD);
  return m ? [m[1], raw.slice(m[0].length)] : ['', raw];
}
const stripRole = n => n.replace(new RegExp(`^(?:ਹਿੱ?ਸ[ਾੇ]\\s+)?(?:${ROLE}\\s+)+`), '').replace(new RegExp(`(?:\\s+${ROLE})+$`), '').trim();
const REL_WORDS = 'ਪੁੱਤਰ|ਪੁਤਰ|ਪੱਤਰ|ਪੁੱਤਰੀ|ਪੁਤਰੀ|ਪੱਤਰੀ|ਪਤਨੀ|ਵਿਧਵਾ|ਉਰਫ|ਮਾਤਾ';
const REL_END = new RegExp(`(?:^|\\s)(?:${REL_WORDS})$`), REL_START = new RegExp(`^(?:${REL_WORDS})(?:\\s|$)`);
const one = f => f[0] === f[1];
function applyMortgage(k, text) {
  const merged = []; let lastPart = -1, partSum = [0n, 1n];
  for (const o of k.owners) {
    if (isMortgagePart(o) && merged.length) {
      const p = merged[merged.length - 1];
      p.share = fadd(p.share, o.share); p.shareTxt = `${p.shareTxt} + ${o.shareTxt}`; lastPart = merged.length - 1;
      partSum = fadd(partSum, o.share);
    } else merged.push({ ...o });
  }
  const sumOf = list => list.reduce((s, o) => fadd(s, o.share), [0n, 1n]);
  let own = merged, mort = [];
  if (lastPart >= 0) {
    // the mortgagees hold exactly the mortgaged parts (4 x 16/479 mortgaged = one mortgagee with 64/479):
    // take the first such block after the last mortgaged part that leaves the owners adding up to 1
    find: for (let i = lastPart + 1; i < merged.length; i++) {
      let acc = [0n, 1n];
      for (let j = i; j < merged.length && !merged[j].unmortgaged; j++) {
        acc = fadd(acc, merged[j].share);
        if (acc[0] * partSum[1] > partSum[0] * acc[1]) break;
        const rest = [...merged.slice(0, i), ...merged.slice(j + 1)];
        if (acc[0] === partSum[0] && acc[1] === partSum[1] && one(sumOf(rest))) { own = rest; mort = merged.slice(i, j + 1); break find; }
      }
    }
    if (!mort.length && /ਮ[ੁੂ]ਰਤਹ[ਿੀ]ਨ/.test(text) && lastPart < merged.length - 1) { own = merged.slice(0, lastPart + 1); mort = merged.slice(lastPart + 1); }
  }
  else {
    // labels after the shares: '... 1/20 ਹਿੱਸਾ ਰਾਹਿਨਾਨ' closes a group of mortgagors, '... 1/4 ਹਿੱਸਾ ਮੁਰਤਹਿਨਾਨ' closes the
    // group of their mortgagees. The mortgagees hold exactly what the mortgagors pledged (equal shares) and are not owners;
    // taken only when the owners then add up to exactly 1 (Fard 7 khewat 557, Fard 9 khewats 949 and 1064)
    const isRahin = o => /^ਰਾਹ/.test(o.role || ''), isMurt = o => /^ਮ[ੁੂ]ਰ/.test(o.role || '');
    const mortIdx = new Set(); let total = sumOf(merged);
    for (let m = 0; m < merged.length; m++) {
      if (!isMurt(merged[m])) continue;
      let r = m - 1; while (r >= 0 && !isRahin(merged[r]) && !isMurt(merged[r])) r--;
      if (r < 0 || !isRahin(merged[r])) continue;
      const G = merged.slice(r + 1, m + 1), gs = sumOf(G);
      if (G.some(o => o.unmortgaged)) continue;
      let acc = [0n, 1n], ok = false;
      for (let s = r; s >= 0 && (s === r || !(isRahin(merged[s]) || isMurt(merged[s]))); s--) {
        acc = fadd(acc, merged[s].share);
        if (acc[0] === gs[0] && acc[1] === gs[1]) { ok = true; break; }
      }
      if (ok) { for (let j = r + 1; j <= m; j++) mortIdx.add(j); total = fadd(total, [-gs[0], gs[1]]); }
    }
    if (mortIdx.size && one(total)) { own = merged.filter((_, i) => !mortIdx.has(i)); mort = merged.filter((_, i) => mortIdx.has(i)); }
    else {                                       // owners that already add up to 1, then a ਰਾਹਿਨਾਨ / ਮੁਰਤਹਿਨਾਨ group
      let acc = [0n, 1n];
      for (let i = 0; i < merged.length - 1; i++) {
        acc = fadd(acc, merged[i].share);
        if (one(acc) && (isRahin(merged[i]) || isMurt(merged[i]) || /ਰਾਹ[ਿੀ]ਨ|ਮ[ੁੂ]ਰਤਹ[ਿੀ]ਨ/.test(merged[i + 1].name))) { own = merged.slice(0, i + 1); mort = merged.slice(i + 1); break; }
      }
    }
  }
  // an entry marked ਬਿੱਲਾਰਾਹਿਨ (unmortgaged) is an owner: never list it as a mortgage party
  if (mort.some(o => o.unmortgaged)) { own = merged; mort = []; }
  // a mortgagee named after the list without a share ('ਰਾਹਿਨਾਨ <name> ਮੁਰਤਹਿਨ')
  const tail = k.tailMortgagee ? [{ name: k.tailMortgagee, shareTxt: '(no share written)' }] : [];
  const sum = sumOf(own);
  const pages = [...new Set(k.owners.map(o => o.page))].sort((a, b) => a - b).join(', ');
  if (one(sum) && (mort.length || own.length !== k.owners.length || tail.length)) {
    k.owners = own.map(o => ({ ...o, name: stripRole(o.name) }));
    if (/^(ਮ[ੁੂ]ਰਤਹ[ਿੀ]ਨਾਨ|ਰਾਹ[ਿੀ]ਨਾਨ|\s)*$/.test(k.leftover || '')) k.leftover = '';   // just the label
    k.mortgagees = [...mort, ...tail].map(o => ({ name: stripRole(o.name), shareTxt: o.shareTxt }));
    const n = k.mortgagees.length;
    k.mortgageResolved = true;
    k.mortgageNote = (lastPart >= 0 ? `mortgage entries: each owner's unmortgaged (ਬਿੱਲਾਰਾਹਿਨ) and mortgaged (ਰਾਹਿਨ) parts are added together` +
                                      (n ? `; ${n} mortgage ${n === 1 ? 'party (ਮੁਰਤਹਿਨ) is' : 'parties (ਮੁਰਤਹਿਨਾਨ) are'} listed separately, not as owners` : '')
                                    : `mortgage entries: ${n} mortgage ${n === 1 ? 'party (ਮੁਰਤਹਿਨ) holds' : 'parties (ਮੁਰਤਹਿਨਾਨ) hold'} the share pledged by the mortgagors (ਰਾਹਿਨਾਨ) and ${n === 1 ? 'is' : 'are'} listed separately, not as owners; the owners then add up to exactly 1`) +
                      ` - check page ${pages}`;
  } else {
    // a mortgaged part ('ਵਾ ਨੀਂਜ ਰਾਹਿਨ 2/99') is always the entry before it's own second part: add it to that owner
    // even when the mortgage cannot be worked out, so it is never shown as an owner of its own (shares unchanged)
    if (lastPart >= 0) k.owners = merged.map(o => ({ ...o }));
    if (k.tailMortgagee) { k.leftover = `${k.tailMortgagee} ਮੁਰਤਹਿਨ`; k.tailMortgagee = null; }
    if (!one(k.owners.reduce((s, o) => fadd(s, o.share), [0n, 1n])))       // printed shares already add up to 1: nothing to say
      k.mortgageNote = `mortgage entries (ਰਾਹਿਨ / ਮੁਰਤਹਿਨ) shown as printed: their shares do not add up even when combined - check with a patwari (page ${pages})`;
  }
}
// scanned copies: when exactly one likely misreading (e.g. 1/8 read as 1/6) makes the shares add up to 1, suggest it
const LOOKALIKE = { 0: '689', 1: '74', 2: '7', 3: '85', 4: '19', 5: '63', 6: '850', 7: '12', 8: '6390', 9: '480' };
function lookalikes(st) {
  const [a, b] = st.split('/'), out = new Set();
  for (const [s, isNum] of [[a, true], [b, false]])
    for (let i = 0; i < s.length; i++)
      for (const d of LOOKALIKE[s[i]] || '') {
        const ns = s.slice(0, i) + d + s.slice(i + 1);
        if (ns[0] === '0') continue;
        const [x, y] = isNum ? [ns, b] : [a, ns];
        if (BigInt(x) > 0n && BigInt(x) <= BigInt(y)) out.add(`${x}/${y}`);
      }
  return [...out];
}
function suggestShares(k) {
  const sh = k.owners.map(o => o.shareTxt);
  if (sh.length < 2 || !sh.every(s => /^\d+\/\d+$/.test(s))) return null;
  const F = s => s.split('/').map(BigInt), minus = (S, f) => fadd(S, [-f[0], f[1]]), sols = [];
  for (let i = 0; i < sh.length; i++)
    for (const a of lookalikes(sh[i])) if (one(fadd(minus(k.shareSum, F(sh[i])), F(a)))) sols.push([[i, a]]);
  if (!sols.length)                              // the same misreading on two owners whose shares read alike
    for (let i = 0; i < sh.length; i++) for (let j = i + 1; j < sh.length; j++) if (sh[i] === sh[j])
      for (const a of lookalikes(sh[i])) {
        const S = fadd(fadd(minus(minus(k.shareSum, F(sh[i])), F(sh[j])), F(a)), F(a));
        if (one(S)) sols.push([[i, a], [j, a]]);
      }
  return sols.length === 1 ? sols[0] : null;
}

function addKhasra(cur, pg, val) {
  if (!val[1]) cur.khasraOCR = true;
  const kh = khasraFrom(val[0], cur.lastMur);
  if (!kh) return;
  cur.khasras.push(kh.text); cur.lastMur = kh.mur;
  if (val[1] && val[2] && kh.text.includes('//') && val[2] > 600)
    (cur.bigKhasra = cur.bigKhasra || []).push(`${kh.text} (${Math.floor(val[2] / 20)} K ${val[2] % 20} M, page ${pg})`);
}

// ---- name spelling consensus (ancestor names only, same family context, clear majority; every change is noted) ----
const REL = /^(ਪੁੱਤਰ|ਪੁਤਰ|ਪੁੱਤਰੀ|ਪੁਤਰੀ|ਪਤਨੀ|ਵਿਧਵਾ|ਉਰਫ)$/;
const REAL_VARIANT = [['ਬ', 'ਵ'], ['ਸ', 'ਸ਼'], ['ਜ', 'ਜ਼'], ['ਗ', 'ਗ਼'], ['ਖ', 'ਖ਼'], ['ਫ', 'ਫ਼'], ['ਲ', 'ਲ਼'], ['ੰ', 'ਂ'], ['ੱ', '']];
function realVariant(a, b) {                     // spellings that differ only by a real variant (Jasbir/Jasvir) are never merged
  for (const [x, y] of REAL_VARIANT) {
    if (a.split(x).join(y) === b || b.split(x).join(y) === a) return true;
  }
  return false;
}
// exactly one consonant replaced by another consonant, same length (OCR-type misreading such as ਅਚਜਨ / ਅਰਜਨ);
// vowel signs, nasal marks and added or missing letters are how real spellings differ, so they are never changed
const CONSONANT = /[\u0A15-\u0A39\u0A59-\u0A5E]/;
function consonantSwap(a, b) {
  if (a.length !== b.length) return false;
  const diff = [...a].map((c, i) => [c, b[i]]).filter(([x, y]) => x !== y);
  return diff.length === 1 && CONSONANT.test(diff[0][0]) && CONSONANT.test(diff[0][1]);
}
function nameConsensus(khewats) {
  const entries = [];                            // every ancestor token with its family context
  for (const k of khewats) for (const o of k.owners) {
    const t = o.name.split(' ');
    let inAncestor = false;
    for (let j = 0; j < t.length; j++) {
      if (REL.test(t[j])) { inAncestor = true; continue; }
      if (!inAncestor || !/[\u0A05-\u0A39]/.test(t[j]) || /^(ਸਿੰਘ|ਕੌਰ)$/.test(t[j])) continue;
      entries.push({ o, j, tok: t[j], key: t.slice(Math.max(0, j - 3), j).join(' ') + '|' + t.slice(j + 1, j + 4).join(' ') });
    }
  }
  const byKey = new Map();
  for (const e of entries) (byKey.get(e.key) || byKey.set(e.key, []).get(e.key)).push(e);
  const changes = [];
  for (const group of byKey.values()) {
    const cnt = new Map(); for (const e of group) cnt.set(e.tok, (cnt.get(e.tok) || 0) + 1);
    if (cnt.size < 2) continue;
    const [best, nBest] = [...cnt.entries()].sort((a, b) => b[1] - a[1])[0];
    for (const [tok, n] of cnt) {
      // only a same-length one-letter swap (typical OCR misreading, e.g. ਅਚਜਨ / ਅਰਜਨ); a letter added or missing is
      // how real spellings differ in records (ਬਖਸੀਸ / ਬਖਸ਼ੀ printed in the same Fard), so those are never changed
      if (tok === best || nBest < 2 || nBest < 2 * n || !consonantSwap(tok, best) || realVariant(tok, best)) continue;
      for (const e of group.filter(e => e.tok === tok)) {
        const t = e.o.name.split(' '); t[e.j] = best; e.o.name = t.join(' ');
        e.o.nameNote = (e.o.nameNote ? e.o.nameNote + '; ' : '') + `spelling ${tok} corrected to ${best} (same family written ${nBest} times in this Fard)`;
        changes.push([tok, best]);
      }
    }
  }
  return changes;
}

function build(events, scannedPages = new Set()) {
  const khewats = []; let cur = null; const pageHeader = new Map(), bighaPages = new Set();
  for (const [pg, , kind, val] of events) {
    if (kind === 'header') { pageHeader.set(pg, val); continue; }
    if (kind === 'unit') { bighaPages.add(pg); continue; }
    if (kind === 'khewat') {
      const prev = cur;
      cur = { no: val, pages: new Set([pg]), khatauni: [], lines: [], total: null, totalPage: null, totalSeen: false,
              mutationPages: new Set(), mortgagePages: new Set(), ktotals: [], totalFromSum: false, khasras: [], kitte: 0, lastMur: null, totalNote: '' };
      // downloaded Fards only (exact text): carry name lines that look like a name; never on scans, where OCR noise could be carried
      if (prev && prev.carry && pg - prev.carry.pg <= 1 && ![...prev.carry.pages].some(p => scannedPages.has(p))) {
        const nameLike = t => /ਸਿੰਘ|ਕੌਰ|ਪੁੱਤਰ|ਪੁਤਰ|ਪਤਨੀ|ਵਿਧਵਾ/.test(t) && (!/\d/.test(t) || /\d+\s*\/\s*\d+/.test(t));
        // a line holding only the share ('1/6 ਹਿੱਸਾ') belongs to the name line kept just before it
        const shareOnly = t => /^\D{0,3}\d+\s*\/\s*\d+[\s|\[\]!_.,:;'"“”]*\S*ਸ[ਾੇ]\S*\s*$/.test(t);
        let kept = false;
        cur.lines.push(...prev.carry.lines.filter(([, t]) => (kept = nameLike(t) || (kept && shareOnly(t)))));
        cur.khatauni.push(...prev.carry.khat);
        // khasra counts (ਕਿਤੇ) are never carried: red notes after a total row also say 'ਕਿਤੇ N'.
        // khasras are carried only together with their khatauni row (so text from red notes is never taken)
        if (prev.carry.khat.length) for (const [kpg, kv] of prev.carry.khas) addKhasra(cur, kpg, kv);
      }
      khewats.push(cur); continue;
    }
    if (!cur) continue;
    if (kind === 'khewat_old') { if (!cur.oldNo) cur.oldNo = val; continue; }
    const carry = () => (cur.carry = cur.carry || { lines: [], khat: [], khas: [], kitte: 0, pg, pages: new Set() }, cur.carry.pg = pg, cur.carry.pages.add(pg), cur.carry);
    if (cur.totalSeen && (kind === 'khatauni' || kind === 'owner_line' || kind === 'khasra_line' || kind === 'kitte')) {
      const c = carry();
      if (kind === 'khatauni') c.khat.push(val); else if (kind === 'owner_line') c.lines.push([pg, val]);
      else if (kind === 'khasra_line') c.khas.push([pg, val]); else c.kitte += val;
      continue;
    }
    cur.pages.add(pg);
    if (kind === 'khatauni') cur.khatauni.push(val);
    else if (kind === 'total' && !cur.totalSeen) { cur.totalSeen = true; cur.total = val; cur.totalPage = pg; if (val && val[5]) cur.totalNote = val[5]; }
    else if (kind === 'owner_line' && !cur.totalSeen) cur.lines.push([pg, val]);
    else if (kind === 'mutation') cur.mutationPages.add(pg);
    else if (kind === 'mortgage_note') cur.mortgagePages.add(pg);
    else if (kind === 'print_error') { if (val === 'table') cur.printError = pg; else cur.remarksError = pg; }
    else if (kind === 'mkitte' && !cur.totalSeen) cur.mkitte = val;
    else if (kind === 'ktotal' && !cur.totalSeen) cur.ktotals.push(val);
    else if (kind === 'kitte' && !cur.totalSeen) cur.kitte += val;
    else if (kind === 'khasra_line' && !cur.totalSeen) addKhasra(cur, pg, val);
  }
  // the same place can be OCR'd slightly differently on some pages: map rare variants to the common spelling
  const norm = {};
  for (const f of ['pind', 'tehsil', 'zilla', 'year']) {
    const cnt = new Map();
    for (const h of pageHeader.values()) if (h[f]) cnt.set(h[f], (cnt.get(h[f]) || 0) + 1);
    const vals = [...cnt.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0]);
    norm[f] = v => vals.find(c => editDistance(c, v) <= Math.max(1, Math.floor(Math.min(c.length, v.length) / 4))) || v;
  }
  for (const k of khewats) {
    const place = {};
    for (const f of ['pind', 'tehsil', 'zilla', 'year']) {
      const cnt = new Map();
      for (const p of k.pages) { const h = pageHeader.get(p); if (h && h[f]) { const v = norm[f](h[f]); cnt.set(v, (cnt.get(v) || 0) + 1); } }
      place[f] = [...cnt.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0])[0] || '';
    }
    k.place = place;
  }
  for (const k of khewats) {
    k.unit = [...k.pages].some(p => bighaPages.has(p)) ? 'bigha' : 'kanal';
    unitM2 = k.unit === 'bigha' ? M2_PER_BISWA : M2_PER_MARLA;
    const ks = k.ktotals.reduce((s, [a, b]) => s + a * 20 + b, 0);
    k.ksum = k.ktotals.length ? [Math.floor(ks / 20), ks % 20] : null;
    // exact when every khatauni total is either from the text layer or confirmed by its hectare figure
    k.ksumExact = k.ktotals.length > 0 && k.ktotals.every(t => t[2]) && k.ktotals.length >= k.khatauni.length;
    // khewat total: its Kanal-Marla and hectare figures must agree
    if (k.total && k.total[4] !== null && k.total[4] !== undefined) {
      const [ka, ma, m2, exact, haAre] = k.total, marla = ka * 20 + ma;
      // text layer: exact; OCR: hectare + are only (the centiare digits are often cut off or lose the dot)
      const ok = exact && m2 !== null ? agrees(marla, m2) : Math.abs(marla * unitM2 - haAre) < 101;
      if (!ok) {
        const d = Math.round((m2 ?? haAre) / unitM2), dk = [Math.floor(d / 20), d % 20];
        const sumOk = k.ksumExact && k.ksum[0] === dk[0] && k.ksum[1] === dk[1];
        if (m2 !== null && agrees(d, m2) && sumOk) {
          k.totalNote = `total read as ${ka} K - ${ma} M, corrected to ${dk[0]} K - ${dk[1]} M from its hectare figure and the khatauni totals - check page ${k.totalPage}`;
          k.total = [dk[0], dk[1], m2, exact, haAre];
        } else if (!(k.ksumExact && k.ksum[0] === ka && k.ksum[1] === ma)) {
          k.totalNote = (k.totalNote ? k.totalNote + '; ' : '') + (exact
            ? `total ${ka} K - ${ma} M does not match its hectare figure` + (m2 !== null && agrees(d, m2) ? ` (which gives ${dk[0]} K - ${dk[1]} M)` : '') + ` - check page ${k.totalPage}`
            : `total ${ka} K - ${ma} M could not be confirmed (its hectare figure reads differently on this scanned copy) - check page ${k.totalPage}`);
        }
      }
    }
    if (!k.total && k.ksum && (!k.totalSeen || k.ksumExact)) { k.total = k.ksum; k.totalFromSum = true; }
    let text = ''; const at = [];
    for (const [pg, t0] of k.lines) {
      const t = t0.split(NOT_OWNER_TEXT)[0];
      if (!t.trim()) continue;
      at.push([text.length, pg]); text += t + ' ';
    }
    const pageOf = pos => at.filter(([o]) => o <= pos).reduce((m, [, p]) => Math.max(m, p), 0) || null;
    const owners = []; let lastEnd = 0;
    for (const m of text.matchAll(SHARE)) {
      if (m[1] === '0' || m[2] === '0' || BigInt(m[1]) > BigInt(m[2])) continue;   // not a share (e.g. a date such as 24/9)
      const raw = text.slice(lastEnd, m.index);
      const [lead, body] = splitRole(raw);
      // a role label printed after a share belongs to that entry: '1/4 ਹਿੱਸਾ ਮੁਰਤਹਿਨ <next name>'
      if (lead && owners.length) owners[owners.length - 1].role = lead;
      owners.push({ name: cleanName(body), share: frac(m[1], m[2]), shareTxt: `${m[1]}/${m[2]}`, page: pageOf(lastEnd),
                    billaInner: BILLA.test(body), firstLead: owners.length ? null : lead });
      lastEnd = m.index + m[0].length;
    }
    let [restLead, restBody] = splitRole(text.slice(lastEnd));
    if (owners.length) {
      const lastO = owners[owners.length - 1];
      if (restLead) lastO.role = restLead;
      // the site can print the end of the list first: '<ਹਿੱਸਾ ਬਿੱਲਾਰਾਹਿਨ> <first name> ...' (the last entry's label)
      else if (owners[0].firstLead && owners.length > 1) lastO.role = owners[0].firstLead;
    }
    let rest = cleanName(restBody);
    // a mortgagee printed after the list without a share: 'ਰਾਹਿਨਾਨ <name> ਮੁਰਤਹਿਨ'
    const tailM = rest.match(/^(.*\S)\s+(ਮ[ੁੂ]ਰਤਹ[ਿੀ]ਨ(?:ਾਨ)?)$/);
    if (owners.length && tailM && restLead && /ਰਾਹ/.test(restLead) && isText(tailM[1])) { k.tailMortgagee = tailM[1]; rest = ''; }
    k.leftover = isText(rest) ? rest : '';
    for (const o of owners) o.unmortgaged = o.billaInner || /ਬਿ/.test(o.role || '');
    // the site sometimes prints the first words of the first owner's name at the end of the list:
    // '<ਪੁੱਤਰ ਰਾਮ ਸਿੰਘ ...> 1/4 ... <ਅਮਰ ਸਿੰਘ>' = 'ਅਮਰ ਸਿੰਘ ਪੁੱਤਰ ਰਾਮ ਸਿੰਘ ...' (seen on 4 Fards)
    // (only when the shares already add up to exactly 1, so the text cannot be an owner whose share was lost)
    if (owners.length && k.leftover && !/\d/.test(k.leftover) && k.leftover.split(' ').length <= 5 &&
        one(owners.reduce((s, o) => fadd(s, o.share), [0n, 1n])) &&
        (REL_END.test(k.leftover) || REL_START.test(owners[0].name)) && !REL_END.test(owners[0].name)) {
      owners[0].nameNote = `name completed: the Fard prints its first words ("${k.leftover}") at the end of the owner list`;
      owners[0].name = `${k.leftover} ${owners[0].name}`;
      k.leftover = '';
    }
    if (!owners.length && k.leftover) { owners.push({ name: k.leftover, share: [1n, 1n], shareTxt: '(none written - taken as full)', page: pageOf(0) }); k.leftover = ''; }
    if (owners.length === 1 && SHAMLAT.test(owners[0].name)) k.kind = 'shamlat';
    k.owners = owners;
    if (owners.some(isMortgagePart) || owners.some(o => o.role && !/ਬਿ/.test(o.role)) || k.tailMortgagee || /ਮ[ੁੂ]ਰਤਹ[ਿੀ]ਨ|ਰਾਹ[ਿੀ]ਨਾਨ/.test(text)) applyMortgage(k, text);
    for (const o of k.owners) o.name = stripRole(o.name);
    k.shareSum = k.owners.reduce((s, o) => fadd(s, o.share), [0n, 1n]);
    if (k.khasraOCR) { k.khasras = []; k.khasraNote = 'not available for scanned copies (only for downloaded Fards)'; }
  }
  nameConsensus(khewats);
  return khewats;
}

// Two levels: 'check' = the acres of this khewat may be wrong (yellow); 'note' = worth knowing, but owners,
// shares and acres are not affected (grey). Every 'check' gives the page to look at.
export function khewatChecks(k) {
  const n = [], chk = text => n.push({ level: 'check', text }), note = text => n.push({ level: 'note', text });
  if (k.printNote) chk(k.printNote);
  if (k.repeatNote) chk(k.repeatNote);
  if (k.numberNote) note(k.numberNote);
  if (k.remarksError) note(`the Fard could not print the remarks (column 8) on page ${k.remarksError} ("Error: Subreport could not be shown"): later changes or mortgages written there are not visible - download the Fard again to see them`);
  if (k.totalNote) chk(k.totalNote);
  if (k.total && !k.totalNote && !k.totalFromSum && !k.ksumExact && k.ksum && k.khatauni.length && k.ktotals.length === k.khatauni.length
      && (k.ksum[0] !== k.total[0] || k.ksum[1] !== k.total[1]))
    chk(`total ${k.total[0]} K - ${k.total[1]} M could not be confirmed: its khatauni totals read as ${k.ksum[0]} K - ${k.ksum[1]} M on this scanned copy - check page ${k.totalPage}`);
  const listed = k.mkitte || k.kitte;              // the khewat's own count (ਮਿਜਾਨ ਕਿਤੇ) when printed, else the khataunis' counts
  if (listed && !k.khasraNote && k.khasras.length !== listed)
    note(`khasra numbers: found ${k.khasras.length} but the Fard lists ${listed} - the khasra list may be incomplete (owners' land is not affected); see page ${[...k.pages].sort((a, b) => a - b).join(', ')}`);
  if (k.no === null) chk('khewat no. not readable');
  const lastPg = Math.max(...k.pages);
  if (!k.total && k.atEnd) chk(`the PDF ends before this khewat's total (page ${lastPg} is the last page) - part of the Fard seems to be missing`);
  else if (!k.total) chk(`total area not readable (page ${k.totalPage || '?'})`);
  else if (k.totalFromSum && !k.ksumExact) chk('no khewat total printed; used the khatauni totals read by OCR - check them');
  else if (k.ksumExact && (k.ksum[0] !== k.total[0] || k.ksum[1] !== k.total[1]) && !k.totalFromSum)
    chk(`khatauni totals add up to ${k.ksum[0]} K - ${k.ksum[1]} M but the khewat total reads ${k.total[0]} K - ${k.total[1]} M - check page ${k.totalPage}`);
  const sg = k.scanned && k.owners.length && !one(k.shareSum) ? suggestShares(k) : null;
  const who = o => o.name.split(' ').filter(w => (w.match(/[ਅ-ਹ]/g) || []).length >= 2).slice(0, 3).join(' ');
  if (sg) chk('possible misreading on this scanned copy: ' + sg.map(([i, a]) => `${who(k.owners[i])} read as ${k.owners[i].shareTxt}, but ${a} makes the shares add up to exactly 1`).join('; ') + ` - check page ${k.owners[sg[0][0]].page}`);
  const excess = frac(k.shareSum[0] - k.shareSum[1], k.shareSum[1]);
  const dupe = !sg && excess[0] > 0n && k.owners.find(o => o.share[0] === excess[0] && o.share[1] === excess[1]);
  if (dupe) chk(`shares add up to 1 + ${fstr(excess)}: the entry "${dupe.name.slice(0, 40)}" (${dupe.shareTxt}) looks like a group total `
                 + `(e.g. of a mortgaged share, ਰਾਹਿਨਾਨ/ਮੁਰਤਹਿਨ) and may be counted twice - check page ${dupe.page}`);
  else if (k.owners.length && k.shareSum[0] < k.shareSum[1] && !k.totalSeen)
    chk(`shares add up to only ${fstr(k.shareSum)} and no khewat total follows - the owner list seems cut off (the rest of the Fard is not in this PDF); check page ${lastPg}`);
  else if (!sg && k.owners.length && !(k.shareSum[0] === 1n && k.shareSum[1] === 1n))
    chk(k.scanned ? `shares add up to ${fstr(k.shareSum)} (not 1) - a share was misread, or the record itself does not add up; check the owners on page ${k.owners[0].page}`
                  : `shares add up to ${fstr(k.shareSum)} (not 1) - the share figures are copied exactly from this downloaded Fard, so the record itself does not add up (or an owner is missing); check the owners on page ${k.owners[0].page} with a patwari`);
  if (k.mortgageNote) (k.mortgageResolved ? note : chk)(k.mortgageNote);
  if (k.bigKhasra) note(`khasra area unusually large for one killa: ${k.bigKhasra.slice(0, 3).join(', ')}${k.bigKhasra.length > 3 ? ` and ${k.bigKhasra.length - 3} more` : ''} - possibly a printing error in the record; owners' land uses the khewat total`);
  if (!k.owners.length) chk('no owners found');
  if (k.leftover) (one(k.shareSum) ? note : chk)(`unmatched text in the owner column (no share): ${k.leftover.slice(0, 60)}`);
  return n;
}
export const khewatNotes = k => khewatChecks(k).filter(c => c.level === 'check').map(c => c.text);
export const khewatInfo = k => khewatChecks(k).filter(c => c.level === 'note').map(c => c.text);
export const mutationNote = k => k.mutationPages.size ? 'Yes - page ' + [...k.mutationPages].sort((a, b) => a - b).join(', ') : '';
export const mortgageMention = k => [...k.mortgagePages].sort((a, b) => a - b).join(', ');
export function ownerLand(k, o) {
  if (!k.total) return null;
  const tm = BigInt(k.total[0] * 20 + k.total[1]);
  return [tm * o.share[0], o.share[1]];      // marla as a fraction
}

// ---------------- main entry ----------------
export async function scanPdf(data, onProgress) {
  const pdf = await pdfjsLib.getDocument({ data, standardFontDataUrl: BASE + 'vendor/standard_fonts/' }).promise;
  const events = [], bad = [], dups = [], seen = new Map(), scannedPages = new Set();
  for (let n = 1; n <= pdf.numPages; n++) {
    onProgress && onProgress(n - 1, pdf.numPages);
    const p = await loadPage(pdf, n);
    // the same page twice in one PDF (e.g. two downloads merged) must not be counted twice
    let fp = '';
    if (p.words) fp = 't' + p.words.map(w => w[4]).join(' ');
    else { let h = 0; for (let i = 0; i < p.img.d.length; i += 4099) h = (h * 31 + p.img.d[i]) >>> 0; fp = 'i' + p.img.w + 'x' + p.img.h + ':' + h; }
    if (seen.has(fp)) { dups.push([n, seen.get(fp)]); continue; }
    seen.set(fp, n);
    if (!p.words) scannedPages.add(n);
    if (!p.grid) { bad.push(n); continue; }
    events.push(...await scanPage(n, p));
  }
  onProgress && onProgress(pdf.numPages, pdf.numPages);
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const all = build(events, scannedPages), khewats = [], bySig = new Map(), byNo = new Map(), byBody = new Map();
  // a khewat number printed garbled (overlapping text) can split one khewat in two: a piece with owners but no
  // total, then a piece with the total. Join them only when together the shares add up to exactly 1.
  for (let i = 0; i + 1 < all.length; i++) {
    const a = all[i], b = all[i + 1];
    if (a.totalSeen || !a.owners.length || one(a.shareSum) || !b.total || !b.owners.length) continue;
    if (Math.min(...b.pages) - Math.max(...a.pages) > 1 || !one(fadd(a.shareSum, b.shareSum))) continue;
    b.owners = [...a.owners, ...b.owners]; b.shareSum = [1n, 1n];
    b.khatauni = [...new Set([...a.khatauni, ...b.khatauni])]; a.pages.forEach(p => b.pages.add(p));
    b.numberNote = `khewat number printed unclearly on page ${Math.min(...a.pages)} (read as ${a.no} and ${b.no}); its two parts were joined because the shares then add up to exactly 1 - check the number on that page`;
    all.splice(i, 1); i--;
  }
  const spanOf = k => { const p = [...k.pages].sort((a, b) => a - b); return p[0] + (p.length > 1 ? '-' + p[p.length - 1] : ''); };
  for (const k of all) {
    // a copy whose owner table the site failed to print has no shares: handled below, after the good copies are known
    if (k.printError && !k.owners.some(o => /\//.test(o.shareTxt))) continue;
    const body = `${k.khatauni.join(',')}|${k.total ? k.total[0] + '-' + k.total[1] : ''}|${k.owners.map(o => o.shareTxt).join(',')}`;
    const sig = `${k.no}|${body}`;
    const pages = [...k.pages].sort((a, b) => a - b), span = pages[0] + (pages.length > 1 ? '-' + pages[pages.length - 1] : '');
    if (k.no !== null && bySig.has(sig)) { bySig.get(sig).alsoOn.push(span); continue; }
    // same khataunis, total and shares under another number = the same record with a misread khewat number
    const twin = k.khatauni.length && byBody.get(body);
    if (twin) { twin.alsoOn.push(`${span} (number read there as ${k.no})`); continue; }
    // same number, total and shares, khataunis of one inside the other = a repeated copy cut short
    // by skipped duplicate pages: count it once, keep the fuller copy
    const prev = k.no !== null && byNo.get(k.no);
    const sharesOf = x => x.owners.map(o => o.shareTxt).join(',');
    const inside = (a, b) => a.every(t => b.includes(t));
    if (prev && k.total && prev.total && k.total[0] === prev.total[0] && k.total[1] === prev.total[1] &&
        k.owners.length && sharesOf(k) === sharesOf(prev) &&
        (inside(k.khatauni, prev.khatauni) || inside(prev.khatauni, k.khatauni))) {
      if (k.khatauni.length <= prev.khatauni.length) { prev.alsoOn.push(span); continue; }
      const pp = [...prev.pages].sort((a, b) => a - b);
      k.alsoOn = [pp[0] + (pp.length > 1 ? '-' + pp[pp.length - 1] : ''), ...prev.alsoOn]; k.repeatNote = prev.repeatNote || '';
      khewats[khewats.indexOf(prev)] = k; bySig.set(sig, k); byNo.set(k.no, k); byBody.set(body, k);
      continue;
    }
    // same number and shares, khataunis inside the earlier copy, but no total of its own printed:
    // the start of the khewat printed again and cut short - count it once
    if (prev && prev.total && (!k.totalSeen || k.totalFromSum) && k.owners.length && sharesOf(k) === sharesOf(prev) &&
        k.khatauni.length && inside(k.khatauni, prev.khatauni)) { prev.alsoOn.push(span); continue; }
    k.alsoOn = []; k.repeatNote = '';
    const same = byNo.get(k.no);
    if (k.no !== null && same) {
      const msg = `khewat ${k.no} is printed again with different details (pages ${pages.join(', ')} and ${[...same.pages].sort((a, b) => a - b).join(', ')}) - check which is right`;
      k.repeatNote = msg; if (!same.repeatNote) same.repeatNote = msg;
    }
    bySig.set(sig, k); byNo.set(k.no, k); byBody.set(body, k); khewats.push(k);
  }
  // a copy the site failed to print ('Error: Subreport could not be shown'): count the khewat once from a good copy;
  // with no good copy, keep it with a check (its owners were not printed)
  for (const k of all.filter(x => x.printError && !x.owners.some(o => /\//.test(o.shareTxt)))) {
    const good = k.no !== null && byNo.get(k.no);
    if (good) { good.alsoOn.push(`${spanOf(k)} (the Fard could not print the details there)`); continue; }
    k.alsoOn = []; k.repeatNote = ''; k.owners = []; k.shareSum = [0n, 1n]; k.leftover = '';
    k.printNote = `the Fard could not print this khewat's owners on page ${k.printError} ("Error: Subreport could not be shown") - download the Fard again`;
    khewats.push(k);
  }
  // scans: a 4-digit number ending in 7 among 3-digit ones is usually 'NNN/' with the slash read as 7
  const lastPdfPage = Math.max(0, ...[...seen.values()]);
  for (const k of khewats) k.scanned = [...k.pages].some(p => scannedPages.has(p));
  for (let i = 1; i < khewats.length - 1; i++) {
    const a = +khewats[i - 1].no, b = +khewats[i].no, c = +khewats[i + 1].no, k = khewats[i];
    if (k.scanned && a < c && (b < a || b > c))
      k.numberNote = (k.numberNote ? k.numberNote + '; ' : '') + `khewat number ${k.no} is out of order (between ${khewats[i - 1].no} and ${khewats[i + 1].no}) - it may be misread; check page ${Math.min(...k.pages)}`;
  }
  for (const k of khewats) {
    k.scanned = [...k.pages].some(p => scannedPages.has(p));
    k.atEnd = Math.max(...k.pages) === lastPdfPage;
    const no = String(k.no || ''), others = khewats.filter(o => o !== k).map(o => String(o.no || '').length);
    if (k.scanned && no.length >= 4 && no.endsWith('7') && others.length && Math.max(...others) <= no.length - 1)
      k.numberNote = (k.numberNote ? k.numberNote + '; ' : '') + `khewat number read as ${no}; it is probably ${no.slice(0, -1)} (the "/" after it read as 7) - check page ${[...k.pages].sort((a, b) => a - b)[0]}`;
  }
  return { khewats, badPages: bad, dupPages: dups, pages: pdf.numPages, events };
}
