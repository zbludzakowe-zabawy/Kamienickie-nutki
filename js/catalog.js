// Katalog nut: skanowanie folderów, drzewo plików, wyszukiwanie.
window.Catalog = (() => {
  'use strict';
  const NOTE_EXT = /\.(pdf|jpe?g|png|gif|webp|bmp|tiff?|heic|heif)$/i;
  const CONCURRENCY = 4;

  const isNote = (mime, name) => mime === 'application/pdf' || mime.startsWith('image/') || NOTE_EXT.test(name);
  const kindOf = (mime, name) => (mime === 'application/pdf' || /\.pdf$/i.test(name) ? 'pdf' : 'img');

  // „Łódź_Barka-2.PDF” → „lodz barka 2 pdf” – do wyszukiwania i (później) dopasowywania spisu
  function norm(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/ł/g, 'l')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[_\-.,;:()[\]]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  const byName = (a, b) => a.name.localeCompare(b.name, 'pl', { numeric: true, sensitivity: 'base' });

  // Przechodzi przez wybrane foldery i ich podfoldery; zostawia tylko PDF-y i obrazy.
  async function scan(roots, prevNodes, onProgress) {
    const nodes = {};
    const visited = new Set();
    const now = new Date().toISOString();
    const hadPrev = prevNodes && Object.keys(prevNodes).length > 0;
    const queue = [];
    let folders = 0;
    let files = 0;

    for (const r of roots) {
      if (visited.has(r.id)) continue;
      visited.add(r.id);
      nodes[r.id] = { id: r.id, name: r.name, folder: true, parent: null };
      queue.push(r.id);
    }

    await new Promise((resolve, reject) => {
      let active = 0;
      let failed = false;
      const pump = () => {
        if (failed) return;
        if (!queue.length && !active) return resolve();
        while (active < CONCURRENCY && queue.length) {
          const parent = queue.shift();
          active++;
          Drive.listChildren(parent)
            .then((items) => {
              for (const f of items) {
                let mime = f.mimeType;
                let id = f.id;
                const viaShortcut = mime === Drive.SHORTCUT && !!f.shortcutDetails;
                if (viaShortcut) {
                  mime = f.shortcutDetails.targetMimeType;
                  id = f.shortcutDetails.targetId;
                }
                // Skrót prowadzi do tego samego pliku/folderu (ten sam identyfikator) – zapisujemy go raz.
                // Prawdziwe położenie ma pierwszeństwo: jeśli wcześniej trafiliśmy tu przez skrót, poprawiamy folder i dane.
                if (mime === Drive.FOLDER) {
                  if (visited.has(id)) {
                    const n = nodes[id];
                    if (!viaShortcut && n && n.viaShortcut && n.parent !== null) { n.parent = parent; n.name = f.name; delete n.viaShortcut; }
                    continue; // ten sam folder w kilku miejscach / pętla skrótów
                  }
                  visited.add(id);
                  nodes[id] = { id, name: f.name, folder: true, parent, ...(viaShortcut ? { viaShortcut: true } : {}) };
                  queue.push(id);
                  folders++;
                } else if (isNote(mime || '', f.name)) {
                  const old = nodes[id];
                  if (old && !(old.viaShortcut && !viaShortcut)) continue; // już mamy (skrót albo ten sam plik w kilku folderach)
                  const prev = prevNodes && prevNodes[id];
                  nodes[id] = {
                    id,
                    name: f.name,
                    parent,
                    kind: kindOf(mime || '', f.name),
                    // skrót nie ma rozmiaru ani „odcisku” – uzupełnią się, gdy trafimy na prawdziwy plik
                    size: viaShortcut ? 0 : Number(f.size) || 0,
                    modified: viaShortcut ? null : f.modifiedTime || null,
                    md5: viaShortcut ? null : f.md5Checksum || null, // „odcisk” treści – identyczne pliki mają ten sam
                    added: old ? old.added : prev ? prev.added || null : hadPrev ? now : null,
                    ...(viaShortcut ? { viaShortcut: true } : {}),
                  };
                  if (!old) files++;
                }
              }
              onProgress && onProgress({ folders, files });
            })
            .then(() => { active--; pump(); }, (e) => { failed = true; reject(e); });
        }
      };
      pump();
    });

    // usuń foldery bez nut (poza wybranymi folderami głównymi)
    const idx = buildIndex(nodes);
    for (const n of Object.values(nodes)) {
      if (n.folder && n.parent !== null && !idx.counts[n.id]) delete nodes[n.id];
    }
    return { nodes, scannedAt: now, files };
  }

  // Odświeża jeden folder (z podfolderami) – reszta listy zostaje bez zmian.
  async function rescanFolder(nodes, folder, onProgress) {
    const idx = buildIndex(nodes);
    const old = new Set();
    const collect = (id) => {
      for (const ch of idx.children[id] || []) {
        old.add(ch.id);
        if (ch.folder) collect(ch.id);
      }
    };
    collect(folder.id);
    const res = await scan([{ id: folder.id, name: folder.name }], nodes, onProgress);
    const out = {};
    for (const [k, v] of Object.entries(nodes)) if (!old.has(k)) out[k] = v;
    let added = 0;
    let files = 0;
    for (const [k, v] of Object.entries(res.nodes)) {
      if (k === folder.id) continue;
      // pliki leżące też gdzie indziej zostają po staremu – chyba że wcześniej znaleźliśmy je tylko przez skrót
      if (out[k] && !(out[k].viaShortcut && !v.viaShortcut)) continue;
      if (out[k]) { out[k] = { ...v, added: out[k].added }; continue; }
      out[k] = v;
      if (!v.folder) {
        files++;
        if (v.added === res.scannedAt) added++;
      }
    }
    const removed = [...old].filter((k) => !out[k] && nodes[k] && !nodes[k].folder).length;
    return { nodes: out, files, added, removed, at: res.scannedAt };
  }

  // Dzieci każdego folderu (posortowane) i liczba nut w poddrzewie.
  function buildIndex(nodes) {
    const children = {};
    const roots = [];
    for (const n of Object.values(nodes)) {
      if (n.parent === null || !nodes[n.parent]) roots.push(n);
      else (children[n.parent] = children[n.parent] || []).push(n);
    }
    for (const list of Object.values(children)) {
      list.sort((a, b) => (a.folder === b.folder ? byName(a, b) : a.folder ? -1 : 1));
    }
    const counts = {};
    const count = (n) => {
      if (!n.folder) return 1;
      let c = 0;
      for (const ch of children[n.id] || []) c += count(ch);
      counts[n.id] = c;
      return c;
    };
    roots.forEach(count);
    return { children, roots, counts };
  }

  // Ścieżka folderów nad plikiem, np. „Nuty / Kolędy”
  function pathOf(nodes, id) {
    const parts = [];
    let n = nodes[id] && nodes[nodes[id].parent];
    let guard = 0;
    while (n && guard++ < 100) {
      parts.unshift(n.name);
      n = nodes[n.parent];
    }
    return parts.join(' / ');
  }

  // Zostawia tylko pliki leżące pod podanymi folderami głównymi.
  function keepUnder(nodes, rootIds) {
    const keep = new Set(rootIds);
    const out = {};
    const under = (n) => {
      let guard = 0;
      while (n && guard++ < 200) {
        if (keep.has(n.id)) return true;
        n = nodes[n.parent];
      }
      return false;
    };
    for (const n of Object.values(nodes)) if (under(n)) out[n.id] = n;
    return out;
  }

  return { scan, rescanFolder, buildIndex, pathOf, keepUnder, norm };
})();
