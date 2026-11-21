// Łączenie danych z dwóch urządzeń (window.DataMerge) – czysta funkcja, testowalna w Node.
// Używane, gdy plik na Dysku zmienił się na innym urządzeniu, a w tym urządzeniu też są niezapisane zmiany.
// Zasada: niczego nie gubimy. Spisy, programy, nazwy plików, utwory w katalogu itd. łączymy po id –
// to, co jest tylko po jednej stronie, zostaje; przy różnicy w tym samym obiekcie wygrywa wersja z Dysku
// (liczba takich różnic w `conflicts` – wtedy aplikacja zapisuje kopię wersji z urządzenia).
(function (root) {
  'use strict';
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const obj = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});
  const arr = (x) => (Array.isArray(x) ? x : []);

  // lista obiektów z id: kolejność z Dysku, brakujące z urządzenia na końcu
  function byId(remote, local, stat, count) {
    const out = arr(remote).slice();
    const at = new Map(out.map((x) => [x && x.id, x]));
    for (const x of arr(local)) {
      if (!x || x.id == null) continue;
      if (!at.has(x.id)) { out.push(x); stat.added++; } else if (count && !same(at.get(x.id), x)) stat.conflicts++;
    }
    return out;
  }
  // słownik: klucze z Dysku, brakujące z urządzenia
  function byKey(remote, local, stat, diff) {
    const out = { ...obj(remote) };
    for (const [k, v] of Object.entries(obj(local))) {
      if (!(k in out)) { out[k] = v; stat.added++; } else if (diff && diff(out[k], v)) stat.conflicts++;
    }
    return out;
  }
  const time = (x) => (typeof x === 'number' ? x : Date.parse(x || '') || 0);

  function merge(local, remote) {
    local = obj(local);
    remote = obj(remote);
    const stat = { added: 0, conflicts: 0 };
    const d = { ...local, ...remote };
    d.roots = byId(remote.roots, local.roots, { added: 0, conflicts: 0 });
    // drzewo plików – z nowszego skanowania (musi być spójne)
    const localScan = time(local.scannedAt) > time(remote.scannedAt);
    if (localScan) { d.nodes = local.nodes; d.scannedAt = local.scannedAt; d.newAt = local.newAt; }
    d.meta = byKey(remote.meta, local.meta, stat, (a, b) => !same(a, b));
    d.songbooks = byId(remote.songbooks, local.songbooks, stat, true);
    d.programs = byId(remote.programs, local.programs, stat, true);

    if (local.catalog || remote.catalog) {
      const rc = obj(remote.catalog);
      const lc = obj(local.catalog);
      // utwory katalog składa sam – liczymy tylko różnice w tym, co wpisał administrator
      const user = (w) => [w && w.title, w && w.ownTitle, w && w.lyrics, w && w.music, w && w.tags];
      d.catalog = { ...lc, ...rc, tags: byId(rc.tags, lc.tags, stat, true), works: byKey(rc.works, lc.works, { added: 0, conflicts: 0 }) };
      for (const [k, w] of Object.entries(obj(lc.works))) if (obj(rc.works)[k] && !same(user(obj(rc.works)[k]), user(w))) stat.conflicts++;
    }
    // publikacja – cała z tej strony, która publikowała później (folder, kopie i PDF-y muszą do siebie pasować)
    if (local.publish || remote.publish) {
      const lp = obj(local.publish);
      const rp = obj(remote.publish);
      d.publish = time(lp.at) > time(rp.at) ? lp : rp;
    }
    if (local.dups || remote.dups) {
      const ld = obj(local.dups);
      const rd = obj(remote.dups);
      const base = time(ld.at) > time(rd.at) ? ld : rd;
      d.dups = { ...base, groups: { ...obj(ld.groups), ...obj(rd.groups), ...obj(base.groups) }, cleanup: byKey(rd.cleanup, ld.cleanup, { added: 0, conflicts: 0 }) };
    }
    if (local.reports || remote.reports) {
      const lr = obj(local.reports);
      const rr = obj(remote.reports);
      d.reports = { ...lr, ...rr, done: { ...obj(lr.done), ...obj(rr.done) } };
    }
    d.owner = remote.owner || local.owner;
    return { data: d, added: stat.added, conflicts: stat.conflicts };
  }

  // Spisy i programy obecne w starszej wersji danych, a brakujące teraz (odzyskiwanie z historii pliku).
  function missing(current, older) {
    const have = (list) => new Set(arr(list).map((x) => x && x.id));
    const books = have(current.songbooks);
    const progs = have(current.programs);
    return {
      songbooks: arr(obj(older).songbooks).filter((b) => b && !books.has(b.id)),
      programs: arr(obj(older).programs).filter((p) => p && !progs.has(p.id)),
    };
  }

  const api = { merge, missing };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DataMerge = api;
})(typeof window !== 'undefined' ? window : globalThis);
