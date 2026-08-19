(() => {
  "use strict";

  // غيّر هذا الرابط فقط إذا تغيّر اسم الـ Worker.
  const AI_ENDPOINT = "https://marketapro-content-ai.rab2323s.workers.dev";

  const $ = (id) => document.getElementById(id);

  const els = {
    form: $("ideaForm"),
    generateBtn: $("generateBtn"),
    exampleBtn: $("exampleBtn"),
    resetBtn: $("resetBtn"),
    formError: $("formError"),
    loadingPanel: $("loadingPanel"),
    loadingTitle: $("loadingTitle"),
    loadingText: $("loadingText"),
    results: $("results"),
    resultMode: $("resultMode"),
    resultSummary: $("resultSummary"),
    globalHook: $("globalHook"),
    globalCTA: $("globalCTA"),
    strategyNote: $("strategyNote"),
    strategyList: $("strategyList"),
    postsGrid: $("postsGrid"),
    reelsGrid: $("reelsGrid"),
    storiesGrid: $("storiesGrid"),
    postsCount: $("postsCount"),
    reelsCount: $("reelsCount"),
    storiesCount: $("storiesCount"),
    regenerateBtn: $("regenerateBtn"),
    copyAllBtn: $("copyAllBtn"),
    downloadBtn: $("downloadBtn"),
    toast: $("toast")
  };

  const state = {
    lastRequest: null,
    lastResult: null,
    previousTitles: [],
    loadingTimer: null
  };

  const labels = {
    accountType: {
      business: "تجاري / شركة / متجر",
      creator: "صانع محتوى / مؤثر",
      personal: "شخصي / لايف ستايل",
      model: "موديلز / فاشن / تصوير"
    },
    goal: {
      engagement: "زيادة التفاعل",
      followers: "زيادة المتابعين والوصول",
      sales: "زيادة المبيعات / الحجوزات",
      trust: "بناء الثقة والخبرة",
      leads: "رسائل واستفسارات"
    },
    tone: {
      friendly: "ودّي وبسيط",
      professional: "احترافي وواثق",
      bold: "جريء وترندي",
      educational: "تعليمي ومباشر",
      emotional: "عاطفي وملهم"
    },
    creativity: {
      balanced: "متوازن",
      safe: "عملي ومحافظ",
      creative: "إبداعي",
      experimental: "جريء وتجريبي"
    }
  };

  function clean(value, max = 500) {
    return String(value || "").trim().slice(0, max);
  }

  function formData() {
    return {
      accountType: clean($("accountType").value, 40),
      brand: clean($("brand").value, 80),
      niche: clean($("niche").value, 140),
      audience: clean($("audience").value, 420),
      offer: clean($("offer").value, 420),
      goal: clean($("goal").value, 40),
      tone: clean($("tone").value, 40),
      language: clean($("language").value, 80),
      creativity: clean($("creativity").value, 40),
      notes: clean($("notes").value, 500),
      avoidTitles: state.previousTitles.slice(-24)
    };
  }

  function validate(data) {
    const errors = [];
    if (data.niche.length < 3) errors.push("اكتب مجالًا أو نشاطًا أوضح.");
    if (data.audience.length < 5) errors.push("اكتب وصفًا مختصرًا للجمهور المستهدف.");
    if (data.offer.length < 5) errors.push("اكتب ما الذي تبيعه أو تقدمه.");
    return errors;
  }

  function showError(message) {
    els.formError.textContent = message;
    els.formError.hidden = false;
  }

  function clearError() {
    els.formError.textContent = "";
    els.formError.hidden = true;
  }

  function toast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("is-showing");
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => els.toast.classList.remove("is-showing"), 1800);
  }

  function startLoading() {
    const steps = [
      ["جاري تحليل نشاطك...", "نحوّل المجال والجمهور والهدف إلى استراتيجية محتوى واضحة."],
      ["جاري بناء زوايا المحتوى...", "ننوّع بين محتوى تعليمي وتفاعلي وقصصي وبيعي."],
      ["جاري كتابة Hooks والسكريبتات...", "نرتب كل فكرة لتكون أسهل في التنفيذ."],
      ["جاري تجهيز خطة 7 أيام...", "باقي اللمسات الأخيرة على النتائج."]
    ];
    let i = 0;

    els.loadingPanel.hidden = false;
    els.generateBtn.disabled = true;
    els.regenerateBtn.disabled = true;

    const paint = () => {
      els.loadingTitle.textContent = steps[i][0];
      els.loadingText.textContent = steps[i][1];
      i = (i + 1) % steps.length;
    };

    paint();
    clearInterval(state.loadingTimer);
    state.loadingTimer = setInterval(paint, 3200);
  }

  function stopLoading() {
    clearInterval(state.loadingTimer);
    els.loadingPanel.hidden = true;
    els.generateBtn.disabled = false;
    els.regenerateBtn.disabled = false;
  }

  async function fetchAI(payload) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 65000);

    try {
      const response = await fetch(AI_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      let data = null;
      try {
        data = await response.json();
      } catch {
        throw new Error("الخادم أعاد استجابة غير صالحة.");
      }

      if (!response.ok || !data?.success) {
        const error = new Error(data?.message || data?.error || "تعذر توليد المحتوى.");
        error.status = response.status;
        throw error;
      }

      return normalizeResult(data);
    } finally {
      clearTimeout(timeout);
    }
  }

  function normalizeIdea(item, typeLabel) {
    return {
      typeLabel,
      title: clean(item?.title, 180),
      angle: clean(item?.angle, 120),
      hook: clean(item?.hook, 300),
      script: clean(item?.script, 1600),
      caption: clean(item?.caption, 1600),
      cta: clean(item?.cta, 300),
      why: clean(item?.why, 600)
    };
  }

  function normalizeResult(data) {
    return {
      mode: data.mode === "fallback" ? "fallback" : "ai",
      summary: clean(data.summary, 500),
      globalHook: clean(data.globalHook, 400),
      globalCTA: clean(data.globalCTA, 400),
      strategyNote: clean(data.strategyNote, 500),
      strategy: Array.isArray(data.strategy)
        ? data.strategy.slice(0, 7).map((x, index) => ({
            day: clean(x?.day, 40) || `اليوم ${index + 1}`,
            format: clean(x?.format, 80),
            idea: clean(x?.idea, 240),
            objective: clean(x?.objective, 160)
          }))
        : [],
      posts: Array.isArray(data.posts)
        ? data.posts.slice(0, 6).map((x) => normalizeIdea(x, "بوست"))
        : [],
      reels: Array.isArray(data.reels)
        ? data.reels.slice(0, 6).map((x) => normalizeIdea(x, "ريلز"))
        : [],
      stories: Array.isArray(data.stories)
        ? data.stories.slice(0, 6).map((x) => normalizeIdea(x, "ستوري"))
        : []
    };
  }

  function fallbackGenerate(data) {
    const niche = data.niche;
    const audience = data.audience;
    const brand = data.brand || "حسابك";
    const goal = labels.goal[data.goal] || data.goal;

    const postAngles = [
      ["قائمة عملية", `7 نقاط يحتاج ${audience} معرفتها عن ${niche}`],
      ["أخطاء شائعة", `5 أخطاء شائعة في ${niche} وكيف تتجنبها`],
      ["مقارنة", `قبل أن تختار: قارن بين خيارين شائعين في ${niche}`],
      ["خطوات", `من الصفر: خطوات بسيطة للبدء مع ${niche}`],
      ["أسئلة العملاء", `أكثر 6 أسئلة يسألها جمهور ${niche}`],
      ["خلف الكواليس", `كيف نجهّز الخدمة أو المنتج خطوة بخطوة في ${brand}`]
    ];

    const reelAngles = [
      ["تعليمي سريع", `3 أشياء عن ${niche} في أقل من 30 ثانية`],
      ["قبل / بعد", `قبل وبعد تطبيق تعديل بسيط مرتبط بـ ${niche}`],
      ["خطأ وحل", `خطأ واحد يضيّع النتيجة — والحل في 20 ثانية`],
      ["رأي مهني", `معلومة منتشرة عن ${niche}: متى تكون صحيحة ومتى لا؟`],
      ["شرح عملي", `كيف تستخدم ${data.offer} بطريقة أوضح وأسهل`],
      ["FAQ", `جواب سريع على سؤال يكرره ${audience}`]
    ];

    const storyAngles = [
      ["تصويت", `أي جانب من ${niche} تريد أن نشرحه أولًا؟`],
      ["سؤال", `ما أكبر تحدٍ لديك حاليًا مع ${niche}؟`],
      ["اختيار", `اختر بين خيار A وB حسب احتياجك`],
      ["كواليس", `لقطة من طريقة العمل أو التجهيز اليومي`],
      ["اختبار", `سؤال صح أو خطأ مرتبط بـ ${niche}`],
      ["تمهيد", `اسأل الجمهور ماذا يريد في المنشور القادم`]
    ];

    const make = (pair, type) => ({
      typeLabel: type,
      title: pair[1],
      angle: pair[0],
      hook: `إذا كان ${niche} يهمك، هذه الفكرة تستحق دقيقة.`,
      script: `ابدأ بسؤال أو مشكلة واضحة، ثم قدّم 3 نقاط عملية مرتبطة بـ ${data.offer}. استخدم مثالًا حقيقيًا من نشاطك، وأنهِ بخطوة واحدة يستطيع المتابع تنفيذها.`,
      caption: `محتوى عملي عن ${niche} مخصص لمن يهتم بـ ${data.offer}. عدّل المثال والتفاصيل لتطابق تجربتك وعرضك الحقيقي قبل النشر.`,
      cta: data.goal === "sales" ? "راسلنا لمعرفة التفاصيل المناسبة لك." : "احفظ الفكرة وشارك رأيك في التعليقات.",
      why: `الزاوية مرتبطة مباشرة بهدفك (${goal}) وتسمح بتقديم قيمة واضحة دون الحاجة إلى ادعاءات غير موثقة.`
    });

    return normalizeResult({
      mode: "fallback",
      summary: `تم إنشاء خطة احتياطية لـ ${brand} في مجال ${niche}.`,
      globalHook: `مهتم بـ ${niche}؟ ابدأ بهذه الخطوة قبل أي شيء.`,
      globalCTA: data.goal === "sales" ? "تواصل معنا لمعرفة الخيار المناسب لك." : "احفظ المحتوى وشاركه مع شخص قد يستفيد.",
      strategyNote: "وازن خلال الأسبوع بين القيمة، التفاعل، الإثبات الحقيقي والبيع الناعم.",
      strategy: [
        { day:"اليوم 1", format:"بوست", idea:postAngles[0][1], objective:"قيمة وحفظ" },
        { day:"اليوم 2", format:"ريلز", idea:reelAngles[0][1], objective:"وصول" },
        { day:"اليوم 3", format:"ستوري", idea:storyAngles[0][1], objective:"تفاعل" },
        { day:"اليوم 4", format:"بوست", idea:postAngles[1][1], objective:"ثقة" },
        { day:"اليوم 5", format:"ريلز", idea:reelAngles[2][1], objective:"تعليم" },
        { day:"اليوم 6", format:"ستوري", idea:storyAngles[3][1], objective:"قرب من الجمهور" },
        { day:"اليوم 7", format:"ريلز", idea:reelAngles[4][1], objective:"تحويل" }
      ],
      posts: postAngles.map((x) => make(x, "بوست")),
      reels: reelAngles.map((x) => make(x, "ريلز")),
      stories: storyAngles.map((x) => make(x, "ستوري"))
    });
  }

  async function generate(payload, { isRegenerate = false } = {}) {
    clearError();
    startLoading();

    try {
      const result = await fetchAI(payload);
      state.lastResult = result;
      state.lastRequest = payload;
      state.previousTitles = collectTitles(result);
      render(result);
      toast(isRegenerate ? "تم توليد مجموعة جديدة" : "تم توليد الخطة بالذكاء الاصطناعي");
    } catch (error) {
      console.error("AI generation failed:", error);

      const fallback = fallbackGenerate(payload);
      state.lastResult = fallback;
      state.lastRequest = payload;
      state.previousTitles = collectTitles(fallback);
      render(fallback);

      if (error?.name === "AbortError") {
        toast("تأخر الاتصال — تم استخدام المولد الاحتياطي");
      } else {
        toast("تعذر الاتصال بالـAI — تم استخدام المولد الاحتياطي");
      }
    } finally {
      stopLoading();
    }
  }

  function collectTitles(result) {
    return [...result.posts, ...result.reels, ...result.stories]
      .map((x) => x.title)
      .filter(Boolean)
      .slice(0, 24);
  }

  function setText(el, text) {
    el.textContent = text || "—";
  }

  function render(result) {
    els.results.hidden = false;
    els.resultMode.textContent = result.mode === "fallback" ? "FALLBACK" : "AI";
    els.resultMode.style.borderColor = result.mode === "fallback"
      ? "rgba(255,204,102,.28)"
      : "";
    els.resultMode.style.background = result.mode === "fallback"
      ? "rgba(255,204,102,.10)"
      : "";
    els.resultMode.style.color = result.mode === "fallback"
      ? "#ffe09b"
      : "";

    setText(els.resultSummary, result.summary);
    setText(els.globalHook, result.globalHook);
    setText(els.globalCTA, result.globalCTA);
    setText(els.strategyNote, result.strategyNote);

    renderStrategy(result.strategy);
    renderIdeas(els.postsGrid, result.posts);
    renderIdeas(els.reelsGrid, result.reels);
    renderIdeas(els.storiesGrid, result.stories);

    els.postsCount.textContent = String(result.posts.length);
    els.reelsCount.textContent = String(result.reels.length);
    els.storiesCount.textContent = String(result.stories.length);

    requestAnimationFrame(() => {
      els.results.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function renderStrategy(items) {
    els.strategyList.replaceChildren();

    items.forEach((item) => {
      const card = document.createElement("article");
      card.className = "day-card";

      const day = document.createElement("strong");
      day.textContent = item.day;

      const format = document.createElement("b");
      format.textContent = item.format;

      const idea = document.createElement("p");
      idea.textContent = item.idea;

      const objective = document.createElement("p");
      objective.textContent = item.objective ? `الهدف: ${item.objective}` : "";

      card.append(day, format, idea, objective);
      els.strategyList.appendChild(card);
    });
  }

  function renderIdeas(container, items) {
    container.replaceChildren();

    items.forEach((item, index) => {
      const card = document.createElement("article");
      card.className = "idea-card";

      const main = document.createElement("div");
      main.className = "idea-main";

      const meta = document.createElement("div");
      meta.className = "idea-meta";

      const type = document.createElement("span");
      type.className = "idea-type";
      type.textContent = item.typeLabel;

      const angle = document.createElement("span");
      angle.className = "idea-angle";
      angle.textContent = item.angle || `فكرة ${index + 1}`;

      meta.append(type, angle);

      const title = document.createElement("h4");
      title.textContent = item.title;

      const hook = document.createElement("p");
      hook.className = "idea-hook";
      hook.textContent = item.hook;

      main.append(meta, title, hook);

      const actions = document.createElement("div");
      actions.className = "idea-actions";

      const detailsBtn = document.createElement("button");
      detailsBtn.type = "button";
      detailsBtn.textContent = "عرض التفاصيل";
      detailsBtn.setAttribute("aria-expanded", "false");

      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.textContent = "نسخ الفكرة";

      actions.append(detailsBtn, copyBtn);

      const details = document.createElement("div");
      details.className = "idea-details";
      details.hidden = true;

      details.append(
        detailBlock("السكريبت", item.script),
        detailBlock("Caption", item.caption),
        detailBlock("CTA", item.cta),
        detailBlock("لماذا قد تنجح؟", item.why, "why-block")
      );

      detailsBtn.addEventListener("click", () => {
        const open = !details.hidden;
        details.hidden = open;
        detailsBtn.textContent = open ? "عرض التفاصيل" : "إخفاء التفاصيل";
        detailsBtn.setAttribute("aria-expanded", String(!open));
      });

      copyBtn.addEventListener("click", () => {
        copyText(formatIdea(item));
      });

      card.append(main, actions, details);
      container.appendChild(card);
    });
  }

  function detailBlock(label, value, extraClass = "") {
    const block = document.createElement("div");
    block.className = `detail-block ${extraClass}`.trim();

    const strong = document.createElement("strong");
    strong.textContent = label;

    const p = document.createElement("p");
    p.textContent = value || "—";

    block.append(strong, p);
    return block;
  }

  function formatIdea(item) {
    return [
      `${item.typeLabel}: ${item.title}`,
      item.angle ? `الزاوية: ${item.angle}` : "",
      `Hook: ${item.hook}`,
      `السكريبت: ${item.script}`,
      `Caption: ${item.caption}`,
      `CTA: ${item.cta}`,
      item.why ? `لماذا قد تنجح: ${item.why}` : ""
    ].filter(Boolean).join("\n");
  }

  function formatAll(result) {
    const strategy = result.strategy
      .map((x) => `${x.day} — ${x.format}: ${x.idea}${x.objective ? ` | الهدف: ${x.objective}` : ""}`)
      .join("\n");

    const section = (title, items) =>
      `${title}\n\n${items.map((x, i) => `${i + 1}. ${formatIdea(x)}`).join("\n\n")}`;

    return [
      "MarketAPro — خطة محتوى إنستغرام",
      "",
      `الملخص: ${result.summary}`,
      `Hook عام: ${result.globalHook}`,
      `CTA عام: ${result.globalCTA}`,
      `استراتيجية: ${result.strategyNote}`,
      "",
      "خطة 7 أيام",
      strategy,
      "",
      section("أفكار البوستات", result.posts),
      "",
      section("أفكار الريلز", result.reels),
      "",
      section("أفكار الستوري", result.stories)
    ].join("\n");
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast("تم النسخ");
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
      toast("تم النسخ");
    }
  }

  function downloadText(result) {
    const blob = new Blob([formatAll(result)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `marketapro-instagram-content-${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function activateTab(name) {
    document.querySelectorAll(".tab").forEach((tab) => {
      const active = tab.dataset.tab === name;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
    });

    ["posts", "reels", "stories"].forEach((key) => {
      const panel = $(`panel-${key}`);
      panel.hidden = key !== name;
    });
  }

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => activateTab(tab.dataset.tab));
  });

  document.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-copy-target]");
    if (!btn) return;
    const target = $(btn.dataset.copyTarget);
    if (target) copyText(target.textContent);
  });

  els.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = formData();
    const errors = validate(data);

    if (errors.length) {
      showError(errors[0]);
      return;
    }

    await generate(data);
  });

  els.regenerateBtn.addEventListener("click", async () => {
    if (!state.lastRequest) return;
    const payload = {
      ...state.lastRequest,
      avoidTitles: state.previousTitles.slice(-24)
    };
    await generate(payload, { isRegenerate: true });
  });

  els.copyAllBtn.addEventListener("click", () => {
    if (state.lastResult) copyText(formatAll(state.lastResult));
  });

  els.downloadBtn.addEventListener("click", () => {
    if (state.lastResult) downloadText(state.lastResult);
  });

  els.exampleBtn.addEventListener("click", () => {
    $("accountType").value = "business";
    $("brand").value = "MarketAPro";
    $("niche").value = "أدوات تسويق رقمية مجانية لصناع المحتوى وأصحاب المشاريع";
    $("audience").value = "أصحاب المشاريع الصغيرة وصناع المحتوى العرب الذين يريدون تحسين نتائج إنستغرام";
    $("offer").value = "أدوات مجانية لتحليل التفاعل، توليد الأفكار وتحسين التسويق على السوشيال ميديا";
    $("goal").value = "engagement";
    $("tone").value = "professional";
    $("language").value = "العربية الفصحى المبسطة";
    $("creativity").value = "balanced";
    $("notes").value = "أريد أفكارًا سهلة التنفيذ وبدون ادعاءات أو أرقام غير موثقة.";
    clearError();
    toast("تم تعبئة مثال");
  });

  els.form.addEventListener("reset", () => {
    setTimeout(() => {
      clearError();
      els.results.hidden = true;
      state.lastRequest = null;
      state.lastResult = null;
      state.previousTitles = [];
      activateTab("posts");
    }, 0);
  });
})();
