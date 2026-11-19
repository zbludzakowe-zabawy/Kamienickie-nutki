# Kamienickie Nutki

Aplikacja do porządkowania nut trzymanych na Dysku Google.

Strona: https://zbludzakowe-zabawy.github.io/Kamienickie-nutki/

## Co już działa

### Nuty na Dysku

- **Połączenie z Dyskiem Google**: logowanie kontem Google, bez hasła w aplikacji.
- **Wybór folderów z nutami**: Mój dysk, „Udostępnione dla mnie” i dyski współdzielone.
- **Skanowanie**: wszystkie PDF-y i obrazy (jpg, png, gif, webp, tiff, heic) z wybranych folderów i podfolderów,
  w takim układzie jak na Dysku. Foldery bez nut są pomijane, skróty do plików i folderów są obsługiwane.
- **Odświeżanie jednego folderu** (↻ przy folderze): gdy dodasz nuty do konkretnego katalogu na Dysku,
  aplikacja sprawdza tylko ten katalog z podfolderami, a nie cały Dysk. Nowe pliki są oznaczone „nowy”.
- **Własne nazwy**: stuknij nazwę pliku i wpisz swoją. Plik na Dysku zostaje nietknięty.
- **Wyszukiwanie** bez względu na polskie znaki i wielkość liter, oraz filtry: bez nazwy, z nazwą, nowe od ostatniego skanu,
  **nieprzypisane do żadnego śpiewnika**. Przycisk **⬇ Pobierz listę** zapisuje widoczną listę plików do pliku dla Excela lub LibreOffice.
- **Zapis**: dane trzymane są w urządzeniu i w pliku `KamienickieNutki.json` na Dysku, więc działa to samo na komputerze i telefonie.
  Tego pliku nie usuwaj ani nie przenoś do kosza.
- **Zapis tylko w jednym folderze**: wszystko, co aplikacja tworzy, trafia do folderu „Kamienickie Nutki” na Dysku.
  Google pozwala jej zmieniać wyłącznie pliki, które sama utworzyła, więc Twoich nut nie może zmienić ani usunąć.

### Porządkowanie Dysku
- **Szukaj duplikatów** (obok „Skanuj Dysk”): identyczne pliki, pliki o tej samej nazwie w różnych folderach oraz ta sama pieśń
  przypisana w różnych śpiewnikach do różnych plików.
- Przy każdym pliku są linki do pliku i do jego folderu na Dysku oraz informacja, gdzie jest używany. Decyzje to:
  - „Zostaw tylko zaznaczone” (reszta zostanie oznaczona „do usunięcia”, a śpiewniki przepną się na zachowany plik),
  - „Zostaw wszystkie”,
  - „To różne utwory”,
  - „Nadaj nazwę” zaznaczonym,
  - „Użyj tych wszędzie” przy konflikcie w śpiewnikach.
- Aplikacja niczego nie usuwa. Usuwasz na Dysku sam, a po „Skanuj Dysk” załatwione grupy znikają. Decyzje są zapamiętane.
- Każda decyzja dopisuje niepotrzebne pliki do listy **„Do sprzątnięcia na Dysku”**, także decyzja „Użyj tych wszędzie”.
  Lista jest pogrupowana według folderów, z linkami i powodem. Można ją pobrać jako **stronę** (do sprzątania folder po folderze) albo **CSV**.
  Pliki nadal używane gdzie indziej nie trafiają na listę.
- Po „Skanuj Dysk” usunięte pliki **odhaczają się same**. Można też odhaczyć ręcznie przyciskiem **„✓ Zrobione”**.
  Rozstrzygnięte grupy zostają w historii, więc widać, gdzie był problem.

### Śpiewnik „Pozostałe nuty”
- Tworzy się sam z nut nieprzypisanych do żadnego spisu, alfabetycznie.
- Chórzyści dostają nową wersję dopiero po kliknięciu **„Aktualizuj „Pozostałe nuty””** w zakładce „Dla chórzystów”. PDF powstaje tylko po kliknięciu **„Utwórz PDF”**.

### Spisy pieśni
- **Wczytanie spisu** z Dysku albo z komputera: `.odt`, `.docx`, `.txt` i Dokumenty Google.
  Każda pozycja w osobnej linijce, najlepiej z numerem („12<tab>Tytuł”, „12. Tytuł” albo „Tytuł ..... 12”).
  Powtórzenia, np. druga strona spisu ułożona alfabetycznie, są pomijane.
- **Automatyczne dopasowanie** do plików po nazwie, bez względu na polskie znaki, z odpornością na literówki i odmianę.
  Uwzględnia nazwy nadane w aplikacji, a także foldery, w których jedna pieśń ma kilka stron jako osobne obrazy.
  Dopisek w nawiasie, np. kompozytor, rozróżnia wersje tej samej pieśni.
- **Trzy grupy**: ✓ są nuty, ? do sprawdzenia, ✕ brak. Pozycje o tym samym tytule zawsze trafiają do sprawdzenia.
- **Zatwierdzanie**: „Zgadza się”, „To nie to” (ta propozycja nie wróci), „Wybierz plik…” (wyszukiwarka, można zaznaczyć kilka plików),
  „Nie mamy” oraz „Zatwierdź pewne” dla wszystkich dopasowań automatycznych naraz.
  Plik bez własnej nazwy dostaje po zatwierdzeniu tytuł ze spisu.
- Po każdym skanowaniu Dysku niezatwierdzone pozycje są dopasowywane od nowa.
- **„Dopasuj ponownie”** nie łączy się z Dyskiem: dopasowuje jeszcze raz pozycje niezatwierdzone do plików z ostatniego skanowania.
  Nowe pliki z Dysku trzeba najpierw wczytać („Skanuj Dysk” albo ↻ przy folderze).

### Tryby i logowanie
- **Zwykły adres strony otwiera śpiewniki chórzystów** (także w aplikacji dodanej do ekranu iPhone'a).
- **Tryb administratora** (link na dole ekranu chórzysty) jest chroniony **logowaniem kontem Google**.
  Wejść mogą tylko konta dopuszczone w Google Cloud (użytkownicy testowi). Wystarczy zalogować się raz na danym urządzeniu.
  Potem można pracować także bez połączenia z Dyskiem.
- W pasku administratora:
  - **Widok chórzysty** przełącza na widok chórzysty, a z powrotem prowadzi link „Tryb administratora”, już bez logowania.
  - **Wyloguj** zamyka tryb administratora na tym urządzeniu i czyści z niego dane. Na Dysku wszystko zostaje.

### Uroczystości
- **Program na konkretną uroczystość**, np. Pierwszą Komunię: nazwa, data i pieśni ułożone według części mszy.
  Szkielet to Wejście, Kyrie, Gloria, Psalm, Alleluja lub Chwała, Ofiarowanie, Sanctus, Agnus Dei, Komunia, Uwielbienie, Wyjście.
  Części można dodawać, usuwać, przestawiać i zmieniać im nazwy, a w każdej części może być kilka pieśni.
- Pieśni wybiera się ze **spisów pieśni** (wtedy obowiązuje aktualne dopasowanie nut ze spisu) albo **wprost z plików**.
  Można też dodać sam tytuł **bez nut**, np. psalm kantora.
- **Krótka uwaga** przy pieśni, np. „zwrotki 1–3” czy „solo: Ania”. Jest też przycisk **Kopiuj**, np. tegoroczna Komunia z zeszłorocznej.
- Po dacie uroczystości program trafia do **archiwum**, ale chórzyści nadal go widzą, dopóki go nie usuniesz.
- Chórzysta widzi **najbliższą uroczystość na górze listy**. Program jest ułożony według części mszy, z uwagami, a ⏮ ⏭ w podglądzie nut prowadzą po kolei przez program.
  Może też pobrać **PDF z programem**: spis treści według części i nuty w kolejności mszy.

### Dla chórzystów
- **Tryb chórzysty** na telefonie, **bez logowania**, tylko z PIN-em ustalonym przez administratora (na start 2018).
- Chórzysta widzi **wszystkie śpiewniki**, a w każdym **wszystkie pozycje**. Te z nutami można stuknąć, pozostałe mają opis „brak nut”.
  Jest wyszukiwarka i przełącznik „tylko z nutami”.
- **Nuty na cały ekran**. Przy kilku stronach są strzałki ‹ ›, przyciski ⏮ ⏭ przechodzą do poprzedniej/następnej pieśni,
  a przycisk „wstecz” w telefonie zamyka nuty.
- **Pobierz PDF ze śpiewnikiem**: spis treści z numerami stron i nuty w kolejności spisu.
- Administrator w zakładce **„Dla chórzystów”** ustala PIN i ma dwa osobne przyciski:
  - **„Aktualizuj listy”** (szybko): kopiuje potrzebne nuty do folderu `Kamienickie Nutki/Dla chórzystów` (dostęp dla każdego, kto ma link)
    i zapisuje listę pieśni zaszyfrowaną PIN-em. PDF-y się nie zmieniają.
  - **„Przygotuj zaznaczone PDF-y”** (wolniej): składa od nowa PDF-y zaznaczone w kolumnie „PDF” – tylko nieaktualne lub brakujące.
    Dopóki PDF jest nieaktualny, chórzyści widzą przy nim „PDF może być nieaktualny (stan na …)”.

  Przy każdym śpiewniku i programie widać osobno stan listy i stan PDF. Oryginalne pliki zostają prywatne, kopiowane są tylko nowe i zmienione nuty.
- **Uroczystości z pliku** („📄 Wczytaj z pliku…” w zakładce „Uroczystości”): dokument .odt/.docx/.txt z kilkoma dniami (np. Triduum) – każdy dzień
  staje się osobnym programem z częściami mszy; pieśni są od razu łączone z pozycjami spisów albo plikami na Dysku, reszta „bez nut”.
- **Zgłoszenia od chórzystów**: przy otwartych nutach chórzysta klika **⚠** i zaznacza, co jest nie tak (nie te nuty, trzeba obrócić, nieczytelne,
  brakuje strony, złe miejsce w spisie, inne), może dopisać komentarz i imię. Zgłoszenia trafiają do Formularza Google dyrygenta
  (jednorazowa konfiguracja – instrukcja w zakładce „Dla chórzystów”), a administrator widzi je w karcie **„Zgłoszenia od chórzystów”**
  z plikiem do poprawienia (✎), miejscem, z którego przyszło zgłoszenie, i przyciskiem „✓ Załatwione”.
- **Link dla chórzystów** (z przyciskiem „Kopiuj”) wysyłasz SMS-em albo na grupę. Zmiana PIN-u działa od razu: chórzyści zostaną poproszeni o nowy.

## Następne etapy

- Nuty dostępne bez internetu u chórzystów.
- PDF z wybranych pozycji, np. na konkretną mszę.

## Aplikacja na telefon

Kamienickie Nutki można zainstalować jak zwykłą aplikację:

- **Android (Chrome)**: stuknij baner „Zainstaluj” albo menu ⋮ → *Zainstaluj aplikację*.
- **iPhone / iPad (Safari)**: *Udostępnij* → *Do ekranu początkowego*.
- **Komputer (Chrome / Edge)**: ikona instalacji na końcu paska adresu.

Lista nut i nadane nazwy są dostępne także bez internetu. Skanowanie i zapis na Dysku wymagają połączenia.
Komunikat **„Dostępna nowa wersja”** oznacza aktualizację aplikacji. *Odśwież* ją wczytuje, a Twoja praca zostaje zachowana.

## Logowanie

Połączenie z Dyskiem wygasa mniej więcej po godzinie. Wtedy wystarczy kliknąć „Połącz z Dyskiem” ponownie.
Przy pierwszym logowaniu Google ostrzega, że aplikacja jest niezweryfikowana. Kliknij *Zaawansowane → Przejdź do KamienickieNutki*.
Konto musi być wpisane w Google Cloud jako **użytkownik testowy**.

## Ustawienia Google Cloud

Identyfikator klienta OAuth i klucz API są w `js/config.js`. Nie są tajne: działają tylko ze stron wpisanych w konsoli Google
(`https://zbludzakowe-zabawy.github.io` i `http://localhost:8000`).

## Uruchomienie lokalne

```bash
python3 -m http.server 8000
```

Potem otwórz http://localhost:8000.

## Struktura

- `index.html`, `style.css` – strona
- `js/config.js` – identyfikator klienta i klucz API Google
- `js/drive.js` – logowanie i wywołania Dysku Google
- `js/catalog.js` – skanowanie folderów, drzewo, wyszukiwanie
- `js/store.js` – zapis w urządzeniu (IndexedDB)
- `js/zip.js`, `js/songlist.js` – odczyt spisu z .odt / .docx / .txt
- `js/matcher.js` – dopasowanie pozycji spisu do plików
- `js/songs.js` – ekran spisów pieśni
- `js/mode.js` – wybór trybu: administrator / chórzysta
- `js/crypto.js` – szyfrowanie listy pieśni PIN-em
- `js/pdfbuild.js`, `js/vendor/pdf-lib.min.js` – składanie PDF śpiewnika (pdf-lib, licencja MIT)
- `js/programs.js` – zakładka „Uroczystości”
- `js/publish.js` – zakładka „Dla chórzystów”
- `js/guest.js` – tryb chórzysty
- `CLAUDE.md` – notatki techniczne o budowie aplikacji
- `js/app.js` – interfejs
- `js/pwa.js`, `sw.js`, `manifest.webmanifest`, `icons/` – aplikacja na telefon (instalacja, praca offline, aktualizacje)
- `design/ikona.svg` – źródło ikony
- `tools/build-sw.mjs` – przy publikacji wpisuje do `sw.js` wersję i listę plików
- `.github/workflows/pages.yml` – publikacja na GitHub Pages po zmianach w `main`
