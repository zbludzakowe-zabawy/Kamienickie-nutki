# Kamienickie Nutki

Aplikacja do porządkowania nut trzymanych na Dysku Google.

Strona: https://zbludzakowe-zabawy.github.io/kamienickie-nutki/

## Co już działa (etap 1)

- **Połączenie z Dyskiem Google**: logowanie kontem Google, bez hasła w aplikacji.
- **Wybór folderów z nutami**: Mój dysk, „Udostępnione dla mnie” i dyski współdzielone.
- **Skanowanie**: wszystkie PDF-y i obrazy (jpg, png, gif, webp, tiff, heic) z wybranych folderów i podfolderów,
  w takim układzie jak na Dysku. Foldery bez nut są pomijane, skróty do plików i folderów są obsługiwane.
- **Własne nazwy**: stuknij nazwę pliku i wpisz swoją. Plik na Dysku zostaje nietknięty.
- **Wyszukiwanie** bez względu na polskie znaki i wielkość liter, oraz filtry: bez nazwy, z nazwą, nowe od ostatniego skanu.
- **Zapis**: dane trzymane są w urządzeniu i w pliku `KamienickieNutki.json` na Dysku, więc działa to samo na komputerze i telefonie.
  Tego pliku nie usuwaj ani nie przenoś do kosza.

## Następne etapy

1. Wczytanie spisu pieśni i automatyczne dopasowanie do plików (jest / do potwierdzenia / brak).
2. Tworzenie jednego PDF-a z wybranych nut.
3. Tryb przeglądania bez logowania dla innych osób (folder publiczny + klucz API).

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
- `js/app.js` – interfejs
- `js/pwa.js`, `sw.js`, `manifest.webmanifest`, `icons/` – aplikacja na telefon (instalacja, praca offline, aktualizacje)
- `design/ikona.svg` – źródło ikony
- `tools/build-sw.mjs` – przy publikacji wpisuje do `sw.js` wersję i listę plików
- `.github/workflows/pages.yml` – publikacja na GitHub Pages po zmianach w `main`
