# Kamienickie Nutki – notatki dla Claude

Aplikacja (PWA, czysty HTML/JS bez buildu) do porządkowania nut chóru trzymanych na Dysku Google.
Użytkownik pisze po polsku – odpowiedzi, komunikaty w aplikacji, commity i PR-y po polsku.

- Strona: https://zbludzakowe-zabawy.github.io/Kamienickie-nutki/ (repo `zbludzakowe-zabawy/Kamienickie-nutki`, **wielkie K** w adresie!)
- Publikacja: GitHub Actions (`.github/workflows/pages.yml`) po każdym pushu do `main`.
- **Sposób pracy**: zmiany na gałęzi roboczej → push → **PR do `main`**. **Scala (wprowadza do `main`) wyłącznie użytkownik** –
  nigdy nie pushuj do `main` ani nie scalaj PR-ów. Wcześniej scalaliśmy bezpośrednio, ale od etapu 3 użytkownik prosi o PR.
  Równolegle może pracować inny wątek (gałąź `claude/funny-shannon-…`) – przed PR zawsze `git fetch` + `git merge origin/main`.
- Skill `pwa-na-telefon` to przepis użytkownika na PWA (manifest, SW, banery) – projekt jest według niego zrobiony.

## Dwa tryby

| | Administrator (dyrygent, komputer) | Chórzysta (telefon) |
|---|---|---|
| Logowanie | Google OAuth (GIS token client) | brak – tylko PIN |
| Dostęp do Dysku | `drive.readonly` + `drive.file` | klucz API (`?key=`) do plików publicznych |
| Widzi | zakładki: Nuty na Dysku / Spisy pieśni / Uroczystości / Dla chórzystów | uroczystości + śpiewniki → lista pieśni → nuty na cały ekran, PDF |

Tryb wybiera `js/mode.js` (w `<head>`, przed narysowaniem): `?chor=<id katalogu>` → chórzysta (zapamiętane w localStorage
`kn-mode`, `kn-guest-id`); `KN_CONFIG.publicCatalogId` jest ustawione (katalog chóru użytkownika), więc **domyślnie chórzysta**.
`html[data-mode]` + klasa `.admin-only` ukrywają część UI. Przełączniki: „Tryb administratora” na dole ekranu chórzysty,
„Widok chórzysty” w pasku administratora.

**Ochrona trybu administratora**: bez `localStorage['kn-admin']` (e-mail) `mode.js` dodaje `html.admin-locked` → widać tylko
ekran `#admin-lock` z „Zaloguj się kontem Google”. Po zalogowaniu (`unlock()` w app.js) urządzenie jest zapamiętane
i można pracować bez połączenia. Google wpuszcza tylko „użytkowników testowych” z konsoli – to jest właściwa bramka.
„Wyloguj” czyści dane z urządzenia (IndexedDB + klucze `kn-*`). `data.owner` = e-mail; przy logowaniu innym kontem
lokalne dane są odrzucane (pod przyszłe „wiele chórów”: każdy dyrygent = własne konto Google i własny Dysk).

## Pliki

- `index.html`, `style.css` – cały UI (karty, zakładki `data-tab`/`data-panel`, dialogi `#picker`, `#chooser`, widok gościa `#guest`, `#g-viewer`)
- `js/config.js` – `clientId` (OAuth), `apiKey`, `dataFileName`, `appFolderName`, opcjonalnie `publicCatalogId`
- `js/mode.js` – wybór trybu
- `js/store.js` – IndexedDB (klucze `data`, `sync`), awaryjnie localStorage
- `js/drive.js` – logowanie i całe Drive API (lista, skan, pobieranie, zapis JSON, foldery z tagiem `appProperties.kn`,
  kopie, uprawnienia „anyone reader”, upload multipart, `publicText()` z kluczem API)
- `js/catalog.js` – skan folderów (`scan`, `rescanFolder`), drzewo (`buildIndex`), `norm()` (bez polskich znaków)
  **Skróty Dysku**: węzły kluczowane identyfikatorem celu, więc skrót i oryginał = jeden węzeł (nie ma duplikatów ze skrótów).
  Jeśli pierwszy trafiony był skrót, węzeł ma `viaShortcut: true` (folder skrótu jako `parent`, bez `md5`/rozmiaru); gdy potem trafimy
  na prawdziwe położenie, `parent`/nazwa/`md5` są poprawiane (także przy ↻ jednego folderu). Duplikaty pokazują „(przez skrót)”.
- `js/zip.js` + `js/songlist.js` – odczyt spisu z .odt/.docx/.txt/Dokumentu Google; parsowanie „nr<tab>tytuł”, dedup po numerze
- `js/matcher.js` – dopasowanie pozycji spisu do plików (tokeny, wagi słów częstych, literówki, dopisek w nawiasie)
- `js/app.js` – UI administratora: konto, synchronizacja, foldery, drzewo, zakładki; eksportuje `window.App`
  (filtry drzewa: wszystkie / bez nazwy / z nazwą / nowe / **nieprzypisane do żadnego śpiewnika** = brak w `ok`/`auto` spisów, programy się nie liczą;
  „⬇ Pobierz listę” = CSV z widoczną listą: Lp.;Nazwa w aplikacji;Nazwa pliku;Folder;Rodzaj, UTF-8 z BOM, separator `;`)
- `js/songs.js` – zakładka „Spisy pieśni” (`window.Songs`)
- `js/dups.js` – porządkowanie Dysku (`window.Dups`): „Szukaj duplikatów” (karta `#dups-card` w „Nutach na Dysku”) i lista
  „Pozostałe nuty” (`othersItems()`); szczegóły w sekcji „Porządkowanie” niżej
- `js/crypto.js` – AES-GCM + PBKDF2 z PIN-u (`KnCrypto.encrypt/decrypt`)
- `js/pdfbuild.js` – PDF śpiewnika (pdf-lib z `js/vendor/`, spis treści rysowany na canvasie – polskie znaki bez fontów)
  + klikalny spis treści (`addLinks`: niewidoczne adnotacje Link nad wierszami, pozycje z `canvas.links`) i zakładki PDF
  (`addOutline`: „Spis treści” + pieśni, w programach pogrupowane wg części; `PageMode=UseOutlines`). Sprawdzanie: `pypdf` (jest w środowisku).
  **Po zmianie sposobu składania PDF podbij `PDF_FORMAT` w publish.js** (jest w podpisie) – inaczej istniejące PDF-y się nie przebudują.
- `js/programs.js` – zakładka „Uroczystości” (`window.Programs`): programy mszy, części, wybór pieśni (`#song-picker`), `forPublish()`
- `js/publish.js` – zakładka „Dla chórzystów” (`window.Publish`)
- `js/guest.js` – tryb chórzysty (`window.Guest`), routing po hashu `#/`, `#/s/<bookId>[/<i>]` (śpiewnik), `#/p/<programId>[/<i>]` (program; `i` = indeks w spłaszczonej liście pieśni)
- `js/pwa.js`, `sw.js`, `manifest.webmanifest`, `icons/` – PWA; `tools/build-sw.mjs` wpisuje wersję i listę plików przy publikacji
- `design/ikona.svg` – źródło ikony (otwarty śpiewnik); PNG generuje `make-icons.js` ze skilla pwa-na-telefon
  **Po zmianie ikony podbij `?v=N`** we wszystkich odwołaniach (`index.html`, `manifest.webmanifest`, `guest.js`, `style.css`) –
  inaczej przeglądarka/zainstalowana aplikacja na komputerze trzyma starą ikonę (te same nazwy plików). Teraz `?v=2`.

## Dane

Wszystko w jednym obiekcie `data` (IndexedDB + `Kamienickie Nutki/KamienickieNutki.json` na Dysku administratora;
przy połączeniu wygrywa nowszy `updatedAt`):

```
{ app, v, updatedAt, scannedAt, newAt,
  roots: [{id, name}],                      // wybrane foldery
  nodes: {id: {id, name, parent, folder?, kind:'pdf'|'img', size, modified, md5, added}},  // klucz = id pliku (dla skrótów – id celu)
  meta:  {fileId: {title, rot, page}},      // własne nazwy; rot = obrót 90/180/270°; page = kolejność strony (⇅) – tylko w aplikacji
  songbooks: [{id, name, code, source, importedAt,   // code = identyfikator do 3 znaków (Z, N…), nowe: A01, A02… (App.nextCode)
               items: [{no, title, state:'ok'|'auto'|'check'|'none'|'missing', files:[fileId], score, sugg:[{files,score}], rejected:[...]}]}],
  programs: [{id, name, date:'YYYY-MM-DD', createdAt,
              parts: [{id, name, items: [{title, note, files:[fileId], src?:{book, bookName, no}}]}]}],
  publish: {pin, pdf, hold:{id:true}, folderId, folderPublic, catalogId, copies:{origId:{id, modified}}, pdfs:{bookId|programId:{id, sig, size, pages, at}}, at, dataAt},
  dups: {at, hasMd5, groups: {gid: {type:'same'|'name'|'book', title, files:[id], entries?:[{book,i}], status:'open'|'kept'|'resolved', keep:[id], note, decidedAt, gone?}},
         cleanup: {fileId: {gid, manual?, title, name, own, path, parent, keep:[{id,name,path}], decidedAt, done, doneBy:'auto'|'manual', doneAt}}},
  owner }
```

**Kolejność stron** (jedno miejsce: `meta[id].page`): okno `#order-dlg` (`App.openOrder(ids, title)`) z przyciskami ⇅ w drzewie
(pliki tej samej pieśni w jednym folderze – `songKey`/`siblingsMap`), w spisach (pozycja z ≥2 plikami), w programach i w duplikatach
(zaznaczone). Zapis ustawia `page` 1..n i przestawia `files` we wszystkich śpiewnikach/programach, gdzie te pliki są razem (`applyOrder`).
Każda nowa lista plików pieśni idzie przez `App.orderFiles()` (najpierw `page`, potem folder/nazwa) – zatwierdzanie propozycji,
okno „Wybierz plik…”, „Pozostałe nuty”. Zmiana kolejności zmienia podpis śpiewnika → „są zmiany” → PDF i chórzyści po „Aktualizuj”.

Stany pozycji: `ok` zatwierdzone ręcznie, `auto` pewne automatyczne, `check` do sprawdzenia, `none` brak, `missing` „nie mamy” potwierdzone.
Chórzyści widzą tylko `ok` i `auto`. `matchItems` nie rusza `ok`/`missing`.
Przy `check`/`none` propozycje (`candsOf`: główna + `sugg`) mają pola wyboru – „✓ Zatwierdź zaznaczone” łączy kilka plików
(posortowane po ścieżce/nazwie, żeby strony szły po kolei); „✕ Żadne nie pasuje” odrzuca wszystkie widoczne. Przy `ok`/`auto`: „Zmień / dodaj pliki…” (okno `#chooser`, też wielokrotny wybór).
**Ręczna edycja spisu** (songs.js): ✎ przy pozycji = numer i tytuł (nowy tytuł → ponowne dopasowanie, chyba że `ok`/`missing`),
✕ = usunięcie, pasek „+ Dodaj pozycję” (miejsce wg numeru `parseInt`, inaczej na końcu). Po dodaniu/usunięciu `shiftProgramRefs()`
przesuwa `src.i` w programach uroczystości (usunięta pozycja → program zachowuje zapamiętane pliki, `src` znika). Plik spisu na Dysku się nie zmienia.

**Programy uroczystości**: domyślny szkielet części (Wejście, Kyrie, Gloria, Psalm, Alleluja lub Chwała, Ofiarowanie, Sanctus,
Agnus Dei, Komunia, Uwielbienie, Wyjście) – części można dodawać/usuwać/przestawiać/zmieniać nazwę, w części kilka pieśni.
Pieśń ze spisu ma `src` → przy publikacji bierzemy **aktualne** dopasowanie z tego spisu (`Programs.resolve`); można też dodać plik
albo sam tytuł „bez nut”. Przycisk „♪ Dołącz nuty” / „Zmień nuty” przy pieśni (`openPicker(pi, ii)`) podmienia tylko
`files`/`src` – tytuł i uwaga zostają. `src.i` = indeks pozycji w spisie (pewniejsze niż sam numer, zwłaszcza w spisach bez numerów). Program z datą w przeszłości = archiwum (u administratora i chórzysty), nadal widoczny, dopóki nie usunięty.
„Kopiuj” tworzy kopię bez daty. Puste części są ukryte u chórzystów i w PDF. PDF programu = pseudo-śpiewnik z wierszami `section`.

## Porządkowanie: duplikaty i „Pozostałe nuty”

- **Szukaj duplikatów** (przycisk obok „Skanuj Dysk”, tylko po skanowaniu) – grupy: `m:<md5>` identyczna treść (md5 z Dysku, pobierane
  od tej wersji przy skanowaniu – starsze skany go nie mają), `n:<klucz nazwy>` ta sama nazwa (Twoja albo pliku, bez numerów stron i „kopia”)
  w **różnych** folderach (w jednym folderze to strony jednej pieśni), `b:<tytuł>` ta sama pieśń w różnych spisach z różnymi plikami.
- Decyzje (`status`, `keep`) zapisane w `data.dups` – przy ponownym szukaniu zostają; grupa wraca do „do przejrzenia”, gdy doszły nowe pliki;
  znika, gdy po skanowaniu nie jest już duplikatem (np. użytkownik usunął plik). Po każdym skanowaniu szukanie odpala się samo (`detect(true)`).
- „Zostaw tylko zaznaczone” → reszta na **listę „Do sprzątnięcia na Dysku”** (`data.dups.cleanup`, `toCleanup()`); przy jednym
  zachowanym pliku przepinamy śpiewniki i programy na niego (`repoint`). „Użyj tych wszędzie” (konflikt w spisach) też dopisuje
  pozostałe wersje do listy. Pliki **nadal używane** gdzie indziej (inna pieśń, program) nie trafiają na listę – ostrzeżenie w komunikacie.
  Wpis zapamiętuje nazwę, folder i zachowany plik w chwili decyzji. Odhaczanie: automatycznie po skanowaniu, gdy pliku już nie ma
  (`syncCleanup`, „✓ usunięty z Dysku”), albo ręcznie „✓ Zrobione” / „↺”. `toRemove()` = niezrobione wpisy z istniejącymi plikami
  (tag w drzewie, filtr „Duplikaty do usunięcia”, wykluczenie z „Pozostałych nut”). Pobieranie: strona HTML (foldery z linkami, pola do odhaczania)
  i CSV (folder, plik, linki, powód, zachowany plik, data, stan). Rozstrzygnięte grupy **zostają w historii** (`gone: true`), gdy przestaną być
  duplikatem – żeby było widać, gdzie był problem. Aplikacja **nie usuwa** plików – daje linki do pliku i folderu.
  „Nadaj nazwę zaznaczonym (n)” = własna nazwa tylko dla zaznaczonych plików (jednego albo kilku); bez zaznaczenia przycisk nieaktywny.
  **„🗑 Do wyrzucenia (n)”** = zaznaczone pliki na listę sprzątania niezależnie od decyzji w grupie (`cleanup[id].manual`, powód „oznaczony ręcznie”);
  plik używany w śpiewniku/programie – tylko po `confirm`. Przy pliku na liście: tag „do wyrzucenia/do usunięcia” + „↺ nie wyrzucaj” (usuwa wpis).
  „↺ Otwórz ponownie” nie kasuje ręcznych oznaczeń. Konflikt w spisach: „Użyj tych wszędzie” / „Zostaw różne wersje”.
- **Pozostałe nuty** (decyzja użytkownika): pliki nieprzypisane do żadnego spisu (`ok`/`auto`) i nie „do usunięcia”, strony z jednego folderu
  i o tej samej nazwie = jedna pozycja, alfabetycznie. U administratora zawsze aktualne; chórzyści widzą **migawkę** (`publish.others.snapshot`)
  z ostatniego kliknięcia „Aktualizuj „Pozostałe nuty”” (zwykłe „Aktualizuj” jej nie zmienia); **PDF tylko przyciskiem „Utwórz PDF”**
  (`publish.others.pdf`, z datą „stan na”). Przełącznik „widoczny dla chórzystów”. W katalogu to śpiewnik `id:'others'`, `auto:true`.

## Publikacja dla chórzystów

1. Folder `Kamienickie Nutki/Dla chórzystów` (tag `kn=public`) z uprawnieniem „anyone with link: reader” (pliki dziedziczą).
2. Kopie użytych nut (`files.copy`, awaryjnie pobranie + upload); kopiowane tylko nowe/zmienione (`modified`), zbędne kasowane.
3. PDF każdego śpiewnika – budowany tylko, gdy zmienił się podpis (`sig` = hash pozycji i plików).
4. Katalog `spiewniki-dla-chorzystow.json` – zaszyfrowany PIN-em (`KnCrypto`), zawiera `songbooks` i `programs` (id kopii i PDF).
   Link dla chórzystów: `<strona>?chor=<catalogId>`. Zmiana PIN-u = tylko ponowny zapis katalogu.
**Obrót** (`meta[id].rot`, przycisk ⟳ w drzewie i przy plikach w duplikatach → okno `#rot-dlg` z podglądem obrazka, `App.openRotate(id)`): oryginał na Dysku bez zmian.
   Przy publikacji plik z obrotem jest pobierany, obracany (`PdfBuild.rotate`: obraz przez canvas, PDF przez `setRotation`)
   i wgrywany jako kopia; w PDF-ach śpiewników też obrócony. `rot` jest w podpisie (`sig`) i w `copies[id].rot` → zmiana obrotu = „są zmiany”.
**Wstrzymanie PDF** (`publish.hold[id]`, pole „aktualizuj PDF, jeśli trzeba” przy każdym śpiewniku/programie, domyślnie zaznaczone):
   odznaczone = przy publikacji PDF się nie przebudowuje (zostaje stary), lista pieśni w aplikacji nadal się aktualizuje.
   Gdy PDF nie odpowiada stanowi (`status.books[id].stale`), katalog ma `stale:true` + `pdfAt` → chórzysta widzi „PDF może być nieaktualny (stan na …)”.
**Identyfikator śpiewnika** (`code`, pole „Identyfikator” obok nazwy spisu w „Spisach pieśni” (`#sb-code`), unikalny; w „Dla chórzystów” tylko podgląd): w programach uroczystości tytuł dostaje dopisek `[N 34]`
   (`Programs.tag`: kod + numer pozycji ze `src`, a dla pieśni dodanej jako plik – pozycja spisu z tymi samymi plikami). Dopisek liczony
   na bieżąco (nie zapisany w tytule) – trafia do `forPublish()`, więc do katalogu i PDF programu.
5. **Stan aktualności**: po publikacji zapisujemy `publish.sigs[id]` (podpis każdego śpiewnika/programu), `publish.published` (lista id)
   i `publish.pdfPublished`. `computeStatus()` porównuje bieżące podpisy → przy każdej pozycji „✓ aktualny” / „● są zmiany” / „● nowy”.
   Gdy nic się nie zmieniło, przycisk to „✓ Wszystko aktualne” (nieaktywny) + link „Aktualizuj mimo to” (np. po zmianie własnych nazw plików,
   których podpis nie obejmuje). Po aktualizacji komunikat: „Zaktualizowano: … Bez zmian (pominięte): …”.
   Gałęzi roboczej nie nadpisujemy (`push -f` zablokowane) – po scaleniu PR dołączamy `main` zwykłym `git merge origin/main`.

Chórzysta: `Drive.publicText(catalogId)` (klucz API) → PIN → katalog; kopia koperty w localStorage (`kn-guest-env`), PIN w `kn-guest-pin`.
Nuty: `<iframe src="https://drive.google.com/file/d/<id>/preview">` (nowa ramka na każdy plik, żeby nie psuć historii „wstecz”).
PDF: `https://drive.google.com/uc?export=download&id=<pdfId>`.

**iPhone**: aplikacja z ekranu początkowego ma osobną pamięć od Safari i startuje z `start_url` bez `?chor=`.
Rozwiązanie: wpisać `publicCatalogId` do `js/config.js` (id z linku po pierwszej publikacji) – wtedy zwykły adres działa dla wszystkich.

## Google Cloud (konfiguruje użytkownik)

Projekt KamienickieNutki, włączone Google Drive API, ekran zgody w trybie **Testowanie** (konto dyrygenta jako użytkownik testowy),
klient OAuth „Aplikacja internetowa” ze źródłami `https://zbludzakowe-zabawy.github.io` i `http://localhost:8000`,
klucz API ograniczony do Drive API i odsyłaczy `https://zbludzakowe-zabawy.github.io/*`, `http://localhost:8000/*`.
Token wygasa po ok. godzinie – to normalne (brak serwera = brak odświeżania w tle).

## Testowanie

```bash
python3 -m http.server 8000
```

- Lokalnie (`http://localhost:8000`) service worker się nie rejestruje (tylko HTTPS).
- Zwykły adres otwiera tryb chórzysty (bo `publicCatalogId`). W testach administratora: kliknij `#g-admin`, potem `#btn-unlock`
  (albo ustaw przed startem `localStorage` `kn-mode=admin`, `kn-admin=<e-mail>`).
- Prawdziwy katalog chóru da się pobrać z tego środowiska (curl/Playwright do www.googleapis.com działa, z `Referer: https://zbludzakowe-zabawy.github.io/`
  albo ze strony na localhost:8000) – przydatne przy diagnozie „nie udało się wczytać śpiewników”.
- Z tego środowiska nie ma dostępu do github.io ani prawdziwego Google – testy Playwright robimy na **udawanym Dysku**:
  `ctx.route('https://accounts.google.com/gsi/client', …)` podstawia `google.accounts.oauth2` (initTokenClient → callback z tokenem),
  `ctx.route('https://www.googleapis.com/**', …)` odpowiada na `files`, `about`, `upload`, `copy`, `permissions`, `alt=media`.
- Spis do testów: plik użytkownika `spiewnik_spistresci.odt` (78 pozycji + druga strona alfabetyczna) – jeśli nie ma go w uploadach,
  poproś użytkownika albo zrób podobny .txt („1<tab>Alleluja radosne”…).
- Sprawdzaj: brak błędów w konsoli, widok telefonu (`devices['Pixel 7']`) i komputera (1200 px), zrzuty ekranu.
- Status publikacji: `mcp__github__actions_list` (workflow „Publikacja na GitHub Pages”).

## Decyzje użytkownika (do pamiętania)

- **Na razie aplikacja jest tylko dla jednego dyrygenta, jego Dysku i jego chóru** (Kamienickie Nutki). Nie komplikujemy pod wielu użytkowników,
  ale też nie zamykamy tej drogi.
- Administrator pracuje głównie na **komputerze**, chórzyści na **telefonie**.
- Ochrona trybu administratora: **logowanie Google raz na urządzenie** (wybrane zamiast „zakładki tylko po połączeniu z Dyskiem”,
  bo administrator nie zawsze chce być połączony, i zamiast hasła w kodzie, bo dałoby się je odczytać ze źródła strony).
- Chórzyści widzą **wszystkie śpiewniki i wszystkie pozycje** (bez nut – wyszarzone, nieklikalne), mogą pobrać PDF śpiewnika. PIN startowy 2018.
- Ikona: otwarty śpiewnik z nutami (bordo `#8c2f39`, kartki kremowe).
- PR-y opisujemy po polsku, z sekcjami „Co się zmienia”, „Sprawdzone” (uczciwie: co testowane na udawanym Dysku, czego nie dało się sprawdzić),
  „Po scaleniu” (co użytkownik ma kliknąć).

## Daleka przyszłość: aplikacja dla wielu chórów

Użytkownik chce kiedyś udostępnić aplikację innym chórom („to daleka droga”). Co już temu sprzyja i co trzeba będzie zmienić:

- ✅ Każdy dyrygent loguje się **własnym kontem Google**, dane trzyma na **własnym Dysku** (`data.owner`, folder aplikacji z tagiem `kn=app`).
- ✅ Katalog dla chórzystów jest per dyrygent (`?chor=<catalogId>`), zaszyfrowany jego PIN-em.
- ❌ `publicCatalogId` wpisany na stałe w `js/config.js` → trzeba zastąpić wyborem chóru (np. lista/kod chóru, krótkie linki, zapamiętanie wielu chórów u chórzysty).
- ❌ Ekran zgody Google w trybie **Testowanie** (limit 100 użytkowników testowych, ręczne dopisywanie) → publikacja aplikacji i **weryfikacja Google**
  (zakres `drive.readonly` jest „restricted” – weryfikacja wymaga audytu bezpieczeństwa; alternatywa: przejść na `drive.file` + Google Picker,
  wtedy dyrygent wskazuje foldery/pliki w okienku Google i nie trzeba szerokiego zakresu).
- ❌ Nazwa/ikona/teksty „Kamienickie” → nazwa chóru z ustawień.
- ❌ Klucz API i klient OAuth są projektu użytkownika – przy wielu chórach to nadal może zostać jeden projekt, ale wtedy limity/koszty są po stronie właściciela.

## Pomysły / dalsze etapy

- **Wybieranie pieśni do przebudowy** (użytkownik: „wyszukiwarka na razie nie działa idealnie”) – dotyczy okna „Dodaj pieśń”
  w programach (`renderPicker` w programs.js: proste dopasowanie słów) i „Wybierz plik…” w spisach. Do omówienia z użytkownikiem.

- Nuty offline u chórzysty (kopie w pamięci telefonu) – teraz podgląd wymaga internetu.
- Własne PDF-y z wybranych pozycji (np. „na niedzielę”) – pdfbuild.js już umie składać.
- Ponowne wczytanie zmienionego spisu z zachowaniem dopasowań.
