const SUPABASE_URL = "https://ozqurwksbqbaqkwlacwe.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96cXVyd2tzYnFiYXFrd2xhY3dlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5NzA2MDAsImV4cCI6MjEwNDU0NjYwMH0.GMABqaMuYvkj2nZJNoCLLi2YdGlhuzGz0Z1ab9sXT8Q";

const SUPABASE_TIMEOUT_MS = 15000;
const SESSION_KEY = 'lfm_auth_session';

function supabaseError(message, details = '') {
  const e = new Error(message);
  e.details = details;
  return e;
}

let _session = null;

function getAccessToken() {
  return _session?.access_token || SUPABASE_ANON_KEY;
}

function getUserId() {
  return _session?.user?.id || null;
}

function loadStoredSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s?.access_token) return null;
    // expires_at en segundos unix
    if (s.expires_at && s.expires_at * 1000 < Date.now() - 5000) {
      if (s.refresh_token) return s; // intentar refresh
      return null;
    }
    return s;
  } catch (_) {
    return null;
  }
}

function saveSession(s) {
  _session = s;
  if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  else localStorage.removeItem(SESSION_KEY);
}

async function refreshSession(session) {
  if (!session?.refresh_token) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ refresh_token: session.refresh_token })
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.access_token) return null;
    const next = {
      access_token: body.access_token,
      refresh_token: body.refresh_token || session.refresh_token,
      expires_at: body.expires_at || (Math.floor(Date.now() / 1000) + (body.expires_in || 3600)),
      user: body.user || session.user
    };
    saveSession(next);
    return next;
  } catch (_) {
    return null;
  }
}

/**
 * Crea o restaura una sesión anónima de Supabase Auth.
 * Requiere: Authentication → Providers → Anonymous Sign-Ins = ON
 */
async function ensureAnonSession() {
  let s = loadStoredSession();
  if (s?.access_token) {
    if (s.expires_at && s.expires_at * 1000 < Date.now() + 60000) {
      const refreshed = await refreshSession(s);
      if (refreshed) return refreshed;
      // refresh falló → nueva sesión anónima
    } else {
      _session = s;
      return s;
    }
  }

  // signInAnonymously vía GoTrue
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ data: { app: 'LeeMangasCross' } })
  });
  const body = await res.json().catch(() => ({}));

  // Algunas versiones usan /token?grant_type=anonymous
  if (!res.ok || !body?.access_token) {
    const res2 = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=anonymous`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: '{}'
    });
    const body2 = await res2.json().catch(() => ({}));
    if (!res2.ok || !body2?.access_token) {
      console.warn('LeeMangasCross: no se pudo crear sesión anónima', body, body2);
      return null;
    }
    const next2 = {
      access_token: body2.access_token,
      refresh_token: body2.refresh_token,
      expires_at: body2.expires_at || (Math.floor(Date.now() / 1000) + (body2.expires_in || 3600)),
      user: body2.user
    };
    saveSession(next2);
    return next2;
  }

  const next = {
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    expires_at: body.expires_at || (Math.floor(Date.now() / 1000) + (body.expires_in || 3600)),
    user: body.user
  };
  saveSession(next);
  return next;
}

function authHeaders(extra = {}) {
  const token = getAccessToken();
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    ...extra
  };
}

class RestQuery {
  constructor(table) {
    this.table = table;
    this.params = new URLSearchParams();
    this.singleMode = false;
    this.method = 'GET';
    this.body = null;
    this.prefer = null;
  }

  select(columns = '*') {
    this.params.set('select', columns);
    return this;
  }

  eq(column, value) {
    this.params.append(column, `eq.${encodeURIComponent(String(value))}`);
    return this;
  }

  in(column, values) {
    const list = (values || []).map(v => `"${String(v).replace(/"/g, '\\"')}"`).join(',');
    this.params.append(column, `in.(${list})`);
    return this;
  }

  order(column, options = {}) {
    const ascending = options?.ascending !== false;
    this.params.set('order', `${column}.${ascending ? 'asc' : 'desc'}`);
    return this;
  }

  single() {
    this.singleMode = true;
    this.params.set('limit', '1');
    return this;
  }

  insert(row) {
    this.method = 'POST';
    this.body = Array.isArray(row) ? row : [row];
    this.prefer = 'return=representation';
    return this;
  }

  upsert(row, options = {}) {
    this.method = 'POST';
    this.body = Array.isArray(row) ? row : [row];
    this.prefer = 'return=representation,resolution=merge-duplicates';
    if (options.onConflict) {
      this.params.set('on_conflict', options.onConflict);
    }
    return this;
  }

  update(row) {
    this.method = 'PATCH';
    this.body = row;
    this.prefer = 'return=representation';
    return this;
  }

  delete() {
    this.method = 'DELETE';
    this.prefer = 'return=representation';
    return this;
  }

  async execute() {
    const qs = this.params.toString();
    const url = `${SUPABASE_URL}/rest/v1/${encodeURIComponent(this.table)}${qs ? '?' + qs : ''}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SUPABASE_TIMEOUT_MS);

    try {
      const headers = authHeaders();
      if (this.prefer) headers['Prefer'] = this.prefer;
      if (this.body != null) headers['Content-Type'] = 'application/json';

      const response = await fetch(url, {
        method: this.method,
        headers,
        body: this.body != null ? JSON.stringify(this.body) : undefined,
        cache: 'no-store',
        signal: controller.signal
      });

      const text = await response.text();
      let body = null;
      try { body = text ? JSON.parse(text) : null; } catch (_) {}

      if (!response.ok) {
        const msg = body?.message || body?.error_description || body?.hint || `HTTP ${response.status}`;
        return { data: null, error: supabaseError(`Supabase: ${msg}`, text) };
      }

      if (this.singleMode) {
        if (!Array.isArray(body) || body.length !== 1) {
          return {
            data: null,
            error: supabaseError(
              Array.isArray(body) && body.length === 0
                ? `No se encontró ${this.table}.`
                : `Se esperaban exactamente un registro de ${this.table}.`
            )
          };
        }
        return { data: body[0], error: null };
      }

      return { data: body == null ? null : (Array.isArray(body) ? body : body), error: null };
    } catch (err) {
      const message = err?.name === 'AbortError'
        ? `La conexión con Supabase tardó más de ${SUPABASE_TIMEOUT_MS / 1000} segundos.`
        : `No se pudo conectar con Supabase: ${err?.message || err}`;
      return { data: null, error: supabaseError(message) };
    } finally {
      clearTimeout(timer);
    }
  }

  then(resolve, reject) {
    return this.execute().then(resolve, reject);
  }
}

const supabaseClient = {
  from(table) {
    return new RestQuery(table);
  }
};
