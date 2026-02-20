 (() => {
  "use strict";
  const $ = (id) => document.getElementById(id);

  // ✅ رابط الـ Worker عندك
  const WORKER_BASE = "https://hidden-snow-2c44.rab2323s.workers.dev";

  const TROY_OZ_TO_G = 31.1034768;

  const toastEl = $("toast");
  const warnBox = $("warnBox");

  function showToast(msg){
    if(!toastEl) return;
    toastEl.textContent = msg;
    toastEl.style.display = "block";
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(() => toastEl.style.display = "none", 1800);
  }
  function showWarn(msg){
    if(!warnBox) return;
    warnBox.style.display = "block";
    warnBox.textContent = msg;
  }
  function clearWarn(){
    if(!warnBox) return;
    warnBox.style.display = "none";
    warnBox.textContent = "";
  }

  // ====== Detect country pages by path ======
  // Example paths:
  // /tools/gold-price-saudi/
  // /tools/gold-price-egypt/
  // /tools/gold-price-uae/
  // /tools/gold-price-kuwait/
  const PATH = (location.pathname || "").toLowerCase();

  function getDefaultCurrencyFromPath(){
    if(PATH.includes("/tools/gold-price-saudi")) return "SAR";
    if(PATH.includes("/tools/gold-price-egypt")) return "EGP";
    if(PATH.includes("/tools/gold-price-uae")) return "AED";
    if(PATH.includes("/tools/gold-price-kuwait")) return "KWD";
    return null; // main page or other pages
  }

  const DEFAULT_CUR = getDefaultCurrencyFromPath();

  // ====== Cache & History ======
  const CACHE_TTL_MS = 5 * 60 * 1000; // 5 دقائق (متصفح)
  const cacheKey = (cur) => `gold_spot_${cur}`;

  // ✅ avoid mixing history between pages (saudi vs egypt vs main tool)
  const historyKey = `gold_history_last5_${PATH.replaceAll("/","_") || "root"}`;

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
    if(!ul) return;
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

  // ====== Network ======
  async function fetchSpot(cur){
    const cached = readCache(cur);
    if(cached) return { data: cached, cached: true };

    const res = await fetch(
      `${WORKER_BASE}/api/gold?currency=${encodeURIComponent(cur)}`,
      { cache: "no-store" }
    );
    if(!res.ok) throw new Error("فشل الاتصال بمزود أسعار الذهب.");
    const data = await res.json();
    if(!data || typeof data.price_oz_24k !== "number") throw new Error("بيانات غير صالحة.");
    writeCache(cur, data);
    return { data, cached: false };
  }

  function round2(n){ return Math.round((+n||0)*100)/100; }

  function formatAR(n){
    return Number(n).toLocaleString("ar", { maximumFractionDigits: 2 });
  }

  function renderAllKarats(base24, cur, unitLabel, premium){
    const tbody = $("allKarats");
    if(!tbody) return;
    const karats = [24,22,21,18,14];
    tbody.innerHTML = "";
    karats.forEach(k => {
      const price = (base24 * (k/24)) + premium;
      const tr = document.createElement("tr");
      tr.innerHTML = `<td><strong>${k}K</strong></td><td>${formatAR(round2(price))} ${cur} / ${unitLabel}</td>`;
      tbody.appendChild(tr);
    });
  }

  // ====== Currency lock for country pages ======
  function applyDefaultCurrency(){
    const sel = $("currency");
    if(!sel) return;
    if(DEFAULT_CUR){
      sel.value = DEFAULT_CUR;
      // اختياري: اقفل تغيير العملة في صفحات الدول لزيادة التطابق مع SEO
      sel.disabled = true;
      sel.setAttribute("aria-disabled", "true");
      sel.title = "هذه الصفحة مخصصة لعملة الدولة";
    }
  }

  async function calc(){
    clearWarn();
    if($("priceOut")) $("priceOut").textContent = "جارٍ التحديث…";
    if($("spotOut")) $("spotOut").textContent = "—";
    if($("updated")) $("updated").textContent = "آخر تحديث: —";
    if($("allKarats")) $("allKarats").innerHTML = "";

    // تأكد أن العملة الافتراضية مطبقة قبل القراءة
    applyDefaultCurrency();

    const cur = $("currency") ? $("currency").value : "USD";
    const unit = $("unit") ? $("unit").value : "gram";
    const karat = $("karat") ? Number($("karat").value) : 24;
    const premium = $("premium") ? Number($("premium").value || 0) : 0;

    try{
      const { data, cached } = await fetchSpot(cur);

      const priceOz24 = data.price_oz_24k;
      const priceG24  = priceOz24 / TROY_OZ_TO_G;

      const base24 = (unit === "oz") ? priceOz24 : priceG24;
      const unitLabel = unit === "oz" ? "أونصة" : "غرام";

      const karatPrice = (base24 * (karat/24)) + premium;

      if($("spotOut")) $("spotOut").textContent = `${formatAR(round2(base24))} ${cur} / ${unitLabel} (24K)`;
      if($("priceOut")) $("priceOut").textContent = `${formatAR(round2(karatPrice))} ${cur} / ${unitLabel} (${karat}K)`;

      if($("updated")) $("updated").textContent = `آخر تحديث: ${data.updated_at || "—"}${cached ? " (من الكاش)" : ""}`;

      renderAllKarats(base24, cur, unitLabel, premium);

      pushHistory(`${cur} • ${unitLabel} • ${karat}K = ${round2(karatPrice)} (Premium ${premium})`);
      showToast("تم التحديث ✅");
    }catch(err){
      showWarn("حدث خطأ أثناء جلب السعر.\nتفاصيل: " + (err?.message || err));
      if($("priceOut")) $("priceOut").textContent = "—";
    }
  }

  // ====== Events ======
  if($("calcBtn")) $("calcBtn").addEventListener("click", calc);

  // في صفحات الدول: العملة مقفلة، فلا نحتاج change عليها
  ["unit","karat","premium"].forEach(id => {
    const el = $(id);
    if(el) el.addEventListener("change", calc);
  });

  // فقط في الصفحة العامة نخلي تغيير العملة يشتغل
  if(!DEFAULT_CUR && $("currency")){
    $("currency").addEventListener("change", calc);
  }

  if($("copyBtn")) $("copyBtn").addEventListener("click", async () => {
    const pageUrl = location.href;
    const txt =
`MarketAPro — أسعار الذهب
العملة: ${$("currency") ? $("currency").value : ""}
الوحدة: ${$("unit") ? $("unit").value : ""}
العيار: ${$("karat") ? $("karat").value : ""}K
المصنعية: ${$("premium") ? $("premium").value : ""}
النتيجة: ${$("priceOut") ? $("priceOut").textContent : ""}
${$("updated") ? $("updated").textContent : ""}
${pageUrl}`;
    try{ await navigator.clipboard.writeText(txt); showToast("تم النسخ ✅"); }
    catch(e){ alert("تعذر النسخ تلقائيًا. انسخ يدويًا:\n\n" + txt); }
  });

  if($("clearHistoryBtn")) $("clearHistoryBtn").addEventListener("click", () => {
    localStorage.removeItem(historyKey);
    renderHistory();
    showToast("تم مسح السجل");
  });

  // ====== Init ======
  applyDefaultCurrency();
  renderHistory();
  calc();
})();
