// Porządkowanie Dysku: szukanie duplikatów nut + śpiewnik „Pozostałe nuty” (nuty nieprzypisane do żadnego spisu).
// Wyniki i decyzje są w data.dups (zapis w urządzeniu i na Dysku) – do pracy można wracać przez wiele dni.
window.Dups = (() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const A = window.App;
  const esc = A.esc;
  const VIEW_KEY = 'kn-dups-view';
  let view = 'open'; // open | done | all
  let query = '';
  try { view = localStorage.getItem(VIEW_KEY) || 'open'; } catch (e) { /* brak */ }

  const TYPE = {
    same: ['IDENTYCZNE PLIKI', 'Te same pliki (identyczna treść) w kilku miejscach na Dysku.'],
    name: ['TA SAMA NAZWA', 'Pliki o tej samej nazwie (Twojej albo nazwie pliku) w różnych folderach.'],
    book: ['RÓŻNE PLIKI W ŚPIEWNIKACH', 'Ta sama pieśń w różnych spisach ma przypisane różne pliki.'],
  };
  const JUNK = new Set(['pdf', 'jpg', 'jpeg', 'png', 'img', 'image', 'dsc', 'skan', 'scan', 'kopia', 'copy', 'str', 'strona', 'page', 'nuty', 'wersja', 'final']);

  const D = () => {
    if (!A.data.dups || typeof A.data.dups !== 'object') A.data.dups = { groups: {} };
    A.data.dups.groups = A.data.dups.groups || {};
    return A.data.dups;
  };
  const files = () => Object.values(A.data.nodes).filter((n) => !n.folder);
  const titleOf = (id) => {
    const n = A.data.nodes[id];
    const m = A.data.meta[id];
    return (m && m.title) || (n ? A.stripExt(n.name) : id);
  };
  // „Barka 2 (kopia).jpg” → „barka” – klucz nazwy bez numerów stron i dopisków
  const nameKey = (id) => Catalog.norm(titleOf(id)).split(' ').filter((t) => t && !JUNK.has(t) && !/^\d+$/.test(t)).join(' ');
  // Tytuł do wyświetlenia bez numeru strony na końcu („Barka 2” → „Barka”)
  const baseTitle = (id) => titleOf(id).replace(/[\s_\-–.(]*\(?(str\.?|strona|s\.)?\s*\d+\)?\s*$/i, '').trim() || titleOf(id);

  // Pliki oznaczone „do usunięcia” (decyzja „zostaw tylko zaznaczone” w grupie duplikatów)
  function toRemove() {
    const out = new Set();
    for (const g of Object.values(D().groups)) {
      if (g.status !== 'resolved' || g.type === 'book') continue;
      g.files.forEach((id) => { if (!(g.keep || []).includes(id)) out.add(id); });
    }
    return out;
  }

  // Gdzie plik jest używany (śpiewniki i programy) – pokazujemy przy duplikatach
  function usage() {
    const map = {};
    const add = (id, txt) => { (map[id] = map[id] || []).push(txt); };
    for (const b of A.data.songbooks) b.items.forEach((it) => { if (it.state === 'ok' || it.state === 'auto') it.files.forEach((id) => add(id, `${b.name}${it.no ? ' nr ' + it.no : ''}`)); });
    for (const p of A.data.programs || []) p.parts.forEach((pt) => pt.items.forEach((it) => (it.files || []).forEach((id) => add(id, `program „${p.name}”`))));
    return map;
  }

  // ---------- szukanie ----------
  function detect(quiet) {
    const all = files();
    const found = {};
    // 1. identyczna treść (md5 z Dysku)
    const byMd5 = {};
    all.forEach((n) => { if (n.md5) (byMd5[n.md5] = byMd5[n.md5] || []).push(n.id); });
    for (const [md5, ids] of Object.entries(byMd5)) if (ids.length > 1) found['m:' + md5] = { type: 'same', title: baseTitle(ids[0]), files: ids };
    // 2. ta sama nazwa w różnych folderach (pliki w jednym folderze różniące się numerem to zwykle strony jednej pieśni)
    const byName = {};
    all.forEach((n) => { const k = nameKey(n.id); if (k.length >= 3) (byName[k] = byName[k] || []).push(n.id); });
    const md5Sets = new Set(Object.values(found).map((g) => [...g.files].sort().join()));
    for (const [k, ids] of Object.entries(byName)) {
      if (ids.length < 2) continue;
      const parents = new Set(ids.map((id) => A.data.nodes[id].parent));
      if (parents.size < 2) continue;
      if (md5Sets.has([...ids].sort().join())) continue;
      found['n:' + k] = { type: 'name', title: baseTitle(ids[0]), files: ids };
    }
    // 3. ta sama pieśń w różnych spisach przypisana do różnych plików
    const bySong = {};
    A.data.songbooks.forEach((b) => b.items.forEach((it, i) => {
      if (!(it.state === 'ok' || it.state === 'auto') || !it.files.length) return;
      const k = Catalog.norm(it.title);
      (bySong[k] = bySong[k] || []).push({ book: b.id, i, sig: [...it.files].sort().join() });
    }));
    for (const [k, list] of Object.entries(bySong)) {
      if (list.length < 2 || new Set(list.map((x) => x.sig)).size < 2) continue;
      const b0 = A.data.songbooks.find((b) => b.id === list[0].book);
      found['b:' + k] = { type: 'book', title: b0.items[list[0].i].title, files: [...new Set(list.flatMap((x) => x.sig.split(',')))], entries: list.map(({ book, i }) => ({ book, i })) };
    }
    // połącz z wcześniejszymi decyzjami
    const old = D().groups;
    const groups = {};
    let reopened = 0;
    for (const [gid, g] of Object.entries(found)) {
      const prev = old[gid];
      if (prev && prev.status !== 'open') {
        const newFiles = g.files.filter((id) => !prev.files.includes(id));
        if (!newFiles.length) { groups[gid] = { ...g, status: prev.status, keep: prev.keep || [], decidedAt: prev.decidedAt }; continue; }
        reopened++;
        groups[gid] = { ...g, status: 'open', keep: [], note: 'Pojawiły się nowe pliki – sprawdź ponownie.' };
        continue;
      }
      groups[gid] = { ...g, status: 'open', keep: [] };
    }
    // decyzja „zostaw tylko zaznaczone” – gdy niepotrzebne pliki zniknęły z Dysku, grupa po prostu znika (sprawa załatwiona)
    D().groups = groups;
    D().at = new Date().toISOString();
    D().hasMd5 = all.some((n) => n.md5);
    A.changed();
    const open = Object.values(groups).filter((g) => g.status === 'open').length;
    if (quiet) return render();
    A.toast(`Znaleziono ${Object.keys(groups).length} ${A.plural(Object.keys(groups).length, 'grupę', 'grupy', 'grup')} możliwych duplikatów, do przejrzenia: ${open}` +
      (reopened ? ` (w tym ${reopened} ponownie – doszły nowe pliki)` : '') + '.');
    try { localStorage.setItem('kn-dups-hidden', '0'); } catch (e) { /* trudno */ }
    render();
  }

  // ---------- decyzje ----------
  // przepnij śpiewniki i programy z usuwanych plików na zachowany (gdy zachowujemy dokładnie jeden)
  function repoint(fromIds, toId) {
    const from = new Set(fromIds);
    const fix = (arr) => [...new Set(arr.map((id) => (from.has(id) ? toId : id)))];
    let n = 0;
    for (const b of A.data.songbooks) b.items.forEach((it) => { if (it.files.some((id) => from.has(id))) { it.files = fix(it.files); n++; } });
    for (const p of A.data.programs || []) p.parts.forEach((pt) => pt.items.forEach((it) => { if ((it.files || []).some((id) => from.has(id))) { it.files = fix(it.files); n++; } }));
    return n;
  }

  function decide(gid, action, el) {
    const g = D().groups[gid];
    if (!g) return;
    const checked = [...el.querySelectorAll('.dup-file input:checked')].map((c) => c.dataset.id);
    if (action === 'keepSel') {
      if (!checked.length) return A.toast('Zaznacz plik (albo pliki), które mają zostać.');
      g.status = 'resolved';
      g.keep = checked;
      const others = g.files.filter((id) => !checked.includes(id));
      const moved = checked.length === 1 ? repoint(others, checked[0]) : 0;
      A.toast(`Zapisano. Do usunięcia na Dysku: ${others.length} ${A.plural(others.length, 'plik', 'pliki', 'plików')} (oznaczone na liście).` +
        (moved ? ` Przepięto ${moved} ${A.plural(moved, 'pozycję', 'pozycje', 'pozycji')} w śpiewnikach i programach na zachowany plik.` : ''));
    } else if (action === 'keepAll') {
      g.status = 'kept';
      g.keep = [...g.files];
      A.toast('Zapisano: zostają wszystkie pliki.');
    } else if (action === 'notDup') {
      g.status = 'kept';
      g.keep = [...g.files];
      A.toast('Zapisano: to nie są duplikaty.');
    } else if (action === 'reopen') {
      g.status = 'open';
      g.keep = [];
    } else if (action === 'name') {
      const v = el.querySelector('.dup-name').value.trim().replace(/\s+/g, ' ');
      if (!checked.length) return A.toast('Zaznacz pliki, którym chcesz nadać nazwę.');
      if (!v) return A.toast('Wpisz nazwę.');
      checked.forEach((id) => { A.data.meta[id] = { ...(A.data.meta[id] || {}), title: v }; });
      A.toast(`Nadano nazwę „${v}” ${checked.length} ${A.plural(checked.length, 'plikowi', 'plikom', 'plikom')}.`);
    }
    g.decidedAt = new Date().toISOString();
    A.changed();
    render();
    A.renderTree();
  }

  function useEverywhere(gid, k) {
    const g = D().groups[gid];
    const src = g && g.entries[k];
    const b = src && A.data.songbooks.find((x) => x.id === src.book);
    if (!b) return;
    const filesSel = [...b.items[src.i].files];
    for (const e of g.entries) {
      const bb = A.data.songbooks.find((x) => x.id === e.book);
      const it = bb && bb.items[e.i];
      if (it) { it.files = [...filesSel]; it.state = 'ok'; }
    }
    g.status = 'resolved';
    g.keep = filesSel;
    g.decidedAt = new Date().toISOString();
    A.changed();
    render();
    A.toast('Ujednolicono: wszystkie śpiewniki mają teraz te same nuty dla tej pieśni.');
  }

  // ---------- wyświetlanie ----------
  const fmtSize = (b) => (!b ? '' : b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
  const folderUrl = (pid) => (!pid || pid === 'root' ? 'https://drive.google.com/drive/my-drive' : `https://drive.google.com/drive/folders/${encodeURIComponent(pid)}`);

  function fileRow(id, g, use, remove) {
    const n = A.data.nodes[id];
    if (!n) return `<div class="dup-file gone muted small">plik zniknął z Dysku (${esc(id)})</div>`;
    const m = A.data.meta[id];
    const kept = (g.keep || []).includes(id);
    const tag = g.status === 'resolved' && g.type !== 'book' ? (kept ? '<span class="dup-tag keep">zostaje</span>' : '<span class="dup-tag del">do usunięcia</span>') : '';
    return `<label class="dup-file${remove.has(id) ? ' del' : ''}"><input type="checkbox" data-id="${esc(id)}"${g.status === 'resolved' && kept ? ' checked' : ''}>
      <span class="badge ${n.kind}">${n.kind === 'pdf' ? 'PDF' : 'IMG'}</span>
      <span class="dup-main"><span><b>${esc((m && m.title) || n.name)}</b>${m && m.title ? ` <span class="muted small">${esc(n.name)}</span>` : ''} ${tag}</span>
        <span class="muted small"><a href="${folderUrl(n.parent)}" target="_blank" rel="noopener" title="Otwórz folder na Dysku">📁 ${esc(Catalog.pathOf(A.data.nodes, id) || 'Mój dysk')}</a>
        · ${fmtSize(n.size)}${n.modified ? ' · ' + new Date(n.modified).toLocaleDateString('pl-PL') : ''}${use[id] ? ' · używany: ' + esc(use[id].join(', ')) : ' · nieużywany'}</span></span>
      <a class="act" href="https://drive.google.com/file/d/${encodeURIComponent(id)}/view" target="_blank" rel="noopener" title="Otwórz plik na Dysku">↗</a></label>`;
  }

  function group(gid, g, use, remove) {
    const [label, help] = TYPE[g.type];
    const status = g.status === 'open' ? '<span class="state check">do przejrzenia</span>'
      : g.status === 'kept' ? '<span class="state have">zostawione</span>' : '<span class="state have">rozstrzygnięte</span>';
    let body;
    let acts;
    if (g.type === 'book') {
      body = g.entries.map((e, k) => {
        const b = A.data.songbooks.find((x) => x.id === e.book);
        const it = b && b.items[e.i];
        if (!it) return '';
        return `<div class="dup-entry"><span><b>${esc(b.name)}</b>${it.no ? ' · nr ' + esc(it.no) : ''}</span>
          <div class="dup-entry-files">${it.files.map((id) => fileRow(id, { ...g, status: 'open' }, use, remove)).join('')}</div>
          <button class="btn small" data-a="useAll" data-k="${k}" title="Użyj tych nut we wszystkich śpiewnikach">Użyj tych wszędzie</button></div>`;
      }).join('');
      acts = g.status === 'open' ? '<button class="btn small" data-a="keepAll">Zostaw różne wersje</button>' : '<button class="btn small" data-a="reopen">↺ Otwórz ponownie</button>';
    } else {
      body = g.files.map((id) => fileRow(id, g, use, remove)).join('');
      acts = (g.status === 'open'
        ? `<button class="btn small primary" data-a="keepSel" title="Zaznaczone zostają, pozostałe oznaczę „do usunięcia”">Zostaw tylko zaznaczone</button>
           <button class="btn small" data-a="keepAll" title="To duplikaty, ale wszystkie mają zostać">Zostaw wszystkie</button>
           <button class="btn small" data-a="notDup">To różne utwory</button>`
        : '<button class="btn small" data-a="reopen">↺ Otwórz ponownie</button>') +
        `<span class="dup-namebox"><input class="dup-name" maxlength="200" placeholder="Wspólna nazwa dla zaznaczonych" value="${esc(g.title)}"><button class="btn small" data-a="name">Nadaj nazwę</button></span>`;
    }
    return `<div class="dup ${g.status}" data-g="${esc(gid)}">
      <div class="dup-head"><b>${esc(g.title)}</b><span class="badge doc" title="${esc(help)}">${label}</span>${status}</div>
      ${g.note && g.status === 'open' ? `<p class="small warn-text">${esc(g.note)}</p>` : ''}
      <div class="dup-files">${body}</div>
      <div class="dup-acts">${acts}</div></div>`;
  }

  function render() {
    const d = D();
    const has = !!d.at;
    $('btn-dups').disabled = !A.data.scannedAt;
    let hidden = false;
    try { hidden = localStorage.getItem('kn-dups-hidden') === '1'; } catch (e) { /* brak */ }
    $('dups-card').hidden = !has || hidden;
    if (!has || hidden) return;
    const use = usage();
    const remove = toRemove();
    const all = Object.entries(d.groups);
    const nOpen = all.filter(([, g]) => g.status === 'open').length;
    document.querySelectorAll('#dups-filters [data-v]').forEach((b) => {
      b.classList.toggle('active', b.dataset.v === view);
      const n = b.dataset.v === 'open' ? nOpen : b.dataset.v === 'done' ? all.length - nOpen : all.length;
      b.querySelector('b').textContent = n;
    });
    $('dups-info').textContent = `Ostatnie szukanie: ${new Date(d.at).toLocaleString('pl-PL')}. Do usunięcia na Dysku: ${remove.size} ${A.plural(remove.size, 'plik', 'pliki', 'plików')}` +
      (remove.size ? ' (pełna lista: filtr „Duplikaty do usunięcia” w „Nutach” poniżej, można ją pobrać).' : '.') +
      (d.hasMd5 ? '' : ' Identyczne pliki wykryję po ponownym „Skanuj Dysk” (aplikacja pobierze wtedy „odciski” plików).');
    const words = Catalog.norm(query).split(' ').filter(Boolean);
    const list = all.filter(([, g]) => (view === 'all' || (view === 'open' ? g.status === 'open' : g.status !== 'open')))
      .filter(([, g]) => !words.length || words.every((w) => Catalog.norm(g.title + ' ' + g.files.map(titleOf).join(' ')).includes(w)))
      .sort((a, b) => a[1].title.localeCompare(b[1].title, 'pl', { numeric: true, sensitivity: 'base' }));
    const order = { same: 0, book: 1, name: 2 };
    list.sort((a, b) => order[a[1].type] - order[b[1].type]);
    $('dups-list').innerHTML = list.length ? list.map(([gid, g]) => group(gid, g, use, remove)).join('')
      : `<p class="muted empty">${view === 'open' ? 'Nic do przejrzenia. 🎉' : 'Brak pozycji w tym widoku.'}</p>`;
  }

  // ---------- śpiewnik „Pozostałe nuty” ----------
  // Nuty nieprzypisane do żadnego spisu (bez plików „do usunięcia”); strony jednej pieśni w tym samym folderze = jedna pozycja.
  function othersItems() {
    const assigned = new Set();
    for (const b of A.data.songbooks) for (const it of b.items) if (it.state === 'ok' || it.state === 'auto') it.files.forEach((id) => assigned.add(id));
    const remove = toRemove();
    const groups = {};
    for (const n of files()) {
      if (assigned.has(n.id) || remove.has(n.id)) continue;
      const k = n.parent + '|' + (nameKey(n.id) || n.id);
      (groups[k] = groups[k] || []).push(n.id);
    }
    const nm = (id) => A.data.nodes[id].name;
    return Object.values(groups)
      .map((ids) => {
        ids.sort((a, b) => nm(a).localeCompare(nm(b), 'pl', { numeric: true, sensitivity: 'base' }));
        return { no: '', title: ids.length > 1 ? baseTitle(ids[0]) : titleOf(ids[0]), state: 'ok', files: ids };
      })
      .sort((a, b) => a.title.localeCompare(b.title, 'pl', { numeric: true, sensitivity: 'base' }));
  }

  // ---------- zdarzenia ----------
  $('btn-dups').addEventListener('click', () => {
    if (!A.data.scannedAt) return A.toast('Najpierw przeskanuj Dysk.');
    detect();
    $('dups-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('dups-again').addEventListener('click', detect);
  $('dups-hide').addEventListener('click', () => { try { localStorage.setItem('kn-dups-hidden', '1'); } catch (e) { /* trudno */ } render(); });
  $('dups-filters').addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    view = b.dataset.v;
    try { localStorage.setItem(VIEW_KEY, view); } catch (err) { /* trudno */ }
    render();
  });
  let qt = null;
  $('dups-q').addEventListener('input', (e) => { clearTimeout(qt); qt = setTimeout(() => { query = e.target.value; render(); }, 150); });
  $('dups-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]');
    const el = e.target.closest('.dup');
    if (!b || !el) return;
    e.preventDefault();
    if (b.dataset.a === 'useAll') return useEverywhere(el.dataset.g, Number(b.dataset.k));
    decide(el.dataset.g, b.dataset.a, el);
  });
  $('dups-list').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.classList.contains('dup-name')) { e.preventDefault(); decide(e.target.closest('.dup').dataset.g, 'name', e.target.closest('.dup')); }
  });

  return { render, detect, othersItems, toRemove };
})();
