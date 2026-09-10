const SUPABASE_URL = "https://ozqurwksbqbaqkwlacwe.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96cXVyd2tzYnFiYXFrd2xhY3dlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5NzA2MDAsImV4cCI6MjEwNDU0NjYwMH0.GMABqaMuYvkj2nZJNoCLLi2YdGlhuzGz0Z1ab9sXT8Q";

const SUPABASE_TIMEOUT_MS = 15000;

function supabaseError(message, details = '') {
  const e = new Error(message);
  e.details = details;
  return e;
}

/*
 * Cliente REST mínimo para el lector público.
 * Evita depender de una CDN externa para que el lector pueda arrancar.
 * Solo implementa las operaciones de lectura que usa app.js.
 */
class RestQuery {
  constructor(table) {
    this.table = table;
    this.params = new URLSearchParams();
    this.filters = [];
    this.ordering = null;
    this.singleMode = false;
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
    const list = (values || []).map(v => String(v).replace(/"/g, '\\"')).join(',');
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

  async execute() {
    const url = `${SUPABASE_URL}/rest/v1/${encodeURIComponent(this.table)}?${this.params.toString()}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SUPABASE_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          Accept: 'application/json'
        },
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

      return { data: Array.isArray(body) ? body : [], error: null };
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
