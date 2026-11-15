// Połączenie z Dyskiem Google: logowanie (Google Identity Services) i wywołania Drive API.
window.Drive = (() => {
  'use strict';
  const cfg = window.KN_CONFIG;
  const SCOPES = [
    'https://www.googleapis.com/auth/drive.readonly', // przeglądanie folderów z nutami
    'https://www.googleapis.com/auth/drive.file', // zapis pliku z danymi i gotowych PDF-ów
  ];
  const API = 'https://www.googleapis.com/drive/v3';
  const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
  const FOLDER = 'application/vnd.google-apps.folder';
  const SHORTCUT = 'application/vnd.google-apps.shortcut';
  const TOKEN_KEY = 'kn-token';
  const HINT_KEY = 'kn-email';

  let token = null;
  let expiresAt = 0;
  let client = null;
  let waiter = null;
  const listeners = new Set();

  class AuthError extends Error {
    constructor() { super('Połącz się z Dyskiem Google.'); this.name = 'AuthError'; }
  }

  try {
    const t = JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null');
    if (t && t.expiresAt > Date.now() + 60000) { token = t.token; expiresAt = t.expiresAt; }
  } catch (e) { /* brak */ }

  const isConnected = () => !!token && Date.now() < expiresAt - 30000;
  const emit = () => listeners.forEach((f) => f(isConnected()));
  const onChange = (f) => listeners.add(f);

  function saveToken() {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, JSON.stringify({ token, expiresAt }));
      else localStorage.removeItem(TOKEN_KEY);
    } catch (e) { /* trudno */ }
  }

  function loadGis() {
    return new Promise((resolve, reject) => {
      if (window.google && google.accounts && google.accounts.oauth2) return resolve();
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Nie udało się wczytać logowania Google (brak internetu?).'));
      document.head.appendChild(s);
    });
  }

  function fail(err) {
    if (waiter) { waiter.reject(err); waiter = null; }
  }

  function onToken(r) {
    if (r.error) return fail(new Error(r.error_description || r.error));
    if (!google.accounts.oauth2.hasGrantedAllScopes(r, ...SCOPES)) {
      return fail(new Error('Zaznacz w oknie Google wszystkie uprawnienia – bez nich aplikacja nie zobaczy nut.'));
    }
    token = r.access_token;
    expiresAt = Date.now() + (Number(r.expires_in) || 3600) * 1000;
    saveToken();
    if (waiter) { waiter.resolve(); waiter = null; }
    emit();
    // przypomnienie o wygaśnięciu połączenia
    setTimeout(emit, Math.max(0, expiresAt - Date.now() - 25000));
  }

  function onError(e) {
    const msg = {
      popup_closed: 'Zamknięto okno logowania.',
      popup_failed_to_open: 'Przeglądarka zablokowała okno logowania – zezwól na wyskakujące okna dla tej strony.',
    }[e && e.type] || 'Nie udało się zalogować do Google.';
    fail(new Error(msg));
  }

  // Wczytujemy logowanie Google od razu, bo okno logowania musi się otworzyć
  // bezpośrednio po kliknięciu (inaczej przeglądarka je zablokuje).
  async function init() {
    try {
      await loadGis();
      let hint = '';
      try { hint = localStorage.getItem(HINT_KEY) || ''; } catch (e) { /* brak */ }
      client = google.accounts.oauth2.initTokenClient({
        client_id: cfg.clientId,
        scope: SCOPES.join(' '),
        login_hint: hint || undefined,
        callback: onToken,
        error_callback: onError,
      });
    } catch (e) {
      console.warn(e);
    }
  }

  function connect() {
    return new Promise((resolve, reject) => {
      if (!client) {
        init();
        reject(new Error('Logowanie Google jeszcze się wczytuje – spróbuj za chwilę.'));
        return;
      }
      if (waiter) waiter.reject(new Error('Przerwano poprzednie logowanie.'));
      waiter = { resolve, reject };
      client.requestAccessToken({ prompt: '' });
    });
  }

  function disconnect() {
    token = null;
    expiresAt = 0;
    saveToken();
    emit();
  }

  function rememberEmail(email) {
    try { localStorage.setItem(HINT_KEY, email); } catch (e) { /* trudno */ }
  }

  async function api(url, opts = {}) {
    if (!isConnected()) throw new AuthError();
    const r = await fetch(url, { ...opts, headers: { Authorization: 'Bearer ' + token, ...(opts.headers || {}) } });
    if (r.status === 401) {
      disconnect();
      throw new AuthError();
    }
    if (!r.ok) {
      let msg = '';
      try { msg = (await r.json()).error.message; } catch (e) { /* brak */ }
      const err = new Error(`Błąd Dysku Google (${r.status})${msg ? ': ' + msg : ''}`);
      err.status = r.status;
      throw err;
    }
    return r;
  }

  const qs = (p) => new URLSearchParams(p).toString();

  async function listAll(params, fields) {
    const out = [];
    let pageToken = '';
    do {
      const p = { fields: `nextPageToken,files(${fields})`, pageSize: 1000, supportsAllDrives: true, includeItemsFromAllDrives: true, ...params };
      if (pageToken) p.pageToken = pageToken;
      const r = await (await api(`${API}/files?${qs(p)}`)).json();
      out.push(...(r.files || []));
      pageToken = r.nextPageToken || '';
    } while (pageToken);
    return out;
  }

  const esc = (id) => String(id).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const ITEM = 'id,name,mimeType,size,modifiedTime,shortcutDetails(targetId,targetMimeType)';

  // wszystkie elementy folderu (do skanowania)
  const listChildren = (folderId) =>
    listAll({ q: `'${esc(folderId)}' in parents and trashed=false`, corpora: 'allDrives' }, ITEM);

  // same podfoldery (do wybierania folderów), łącznie ze skrótami do folderów
  async function listFolders(parentId) {
    let items;
    if (parentId === 'shared') {
      items = await listAll({ q: `sharedWithMe and mimeType='${FOLDER}' and trashed=false` }, ITEM);
    } else {
      items = await listAll({
        q: `'${esc(parentId)}' in parents and trashed=false and (mimeType='${FOLDER}' or mimeType='${SHORTCUT}')`,
        corpora: 'allDrives',
      }, ITEM);
    }
    return items
      .map((f) => (f.mimeType === SHORTCUT
        ? (f.shortcutDetails && f.shortcutDetails.targetMimeType === FOLDER ? { id: f.shortcutDetails.targetId, name: f.name } : null)
        : { id: f.id, name: f.name }))
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name, 'pl', { numeric: true, sensitivity: 'base' }));
  }

  async function listSharedDrives() {
    try {
      const r = await (await api(`${API}/drives?${qs({ pageSize: 100, fields: 'drives(id,name)' })}`)).json();
      return r.drives || [];
    } catch (e) {
      if (e instanceof AuthError) throw e;
      return [];
    }
  }

  async function about() {
    return (await api(`${API}/about?fields=user(displayName,emailAddress,photoLink)`)).json();
  }

  async function findDataFile() {
    const files = await listAll({
      q: `name='${esc(cfg.dataFileName)}' and 'me' in owners and trashed=false`,
      orderBy: 'modifiedTime desc',
      corpora: 'user',
    }, 'id,name,modifiedTime');
    return files[0] || null;
  }

  async function readJson(id) {
    return (await api(`${API}/files/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true`)).json();
  }

  async function createJson(name, text) {
    const boundary = 'kn' + Math.random().toString(36).slice(2);
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify({ name, mimeType: 'application/json', description: 'Dane aplikacji Kamienickie Nutki – nie usuwaj.' }) +
      `\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${text}\r\n--${boundary}--`;
    return (await api(`${UPLOAD}/files?uploadType=multipart&fields=id,modifiedTime`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    })).json();
  }

  async function updateJson(id, text) {
    return (await api(`${UPLOAD}/files/${encodeURIComponent(id)}?uploadType=media&fields=id,modifiedTime`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: text,
    })).json();
  }

  return {
    FOLDER, SHORTCUT, AuthError,
    init, connect, disconnect, isConnected, onChange, rememberEmail,
    about, listChildren, listFolders, listSharedDrives,
    findDataFile, readJson, createJson, updateJson,
  };
})();
