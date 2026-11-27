# Kamienickie Nutki – notatki dla Claude

Aplikacja (PWA, czysty HTML/JS bez buildu) do porządkowania nut chóru trzymanych na Dysku Google.
Użytkownik pisze po polsku – odpowiedzi, komunikaty w aplikacji, commity i PR-y po polsku.

- Strona: https://zbludzakowe-zabawy.github.io/Kamienickie-nutki/ (repo `zbludzakowe-zabawy/Kamienickie-nutki`, **wielkie K** w adresie!)
- Publikacja: produkcja = GitHub Actions (`.github/workflows/pages.yml`) po każdym pushu do `main`; wersja testowa = push do `test` (niżej).
- **Sposób pracy (ustalony z użytkownikiem 2026-11-22 – „nasz sposób na środowisko testowe”):**
  1. Gałąź robocza od aktualnego `main` (`git fetch` + `git merge origin/main`; równolegle mogą pracować inne wątki).
  2. **Domyślnie każda zmiana idzie najpierw na testy**: PR gałęzi roboczej do `test` → **scalam go sam** (bez pytania) → sprawdzam,
     że workflow „Publikacja wersji testowej” przeszedł.
  3. **Po każdej zmianie przypominam użytkownikowi**: „Zmiana jest na wersji testowej (link). Jeśli ma trafić na produkcję – daj znać.”
  4. Na produkcję **tylko na wyraźną prośbę użytkownika**: PR tej samej gałęzi roboczej do `main` (bez innych, niezatwierdzonych zmian z `test`)
     → **scala wyłącznie użytkownik**. Nigdy nie pushuj do `main` ani nie scalaj PR-ów do `main`.
     **Po każdym scaleniu do `main` sprawdzam**, że workflow „Publikacja na GitHub Pages” (`pages.yml`) skończył się sukcesem
     (`mcp__github__actions_list`, przy błędzie `get_job_logs`) i mówię o tym użytkownikowi (decyzja użytkownika 2026-11-26).
     Powód: #58 i #59 były scalone, ale publikacja padła (`deploy-pages@v4`: „No artifacts named github-pages”) i produkcja stała
     na starej wersji – użytkownik widział „niespójne wersje”. Naprawione w #64 (configure-pages@v6, upload-pages-artifact@v5, deploy-pages@v5).
  5. „Uaktualnij testy” = PR `main` → `test` i scalenie (gdy na produkcję weszło coś spoza testów, np. z innego wątku).
  Zmiany w samym CLAUDE.md (notatki) działają w nowych sesjach dopiero po wejściu do `main` – przy takich zmianach od razu proponuj PR do `main`.
- **Wersja testowa**: gałąź `test` → https://zbludzakowe-zabawy.github.io/Kamienickie-nutki-test/ (pasek „WERSJA TESTOWA”, ikona TEST).
  Na telefonie i komputerze to osobna aplikacja (osobna ikonka) – sprawdzone przez użytkownika. Publikacja: `.github/workflows/test-pages.yml` buduje i wypycha stronę do gałęzi `gh-pages`
  repozytorium `zbludzakowe-zabawy/Kamienickie-nutki-test` (sekret `TEST_PAGES_TOKEN`, token z datą ważności!). **Nie podfolder `/test/` produkcji** –
  tam telefon widział test jako część zainstalowanej produkcji (jedna ikonka); pod starym `/Kamienickie-nutki/test/` jest teraz przekierowanie.
  Osobne dane: `tools/test-env/config.test.js` doklejany do `config.js` (`tools/build-test.mjs`): `env:'test'`, plik
  `KamienickieNutki-TEST.json`, foldery ze znacznikiem `kn=test-app`/`test-public`, klucze localStorage z przedrostkiem `test~`, baza
  IndexedDB `kamienickie-nutki-test`, schowki SW `test-kamienickie-nutki-` (ta sama domena = wspólna pamięć). „Skopiuj dane z produkcji”
  (`copyFromProd` w app.js) tylko CZYTA plik produkcji i czyści `publish` (zostaje PIN) oraz `reports.form`.
  Przepis ogólny: `docs/srodowisko-testowe.md`. Nowe miejsca pamięci / zapisu na Dysku → pamiętaj o rozdzieleniu dla `cfg.env`.
- Skill `pwa-na-telefon` to przepis użytkownika na PWA (manifest, SW, banery) – projekt jest według niego zrobiony.

## Dwa tryby

| | Administrator (dyrygent, komputer) | Chórzysta (telefon) |
|---|---|---|
| Logowanie | Google OAuth (GIS token client) | brak – tylko PIN |
| Dostęp do Dysku | `drive.readonly` + `drive.file` | klucz API (`?key=`) do plików publicznych |
| Widzi | zakładki: Nuty na Dysku / Katalog / Spisy pieśni / Uroczystości / Dla chórzystów | start: Śpiewniki / Uroczystości / Katalog nut → lista pieśni → nuty na cały ekran, PDF |

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
  Gdy oryginał leży **poza wybranymi folderami** (zostaje `viaShortcut`), `resolveShortcuts` na końcu `scan` pyta Dysk (`Drive.meta`) o rodziców
  → `n.real` = „Mój dysk / Muzyka / Śluby” (+ `realName`, rozmiar, data, md5). W drzewie tag „↪ skrót · oryginał: …” (`shortcutTag` w app.js),
  w spisach w podpowiedzi chipa, w duplikatach obok ścieżki. Przypadek użytkownika: „Wielkie są dzieła” w folderze „Ślub Magdy…” był tylko skrótem.
- `js/zip.js` + `js/songlist.js` – odczyt spisu z .odt/.docx/.txt/Dokumentu Google; parsowanie „nr<tab>tytuł”, dedup po numerze.
  **Tabele** (.odt `table:table-row`, .docx `w:tr`): wiersz = komórki połączone tabulatorem („35<tab>Tytuł”). Ten sam numer + tytuł z tych
  samych słów (`sameSong`, ≥60% wspólnych słów, np. „A (B)” i „B (A)”) = **tytuł alternatywny** `alt`; różne pieśni z tym samym numerem
  zostają osobno. Gdy wszystkie numery są liczbami – kolejność według numerów (np. plik zaczyna się od spisu alfabetycznego).
  Przykład: `spiewnik2_spistresci.odt` (2 tabele: alfabetyczna i według numerów, 74 pieśni, 83 tytuły, 9 alternatywnych).
- `js/matcher.js` – dopasowanie pozycji spisu do plików (tokeny, wagi słów częstych, literówki, dopisek w nawiasie)
- `js/app.js` – UI administratora: konto, synchronizacja, foldery, drzewo, zakładki; eksportuje `window.App`
  (filtry drzewa: wszystkie / bez nazwy / z nazwą / nowe / **nieprzypisane do żadnego śpiewnika** = brak w `ok`/`auto` spisów, programy się nie liczą;
  „⬇ Pobierz listę” = CSV z widoczną listą: Lp.;Nazwa w aplikacji;Nazwa pliku;Folder;Rodzaj, UTF-8 z BOM, separator `;`)
- `js/songs.js` – zakładka „Spisy pieśni” (`window.Songs`)
- `js/dups.js` – porządkowanie Dysku (`window.Dups`): „Szukaj duplikatów” (karta `#dups-card` w „Nutach na Dysku”) i lista
  „Pozostałe nuty” (`othersItems()`); szczegóły w sekcji „Porządkowanie” niżej
- `js/works.js` – zakładka „Katalog” (`window.Works`): katalog wszystkich nut z cechami; szczegóły w sekcji „Katalog nut” niżej
- `js/crypto.js` – AES-GCM + PBKDF2 z PIN-u (`KnCrypto.encrypt/decrypt`)
- `js/pdfbuild.js` – PDF śpiewnika (pdf-lib z `js/vendor/`, spis treści rysowany na canvasie – polskie znaki bez fontów)
  + klikalny spis treści (`addLinks`: niewidoczne adnotacje Link nad wierszami, pozycje z `canvas.links`) i zakładki PDF
  (`addOutline`: „Spis treści” + pieśni, w programach pogrupowane wg części; `PageMode=UseOutlines`). Sprawdzanie: `pypdf` (jest w środowisku).
  **Po zmianie sposobu składania PDF podbij `PDF_FORMAT` w publish.js** (jest w podpisie) – inaczej istniejące PDF-y się nie przebudują.
- `js/programs.js` – zakładka „Uroczystości” (`window.Programs`): programy mszy, części, wybór pieśni (`#song-picker`), `forPublish()`
- `js/publish.js` – zakładka „Dla chórzystów” (`window.Publish`)
- `js/guest.js` – tryb chórzysty (`window.Guest`), routing po hashu: `#/` = ekran startowy z trzema kafelkami (decyzja użytkownika 2026-11-22),
  `#/spiewniki`, `#/uroczystosci` (nadchodzące + archiwum), `#/katalog[/<i>]` (katalog nut),
  ikonki kafelków (wybór użytkownika): Uroczystości = „sztandar i świece” (`PROG_ICO`), Katalog = „lupa i nuta” (`CAT_ICO`) – SVG w guest.js,
  jasny rysunek na `--accent` jak ikona „Śpiewniki” (klasa `.g-cat-ico`; ciemny rysunek na jasnym tle był „za ciemny”); `#/s/<bookId>[/<i>]` (śpiewnik), `#/p/<programId>[/<i>]` (program; `i` = indeks w spłaszczonej liście pieśni)
- `js/pwa.js`, `sw.js`, `manifest.webmanifest`, `icons/` – PWA; `tools/build-sw.mjs` wpisuje wersję i listę plików przy publikacji
- `design/ikona.svg` – źródło ikony (otwarty śpiewnik); PNG generuje `make-icons.js` ze skilla pwa-na-telefon
  **Po zmianie ikony podbij `?v=N`** we wszystkich odwołaniach (`index.html`, `manifest.webmanifest`, `guest.js`, `style.css`) –
  inaczej przeglądarka/zainstalowana aplikacja na komputerze trzyma starą ikonę (te same nazwy plików). Teraz `?v=2`.

## Dane

Wszystko w jednym obiekcie `data` (IndexedDB + `Kamienickie Nutki/KamienickieNutki.json` na Dysku administratora;
synchronizacja – patrz „Synchronizacja z Dyskiem” niżej):

```
{ app, v, updatedAt, scannedAt, newAt,
  roots: [{id, name}],                      // wybrane foldery
  nodes: {id: {id, name, parent, folder?, kind:'pdf'|'img', size, modified, md5, added}},  // klucz = id pliku (dla skrótów – id celu)
  meta:  {fileId: {title, rot, page, notNotes, ignore}},  // własne nazwy; rot = obrót 90/180/270°; page = kolejność strony (⇅); notNotes = „to nie nuty”; ignore = „nieistotne” (też dla folderów) – tylko w aplikacji
  songbooks: [{id, name, code, source, importedAt, restoredAt?,   // code = identyfikator do 3 znaków (Z, N…), nowe: A01, A02… (App.nextCode)
               items: [{no, title, alt?:[tytuły alternatywne], state:'ok'|'auto'|'check'|'none'|'missing', files:[fileId], score, sugg:[{files,score}], rejected:[...]}]}],
  programs: [{id, name, date:'YYYY-MM-DD', createdAt, restoredAt?,
              parts: [{id, name, items: [{title, note, files:[fileId], src?:{book, bookName, no}}]}]}],
  publish: {pin, pdf, hold:{id:true}, folderId, folderPublic, catalogId, copies:{origId:{id, modified}}, pdfs:{bookId|programId:{id, sig, size, pages, at}}, at, dataAt,
            sigs:{id|'__works': podpis}, published:[id], others:{enabled, snapshot, at, pdf}, works:{enabled}},
  dups: {at, hasMd5, groups: {gid: {type:'same'|'name'|'book', title, files:[id], entries?:[{book,i}], status:'open'|'kept'|'resolved', keep:[id], note, decidedAt, gone?}},
         cleanup: {fileId: {gid, manual?, title, name, own, path, parent, keep:[{id,name,path}], decidedAt, done, doneBy:'auto'|'manual', doneAt}}},
  catalog: {tags: [{id, name}], works: {id: {id, title, ownTitle?, lyrics, music, tags:[tagId], files:[fileId], manual?, at}}},
  reports: {form:{url, entry, sheetId, formLink, sheetLink}, list, done},
  deleted: {songbookId|programId: ISO},   // usunięte – żeby nie wróciły przy łączeniu danych z innego urządzenia
  owner }
```

**Synchronizacja z Dyskiem** (poprawione 2026-11-20 po zgłoszeniu „zniknął spis Adwent”): dawniej wygrywał cały plik z nowszym `updatedAt`,
więc urządzenie ze starymi danymi (wystarczyło, że katalog przeliczył się przy starcie i podbił `updatedAt`) nadpisywało plik na Dysku i znikały
nowe spisy. Teraz `sync.baseAt` = `updatedAt` wersji z Dysku, którą urządzenie ostatnio wczytało/zapisało, `sync.remoteMod` = jej `modifiedTime`.
Przy połączeniu: brak niezapisanych zmian → obowiązuje Dysk; zmiany tylko tutaj (Dysk = `baseAt`) → zapis; zmiany tu i tam → `mergeRemote`
(`js/datamerge.js`, `DataMerge.merge`: spisy/programy/meta/cechy/utwory łączone po id, przy różnicy w tym samym obiekcie wygrywa Dysk, a wersja z urządzenia
idzie do kopii `KamienickieNutki-kopia-z-urzadzenia-….json` w folderze aplikacji; publikacja/duplikaty/drzewo – z nowszej strony). Przed każdym zapisem
`guardRemote` sprawdza `modifiedTime` pliku (inne urządzenie otwarte równolegle). **„Odzyskaj…”** (pasek konta, `#hist-dlg`): przegląda wersje pliku
na Dysku (`Drive.revisions`/`readRevision`) i pozwala przywrócić spisy i programy, których teraz brakuje (`DataMerge.missing`).
**Usunięcia nie wracają** (2026-11-23, zgłoszenie: dwie przeglądarki na jednym komputerze – Opera ze starymi danymi przywracała usunięte spisy):
usunięcie spisu/programu zapisuje `data.deleted[id] = ISO` (`App.markDeleted`); `DataMerge.merge(local, remote, sync.baseAt)` wyrzuca obiekty starsze
niż usunięcie oraz obiekty tylko z urządzenia, które powstały (`importedAt`/`createdAt`/`restoredAt`) przed `baseAt` (były na Dysku, ktoś je usunął).
Wyrzucenie = kopia wersji z urządzenia jak przy konflikcie. Ustawienia formularza zgłoszeń: wypełnione nie są zastępowane pustymi.
„Odzyskaj…”: nic nie jest zaznaczone, przy pozycji ostrzeżenia „usunięty w aplikacji …” i „masz już spis o tej nazwie” (`nameKey` bez znaków),
przywrócone mają `restoredAt` (dopisek w spisach/programach i na liście spisów, która pokazuje też `[kod] · N poz.`).

**Kolejność stron** (jedno miejsce: `meta[id].page`): okno `#order-dlg` (`App.openOrder(ids, title)`) z przyciskami ⇅ w drzewie
(pliki tej samej pieśni w jednym folderze – `songKey`/`siblingsMap`), w spisach (pozycja z ≥2 plikami), w programach i w duplikatach
(zaznaczone). Zapis ustawia `page` 1..n i przestawia `files` we wszystkich śpiewnikach/programach, gdzie te pliki są razem (`applyOrder`).
Każda nowa lista plików pieśni idzie przez `App.orderFiles()` (najpierw `page`, potem folder/nazwa) – zatwierdzanie propozycji,
okno „Wybierz plik…”, „Pozostałe nuty”. Zmiana kolejności zmienia podpis śpiewnika → „są zmiany” → PDF i chórzyści po „Aktualizuj”.

Stany pozycji: `ok` zatwierdzone ręcznie, `auto` pewne automatyczne, `check` do sprawdzenia, `none` brak, `missing` „nie mamy” potwierdzone.
Chórzyści widzą tylko `ok` i `auto`. `matchItems` nie rusza `ok`/`missing`.
Przy `check`/`none` propozycje (`candsOf`: główna + `sugg`) mają pola wyboru – „✓ Zatwierdź zaznaczone” łączy kilka plików
(posortowane po ścieżce/nazwie, żeby strony szły po kolei); „✕ Żadne nie pasuje” odrzuca wszystkie widoczne. Przy `ok`/`auto`: „Zmień / dodaj pliki…” (okno `#chooser`, też wielokrotny wybór).
**Tytuły alternatywne** (`alt`): dopasowanie nut po wszystkich tytułach (`Matcher.rankAll`), wyszukiwanie u administratora i chórzysty,
wyświetlane „też: …”, w katalogu dla chórzystów i w podpisie śpiewnika.
**↻ Wczytaj ponownie…** (okno `#reload-dlg`: ten sam plik z Dysku / inny z Dysku / z komputera; `reloadBook`): nowe pozycje z pliku,
a decyzje (`state`, `files`, `rejected`…) przenoszone ze starych pozycji – para po wspólnym tytule (także alt; preferowany ten sam numer),
a gdy tytuł poprawiony – ten sam numer + `sameSong`. Nazwa, `code` i id spisu zostają; `src.i`/`src.no` w programach przesunięte
(pozycja bez pary → `src` znika, program zachowuje nuty). Komunikat: zachowane / nowe / połączone jako drugi tytuł / usunięte.
`reloadId` pobierany od razu po wyborze pliku (`takeReload`), zamknięcie okna bez wyboru go kasuje.
**Ręczna edycja spisu** (songs.js): ✎ przy pozycji = numer i tytuł (nowy tytuł → ponowne dopasowanie, chyba że `ok`/`missing`),
✕ = usunięcie, przycisk **„+ Dodaj pozycję”** w pasku narzędzi spisu (obok „Wczytaj ponownie”, 2026-11-27) pokazuje pole Nr + Tytuł (`#sb-add`,
zostaje otwarte do dopisywania kolejnych, „Gotowe” chowa; miejsce wg numeru `parseInt`, inaczej na końcu).
**„+ Nowy spis”** (obok „Wczytaj spis z Dysku / z komputera”, `newBook`, 2026-11-27): pusty spis bez pliku – `source: {kind:'manual'}`, nazwa z `prompt`,
kod `A.nextCode`, od razu otwarte pole dopisywania; pod nazwą „utworzony ręcznie …”. „Wczytaj ponownie” działa (bez opcji „ten sam plik”). Po dodaniu/usunięciu `shiftProgramRefs()`
przesuwa `src.i` w programach uroczystości (usunięta pozycja → program zachowuje zapamiętane pliki, `src` znika). Plik spisu na Dysku się nie zmienia.

**Programy uroczystości**: domyślny szkielet części (Wejście, Kyrie, Gloria, Psalm, Alleluja lub Chwała, Ofiarowanie, Sanctus,
Agnus Dei, Komunia, Uwielbienie, Wyjście) – części można dodawać/usuwać/przestawiać/zmieniać nazwę, w części kilka pieśni.
Pieśń ze spisu ma `src` → przy publikacji bierzemy **aktualne** dopasowanie z tego spisu (`Programs.resolve`); można też dodać plik
albo sam tytuł „bez nut”. Okno „Dodaj pieśń” (`renderPicker`) szuka w spisach (SPIS), w **utworach Katalogu** (KAT, `Works.find` – połączone tam pliki = jedna pieśń; ich pliki nie są pokazywane osobno, utwór o plikach identycznych z pozycją spisu pominięty) i w plikach. Przycisk „♪ Dołącz nuty” / „Zmień nuty” przy pieśni (`openPicker(pi, ii)`) podmienia tylko
`files`/`src` – tytuł i uwaga zostają. `src.i` = indeks pozycji w spisie (pewniejsze niż sam numer, zwłaszcza w spisach bez numerów). Program z datą w przeszłości = archiwum (u administratora i chórzysty), nadal widoczny, dopóki nie usunięty.
„Kopiuj” tworzy kopię bez daty. Puste części są ukryte u chórzystów i w PDF. PDF programu = pseudo-śpiewnik z wierszami `section`.
**Wczytaj z pliku…** (`#ev-import`, `js/progimport.js` = czysty parser `ProgImport.parse(lines)`, testowalny w Node; linie z `SongList.linesOf(name, buf, true)`
– `raw`: wiersz tabeli z pustymi komórkami). Przykład: `testoweTriduum.odt` (5 dni, tabela „część | (pusta) | pieśń | .”). Reguły (ustalone z użytkownikiem):
wiersz z jedną treścią węższy niż kolumna tytułów albo w innej kolumnie = nagłówek dnia; dzień bez pieśni = nazwa zestawu („Triduum 2026”) dopisywana
„Wielki Czwartek – Triduum 2026”; pusta lewa kolumna = ta sama część; skróty `partName` (We/We2→Wejście, OF, Kom, Uw, Wy, Agnus, Ps01→Psalm 1, Chwała→Alleluja lub Chwała);
„/” i „+” poza nawiasami = **osobne pieśni do wyboru**; uwagi: „(!)”→„!”, „?”/„(?)”→„?”, „[1]”→„[1]”, „(ew)”→„ewentualnie”; kropki prowadzące usuwane;
„0”/„.” pomijane, puste części znikają; Męka/Sekwencja/Litania/Potrójne Amen bez etykiety = własna część + pieśń (`LITURGY`). Wątpliwe pozycje lepiej dodać „bez nut” (użytkownik).
Dopasowanie (`songMatcher` w programs.js): pozycja spisu (`Matcher.score`, ≥ SURE i przewaga 0.05) → `src`; inaczej plik (`Matcher.rank`); inaczej bez nut. Daty puste.
**Zwykły tekst** (plik bez żadnego tabulatora – .txt albo dokument bez tabeli; `parsePlain`, przykład `tests/Pasterka2026.txt`, ustalone z użytkownikiem 2026-11-25):
linijka = pieśń; tekst przed pierwszą pieśnią = nazwa („Pasterka2026” → „Pasterka 2026”); „we: tytuł” = etykieta z dwukropkiem (znana część albo jedno słowo);
sama etykieta „KOLĘDOWANIE:” = nowa część („Kolędowanie”); „Kyrie - Missa Noel”, „Alleluja radosne”, „Modlitwa powszechna IV” = część z początku tytułu,
**tytuł zostaje cały** – tylko gdy wypada dalej w kolejności mszy (`MASS`) niż bieżąca część (kolęda „Gloria…” w „Kolędowaniu” zostaje); linijka bez oznaczenia
= ta sama część; linijka bez pieśni tuż przed „we: …” = następna uroczystość; „ - a cappella” / „(a cappella)” → uwaga; kompozytor w nawiasie zostaje w tytule.
Testy parsera: `node tests/progimport.test.cjs` (folder `tests/` nie trafia na stronę).

## Porządkowanie: duplikaty i „Pozostałe nuty”

- **„To nie nuty” i „nieistotne”** (decyzja użytkownika): `meta[id].notNotes` (ikona skreślonej nutki, `#i-nonote` w index.html) i `meta[id].ignore`
  (👻; plik albo folder – dziedziczą wszystkie pliki w środku). `Catalog.flagOf(nodes, meta, id)` → `'notes'|'ignore'|'ignoreDir'|''`.
  Pomijane: `Matcher.candidates` (automatyczne dopasowanie; ręczny wybór `candidates(…, true)` pomija tylko „to nie nuty”), `Dups.files()`
  (duplikaty i „Pozostałe nuty”), filtr „nieprzypisane”. Pliki zostają w drzewie (wyszarzone, tag) – filtr „Oznaczone”, żeby odznaczyć.
  „To nie nuty” niedostępne dla pliku używanego w śpiewniku (`ok`/`auto`) albo programie (`usedIn`). Po zmianie: `afterFlags()` = rematch + `Dups.detect(true)`.
  UI: przy pliku ✎ → okno `#edit-dlg` (`App.openEdit`: nazwa, oba oznaczenia – wykluczają się; „♪ Podgląd”, „Otwórz na Dysku”, **„Edytuj w Katalogu”**) – w drzewie i w duplikatach.
  **Obrotu w tym oknie nie ma** (decyzja użytkownika 2026-11-26) – „Edytuj w Katalogu” zapisuje okno (`requestSubmit`), przechodzi do Katalogu
  i otwiera pozycję z tym plikiem (`Works.openFile(id)` / `Works.workOfFile`); nieaktywne, gdy pliku nie ma w Katalogu („to nie nuty”, do sprzątnięcia).
  **Duszek** (ikonka SVG `#i-ghost` w index.html, `App.GHOST(on)`; wybrany przez użytkownika „klasyczny”: okrągła głowa, falisty dół, buzia „o”):
  nieoznaczone = same kontury, przygaszony; oznaczone = biały na ciemnym kółku (`--ghost-bg`). Przycisk `data-ghost` przy **każdym folderze**
  (zawsze widoczny) i **każdym pliku** w drzewie (`toggleIgnore`); w nieistotnym folderze – wyszarzony, bez klikania; przy „to nie nuty” – brak.
  W drzewie **bez napisu „nieistotny”** (decyzja użytkownika – wystarczy duszek; napis zostaje w katalogu i „to nie nuty” w drzewie).
  W oknach edycji (plik, pozycja katalogu) ikonka zmienia się po zaznaczeniu pola (`.ed-flag:has(input:checked)`). Osobnego ⟳ w drzewie już nie ma.

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
- **Pliki usunięte z Dysku** (`dropGone` w app.js, po skanowaniu i ↻ folderu): znikają z pieśni w spisach i programach, jeśli pieśń ma jeszcze inne pliki.
  Gdy zniknęły wszystkie – zostają z „plik zniknął z Dysku” (nie kasujemy po cichu zatwierdzeń, np. po usunięciu folderu z listy); `auto` i tak dopasuje się od nowa.
- **Pozostałe nuty** (decyzja użytkownika): pliki nieprzypisane do żadnego spisu (`ok`/`auto`) i nie „do usunięcia”, strony z jednego folderu
  i o tej samej nazwie = jedna pozycja, alfabetycznie. U administratora zawsze aktualne; chórzyści widzą **migawkę** (`publish.others.snapshot`)
  z ostatniego kliknięcia „Aktualizuj „Pozostałe nuty”” (zwykłe „Aktualizuj” jej nie zmienia); **PDF tylko przyciskiem „Utwórz PDF”**
  (`publish.others.pdf`, z datą „stan na”). Przełącznik „widoczny dla chórzystów”. W katalogu to śpiewnik `id:'others'`, `auto:true`.

## Katalog nut (zakładka „Katalog”, `js/works.js`)

Decyzje użytkownika: katalog **wszystkich** nut z Dysku; pozycja = utwór (tytuł, autor tekstu, muzyka – pojedyncze) + jeden albo kilka plików (strony)
+ **cechy wielokrotnego wyboru** edytowalne przez administratora (startowe: kolęda, wielkopostne, wielkanocne, eucharystyczne, ostinato,
adwentowe, uwielbienie, alleluja; okno „🏷 Cechy…”: dodaj / zmień nazwę / kolejność / usuń – cechy mają stałe `id`, nazwa to etykieta).
Oznaczanie **na tej samej stronie co wyszukiwanie**: zaznaczanie wielu pozycji → „+ Dodaj cechę / − Usuń cechę / ⧉ Połącz / 👻 Nieistotne / Przywróć / ⬇ CSV”
(akcje dotyczą tylko zaznaczonych **widocznych** – ukryte filtrem nie biorą udziału); kliknięcie tytułu → okno `#work-dlg`
(tytuł, autorzy z podpowiedziami `datalist`, cechy, nowa cecha, nieistotne, ⇅). Na liście pozycji: ♪ (podgląd) i ✎ (= kliknięcie tytułu), bez znaczka Dysku.
**Pliki w oknie pozycji** (decyzja użytkownika 2026-11-26): ✎ przy nazwie = zmiana nazwy w aplikacji w miejscu (`meta.title`, zapis od razu, Enter/Esc),
♪ podgląd, znaczek Dysku, ⟳ obrót (`App.openRotate` – jedyne miejsce obracania), „Osobno” = wydziel plik jako nową pozycję;
**„+ Dodaj plik”** = okno „Wybierz plik…” (`Songs.chooseFiles(title, {exclude, note, onSave})`); plik z innej pozycji katalogu = **połączenie z nią jak ⧉ Połącz**
(wszystkie jej pliki, cechy, puste autorzy uzupełnione; dopisek „dołączony z „…””), zapis dopiero po „Zapisz” (`ui.merged`). `sync()` nie zmienia tytułu,
gdy pasuje on do którejkolwiek pozycji spisu z tymi plikami (po dołączeniu innej pieśni zostaje tytuł edytowanej).
- **Budowa** (`sync()`, przy każdym `render` widocznej zakładki; zapis tylko gdy coś się zmieniło): pieśni ze spisów (`ok`/`auto`) → utwór z tymi plikami
  i tytułem ze spisu; reszta plików → grupy jak „Pozostałe nuty” (`Dups.nameKey`, ten sam folder). Plik należy do jednego utworu. Nowe strony pieśni ze spisu
  dopisywane do utworu, który ma już jej pozostałe pliki. Utwór bez plików znika, chyba że ma dane użytkownika (wtedy „bez plików” + „Usuń pozycję”).
- **Pomijane**: „to nie nuty” i pliki z listy „do sprzątnięcia” (`Dups.toRemove`). **Nieistotne są w katalogu**, domyślnie ukryte
  (przełącznik „pokaż nieistotne”); oznaczenie zapisywane przy plikach (`meta.ignore`, to samo co w drzewie) → `App.afterFlags()`.
- **Tytuł = tytuł ze spisu** (spójność). Dopóki `!ownTitle`, `sync` przepisuje tytuł z pozycji spisu (więc zmiana w „Spisach pieśni” przechodzi do katalogu).
  Zmiana tytułu w katalogu → `confirm` „zmienić też w całym zbiorze?” z listą miejsc (pozycje spisów z tymi plikami + pozycje programów; `auto` → `ok`).
  Utwór spoza spisów → pytanie o nazwę plików w aplikacji (`meta.title`). „Anuluj” = tylko w katalogu → `ownTitle: true` (przygotowane pod różne nazwy).
- Filtry: tekst (tytuł, tytuły spisu i alt, autorzy, cechy, nazwy plików, „Z 12”), cechy (wszystkie zaznaczone naraz, liczniki), bez cech / bez autora tekstu /
  bez kompozytora / spoza spisów / bez plików. Lista rysowana po 300 pozycji („Pokaż więcej”). Ustawienia filtrów w `localStorage['kn-cat-ui']`.
- **Chórzyści** (2026-11-22): tylko wyszukiwanie (tytuł, alt, autorzy, cechy, „Z 12”) + filtr cech (wszystkie zaznaczone naraz, liczniki) → podgląd nut
  i ⚠ zgłoszenie (`kind:'c'`). Publikacja: `publish.js` `worksNow()` (po `Works.sync()`; bez nieistotnych i „to nie nuty”) → w katalogu chórzystów
  `works: {tags:[{id,name}], items:[{title, alt?, lyrics, music, tags, refs:['Z 12'], files:[kopie]}]}`; kopie plików jak w śpiewnikach (`neededIds`).
  Wiersz „Katalog nut” w „Dla chórzystów” (przełącznik `publish.works.enabled`), stan w `status.works`, podpis w `publish.sigs.__works`;
  aktualizowany razem z „Aktualizuj listy”, bez PDF. ⏮ ⏭ w podglądzie idą po liście po wyszukiwaniu/filtrze (`b.order`).

## Publikacja dla chórzystów

1. Folder `Kamienickie Nutki/Dla chórzystów` (tag `kn=public`) z uprawnieniem „anyone with link: reader” (pliki dziedziczą).
2. Kopie użytych nut (`files.copy`, awaryjnie pobranie + upload); kopiowane tylko nowe/zmienione (`modified`), zbędne kasowane.
3. PDF każdego śpiewnika – budowany tylko, gdy zmienił się podpis (`sig` = hash pozycji i plików).
4. Katalog `spiewniki-dla-chorzystow.json` – zaszyfrowany PIN-em (`KnCrypto`), zawiera `songbooks` i `programs` (id kopii i PDF).
   Link dla chórzystów: `<strona>?chor=<catalogId>`. Zmiana PIN-u = tylko ponowny zapis katalogu.
**Obrót** (`meta[id].rot`, przycisk ⟳ w drzewie i przy plikach w duplikatach → okno `#rot-dlg` z podglądem obrazka, `App.openRotate(id)`): oryginał na Dysku bez zmian.
   Przy publikacji plik z obrotem jest pobierany, obracany (`PdfBuild.rotate`: obraz przez canvas, PDF przez `setRotation`)
   i wgrywany jako kopia; w PDF-ach śpiewników też obrócony. `rot` jest w podpisie (`sig`) i w `copies[id].rot` → zmiana obrotu = „są zmiany”.
**Listy i PDF-y osobno** (decyzja użytkownika: PDF to dużo więcej pracy): dwa pola na górze zakładki – „📋 Listy pieśni w aplikacji”
   (`#pub-go` → `publish()`: kopie nut + katalog, **bez budowania PDF**) i „📄 PDF-y do pobrania” (`#pub-pdf-go` → `publish({pdfs:true})`:
   buduje zaznaczone nieaktualne PDF-y, przy okazji zapisuje też katalog). Tabela: Śpiewnik / Lista w aplikacji / PDF.
   Stan PDF w `computeStatus`: `none` (bez nut) / `missing` / `stale` (`pdfs[id].sig` ≠ podpis) / `ok`; pole „przygotuj ten PDF” = `!publish.hold[id]`.
   Katalog: `stale:true` + `pdfAt`, gdy PDF jest `stale` → chórzysta widzi „PDF może być nieaktualny (stan na …)”.
   Nie ma już globalnego przełącznika „Twórz PDF” (`publish.pdf` nieużywane).
**Identyfikator śpiewnika** (`code`, pole „Identyfikator” obok nazwy spisu w „Spisach pieśni” (`#sb-code`), unikalny; w „Dla chórzystów” tylko podgląd): w programach uroczystości tytuł dostaje dopisek `[N 34]`
   (`Programs.tag`: kod + numer pozycji ze `src`, a dla pieśni dodanej jako plik – pozycja spisu z tymi samymi plikami). Dopisek liczony
   na bieżąco (nie zapisany w tytule) – trafia do `forPublish()`, więc do katalogu i PDF programu.
5. **Stan aktualności**: po publikacji zapisujemy `publish.sigs[id]` (podpis każdego śpiewnika/programu), `publish.published` (lista id)
   `computeStatus()` porównuje bieżące podpisy → przy każdej pozycji „✓ aktualna” / „● są zmiany” / „● nowa”.
   Gdy nic się nie zmieniło, przycisk to „✓ Listy aktualne” (nieaktywny) + link „Aktualizuj mimo to” (np. po zmianie własnych nazw plików,
   których podpis nie obejmuje). Po aktualizacji komunikat: „Zaktualizowano: … Bez zmian (pominięte): …”.
   Gałęzi roboczej nie nadpisujemy (`push -f` zablokowane) – po scaleniu PR dołączamy `main` zwykłym `git merge origin/main`.

**Zgłoszenia od chórzystów** (`js/reports.js`, `window.Reports`; decyzja użytkownika: Formularz Google): chórzysta nie ma zapisu na Dysku,
   więc ⚠ w podglądzie nut (`#g-report` → `#g-report-dlg`: powody `REASONS` jako przełączniki, komentarz, imię w `kn-guest-name`)
   wysyła `fetch(no-cors, POST)` na `formResponse` Formularza Google dyrygenta – jedno pole „Długa odpowiedź” (dawniej „Akapit”) z JSON-em
   `{v, at, kind:'s'|'p'|'c' (c = katalog nut), book, bookName, i, no, part, title, files:[id kopii], page, reasons, note, name}`. Adres i pole (`report:{url, entry}`)
   są w zaszyfrowanym katalogu (tylko gdy ustawione). Odpowiedzi idą do arkusza dyrygenta → `Drive.exportCsv(sheetId)` → `data.reports.list`.
   Ustawienia: `data.reports.form` z linku „wstępnie wypełnionego” (`parseForm`) i linku arkusza; zapis = od razu `Publish.saveCatalog()`.
   Karta `#rep-card` na górze „Dla chórzystów”, licznik `#rep-badge` na zakładce; `autoFetch` przy wejściu w zakładkę (co ≥2 min).
   Grupowanie po oryginałach (kopia → oryginał z `publish.copies`), ✎ = `App.openEdit`, „Pokaż w spisie” = `Songs.reveal(book, i)`,
   „✓ Załatwione” = `data.reports.done[key]`. „Wyślij zgłoszenie testowe” sprawdza konfigurację.

Chórzysta: `Drive.publicText(catalogId)` (klucz API) → PIN → katalog; kopia koperty w localStorage (`kn-guest-env`), PIN w `kn-guest-pin`.
Nuty: **własny podgląd** `js/noteview.js` (`window.NoteView`, 2026-11-26) – plik pobierany kluczem API (`files/<id>?alt=media&key=`), bez ciasteczek Google,
więc otwarcie nie trafia do „Ostatnich”/strony głównej Dysku zalogowanej osoby (zgłoszenie użytkownika: ramka `drive.google.com/…/preview` to robiła).
Obrazki = `<img>`, PDF = pdf.js 3.11.174 legacy (`js/vendor/pdfjs.min.js` + worker, wczytywany przy pierwszym PDF-ie, `isEvalSupported:false`, jeden `PDFWorker`),
strony jedna pod drugą, ostre po powiększeniu (canvas ≤ 12 mln px). Pamięć: Cache API `kn-nuty-v1` (test: `test~kn-nuty-v1`; nie z przedrostkiem schowków SW,
bo SW je kasuje), max 200 plików, najpierw pamięć (kopie mają stałą treść) → otwarte nuty działają offline; w tle pobierane pozostałe strony i następna pieśń.
Powiększanie: dwa palce, podwójne stuknięcie, Ctrl+kółko, przyciski +/− (tylko z myszą), klawisze +/−. Przesunięcie palcem w bok (bez powiększenia)
i strzałki ← → = strona / pieśń (`step` w guest.js), Esc = zamknij. **U chórzysty znaczek Dysku w pasku (`#g-open`) jest ukryty** (`hidden`, decyzja użytkownika 2026-11-27: „na razie niepotrzebny, może wrócimy”) – w komunikacie błędu też bez linku do Dysku; u administratora zostaje.
**Ikonki (decyzja użytkownika 2026-11-26)**: ♪ w kółku (`.nv-note-ico`) = podgląd w aplikacji – wszędzie tak samo; znaczek Dysku ze strzałką
(`#i-drive` w index.html: mały kolorowy trójkąt + strzałka, „małe i lekkie”) = otwórz na Dysku Google. ↗ nie używamy (zostało tylko w pobieranej stronie HTML sprzątania).
**Podgląd u administratora** (`js/preview.js`, `window.Preview`): to samo okienko (`NoteView`) w `<dialog id="a-viewer">` (nad innymi oknami).
**Podgląd = to, co widzi chórzysta** (decyzja użytkownika 2026-11-26; oryginał „jak leży” = znaczek Dysku). `sourceOf(id)`: aktualna kopia
(`publish.copies[id]` z tym samym `modified` i `rot`) → kopia kluczem API (bez połączenia), etykieta „Tak widzą chórzyści”; kopia nieaktualna →
„Chórzyści zobaczą to po „Aktualizuj””; brak kopii → „Nie opublikowane u chórzystów” – w obu oryginał przez `Drive.download` (trzeba być połączonym)
z obrotem `meta.rot` nałożonym w podglądzie (`NoteView.show(…, {rot})`: obrazek przez canvas, PDF `rotation` w pdf.js – ten sam kierunek co `PdfBuild.rotate`).
Pamięć `kn-nuty-admin-v1` (oryginały: klucz z `modified`), czyszczona przy „Wyloguj”. `Preview.noteBtn(ids, i, title)` = przycisk ♪,
`Preview.driveLink(id)`, `Preview.attrs(ids, i, title)` = atrybuty `data-nv` – każde kliknięcie elementu z `data-nv` otwiera podgląd (chipy plików w spisach,
programach, zgłoszeniach: zwykłe kliknięcie = podgląd, Ctrl/środkowy = Dysk). ♪ w drzewie (cała pieśń z folderu), oknie kolejności, „Wybierz plik…”, katalogu,
duplikatach (tam też znaczek Dysku – do usuwania), w oknie ✎ przyciski „♪ Podgląd” i „Otwórz na Dysku”.
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

- **Każda przeglądarka = osobne urządzenie** (osobna kopia danych w IndexedDB). Dyrygent bywa w Operze i w Chrome na jednym komputerze –
  stąd potrzeba bezpiecznego łączenia (`data.deleted`, `baseAt`).
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

### Do zrobienia (zapisane na prośbę użytkownika, 2026-11-25)

- ~~Pliki ściągane na Dysk Google~~ – wyjaśnione: to nie nowe pliki, tylko kopie z „Dla chórzystów” pokazywane w „Ostatnich”, bo podgląd był ramką Dysku
  (u zalogowanych). Zrobiony własny podgląd (`js/noteview.js`). Do ewentualnego sprzątania: osierocone kopie w „Dla chórzystów”, folder wersji testowej.
- ~~Strzałki między nutami w spisie~~ – zrobione razem z własnym podglądem (← →, przesunięcie palcem).
- **Zmiana PIN-u na 19** – PIN ustawia administrator w „Dla chórzystów” (`publish.pin`; domyślny `'2018'` w publish.js).
  Zmiana = ponowny zapis katalogu; chórzyści muszą wpisać nowy PIN.
- **Ukrywanie archiwalnych uroczystości (albo nie)** – przełącznik „pokaż/ukryj archiwum” (programy z datą w przeszłości)
  u administratora i/lub chórzysty. Do ustalenia z użytkownikiem, gdzie i co ma być domyślnie.
- **Nuty dla dyrygenta – notatki do utworów** (2026-11-26) – dyrygent może zapisywać własne notatki przy utworze
  (np. przy pozycji Katalogu `catalog.works[id]` albo pieśni w spisie). Do ustalenia: gdzie je widać (tylko administrator?
  w podglądzie nut?), czy notatka do utworu czy do konkretnej uroczystości (w programach jest już pole `note`).

- **Wybieranie pieśni do przebudowy** (użytkownik: „wyszukiwarka na razie nie działa idealnie”) – dotyczy okna „Dodaj pieśń”
  w programach (`renderPicker` w programs.js: proste dopasowanie słów) i „Wybierz plik…” w spisach. Do omówienia z użytkownikiem.

- Nuty offline u chórzysty (kopie w pamięci telefonu) – teraz podgląd wymaga internetu.
- Własne PDF-y z wybranych pozycji (np. „na niedzielę”) – pdfbuild.js już umie składać.
- **Spis z pozycji Katalogu** (pomysł użytkownika 2026-11-27, „może w przyszłości”): w Katalogu zaznaczyć kilka utworów i wrzucić je do spisu
  (nowego albo istniejącego) – pozycja = tytuł utworu + jego pliki (`state:'ok'`). Na razie jest tylko ręczne „+ Nowy spis” / „+ Dodaj pozycję”.
- Ponowne wczytanie zmienionego spisu z zachowaniem dopasowań.

### Do przemyślenia (zapisane na prośbę użytkownika, 2026-11-19)

- ~~Katalog wszystkich nut~~ – zrobione (zakładka „Katalog”, także u chórzystów).
- **Nagrania** – czy i gdzie udostępniać nagrania (np. ćwiczeniowe dla głosów): pliki audio na Dysku obok nut, linki (YouTube itp.),
  odtwarzanie w aplikacji chórzysty? Do omówienia.
- **Przesyłanie nut przez chórzystów** – raczej **nie** (wstępne zdanie użytkownika). Chórzysta nie ma zapisu na Dysku;
  ewentualnie wystarczą zgłoszenia (`js/reports.js`) z prośbą/linkiem.
