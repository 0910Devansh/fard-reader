// Offline Gurmukhi -> English spelling for names in Jamabandi records.
// Letter rules + silent-'a' rule + common name parts. Spellings are approximate by nature.
const CONS = {
  'ਕ':'k','ਖ':'kh','ਗ':'g','ਘ':'gh','ਙ':'ng','ਚ':'ch','ਛ':'chh','ਜ':'j','ਝ':'jh','ਞ':'n',
  'ਟ':'t','ਠ':'th','ਡ':'d','ਢ':'dh','ਣ':'n','ਤ':'t','ਥ':'th','ਦ':'d','ਧ':'dh','ਨ':'n',
  'ਪ':'p','ਫ':'f','ਬ':'b','ਭ':'bh','ਮ':'m','ਯ':'y','ਰ':'r','ਲ':'l','ਵ':'v','ੜ':'r',
  'ਸ':'s','ਹ':'h','ਸ਼':'sh','ਖ਼':'kh','ਗ਼':'g','ਜ਼':'z','ਫ਼':'f','ਲ਼':'l',
};
const NUKTA = { 'ਸ':'ਸ਼','ਖ':'ਖ਼','ਗ':'ਗ਼','ਜ':'ਜ਼','ਫ':'ਫ਼','ਲ':'ਲ਼' };
const VOWEL = { 'ਅ':'a','ਆ':'a','ਇ':'i','ਈ':'I','ਉ':'u','ਊ':'U','ਏ':'e','ਐ':'ai','ਓ':'o','ਔ':'au' };
const MATRA = { 'ਾ':'a','ਿ':'i','ੀ':'I','ੁ':'u','ੂ':'U','ੇ':'e','ੈ':'ai','ੋ':'o','ੌ':'au' };  // I/U = long, spelled per position
const NASAL = new Set(['ੰ','ਂ']), ADDAK = 'ੱ', VIRAMA = '੍';

// whole words that have a fixed English form in these records
const WORDS = {
  'ਸਿੰਘ':'Singh','ਸਿੰਘੁ':'Singh','ਕੌਰ':'Kaur','ਪੁੱਤਰ':'s/o','ਪੁਤਰ':'s/o','ਪੱਤਰ':'s/o',
  'ਪੁਤਰੀ':'d/o','ਪੁੱਤਰੀ':'d/o','ਪਤਨੀ':'w/o','ਵਿਧਵਾ':'widow of','ਵਾਸੀ':'resident of',
  'ਉਰਫ':'alias','ਉਹਫ':'alias','ਉਚਫ':'alias','ਉਚਵ':'alias','ਪੱਤਰੀ':'d/o','ਪਰੀਤਮ':'Pritam','ਪ੍ਰੀਤਮ':'Pritam','ਨੱਛਤਰ':'Nachhattar','ਵਾ':'and','ਪਤਰੀ':'d/o','ਪਰਵਿਸ਼ਨਲ':'Provincial','ਗੌਰਮਿੰਟ':'Government','ਗੋਰਮਿੰਟ':'Government','ਮੁਰਤਹਿਨ':'(mortgagee)','ਰਾਹਿਨਾਨ':'(mortgagors)','ਰਾਹਿਨ':'(mortgagor)','ਮੁਰਤਹਿਨਾਨ':'(mortgagees)','ਇੰਦਰ':'Inder','ਮੁਹੰਮਦ':'Mohammad','ਰਾਮ':'Ram','ਦੇਵ':'Dev','ਦੇਵੀ':'Devi',
  'ਮਾਤਾ':'mother of','ਮੁਤਬੰਨਾ':'(adopted)','ਮੁਤਬੰਨੀ':'(adopted)',
  // common name words whose usual English spelling the letter rules cannot produce. Many are printed in these
  // records without the dot (ਸ for ਸ਼, ਜ for ਜ਼) or with ੋ for ੌ (ਕੋਰ = ਕੌਰ); collected from 16 Fards (Oct 2026)
  'ਕੋਰ':'Kaur','ਕਉਰ':'Kaur','ਉਤਮ':'Uttam','ਉੱਤਮ':'Uttam','ਦਿਆਲ':'Dyal','ਦਰਸਨ':'Darshan','ਦਰਸ਼ਨ':'Darshan','ਸੇਰ':'Sher','ਸ਼ੇਰ':'Sher',
  'ਵਜੀਰ':'Wazir','ਵਜ਼ੀਰ':'Wazir','ਬਹਾਦਰ':'Bahadur','ਬਹਾਦੁਰ':'Bahadur','ਕਰਿਸਨ':'Krishan','ਕਰਿਸ਼ਨ':'Krishan','ਕ੍ਰਿਸ਼ਨ':'Krishan',
  'ਕਰਿਸਨਾ':'Krishna','ਕਰਿਸ਼ਨਾ':'Krishna','ਮੇਜਰ':'Major','ਫੁਮਨ':'Phuman','ਫ਼ੁਮਨ':'Phuman','ਫੁੰਮਨ':'Phuman','ਫ਼ਮਨ':'Phuman',
  'ਰਾਏ':'Rai','ਵਿਜੈ':'Vijay','ਵਿਜੇ':'Vijay','ਸੰਜੇ':'Sanjay','ਸੰਜੈ':'Sanjay','ਅਜੈ':'Ajay','ਹਨੂੰਮਾਨ':'Hanuman','ਹਨੂਮਾਨ':'Hanuman',
  'ਸੰਦਰ':'Sundar','ਇਕਬਾਲ':'Iqbal','ਸੇਖ':'Sheikh','ਸ਼ੇਖ':'Sheikh','ਦੋਲਤ':'Daulat','ਦੌਲਤ':'Daulat','ਸੱਚਾ':'Sucha','ਸੁੱਚਾ':'Sucha',
  'ਪੰਜਾਬ':'Punjab','ਉਮ':'Om','ਸੰਤੇਖ':'Santokh','ਗੱਡੀ':'Guddi','ਗੁਡੀ':'Guddi','ਸਵਰਨ':'Swaran','ਹਜਾਰਾ':'Hazara','ਹਜ਼ਾਰਾ':'Hazara',
  'ਗੁਰਬਖਸ਼':'Gurbakhsh','ਗੁਰਬਖਸ':'Gurbakhsh','ਬਖਸ਼ੀਸ਼':'Bakhshish','ਬਖਸੀਸ':'Bakhshish','ਗਰਚਰਨ':'Gurcharan','ਰੇਸਮ':'Resham','ਰੇਸ਼ਮ':'Resham',
  'ਗੁਲਜਾਰ':'Gulzar','ਗੁਲਜ਼ਾਰ':'Gulzar','ਫੋਜਾ':'Fauja','ਫੌਜਾ':'Fauja','ਸਰਜੀਤ':'Surjit','ਸਾਤੀ':'Shanti','ਸ਼ਾਤੀ':'Shanti','ਸ਼ਾਂਤੀ':'Shanti',
  'ਸਾਂਤੀ':'Shanti','ਸੇਰੋ':'Shero','ਸਤਿਗੁਰ':'Satgur','ਜਗਰੂਪ':'Jagroop','ਜਗਰੁਪ':'Jagroop','ਰਮੇਸ':'Ramesh','ਰਮੇਸ਼':'Ramesh',
  'ਸੁਰੇਸ':'Suresh','ਸੁਰੇਸ਼':'Suresh','ਜ਼ੁਰੇਸ਼':'Suresh','ਖਰੈਤੀ':'Khairati','ਬਿਲੂ':'Billu','ਹਜੂਰਾ':'Hazura','ਹਜੁਰਾ':'Hazura',
  'ਮੁਨਸੀ':'Munshi','ਮੁਨਸ਼ੀ':'Munshi','ਸਮਸੇਰ':'Shamsher','ਸ਼ਮਸ਼ੇਰ':'Shamsher','ਸਤਿਨਾਮ':'Satnam','ਈਸਰ':'Ishar','ਈਸ਼ਰ':'Ishar',
  'ਉਸਾ':'Usha','ਊਸ਼ਾ':'Usha','ਉਸ਼ਾ':'Usha','ਕਸਲਿਆ':'Kaushalya','ਕਸ਼ਲਿਆ':'Kaushalya','ਕੁਸ਼ਲਿਆ':'Kaushalya','ਕੌਸ਼ਲਿਆ':'Kaushalya',
  'ਮੋਨੂੰ':'Monu','ਗਰਗ':'Garg','ਮਕੰਦ':'Mukand','ਮੁਕੰਦ':'Mukand','ਮੰਕਦ':'Mukand','ਸੰਕਤਲਾ':'Shakuntala','ਸਕੰਤਲਾ':'Shakuntala',
  'ਸ਼ਕੁੰਤਲਾ':'Shakuntala','ਸੁਸਮਾ':'Sushma','ਸੁਸ਼ਮਾ':'Sushma','ਬੈਗਮ':'Begum','ਬੇਗਮ':'Begum','ਖਾਂ':'Khan','ਦਇਆ':'Daya','ਚਹਿਲ':'Chahal',
  'ਕਸਮੀਰ':'Kashmir','ਕਸ਼ਮੀਰ':'Kashmir','ਸੀਸਾ':'Sheesha','ਸ਼ੀਸ਼ਾ':'Sheesha','ਟਹਿਲ':'Tehal','ਕੰਦਨ':'Kundan','ਕੁੰਦਨ':'Kundan',
  'ਪ੍ਰਗਟ':'Pargat','ਪਰਗਟ':'Pargat','ਸਨੀਲ':'Sunil','ਸੁਨੀਲ':'Sunil','ਸਾਮ':'Sham','ਸ਼ਾਮ':'Sham','ਸਕੀਲਾ':'Shakeela','ਸ਼ਕੀਲਾ':'Shakeela',
  'ਕਮਾਰ':'Kumar','ਡਿੰਪਲ':'Dimple','ਸਿੰਗਾਰਾ':'Shingara','ਸ਼ਿੰਗਾਰਾ':'Shingara','ਸ਼ਿੰਗਾਰਾਂ':'Shingara','ਨਿਸਾਨ':'Nishan','ਨਿਸ਼ਾਨ':'Nishan',
  'ਸੁਭਾਸ':'Subhash','ਸੁਭਾਸ਼':'Subhash','ਮੋਹਣ':'Mohan','ਦਰਵਾਰਾ':'Darbara','ਸੰਤੋਖ':'Santokh','ਕਿਸੋਰ':'Kishor','ਕਿਸ਼ੋਰ':'Kishor',
  'ਸੁਸੀਲ':'Sushil','ਸੁਸ਼ੀਲ':'Sushil','ਆਸਾ':'Asha','ਆਸ਼ਾ':'Asha','ਬੀਬੀ':'Bibi','ਨਛੱਤਰ':'Nachhattar','ਸ਼ਿਵ':'Shiv','ਸਿਵ':'Shiv',
};
// common name endings (matched at the end of a word, longest first)
const ENDINGS = [
  ['ਵਿੰਦਰ','winder'],['ਜਿੰਦਰ','jinder'],['ਿੰਦਰ','inder'],['ਇੰਦਰ','inder'],['ਪ੍ਰੀਤ','preet'],['ਪਰੀਤ','preet'],['ਦੀਪ','deep'],
  ['ਜੀਤ','jit'],['ਮੀਤ','meet'],['ਜੋਤ','jot'],['ਵੰਤ','want'],['ਵੀਰ','veer'],['ਪਾਲ','pal'],
  ['ਬੀਰ','bir'],['ਗੜ੍ਹ','garh'],['ਗੜ','garh'],['ਨਾਮ','nam'],['ਚਰਨ','charan'],
];

// split a word into units: {c: consonant roman or '', v: vowel roman|null (null = inherent a)}
function units(w) {
  const out = []; let i = 0, gem = false;
  while (i < w.length) {
    let ch = w[i];
    if (w[i + 1] === '਼' && NUKTA[ch]) { ch = NUKTA[ch]; i++; }
    if (ch === ADDAK) { gem = true; i++; continue; }
    if (CONS[ch]) {
      let c = CONS[ch]; const g2 = gem && out.length > 0; if (g2 && c.length === 1) c = c + c; gem = false;
      const u = { c, v: null, nasal: false, cluster: false, gem: g2 }; i++;
      if (w[i] === VIRAMA) { u.cluster = true; i++; }          // pairin: no vowel
      else if (MATRA[w[i]]) { u.v = MATRA[w[i]]; i++; }
      while (NASAL.has(w[i])) { u.nasal = true; i++; }
      out.push(u); continue;
    }
    if (VOWEL[ch]) {
      const u = { c: '', v: VOWEL[ch], nasal: false, cluster: false }; i++;
      while (NASAL.has(w[i])) { u.nasal = true; i++; }
      out.push(u); continue;
    }
    if (NASAL.has(ch) && out.length) { out[out.length - 1].nasal = true; i++; continue; }
    i++;   // anything else (punctuation, digits) is dropped from names
  }
  return out;
}

// STEMS: stems whose silent-'a' pattern the rules can't guess
const STEMS = { 'ਅਰਸ਼': 'arsh', 'ਹਰਸ਼': 'harsh', 'ਓਮ': 'om', 'ਅੰਮ੍ਰਿਤ': 'amrit', 'ਪ੍ਰਮ': 'param', 'ਸਰਭ': 'sarab', 'ਖੁਸ': 'khush', 'ਖੁਸ਼': 'khush' };
function stemRoman(w, lastVoiced = false, hasTail = false) {
  const u = units(w);
  if (!u.length) return '';
  // inherent 'a' (left to right): last consonant silent; otherwise silent when the previous unit
  // is voiced and the next unit carries a vowel (a following pairin cluster counts as voiced).
  const silent = new Array(u.length).fill(false);
  for (let k = 0; k < u.length; k++) {
    if (u[k].v !== null || u[k].cluster || u[k].c === '') continue;
    // a consonant after a pairin cluster keeps its 'a' before a name ending: ਪ੍ਰ+ਦੀਪ = Pradeep
    if (k === u.length - 1) { silent[k] = (u.length > 1 || lastVoiced) && !(hasTail && u[k - 1] && u[k - 1].cluster); continue; }
    if (k === 0 || u[k].nasal) continue;
    const prevVoiced = !silent[k - 1] && !u[k - 1].cluster;
    const next = u[k + 1], nextIsLast = k + 1 === u.length - 1;
    const nextVoiced = next.cluster || next.v !== null || !nextIsLast || lastVoiced;
    silent[k] = prevVoiced && nextVoiced && !next.gem;   // vowel before a doubled (ੱ) consonant is spoken
  }
  const last = u.length - 1;
  // long vowels, as these names are usually spelled in English:
  //  ee only in an open first syllable (Heera, Jeevan, Gheechar) and before a final n (Parveen, Gurleen);
  //  otherwise i (Amrik, Dalip, Sunita, Birbal, Bhagirath, Bibi, Sonia);
  //  oo except at the end, before a name ending or in a closed syllable inside the word (Boota, Roop, Kapoor / Murti, Rupinder)
  const open = k => k + 1 <= last && u[k + 1].c !== '' && !silent[k + 1];
  const vowelOf = k => {
    const v = u[k].v;
    if (u[k].c === '' && (v === 'I' || v === 'U')) return v === 'I' ? 'i' : 'u';   // a vowel letter on its own: Diuti, Ansuia
    if (v === 'I') {
      if (k === last || hasTail) return 'i';
      if (k + 1 === last && silent[last] && u[last].c === 'n') return 'ee';
      return k === 0 && u[0].c !== '' && open(k) && u[k + 1].v !== 'i' && u[k + 1].v !== 'I' ? 'ee' : 'i';
    }
    if (v === 'U') {
      if (k === last || hasTail) return 'u';
      return k + 1 < last && silent[k + 1] ? 'u' : 'oo';
    }
    return v;
  };
  // ਵ said with 'a'/'e' after another letter is 'w' (Bhagwan, Kewal, Sarwan); after i, ee or at the start it stays 'v'
  const isW = k => u[k].c === 'v' && k > 0 && !u[k].cluster && !['i', 'I'].includes(u[k - 1].v) &&
    (u[k].v === null ? !silent[k] : ['a', 'e', 'ai'].includes(u[k].v));
  return u.map((x, k) => (isW(k) ? 'w' : x.c) + (x.cluster ? '' : (x.v !== null ? vowelOf(k) : (silent[k] ? '' : 'a'))) + (x.nasal ? 'N' : '')).join('');
}

function romanWord(w) {
  if (WORDS[w]) return WORDS[w];
  const tails = [];
  for (let n = 0; n < 2; n++) {              // up to two endings, e.g. ਪਲ+ਵਿੰਦਰ+ਪਾਲ
    const hit = ENDINGS.find(([g]) => w.length > g.length && w.endsWith(g));
    if (!hit) break;
    tails.unshift(hit[1]); w = w.slice(0, -hit[0].length);
  }
  const u = units(w);
  if (tails[0] === 'winder') {               // ਦ+ਵਿੰਦਰ = Davinder, ਰਾ+ਵਿੰਦਰ = Ravinder, ਸੁਖ+ਵਿੰਦਰ = Sukhwinder
    if (u.length === 1 && u[0].v === null) tails[0] = 'avinder';
    else if (u.length && u[u.length - 1].v) tails[0] = 'vinder';
  }
  const vowelTail = tails.length > 0 && /^[aeiou]/.test(tails[0]);
  let s = (WORDS[w] ? WORDS[w].toLowerCase() : STEMS[w] || stemRoman(w, vowelTail, tails.length > 0)) + tails.join('');
  // nasal sign: 'm' before b/p/m (Sampuran, Himmat), otherwise 'n'
  s = s.replace(/N(?=[bpm])/g, 'm').replace(/N/g, 'n').replace(/aa+/g, 'a');
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

function toEnglish(name) {
  return name.split(/\s+/).filter(Boolean).map(romanWord).join(' ')
    .replace(/\bs\/o\b/g, 's/o').replace(/\s+/g, ' ').trim();
}

export { toEnglish };
