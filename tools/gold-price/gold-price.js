(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);

  // ✅ رابط الـ Worker عندك
  const WORKER_BASE = "https://hidden-snow-2c44.rab2323s.workers.dev";

  const TROY_OZ_TO_G = 31.1034768;

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

  const CACHE_TTL_MS = 5 * 60 * 1000; // 5 دقائق (متصفح)
  const cacheKey = (cur) => `gold_spot_${cur}`;
  const historyKey = "gold_history_last5";

  function readCache(cur){
    try{
      const raw = localStorage.getItem(cacheKey(cur));
      if(!raw) return null;
      const obj = JSON.parse(raw);
      if(!obj?.ts || !obj?.data) return null;
      if(Date.now() - obj.ts > CACHE_TTL_MS) return null;
      return obj.data;
    }catch(e){ return null; }
  }
  function writeCache(cur, data){
    try{ localStorage.setItem(cacheKey(cur), JSON.stringify({ ts: Date.now(), data })); }catch(e){}
  }

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
  function renderHistory(){
    const ul = $("historyList");
    const arr = readHistory();
    ul.innerHTML = "";
    if(!arr.length){
      const li = document.createElement("li");
      li.textContent = "لا يوجد سجل بعد.";
      ul.appendChild(li);
      return;
    }
    arr.forEach(h => {
      const li = document.createElement("li");
      li.textContent = h.text;
      ul.appendChild(li);
    });
  }
  function pushHistory(text){
    const arr = readHistory();
    const next = [{ text, ts: Date.now() }, ...arr]
      .filter((x, i, self) => self.findIndex(y => y.text === x.text) === i);
    writeHistory(next);
    renderHistory();
  }

  async function fetchSpot(cur){
    const cached = readCache(cur);
    if(cached) return { data: cached, cached: true };

    const res = await fetch(`${WORKER_BASE}/api/gold?currency=${encodeURIComponent(cur)}`, { cache: "no-store" });
    if(!res.ok) throw new Error("فشل الاتصال بمزود أسعار الذهب.");
    const data = await res.json();
    if(!data || typeof data.price_oz_24k !== "number") throw new Error("بيانات غير صالحة.");
    writeCache(cur, data);
    return { data, cached: false };
  }

  function round2(n){ return Math.round((+n||0)*100)/100; }

  function formatAR(n){ return Number(n).toLocaleString("ar"); }

  function renderAllKarats(base24, cur, unitLabel, premium){
    const tbody = $("allKarats");
    const karats = [24,22,21,18,14];
    tbody.innerHTML = "";
    karats.forEach(k => {
      const price = (base24 * (k/24)) + premium;
      const tr = document.createElement("tr");
      tr.innerHTML = `<td><strong>${k}K</strong></td><td>${formatAR(round2(price))} ${cur} / ${unitLabel}</td>`;
      tbody.appendChild(tr);
    });
  }

  async function calc(){
    clearWarn();
    $("priceOut").textContent = "جارٍ التحديث…";
    $("spotOut").textContent = "—";
    $("updated").textContent = "آخر تحديث: —";
    $("allKarats").innerHTML = "";

    const cur = $("currency").value;
    const unit = $("unit").value;
    const karat = Number($("karat").value);
    const premium = Number($("premium").value || 0);

    try{
      const { data, cached } = await fetchSpot(cur);

      const priceOz24 = data.price_oz_24k;
      const priceG24  = priceOz24 / TROY_OZ_TO_G;

      const base24 = (unit === "oz") ? priceOz24 : priceG24;
      const unitLabel = unit === "oz" ? "أونصة" : "غرام";

      const karatPrice = (base24 * (karat/24)) + premium;

      $("spotOut").textContent = `${formatAR(round2(base24))} ${cur} / ${unitLabel} (24K)`;
      $("priceOut").textContent = `${formatAR(round2(karatPrice))} ${cur} / ${unitLabel} (${karat}K)`;

      $("updated").textContent = `آخر تحديث: ${data.updated_at || "—"}${cached ? " (من الكاش)" : ""}`;

      renderAllKarats(base24, cur, unitLabel, premium);

      pushHistory(`${cur} • ${unitLabel} • ${karat}K = ${round2(karatPrice)} (Premium ${premium})`);
      showToast("تم التحديث ✅");
    }catch(err){
      showWarn("حدث خطأ أثناء جلب السعر.\nتفاصيل: " + (err?.message || err));
      $("priceOut").textContent = "—";
    }
  }

  $("calcBtn").addEventListener("click", calc);
  ["currency","unit","karat","premium"].forEach(id => $(id).addEventListener("change", calc));

  $("copyBtn").addEventListener("click", async () => {
    const txt =
`MarketAPro — أسعار الذهب
العملة: ${$("currency").value}
الوحدة: ${$("unit").value}
العيار: ${$("karat").value}K
المصنعية: ${$("premium").value}
النتيجة: ${$("priceOut").textContent}
${$("updated").textContent}
https://marketapro.com/tools/gold-price/`;
    try{ await navigator.clipboard.writeText(txt); showToast("تم النسخ ✅"); }
    catch(e){ alert("تعذر النسخ تلقائيًا. انسخ يدويًا:\n\n" + txt); }
  });

  $("clearHistoryBtn").addEventListener("click", () => {
    localStorage.removeItem(historyKey);
    renderHistory();
    showToast("تم مسح السجل");
  });

  renderHistory();
  calc();
})();
