// Własny podgląd nut u chórzysty (window.NoteView) – zamiast ramki z podglądem Dysku Google.
// Plik pobieramy kluczem API (jak katalog), bez logowania i bez ciasteczek Google, więc otwarcie nut
// nie trafia do „Ostatnich” / strony głównej Dysku osoby zalogowanej w przeglądarce (zgłoszenie użytkownika 2026-11-26).
// Obrazki – <img>, PDF – pdf.js (js/vendor, wczytywany dopiero przy pierwszym PDF-ie), strony jedna pod drugą.
// Otwarte nuty zostają w pamięci urządzenia (Cache API) – drugi raz otworzą się szybciej, także bez internetu.
// Kopie dla chórzystów mają stałą treść (zmiana oryginału = nowa kopia z nowym id), więc najpierw patrzymy do pamięci.
window.NoteView = (() => {
  const cfg = window.KN_CONFIG;
  const API = 'https://www.googleapis.com/drive/v3';
  // osobno dla wersji testowej (ta sama domena = wspólna pamięć przeglądarki); nazwa bez przedrostka schowków SW,
  // bo service worker przy aktywacji kasuje swoje stare schowki
  const CACHE = (cfg.env === 'test' ? 'test~' : '') + 'kn-nuty-v1';
  const MAX_CACHED = 200;
  const MIN_Z = 1;
  const MAX_Z = 5;
  const MAX_PX = 12e6; // największy canvas (iPhone nie narysuje więcej niż ok. 16 mln pikseli)

  // ---------- pobieranie z pamięcią ----------
  const keyOf = (id) => new URL(`__nuty/${encodeURIComponent(id)}`, location.href).href;
  async function openCache() {
    try { return await caches.open(CACHE); } catch (e) { return null; }
  }
  const pending = new Map();
  function fetchFile(id) {
    if (!pending.has(id)) {
      const p = fetchFileNow(id).finally(() => pending.delete(id));
      pending.set(id, p);
    }
    return pending.get(id);
  }
  async function fetchFileNow(id) {
    const cache = await openCache();
    if (cache) {
      const hit = await cache.match(keyOf(id)).catch(() => null);
      if (hit) return hit.blob();
    }
    let r;
    try {
      r = await fetch(`${API}/files/${encodeURIComponent(id)}?alt=media&key=${encodeURIComponent(cfg.apiKey)}`);
    } catch (e) {
      const err = new Error(navigator.onLine ? 'Nie udało się pobrać nut.' : 'offline');
      err.offline = !navigator.onLine;
      throw err;
    }
    if (!r.ok) throw new Error(r.status === 404 ? 'Tych nut nie ma już na Dysku – dyrygent musi zaktualizować listy.' : `Nie udało się pobrać nut (błąd ${r.status}).`);
    const blob = await r.blob();
    if (cache) {
      cache.put(keyOf(id), new Response(blob, { headers: { 'Content-Type': blob.type || 'application/octet-stream' } }))
        .then(() => prune(cache)).catch(() => undefined);
    }
    return blob;
  }
  async function prune(cache) {
    const keys = await cache.keys();
    for (const k of keys.slice(0, Math.max(0, keys.length - MAX_CACHED))) await cache.delete(k);
  }
  // pobranie w tle (następna strona / pieśń), żeby otwierały się od razu
  function prefetch(ids) {
    (ids || []).filter(Boolean).forEach((id) => { fetchFile(id).catch(() => undefined); });
  }

  // ---------- pdf.js ----------
  let pdfjsP = null;
  let worker = null;
  function loadPdfjs() {
    if (!pdfjsP) {
      pdfjsP = new Promise((resolve, reject) => {
        if (window.pdfjsLib) return resolve(window.pdfjsLib);
        const s = document.createElement('script');
        s.src = 'js/vendor/pdfjs.min.js';
        s.onload = () => {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/vendor/pdfjs.worker.min.js';
          resolve(window.pdfjsLib);
        };
        s.onerror = () => { pdfjsP = null; reject(new Error('Nie udało się wczytać przeglądarki PDF.')); };
        document.head.appendChild(s);
      });
    }
    return pdfjsP;
  }
  async function isPdf(blob) {
    if (/pdf/i.test(blob.type)) return true;
    const head = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
    return String.fromCharCode(...head) === '%PDF-';
  }

  // ---------- widok ----------
  // view = { box, doc, zoom, token, pdf, pages:[{canvas, page, w, h}], url, onSwipe }
  let view = null;

  function attach(wrap, opts) {
    wrap.classList.add('nv-wrap');
    wrap.innerHTML = '<div class="nv-box" tabindex="-1"><div class="nv-doc"></div></div><div class="nv-msg" hidden></div>' +
      '<div class="nv-zoom"><button type="button" data-z="1" aria-label="Powiększ" title="Powiększ (Ctrl + kółko myszy)">+</button>' +
      '<button type="button" data-z="-1" aria-label="Pomniejsz" title="Pomniejsz">−</button></div>';
    const box = wrap.querySelector('.nv-box');
    view = { wrap, box, doc: box.querySelector('.nv-doc'), msg: wrap.querySelector('.nv-msg'), zoom: 1, token: 0, pages: [], url: null, onSwipe: opts && opts.onSwipe };
    wrap.querySelector('.nv-zoom').addEventListener('click', (e) => {
      const b = e.target.closest('[data-z]');
      if (b) zoomBy(b.dataset.z > 0 ? 1.4 : 1 / 1.4);
    });
    gestures(box);
    window.addEventListener('resize', () => { if (view && view.box.clientWidth) layout(true); });
  }

  // szerokość strony przy powiększeniu 1: cała szerokość ekranu, na dużym ekranie najwyżej 1000 px
  const baseWidth = () => Math.min(view.box.clientWidth, 1000);
  function layout(rerender) {
    view.doc.style.width = Math.round(baseWidth() * view.zoom) + 'px';
    if (rerender) scheduleRender();
  }

  function clear() {
    view.token++;
    if (view.pdf) { view.pdf.destroy().catch(() => undefined); view.pdf = null; }
    if (view.url) { URL.revokeObjectURL(view.url); view.url = null; }
    view.pages = [];
    view.doc.innerHTML = '';
    view.msg.hidden = true;
    view.wrap.classList.remove('nv-error');
  }

  function message(html, isError) {
    view.msg.innerHTML = html;
    view.msg.hidden = false;
    view.wrap.classList.toggle('nv-error', !!isError);
  }

  // Pokazuje plik o danym id. Zwraca obietnicę: true = pokazany, false = błąd (komunikat w okienku).
  async function show(id, opts) {
    clear();
    view.zoom = 1;
    layout(false);
    view.box.scrollTop = 0;
    view.box.scrollLeft = 0;
    const token = view.token;
    message('<span class="nv-spin" aria-hidden="true"></span> Wczytywanie nut…');
    try {
      const blob = await fetchFile(id);
      if (token !== view.token) return false;
      if (await isPdf(blob)) await showPdf(blob, token);
      else await showImage(blob, token);
      if (token !== view.token) return false;
      view.msg.hidden = true;
      return true;
    } catch (e) {
      if (token !== view.token) return false;
      const open = opts && opts.openUrl ? ` <a href="${opts.openUrl}" target="_blank" rel="noopener">Otwórz w Dysku Google ↗</a>` : '';
      message(e.offline
        ? 'Brak internetu – tych nut nie otwierano jeszcze na tym urządzeniu. Otworzą się po połączeniu z siecią.'
        : `${e.message || 'Nie udało się pokazać nut.'}${open}`, true);
      return false;
    }
  }

  function showImage(blob, token) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.alt = 'Nuty';
      img.className = 'nv-img';
      img.onload = () => { if (token === view.token) view.doc.appendChild(img); resolve(); };
      img.onerror = () => reject(new Error('Ta przeglądarka nie umie pokazać tego pliku (np. zdjęcie HEIC).'));
      view.url = URL.createObjectURL(blob);
      img.src = view.url;
    });
  }

  async function showPdf(blob, token) {
    const lib = await loadPdfjs();
    const data = new Uint8Array(await blob.arrayBuffer());
    // isEvalSupported: false – bez wykonywania kodu z czcionek PDF (zalecenie bezpieczeństwa dla pdf.js 3.x)
    // jeden wątek pdf.js na cały czas pracy aplikacji – kolejne PDF-y otwierają się szybciej
    if (!worker) worker = new lib.PDFWorker();
    const pdf = await lib.getDocument({ data, isEvalSupported: false, worker }).promise;
    if (token !== view.token) { pdf.destroy(); return; }
    view.pdf = pdf;
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      if (token !== view.token) return;
      const vp = page.getViewport({ scale: 1 });
      const canvas = document.createElement('canvas');
      canvas.className = 'nv-page';
      canvas.style.aspectRatio = `${vp.width} / ${vp.height}`;
      view.doc.appendChild(canvas);
      const p = { canvas, page, w: vp.width, h: vp.height, scale: 0 };
      view.pages.push(p);
      await renderPage(p, token);
      if (n === 1) view.msg.hidden = true; // pierwsza strona widoczna – dalsze dorysowują się poniżej
    }
  }

  // rysuje stronę PDF w rozdzielczości pasującej do obecnej szerokości (ostro także po powiększeniu)
  async function renderPage(p, token) {
    const cssW = view.doc.clientWidth || baseWidth();
    let scale = (cssW * (window.devicePixelRatio || 1)) / p.w;
    if (p.w * p.h * scale * scale > MAX_PX) scale = Math.sqrt(MAX_PX / (p.w * p.h));
    if (Math.abs(scale - p.scale) / scale < 0.1) return; // już wystarczająco ostro
    const vp = p.page.getViewport({ scale });
    const c = document.createElement('canvas');
    c.width = Math.floor(vp.width);
    c.height = Math.floor(vp.height);
    if (p.task) p.task.cancel();
    p.task = p.page.render({ canvasContext: c.getContext('2d'), viewport: vp });
    try { await p.task.promise; } catch (e) { return; } finally { p.task = null; }
    if (token !== view.token) return;
    c.className = 'nv-page';
    c.style.aspectRatio = p.canvas.style.aspectRatio;
    p.canvas.replaceWith(c); // podmiana gotowego obrazu – bez mrugania białą stroną
    p.canvas = c;
    p.scale = scale;
  }
  let renderTimer = null;
  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => {
      const token = view.token;
      view.pages.reduce((prev, p) => prev.then(() => renderPage(p, token)), Promise.resolve());
    }, 250);
  }

  // ---------- powiększanie ----------
  // (cx, cy) = punkt w okienku, który ma zostać w miejscu (palce, kursor); domyślnie środek
  function setZoom(z, cx, cy) {
    const box = view.box;
    z = Math.min(MAX_Z, Math.max(MIN_Z, z));
    if (cx == null) { cx = box.clientWidth / 2; cy = box.clientHeight / 2; }
    const old = view.zoom;
    const x = (box.scrollLeft + cx) / old;
    const y = (box.scrollTop + cy) / old;
    view.zoom = z;
    layout(true);
    box.scrollLeft = x * z - cx;
    box.scrollTop = y * z - cy;
  }
  const zoomBy = (f, cx, cy) => setZoom(view.zoom * f, cx, cy);

  function gestures(box) {
    let pinch = null;
    let swipe = null;
    let lastTap = 0;
    const pt = (t) => { const r = box.getBoundingClientRect(); return { x: t.clientX - r.left, y: t.clientY - r.top }; };
    const dist = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    box.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        const [a, b] = e.touches;
        const m = pt({ clientX: (a.clientX + b.clientX) / 2, clientY: (a.clientY + b.clientY) / 2 });
        pinch = { d0: dist(a, b), z0: view.zoom, m };
        swipe = null;
      } else if (e.touches.length === 1) {
        const t = e.touches[0];
        swipe = { x: t.clientX, y: t.clientY, at: Date.now(), sl: box.scrollLeft };
      }
    }, { passive: true });
    box.addEventListener('touchmove', (e) => {
      if (pinch && e.touches.length === 2) {
        e.preventDefault();
        const [a, b] = e.touches;
        setZoom(pinch.z0 * dist(a, b) / pinch.d0, pinch.m.x, pinch.m.y);
      }
    }, { passive: false });
    box.addEventListener('touchend', (e) => {
      if (pinch) { if (e.touches.length < 2) pinch = null; return; }
      if (!swipe || e.changedTouches.length !== 1) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - swipe.x;
      const dy = t.clientY - swipe.y;
      const quick = Date.now() - swipe.at;
      // podwójne stuknięcie: powiększ / wróć do całej szerokości
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && quick < 300) {
        if (Date.now() - lastTap < 320) {
          const p = pt(t);
          setZoom(view.zoom > 1.2 ? 1 : 2.5, p.x, p.y);
          lastTap = 0;
        } else lastTap = Date.now();
      }
      // przesunięcie palcem w bok (bez powiększenia) = następna / poprzednia strona albo pieśń
      if (view.zoom <= 1.01 && view.onSwipe && Math.abs(dx) > 70 && Math.abs(dx) > 2 * Math.abs(dy) && quick < 800) {
        view.onSwipe(dx < 0 ? 1 : -1);
      }
      swipe = null;
    });
    // komputer: Ctrl + kółko myszy (albo gest na gładziku) = powiększanie
    box.addEventListener('wheel', (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const p = pt(e);
      zoomBy(Math.exp(-e.deltaY / 200), p.x, p.y);
    }, { passive: false });
  }

  function focus() { if (view) view.box.focus({ preventScroll: true }); }
  function reset() { if (view) clear(); }

  return { attach, show, prefetch, reset, focus, zoomBy: (f) => view && zoomBy(f), isZoomed: () => !!view && view.zoom > 1.01 };
})();
