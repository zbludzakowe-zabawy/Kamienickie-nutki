// Wczytywanie spisu pieśni z pliku: .odt, .docx, .txt lub Dokument Google (jako tekst).
window.SongList = (() => {
  'use strict';
  const NS_TEXT = 'urn:oasis:names:tc:opendocument:xmlns:text:1.0';
  const NS_W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

  // Akapity z .odt – z tabulatorami i spacjami tak jak w dokumencie
  function odtLines(xml) {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const lines = [];
    const textOf = (el) => {
      let s = '';
      for (const ch of el.childNodes) {
        if (ch.nodeType === 3) s += ch.nodeValue;
        else if (ch.nodeType === 1) {
          if (ch.namespaceURI === NS_TEXT && ch.localName === 'tab') s += '\t';
          else if (ch.namespaceURI === NS_TEXT && ch.localName === 's') s += ' '.repeat(Number(ch.getAttributeNS(NS_TEXT, 'c')) || 1);
          else if (ch.namespaceURI === NS_TEXT && ch.localName === 'line-break') s += '\n';
          else if (ch.namespaceURI === NS_TEXT && (ch.localName === 'note' || ch.localName === 'annotation')) continue;
          else s += textOf(ch);
        }
      }
      return s;
    };
    const walk = (el) => {
      for (const ch of el.children) {
        if (ch.namespaceURI === NS_TEXT && (ch.localName === 'p' || ch.localName === 'h')) lines.push(...textOf(ch).split('\n'));
        else walk(ch);
      }
    };
    walk(doc.documentElement);
    return lines;
  }

  function docxLines(xml) {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const lines = [];
    for (const p of doc.getElementsByTagNameNS(NS_W, 'p')) {
      let s = '';
      const walk = (el) => {
        for (const ch of el.children) {
          if (ch.namespaceURI !== NS_W) continue;
          if (ch.localName === 't') s += ch.textContent;
          else if (ch.localName === 'tab') s += '\t';
          else if (ch.localName === 'br') s += '\n';
          else if (ch.localName !== 'p') walk(ch);
        }
      };
      walk(p);
      lines.push(...s.split('\n'));
    }
    return lines;
  }

  // „12<tab>Tytuł”, „12. Tytuł”, „12) Tytuł” albo „Tytuł ....... 12”
  function parseLine(raw) {
    const line = raw.replace(/ /g, ' ').trim();
    if (!line) return null;
    let m = line.match(/^(\d{1,4}[a-zA-Z]?)(?:[.)\]:]|\s*[-–—]\s|\t|\s)\s*(.+)$/);
    if (m && /\p{L}/u.test(m[2])) return { no: m[1], title: m[2].replace(/\s+/g, ' ').trim() };
    m = line.match(/^(.*\p{L}.*?)(?:\s*\t\s*|\s*[.…·_]{2,}\s*|\s{2,})(\d{1,4}[a-zA-Z]?)$/u);
    if (m) return { no: m[2], title: m[1].replace(/\s+/g, ' ').trim() };
    if (/\p{L}/u.test(line)) return { no: '', title: line.replace(/\s+/g, ' ') };
    return null;
  }

  // Zostawia pierwsze wystąpienie każdej pozycji – druga, alfabetyczna strona spisu jest pomijana.
  function parse(lines) {
    const items = [];
    const seen = new Set();
    let dup = 0;
    const parsed = lines.map(parseLine).filter(Boolean);
    const numbered = parsed.filter((p) => p.no).length;
    // gdy większość linii ma numery, linie bez numeru to nagłówki (np. „Spis treści”) – pomijamy je
    const useNumbers = numbered >= parsed.length * 0.6;
    for (const p of parsed) {
      if (useNumbers && !p.no) continue;
      const key = useNumbers ? 'n:' + p.no.toLowerCase() : 't:' + Catalog.norm(p.title);
      if (seen.has(key)) { dup++; continue; }
      seen.add(key);
      items.push({ no: useNumbers ? p.no : '', title: p.title });
    }
    return { items, duplicates: dup };
  }

  // name – nazwa pliku (rozszerzenie decyduje o formacie); content – ArrayBuffer albo tekst
  async function fromFile(name, content) {
    const ext = (String(name).match(/\.([a-z0-9]+)$/i) || [])[1];
    let lines;
    if (typeof content === 'string') lines = content.split(/\r?\n/);
    else if (/^odt$/i.test(ext)) {
      const xml = await Zip.readEntry(content, 'content.xml');
      if (!xml) throw new Error('W pliku .odt nie ma treści.');
      lines = odtLines(xml);
    } else if (/^docx$/i.test(ext)) {
      const xml = await Zip.readEntry(content, 'word/document.xml');
      if (!xml) throw new Error('W pliku .docx nie ma treści.');
      lines = docxLines(xml);
    } else if (/^(txt|csv|md)$/i.test(ext) || !ext) {
      lines = new TextDecoder('utf-8').decode(content).split(/\r?\n/);
    } else {
      throw new Error('Obsługiwane formaty spisu: .odt, .docx, .txt i Dokumenty Google.');
    }
    const res = parse(lines);
    if (!res.items.length) throw new Error('Nie znalazłem w pliku żadnych pozycji spisu.');
    return res;
  }

  const SUPPORTED = /\.(odt|docx|txt)$/i;
  const GDOC = 'application/vnd.google-apps.document';

  return { fromFile, parse, parseLine, SUPPORTED, GDOC };
})();
