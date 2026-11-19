// Wczytywanie programów uroczystości z dokumentu (np. „Triduum”: kilka dni w jednym pliku).
// Układ pliku: wiersz z samą nazwą dnia = nowa uroczystość; wiersz „część mszy | pieśń” – lewa kolumna to część
// (pusta = ta sama część co wyżej); tekst bez pieśni i bez części na końcu/początku (np. „Triduum 2026”) = nazwa całego zestawu.
// Czysty parser – bez DOM, żeby dało się go testować w Node.
window.ProgImport = (() => {
  'use strict';

  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, ' ').trim();
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  // komórka bez treści: pusta, sama kropka, „0”, kreski, wielokropek
  const junk = (c) => /^[\s.…·_\-–—0]*$/.test(c || '');

  // Skróty części mszy z lewej kolumny → nazwy jak w programach
  function partName(label) {
    const raw = String(label).replace(/[:.\s]+$/, '').trim();
    const k = norm(raw);
    if (/^(we\d*|wejscie)$/.test(k)) return 'Wejście';
    if (k === 'kyrie') return 'Kyrie';
    if (k === 'gloria' || /^chwala na wysokosci/.test(k)) return 'Gloria';
    if (k === 'psalm') return 'Psalm';
    const ps = k.match(/^ps\s?0*(\d+)$/);
    if (ps) return 'Psalm ' + ps[1];
    if (/^(chwala|alleluja|aklamacja|chwala tobie)$/.test(k)) return 'Alleluja lub Chwała';
    if (/^(of|ofiarowanie)$/.test(k)) return 'Ofiarowanie';
    if (/^(sanctus|swiety)$/.test(k)) return 'Sanctus';
    if (/^(agnus|agnus dei|baranku)$/.test(k)) return 'Agnus Dei';
    if (/^(kom|komunia)$/.test(k)) return 'Komunia';
    if (/^(uw|uwielbienie|dziekczynienie)$/.test(k)) return 'Uwielbienie';
    if (/^(wy|wyj|wyjscie|zakonczenie)$/.test(k)) return 'Wyjście';
    return cap(raw.replace(/\s+/g, ' '));
  }

  // Elementy liturgii, które są i częścią mszy, i utworem (mogą mieć nuty)
  const LITURGY = [['meka', 'Męka'], ['sekwencja', 'Sekwencja'], ['litania', 'Litania'], ['potrojne amen', 'Potrójne Amen']];
  const liturgyPart = (title) => {
    const k = norm(title);
    const hit = LITURGY.find(([w]) => k === w || k.startsWith(w + ' '));
    return hit ? hit[1] : null;
  };

  // „Ave Verum / Wysławiam zranienie (!)” → tytuły [„Ave Verum”, „Wysławiam zranienie”], uwaga „!”
  function cleanTitle(raw) {
    let s = ' ' + String(raw).replace(/\s+/g, ' ') + ' ';
    const notes = [];
    const add = (n) => { if (!notes.includes(n)) notes.push(n); };
    s = s.replace(/\(\s*ew\.?\s*\)|(^|\s)ew\.(?=\s)/gi, () => { add('ewentualnie'); return ' '; });
    s = s.replace(/\[\s*(\d+)\s*\]/g, (_, n) => { add(`[${n}]`); return ' '; });
    s = s.replace(/\(\s*!\s*\)|!+(?=\s*$)/g, () => { add('!'); return ' '; });
    s = s.replace(/\(\s*\?\s*\)|\?+(?=\s*$)/g, () => { add('?'); return ' '; });
    s = s.replace(/\s*[.…·_]{2,}\s*/g, ' ').replace(/…/g, ' ');
    s = s.replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').replace(/,\s*\(/g, ' (').replace(/\(\s*\)/g, ' ');
    // podział na pieśni do wyboru: „/” i „+” poza nawiasami
    const parts = [];
    let cur = '';
    let depth = 0;
    for (const ch of s) {
      if (ch === '(') depth++;
      if (ch === ')') depth = Math.max(0, depth - 1);
      if (!depth && (ch === '/' || ch === '+')) { parts.push(cur); cur = ''; continue; }
      cur += ch;
    }
    parts.push(cur);
    const titles = parts
      .map((p) => p.replace(/\s+/g, ' ').replace(/^[\s,;:.]+|[\s,;:.]+$/g, '').trim())
      .filter((p) => p && !junk(p) && /\p{L}/u.test(p))
      .map(cap);
    return { titles, note: notes.join(' ') };
  }

  // lines – linijki dokumentu (wiersz tabeli = komórki połączone tabulatorem, z pustymi komórkami)
  function parse(lines) {
    const rows = lines.map((l) => String(l).split('\t').map((c) => c.replace(/\s+/g, ' ').trim()))
      .filter((r) => r.some((c) => !junk(c)));
    // kolumna z tytułami pieśni: najczęstsza pozycja treści w wierszach z wypełnioną lewą kolumną
    const count = {};
    for (const r of rows) {
      if (junk(r[0])) continue;
      const i = r.findIndex((c, k) => k > 0 && !junk(c));
      if (i > 0) count[i] = (count[i] || 0) + 1;
    }
    const titleCol = Number(Object.entries(count).sort((a, b) => b[1] - a[1])[0]?.[0] || 1);

    const days = [];
    const headers = []; // nagłówki bez pieśni (nazwa zestawu)
    let day = null;
    let part = null;
    const newDay = (name) => { day = { name, parts: [] }; days.push(day); part = null; };
    const usePart = (name) => {
      if (!day) newDay('');
      if (part && part.name === name) return part;
      part = { name, items: [] };
      day.parts.push(part);
      return part;
    };

    for (const r of rows) {
      const filled = r.map((c, i) => (junk(c) ? -1 : i)).filter((i) => i >= 0);
      if (filled.length === 1) {
        const i = filled[0];
        const text = r[i];
        const header = (r.length <= titleCol || (i !== 0 && i !== titleCol)) && !/:\s*$/.test(text);
        if (header) { newDay(text); continue; }
      }
      const label = junk(r[0]) ? '' : r[0];
      if (label) usePart(partName(label));
      const text = r.slice(1).filter((c) => !junk(c)).join(' ');
      if (!text) continue;
      const { titles, note } = cleanTitle(text);
      for (const t of titles) {
        const lit = !label && liturgyPart(t);
        const pt = lit ? usePart(lit) : part || usePart('Pieśni');
        pt.items.push({ title: t, note });
      }
    }

    // dni bez pieśni to nagłówki (np. „Triduum 2026”) – pierwszy z nich to nazwa zestawu
    const real = [];
    for (const d of days) {
      d.parts = d.parts.filter((p) => p.items.length);
      if (d.parts.length) real.push(d);
      else if (d.name) headers.push(d.name);
    }
    const group = headers[0] || '';
    real.forEach((d, i) => {
      if (!d.name) d.name = `Uroczystość ${i + 1}`;
    });
    return { group, days: real, titleCol };
  }

  return { parse, cleanTitle, partName };
})();
if (typeof module !== 'undefined') module.exports = window.ProgImport;
