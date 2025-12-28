 /* =========================
   CONFIG (حتى لا تنسى placeholders)
========================= */
const CONFIG = {
  whatsappNumber: "49 15565 678291", // ✅ اكتب الرقم بأي صيغة وسنحوّله لأرقام فقط
  whatsappText: "مرحبًا MarketAPro، أريد تحليلًا مجانيًا لصفحتي على فيس بوك",
};

/* =========================
   UI Helpers + Tracking
========================= */
function showToast(msg){
  const t = document.getElementById('toast');
  if(!t) return;
  t.textContent = msg;
  t.style.display = 'block';
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(()=>{ t.style.display='none'; }, 2200);
}

function track(eventName, params){
  const payload = Object.assign({ event: eventName }, params || {});
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(payload);
  if (typeof window.gtag === "function") {
    try { window.gtag("event", eventName, params || {}); } catch(_) {}
  }
}

/* =========================
   Time Utilities
   - ✅ support all dashes (–,-,—) + spaces
   - ✅ DST-safe option using a reference date
========================= */
function pad2(n){ return String(n).padStart(2,'0'); }

function parseHHMM(s){
  const m = String(s).match(/(\d{1,2})\s*:\s*(\d{2})/);
  if(!m) return null;
  const hh = Math.max(0, Math.min(23, Number(m[1])));
  const mm = Math.max(0, Math.min(59, Number(m[2])));
  return { hh, mm };
}

function minutesOf(hh,mm){ return hh*60+mm; }

function fmtMin(total){
  total = ((total % 1440) + 1440) % 1440;
  const hh = Math.floor(total/60);
  const mm = total%60;
  return pad2(hh)+":"+pad2(mm);
}

function shiftRange(rangeText, shiftMin){
  const txt = String(rangeText).trim();
  const parts = txt.split(/\s*(?:–|-|—)\s*/);
  if(parts.length !== 2) return rangeText;
  const a = parseHHMM(parts[0]);
  const b = parseHHMM(parts[1]);
  if(!a || !b) return rangeText;
  return fmtMin(minutesOf(a.hh,a.mm) + shiftMin) + "–" + fmtMin(minutesOf(b.hh,b.mm) + shiftMin);
}

function shiftEntry(entry, shiftMin){
  const txt = String(entry);
  const re = /(\d{1,2}\s*:\s*\d{2})\s*(?:–|-|—)\s*(\d{1,2}\s*:\s*\d{2})/;
  const m = txt.match(re);
  if(!m) return txt;
  const original = m[0];
  const shifted = shiftRange(original, shiftMin);
  return txt.replace(original, shifted);
}

// Get tz offset minutes for IANA zone at a given reference date
function tzOffsetMinutesAt(iana, refDate){
  try{
    const d = new Date(refDate);
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: iana,
      hour12: false,
      year:'numeric', month:'2-digit', day:'2-digit',
      hour:'2-digit', minute:'2-digit', second:'2-digit'
    }).formatToParts(d);
    const get = (type) => parts.find(p=>p.type===type)?.value;
    const asUTC = Date.UTC(
      Number(get('year')),
      Number(get('month')) - 1,
      Number(get('day')),
      Number(get('hour')),
      Number(get('minute')),
      Number(get('second'))
    );
    return Math.round((asUTC - d.getTime()) / 60000);
  }catch(e){
    return 0;
  }
}

function planningRefDate(mode){
  if(mode === "today") return new Date();
  const d = new Date();
  const day = d.getDay(); // 0 Sun .. 6 Sat
  const daysUntilMonday = (8 - day) % 7 || 7;
  d.setDate(d.getDate() + daysUntilMonday);
  d.setHours(12,0,0,0);
  return d;
}

/* =========================
   Data Model
========================= */
const regionTZ = {
  gulf: "Asia/Riyadh",
  egypt: "Africa/Cairo",
  levant: "Asia/Beirut",
  maghreb: "Africa/Casablanca",
  europe: "Europe/Berlin",
  global: "UTC"
};

const byRegion = {
  gulf:   { label:"الخليج", prime:["الثلاثاء 18:00–21:00","الخميس 09:00–11:00","السبت 11:00–13:00"], extra:["الإثنين 19:00–21:00","الأربعاء 10:00–12:00","الجمعة 16:00–19:00"] },
  egypt:  { label:"مصر",    prime:["الأحد 19:00–22:00","الثلاثاء 18:00–21:00","الخميس 10:00–12:00"], extra:["السبت 11:00–13:00","الأربعاء 18:00–20:00","الجمعة 16:00–19:00"] },
  levant: { label:"بلاد الشام", prime:["الثلاثاء 18:00–21:00","الأربعاء 10:00–12:00","السبت 11:00–13:00"], extra:["الإثنين 18:00–20:00","الخميس 09:00–11:00","الجمعة 16:00–19:00"] },
  maghreb:{ label:"المغرب العربي", prime:["الأربعاء 19:00–21:00","الخميس 10:00–12:00","السبت 12:00–14:00"], extra:["الثلاثاء 18:00–20:00","الإثنين 10:00–12:00","الأحد 18:00–21:00"] },
  europe: { label:"أوروبا", prime:["الإثنين 18:00–20:00","الأربعاء 12:00–14:00","السبت 10:00–12:00"], extra:["الثلاثاء 18:00–21:00","الخميس 09:00–11:00","الأحد 19:00–21:00"] },
  global: { label:"جمهور مختلط", prime:["يوميًا 09:00–11:00","يوميًا 18:00–21:00","الثلاثاء/الخميس (تجربة أولًا)"], extra:["السبت 11:00–13:00","الأربعاء 10:00–12:00","الجمعة 16:00–19:00"] }
};

const LABELS = {
  goal: {
    engagement:"زيادة التفاعل",
    reach:"زيادة الوصول",
    sales:"مبيعات/Leads",
    brand:"وعي بالعلامة"
  },
  format: {
    reels:"Reels",
    video:"Video",
    post:"Post",
    link:"Link",
    mixed:"مختلط"
  },
  type: {
    page:"صفحة (Page)",
    group:"جروب/مجتمع (Group)",
    creator:"صانع محتوى (Creator)",
    personal:"شخصي"
  },
  audience: {
    b2b:"B2B (مهني/شركات)",
    b2c:"B2C (جمهور عام)"
  },
  industry: {
    general:"عام",
    entertainment:"ترفيه/ميمز",
    education:"تعليمي",
    ecommerce:"تجارة إلكترونية",
    local:"خدمات محلية"
  },
  daysMode: {
    all:"كل الأيام",
    workdays:"أيام العمل (تقريبًا)",
    weekend:"الويكند (تقريبًا)"
  },
  planning: {
    today:"توقيت اليوم (الآن)",
    thisweek:"هذا الأسبوع (تقليل فخ DST)"
  }
};

function label(map, key){ return (map && map[key]) ? map[key] : key; }

function goalHints(goal, format, audience){
  const hints = [];
  if(goal === "sales") hints.push("للمبيعات/الطلبات: جرّب 10:00–12:00 + 19:00–21:00 وكرر CTA واضح.");
  if(goal === "reach") hints.push("للوصول: كرّر نفس الصيغة 3 مرات أسبوعيًا واختر وقتين ثابتين.");
  if(goal === "brand") hints.push("للوعي: حافظ على اتساق الرسالة + تكرار أسبوعي بنفس الفكرة.");
  if(goal === "engagement") hints.push("للتفاعل: أضف سؤالًا/استفتاء وركز على المساء والويكند.");
  if(format === "reels") hints.push("Reels: غالبًا الأفضل مساءً + عطلة نهاية الأسبوع.");
  if(format === "video") hints.push("Video: جرّب 18:00–21:00 لأن المشاهدة تزيد بعد العمل.");
  if(format === "link") {
    hints.push("Links: غالبًا تعمل أفضل صباحًا/ظهرًا (خصوصًا للجمهور المهني).");
    if(audience === "b2b") hints.push("B2B: ثبّت 10:00–12:00 في أيام العمل أولًا.");
  }
  return hints;
}

function industryTweaks(industry){
  if(industry === "entertainment") return ["السبت 21:00–23:00 — مناسب للمحتوى الترفيهي"];
  if(industry === "education") return ["الأربعاء 11:00–13:00 — مناسب للمحتوى التعليمي"];
  if(industry === "ecommerce") return ["الخميس 19:00–22:00 — مناسب لقرارات الشراء"];
  if(industry === "local") return ["الأحد 12:00–14:00 — مناسب لخدمات محلية/عائلية"];
  return [];
}

/* =========================
   ✅ Professional logic:
   - Top 3 comes from region.prime only (with minimal tweaks)
   - Smart suggestions + type/format/audience go to Extra
========================= */
function tweakPrime(primeArr, goal, format, audience, daysMode){
  const arr = primeArr.slice();

  const preferMorning = (format === "link") || (audience === "b2b" && goal !== "engagement");
  const preferEvening = (format === "reels" || format === "video" || goal === "engagement");

  function hasRangeBetween(txt, startH, endH){
    const m = String(txt).match(/(\d{1,2})\s*:\s*(\d{2})/);
    if(!m) return false;
    const hh = Number(m[1]);
    return hh >= startH && hh <= endH;
  }

  arr.sort((a,b)=>{
    const aMorning = hasRangeBetween(a, 8, 12);
    const bMorning = hasRangeBetween(b, 8, 12);
    const aEvening = hasRangeBetween(a, 17, 22);
    const bEvening = hasRangeBetween(b, 17, 22);

    let sa = 0, sb = 0;
    if(preferMorning){ sa += aMorning?2:0; sb += bMorning?2:0; }
    if(preferEvening){ sa += aEvening?2:0; sb += bEvening?2:0; }
    sa += dayModeMatchBoost(a, daysMode);
    sb += dayModeMatchBoost(b, daysMode);
    return sb - sa;
  });

  return uniqueKeep(arr).slice(0, 3);
}

function smartSuggestions(type, format, goal, audience, industry){
  const add = [];

  if(type === "page") add.push("الأحد 10:00–12:00 — مناسب لصفحات الأعمال (محتوى مستقر/روابط)");
  if(type === "group") add.push("الخميس 20:00–22:00 — وقت ممتاز لنشاط الجروبات (نقاش/أسئلة)");
  if(type === "creator") add.push("السبت 18:00–21:00 — جمهور نشط للمحتوى والترند");
  if(type === "personal") add.push("الجمعة 19:00–21:00 — وقت جيد للتفاعل الاجتماعي");

  if(format === "reels") add.push("يوميًا 19:00–22:00 — مناسب لـ Reels (مساءً)");
  if(format === "video") add.push("الثلاثاء 18:00–21:00 — Video بعد العمل ممتاز");
  if(format === "link")  add.push("الإثنين 10:00–12:00 — روابط (Link) وقت الدوام أفضل");
  if(format === "post")  add.push("الأربعاء 12:00–14:00 — منشورات نص/صورة وقت الظهيرة جيد");

  if(goal === "sales") add.push("الخميس 19:00–21:00 — وقت قوي للطلبات/الرسائل + CTA");
  if(goal === "reach") add.push("الأربعاء 18:00–20:00 — رفع الوصول مع تكرار نفس الصيغة");
  if(goal === "brand") add.push("الأحد 12:00–14:00 — وعي بالعلامة (محتوى خفيف ومتكرر)");
  if(audience === "b2b") add.push("الثلاثاء 10:00–12:00 — B2B: تركيز صباحي أيام العمل");

  industryTweaks(industry).forEach(x => add.push(x));

  return uniqueKeep(add);
}

function uniqueKeep(arr){
  const out = [];
  for(const x of arr){
    if(!out.includes(x)) out.push(x);
  }
  return out;
}

/* =========================
   Days filter (approx)
========================= */
const DAYS_WEEKEND = ["الجمعة","السبت","الأحد"];
const DAYS_WORK = ["الإثنين","الثلاثاء","الأربعاء","الخميس"];

function entryDay(entry){
  const txt = String(entry);
  const all = DAYS_WEEKEND.concat(DAYS_WORK);
  for(const d of all){
    if(txt.includes(d)) return d;
  }
  return null; // e.g. "يوميًا ..."
}

function dayModeMatchBoost(entry, mode){
  if(mode === "all") return 0.2;
  const d = entryDay(entry);
  if(!d) return 0.1;
  if(mode === "weekend") return DAYS_WEEKEND.includes(d) ? 0.6 : 0;
  if(mode === "workdays") return DAYS_WORK.includes(d) ? 0.6 : 0;
  return 0;
}

function filterByDays(arr, mode){
  if(mode === "all") return arr;
  return arr.filter(x=>{
    const d = entryDay(x);
    if(!d) return true;
    if(mode === "weekend") return DAYS_WEEKEND.includes(d);
    if(mode === "workdays") return DAYS_WORK.includes(d);
    return true;
  });
}

/* =========================
   Timezone conversion
========================= */
function computeShiftMinutes(country, tzMode, localTz, planningMode){
  const ref = planningRefDate(planningMode);
  if(tzMode === "audience") return { shift: 0, label: "توقيت الجمهور (" + (regionTZ[country] || "—") + ")", ref };

  const aTZ = regionTZ[country] || "UTC";
  const lTZ = (localTz || "Europe/Berlin").trim();

  const aOff = tzOffsetMinutesAt(aTZ, ref);
  const lOff = tzOffsetMinutesAt(lTZ, ref);

  const shift = (lOff - aOff);
  return { shift, label: "توقيتك (" + lTZ + ")", ref };
}

function applyTimezone(arr, shiftMin, tzMode){
  if(tzMode === "audience" || shiftMin === 0) return arr;
  return arr.map(x => shiftEntry(x, shiftMin));
}

/* =========================
   Score (simple confidence layer)
========================= */
function scoreText(level){
  return level >= 8 ? "عالي" : level >= 5 ? "متوسط" : "منخفض";
}

function computeScores(goal, format, audience, daysMode){
  let engage = 5, sales = 5, reach = 5;

  if(format === "reels" || format === "video"){ engage += 2; reach += 1; sales -= 1; }
  if(format === "link"){ sales += 2; engage -= 1; reach += 1; }
  if(format === "post"){ engage += 1; reach += 1; }

  if(goal === "engagement") engage += 3;
  if(goal === "sales") sales += 3;
  if(goal === "reach") reach += 3;
  if(goal === "brand"){ reach += 1; engage += 1; }

  if(audience === "b2b"){ sales += 1; engage -= 1; }
  if(daysMode === "weekend"){ engage += 1; sales -= 1; }
  if(daysMode === "workdays"){ sales += 1; }

  engage = Math.max(0, Math.min(10, engage));
  sales = Math.max(0, Math.min(10, sales));
  reach = Math.max(0, Math.min(10, reach));
  return { engage, sales, reach };
}

function renderScores(scores){
  const row = document.getElementById("scoreRow");
  if(!row) return;
  row.innerHTML = "";
  const items = [
    { title:"مناسب للتفاعل", v:scores.engage },
    { title:"مناسب للمبيعات", v:scores.sales },
    { title:"مناسب للوصول", v:scores.reach },
  ];
  items.forEach(it=>{
    const el = document.createElement("div");
    el.className = "score";
    el.innerHTML = `${it.title}: ${scoreText(it.v)} <small>(${it.v}/10)</small>`;
    row.appendChild(el);
  });
}

/* =========================
   ✅ NEW: Strong Results Layer
   - Reasons
   - KPIs
   - Confidence%
   - Plan + ICS
========================= */

// Extract first HH:MM from a range string like "الأحد 19:00–22:00"
function extractFirstTimeHHMM(entry){
  const m = String(entry).match(/(\d{1,2})\s*:\s*(\d{2})/);
  if(!m) return null;
  return pad2(Number(m[1])) + ":" + m[2];
}

function getKpis(format, goal) {
  if (format === "link") {
    return [
      "النقرات على الرابط (Link Clicks)",
      "CTR (معدل النقر)",
      "الزيارات/التحويلات (إن وجدت)",
      goal === "sales" ? "الرسائل/Leads" : "الوصول (Reach)"
    ];
  }
  if (format === "reels" || format === "video") {
    return [
      "مشاهدات 3 ثوانٍ + مدة المشاهدة (Watch Time)",
      "الاحتفاظ/اكتمال المشاهدة (Retention)",
      "المشاركات (Shares) — مؤشر قوي للانتشار",
      "التعليقات + التفاعل"
    ];
  }
  return [
    "الوصول (Reach)",
    "التفاعل (تعليقات/تفاعلات/مشاركات)",
    "نقرات الصفحة/الملف (Page/Profile clicks)",
    goal === "sales" ? "الرسائل (Messages) أو Leads" : "المشاركات (Shares)"
  ];
}

function explainTimeReason({ type, format, audience, goal, industry }, timeStr) {
  const isMorning = /^0?9:|^10:|^11:|^12:/.test(timeStr);
  const isAfternoon = /^13:|^14:|^15:|^16:/.test(timeStr);
  const isEvening = /^17:|^18:|^19:|^20:|^21:|^22:/.test(timeStr);

  const reasons = [];

  if (type === "group" && isEvening) reasons.push("مناسب للجروبات لأن النقاش يزيد بعد العمل.");
  if (format === "link" && (isMorning || isAfternoon)) reasons.push("مناسب للروابط خصوصًا في وقت الدوام.");
  if ((format === "reels" || format === "video") && isEvening) reasons.push("مناسب للفيديو/Reels لأن الاستهلاك يرتفع مساءً.");
  if (audience === "b2b" && (isMorning || isAfternoon)) reasons.push("B2B غالبًا يتفاعل أكثر خلال ساعات العمل.");
  if (goal === "sales" && (isAfternoon || isEvening)) reasons.push("للمبيعات/Leads: وقت جيد لاتخاذ قرار أو إرسال رسالة.");
  if (industry === "entertainment" && isEvening) reasons.push("الترفيه يميل للمساء وعطلة نهاية الأسبوع.");

  if (reasons.length === 0) reasons.push("وقت قوي كبداية وفق أنماط شائعة، وثبّت الأفضل بالاختبار وInsights.");
  return reasons.join(" ");
}

function renderReasonsAndKpis(state, topTimesRanges){
  // topTimesRanges هي مثل: ["الأحد 19:00–22:00", ...] بعد التحويل
  const reasonsEl = document.getElementById("reasons");
  const kpisEl = document.getElementById("kpis");
  if(reasonsEl){
    reasonsEl.innerHTML = "";
    topTimesRanges.forEach(r=>{
      const t = extractFirstTimeHHMM(r) || "—";
      const li = document.createElement("li");
      li.innerHTML = `<strong>${r}</strong><br><span style="color:var(--muted)">${explainTimeReason(state, t)}</span>`;
      reasonsEl.appendChild(li);
    });
  }
  if(kpisEl){
    kpisEl.innerHTML = "";
    getKpis(state.format, state.goal).forEach(k=>{
      const li = document.createElement("li");
      li.textContent = k;
      kpisEl.appendChild(li);
    });
  }
}

function calcConfidence(state, topTimesRanges) {
  // we score based on state + whether times contain morning/evening
  let score = 50;

  const firstTimes = topTimesRanges
    .map(extractFirstTimeHHMM)
    .filter(Boolean);

  const hasEvening = firstTimes.some(t => /^18:|^19:|^20:|^21:|^22:/.test(t));
  const hasMorning = firstTimes.some(t => /^0?9:|^10:|^11:|^12:/.test(t));

  if (state.type === "group") score += 4;
  if (state.format === "link" && state.audience === "b2b") score += 12;
  if ((state.format === "reels" || state.format === "video") && hasEvening) score += 8;
  if (state.format === "link" && hasMorning) score += 6;

  if (state.country === "global") score -= 8;
  if (state.daysMode !== "all") score += 4;

  score = Math.max(30, Math.min(95, score));

  let labelTxt = "جيد كبداية";
  if (score >= 80) labelTxt = "قوي جدًا";
  else if (score >= 65) labelTxt = "قوي";
  else if (score < 50) labelTxt = "يحتاج اختبار أكثر";

  return { score, label: labelTxt };
}

function renderConfidenceChip(conf){
  const row = document.getElementById("scoreRow");
  if(!row) return;

  // avoid duplicates
  const existing = Array.from(row.querySelectorAll(".score")).find(x => x.textContent.includes("Confidence"));
  if(existing) existing.remove();

  const el = document.createElement("div");
  el.className = "score";
  el.innerHTML = `Confidence: ${conf.label} <small>(${conf.score}%)</small>`;
  row.prepend(el);
}

// Plan helpers
function toLocalDateISO(d){
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
}

function parseFirstTimeToHM(rangeStr){
  const t = extractFirstTimeHHMM(rangeStr);
  if(!t) return null;
  const p = parseHHMM(t);
  if(!p) return null;
  return { hh: p.hh, mm: p.mm, raw: t };
}

function buildPlanFromRanges(topTimesRanges, daysCount, startDateStr){
  const start = startDateStr ? new Date(startDateStr + "T00:00:00") : new Date();
  start.setHours(0,0,0,0);

  const plan = [];
  for(let i=0;i<daysCount;i++){
    const d = new Date(start);
    d.setDate(start.getDate() + i);

    const pick = topTimesRanges[i % topTimesRanges.length];
    const hm = parseFirstTimeToHM(pick);
    if(!hm) continue;

    const ev = new Date(d);
    ev.setHours(hm.hh, hm.mm, 0, 0);
    plan.push({ date: ev, label: pick });
  }
  return plan;
}

function formatPlanLine(item){
  const d = item.date;
  const dayName = d.toLocaleDateString("ar", { weekday:"long" });
  const dateStr = d.toLocaleDateString("ar", { year:"numeric", month:"2-digit", day:"2-digit" });
  return `${dayName} — ${dateStr} — ${item.label}`;
}

function renderPlan(plan){
  const box = document.getElementById("planBox");
  const list = document.getElementById("planList");
  if(!box || !list) return;

  list.innerHTML = "";
  plan.forEach(p=>{
    const li = document.createElement("li");
    li.textContent = formatPlanLine(p);
    list.appendChild(li);
  });
  box.style.display = "block";
}

function planToText(plan){
  return plan.map(formatPlanLine).join("\n");
}

function downloadTextFile(filename, text){
  const blob = new Blob([text], {type:"text/plain;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function toICSDate(d){
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth()+1);
  const dd = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mi = pad2(d.getMinutes());
  return `${yyyy}${mm}${dd}T${hh}${mi}00`;
}

function buildICS(plan, titlePrefix, tzLabel){
  const dtstamp = toICSDate(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MarketAPro//BestTimeFacebook//AR",
    "CALSCALE:GREGORIAN"
  ];

  plan.forEach((p, idx)=>{
    const start = p.date;
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + 15);

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:marketapro-facebook-${idx}-${start.getTime()}@marketapro.com`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`DTSTART:${toICSDate(start)}`);
    lines.push(`DTEND:${toICSDate(end)}`);
    lines.push(`SUMMARY:${titlePrefix} (${tzLabel})`);
    lines.push("DESCRIPTION:خطة نشر مقترحة من MarketAPro. راقب Insights وثبّت الأفضل خلال 14 يوم.");
    lines.push("END:VEVENT");
  });

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

let __lastPlan = [];
let __planBound = false;

function bindPlanUI(topTimesRanges, tzLabel){
  if(__planBound) return;
  __planBound = true;

  const planStart = document.getElementById("planStart");
  if(planStart && !planStart.value) planStart.value = toLocalDateISO(new Date());

  document.getElementById("buildPlanBtn")?.addEventListener("click", ()=>{
    const days = Number(document.getElementById("planDays")?.value || 7);
    const startStr = document.getElementById("planStart")?.value || "";
    __lastPlan = buildPlanFromRanges(topTimesRanges, days, startStr);
    renderPlan(__lastPlan);
    showToast("تم إنشاء الخطة ✅");
    track("plan_build", { tool: "best_time_facebook", days });
  });

  document.getElementById("copyPlanBtn")?.addEventListener("click", async ()=>{
    if(!__lastPlan.length) return showToast("أنشئ الخطة أولًا.");
    await navigator.clipboard.writeText(planToText(__lastPlan));
    showToast("تم نسخ الخطة ✅");
    track("plan_copy", { tool: "best_time_facebook" });
  });

  document.getElementById("downloadIcsBtn")?.addEventListener("click", ()=>{
    if(!__lastPlan.length) return showToast("أنشئ الخطة أولًا.");
    const ics = buildICS(__lastPlan, "نشر فيس بوك — MarketAPro", tzLabel || "—");
    downloadTextFile("marketapro-facebook-plan.ics", ics);
    showToast("تم تجهيز ملف التقويم ✅");
    track("plan_ics_download", { tool: "best_time_facebook" });
  });
}

/* =========================
   Render
========================= */
function renderList(id, arr){
  const el = document.getElementById(id);
  if(!el) return;
  el.innerHTML = '';
  arr.forEach(t=>{
    const li = document.createElement('li');
    li.textContent = t;
    el.appendChild(li);
  });
}

/* =========================
   Init: timezone autofill + WhatsApp config
========================= */
(function initLocalTZ(){
  const input = document.getElementById("localTz");
  const opt = document.getElementById("tzLocalOpt");
  if(!input || !opt) return;
  try{
    const deviceTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if(deviceTZ){
      input.value = deviceTZ;
      opt.textContent = `توقيتي (${deviceTZ})`;
    }
  }catch(_){
    opt.textContent = `توقيتي (${input.value})`;
  }
})();

(function initWhatsApp(){
  const btn = document.getElementById("waBtn");
  const note = document.getElementById("waMissingNote");
  if(!btn || !note) return;

  // sanitize number: keep digits only
  const raw = String(CONFIG.whatsappNumber || "").trim();
  const n = raw.replace(/\D/g, "");

  const isPlaceholder = (!n || n === "491234567890" || n.includes("123456"));
  if(isPlaceholder){
    btn.style.display = "none";
    note.style.display = "block";
    return;
  }
  const text = encodeURIComponent(CONFIG.whatsappText || "مرحبًا، أريد تحليلًا مجانيًا.");
  btn.href = `https://wa.me/${n}?text=${text}`;
})();

/* =========================
   Form logic
========================= */
const form = document.getElementById('timeForm');
const out = document.getElementById('output');

form.addEventListener('submit', (e)=>{
  e.preventDefault();

  const country = document.getElementById('country').value;
  const goal = document.getElementById('goal').value;
  const type = document.getElementById('type').value;
  const format = document.getElementById('format').value;
  const audience = document.getElementById('audience').value;
  const industry = document.getElementById('industry').value;
  const daysMode = document.getElementById('daysMode').value;

  const planning = document.getElementById('planning').value;
  const tzMode = document.getElementById('tzMode').value;
  const localTz = document.getElementById('localTz').value;

  const region = byRegion[country];
  const hints = goalHints(goal, format, audience);

  // ✅ DST-aware shift
  const tz = computeShiftMinutes(country, tzMode, localTz, planning);
  const tzBadgeEl = document.getElementById('tzBadge');
  if(tzBadgeEl) tzBadgeEl.textContent = "الأوقات المعروضة بتوقيت: " + tz.label;

  // ✅ Prime
  const primeBase = filterByDays(region.prime, daysMode);
  const top3 = tweakPrime(primeBase.length ? primeBase : region.prime, goal, format, audience, daysMode);

  // ✅ Extra
  const extraBase = filterByDays(region.extra, daysMode);
  const smart = filterByDays(smartSuggestions(type, format, goal, audience, industry), daysMode);

  let extras = uniqueKeep(extraBase.concat(smart)).filter(x => !top3.includes(x));

  // Apply timezone conversion if needed
  const topTimes = applyTimezone(top3, tz.shift, tzMode);
  const extraTimes = applyTimezone(extras, tz.shift, tzMode);

  // Meta
  const meta = document.getElementById('meta');
  if(meta){
    meta.textContent =
      `جمهور: ${region.label} — هدف: ${label(LABELS.goal, goal)} — نوع الحساب: ${label(LABELS.type, type)} — نوع المحتوى: ${label(LABELS.format, format)} — نوع الجمهور: ${label(LABELS.audience, audience)} — المجال: ${label(LABELS.industry, industry)} — الأيام: ${label(LABELS.daysMode, daysMode)}`
      + (hints[0] ? (" | نصيحة: " + hints[0]) : "");
  }

  // DST note
  const dstNote = document.getElementById("dstNote");
  if(dstNote){
    const ref = tz.ref;
    const refLabel = (planning === "thisweek")
      ? `تم حساب التحويل بناءً على هذا الأسبوع (مرجع: ${ref.toLocaleDateString('ar')} ${ref.toLocaleTimeString('ar',{hour:'2-digit',minute:'2-digit'})}).`
      : `تم حساب التحويل بناءً على توقيت اليوم (قد يتغير فرق ساعة عند تغيير التوقيت الصيفي/الشتوي).`;
    dstNote.textContent = "⚠️ ملاحظة DST: " + refLabel;
  }

  // Score
  renderScores(computeScores(goal, format, audience, daysMode));

  // Render lists
  renderList('topTimes', topTimes);
  renderList('extraTimes', extraTimes);

  // ✅ NEW: Stronger results (reasons + KPIs + confidence + plan)
  const state = { country, goal, type, format, audience, industry, daysMode };
  renderReasonsAndKpis(state, topTimes);

  const conf = calcConfidence(state, topTimes);
  renderConfidenceChip(conf);

  // bind plan UI once, but we want it to use the latest topTimes after each submit.
  // easiest: reset binding and rebind with latest (safe because listeners are bound once)
  // We'll keep listeners once; the plan will be built from "latestTopTimes" variable.
  window.__latestTopTimesRanges = topTimes.slice();
  window.__latestTzLabel = tz.label;
  bindPlanUI(window.__latestTopTimesRanges, window.__latestTzLabel);

  out.style.display = 'block';
  history.replaceState(null,'','#results');
  showToast('تم إنشاء التوصيات ✅');

  track("tool_submit", { tool: "best_time_facebook", country, goal, type, format, audience, industry, daysMode, tzMode, planning });
});

document.getElementById('clearBtn')?.addEventListener('click', ()=>{
  document.getElementById('country').value = 'gulf';
  document.getElementById('goal').value = 'engagement';
  document.getElementById('type').value = 'page';
  document.getElementById('format').value = 'reels';
  document.getElementById('audience').value = 'b2c';
  document.getElementById('industry').value = 'general';
  document.getElementById('daysMode').value = 'all';
  document.getElementById('planning').value = 'today';
  document.getElementById('tzMode').value = 'audience';
  document.getElementById('hint').textContent = '';
  out.style.display = 'none';
  history.replaceState(null,'',' ');
  showToast('تم المسح');

  // clear new sections
  const reasonsEl = document.getElementById("reasons");
  const kpisEl = document.getElementById("kpis");
  if(reasonsEl) reasonsEl.innerHTML = "";
  if(kpisEl) kpisEl.innerHTML = "";
  const planBox = document.getElementById("planBox");
  if(planBox) planBox.style.display = "none";

  track("tool_clear", { tool: "best_time_facebook" });
});

document.getElementById('copyBtn')?.addEventListener('click', async ()=>{
  if(out.style.display === 'none'){
    showToast('احسب أولًا لنسخ الملخص');
    return;
  }
  const countryTxt = document.getElementById('country').options[document.getElementById('country').selectedIndex].text;
  const goal = document.getElementById('goal').value;
  const type = document.getElementById('type').value;
  const format = document.getElementById('format').value;
  const audience = document.getElementById('audience').value;
  const industry = document.getElementById('industry').value;
  const daysMode = document.getElementById('daysMode').value;
  const planning = document.getElementById('planning').value;

  const tzBadge = document.getElementById('tzBadge').textContent.replace("الأوقات المعروضة بتوقيت:","").trim();
  const top = [...document.querySelectorAll('#topTimes li')].map(li=>"- " + li.textContent).join("\n");
  const extra = [...document.querySelectorAll('#extraTimes li')].map(li=>"- " + li.textContent).join("\n");
  const reasons = [...document.querySelectorAll('#reasons li')].map(li=>"- " + li.textContent.replace(/\s+/g," ").trim()).join("\n");
  const kpis = [...document.querySelectorAll('#kpis li')].map(li=>"- " + li.textContent).join("\n");

  const txt =
`MarketAPro — أفضل وقت للنشر على فيس بوك
البلد/المنطقة: ${countryTxt}
الهدف: ${label(LABELS.goal, goal)}
نوع الحساب: ${label(LABELS.type, type)}
نوع المحتوى: ${label(LABELS.format, format)}
نوع الجمهور: ${label(LABELS.audience, audience)}
المجال: ${label(LABELS.industry, industry)}
الأيام: ${label(LABELS.daysMode, daysMode)}
التحويل: ${label(LABELS.planning, planning)}
التوقيت: ${tzBadge}

أفضل 3 أوقات:
${top}

لماذا هذه الأوقات؟
${reasons || "- —"}

ماذا تراقب في Insights؟
${kpis || "- —"}

أوقات إضافية + اقتراحات:
${extra}

الرابط: https://marketapro.com/tools/best-time-to-post-facebook/`;

  try{
    await navigator.clipboard.writeText(txt);
    showToast('تم نسخ الملخص ✅');
    track("copy_summary", { tool: "best_time_facebook" });
  }catch(e){
    alert('تعذر النسخ تلقائيًا. انسخ النص يدويًا:\n\n' + txt);
  }
});

document.getElementById('shareBtn')?.addEventListener('click', async ()=>{
  if(out.style.display === 'none'){
    showToast('احسب أولًا ثم شارك');
    return;
  }
  const url = location.href.split('#')[0] + "#results";
  const title = "أفضل وقت للنشر على فيس بوك — MarketAPro";
  const text = "جرّب الأداة: تحويل توقيت + DST + اقتراح أفضل الأوقات حسب بلد الجمهور ونوع المحتوى.";

  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      track("share", { tool: "best_time_facebook", method: "web_share" });
    } catch (_) {}
  } else {
    try{
      await navigator.clipboard.writeText(url);
      showToast('تم نسخ رابط النتائج للمشاركة ✅');
      track("share", { tool: "best_time_facebook", method: "copy_link" });
    } catch(_) {}
  }
});

document.getElementById('copyLinkBtn')?.addEventListener('click', async ()=>{
  try{
    await navigator.clipboard.writeText(location.href);
    showToast('تم نسخ رابط الأداة ✅');
    track("copy_link", { tool: "best_time_facebook" });
  }catch(e){
    alert('تعذر النسخ تلقائيًا.');
  }
});

// Insights button: scroll + highlight
document.getElementById('insightsBtn')?.addEventListener('click', ()=>{
  document.getElementById('insightsGuide').scrollIntoView({ behavior: "smooth", block: "start" });
  showToast("انزل لتعليمات Insights 👇");
  track("insights_guide_open", { tool: "best_time_facebook" });
});

// Track CTA clicks
const waBtn = document.getElementById('waBtn');
if(waBtn){
  waBtn.addEventListener('click', ()=> track("whatsapp_click", { tool: "best_time_facebook" }));
}
document.getElementById('contactBtn')?.addEventListener('click', ()=> track("contact_click", { tool: "best_time_facebook" }));

// Hide lead form if not configured
(function(){
  const f = document.getElementById('leadForm');
  if(!f) return;
  const action = (f.getAttribute('action') || "");
  const isReplace = action.includes("REPLACE_ID");
  if(isReplace){
    f.style.display = "none";
    document.getElementById('leadFormHiddenNote').style.display = "block";
  } else {
    f.addEventListener("submit", ()=> track("pdf_submit", { tool: "best_time_facebook" }));
  }
})();

