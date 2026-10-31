import { initOCR, scanPdf, khewatNotes, khewatInfo, mutationNote, mortgageMention, ownerLand, km } from './engine.js';
import { toEnglish } from './translit.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// offline: the service worker stores every file on the phone; say so once it is done
const VERSION = '20.7';
let reading = false;
if ('serviceWorker' in navigator) {
  // a newer version was installed while this page was open: offer to switch (never in the middle of reading)
  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) { hadController = true; return; }       // first install, not an update
    const b = $('update'); b.hidden = false;
    b.onclick = () => { if (!reading) location.reload(); };
  });
  navigator.serviceWorker.register('sw.js').then(r => r.update()).catch(() => {});
  navigator.serviceWorker.ready.then(async () => {
    for (let i = 0; i < 60; i++) {
      if (await caches.match('vendor/lang/pan.traineddata')) { $('offline').textContent = `Ready to use offline. Version ${VERSION}.`; return; }
      await new Promise(r => setTimeout(r, 2000));
    }
  });
}

function workerCount() {
  const cores = navigator.hardwareConcurrency || 2, mem = navigator.deviceMemory || 4;
  if (mem <= 2) return 1;
  return Math.max(1, Math.min(3, cores - 1));
}

// Punjab's districts have fixed English names; pind and tehsil names are converted like owner names
const DISTRICTS = [['ਅੰਮ੍ਰਿਤਸਰ','Amritsar'],['ਅੰਮਿ੍ਤਸਰ','Amritsar'],['ਬਰਨਾਲਾ','Barnala'],['ਬਠਿੰਡਾ','Bathinda'],['ਫਰੀਦਕੋਟ','Faridkot'],
  ['ਫਤਿਹਗੜ੍ਹ','Fatehgarh Sahib'],['ਫਤਿਹਗੜ','Fatehgarh Sahib'],['ਫਾਜ਼ਿਲਕਾ','Fazilka'],['ਫਾਜਿਲਕਾ','Fazilka'],['ਫਿਰੋਜ਼ਪੁਰ','Ferozepur'],['ਫਿਰੋਜਪੁਰ','Ferozepur'],
  ['ਗੁਰਦਾਸਪੁਰ','Gurdaspur'],['ਹੁਸ਼ਿਆਰਪੁਰ','Hoshiarpur'],['ਹੁਸਿਆਰਪੁਰ','Hoshiarpur'],['ਜਲੰਧਰ','Jalandhar'],['ਕਪੂਰਥਲਾ','Kapurthala'],['ਲੁਧਿਆਣਾ','Ludhiana'],
  ['ਮਾਲੇਰਕੋਟਲਾ','Malerkotla'],['ਮਲੇਰਕੋਟਲਾ','Malerkotla'],['ਮਾਨਸਾ','Mansa'],['ਮੋਗਾ','Moga'],['ਮੁਕਤਸਰ','Sri Muktsar Sahib'],['ਮੁਕੱਤਸਰ','Sri Muktsar Sahib'],
  ['ਪਠਾਨਕੋਟ','Pathankot'],['ਪਟਿਆਲਾ','Patiala'],['ਰੂਪਨਗਰ','Rupnagar'],['ਰੋਪੜ','Rupnagar'],['ਮੋਹਾਲੀ','SAS Nagar (Mohali)'],['ਐਸ.ਏ.ਐਸ','SAS Nagar (Mohali)'],
  ['ਸੰਗਰੂਰ','Sangrur'],['ਜਗਰਾਉਂ','Jagraon'],['ਜਗਰਾਓਂ','Jagraon'],['ਮੁੱਲਾਂਪੁਰ','Mullanpur Dakha'],['ਮੁੱਲਾਪੁਰ','Mullanpur Dakha'],['ਮੁਲਾਂਪੁਰ','Mullanpur Dakha'],['ਨਵਾਂਸ਼ਹਿਰ','Shaheed Bhagat Singh Nagar'],['ਸ਼ਹੀਦ ਭਗਤ','Shaheed Bhagat Singh Nagar'],['ਤਰਨ ਤਾਰਨ','Tarn Taran'],['ਤਰਨਤਾਰਨ','Tarn Taran']];
const zillaEn = p => { const hit = DISTRICTS.find(([g]) => p.includes(g)); return hit ? hit[1] : (p ? toEnglish(p) : ''); };
const placeEn = p => p ? (DISTRICTS.find(([g]) => p === g) || [0, toEnglish(p)])[1] : '';

// 'Amar Singh s/o Ram Singh s/o Hari Singh' -> ['Amar Singh', 's/o Ram Singh s/o Hari Singh']
function splitRel(en) {
  const m = en.match(/\s(s\/o|d\/o|w\/o|widow of|mother of)\s/);
  return m ? [en.slice(0, m.index), en.slice(m.index + 1)] : [en, ''];
}

// 1 acre = 8 kanal = 160 marla
const acres = marla => (Math.round(marla / 160 * 10000) / 10000).toFixed(4);   // 4 decimal places

// ---------- turn scan output into rows ----------
function summarise(fileName, res) {
  const kh = [], owners = [], people = new Map();
  for (const k of res.khewats) {
    const notes = khewatNotes(k), info = khewatInfo(k), flag = notes.join('; '), mut = mutationNote(k);
    const tot = k.total ? (k.unit === 'bigha' ? `${k.total[0]} B - ${k.total[1]} b` : `${k.total[0]} K - ${k.total[1]} M`) : '';
    // bigha-biswa khewats: shown in B-b, converted with 1 biswa = 5/3 marla for acres and By person
    const big = k.unit === 'bigha', f = big ? 5 / 3 : 1, unitTxt = t => big ? t.replace(' K - ', ' B - ').replace(/ M$/, ' b') : t;
    const totalAcres = k.total ? acres((k.total[0] * 20 + k.total[1]) * f) : '';
    const shownNo = k.oldNo ? `${k.no}/${k.oldNo}` : k.no;      // as printed in the Fard: new/old khewat number
    const krow = { no: shownNo, khatauni: k.khatauni.join(', '), total: tot,
      totalPage: k.totalPage || (k.totalFromSum ? 'sum of khataunis' : ''), nOwners: k.owners.length,
      pages: [...k.pages].sort((a, b) => a - b).join(', '), mut, mortg: mortgageMention(k), shamlat: k.kind === 'shamlat', flag, notes, info, owners: [],
      khasra: k.khasras.length ? k.khasras.join(', ') : (k.khasraNote || ''), totalAcres,
      place: { pind: k.place.pind, tehsil: k.place.tehsil, zilla: k.place.zilla, year: k.place.year,
               pindEn: placeEn(k.place.pind), tehsilEn: zillaEn(k.place.tehsil), zillaEn: zillaEn(k.place.zilla) },
      alsoOn: (k.alsoOn || []).join(', '),
      mortgagees: (k.mortgagees || []).map(m => ({ en: toEnglish(m.name), pa: m.name, share: m.shareTxt })) };
    for (const o of k.owners) {
      const land = ownerLand(k, o);
      const marla = land ? Number(land[0]) / Number(land[1]) * f : null;
      const [nm, rel] = splitRel(toEnglish(o.name));
      const row = { page: o.page, khewat: shownNo, khatauni: krow.khatauni, en: toEnglish(o.name), nm, rel, pa: o.name, nameNote: o.nameNote || '',
                    share: o.shareTxt, total: tot, land: land ? unitTxt(km(land)) : '', acres: marla === null ? '' : acres(marla),
                    khasra: krow.khasra, mut, flag };
      krow.owners.push(row); owners.push(row);
      if (krow.shamlat) continue;                 // village common land: not any one person's land
      const pkey = `${o.name}|${krow.place.pind}|${krow.place.year}`;
      const p = people.get(pkey) || { en: row.en, nm, rel, pa: o.name, m: 0, kh: [], pg: new Set(), flag: false, place: krow.place };
      if (land) p.m += Number(land[0]) / Number(land[1]) * f;
      p.kh.push(String(shownNo)); p.pg.add(o.page); p.flag = p.flag || !!flag;
      people.set(pkey, p);
    }
    kh.push(krow);
  }
  const persons = [...people.values()].sort((a, b) => b.m - a.m)
    .map(p => ({ en: p.en, nm: p.nm, rel: p.rel, pa: p.pa, land: km(p.m), acres: acres(p.m), place: p.place, khewats: p.kh.join(', '), pages: [...p.pg].sort((a, b) => a - b).join(', '),
                 flag: p.flag ? 'some khewats need checking - see Owners' : '' }));
  return { fileName, pages: res.pages, badPages: res.badPages, dupPages: res.dupPages || [], kh, owners, persons };
}

// ---------- screen ----------
// ---------- screen: one table, in the surveyor's column order ----------
const COLS = ['Name', 'Relation', 'Khasra No.', 'Khewat No.', 'Acres', 'Kanal-Marla', 'Share', 'Khatauni No.'];
function render(S) {
  const nChk = S.kh.filter(k => k.flag).length, nInfo = S.kh.filter(k => !k.flag && (k.info || []).length).length;
  if (!S.kh.length) {
    $('summary').innerHTML = `<strong>${esc(S.fileName)}</strong>`;
    $('viewKh').innerHTML = `<div class="flag">Could not find any khewat in this PDF. Is it a Jamabandi / Fard with the usual 8-column table? Please send it to be checked.</div>`;
    $('viewPe').innerHTML = ''; $('results').hidden = false; return;
  }
  $('summary').innerHTML = `<strong>${esc(S.fileName)}</strong><br>${S.pages} pages, ${S.kh.length} khewat${S.kh.length === 1 ? '' : 's'}, ${S.owners.length} owner${S.owners.length === 1 ? '' : 's'}. ` +
    (nChk ? `<strong>${nChk} khewat${nChk > 1 ? 's' : ''} to check</strong> (yellow: the acres may be affected).` : 'All area checks passed.') +
    (nInfo ? ` ${nInfo} other khewat${nInfo > 1 ? 's have' : ' has'} notes only (grey: acres not affected).` : '') +
    (S.badPages.length ? ` Pages not read (different layout): ${S.badPages.join(', ')}.` : '') +
    (S.dupPages.length ? ` Pages ${S.dupPages.map(d => d[0]).join(', ')} repeat earlier pages and were counted once.` : '') +
    `<br><span class="hint-inline">Tap a row to highlight it. The name column stays in place when you scroll sideways.</span>`;
  const n = COLS.length;
  const body = S.kh.map(k => {
    const head = `<tr class="kh-row"><td colspan="${n}"><div class="stick">
        <strong>Khewat ${esc(k.no ?? '?')}</strong> &nbsp;Total ${esc(k.total || 'not read')}${k.totalAcres ? ` (${esc(k.totalAcres)} acres)` : ''}. Pages ${esc(k.pages)}.${k.alsoOn ? ` <span class="also">Printed again on pages ${esc(k.alsoOn)} (same record, counted once).</span>` : ''}
        ${k.place.pind || k.place.zilla ? `<div class="placeline">Pind ${esc(k.place.pindEn || '-')}, Tehsil ${esc(k.place.tehsilEn || '-')}, Zilla ${esc(k.place.zillaEn || '-')}${k.place.year ? `. Jamabandi ${esc(k.place.year)}` : ''}.</div>` : ''}
        ${k.mortgagees && k.mortgagees.length ? `<div class="note">Mortgage parties (ਰਾਹਿਨਾਨ / ਮੁਰਤਹਿਨਾਨ), not owners: ${k.mortgagees.map(m => `${esc(m.en)} (${esc(m.share)})`).join(', ')}.</div>` : ''}
        ${k.notes.map(t => `<div class="flag">Check: ${esc(t)}</div>`).join('')}
        ${(k.info || []).map(t => `<div class="note">Note: ${esc(t)}</div>`).join('')}
        ${k.shamlat ? `<div class="note">Shamlat (ਸ਼ਾਮਲਾਤ): village common land held by the patti, not by one person. It is not added to anyone under By person.</div>` : ''}
        ${k.mut ? `<div class="note">Later red notes (ਇੰਤਕਾਲ / ਰਪਟ) on page ${esc(k.mut.replace('Yes - page ', ''))}: ownership, mortgage or court changes after this Jamabandi.</div>` : ''}
        ${k.mortg ? `<div class="note">Remarks mention a mortgage (ਆੜ ਰਹਿਨ) on page ${esc(k.mortg)}: check whether it is still in force (ਫੱਕ = released).</div>` : ''}
      </div></td></tr>`;
    if (!k.owners.length) return head + `<tr><td class="name" colspan="${n}">No owners read for this khewat.</td></tr>`;
    const span = k.owners.length;
    const rows = k.owners.map((o, i) => `<tr class="own${i % 2 ? ' alt' : ''}${k.flag ? ' chk' : ''}">
        <td class="name"><div class="en">${esc(o.nm || o.en)}</div><div class="pa" lang="pa">${esc(o.pa)}</div>${o.nameNote ? `<div class="namenote">${esc(o.nameNote)}</div>` : ''}<div class="pg">Page ${esc(o.page)}</div></td>
        <td class="rel">${esc(o.rel || '-')}</td>
        ${i === 0 ? `<td class="khasra" rowspan="${span}">${esc(k.khasra || '-')}</td><td class="num" rowspan="${span}">${esc(k.no ?? '?')}</td>` : ''}
        <td class="num big">${esc(o.acres || '-')}</td>
        <td class="num big">${esc(o.land || '-')}</td>
        <td class="num">${esc(o.share)}</td>
        ${i === 0 ? `<td class="num" rowspan="${span}">${esc(k.khatauni || '-')}</td>` : ''}
      </tr>`).join('');
    return head + rows;
  }).join('');
  $('viewKh').innerHTML = `<div class="tbl-wrap"><table class="tbl"><thead><tr>${COLS.map((c, i) => `<th${i === 0 ? ' class="name"' : ''}>${c}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>`;
  const pl = (en, pa) => `${esc(en || '-')}${pa ? `<div class="pa" lang="pa">${esc(pa)}</div>` : ''}`;
  $('viewPe').innerHTML = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th class="name">Name</th><th>Relation</th><th>Acres</th><th>Kanal-Marla</th><th>Khewat No.</th><th>Pind</th><th>Tehsil</th><th>Zilla</th><th>Year</th></tr></thead><tbody>` +
    S.persons.map((p, i) => `<tr class="own${i % 2 ? ' alt' : ''}${p.flag ? ' chk' : ''}">
        <td class="name"><div class="en">${esc(p.nm || p.en)}</div><div class="pa" lang="pa">${esc(p.pa)}</div><div class="pg">Page ${esc(p.pages)}</div></td>
        <td class="rel">${esc(p.rel || '-')}</td>
        <td class="num big">${esc(p.acres)}</td><td class="num big">${esc(p.land)}</td><td class="num">${esc(p.khewats)}</td>
        <td>${pl(p.place.pindEn, p.place.pind)}</td><td>${pl(p.place.tehsilEn, p.place.tehsil)}</td><td>${pl(p.place.zillaEn, p.place.zilla)}</td>
        <td class="num">${esc(p.place.year || '-')}</td></tr>`).join('') +
    `</tbody></table></div>`;
  for (const t of document.querySelectorAll('.tbl')) t.addEventListener('click', ev => {
    const tr = ev.target.closest('tr.own'); if (!tr) return;
    for (const x of document.querySelectorAll('tr.sel')) if (x !== tr) x.classList.remove('sel');
    tr.classList.toggle('sel');
  });
  $('results').hidden = false;
}

// ---------- saved results (IndexedDB on the phone; nothing is uploaded) ----------
const DB = () => new Promise((ok, bad) => {
  const r = indexedDB.open('fard-reader', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('results', { keyPath: 'id' });
  r.onsuccess = () => ok(r.result); r.onerror = () => bad(r.error);
});
async function store(mode, fn) {
  const db = await DB();
  return new Promise((ok, bad) => { const tx = db.transaction('results', mode), q = fn(tx.objectStore('results')); tx.oncomplete = () => ok(q && q.result); tx.onerror = () => bad(tx.error); });
}
async function saveResult(S) {
  try {
    await store('readwrite', s => s.put({ id: Date.now(), savedAt: new Date().toISOString(), S }));
    const all = await store('readonly', s => s.getAll());
    for (const r of all.sort((x, y) => y.id - x.id).slice(50)) await store('readwrite', s => s.delete(r.id));   // keep the latest 50
  } catch (e) { /* storage full or blocked: the result is still on screen */ }
  showSaved();
}
async function showSaved() {
  let all = [];
  try { all = (await store('readonly', s => s.getAll())).sort((x, y) => y.id - x.id); } catch (e) { }
  $('saved').hidden = !all.length;
  $('savedList').innerHTML = all.map(r => `<li><button class="link" data-open="${r.id}"><strong>${esc(r.S.fileName)}</strong><br>
      <span>${esc(new Date(r.savedAt).toLocaleString())} · ${r.S.kh.length} khewats · ${r.S.owners.length} owners${r.S.kh.some(k => k.flag) ? ' · has checks' : ''}</span></button>
      <button class="del" data-del="${r.id}" aria-label="Delete">Delete</button></li>`).join('');
}
$('savedList').addEventListener('click', async ev => {
  const o = ev.target.closest('[data-open]'), d = ev.target.closest('[data-del]');
  if (o) { const r = await store('readonly', s => s.get(+o.dataset.open)); if (r) { last = r.S; render(last); $('results').scrollIntoView(); } }
  if (d && confirm('Delete this saved result?')) { await store('readwrite', s => s.delete(+d.dataset.del)); showSaved(); }
});
$('print').addEventListener('click', () => window.print());
showSaved();

// ---------- flow ----------
let last = null;
async function run(fileName, data) {
  $('results').hidden = true; $('error').hidden = true; $('status').hidden = false;
  $('pickLabel').hidden = true; $('hint').hidden = true;
  const t0 = Date.now();
  reading = true;
  try {
    await initOCR(workerCount(), s => { $('statusText').textContent = s; });
    const res = await scanPdf(data, (done, total) => {
      $('barFill').style.width = `${Math.round(100 * done / total)}%`;
      let eta = '';
      if (done > 0 && done < total) { const s = (Date.now() - t0) / done * (total - done) / 1000; eta = ` About ${s < 90 ? Math.ceil(s) + ' seconds' : Math.ceil(s / 60) + ' minutes'} left.`; }
      $('statusText').textContent = done < total ? `Reading page ${done + 1} of ${total}.${eta}` : 'Checking shares and totals...';
      document.title = done < total ? `Reading ${done + 1}/${total} · Fard Reader` : 'Checking… · Fard Reader';
    });
    last = summarise(fileName, res);
    document.title = '✓ Done · Fard Reader';
    $('status').hidden = true;
    render(last);
    window.__result = last;
    saveResult(last);
  } catch (e) {
    $('status').hidden = true;
    $('error').hidden = false;
    $('error').textContent = `Could not read this PDF: ${e && e.message ? e.message : e}. Check it is a Jamabandi / Fard PDF and try again.`;
    window.__result = { error: String(e && e.stack || e) };
    document.title = 'Error · Fard Reader';
  } finally {
    reading = false;
    $('pickLabel').hidden = false;
  }
}

$('file').addEventListener('change', async ev => {
  const f = ev.target.files[0]; if (!f) return;
  await run(f.name, new Uint8Array(await f.arrayBuffer()));
  ev.target.value = '';
});
$('again').addEventListener('click', () => $('file').click());
for (const [b, v, o, ov] of [['tabKh', 'viewKh', 'tabPe', 'viewPe'], ['tabPe', 'viewPe', 'tabKh', 'viewKh']])
  $(b).addEventListener('click', () => { $(b).setAttribute('aria-pressed', 'true'); $(o).setAttribute('aria-pressed', 'false'); $(v).hidden = false; $(ov).hidden = true; });
