(() => {
  "use strict";

  const AI_ENDPOINT = "https://marketapro-content-ai.rab2323s.workers.dev";

  const $ = (id) => document.getElementById(id);

  const els = {
    form: $("ideaForm"),
    loader: $("loader"),
    loaderTitle: $("loaderTitle"),
    loaderText: $("loaderText"),
    debugBox: $("debugBox"),
    generateBtn: $("generateBtn"),
    fillExampleBtn: $("fillExampleBtn"),
    results: $("results"),
    modeBadge: $("modeBadge"),
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
    toast: $("toast"),
    step1: $("step1"),
    step2: $("step2"),
    step3: $("step3")
  };

  const state = {
    lastRequest: null,
    lastResult: null,
    previousTitles: [],
    loadingTimer: null
  };

  const EXAMPLES = {
    restaurant: {
      accountType: "business",
      brand: "Shawarma House",
      niche: "مطعم شاورما في الرياض",
      audience: "شباب وعائلات في الرياض يحبون الشاورما والوجبات السريعة ويبحثون عن مطعم موثوق",
      offer: "شاورما دجاج ولحم، وجبات عائلية، بطاطا وصوصات، توصيل داخل الرياض",
      goal: "engagement",
      tone: "friendly",
      language: "اللهجة السعودية",
      creativity: "balanced",
      notes: "أريد أفكار تصوير حقيقية داخل المطعم وبدون ادعاءات أو عروض غير موجودة."
    },
    ecommerce: {
      accountType: "business",
      brand: "Luma Store",
      niche: "متجر إلكتروني للعطور",
      audience: "نساء ورجال في السعودية يهتمون بالعطور ويريدون اختيار الرائحة المناسبة قبل الشراء",
      offer: "عطور شرقية وغربية بأحجام مختلفة",
      goal: "sales",
      tone: "professional",
      language: "اللهجة السعودية",
      creativity: "creative",
      notes: "ركز على المقارنات، اختيار العطر والمحتوى البصري."
    },
    realestate: {
      accountType: "business",
      brand: "Riyadh Homes",
      niche: "تسويق عقارات وشقق في الرياض",
      audience: "أشخاص يبحثون عن شقق للسكن أو الاستثمار داخل الرياض",
      offer: "عرض شقق ومشاريع عقارية ومساعدة العملاء على المقارنة بين الخيارات",
      goal: "leads",
      tone: "professional",
      language: "العربية الفصحى المبسطة",
      creativity: "balanced",
      notes: "لا تخترع أسعارًا أو عوائد استثمارية."
    },
    creator: {
      accountType: "creator",
      brand: "",
      niche: "صانع محتوى عن التسويق الرقمي",
      audience: "أصحاب المشاريع الصغيرة وصناع المحتوى العرب",
      offer: "محتوى تعليمي مجاني عن التسويق وصناعة المحتوى",
      goal: "followers",
      tone: "educational",
      language: "العربية الفصحى المبسطة",
      creativity: "creative",
      notes: "أريد أفكارًا لا تحتاج معدات تصوير معقدة."
    }
  };

  const labels = {
    goal: {
      engagement: "زيادة التفاعل",
      followers: "زيادة المتابعين والوصول",
      sales: "زيادة المبيعات / الحجوزات",
      trust: "بناء الثقة والخبرة",
      leads: "رسائل واستفسارات"
    }
  };

  function clean(value, max = 500) {
    return String(value || "").trim().slice(0, max);
  }

  function getPayload() {
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
    if (data.niche.length < 3) return "اكتب مجالًا أو نشاطًا أوضح.";
    if (data.audience.length < 5) return "اكتب وصفًا مختصرًا للجمهور المستهدف.";
    if (data.offer.length < 5) return "اكتب ماذا تقدم أو تبيع.";
    return "";
  }

  function setStep(num) {
    [els.step1, els.step2, els.step3].forEach((el, index) => {
      el.classList.toggle("on", index + 1 === num);
    });
  }

  function showDebug(message) {
    els.debugBox.textContent = message;
    els.debugBox.style.display = "block";
  }

  function hideDebug() {
    els.debugBox.textContent = "";
    els.debugBox.style.display = "none";
  }

  function toast(message) {
    els.toast.textContent = message;
    els.toast.style.display = "block";
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      els.toast.style.display = "none";
    }, 1800);
  }

  function startLoading() {
    const steps = [
      ["جارٍ تحليل نشاطك…", "نفهم المجال والجمهور والهدف قبل اقتراح المحتوى."],
      ["جارٍ اختيار زوايا المحتوى…", "ننوّع بين محتوى بصري وتعليمي وتفاعلي وبيعي."],
      ["جارٍ تجهيز أفكار البوستات والريلز والستوري…", "نحاول تجنب الأفكار العامة والتكرار."],
      ["جارٍ بناء خطة 7 أيام…", "باقي اللمسات الأخيرة."]
    ];

    let i = 0;
    els.loader.style.display = "flex";
    els.loader.setAttribute("aria-busy", "true");
    els.generateBtn.disabled = true;
    els.regenerateBtn.disabled = true;
    setStep(2);

    const paint = () => {
      els.loaderTitle.textContent = steps[i][0];
      els.loaderText.textContent = steps[i][1];
      i = (i + 1) % steps.length;
    };

    paint();
    clearInterval(state.loadingTimer);
    state.loadingTimer = setInterval(paint, 2600);
  }

  function stopLoading() {
    clearInterval(state.loadingTimer);
    els.loader.style.display = "none";
    els.loader.setAttribute("aria-busy", "false");
    els.generateBtn.disabled = false;
    els.regenerateBtn.disabled = false;
  }

  async function callWorker(payload, timeoutMs = 85000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

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

      let data;
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

      return data;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function fetchPlan(payload) {
    return normalizeResult(await callWorker({ action: "plan", ...payload }, 85000));
  }

  async function fetchIdeaDetails(item) {
    if (!state.lastRequest) throw new Error("Missing context");

    const data = await callWorker({
      action: "expand",
      context: state.lastRequest,
      idea: {
        typeLabel: item.typeLabel,
        title: item.title,
        angle: item.angle,
        hook: item.hook,
        why: item.why
      }
    }, 45000);

    return {
      script: clean(data.script, 1800),
      caption: clean(data.caption, 1800),
      cta: clean(data.cta, 320),
      executionTip: clean(data.executionTip, 700)
    };
  }

  function normalizeIdea(item, typeLabel) {
    return {
      typeLabel,
      title: clean(item?.title, 180),
      angle: clean(item?.angle, 120),
      hook: clean(item?.hook, 320),
      why: clean(item?.why, 600),
      script: clean(item?.script, 1800),
      caption: clean(item?.caption, 1800),
      cta: clean(item?.cta, 320),
      executionTip: clean(item?.executionTip, 700),
      detailsLoaded: Boolean(item?.script || item?.caption || item?.cta)
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
      posts: Array.isArray(data.posts) ? data.posts.slice(0, 6).map((x) => normalizeIdea(x, "بوست")) : [],
      reels: Array.isArray(data.reels) ? data.reels.slice(0, 6).map((x) => normalizeIdea(x, "ريلز")) : [],
      stories: Array.isArray(data.stories) ? data.stories.slice(0, 6).map((x) => normalizeIdea(x, "ستوري")) : []
    };
  }

  function fallbackGenerate(data) {
    const niche = data.niche;
    const audience = data.audience;
    const brand = data.brand || "حسابك";
    const goal = labels.goal[data.goal] || data.goal;

    const postAngles = [
      ["دليل اختيار", `كيف يختار ${audience} الخيار الأنسب من منتجاتك أو خدماتك؟`],
      ["أسئلة العملاء", `أسئلة حقيقية يمكن لجمهور ${niche} أن يسألها قبل اتخاذ القرار`],
      ["كواليس", `من التحضير إلى التسليم: كواليس يوم عمل في ${brand}`],
      ["مقارنة", `قارن بين خيارين حقيقيين تقدمهما وحدد لمن يناسب كل خيار`],
      ["قيمة", `3 تفاصيل صغيرة تفرق في تجربة العميل مع ${niche}`],
      ["تفاعل", `دع الجمهور يختار الموضوع أو المنتج الذي يريد رؤيته لاحقًا`]
    ];

    const reelAngles = [
      ["عرض بصري", `اعرض ${data.offer} بلقطات قصيرة بدل الشرح الطويل`],
      ["كواليس", `30 ثانية من التحضير أو التنفيذ قبل وصول المنتج أو الخدمة للعميل`],
      ["FAQ", `جاوب بصريًا على سؤال يتكرر من ${audience}`],
      ["مقارنة", `خيار A أم B؟ وضّح الفرق بصريًا في أقل من 30 ثانية`],
      ["تعليمي", `معلومة مفيدة واحدة عن ${niche} مع مثال حقيقي من نشاطك`],
      ["تفاعل", `اطلب من الجمهور اختيار المنتج أو الموضوع القادم`]
    ];

    const storyAngles = [
      ["تصويت", `أي خيار من منتجاتك أو خدماتك يفضله جمهورك؟`],
      ["سؤال", `ما أهم شيء يبحث عنه ${audience} عند اختيار ${niche}؟`],
      ["كواليس", `شارك لقطة حقيقية من التحضير أو العمل اليومي`],
      ["اختيار", `اختر بين خيارين حقيقيين من منتجاتك أو خدماتك`],
      ["FAQ", `جاوب على سؤال واحد شائع في ستوري قصيرة`],
      ["تمهيد", `اسأل المتابعين عن الموضوع الذي يريدونه في المنشور القادم`]
    ];

    const make = (pair, type) => ({
      typeLabel: type,
      title: pair[1],
      angle: pair[0],
      hook: `قبل ما تقرر، شوف هذه النقطة عن ${niche}.`,
      why: `زاوية مرتبطة بهدفك (${goal}) ويمكن تخصيصها بتفاصيل حقيقية من نشاطك.`,
      script: "",
      caption: "",
      cta: "",
      executionTip: "",
      detailsLoaded: false
    });

    return normalizeResult({
      mode: "fallback",
      summary: `تم إنشاء خطة احتياطية لـ ${brand} في مجال ${niche}.`,
      globalHook: `إذا كان ${niche} يهمك، هذه التفاصيل قد تساعدك على الاختيار بشكل أوضح.`,
      globalCTA: data.goal === "sales" ? "راسلنا لمعرفة الخيار الأنسب لك." : "احفظ المحتوى وشاركنا رأيك.",
      strategyNote: "وازن بين عرض ما تقدمه، التعليم، الكواليس والتفاعل بدل تكرار نوع محتوى واحد.",
      strategy: [
        { day:"اليوم 1", format:"بوست", idea:postAngles[0][1], objective:"قيمة وثقة" },
        { day:"اليوم 2", format:"ريلز", idea:reelAngles[0][1], objective:"عرض بصري" },
        { day:"اليوم 3", format:"ستوري", idea:storyAngles[0][1], objective:"تفاعل" },
        { day:"اليوم 4", format:"بوست", idea:postAngles[1][1], objective:"إزالة اعتراضات" },
        { day:"اليوم 5", format:"ريلز", idea:reelAngles[1][1], objective:"كواليس وثقة" },
        { day:"اليوم 6", format:"ستوري", idea:storyAngles[2][1], objective:"قرب من الجمهور" },
        { day:"اليوم 7", format:"ريلز", idea:reelAngles[5][1], objective:"تفاعل وتحويل" }
      ],
      posts: postAngles.map((x) => make(x, "بوست")),
      reels: reelAngles.map((x) => make(x, "ريلز")),
      stories: storyAngles.map((x) => make(x, "ستوري"))
    });
  }

  function fallbackDetails(item, data) {
    return {
      script: item.typeLabel === "ريلز"
        ? "ابدأ بلقطة قوية مرتبطة بالفكرة، ثم اعرض المنتج أو الخدمة بصريًا، وضّح نقطة أو نقطتين باستخدام معلومات حقيقية من نشاطك، وأنهِ بلقطة نهائية وCTA واحد."
        : item.typeLabel === "ستوري"
        ? "ستوري 1: افتح بالسؤال أو الفكرة. ستوري 2: اعرض مثالًا حقيقيًا. ستوري 3: أضف تصويتًا أو صندوق سؤال. ستوري 4: اختم بخطوة واحدة واضحة."
        : "كاروسيل: 1) غلاف واضح. 2) المشكلة أو السؤال. 3-5) نقاط عملية من واقع نشاطك. 6) مثال حقيقي أو صورة من المنتج. 7) CTA واحد.",
      caption: `استخدم هذه الفكرة مع تفاصيل حقيقية من ${data.brand || "نشاطك"} حول ${data.offer}. راجع أي أسعار أو عروض أو أرقام قبل النشر.`,
      cta: data.goal === "sales" ? "راسلنا لمعرفة التفاصيل المناسبة لك." : "احفظ الفكرة وشاركنا رأيك.",
      executionTip: "استخدم صورًا أو فيديوهات حقيقية من نشاطك بدل الصور العامة متى أمكن."
    };
  }

  async function generate(payload, { regenerate = false } = {}) {
    hideDebug();
    startLoading();

    try {
      const result = await fetchPlan(payload);
      state.lastResult = result;
      state.lastRequest = payload;
      state.previousTitles = collectTitles(result);
      render(result);
      toast(regenerate ? "تم توليد أفكار جديدة" : "تم توليد الأفكار بالذكاء الاصطناعي");
    } catch (error) {
      console.error(error);

      const fallback = fallbackGenerate(payload);
      state.lastResult = fallback;
      state.lastRequest = payload;
      state.previousTitles = collectTitles(fallback);
      render(fallback);

      const message = error?.name === "AbortError"
        ? "تأخر اتصال الذكاء الاصطناعي، لذلك تم استخدام المولد الاحتياطي."
        : "تعذر الاتصال بالذكاء الاصطناعي، لذلك تم استخدام المولد الاحتياطي.";

      showDebug(message);
      toast("تم استخدام المولد الاحتياطي");
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
    els.results.style.display = "block";

    els.modeBadge.textContent = result.mode === "fallback" ? "FALLBACK" : "AI";
    els.modeBadge.classList.toggle("fallback", result.mode === "fallback");

    setText(els.resultSummary, result.summary);
    setText(els.globalHook, result.globalHook);
    setText(els.globalCTA, result.globalCTA);
    setText(els.strategyNote, result.strategyNote);

    renderStrategy(result.strategy);
    renderIdeas(els.postsGrid, result.posts);
    renderIdeas(els.reelsGrid, result.reels);
    renderIdeas(els.storiesGrid, result.stories);

    els.postsCount.textContent = result.posts.length;
    els.reelsCount.textContent = result.reels.length;
    els.storiesCount.textContent = result.stories.length;

    setStep(3);

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

      const title = document.createElement("h3");
      title.textContent = item.title;

      const hook = document.createElement("p");
      hook.className = "idea-hook";
      hook.textContent = item.hook;

      main.append(meta, title, hook);

      const actions = document.createElement("div");
      actions.className = "idea-actions";

      const expandBtn = document.createElement("button");
      expandBtn.type = "button";
      expandBtn.textContent = item.detailsLoaded ? "عرض التفاصيل" : "✨ طوّر الفكرة بالـAI";

      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.textContent = "نسخ الفكرة";

      actions.append(expandBtn, copyBtn);

      const details = document.createElement("div");
      details.className = "idea-details";
      details.hidden = true;

      const paintDetails = () => {
        details.replaceChildren(
          detail("السكريبت", item.script),
          detail("Caption", item.caption),
          detail("CTA", item.cta),
          detail("نصيحة تنفيذ", item.executionTip),
          detail("لماذا تناسب هذه الفكرة؟", item.why)
        );
      };

      if (item.detailsLoaded) paintDetails();

      expandBtn.addEventListener("click", async () => {
        if (!details.hidden) {
          details.hidden = true;
          expandBtn.textContent = item.detailsLoaded ? "عرض التفاصيل" : "✨ طوّر الفكرة بالـAI";
          return;
        }

        if (!item.detailsLoaded) {
          expandBtn.disabled = true;
          expandBtn.textContent = "جارٍ تطوير الفكرة…";

          try {
            Object.assign(item, await fetchIdeaDetails(item), { detailsLoaded: true });
            toast("تم تطوير الفكرة");
          } catch (error) {
            console.error(error);
            Object.assign(item, fallbackDetails(item, state.lastRequest), { detailsLoaded: true });
            toast("تم استخدام تفاصيل احتياطية");
          } finally {
            expandBtn.disabled = false;
          }

          paintDetails();
        }

        details.hidden = false;
        expandBtn.textContent = "إخفاء التفاصيل";
      });

      copyBtn.addEventListener("click", () => copyText(formatIdea(item)));

      card.append(main, actions, details);
      container.appendChild(card);
    });
  }

  function detail(label, value) {
    const wrap = document.createElement("div");
    wrap.className = "detail";

    const strong = document.createElement("strong");
    strong.textContent = label;

    const p = document.createElement("p");
    p.textContent = value || "لم يتم توليد هذه التفاصيل بعد.";

    wrap.append(strong, p);
    return wrap;
  }

  function formatIdea(item) {
    return [
      `${item.typeLabel}: ${item.title}`,
      item.angle ? `الزاوية: ${item.angle}` : "",
      `Hook: ${item.hook}`,
      item.script ? `السكريبت: ${item.script}` : "",
      item.caption ? `Caption: ${item.caption}` : "",
      item.cta ? `CTA: ${item.cta}` : "",
      item.executionTip ? `نصيحة تنفيذ: ${item.executionTip}` : "",
      item.why ? `لماذا تناسب الفكرة: ${item.why}` : ""
    ].filter(Boolean).join("\n");
  }

  function formatAll(result) {
    const strategy = result.strategy
      .map((x) => `${x.day} — ${x.format}: ${x.idea}${x.objective ? ` | الهدف: ${x.objective}` : ""}`)
      .join("\n");

    const section = (title, items) =>
      `${title}\n\n${items.map((x, i) => `${i + 1}. ${formatIdea(x)}`).join("\n\n")}`;

    return [
      "MarketAPro — مولد محتوى انستقرام بالذكاء الاصطناعي",
      "",
      `الملخص: ${result.summary}`,
      `Hook عام: ${result.globalHook}`,
      `CTA عام: ${result.globalCTA}`,
      `الاستراتيجية: ${result.strategyNote}`,
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

  function activateTab(name) {
    document.querySelectorAll(".tab").forEach((tab) => {
      tab.classList.toggle("on", tab.dataset.tab === name);
    });

    ["posts", "reels", "stories"].forEach((key) => {
      $(`panel-${key}`).hidden = key !== name;
    });
  }

  function fillExample(example) {
    const x = EXAMPLES[example];
    if (!x) return;

    $("accountType").value = x.accountType;
    $("brand").value = x.brand;
    $("niche").value = x.niche;
    $("audience").value = x.audience;
    $("offer").value = x.offer;
    $("goal").value = x.goal;
    $("tone").value = x.tone;
    $("language").value = x.language;
    $("creativity").value = x.creativity;
    $("notes").value = x.notes;
    hideDebug();
    toast("تم تعبئة المثال");
  }

  document.querySelectorAll("[data-example]").forEach((button) => {
    button.addEventListener("click", () => fillExample(button.dataset.example));
  });

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => activateTab(tab.dataset.tab));
  });

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-copy-target]");
    if (!button) return;
    const target = $(button.dataset.copyTarget);
    if (target) copyText(target.textContent);
  });

  els.form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = getPayload();
    const error = validate(payload);

    if (error) {
      showDebug(error);
      return;
    }

    await generate(payload);
  });

  els.regenerateBtn.addEventListener("click", async () => {
    if (!state.lastRequest) return;

    await generate({
      ...state.lastRequest,
      avoidTitles: state.previousTitles.slice(-24)
    }, { regenerate: true });
  });

  els.copyAllBtn.addEventListener("click", () => {
    if (state.lastResult) copyText(formatAll(state.lastResult));
  });

  els.fillExampleBtn.addEventListener("click", () => fillExample("restaurant"));

  els.form.addEventListener("reset", () => {
    setTimeout(() => {
      hideDebug();
      els.results.style.display = "none";
      state.lastRequest = null;
      state.lastResult = null;
      state.previousTitles = [];
      activateTab("posts");
      setStep(1);
    }, 0);
  });
})();
