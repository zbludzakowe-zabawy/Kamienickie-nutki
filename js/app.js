// Kamienickie Nutki – etap 1: połączenie z Dyskiem, wybór folderów, skanowanie, własne nazwy.
(() => {
  'use strict';
  const cfg = window.KN_CONFIG;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const plural = (n, one, few, many) => {
    const t = n % 10;
    const h = n % 100;
    return n === 1 ? one : t >= 2 && t <= 4 && (h < 12 || h > 14) ? few : many;
  };
  const fmtDate = (iso) => {
    try {
      return new Date(iso).toLocaleString('pl-PL', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return iso; }
  };
  const stripExt = (name) => String(name).replace(/\.[a-z0-9]{2,5}$/i, '');

  // ---------- stan ----------
  const emptyData = () => ({ app: 'KamienickieNutki', v: 1, roots: [], nodes: {}, meta: {}, songbooks: [], scannedAt: null, updatedAt: 0 });
  const normalize = (d) => {
    const e = emptyData();
    if (!d || typeof d !== 'object') return e;
    return {
      ...e,
      ...d,
      roots: Array.isArray(d.roots) ? d.roots : [],
      nodes: d.nodes && typeof d.nodes === 'object' ? d.nodes : {},
      meta: d.meta && typeof d.meta === 'object' ? d.meta : {},
      songbooks: Array.isArray(d.songbooks) ? d.songbooks : [],
    };
  };

  let data = emptyData();
  let sync = { fileId: null, dirty: false, syncedAt: null };
  let idx = Catalog.buildIndex({});
  let user = null;
  const ui = { expanded: new Set(), expandedLoaded: false, query: '', filter: 'all', editing: null, scanning: false };
  let syncTimer = null;
  let syncing = false;
  let syncError = false;

  const EXP_KEY = 'kn-expanded';
  function loadExpanded() {
    try {
      const v = JSON.parse(localStorage.getItem(EXP_KEY) || 'null');
      if (Array.isArray(v)) { ui.expanded = new Set(v); ui.expandedLoaded = true; }
    } catch (e) { /* brak */ }
  }
  function saveExpanded() {
    try { localStorage.setItem(EXP_KEY, JSON.stringify([...ui.expanded])); } catch (e) { /* trudno */ }
  }

  // „nowe” = dodane podczas ostatniego skanowania lub odświeżania folderu
  const isNewNode = (n) => !!n.added && n.added === (data.newAt || data.scannedAt);

  const rebuild = () => {
    idx = Catalog.buildIndex(data.nodes);
    // na nowym urządzeniu foldery główne są od razu rozwinięte
    if (!ui.expandedLoaded && idx.roots.length) {
      idx.roots.forEach((r) => ui.expanded.add(r.id));
      ui.expandedLoaded = true;
      saveExpanded();
    }
  };

  function persist() {
    Store.set('data', data);
    Store.set('sync', sync);
  }

  function changed() {
    data.updatedAt = Date.now();
    sync.dirty = true;
    persist();
    scheduleSync();
    renderSync();
  }

  // ---------- zapis na Dysku ----------
  function scheduleSync(delay = 1500) {
    clearTimeout(syncTimer);
    if (Drive.isConnected()) syncTimer = setTimeout(pushNow, delay);
  }

  async function pushNow() {
    if (syncing) return scheduleSync();
    if (!sync.dirty || !Drive.isConnected()) return;
    syncing = true;
    syncError = false;
    renderSync();
    const snapshot = data.updatedAt;
    try {
      const text = JSON.stringify(data);
      let saved = false;
      if (sync.fileId) {
        try {
          await Drive.updateJson(sync.fileId, text);
          saved = true;
        } catch (e) {
          if (e.status !== 404) throw e;
        }
      }
      if (!saved) {
        const f = await Drive.createJson(cfg.dataFileName, text, await Drive.ensureAppFolder());
        sync.fileId = f.id;
      }
      if (data.updatedAt === snapshot) sync.dirty = false;
      sync.syncedAt = Date.now();
      Store.set('sync', sync);
    } catch (e) {
      syncError = true;
      if (!(e instanceof Drive.AuthError)) console.warn(e);
    } finally {
      syncing = false;
      renderSync();
      if (sync.dirty && !syncError) scheduleSync();
    }
  }

  async function onConnected() {
    try {
      const a = await Drive.about();
      user = a.user || null;
      if (user && user.emailAddress) Drive.rememberEmail(user.emailAddress);
      renderAccount();
      const f = await Drive.findDataFile();
      if (f) {
        const remote = normalize(await Drive.readJson(f.id));
        sync.fileId = f.id;
        // plik z danymi zawsze w folderze aplikacji (starsze wersje zapisywały go w „Mój dysk”)
        Drive.ensureAppFolder()
          .then((fid) => ((f.parents || []).includes(fid) ? null : Drive.moveInto(f.id, fid, f.parents)))
          .catch((e) => console.warn('Nie udało się przenieść pliku z danymi', e));
        if ((remote.updatedAt || 0) > (data.updatedAt || 0)) {
          data = remote;
          sync.dirty = false;
          rebuild();
          renderAll();
          toast('Wczytano Twoje dane z Dysku.');
        } else if ((data.updatedAt || 0) > (remote.updatedAt || 0)) {
          sync.dirty = true;
        }
      } else {
        sync.fileId = null;
        if (data.updatedAt) sync.dirty = true;
      }
      persist();
      renderSync();
      scheduleSync(300);
    } catch (e) {
      handleError(e);
    }
  }

  async function ensureConnected() {
    if (Drive.isConnected()) return true;
    try {
      await Drive.connect();
      return true;
    } catch (e) {
      toast(e.message, true);
      return false;
    }
  }

  function handleError(e) {
    if (e instanceof Drive.AuthError) toast('Połączenie z Dyskiem wygasło – kliknij „Połącz z Dyskiem”.', true);
    else toast(e && e.message ? e.message : String(e), true);
    console.warn(e);
  }

  // ---------- komunikaty ----------
  let toastTimer = null;
  function toast(msg, isError) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.toggle('error', !!isError);
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, isError ? 7000 : 3500);
  }

  // ---------- konto i zapis ----------
  function renderAccount() {
    const c = Drive.isConnected();
    $('btn-connect').hidden = c;
    $('account').hidden = !c;
    $('who').textContent = (user && (user.emailAddress || user.displayName)) || 'Połączono';
  }

  function renderSync() {
    const el = $('sync');
    let text = '';
    let cls = '';
    if (data.updatedAt) {
      if (syncing) { text = 'Zapisywanie…'; cls = 'busy'; }
      else if (!sync.dirty) { text = 'Zapisano na Dysku'; cls = 'ok'; }
      else if (!Drive.isConnected()) { text = 'Zapisano w urządzeniu'; cls = 'warn'; }
      else if (syncError) { text = 'Błąd zapisu – ponowię'; cls = 'warn'; }
      else { text = 'Czeka na zapis…'; cls = 'busy'; }
    }
    el.textContent = text;
    el.className = 'sync ' + cls;
    el.hidden = !text;
    el.title = cls === 'warn' && !Drive.isConnected() ? 'Zmiany są w tym urządzeniu. Połącz z Dyskiem, żeby je tam zapisać.' : '';
  }

  // ---------- foldery ----------
  function renderFolders() {
    const list = $('root-list');
    list.innerHTML = data.roots.length
      ? data.roots.map((r) => `<li><span class="fico" aria-hidden="true"></span><span class="root-name">${esc(r.name)}</span>
          <button class="icon-btn" data-refresh="${esc(r.id)}" title="Odśwież tylko ten folder" aria-label="Odśwież folder ${esc(r.name)}"${ui.scanning || !data.scannedAt ? ' disabled' : ''}>↻</button>
          <button class="icon-btn" data-rm="${esc(r.id)}" title="Usuń z listy" aria-label="Usuń folder ${esc(r.name)} z listy"${ui.scanning ? ' disabled' : ''}>✕</button></li>`).join('')
      : '<li class="muted">Nie wybrano jeszcze żadnego folderu.</li>';
    $('btn-scan').disabled = ui.scanning || !data.roots.length;
    $('btn-add-folder').disabled = ui.scanning;
    if (!ui.scanning) {
      const total = Object.values(data.nodes).filter((n) => !n.folder).length;
      const fresh = data.scannedAt ? Object.values(data.nodes).filter((n) => !n.folder && isNewNode(n)).length : 0;
      $('scan-info').textContent = data.scannedAt
        ? `Ostatnie skanowanie: ${fmtDate(data.scannedAt)} · ${total} ${plural(total, 'plik', 'pliki', 'plików')} z nutami` +
          (fresh ? ` · ${fresh} ${plural(fresh, 'nowy', 'nowe', 'nowych')}` : '')
        : data.roots.length ? 'Kliknij „Skanuj Dysk”, żeby wyszukać nuty.' : '';
    }
    $('welcome').hidden = data.roots.length > 0;
  }

  async function doScan() {
    if (!data.roots.length) return toast('Najpierw dodaj folder z nutami.');
    if (!(await ensureConnected())) return;
    ui.scanning = true;
    renderFolders();
    $('scan-info').textContent = 'Skanowanie…';
    try {
      const res = await Catalog.scan(data.roots, data.nodes, (p) => {
        $('scan-info').textContent = `Skanowanie… ${p.folders} ${plural(p.folders, 'folder', 'foldery', 'folderów')}, ${p.files} ${plural(p.files, 'plik', 'pliki', 'plików')} z nutami`;
      });
      data.nodes = res.nodes;
      data.scannedAt = res.scannedAt;
      data.newAt = res.scannedAt;
      rebuild();
      if (window.Songs) Songs.rematchAll(true);
      changed();
      toast(`Gotowe: ${res.files} ${plural(res.files, 'plik', 'pliki', 'plików')} z nutami.`);
    } catch (e) {
      handleError(e);
    } finally {
      ui.scanning = false;
      renderAll();
    }
  }

  // Odświeża jeden folder (np. po dodaniu nut na Dysku) bez skanowania wszystkiego.
  async function refreshFolder(id) {
    if (ui.scanning) return;
    const r = data.roots.find((x) => x.id === id);
    const node = data.nodes[id] || (r && { id, name: r.name, folder: true, parent: null });
    if (!node || !node.folder) return;
    if (!(await ensureConnected())) return;
    ui.scanning = true;
    ui.refreshing = id;
    renderFolders();
    renderTree();
    $('scan-info').textContent = `Odświeżanie „${node.name}”…`;
    try {
      const res = await Catalog.rescanFolder(data.nodes, node, (p) => {
        $('scan-info').textContent = `Odświeżanie „${node.name}”… ${p.files} ${plural(p.files, 'plik', 'pliki', 'plików')} z nutami`;
      });
      data.nodes = res.nodes;
      if (!data.nodes[id] && r) data.nodes[id] = { id, name: r.name, folder: true, parent: null };
      data.newAt = res.at;
      rebuild();
      if (window.Songs) Songs.rematchAll(true);
      changed();
      toast(`Odświeżono „${node.name}”: ${res.files} ${plural(res.files, 'plik', 'pliki', 'plików')} z nutami` +
        `, nowe: ${res.added}` + (res.removed ? `, usunięte z Dysku: ${res.removed}` : '') + '.');
    } catch (e) {
      handleError(e);
    } finally {
      ui.scanning = false;
      ui.refreshing = null;
      renderAll();
    }
  }

  function removeRoot(id) {
    const r = data.roots.find((x) => x.id === id);
    if (!r) return;
    if (!confirm(`Usunąć folder „${r.name}” z listy?\n\nPliki na Dysku zostaną nietknięte, a nadane nazwy aplikacja zapamięta.`)) return;
    data.roots = data.roots.filter((x) => x.id !== id);
    data.nodes = Catalog.keepUnder(data.nodes, data.roots.map((x) => x.id));
    rebuild();
    changed();
    renderAll();
  }

  // ---------- wybór folderu ----------
  let pickStack = [];
  let pickMode = 'folder'; // 'folder' – folder z nutami, 'doc' – plik ze spisem pieśni
  let pickDoc = null;
  async function openPicker(mode = 'folder', onDoc = null) {
    if (!(await ensureConnected())) return;
    pickMode = mode === 'doc' ? 'doc' : 'folder';
    pickDoc = onDoc;
    pickStack = [{ id: 'top', name: 'Dysk Google' }];
    $('picker-title').textContent = pickMode === 'doc' ? 'Wybierz plik ze spisem pieśni' : 'Wybierz folder z nutami';
    $('btn-pick').hidden = pickMode === 'doc';
    $('picker').showModal();
    loadPicker();
  }

  async function loadPicker() {
    const cur = pickStack[pickStack.length - 1];
    $('crumbs').innerHTML = pickStack.map((p, i) => (i < pickStack.length - 1
      ? `<button type="button" class="crumb" data-depth="${i}">${esc(p.name)}</button><span class="sep">›</span>`
      : `<span class="crumb current">${esc(p.name)}</span>`)).join('');
    const list = $('picker-list');
    list.innerHTML = '<li class="muted">Wczytywanie…</li>';
    $('btn-pick').disabled = cur.id === 'top' || cur.id === 'shared';
    let items;
    try {
      if (cur.id === 'top') {
        const drives = await Drive.listSharedDrives();
        items = [{ id: 'root', name: 'Mój dysk' }, { id: 'shared', name: 'Udostępnione dla mnie' }, ...drives.map((d) => ({ id: d.id, name: d.name }))];
      } else if (pickMode === 'doc') {
        const r = await Drive.listFoldersAndDocs(cur.id);
        items = [...r.folders, ...r.docs.map((d) => ({ ...d, doc: true }))];
      } else {
        items = await Drive.listFolders(cur.id);
      }
    } catch (e) {
      handleError(e);
      list.innerHTML = '';
      return;
    }
    if (pickStack[pickStack.length - 1] !== cur) return; // użytkownik przeszedł gdzie indziej
    list.innerHTML = items.length
      ? items.map((f) => (f.doc
        ? `<li><button type="button" class="pick-item pick-doc" data-id="${esc(f.id)}" data-name="${esc(f.name)}" data-mime="${esc(f.mimeType)}"><span class="badge doc">DOC</span><span>${esc(f.name)}</span><span class="chev">Wybierz</span></button></li>`
        : `<li><button type="button" class="pick-item" data-id="${esc(f.id)}" data-name="${esc(f.name)}"><span class="fico" aria-hidden="true"></span><span>${esc(f.name)}</span><span class="chev">›</span></button></li>`)).join('')
      : `<li class="muted">${pickMode === 'doc' ? 'Brak podfolderów i plików spisu (.odt, .docx, .txt, Dokument Google).' : 'Brak podfolderów.'}</li>`;
  }

  function pickCurrent() {
    const cur = pickStack[pickStack.length - 1];
    if (cur.id === 'top' || cur.id === 'shared') return;
    $('picker').close();
    if (data.roots.some((r) => r.id === cur.id)) return toast('Ten folder już jest na liście.');
    data.roots.push({ id: cur.id, name: cur.name });
    ui.expanded.add(cur.id);
    saveExpanded();
    changed();
    renderFolders();
    doScan();
  }

  // ---------- drzewo nut ----------
  function renderTree() {
    const hasFiles = Object.keys(data.nodes).length > 0;
    $('files-card').hidden = !hasFiles;
    if (!hasFiles) return;

    const words = Catalog.norm(ui.query).split(' ').filter(Boolean);
    const f = ui.filter;
    const filtering = words.length > 0 || f !== 'all';
    const isNew = isNewNode;
    const match = (n) => {
      const m = data.meta[n.id];
      const title = m && m.title;
      if (f === 'named' && !title) return false;
      if (f === 'unnamed' && title) return false;
      if (f === 'new' && !isNew(n)) return false;
      if (words.length) {
        const hay = Catalog.norm(n.name + ' ' + (title || ''));
        return words.every((w) => hay.includes(w));
      }
      return true;
    };

    const visible = {};
    const walk = (n) => {
      if (!n.folder) return match(n) ? 1 : 0;
      let c = 0;
      for (const ch of idx.children[n.id] || []) c += walk(ch);
      visible[n.id] = c;
      return c;
    };
    let shown = 0;
    idx.roots.forEach((r) => { shown += walk(r); });

    const fileRow = (n, d) => {
      const m = data.meta[n.id];
      const title = m && m.title;
      const badge = `<span class="badge ${n.kind}">${n.kind === 'pdf' ? 'PDF' : 'IMG'}</span>`;
      if (ui.editing === n.id) {
        return `<div class="row file editing" data-id="${esc(n.id)}" style="--d:${d}">${badge}
          <div class="names"><input class="name-input" type="text" value="${esc(title || '')}" placeholder="${esc(stripExt(n.name))}" maxlength="200" aria-label="Własna nazwa dla ${esc(n.name)}" enterkeyhint="done">
          <span class="orig">${esc(n.name)}</span></div>
          <button class="act" data-act="save" title="Zapisz" aria-label="Zapisz nazwę">✓</button></div>`;
      }
      return `<div class="row file" data-id="${esc(n.id)}" style="--d:${d}">${badge}
        <div class="names" data-act="edit"><span class="title${title ? '' : ' plain'}">${esc(title || n.name)}</span>${title ? `<span class="orig">${esc(n.name)}</span>` : ''}${isNew(n) ? '<span class="new">nowy</span>' : ''}</div>
        <button class="act" data-act="edit" title="Nadaj własną nazwę" aria-label="Nadaj własną nazwę">✎</button>
        <a class="act" href="https://drive.google.com/file/d/${encodeURIComponent(n.id)}/view" target="_blank" rel="noopener" title="Otwórz na Dysku" aria-label="Otwórz na Dysku">↗</a></div>`;
    };

    const node = (n, d) => {
      if (!n.folder) return filtering && !match(n) ? '' : fileRow(n, d);
      if (filtering && !visible[n.id]) return '';
      const open = filtering || ui.expanded.has(n.id);
      const cnt = filtering ? visible[n.id] : idx.counts[n.id] || 0;
      let s = `<div class="row folder${open ? ' open' : ''}" data-id="${esc(n.id)}" style="--d:${d}" role="button" tabindex="0" aria-expanded="${open}">
        <span class="tw" aria-hidden="true"></span><span class="fico" aria-hidden="true"></span><span class="fname">${esc(n.name)}</span><span class="cnt">${cnt}</span>
        <button class="act refresh${ui.refreshing === n.id ? ' spin' : ''}" data-refresh="${esc(n.id)}" title="Odśwież tylko ten folder" aria-label="Odśwież folder ${esc(n.name)}"${ui.scanning ? ' disabled' : ''}>↻</button></div>`;
      if (open) s += (idx.children[n.id] || []).map((ch) => node(ch, d + 1)).join('');
      return s;
    };

    $('tree').innerHTML = shown || !filtering
      ? idx.roots.map((r) => node(r, 0)).join('')
      : '<p class="muted empty">Nic nie pasuje do wyszukiwania.</p>';

    const total = Object.values(data.nodes).filter((n) => !n.folder).length;
    const named = Object.values(data.nodes).filter((n) => !n.folder && data.meta[n.id] && data.meta[n.id].title).length;
    $('files-summary').textContent = filtering
      ? `${shown} z ${total}`
      : `${total} ${plural(total, 'plik', 'pliki', 'plików')} · ${named} z własną nazwą`;
    $('tree').classList.toggle('filtering', filtering);

    if (ui.editing) {
      const inp = $('tree').querySelector('.name-input');
      if (inp) { inp.focus(); inp.select(); }
    }
  }

  let committing = false;
  function commitEdit(id, value) {
    if (committing) return;
    committing = true;
    const v = String(value || '').trim().replace(/\s+/g, ' ');
    const m = data.meta[id] || {};
    if ((m.title || '') !== v) {
      if (v) data.meta[id] = { ...m, title: v };
      else {
        delete m.title;
        if (Object.keys(m).length) data.meta[id] = m;
        else delete data.meta[id];
      }
      changed();
    }
    ui.editing = null;
    renderTree();
    committing = false;
  }

  function startEdit(id) {
    if (ui.editing && ui.editing !== id) {
      const inp = $('tree').querySelector('.name-input');
      if (inp) commitEdit(ui.editing, inp.value);
    }
    ui.editing = id;
    renderTree();
  }

  function renderAll() {
    renderAccount();
    renderSync();
    renderFolders();
    renderTree();
    if (window.Songs) Songs.render();
  }

  // ---------- zakładki ----------
  const TAB_KEY = 'kn-tab';
  function showTab(name) {
    document.querySelectorAll('[data-tab]').forEach((b) => {
      const on = b.dataset.tab === name;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', String(on));
    });
    document.querySelectorAll('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== name; });
    try { localStorage.setItem(TAB_KEY, name); } catch (e) { /* trudno */ }
  }
  document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
  try { showTab(localStorage.getItem(TAB_KEY) === 'songs' ? 'songs' : 'files'); } catch (e) { showTab('files'); }

  // wspólne funkcje dla pozostałych modułów (spisy pieśni)
  window.App = {
    get data() { return data; },
    get idx() { return idx; },
    changed, toast, handleError, ensureConnected, openPicker, renderTree, esc, plural, stripExt,
  };

  // ---------- zdarzenia ----------
  $('btn-connect').addEventListener('click', () => { ensureConnected(); });
  $('btn-disconnect').addEventListener('click', () => {
    Drive.disconnect();
    user = null;
    renderAll();
    toast('Rozłączono z Dyskiem. Dane zostają w tym urządzeniu.');
  });
  $('btn-add-folder').addEventListener('click', () => openPicker('folder'));
  $('btn-scan').addEventListener('click', doScan);
  $('btn-welcome-start').addEventListener('click', () => openPicker('folder'));
  $('root-list').addEventListener('click', (e) => {
    const rf = e.target.closest('[data-refresh]');
    if (rf) return refreshFolder(rf.dataset.refresh);
    const b = e.target.closest('[data-rm]');
    if (b) removeRoot(b.dataset.rm);
  });

  $('picker-list').addEventListener('click', (e) => {
    const b = e.target.closest('.pick-item');
    if (!b) return;
    if (b.classList.contains('pick-doc')) {
      $('picker').close();
      if (pickDoc) pickDoc({ id: b.dataset.id, name: b.dataset.name, mimeType: b.dataset.mime });
      return;
    }
    pickStack.push({ id: b.dataset.id, name: b.dataset.name });
    loadPicker();
  });
  $('crumbs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-depth]');
    if (!b) return;
    pickStack = pickStack.slice(0, Number(b.dataset.depth) + 1);
    loadPicker();
  });
  $('btn-pick').addEventListener('click', pickCurrent);
  $('btn-pick-cancel').addEventListener('click', () => $('picker').close());

  let qTimer = null;
  $('q').addEventListener('input', (e) => {
    clearTimeout(qTimer);
    qTimer = setTimeout(() => { ui.query = e.target.value; renderTree(); }, 150);
  });
  $('filter').addEventListener('change', (e) => { ui.filter = e.target.value; renderTree(); });
  $('btn-expand').addEventListener('click', () => {
    Object.values(data.nodes).forEach((n) => { if (n.folder) ui.expanded.add(n.id); });
    saveExpanded();
    renderTree();
  });
  $('btn-collapse').addEventListener('click', () => {
    ui.expanded.clear();
    saveExpanded();
    renderTree();
  });

  const tree = $('tree');
  const toggleFolder = (row) => {
    if (tree.classList.contains('filtering')) return;
    const id = row.dataset.id;
    if (ui.expanded.has(id)) ui.expanded.delete(id);
    else ui.expanded.add(id);
    saveExpanded();
    renderTree();
  };
  tree.addEventListener('click', (e) => {
    const rf = e.target.closest('[data-refresh]');
    if (rf) return refreshFolder(rf.dataset.refresh);
    const row = e.target.closest('.row');
    if (!row) return;
    if (row.classList.contains('folder')) return toggleFolder(row);
    const act = e.target.closest('[data-act]');
    if (!act) return;
    if (act.dataset.act === 'edit') startEdit(row.dataset.id);
    else if (act.dataset.act === 'save') {
      const inp = row.querySelector('.name-input');
      commitEdit(row.dataset.id, inp ? inp.value : '');
    }
  });
  // „Zapisz” musi zadziałać zanim pole straci fokus
  tree.addEventListener('mousedown', (e) => {
    if (e.target.closest('[data-act="save"]')) e.preventDefault();
  });
  tree.addEventListener('keydown', (e) => {
    if (e.target.classList.contains('name-input')) {
      const id = e.target.closest('.row').dataset.id;
      if (e.key === 'Enter') { e.preventDefault(); commitEdit(id, e.target.value); }
      else if (e.key === 'Escape') { ui.editing = null; renderTree(); }
      return;
    }
    const row = e.target.closest('.row.folder');
    if (e.target.closest('[data-refresh]')) return;
    if (row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggleFolder(row); }
  });
  tree.addEventListener('focusout', (e) => {
    if (!e.target.classList.contains('name-input') || committing) return;
    const row = e.target.closest('.row');
    if (row && ui.editing === row.dataset.id) commitEdit(row.dataset.id, e.target.value);
  });

  window.addEventListener('pagehide', persist);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') persist(); });

  // ---------- start ----------
  (async () => {
    data = normalize(await Store.get('data'));
    const s = await Store.get('sync');
    if (s && typeof s === 'object') sync = { ...sync, ...s };
    loadExpanded();
    rebuild();
    renderAll();
    Drive.onChange((connected) => {
      renderAccount();
      renderSync();
      if (connected) onConnected();
    });
    await Drive.init();
    if (Drive.isConnected()) onConnected();
  })();
})();
