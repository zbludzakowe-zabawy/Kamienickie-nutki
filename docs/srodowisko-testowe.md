# Środowisko testowe obok produkcji (GitHub Pages) – przepis

Jak zrobiona jest wersja testowa Kamienickich Nutek, opisane tak, żeby dało się to powtórzyć w innej
aplikacji: czysty HTML/JS bez budowania, PWA, publikacja przez GitHub Actions na GitHub Pages,
dane w przeglądarce i/lub na Dysku Google.

## Efekt

| | Produkcja | Test |
|---|---|---|
| Gałąź | `main` | `test` |
| Adres | `https://<konto>.github.io/<repo>/` | `https://<konto>.github.io/<repo>/test/` |
| Kto wprowadza zmiany | właściciel scala PR do `main` | PR do `test`, scalany na prośbę właściciela |
| Wygląd | normalny | pomarańczowy pasek „WERSJA TESTOWA”, inny kolor, ikona z napisem TEST |
| Dane | prawdziwe | osobne (kopia z produkcji na przycisk) |

Praca: gałąź robocza → PR do `test` → ręczne sprawdzenie pod adresem testowym → PR do `main`.

## Dlaczego podfolder `/test/`, a nie osobna domena czy osobne repozytorium

- **Jedno repozytorium, jedna publikacja.** GitHub Pages ma jedną stronę na repozytorium, ale workflow może
  do jednej paczki włożyć dwie gałęzie: `main` do katalogu głównego, `test` do `test/`.
- **To samo „źródło” (origin), więc logowanie Google działa bez zmian.** Klient OAuth i klucz API mają wpisane
  `https://<konto>.github.io` (z `/*`). Ścieżka się nie liczy, więc w Google Cloud nie trzeba nic dopisywać.
  Przy innej domenie (Netlify, Cloudflare Pages) trzeba by dopisać nowe źródło i odsyłacz.
- Wada tego samego originu: **wspólna pamięć przeglądarki** (localStorage, IndexedDB, Cache Storage, service worker).
  Trzeba ją rozdzielić. To najważniejsza część przepisu, niżej.

## Elementy

### 1. Workflow (`.github/workflows/pages.yml`)

- Uruchamia się przy pushu do `main` i `test`.
- **Publikuje zawsze przebieg z `main`.** Środowisko `github-pages` domyślnie pozwala publikować tylko z gałęzi
  domyślnej. Push do `test` uruchamia więc tylko krótkie zadanie, które zleca publikację z `main`:
  `gh workflow run pages.yml --ref main` (z `permissions: actions: write`). `GITHUB_TOKEN` nie może wywoływać
  innych workflow, ale `workflow_dispatch` jest wyjątkiem. Dzięki temu nie trzeba nic zmieniać w ustawieniach repozytorium.
- Przebieg z `main` pobiera obie gałęzie (`actions/checkout` z `ref` i `path`). Najpierw sprawdza, czy `test` istnieje
  (`git ls-remote --exit-code --heads origin test`). Potem składa:
  1. `main` → `_site/` i `build-sw.mjs _site` (**przed** dodaniem `test/`, żeby pliki testu nie trafiły do listy
     plików service workera produkcji),
  2. `test` → `_site/test/`, potem `build-test.mjs _site/test` i `build-sw.mjs _site/test`.
- Skrypty dla testu są brane **z gałęzi `test`** (`node test/tools/...`), więc zmiany w samym mechanizmie też da się najpierw przetestować.

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
- **Zasięg:** SW produkcji (zasięg `/<repo>/`) obejmuje też `/<repo>/test/` i podsuwałby tam stronę produkcji ze schowka.
  Rozwiązanie: `SKIP = ['test/']` względem `registration.scope`. Zapytania z tych ścieżek SW produkcji puszcza bez obsługi.
  Test ma własny SW (`/test/sw.js`, zasięg `/test/`), a węższy zasięg wygrywa.
- **Schowki:** Cache Storage jest wspólne dla originu, a każdy SW przy aktywacji kasuje „stare” schowki ze swoim przedrostkiem.
  Przedrostek jest więc w stałej `PREFIX`. `build-test.mjs` zmienia go na `test-…`, który **nie zaczyna się** od przedrostka produkcji.
- Uwaga przy pierwszym wdrożeniu: urządzenia z **wcześniejszym** SW produkcji (bez `SKIP`) do czasu odświeżenia
  („Dostępna nowa wersja” → Odśwież) mogą pod `/test/` pokazywać produkcję.

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
6. Workflow: jedna paczka z obu gałęzi, publikacja zawsze z `main`, push do `test` zleca publikację.
7. Sprawdź lokalnie: zbuduj `_site` jak workflow, uruchom `python3 -m http.server` w katalogu **nad** `_site`
   przemianowanym na nazwę repo (żeby ścieżki były jak na Pages), otwórz `/<repo>/` i `/<repo>/test/`.
   Sprawdź, że klucze testu mają przedrostek i że produkcja nie widzi danych testu.
