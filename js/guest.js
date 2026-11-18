// Tryb chórzysty: bez logowania, PIN → lista śpiewników → lista pieśni → nuty na cały ekran.
window.Guest = (() => {
  'use strict';
  const cfg = window.KN_CONFIG;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const K = { mode: 'kn-mode', id: 'kn-guest-id', pin: 'kn-guest-pin', env: 'kn-guest-env', only: 'kn-guest-only', name: 'kn-guest-name' };
  const get = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const put = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* trudno */ } };

  let catalog = null;
  let catalogId = null;
  let pinMsg = '';
  let onlyWithNotes = get(K.only) === '1';
  let query = '';

  // tryb wybiera js/mode.js (zanim strona się narysuje)
  const mode = document.documentElement.dataset.mode;
  catalogId = get(K.id) || cfg.publicCatalogId || null;

  function enter(id) {
    if (id) put(K.id, id);
    put(K.mode, 'guest');
    location.hash = '#/';
    location.reload();
  }
  function leave() {
    put(K.mode, 'admin');
    history.replaceState(null, '', location.pathname);
    location.reload();
  }

  // ---------- dane ----------
  async function load() {
    const view = $('g-view');
    if (!catalogId) {
      view.innerHTML = `<section class="card g-card"><h2>Śpiewniki chóru</h2>
        <p>Otwórz link do śpiewników, który dostałeś od dyrygenta. Wystarczy go raz stuknąć – aplikacja zapamięta śpiewniki.</p></section>`;
      return;
    }
    view.innerHTML = '<p class="muted g-loading">Wczytywanie śpiewników…</p>';
    let env = null;
    try {
      const text = await Drive.publicText(catalogId);
      env = JSON.parse(text);
      put(K.env, JSON.stringify({ id: catalogId, env }));
    } catch (e) {
      try {
        const c = JSON.parse(get(K.env) || 'null');
        if (c && c.id === catalogId) env = c.env;
      } catch (e2) { /* brak */ }
      if (!env) {
        view.innerHTML = `<section class="card g-card"><h2>Nie udało się wczytać śpiewników</h2><p>${esc(navigator.onLine ? e.message : 'Brak internetu. Połącz się i spróbuj ponownie.')}</p>
          <button class="btn primary" id="g-retry">Spróbuj ponownie</button></section>`;
        $('g-retry').onclick = load;
        return;
      }
    }
    window.__knEnv = env;
    const pin = get(K.pin);
    if (pin) {
      catalog = await KnCrypto.decrypt(env, pin);
      if (catalog) return route();
      pinMsg = 'PIN się zmienił – wpisz nowy PIN od dyrygenta.';
      put(K.pin, null);
    }
    showPin();
  }

  function showPin() {
    $('g-view').innerHTML = `<section class="card g-card g-pin">
      <img src="icons/icon-192.png?v=2" alt="" width="72" height="72">
      <h2>Śpiewniki chóru</h2>
      <p class="muted">Wpisz PIN, który podał dyrygent.</p>
      <form id="g-pin-form" autocomplete="off">
        <input id="g-pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" aria-label="PIN" placeholder="PIN" autofocus>
        <button class="btn primary" type="submit">Wejdź</button>
      </form>
      <p class="g-err" id="g-pin-err">${esc(pinMsg)}</p></section>`;
    $('g-pin-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = $('g-pin').value.trim();
      if (!v) return;
      $('g-pin-err').textContent = 'Sprawdzanie…';
      const c = await KnCrypto.decrypt(window.__knEnv, v);
      if (!c) {
        $('g-pin-err').textContent = 'Zły PIN. Spróbuj jeszcze raz.';
        $('g-pin').select();
        return;
      }
      catalog = c;
      put(K.pin, v);
      pinMsg = '';
      route();
    });
    setTimeout(() => { const i = $('g-pin'); if (i) i.focus(); }, 50);
  }

  // ---------- widoki ----------
  const hasNotes = (it) => it.files && it.files.length > 0;
  const book = (id) => catalog && catalog.songbooks.find((b) => b.id === id);
  const programs = () => (catalog && catalog.programs) || [];
  const program = (id) => programs().find((p) => p.id === id);
  // program jako płaska lista pieśni (do przechodzenia ⏮ ⏭ w kolejności uroczystości)
  const flat = (pr) => ({
    id: pr.id,
    name: pr.name,
    kind: 'p',
    base: `#/p/${encodeURIComponent(pr.id)}`,
    items: pr.parts.flatMap((pt) => pt.items.map((it) => ({ ...it, part: pt.name }))),
  });
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const isPast = (pr) => !!pr.date && pr.date < today();
  const staleNote = (x) => (x.pdf && x.stale
    ? `<p class="small g-stale">⚠ PDF może być nieaktualny${x.pdfAt ? ` (stan na ${new Date(x.pdfAt).toLocaleDateString('pl-PL')})` : ''} – dyrygent wprowadza zmiany. Lista poniżej jest aktualna.</p>` : '');
  const fmtDate = (s) => {
    if (!s) return '';
    const [y, mo, d] = s.split('-').map(Number);
    return new Date(y, mo - 1, d).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  function route() {
    if (!catalog) return;
    const mp = location.hash.match(/^#\/p\/([^/]+)(?:\/(\d+))?/);
    const pr = mp && program(decodeURIComponent(mp[1]));
    if (pr) {
      const fb = flat(pr);
      renderProgram(pr, fb);
      if (mp[2] != null && fb.items[Number(mp[2])]) openViewer(fb, Number(mp[2]));
      else closeViewer();
      return;
    }
    const m = location.hash.match(/^#\/s\/([^/]+)(?:\/(\d+))?/);
    const b = m && book(decodeURIComponent(m[1]));
    if (!b) {
      closeViewer();
      return renderBooks();
    }
    renderBook(b);
    if (m[2] != null && b.items[Number(m[2])]) openViewer(b, Number(m[2]));
    else closeViewer();
  }

  function renderBooks() {
    document.title = 'Kamienickie Nutki';
    const list = catalog.songbooks;
    const next = programs().filter((p) => !isPast(p)).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
    const past = programs().filter(isPast).sort((a, b) => b.date.localeCompare(a.date));
    const progCard = (p, first) => {
      const songs = p.parts.flatMap((pt) => pt.items);
      return `<a class="g-book g-prog${first ? ' next' : ''}" href="#/p/${encodeURIComponent(p.id)}"><span class="g-prog-ico" aria-hidden="true">✝</span>
        <span class="g-book-text">${first ? '<span class="g-next">Najbliższa uroczystość</span>' : ''}<strong>${esc(p.name)}</strong>
        <span class="muted">${p.date ? esc(fmtDate(p.date)) + ' · ' : ''}${songs.length} pieśni</span></span><span class="chev">›</span></a>`;
    };
    $('g-view').innerHTML = `${next.length ? `<h2 class="g-h">Uroczystości</h2><div class="g-books">${next.map((p, i) => progCard(p, i === 0)).join('')}</div>` : ''}
      <h2 class="g-h">Śpiewniki</h2>
      ${list.length ? `<div class="g-books">${list.map((b) => {
        const have = b.items.filter(hasNotes).length;
        return `<a class="g-book" href="#/s/${encodeURIComponent(b.id)}"><span class="g-book-ico" aria-hidden="true"></span>
          <span class="g-book-text"><strong>${esc(b.name)}${b.code ? ` <span class="muted">[${esc(b.code)}]</span>` : ''}</strong><span class="muted">${b.items.length} pieśni · nuty: ${have}${b.stale ? ' · PDF może być nieaktualny' : ''}</span></span><span class="chev">›</span></a>`;
      }).join('')}</div>` : '<p class="muted">Dyrygent nie udostępnił jeszcze żadnego śpiewnika.</p>'}
      ${past.length ? `<h2 class="g-h">Archiwum uroczystości</h2><div class="g-books">${past.map((p) => progCard(p, false)).join('')}</div>` : ''}
      <p class="muted small g-updated">Aktualizacja: ${new Date(catalog.at).toLocaleDateString('pl-PL')}</p>`;
    window.scrollTo(0, 0);
  }

  function renderProgram(pr, fb) {
    document.title = pr.name + ' – Kamienickie Nutki';
    const mb = pr.pdfSize ? ` (${(pr.pdfSize / 1048576).toFixed(1)} MB)` : '';
    let k = 0;
    const keep = $('g-view').dataset.book === pr.id;
    const y = window.scrollY;
    $('g-view').dataset.book = pr.id;
    $('g-view').innerHTML = `<div class="g-bar"><a class="btn small" href="#/">‹ Wszystko</a></div>
      <h2 class="g-h">${esc(pr.name)}</h2>
      <p class="muted small">${pr.date ? esc(fmtDate(pr.date)) : 'Program uroczystości'}${isPast(pr) ? ' · archiwum' : ''}</p>
      ${pr.pdf ? `<a class="btn primary g-pdf" href="https://drive.google.com/uc?export=download&id=${encodeURIComponent(pr.pdf)}" target="_blank" rel="noopener">⬇ Pobierz PDF z programem${mb}</a>${staleNote(pr)}` : ''}
      <div class="g-list g-program">${pr.parts.filter((pt) => pt.items.length).map((pt) => `<div class="g-part">${esc(pt.name)}</div>${pt.items.map((it) => {
        const i = k++;
        const note = it.note ? `<span class="g-pnote">${esc(it.note)}</span>` : '';
        return hasNotes(it)
          ? `<a class="g-song" href="${fb.base}/${i}"><span class="g-title">${esc(it.title)}${note}</span><span class="g-note" aria-label="nuty">♪</span></a>`
          : `<div class="g-song off"><span class="g-title">${esc(it.title)}${note}</span><span class="g-none">bez nut</span></div>`;
      }).join('')}`).join('') || '<p class="muted empty">Program jest jeszcze pusty.</p>'}</div>`;
    if (keep) window.scrollTo(0, y);
    else window.scrollTo(0, 0);
  }

  const altOf = (it) => (it.alt && it.alt.length ? `<span class="g-alt">też: ${esc(it.alt.join('; '))}</span>` : '');

  function renderBook(b) {
    document.title = b.name + ' – Kamienickie Nutki';
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const norm = (s) => (window.Catalog ? Catalog.norm(s) : String(s).toLowerCase());
    const nwords = words.map(norm);
    const rows = b.items.map((it, i) => ({ it, i })).filter(({ it }) => {
      if (onlyWithNotes && !hasNotes(it)) return false;
      if (!nwords.length) return true;
      const hay = norm(it.no + ' ' + it.title + ' ' + (it.alt || []).join(' '));
      return nwords.every((w) => hay.includes(w));
    });
    const have = b.items.filter(hasNotes).length;
    const mb = b.pdfSize ? ` (${(b.pdfSize / 1048576).toFixed(1)} MB)` : '';
    const keepScroll = $('g-list') && $('g-view').dataset.book === b.id;
    const y = window.scrollY;
    $('g-view').dataset.book = b.id;
    $('g-view').innerHTML = `<div class="g-bar"><a class="btn small" href="#/">‹ Śpiewniki</a></div>
      <h2 class="g-h">${esc(b.name)}</h2>
      <p class="muted small">${b.items.length} pieśni · z nutami: ${have}${b.auto && b.at ? ` · lista z dnia ${new Date(b.at).toLocaleDateString('pl-PL')}` : ''}</p>
      ${b.auto ? '<p class="muted small">Nuty, których nie ma w pozostałych śpiewnikach, ułożone alfabetycznie.</p>' : ''}
      ${b.pdf ? `<a class="btn primary g-pdf" href="https://drive.google.com/uc?export=download&id=${encodeURIComponent(b.pdf)}" target="_blank" rel="noopener">⬇ Pobierz PDF ze śpiewnikiem${mb}${b.auto && b.pdfAt ? ` – stan na ${new Date(b.pdfAt).toLocaleDateString('pl-PL')}` : ''}</a>${staleNote(b)}` : ''}
      <div class="g-tools">
        <input type="search" id="g-q" placeholder="Szukaj (tytuł lub numer)…" value="${esc(query)}" autocomplete="off" aria-label="Szukaj pieśni">
        <label class="g-only"><input type="checkbox" id="g-only"${onlyWithNotes ? ' checked' : ''}> tylko z nutami</label>
      </div>
      <div class="g-list" id="g-list">${rows.map(({ it, i }) => (hasNotes(it)
        ? `<a class="g-song" href="#/s/${encodeURIComponent(b.id)}/${i}"><span class="g-no">${esc(it.no)}</span><span class="g-title">${esc(it.title)}${altOf(it)}</span><span class="g-note" aria-label="nuty">♪</span></a>`
        : `<div class="g-song off"><span class="g-no">${esc(it.no)}</span><span class="g-title">${esc(it.title)}${altOf(it)}</span><span class="g-none">brak nut</span></div>`)).join('')
        || '<p class="muted empty">Nic nie pasuje.</p>'}</div>`;
    let t = null;
    $('g-q').addEventListener('input', (e) => {
      clearTimeout(t);
      t = setTimeout(() => {
        query = e.target.value;
        renderBook(b);
        const q = $('g-q');
        q.focus();
        q.setSelectionRange(q.value.length, q.value.length);
      }, 150);
    });
    $('g-only').addEventListener('change', (e) => { onlyWithNotes = e.target.checked; put(K.only, onlyWithNotes ? '1' : '0'); renderBook(b); });
    if (keepScroll) window.scrollTo(0, y);
  }

  // ---------- nuty na cały ekran ----------
  let viewer = null; // { b, i, f }
  function openViewer(b, i) {
    const it = b.items[i];
    if (!hasNotes(it)) return;
    const key = `${b.id}:${i}`;
    viewer = { b, i, key, f: viewer && viewer.key === key ? viewer.f : 0 };
    $('g-viewer').hidden = false;
    document.body.classList.add('g-viewing');
    $('g-vno').textContent = it.part ? it.part + ' ·' : it.no ? it.no + '.' : '';
    $('g-vname').textContent = it.note ? `${it.title} – ${it.note}` : it.title;
    const base = b.base || `#/s/${encodeURIComponent(b.id)}`;
    showFile();
    $('g-report').hidden = !(catalog && catalog.report);
    // poprzednia/następna pieśń z nutami
    const prev = findSong(b, i, -1);
    const next = findSong(b, i, 1);
    $('g-sprev').hidden = prev < 0;
    $('g-snext').hidden = next < 0;
    $('g-sprev').onclick = () => { location.replace(`${base}/${prev}`); };
    $('g-snext').onclick = () => { location.replace(`${base}/${next}`); };
  }
  function findSong(b, i, dir) {
    for (let k = i + dir; k >= 0 && k < b.items.length; k += dir) if (hasNotes(b.items[k])) return k;
    return -1;
  }
  function showFile() {
    const it = viewer.b.items[viewer.i];
    const id = it.files[viewer.f];
    const multi = it.files.length > 1;
    $('g-vnav').hidden = !multi;
    $('g-vpos').textContent = `${viewer.f + 1} / ${it.files.length}`;
    $('g-prev').disabled = viewer.f === 0;
    $('g-next').disabled = viewer.f === it.files.length - 1;
    $('g-offline').hidden = navigator.onLine;
    const src = `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview`;
    // nowa ramka dla każdego pliku – zmiana adresu istniejącej dopisywałaby się do historii („wstecz” nie zamykałoby nut)
    const old = $('g-frame');
    if (old.getAttribute('src') !== src) {
      const f = document.createElement('iframe');
      f.id = 'g-frame';
      f.title = 'Nuty';
      f.allow = 'fullscreen';
      f.src = src;
      old.replaceWith(f);
    }
    $('g-open').href = `https://drive.google.com/file/d/${encodeURIComponent(id)}/view`;
  }
  function closeViewer() {
    if ($('g-viewer').hidden) return;
    $('g-viewer').hidden = true;
    document.body.classList.remove('g-viewing');
    const f = document.createElement('iframe');
    f.id = 'g-frame';
    f.title = 'Nuty';
    $('g-frame').replaceWith(f);
    viewer = null;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
  }

  // ---------- zgłoszenie problemu (Formularz Google dyrygenta, bez logowania) ----------
  const REASONS = ['nie te nuty', 'trzeba obrócić', 'nieczytelne', 'brakuje strony', 'złe miejsce w spisie', 'inne'];
  let reportFor = null;
  function openReport() {
    if (!viewer || !catalog || !catalog.report) return;
    const b = viewer.b;
    const it = b.items[viewer.i];
    reportFor = { b, i: viewer.i, it, page: viewer.f + 1 };
    $('gr-song').textContent = (it.no ? it.no + '. ' : '') + it.title;
    $('gr-src').textContent = b.kind === 'p' ? `Uroczystość „${b.name}”${it.part ? ' · ' + it.part : ''}` : `Śpiewnik „${b.name}”`;
    $('gr-reasons').innerHTML = REASONS.map((r) => `<label><input type="checkbox" value="${esc(r)}">${esc(r)}</label>`).join('');
    $('gr-note').value = '';
    $('gr-name').value = get(K.name) || '';
    $('gr-msg').textContent = '';
    $('gr-msg').className = 'small';
    $('gr-send').disabled = false;
    $('g-report-dlg').showModal();
  }
  async function sendReport(e) {
    e.preventDefault();
    const x = reportFor;
    if (!x) return;
    const reasons = [...$('gr-reasons').querySelectorAll('input:checked')].map((c) => c.value);
    const note = $('gr-note').value.trim();
    if (!reasons.length && !note) { $('gr-msg').textContent = 'Zaznacz, co jest nie tak, albo dopisz komentarz.'; $('gr-msg').className = 'small warn-text'; return; }
    const name = $('gr-name').value.trim();
    put(K.name, name || null);
    const payload = {
      v: 1, at: new Date().toISOString(), kind: x.b.kind === 'p' ? 'p' : 's', book: x.b.id, bookName: x.b.name,
      i: x.i, no: x.it.no || '', part: x.it.part || '', title: x.it.title, files: x.it.files, page: x.page, reasons, note, name,
    };
    $('gr-send').disabled = true;
    $('gr-msg').textContent = 'Wysyłanie…';
    $('gr-msg').className = 'small';
    try {
      await fetch(catalog.report.url, { method: 'POST', mode: 'no-cors', body: new URLSearchParams({ [catalog.report.entry]: JSON.stringify(payload) }) });
      $('gr-msg').textContent = '✓ Dziękujemy! Dyrygent zobaczy zgłoszenie.';
      $('gr-msg').className = 'small ok-text';
      setTimeout(() => $('g-report-dlg').close(), 1400);
    } catch (err) {
      $('gr-send').disabled = false;
      $('gr-msg').textContent = navigator.onLine ? 'Nie udało się wysłać – spróbuj za chwilę.' : 'Brak internetu – wyślij, gdy połączysz się z siecią.';
      $('gr-msg').className = 'small warn-text';
    }
  }

  // ---------- zdarzenia ----------
  if (mode === 'guest') {
    $('g-report').addEventListener('click', openReport);
    $('gr-form').addEventListener('submit', sendReport);
    $('gr-cancel').addEventListener('click', () => $('g-report-dlg').close());
    $('g-close').addEventListener('click', () => {
      const m = location.hash.match(/^#\/([sp])\/([^/]+)/);
      if (history.length > 1 && /\/\d+$/.test(location.hash)) history.back();
      else location.hash = m ? `#/${m[1]}/${m[2]}` : '#/';
    });
    $('g-prev').addEventListener('click', () => { if (viewer && viewer.f > 0) { viewer.f--; showFile(); } });
    $('g-next').addEventListener('click', () => {
      if (viewer && viewer.f < viewer.b.items[viewer.i].files.length - 1) { viewer.f++; showFile(); }
    });
    $('g-full').hidden = !document.fullscreenEnabled;
    $('g-full').addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
      else $('g-viewer').requestFullscreen().catch(() => undefined);
    });
    $('g-admin').addEventListener('click', leave);
    window.addEventListener('hashchange', route);
    window.addEventListener('online', () => { if (viewer) showFile(); });
    window.addEventListener('offline', () => { if (viewer) showFile(); });
    $('guest').hidden = false;
    load();
  }

  return { enter, leave, mode };
})();
