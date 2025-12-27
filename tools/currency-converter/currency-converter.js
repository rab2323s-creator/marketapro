 // Shared helpers (optional). If helpers.js is loaded, we use it for cache + fetch.
const __hasHelpers = typeof window !== "undefined" && window.MKT && window.MKT.helpers;

async function __fetchJSON(url, timeoutMs = 8000) {
  if (__hasHelpers) return await window.MKT.helpers.fetchJSON(url, timeoutMs);

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

function __getCache(key) {
  if (__hasHelpers) return window.MKT.helpers.getCache(key);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !data.expiresAt) return null;
    if (Date.now() > data.expiresAt) return null;
    return data.value;
  } catch { return null; }
}

function __setCache(key, value, ttlMs) {
  if (__hasHelpers) return window.MKT.helpers.setCache(key, value, ttlMs);
  try {
    localStorage.setItem(key, JSON.stringify({ value, expiresAt: Date.now() + ttlMs }));
  } catch {}
}

(() => {
  "use strict";

  // ===== UI helpers =====
  const $ = (id) => document.getElementById(id);
  const toastEl = $("toast");
  const warnBox = $("warnBox");

  function showToast(msg){
    toastEl.textContent = msg;
    toastEl.style.display = "block";
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(() => toastEl.style.display = "none", 1800);
  }
  function showWarn(msg){
    warnBox.style.display = "block";
    warnBox.textContent = msg;
  }
  function clearWarn(){
    warnBox.style.display = "none";
    warnBox.textContent = "";
  }

  function safeUpper(v){ return String(v||"").trim().toUpperCase(); }
  function round2(n){ return Math.round((+n||0)*100)/100; }

  // ===== Cache =====
  const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
  const cacheKey = (base) => `fx_rates_${base}`;
  const historyKey = "fx_history_last5";

  // ===== API (single provider: open.er-api.com) =====
  async function fetchRates(base){
    const url = `https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`;
    const res = await fetch(url, { cache: "no-store" });
    if(!res.ok) throw new Error("فشل الاتصال بمزود الأسعار.");
    const data = await res.json();
    // expected: { result:"success", base_code:"USD", rates:{...}, time_last_update_utc:"..." }
    if(data.result !== "success" || !data.rates) throw new Error("بيانات الأسعار غير صالحة.");
    return data;
  }

  function readCache(base){
    try{
      const raw = localStorage.getItem(cacheKey(base));
      if(!raw) return null;
      const obj = JSON.parse(raw);
      if(!obj || !obj.ts || !obj.data) return null;
      if(Date.now() - obj.ts > CACHE_TTL_MS) return null;
      return obj.data;
    }catch(e){ return null; }
  }
  function writeCache(base, data){
    try{
      localStorage.setItem(cacheKey(base), JSON.stringify({ ts: Date.now(), data }));
    }catch(e){}
  }

  async function getRates(base){
    const cached = readCache(base);
    if(cached) return { data: cached, cached: true };
    const fresh = await fetchRates(base);
    writeCache(base, fresh);
    return { data: fresh, cached: false };
  }

  // ===== Currency list =====
  async function ensureCurrencyList(){
    // load from USD once (fast) to populate currencies
    const { data } = await getRates("USD");
    const codes = Object.keys(data.rates || {}).sort();

    // ✅ التعديل المطلوب: تعبئة قائمتين select بدل datalist
    const baseSel = $("base");
    const targetSel = $("target");

    baseSel.innerHTML = "";
    targetSel.innerHTML = "";

    codes.forEach(c => {
      const o1 = document.createElement("option");
      o1.value = c;
      o1.textContent = c;
      baseSel.appendChild(o1);

      const o2 = document.createElement("option");
      o2.value = c;
      o2.textContent = c;
      targetSel.appendChild(o2);
    });

    // افتراضيات
    baseSel.value = codes.includes("USD") ? "USD" : (codes[0] || "USD");
    targetSel.value = codes.includes("SAR") ? "SAR" : (codes.includes("EUR") ? "EUR" : (codes[0] || "EUR"));
  }

  // ===== History =====
  function readHistory(){
    try{
      const raw = localStorage.getItem(historyKey);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    }catch(e){ return []; }
  }
  function writeHistory(arr){
    try{ localStorage.setItem(historyKey, JSON.stringify(arr.slice(0,5))); }catch(e){}
  }
  function pushHistory(item){
    const arr = readHistory();
    const next = [item, ...arr].filter((x, i, self) => {
      // remove exact duplicates (same string)
      return self.findIndex(y => y.text === x.text) === i;
    });
    writeHistory(next.slice(0,5));
    renderHistory();
  }
  function renderHistory(){
    const ul = $("historyList");
    const arr = readHistory();
    ul.innerHTML = "";
    if(!arr.length){
      const li = document.createElement("li");
      li.textContent = "لا يوجد تحويلات محفوظة بعد.";
      ul.appendChild(li);
      return;
    }
    arr.forEach(h => {
      const li = document.createElement("li");
      li.textContent = h.text;
      ul.appendChild(li);
    });
  }

  // ===== Convert =====
  async function convert(){
    clearWarn();

    const amount = Number($("amount").value);
    const base = safeUpper($("base").value);
    const target = safeUpper($("target").value);

    if(!amount || amount <= 0){
      showWarn("أدخل مبلغًا صحيحًا أكبر من صفر.");
      return;
    }
    if(!/^[A-Z]{3}$/.test(base) || !/^[A-Z]{3}$/.test(target)){
      showWarn("اختر عملة صحيحة من القائمة.");
      return;
    }

    $("result").textContent = "جارٍ التحويل…";
    $("rate").textContent = "—";
    $("updated").textContent = "آخر تحديث: —";

    try{
      const { data, cached } = await getRates(base);
      const r = data.rates?.[target];
      if(!r){
        showWarn(`العملة المستهدفة غير متاحة: ${target}. جرّب عملة أخرى.`);
        $("result").textContent = "—";
        return;
      }

      const converted = amount * Number(r);
      $("result").textContent = `${round2(converted).toLocaleString("ar")} ${target}`;
      $("rate").textContent = `1 ${base} = ${Number(r).toFixed(6)} ${target}`;
      $("updated").textContent = `آخر تحديث: ${data.time_last_update_utc || "—"}${cached ? " (من الكاش)" : ""}`;

      const line = `${amount} ${base} → ${round2(converted)} ${target}`;
      pushHistory({ text: line, ts: Date.now() });

      showToast("تم التحويل ✅");
    }catch(err){
      showWarn(
        "حدث خطأ أثناء جلب الأسعار.\n" +
        "إذا عندك CSP في الموقع: اسمح بالاتصال إلى open.er-api.com داخل connect-src.\n" +
        "تفاصيل: " + (err?.message || err)
      );
      $("result").textContent = "—";
    }
  }

  // ===== Actions =====
  $("convertBtn").addEventListener("click", convert);

  $("swapBtn").addEventListener("click", () => {
    const a = $("base").value;
    $("base").value = $("target").value;
    $("target").value = a;
    convert();
  });

  $("copyBtn").addEventListener("click", async () => {
    const base = safeUpper($("base").value);
    const target = safeUpper($("target").value);
    const amount = $("amount").value;
    const result = $("result").textContent;

    const txt =
`MarketAPro — محول العملات
المبلغ: ${amount}
من: ${base}
إلى: ${target}
النتيجة: ${result}
الرابط: https://marketapro.com/tools/currency-converter/`;

    try{
      await navigator.clipboard.writeText(txt);
      showToast("تم النسخ ✅");
    }catch(e){
      alert("تعذر النسخ تلقائيًا. انسخ يدويًا:\n\n" + txt);
    }
  });

  $("clearHistoryBtn").addEventListener("click", () => {
    localStorage.removeItem(historyKey);
    renderHistory();
    showToast("تم مسح السجل");
  });

  // Quick pairs
  document.querySelectorAll("[data-pair]").forEach(chip => {
    chip.addEventListener("click", () => {
      const [b,t] = String(chip.getAttribute("data-pair")||"").split(",");
      if(b && t){
        $("base").value = b;
        $("target").value = t;
        convert();
      }
    });
  });

  // Auto convert on changes (خفيف)
  ["amount","base","target"].forEach(id => {
    $(id).addEventListener("change", () => convert());
  });

  // Init
  (async () => {
    try{
      await ensureCurrencyList();
      renderHistory();
      convert();
    }catch(e){
      renderHistory();
      showWarn("تعذر تحميل قائمة العملات تلقائيًا. جرّب إعادة تحميل الصفحة.");
    }
  })();
})();

