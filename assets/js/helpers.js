(function () {
  const NS = "mkt";

  function now() { return Date.now(); }

  function setJSON(key, value) {
    localStorage.setItem(`${NS}:${key}`, JSON.stringify(value));
  }

  function getJSON(key, fallback = null) {
    const raw = localStorage.getItem(`${NS}:${key}`);
    if (!raw) return fallback;
    try { return JSON.parse(raw); } catch { return fallback; }
  }

  function setCache(key, value, ttlMs) {
    setJSON(key, { value, expiresAt: now() + ttlMs });
  }

  function getCache(key) {
    const data = getJSON(key);
    if (!data || !data.expiresAt) return null;
    if (now() > data.expiresAt) return null;
    return data.value;
  }

  async function fetchJSON(url, timeoutMs = 8000) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(t);
    }
  }

  window.MKT = window.MKT || {};
  window.MKT.helpers = { setCache, getCache, fetchJSON };
})();
