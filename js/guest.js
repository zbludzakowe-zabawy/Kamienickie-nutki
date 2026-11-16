// Tryb chórzysty: bez logowania, PIN → lista śpiewników → lista pieśni → nuty na cały ekran.
window.Guest = (() => {
  'use strict';
  const cfg = window.KN_CONFIG;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const K = { mode: 'kn-mode', id: 'kn-guest-id', pin: 'kn-guest-pin', env: 'kn-guest-env', only: 'kn-guest-only' };
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
      <img src="icons/icon-192.png" alt="" width="72" height="72">
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

  function route() {
    if (!catalog) return;
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
    $('g-view').innerHTML = `<h2 class="g-h">Śpiewniki</h2>
      ${list.length ? `<div class="g-books">${list.map((b) => {
        const have = b.items.filter(hasNotes).length;
        return `<a class="g-book" href="#/s/${encodeURIComponent(b.id)}"><span class="g-book-ico" aria-hidden="true"></span>
          <span class="g-book-text"><strong>${esc(b.name)}</strong><span class="muted">${b.items.length} pieśni · nuty: ${have}</span></span><span class="chev">›</span></a>`;
      }).join('')}</div>` : '<p class="muted">Dyrygent nie udostępnił jeszcze żadnego śpiewnika.</p>'}
      <p class="muted small g-updated">Aktualizacja: ${new Date(catalog.at).toLocaleDateString('pl-PL')}</p>`;
    window.scrollTo(0, 0);
  }

  function renderBook(b) {
    document.title = b.name + ' – Kamienickie Nutki';
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const norm = (s) => (window.Catalog ? Catalog.norm(s) : String(s).toLowerCase());
    const nwords = words.map(norm);
    const rows = b.items.map((it, i) => ({ it, i })).filter(({ it }) => {
      if (onlyWithNotes && !hasNotes(it)) return false;
      if (!nwords.length) return true;
      const hay = norm(it.no + ' ' + it.title);
      return nwords.every((w) => hay.includes(w));
    });
    const have = b.items.filter(hasNotes).length;
    const mb = b.pdfSize ? ` (${(b.pdfSize / 1048576).toFixed(1)} MB)` : '';
    const keepScroll = $('g-list') && $('g-view').dataset.book === b.id;
    const y = window.scrollY;
    $('g-view').dataset.book = b.id;
    $('g-view').innerHTML = `<div class="g-bar"><a class="btn small" href="#/">‹ Śpiewniki</a></div>
      <h2 class="g-h">${esc(b.name)}</h2>
      <p class="muted small">${b.items.length} pieśni · z nutami: ${have}</p>
      ${b.pdf ? `<a class="btn primary g-pdf" href="https://drive.google.com/uc?export=download&id=${encodeURIComponent(b.pdf)}" target="_blank" rel="noopener">⬇ Pobierz PDF ze śpiewnikiem${mb}</a>` : ''}
      <div class="g-tools">
        <input type="search" id="g-q" placeholder="Szukaj (tytuł lub numer)…" value="${esc(query)}" autocomplete="off" aria-label="Szukaj pieśni">
        <label class="g-only"><input type="checkbox" id="g-only"${onlyWithNotes ? ' checked' : ''}> tylko z nutami</label>
      </div>
      <div class="g-list" id="g-list">${rows.map(({ it, i }) => (hasNotes(it)
        ? `<a class="g-song" href="#/s/${encodeURIComponent(b.id)}/${i}"><span class="g-no">${esc(it.no)}</span><span class="g-title">${esc(it.title)}</span><span class="g-note" aria-label="nuty">♪</span></a>`
        : `<div class="g-song off"><span class="g-no">${esc(it.no)}</span><span class="g-title">${esc(it.title)}</span><span class="g-none">brak nut</span></div>`)).join('')
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
    viewer = { b, i, f: viewer && viewer.b === b && viewer.i === i ? viewer.f : 0 };
    $('g-viewer').hidden = false;
    document.body.classList.add('g-viewing');
    $('g-vno').textContent = it.no ? it.no + '.' : '';
    $('g-vname').textContent = it.title;
    showFile();
    // poprzednia/następna pieśń z nutami
    const prev = findSong(b, i, -1);
    const next = findSong(b, i, 1);
    $('g-sprev').hidden = prev < 0;
    $('g-snext').hidden = next < 0;
    $('g-sprev').onclick = () => { location.replace(`#/s/${encodeURIComponent(b.id)}/${prev}`); };
    $('g-snext').onclick = () => { location.replace(`#/s/${encodeURIComponent(b.id)}/${next}`); };
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

  // ---------- zdarzenia ----------
  if (mode === 'guest') {
    $('g-close').addEventListener('click', () => {
      const m = location.hash.match(/^#\/s\/([^/]+)/);
      if (history.length > 1 && /\/\d+$/.test(location.hash)) history.back();
      else location.hash = m ? `#/s/${m[1]}` : '#/';
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
