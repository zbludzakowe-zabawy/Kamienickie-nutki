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
- **Wyszukiwanie** bez względu na polskie znaki i wielkość liter, oraz filtry: bez nazwy, z nazwą, nowe od ostatniego skanu.
- **Zapis**: dane trzymane są w urządzeniu i w pliku `KamienickieNutki.json` na Dysku, więc działa to samo na komputerze i telefonie.
  Tego pliku nie usuwaj ani nie przenoś do kosza.
- **Zapis tylko w jednym folderze**: wszystko, co aplikacja tworzy, trafia do folderu „Kamienickie Nutki” na Dysku.
  Google pozwala jej zmieniać wyłącznie pliki, które sama utworzyła, więc Twoich nut nie może zmienić ani usunąć.

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

### Dla chórzystów
- **Tryb chórzysty** na telefonie, **bez logowania**, tylko z PIN-em ustalonym przez administratora (na start 2018).
- Chórzysta widzi **wszystkie śpiewniki**, a w każdym **wszystkie pozycje**. Te z nutami można stuknąć, pozostałe mają opis „brak nut”.
  Jest wyszukiwarka i przełącznik „tylko z nutami”.
- **Nuty na cały ekran**. Przy kilku stronach są strzałki ‹ ›, przyciski ⏮ ⏭ przechodzą do poprzedniej/następnej pieśni,
  a przycisk „wstecz” w telefonie zamyka nuty.
- **Pobierz PDF ze śpiewnikiem**: spis treści z numerami stron i nuty w kolejności spisu.
- Administrator w zakładce **„Dla chórzystów”** ustala PIN i klika **Opublikuj / Aktualizuj**. Aplikacja wtedy:
  - kopiuje potrzebne nuty do folderu `Kamienickie Nutki/Dla chórzystów` (dostęp dla każdego, kto ma link),
  - składa PDF-y,
  - zapisuje listę pieśni zaszyfrowaną PIN-em.

  Oryginalne pliki zostają prywatne. Przy kolejnych aktualizacjach kopiowane są tylko nowe i zmienione nuty, a PDF powstaje od nowa tylko wtedy, gdy coś się zmieniło.
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
- `js/publish.js` – zakładka „Dla chórzystów”
- `js/guest.js` – tryb chórzysty
- `CLAUDE.md` – notatki techniczne o budowie aplikacji
- `js/app.js` – interfejs
- `js/pwa.js`, `sw.js`, `manifest.webmanifest`, `icons/` – aplikacja na telefon (instalacja, praca offline, aktualizacje)
- `design/ikona.svg` – źródło ikony
- `tools/build-sw.mjs` – przy publikacji wpisuje do `sw.js` wersję i listę plików
- `.github/workflows/pages.yml` – publikacja na GitHub Pages po zmianach w `main`
