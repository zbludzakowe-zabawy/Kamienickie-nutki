# Środowisko testowe obok produkcji (GitHub Pages) – przepis

Jak zrobiona jest wersja testowa Kamienickich Nutek, opisane tak, żeby dało się to powtórzyć w innej
aplikacji: czysty HTML/JS bez budowania, PWA, publikacja przez GitHub Actions na GitHub Pages,
dane w przeglądarce i/lub na Dysku Google.

## Efekt

| | Produkcja | Test |
|---|---|---|
| Gałąź (kod) | `main` | `test` (w tym samym repozytorium) |
| Adres | `https://<konto>.github.io/<repo>/` | `https://<konto>.github.io/<repo>-test/` |
| Gdzie leży gotowa strona | Pages repozytorium z kodem | gałąź `gh-pages` osobnego, pustego repozytorium `<repo>-test` |
| Kto wprowadza zmiany | właściciel scala PR do `main` | PR do `test`, scala Claude (domyślnie każda zmiana) |
| Wygląd | normalny | pomarańczowy pasek „WERSJA TESTOWA”, inny kolor, ikona z napisem TEST |
| Dane | prawdziwe | osobne (kopia z produkcji na przycisk) |

Praca (ustalona z użytkownikiem):
1. Każda zmiana domyślnie trafia na testy: gałąź robocza (od `main`) → PR do `test` → scala Claude → publikacja testu.
2. Po każdej zmianie Claude przypomina: „zmiana jest na wersji testowej – jeśli ma być na produkcji, daj znać”.
3. Na produkcję tylko na prośbę właściciela: PR tej samej gałęzi roboczej do `main`, scala właściciel.
4. „Uaktualnij testy” = PR `main` → `test`, gdy na produkcję weszło coś z pominięciem testów.

## Dlaczego osobne repozytorium na stronę testową (a NIE podfolder `/test/`)

Pierwsza wersja leżała w podfolderze produkcji (`/<repo>/test/`). **Na telefonie to nie działa:** zakres PWA produkcji
(`scope: ./` = `/<repo>/`) obejmuje wszystko pod spodem, więc Android traktuje test jako część zainstalowanej produkcji.
Nie da się zainstalować drugiej ikonki, test otwiera się w oknie produkcji, a ikonka otwiera to, co było ostatnio.
Zakresu nie da się „wyciąć”. Test musi mieć adres **obok**, nie w środku.

- `https://<konto>.github.io/<repo>-test/` jest obok (`/<repo>-test/` nie zaczyna się od `/<repo>/`). To osobna aplikacja na telefonie.
- **Ta sama domena, więc logowanie Google działa bez zmian.** Klient OAuth i klucz API mają `https://<konto>.github.io` (z `/*`),
  więc w Google Cloud nic nie trzeba dopisywać. Przy innej domenie (Netlify, Cloudflare Pages) trzeba by dopisać źródło i odsyłacz.
- Wada tej samej domeny: **wspólna pamięć przeglądarki** (localStorage, IndexedDB, Cache Storage). Trzeba ją rozdzielić (punkty 2–4).
- Kod zostaje w jednym repozytorium (gałąź `test`). Drugie repozytorium jest tylko „półką” na gotową stronę.

## Elementy

### 1. Publikacja

**Produkcja** (`.github/workflows/pages.yml`): jak zwykle, push do `main` → GitHub Pages (Actions). Dodatkowo pod starym adresem
`/<repo>/test/` leży mała strona z przekierowaniem na nowy adres.

**Test** (`.github/workflows/test-pages.yml`): push do `test` → budowa (`build-test.mjs`, `build-sw.mjs`, `.nojekyll`) →
`git push -f` całej strony do gałęzi `gh-pages` repozytorium `<repo>-test`. Tam Pages: „Deploy from a branch” → `gh-pages` / `(root)`.

Jednorazowe ustawienia (robi właściciel):
1. Puste **publiczne** repozytorium `<repo>-test` (bez README).
2. Token fine-grained (GitHub → Settings → Developer settings → Fine-grained tokens): dostęp **tylko** do `<repo>-test`,
   uprawnienie *Contents: Read and write*. Ma datę ważności, więc trzeba go odnawiać (przy wygaśnięciu publikacja testu zgłosi błąd).
3. W repozytorium z kodem: Settings → Secrets and variables → Actions → sekret `TEST_PAGES_TOKEN` = token.
4. Po pierwszej publikacji: w `<repo>-test` Settings → Pages → Source „Deploy from a branch”, gałąź `gh-pages`, folder `/ (root)`.

### 2. Ustawienia testu doklejane przy publikacji (`tools/test-env/config.test.js`)

W kodzie aplikacji nie ma osobnej kopii dla testu. `tools/build-test.mjs` dokleja ten plik na koniec `js/config.js`
(skrypt ładowany jako pierwszy). Ten plik:
- nadpisuje ustawienia: `env: 'test'`, inna nazwa pliku danych, inna nazwa folderu, wyłączone rzeczy „publiczne”
  (u nas `publicCatalogId: ''`), `prodDataFileName` do kopiowania;
- ustawia `<html data-env="test">` (CSS zmienia kolor akcentu);
- **dodaje przedrostek `test~` do wszystkich kluczy localStorage.** Robi to podmianą `Storage.prototype.getItem/setItem/removeItem`
  (tylko dla `localStorage`), więc reszta kodu się nie zmienia. Pułapka: nie przypisuj `localStorage.getItem = …`,
  bo to tworzy element o nazwie „getItem”. Trzeba podmienić prototyp. Jeśli aplikacja przegląda klucze
  (`localStorage.key(i)`, `Object.keys(localStorage)`), trzeba to też obsłużyć. U nas tego nie ma.

### 3. Kod aplikacji świadomy `env` (małe zmiany)

- **IndexedDB:** nazwa bazy z dopiskiem, `'kamienickie-nutki' + (env ? '-' + env : '')` (`js/store.js`).
- **Dysk Google:** foldery aplikacji szukane po znaczniku `appProperties.kn`. W teście znacznik ma przedrostek
  (`test-app`, `test-public`), więc test zakłada **własne** foldery i nigdy nie trafi w foldery produkcji (`js/drive.js`).
  Plik danych ma inną nazwę (`KamienickieNutki-TEST.json`).
- **Pasek testowy** w `index.html` (ukryty) pokazywany przez JS, gdy `cfg.env`. Zawiera link do produkcji i przycisk
  „Skopiuj dane z produkcji”.
- **Kopiowanie z produkcji** (`copyFromProd` w `js/app.js`): znajduje plik produkcji po nazwie, **tylko go czyta**,
  usuwa wszystko, co wskazuje na zasoby produkcji (u nas: id folderu i katalogu dla chórzystów, kopie, PDF-y,
  adres formularza zgłoszeń), i zapisuje jako dane testowe. Pytanie potwierdzające podaje datę pliku produkcji.

### 4. Service worker (`sw.js`)

Dwa problemy przy wspólnym originie:
- **Zasięg:** przy osobnym adresie (`/<repo>-test/`) zasięgi się nie nakładają. `SKIP = ['test/']` w SW produkcji zostało tylko po to,
  żeby stary adres `/<repo>/test/` (przekierowanie) nie był podmieniany stroną produkcji ze schowka.
- **Schowki:** Cache Storage jest wspólne dla originu, a każdy SW przy aktywacji kasuje „stare” schowki ze swoim przedrostkiem.
  Przedrostek jest więc w stałej `PREFIX`. `build-test.mjs` zmienia go na `test-…`, który **nie zaczyna się** od przedrostka produkcji.

### 5. Wygląd i instalacja (`tools/build-test.mjs`)

- `manifest.webmanifest`: inna nazwa (`… – TEST`, `short_name` z TEST) i `theme_color`. `start_url`/`scope` są względne (`./`),
  więc zainstalowany test to osobna aplikacja z osobną ikonką.
- `index.html`: `<title>`, `application-name`, `apple-mobile-web-app-title`, `theme-color`.
- Ikony: gotowe PNG w `tools/test-env/icons/` (te same nazwy plików co w `icons/`, podmieniane przy publikacji).
  Źródło `design/ikona-test.svg` to ikona produkcji z innym tłem i paskiem „TEST”. PNG generuje
  `make-icons.js` ze skilla pwa-na-telefon: `node make-icons.js design/ikona-test.svg tools/test-env/icons "#24476b"`.
- `build-test.mjs` przerywa publikację, gdy któraś podmiana nic nie zmieniła (np. po zmianie `index.html`).
  Lepszy błąd w Actions niż test, który po cichu wygląda jak produkcja.

## Lista kontrolna dla innej aplikacji

1. Wypisz **całą** pamięć, której aplikacja używa: localStorage/sessionStorage, IndexedDB (nazwy baz), Cache Storage,
   service worker, cookies. Każde trzeba rozdzielić (przedrostek albo nazwa z `env`).
2. Wypisz **zewnętrzne zasoby, do których aplikacja pisze**: pliki i foldery na Dysku, arkusze, formularze, API.
   Test musi pisać gdzie indziej, a produkcję co najwyżej czytać.
3. Wypisz rzeczy **„dla innych ludzi”** (publiczne linki, powiadomienia, formularze): w teście wyłącz albo skieruj na osobne.
4. Ustawienia testu trzymaj w jednym pliku doklejanym przy publikacji. Kod produkcji ma tylko proste `if (cfg.env)`.
5. Wyraźnie odróżnij wygląd: pasek, kolor, nazwa, ikona.
6. Adres testu **obok** produkcji, nie w jej podfolderze (zakres PWA). Na GitHub Pages: osobne repozytorium `<repo>-test` + token + sekret.
7. Linki z testu do produkcji pisz ścieżką bezwzględną (`/<repo>/`), bo `../` z `/<repo>-test/` prowadzi do korzenia domeny.
8. Sprawdź lokalnie: zbuduj obie strony jak workflow, w jednym katalogu jako `<repo>/` i `<repo>-test/`, uruchom `python3 -m http.server`
   w katalogu nad nimi i otwórz obie.
   Sprawdź, że klucze testu mają przedrostek i że produkcja nie widzi danych testu.
