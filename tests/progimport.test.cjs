// Testy parsera programów z pliku: node tests/progimport.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
global.window = {};
const P = require('../js/progimport.js');

const show = (r) => r.days.map((d) => ({ name: d.name, parts: d.parts.map((p) => [p.name, p.items.map((i) => i.title + (i.note ? ` {${i.note}}` : ''))]) }));
let ok = 0;
const test = (name, fn) => { fn(); ok++; console.log('✓ ' + name); };

test('zwykły tekst – Pasterka2026.txt', () => {
  const lines = fs.readFileSync(path.join(__dirname, 'Pasterka2026.txt'), 'utf8').split(/\r?\n/);
  const r = P.parse(lines);
  assert.equal(r.group, '');
  assert.equal(r.days.length, 1);
  const [d] = show(r);
  assert.equal(d.name, 'Pasterka 2026');
  assert.deepEqual(d.parts.slice(0, 10), [
    ['Wejście', ['Wśród nocnej ciszy (Kowalski)']],
    ['Kyrie', ['Kyrie - Missa Noel']],
    ['Alleluja lub Chwała', ['Alleluja Radosne (Pałka)']],
    ['Modlitwa powszechna', ['Modlitwa powszechna IV (Pałka)']],
    ['Ofiarowanie', ['Anioł Pasterzom mówił (Bębenek)']],
    ['Sanctus', ['Sanctus - Missa Noel']],
    ['Agnus Dei', ['Agnus Dei - Missa Noel']],
    ['Komunia', ['Przybieżeli do Betlejem (Kusz)', 'Mamy Przyjaciela (Wesołowski)', 'Cicha noc (Bębenek)']],
    ['Uwielbienie', ['Gdy się Chrystus rodzi (Pospieszalski)']],
    ['Wyjście', ['Bóg się rodzi (Bębenek)']],
  ]);
  const [kname, kol] = d.parts[10];
  assert.equal(kname, 'Kolędowanie');
  assert.equal(kol.length, 14);
  assert.equal(kol[0], 'Dzisiaj w Betlejem (Głogowska)');
  assert.ok(kol.includes('Gaudete {a cappella}'));
  assert.ok(kol.includes('Dobryj weczer {a cappella}'));
  assert.ok(kol.includes('Puer Natus'));
  assert.equal(d.parts.length, 11);
});

test('zwykły tekst – kolęda „Gloria…” w Kolędowaniu zostaje, dwie uroczystości w pliku', () => {
  const r = P.parse(['Wigilia', 'we: Wśród nocnej ciszy', 'Gloria - Missa X', 'wy: Bóg się rodzi', 'KOLĘDOWANIE:', 'Gloria in excelsis Deo',
    'Alleluja, Jezus żyje', 'Boże Narodzenie', 'we: Przybieżeli', 'Psalm: Dziś narodził się', 'kom: Lulajże', '', 'Cicha noc']);
  assert.deepEqual(show(r), [
    { name: 'Wigilia', parts: [['Wejście', ['Wśród nocnej ciszy']], ['Gloria', ['Gloria - Missa X']], ['Wyjście', ['Bóg się rodzi']],
      ['Kolędowanie', ['Gloria in excelsis Deo', 'Alleluja, Jezus żyje']]] },
    { name: 'Boże Narodzenie', parts: [['Wejście', ['Przybieżeli']], ['Psalm', ['Dziś narodził się']], ['Komunia', ['Lulajże', 'Cicha noc']]] },
  ]);
});

test('tabela (układ Triduum) działa jak dawniej', () => {
  const r = P.parse(['Triduum 2026', 'Wielki Czwartek', 'We\t\tUbi caritas (!)\t.', '\t\tPan Jezus już się zbliża\t.',
    'Of\t\tAve Verum / Wysławiam zranienie\t.', 'Kom\t\t0\t', 'Wielki Piątek', 'Ps01\t\tOjcze w Twe ręce\t.', '\t\tMęka\t']);
  assert.equal(r.group, 'Triduum 2026');
  assert.deepEqual(show(r), [
    { name: 'Wielki Czwartek', parts: [['Wejście', ['Ubi caritas {!}', 'Pan Jezus już się zbliża']], ['Ofiarowanie', ['Ave Verum', 'Wysławiam zranienie']]] },
    { name: 'Wielki Piątek', parts: [['Psalm 1', ['Ojcze w Twe ręce']], ['Męka', ['Męka']]] },
  ]);
});

console.log(`\n${ok} testy OK`);
