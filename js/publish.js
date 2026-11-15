// Administrator: publikacja dla chórzystów (kopie nut, PDF śpiewników, katalog zaszyfrowany PIN-em).
window.Publish = (() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const A = window.App;
  const esc = A.esc;
  let busy = false;
  let problems = [];

  const P = () => {
    const d = A.data;
    if (!d.publish || typeof d.publish !== 'object') d.publish = {};
    const p = d.publish;
    if (p.pin == null) p.pin = '2018';
    if (p.pdf == null) p.pdf = true;
    p.copies = p.copies || {};
    p.pdfs = p.pdfs || {};
    return p;
  };
  const usable = (it) => (it.state === 'ok' || it.state === 'auto') && it.files.length > 0;
  const extOf = (name) => (String(name).match(/\.[a-z0-9]{2,5}$/i) || [''])[0];
  const MIME = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', tif: 'image/tiff', tiff: 'image/tiff', heic: 'image/heic', heif: 'image/heif', bmp: 'image/bmp' };
  const mimeOf = (name) => MIME[extOf(name).slice(1).toLowerCase()] || 'application/octet-stream';

  function neededIds() {
    const ids = new Set();
    for (const b of A.data.songbooks) for (const it of b.items) if (usable(it)) it.files.forEach((f) => { if (A.data.nodes[f]) ids.add(f); });
    return ids;
  }

  async function hash(text) {
    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(d)].slice(0, 12).map((x) => x.toString(16).padStart(2, '0')).join('');
  }
  // „podpis” śpiewnika – PDF budujemy od nowa tylko, gdy coś się w nim zmieniło
  const sig = (b) => hash(JSON.stringify([b.name, b.items.map((it) => (usable(it)
    ? [it.no, it.title, it.files.map((f) => [f, A.data.nodes[f] && A.data.nodes[f].modified])]
    : [it.no, it.title]))]));

  function catalog() {
    const p = P();
    return {
      v: 1,
      at: new Date().toISOString(),
      songbooks: A.data.songbooks.map((b) => {
        const pdf = p.pdf && p.pdfs[b.id];
        return {
          id: b.id,
          name: b.name,
          pdf: pdf ? pdf.id : null,
          pdfSize: pdf ? pdf.size : 0,
          items: b.items.map((it) => ({
            no: it.no,
            title: it.title,
            files: usable(it) ? it.files.map((f) => p.copies[f] && p.copies[f].id).filter(Boolean) : [],
          })),
        };
      }),
    };
  }

  async function writeCatalog(folder) {
    const p = P();
    const text = JSON.stringify(await KnCrypto.encrypt(catalog(), p.pin));
    if (p.catalogId) {
      try {
        await Drive.updateJson(p.catalogId, text);
        return;
      } catch (e) {
        if (e.status !== 404) throw e;
      }
    }
    const f = await Drive.createJson('spiewniki-dla-chorzystow.json', text, folder);
    p.catalogId = f.id;
  }

  function markPublished() {
    const p = P();
    p.at = new Date().toISOString();
    p.dataAt = Date.now() + 5; // zmiany zapisane później = „są zmiany od publikacji”
    A.changed();
  }

  function step(text, frac) {
    $('pub-status').textContent = text;
    if (frac != null) $('pub-bar').style.width = Math.round(Math.max(0, Math.min(1, frac)) * 100) + '%';
  }

  async function publish() {
    if (busy) return;
    if (!A.data.songbooks.length) return A.toast('Najpierw wczytaj spis pieśni w zakładce „Spisy pieśni”.', true);
    if (!(await A.ensureConnected())) return;
    busy = true;
    problems = [];
    render();
    const p = P();
    try {
      step('Przygotowanie folderu dla chórzystów…', 0.02);
      const folder = await Drive.ensurePublicFolder();
      if (p.folderId !== folder || !p.folderPublic) {
        await Drive.makePublic(folder);
        p.folderId = folder;
        p.folderPublic = true;
      }

      // 1. kopie nut (tylko nowe i zmienione)
      const need = neededIds();
      const todo = [...need].filter((id) => !p.copies[id] || p.copies[id].modified !== A.data.nodes[id].modified);
      let i = 0;
      for (const id of todo) {
        step(`Kopiowanie nut dla chórzystów… ${++i} z ${todo.length}`, 0.05 + 0.35 * (i / todo.length));
        const n = A.data.nodes[id];
        const own = A.data.meta[id] && A.data.meta[id].title;
        const name = own ? own + extOf(n.name) : n.name;
        let copy;
        try {
          copy = await Drive.copyFile(id, name, folder);
        } catch (e) {
          if (e instanceof Drive.AuthError) throw e;
          copy = await Drive.uploadFile(name, mimeOf(n.name), await Drive.download(id), folder); // gdy kopiowanie niedozwolone
        }
        const old = p.copies[id];
        p.copies[id] = { id: copy.id, modified: n.modified || null };
        if (old) await Drive.deleteFile(old.id).catch(() => undefined);
        if (i % 10 === 0) A.changed();
      }
      for (const [id, c] of Object.entries(p.copies)) {
        if (need.has(id)) continue;
        await Drive.deleteFile(c.id).catch(() => undefined);
        delete p.copies[id];
      }
      A.changed();

      // 2. PDF-y śpiewników (tylko gdy coś się zmieniło)
      const books = A.data.songbooks;
      if (p.pdf) {
        const cache = new Map();
        const getBytes = async (fid) => {
          if (!cache.has(fid)) cache.set(fid, new Uint8Array(await Drive.download(fid)));
          return cache.get(fid);
        };
        for (let bi = 0; bi < books.length; bi++) {
          const b = books[bi];
          const cur = p.pdfs[b.id];
          if (!b.items.some(usable)) {
            if (cur) { await Drive.deleteFile(cur.id).catch(() => undefined); delete p.pdfs[b.id]; }
            continue;
          }
          const s = await sig(b);
          if (cur && cur.sig === s) continue;
          const base = 0.4 + 0.5 * (bi / books.length);
          step(`PDF „${b.name}”: pobieranie nut…`, base);
          const res = await PdfBuild.build(b, getBytes, (d, t) => step(`PDF „${b.name}”: ${d} z ${t} pieśni`, base + (0.5 / books.length) * (d / t)));
          step(`PDF „${b.name}”: wysyłanie na Dysk…`);
          const up = await Drive.uploadFile(`${b.name}.pdf`, 'application/pdf', new Blob([res.bytes], { type: 'application/pdf' }), folder, cur && cur.id);
          p.pdfs[b.id] = { id: up.id, sig: s, size: res.bytes.length, pages: res.pages, at: new Date().toISOString() };
          problems.push(...res.problems.map((x) => `${b.name}: ${x}`));
          A.changed();
        }
      }
      for (const id of Object.keys(p.pdfs)) {
        if (books.find((b) => b.id === id)) continue;
        await Drive.deleteFile(p.pdfs[id].id).catch(() => undefined);
        delete p.pdfs[id];
      }

      // 3. katalog dla chórzystów
      step('Zapisywanie spisów dla chórzystów…', 0.96);
      await writeCatalog(folder);
      step('Gotowe.', 1);
      markPublished();
      A.toast(problems.length
        ? `Opublikowano. Do PDF nie udało się dołączyć ${problems.length} ${A.plural(problems.length, 'pozycji', 'pozycji', 'pozycji')} – lista poniżej.`
        : 'Opublikowano dla chórzystów.', problems.length > 0);
    } catch (e) {
      A.changed();
      A.handleError(e);
      step('Przerwano – kliknij „Opublikuj” ponownie, aplikacja dokończy od miejsca przerwania.');
    } finally {
      busy = false;
      render();
    }
  }

  async function savePin() {
    const v = $('pub-pin').value.trim();
    if (!/^\d{4,8}$/.test(v)) return A.toast('PIN musi mieć od 4 do 8 cyfr.', true);
    const p = P();
    if (v === p.pin) return A.toast('PIN bez zmian.');
    p.pin = v;
    A.changed();
    if (!p.catalogId) return A.toast(`Zapisano PIN ${v}. Zacznie obowiązywać po publikacji.`);
    if (!(await A.ensureConnected())) return A.toast('Zapisano PIN, ale chórzyści dostaną go dopiero po połączeniu z Dyskiem i publikacji.', true);
    try {
      await writeCatalog(p.folderId);
      A.toast(`Nowy PIN ${v} obowiązuje. Chórzyści zostaną o niego poproszeni.`);
    } catch (e) {
      A.handleError(e);
    }
  }

  const link = () => `${location.origin}${location.pathname}?chor=${encodeURIComponent(P().catalogId)}`;

  function render() {
    const p = P();
    if (document.activeElement !== $('pub-pin')) $('pub-pin').value = p.pin;
    $('pub-pdf').checked = !!p.pdf;
    $('pub-books').innerHTML = A.data.songbooks.length
      ? A.data.songbooks.map((b) => {
        const have = b.items.filter(usable).length;
        const pdf = p.pdfs[b.id];
        return `<li><strong>${esc(b.name)}</strong><span class="muted small">${have} z ${b.items.length} ${A.plural(b.items.length, 'pozycji', 'pozycji', 'pozycji')} z nutami${
          p.pdf && pdf ? ` · PDF: ${pdf.pages} str., ${(pdf.size / 1048576).toFixed(1)} MB` : ''}</span></li>`;
      }).join('')
      : '<li class="muted">Brak spisów – wczytaj spis w zakładce „Spisy pieśni”.</li>';
    $('pub-go').disabled = busy || !A.data.songbooks.length;
    $('pub-go').textContent = p.catalogId ? 'Aktualizuj dla chórzystów' : 'Opublikuj dla chórzystów';
    $('pub-pin-save').disabled = busy;
    $('pub-progress').hidden = !busy && !$('pub-status').textContent;
    $('pub-bar').parentElement.hidden = !busy;
    $('pub-problems').hidden = !problems.length;
    $('pub-problems').innerHTML = problems.length
      ? `<p><b>Nie udało się dołączyć do PDF</b> (plik uszkodzony lub w nieobsługiwanym formacie, np. HEIC/TIFF):</p><ul>${problems.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`
      : '';
    $('pub-link-card').hidden = !p.catalogId;
    $('pub-preview').hidden = !p.catalogId;
    if (p.catalogId) {
      $('pub-link').value = link();
      const pending = p.dataAt && A.data.updatedAt > p.dataAt;
      $('pub-info').innerHTML = `Ostatnia publikacja: ${new Date(p.at).toLocaleString('pl-PL')}.` +
        (pending ? ' <b class="warn-text">Od tego czasu są zmiany – kliknij „Aktualizuj”, żeby chórzyści je zobaczyli.</b>' : '');
    }
  }

  $('pub-go').addEventListener('click', publish);
  $('pub-pin-save').addEventListener('click', savePin);
  $('pub-pin').addEventListener('keydown', (e) => { if (e.key === 'Enter') savePin(); });
  $('pub-pdf').addEventListener('change', (e) => { P().pdf = e.target.checked; A.changed(); render(); });
  $('pub-copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText($('pub-link').value);
      A.toast('Skopiowano link.');
    } catch (e) {
      $('pub-link').select();
      A.toast('Zaznaczono link – skopiuj go (Ctrl+C).');
    }
  });
  $('pub-preview').addEventListener('click', () => Guest.enter(P().catalogId));

  return { render };
})();
