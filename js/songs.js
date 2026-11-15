// Spisy pieśni: wczytanie spisu, automatyczne dopasowanie, potwierdzanie i ręczny wybór plików.
window.Songs = (() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const A = window.App;
  const esc = A.esc;
  const CUR_KEY = 'kn-songbook';
  let current = null;
  let filter = 'all';
  let query = '';

  try { current = localStorage.getItem(CUR_KEY); } catch (e) { /* brak */ }

  const books = () => A.data.songbooks;
  const book = () => books().find((b) => b.id === current) || books()[0] || null;
  const setCurrent = (id) => {
    current = id;
    try { localStorage.setItem(CUR_KEY, id || ''); } catch (e) { /* trudno */ }
  };
  const hasNotes = (it) => it.state === 'ok' || it.state === 'auto';
  const isMissing = (it) => it.state === 'none' || it.state === 'missing';
  const group = (it) => (hasNotes(it) ? 'have' : it.state === 'check' ? 'check' : 'missing');

  // ---------- wczytanie spisu ----------
  function createBook(name, source, parsed) {
    const items = parsed.items.map((p) => ({ no: p.no, title: p.title, state: 'none', files: [], sugg: [] }));
    Matcher.matchItems(items, A.data.nodes, A.data.meta, A.idx);
    const b = { id: 'sb' + Date.now().toString(36), name, source, importedAt: new Date().toISOString(), items };
    books().push(b);
    setCurrent(b.id);
    A.changed();
    filter = 'all';
    query = '';
    render();
    const have = items.filter(hasNotes).length;
    const check = items.filter((i) => i.state === 'check').length;
    A.toast(`Wczytano ${items.length} ${A.plural(items.length, 'pozycję', 'pozycje', 'pozycji')}` +
      (parsed.duplicates ? ` (pominięto ${parsed.duplicates} powtórzeń)` : '') +
      `. Nuty: ${have}, do sprawdzenia: ${check}.`);
    if (!Object.keys(A.data.nodes).length) A.toast('Spis wczytany, ale nie ma jeszcze plików – przeskanuj Dysk w zakładce „Nuty na Dysku”.', true);
  }

  async function importLocal(file) {
    try {
      const parsed = await SongList.fromFile(file.name, await file.arrayBuffer());
      createBook(A.stripExt(file.name), { kind: 'local', name: file.name }, parsed);
    } catch (e) {
      A.handleError(e);
    }
  }

  function importDrive() {
    A.openPicker('doc', async (f) => {
      try {
        A.toast('Wczytywanie spisu…');
        const gdoc = f.mimeType === SongList.GDOC;
        const content = gdoc ? await Drive.exportText(f.id) : await Drive.download(f.id);
        const parsed = await SongList.fromFile(gdoc ? f.name + '.txt' : f.name, content);
        createBook(A.stripExt(f.name), { kind: 'drive', id: f.id, name: f.name }, parsed);
      } catch (e) {
        A.handleError(e);
      }
    });
  }

  // Ponowne dopasowanie (np. po skanowaniu); pozycji zatwierdzonych ręcznie nie rusza.
  function rematchAll(quiet) {
    for (const b of books()) Matcher.matchItems(b.items, A.data.nodes, A.data.meta, A.idx);
    if (!quiet) A.toast('Dopasowano ponownie. Pozycje zatwierdzone przez Ciebie zostały bez zmian.');
  }

  // Po zatwierdzeniu: plik bez własnej nazwy dostaje tytuł ze spisu.
  function autoName(it) {
    if (it.files.length !== 1) return;
    const id = it.files[0];
    const m = A.data.meta[id] || {};
    if (A.data.nodes[id] && !m.title) A.data.meta[id] = { ...m, title: it.title };
  }

  function update(it, fn) {
    fn(it);
    A.changed();
    render();
    A.renderTree();
  }

  // ---------- wyświetlanie ----------
  function chip(id) {
    const n = A.data.nodes[id];
    if (!n) return '<span class="chip gone" title="Pliku nie ma w ostatnim skanowaniu">plik zniknął z Dysku</span>';
    const m = A.data.meta[id];
    const label = (m && m.title) || n.name;
    const path = Catalog.pathOf(A.data.nodes, id);
    return `<a class="chip" href="https://drive.google.com/file/d/${encodeURIComponent(id)}/view" target="_blank" rel="noopener" title="${esc(path + ' / ' + n.name)}">
      <span class="badge ${n.kind}">${n.kind === 'pdf' ? 'PDF' : 'IMG'}</span><span class="chip-name">${esc(label)}</span>${m && m.title ? `<span class="chip-orig">${esc(n.name)}</span>` : ''}</a>`;
  }
  const chips = (files) => files.map(chip).join('');
  const pct = (s) => `<span class="pct" title="Podobieństwo nazwy">${Math.round((s || 0) * 100)}%</span>`;

  const STATE = {
    ok: ['have', 'Są nuty'],
    auto: ['have', 'Są nuty · automatycznie'],
    check: ['check', 'Do sprawdzenia'],
    none: ['missing', 'Brak nut'],
    missing: ['missing', 'Brak nut · potwierdzone'],
  };

  function row(it, i) {
    const [cls, label] = STATE[it.state] || STATE.none;
    let body = '';
    let acts = '';
    if (it.state === 'ok' || it.state === 'auto') {
      body = `<div class="chips">${chips(it.files)}</div>`;
      acts = (it.state === 'auto' ? '<button class="btn small primary" data-a="confirm">✓ Zgadza się</button><button class="btn small" data-a="reject">✕ To nie to</button>' : '') +
        '<button class="btn small" data-a="choose">Zmień…</button>' +
        (it.state === 'ok' ? '<button class="btn small" data-a="reset" title="Wróć do dopasowania automatycznego">↺</button>' : '');
    } else if (it.state === 'check') {
      body = `<div class="chips">${chips(it.files)}${pct(it.score)}</div>`;
      acts = '<button class="btn small primary" data-a="confirm">✓ Zgadza się</button><button class="btn small" data-a="reject">✕ To nie to</button><button class="btn small" data-a="choose">Wybierz…</button>';
    } else {
      acts = '<button class="btn small" data-a="choose">Wybierz plik…</button>' +
        (it.state === 'none' ? '<button class="btn small" data-a="missing" title="Potwierdź, że tych nut nie ma">Nie mamy</button>' : '<button class="btn small" data-a="reset" title="Wróć do dopasowania automatycznego">↺</button>');
    }
    const sugg = (it.state === 'check' || it.state === 'none') && it.sugg && it.sugg.length
      ? `<div class="sugg"><span class="muted">${it.state === 'check' ? 'Inne propozycje:' : 'Może to?'}</span>${it.sugg.slice(0, 3).map((s, k) =>
        `<span class="sugg-item">${chips(s.files)}${pct(s.score)}<button class="btn small" data-a="use" data-k="${k}">Użyj</button></span>`).join('')}</div>`
      : '';
    return `<div class="song ${cls}" data-i="${i}">
      <span class="no">${esc(it.no || '')}</span>
      <div class="song-main"><div class="song-head"><span class="song-title">${esc(it.title)}</span><span class="state ${cls}">${label}</span></div>${body}${sugg}</div>
      <div class="song-acts">${acts}</div></div>`;
  }

  function render() {
    const list = books();
    const b = book();
    if (b) setCurrent(b.id);
    $('sb-empty').hidden = !!b;
    $('sb-content').hidden = !b;
    $('sb-select').innerHTML = list.map((x) => `<option value="${esc(x.id)}"${b && x.id === b.id ? ' selected' : ''}>${esc(x.name)}</option>`).join('');
    $('sb-select').hidden = list.length < 2;
    if (!b) return;

    if (document.activeElement !== $('sb-name')) $('sb-name').value = b.name;
    const autos = b.items.filter((it) => it.state === 'auto').length;
    $('sb-confirm-all').hidden = !autos;
    $('sb-confirm-all').textContent = `✓ Zatwierdź pewne (${autos})`;
    $('sb-source').textContent = `${b.source && b.source.name ? 'Plik: ' + b.source.name + ' · ' : ''}wczytano ${new Date(b.importedAt).toLocaleDateString('pl-PL')}`;

    const n = { all: b.items.length, have: 0, check: 0, missing: 0 };
    b.items.forEach((it) => { n[group(it)]++; });
    document.querySelectorAll('#sb-filters [data-f]').forEach((el) => {
      el.classList.toggle('active', el.dataset.f === filter);
      el.querySelector('b').textContent = n[el.dataset.f];
    });

    const words = Catalog.norm(query).split(' ').filter(Boolean);
    const rows = [];
    b.items.forEach((it, i) => {
      if (filter !== 'all' && group(it) !== filter) return;
      if (words.length) {
        const hay = Catalog.norm(it.no + ' ' + it.title);
        if (!words.every((w) => hay.includes(w))) return;
      }
      rows.push(row(it, i));
    });
    $('sb-list').innerHTML = rows.join('') || '<p class="muted empty">Brak pozycji w tym widoku.</p>';
  }

  // ---------- ręczny wybór plików ----------
  let chooser = null; // { it, selected: [], cands }
  function openChooser(it) {
    if (!Object.keys(A.data.nodes).length) return A.toast('Najpierw przeskanuj Dysk w zakładce „Nuty na Dysku”.', true);
    chooser = { it, selected: [...it.files], cands: Matcher.candidates(A.data.nodes, A.data.meta, A.idx).filter((c) => !c.folder) };
    $('chooser-title').textContent = `${it.no ? it.no + '. ' : ''}${it.title}`;
    $('chooser-q').value = '';
    $('chooser').showModal();
    renderChooser();
  }

  function renderChooser() {
    const { it, selected, cands } = chooser;
    const q = $('chooser-q').value.trim();
    let ids;
    if (!q) {
      ids = Matcher.rank(it.title, cands, 40, 0.15).map((r) => ({ id: r.files[0], score: r.score }));
    } else {
      const words = Catalog.norm(q).split(' ').filter(Boolean);
      ids = Object.values(A.data.nodes).filter((n) => !n.folder).filter((n) => {
        const m = A.data.meta[n.id];
        const hay = Catalog.norm(n.name + ' ' + ((m && m.title) || '') + ' ' + Catalog.pathOf(A.data.nodes, n.id));
        return words.every((w) => hay.includes(w));
      }).slice(0, 150).map((n) => ({ id: n.id }));
    }
    // zaznaczone zawsze na górze
    const shown = [...selected.map((id) => ({ id })), ...ids.filter((x) => !selected.includes(x.id))];
    $('chooser-list').innerHTML = shown.length ? shown.map(({ id, score }) => {
      const n = A.data.nodes[id];
      if (!n) return '';
      const m = A.data.meta[id];
      const on = selected.includes(id);
      return `<li><label class="choose-item${on ? ' on' : ''}"><input type="checkbox" data-id="${esc(id)}"${on ? ' checked' : ''}>
        <span class="badge ${n.kind}">${n.kind === 'pdf' ? 'PDF' : 'IMG'}</span>
        <span class="choose-names"><span>${esc((m && m.title) || n.name)}</span><span class="orig">${esc(Catalog.pathOf(A.data.nodes, id))}${m && m.title ? ' / ' + esc(n.name) : ''}</span></span>
        ${score ? pct(score) : ''}
        <a class="act" href="https://drive.google.com/file/d/${encodeURIComponent(id)}/view" target="_blank" rel="noopener" title="Podejrzyj na Dysku">↗</a></label></li>`;
    }).join('') : `<li class="muted">${q ? 'Nic nie pasuje.' : 'Brak podobnych nazw – wpisz coś w wyszukiwarkę.'}</li>`;
    $('chooser-count').textContent = selected.length ? `Zaznaczono: ${selected.length}` : '';
  }

  // ---------- zdarzenia ----------
  $('sb-file').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (f) importLocal(f);
  });
  document.querySelectorAll('[data-import]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.import === 'local') $('sb-file').click();
    else importDrive();
  }));
  $('sb-select').addEventListener('change', (e) => { setCurrent(e.target.value); render(); });
  $('sb-name').addEventListener('change', (e) => {
    const b = book();
    const v = e.target.value.trim();
    if (b && v && v !== b.name) { b.name = v; A.changed(); render(); }
  });
  $('sb-confirm-all').addEventListener('click', () => {
    const b = book();
    if (!b) return;
    const autos = b.items.filter((it) => it.state === 'auto');
    autos.forEach((it) => { it.state = 'ok'; autoName(it); });
    A.changed();
    render();
    A.renderTree();
    A.toast(`Zatwierdzono ${autos.length} ${A.plural(autos.length, 'pozycję', 'pozycje', 'pozycji')}.`);
  });
  $('sb-rematch').addEventListener('click', () => { rematchAll(false); A.changed(); render(); });
  $('sb-delete').addEventListener('click', () => {
    const b = book();
    if (!b || !confirm(`Usunąć spis „${b.name}” z aplikacji?\n\nPlik na Dysku i nuty zostaną nietknięte.`)) return;
    A.data.songbooks = books().filter((x) => x.id !== b.id);
    setCurrent(null);
    A.changed();
    render();
  });
  $('sb-filters').addEventListener('click', (e) => {
    const b = e.target.closest('[data-f]');
    if (b) { filter = b.dataset.f; render(); }
  });
  let qt = null;
  $('sb-q').addEventListener('input', (e) => {
    clearTimeout(qt);
    qt = setTimeout(() => { query = e.target.value; render(); }, 120);
  });

  $('sb-list').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-a]');
    const el = e.target.closest('.song');
    const b = book();
    if (!btn || !el || !b) return;
    const it = b.items[Number(el.dataset.i)];
    if (!it) return;
    switch (btn.dataset.a) {
      case 'confirm': return update(it, (x) => { x.state = 'ok'; autoName(x); });
      case 'reject': return update(it, (x) => {
        x.rejected = [...new Set([...(x.rejected || []), x.files.join(',')])];
        x.state = 'none';
        Matcher.matchItems([x], A.data.nodes, A.data.meta, A.idx);
        if (x.state !== 'none') { x.state = 'check'; } // po odrzuceniu kolejna propozycja zawsze do sprawdzenia
      });
      case 'use': return update(it, (x) => {
        const s = x.sugg[Number(btn.dataset.k)];
        if (!s) return;
        x.files = s.files;
        x.state = 'ok';
        autoName(x);
      });
      case 'missing': return update(it, (x) => { x.state = 'missing'; x.files = []; });
      case 'reset': return update(it, (x) => {
        x.state = 'none';
        Matcher.matchItems([x], A.data.nodes, A.data.meta, A.idx);
      });
      case 'choose': return openChooser(it);
      default:
    }
  });

  $('chooser-q').addEventListener('input', () => renderChooser());
  $('chooser-list').addEventListener('change', (e) => {
    const id = e.target.dataset.id;
    if (!id || !chooser) return;
    if (e.target.checked) { if (!chooser.selected.includes(id)) chooser.selected.push(id); }
    else chooser.selected = chooser.selected.filter((x) => x !== id);
    e.target.closest('.choose-item').classList.toggle('on', e.target.checked);
    $('chooser-count').textContent = chooser.selected.length ? `Zaznaczono: ${chooser.selected.length}` : '';
  });
  $('chooser-cancel').addEventListener('click', () => $('chooser').close());
  $('chooser-save').addEventListener('click', () => {
    const { it, selected } = chooser;
    $('chooser').close();
    update(it, (x) => {
      x.files = [...selected];
      x.state = selected.length ? 'ok' : 'none';
      if (selected.length) autoName(x);
      else Matcher.matchItems([x], A.data.nodes, A.data.meta, A.idx);
    });
  });

  return { render, rematchAll };
})();
