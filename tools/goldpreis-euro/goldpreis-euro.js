// tools/goldpreis-euro/goldpreis-euro.js
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const WORKER_BASE = "https://hidden-snow-2c44.rab2323s.workers.dev";
  const TROY_OZ_TO_G = 31.1034768;

  const round2 = (n) => Math.round(n * 100) / 100;

  const formatDE = (n) =>
    Number(n).toLocaleString("de-DE", { maximumFractionDigits: 2 });

  const safeNumber = (v, fallback = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  function readInitial() {
    try {
      const el = $("initialGoldEUR");
      if (!el) return null;
      const data = JSON.parse(el.textContent || "{}");
      const price = Number(data.price_oz_24k);
      if (!Number.isFinite(price) || price <= 0) return null;
      return { price_oz_24k: price, updated_at: data.updated_at || "—" };
    } catch {
      return null;
    }
  }

  async function fetchSpot() {
    const res = await fetch(`${WORKER_BASE}/api/gold?currency=EUR`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Fetch failed");
    const json = await res.json();
    const price = Number(json.price_oz_24k);
    if (!Number.isFinite(price) || price <= 0) throw new Error("Bad data");
    return json;
  }

  function applyPremium(price, premiumType, premiumValue) {
    if (premiumType === "percent") return price * (1 + premiumValue / 100);
    return price + premiumValue; // absolute per selected unit
  }

  function renderAll(base24, unitLabel, premiumType, premiumValue) {
    const tbody = $("allKarats");
    tbody.innerHTML = "";
    [24, 22, 21, 18, 14].forEach((k) => {
      const raw = base24 * (k / 24);
      const out = applyPremium(raw, premiumType, premiumValue);
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${k}K</td><td>${formatDE(round2(out))} EUR / ${unitLabel}</td>`;
      tbody.appendChild(tr);
    });
  }

  function renderFrom(priceOz24, updatedAt, isLive) {
    const unit = $("unit").value;
    const karat = safeNumber($("karat").value, 24);

    const premiumType = $("premiumType").value;
    const premiumValue = safeNumber($("premium").value, 0);

    const priceG24 = priceOz24 / TROY_OZ_TO_G;
    const base24 = unit === "oz" ? priceOz24 : priceG24;
    const unitLabel = unit === "oz" ? "Feinunze" : "Gramm";

    const raw = base24 * (karat / 24);
    const finalPrice = applyPremium(raw, premiumType, premiumValue);

    $("priceOut").textContent = `${formatDE(round2(finalPrice))} EUR / ${unitLabel} (${karat}K)`;
    $("updated").textContent = `Letzte Aktualisierung: ${updatedAt || "—"}${isLive ? "" : " (vorgecacht)"}`;

    $("premiumHint").textContent =
      premiumType === "percent"
        ? "Aufgeld wird als Prozent auf den berechneten Preis angewendet."
        : `Aufgeld wird als absoluter Betrag pro ${unitLabel} hinzugefügt.`;

    renderAll(base24, unitLabel, premiumType, premiumValue);
  }

  async function calc() {
    // Paint instantly from prerender (best for GitHub Pages/static)
    const initial = readInitial();
    if (initial) renderFrom(initial.price_oz_24k, initial.updated_at, false);

    // Then try live update
    try {
      const data = await fetchSpot();
      renderFrom(Number(data.price_oz_24k), data.updated_at || "—", true);
    } catch {
      if (!initial) {
        $("priceOut").textContent = "Fehler beim Laden";
        $("updated").textContent = "Letzte Aktualisierung: —";
      }
    }
  }

  const debounce = (fn, wait = 250) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  };

  $("calcBtn").addEventListener("click", calc);
  ["unit", "karat", "premiumType"].forEach((id) =>
    $(id).addEventListener("change", calc)
  );
  $("premium").addEventListener("input", debounce(calc, 250));

  calc();
})();
