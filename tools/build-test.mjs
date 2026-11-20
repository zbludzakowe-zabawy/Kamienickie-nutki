// Zamienia kopię strony w wersję testową (publikowaną pod <strona>/test/).
// Użycie: node tools/build-test.mjs _site/test   (potem jak zwykle: node tools/build-sw.mjs _site/test)
// Co robi:
//  - dokleja tools/test-env/config.test.js do js/config.js (osobne dane, osobna pamięć przeglądarki),
//  - podmienia ikony na testowe (tools/test-env/icons, źródło design/ikona-test.svg),
//  - zmienia nazwę i kolor w manifest.webmanifest i index.html (osobna ikonka po instalacji),
//  - nadaje service workerowi własny przedrostek schowków (inaczej produkcja i test kasowałyby sobie nawzajem schowki).
import { readFileSync, writeFileSync, readdirSync, copyFileSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = process.argv[2];
if (!dir) throw new Error('Użycie: node tools/build-test.mjs <katalog strony testowej>');
const env = join(dirname(fileURLToPath(import.meta.url)), 'test-env');

const NAME = 'Kamienickie Nutki – TEST';
const SHORT = 'Nutki TEST';
const COLOR = '#24476b';

const edit = (file, fn) => {
  const p = join(dir, file);
  const before = readFileSync(p, 'utf8');
  const after = fn(before);
  if (after === before) throw new Error(`Nic nie zmieniono w ${file} – sprawdź tools/build-test.mjs`);
  writeFileSync(p, after);
};

// 1. ustawienia testowe
appendFileSync(join(dir, 'js/config.js'), '\n' + readFileSync(join(env, 'config.test.js'), 'utf8'));

// 2. ikony
for (const f of readdirSync(join(env, 'icons'))) copyFileSync(join(env, 'icons', f), join(dir, 'icons', f));

// 3. manifest i nagłówek strony
edit('manifest.webmanifest', (s) => {
  const m = JSON.parse(s);
  Object.assign(m, { name: NAME, short_name: SHORT, theme_color: COLOR });
  return JSON.stringify(m, null, 2) + '\n';
});
edit('index.html', (s) => s
  .replace(/<title>[^<]*<\/title>/, `<title>${NAME}</title>`)
  .replace(/(name="application-name" content=")[^"]*/, `$1${NAME}`)
  .replace(/(name="apple-mobile-web-app-title" content=")[^"]*/, `$1${SHORT}`)
  .replace(/(name="theme-color" content=")[^"]*/, `$1${COLOR}`));

// 4. service worker
edit('sw.js', (s) => s.replace("const PREFIX = 'kamienickie-nutki-';", "const PREFIX = 'test-kamienickie-nutki-';"));

console.log(`Wersja testowa przygotowana w ${dir}`);
