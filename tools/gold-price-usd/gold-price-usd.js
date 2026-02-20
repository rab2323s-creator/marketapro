// File: /tools/gold-price-usd/gold-price-usd.js
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);

  // Your Worker endpoint
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

  // Cache & history (per-page)
  const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  const cacheKey = (cur) => `gold_spot_${cur}`;
  const historyKey = `gold_history_last5__tools_gold_price_usd_`;

  function readCache(cur){
    try{
      const raw = localStorage.getItem(cacheKey(cur));
      if(!raw) return null;
      const obj = JSON.parse(raw);
      if(!obj?.ts || !obj?.data) return null;
      if(Date.now() - obj.ts > CACHE_TTL_MS) return null;
      return obj.data;
    }catch{ return null; }
  }
  function writeCache(cur, data){
    try{ localStorage.setItem(cacheKey(cur), JSON.stringify({ ts: Date.now(), data })); }catch{}
  }

  function readHistory(){
    try{
      const raw = localStorage.getItem(historyKey);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    }catch{ return []; }
  }
  function writeHistory(arr){
    try{ localStorage.setItem(historyKey, JSON.stringify(arr.slice(0,5))); }catch{}
  }
  function renderHistory(){
    const ul = $("historyList");
    if(!ul) return;
    const arr = readHistory();
    ul.innerHTML = "";
    if(!arr.length){
      const li = document.createElement("li");
      li.textContent = "No history yet.";
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

  // Read prerendered data from HTML
  function readInitialGold(){
    try{
      const el = $("initialGoldUSD");
      if(!el) return null;
      const obj = JSON.parse((el.textContent || "").trim());
      if(!obj || typeof obj.price_oz_24k !== "number") return null;
      return obj;
    }catch{ return null; }
  }

  async function fetchSpot(cur){
    const cached = readCache(cur);
    if(cached) return { data: cached, cached: true };

    const res = await fetch(
      `${WORKER_BASE}/api/gold?currency=${encodeURIComponent(cur)}`,
      { cache: "no-store" }
    );
    if(!res.ok) throw new Error("Failed to fetch gold price feed.");
    const data = await res.json();
    if(!data || typeof data.price_oz_24k !== "number") throw new Error("Invalid price data.");
    writeCache(cur, data);
    return { data, cached: false };
  }

  function round2(n){ return Math.round((+n||0)*100)/100; }
  function formatEN(n){
    return Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 });
  }

  function renderAllKarats(base24, cur, unitLabel, premium){
    const tbody = $("allKarats");
    if(!tbody) return;
    const karats = [24,22,21,18,14];
    tbody.innerHTML = "";
    karats.forEach(k => {
      const price = (base24 * (k/24)) + premium;
      const tr = document.createElement("tr");
      tr.innerHTML = `<td><strong>${k}K</strong></td><td>${formatEN(round2(price))} ${cur} / ${unitLabel}</td>`;
      tbody.appendChild(tr);
    });
  }

  function renderFromData(data, opts){
    const { cur, unit, karat, premium, note } = opts;

    const priceOz24 = data.price_oz_24k;
    const priceG24  = priceOz24 / TROY_OZ_TO_G;

    const base24 = (unit === "oz") ? priceOz24 : priceG24;
    const unitLabel = unit === "oz" ? "oz (troy)" : "gram";

    const karatPrice = (base24 * (karat/24)) + premium;

    if($("spotOut")) $("spotOut").textContent = `${formatEN(round2(base24))} ${cur} / ${unitLabel} (24K)`;
    if($("priceOut")) $("priceOut").textContent = `${formatEN(round2(karatPrice))} ${cur} / ${unitLabel} (${karat}K)`;

    const updated = data.updated_at || "—";
    if($("updated")) $("updated").textContent = `Last update: ${updated}${note ? ` ${note}` : ""}`;

    renderAllKarats(base24, cur, unitLabel, premium);
    return { unitLabel, karatPrice };
  }

  async function calc(){
    clearWarn();

    if($("priceOut")) $("priceOut").textContent = "Updating…";
    if($("spotOut")) $("spotOut").textContent = "—";
    if($("updated")) $("updated").textContent = "Last update: —";
    if($("allKarats")) $("allKarats").innerHTML = "";

    const cur = "USD";
    const unit = $("unit") ? $("unit").value : "gram";
    const karat = $("karat") ? Number($("karat").value) : 24;
    const premium = $("premium") ? Number($("premium").value || 0) : 0;

    // 1) Show prerendered price immediately
    const initial = readInitialGold();
    if(initial && initial.price_oz_24k > 0){
      renderFromData(initial, { cur, unit, karat, premium, note: "(page preload)" });
    }

    // 2) Fetch latest price
    try{
      const { data, cached } = await fetchSpot(cur);
      const result = renderFromData(data, { cur, unit, karat, premium, note: cached ? "(cache)" : "" });
      pushHistory(`${cur} • ${result.unitLabel} • ${karat}K = ${round2(result.karatPrice)} (Premium ${premium})`);
      showToast("Updated");
    }catch(err){
      showWarn(`Error fetching price.\nDetails: ${err?.message || err}`);
      if($("priceOut")) $("priceOut").textContent = "—";
    }
  }

  // Events
  if($("calcBtn")) $("calcBtn").addEventListener("click", calc);

  ["unit","karat","premium"].forEach(id => {
    const el = $(id);
    if(el) el.addEventListener("change", calc);
  });

  if($("copyBtn")) $("copyBtn").addEventListener("click", async () => {
    const pageUrl = location.href;
    const txt =
`MarketAPro — Gold Price (USD)
Currency: USD
Unit: ${$("unit") ? $("unit").value : ""}
Karat: ${$("karat") ? $("karat").value : ""}K
Premium: ${$("premium") ? $("premium").value : ""}
Result: ${$("priceOut") ? $("priceOut").textContent : ""}
${$("updated") ? $("updated").textContent : ""}
${pageUrl}`;
    try{ await navigator.clipboard.writeText(txt); showToast("Copied"); }
    catch{ alert("Copy failed. Please copy manually:\n\n" + txt); }
  });

  if($("clearHistoryBtn")) $("clearHistoryBtn").addEventListener("click", () => {
    localStorage.removeItem(historyKey);
    renderHistory();
    showToast("History cleared");
  });

  // Init
  renderHistory();
  calc();
})();
