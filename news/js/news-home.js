(() => {
  const DATA_URL = "/news/data/posts.json";
  const sectionsRoot = document.getElementById("sections");
  const qInput = document.getElementById("q");
  const chips = [...document.querySelectorAll(".chip")];
  const schemaEl = document.getElementById("itemlist-schema");

  // إعداد الأقسام (تقدر تغيّر الأسماء بسهولة)
  const CATEGORIES = [
    { key: "seo", title: "SEO: تحسين محركات البحث", desc: "خطوات عملية لرفع ترتيب موقعك وزيادة الزيارات." },
    { key: "paid-ads", title: "الإعلانات الممولة", desc: "استهداف، ميزانيات، تحسين النتائج وتقليل تكلفة الاكتساب." },
    { key: "google-ads", title: "Google Ads (AdWords)", desc: "أسرار الحملات، الكلمات المفتاحية، الجودة والتحسين." },
    { key: "web-dev", title: "تصميم وتطوير المواقع", desc: "تصميم مواقع، برمجة، سرعة، تجربة مستخدم، وتحسينات تقنية." },
    { key: "digital-marketing", title: "التسويق الإلكتروني", desc: "استراتيجية، قنوات، قياس وتحسين أداء." },
    { key: "social", title: "التسويق عبر السوشال ميديا", desc: "إنستغرام، فيسبوك، محتوى، تفاعل، ونمو." },
    { key: "site-audit", title: "تحليل المواقع وتحسين الأداء", desc: "تقييم وتحليل المواقع: سرعة، SEO تقني، ومشاكل تؤثر على النمو." },
    { key: "content", title: "كتابة المحتوى التسويقي", desc: "كتابة محتوى، عناوين، محتوى مقنع، وتسويق بالمحتوى." },
    { key: "motion", title: "موشن جرافيك", desc: "أفكار وتنفيذ موشن جرافيك يخدم التسويق." },
    { key: "product-photo", title: "تصوير المنتجات", desc: "تصوير احترافي يزيد المبيعات والثقة." },
    { key: "branding", title: "الهوية البصرية والهوية التجارية", desc: "شعار، ألوان، دليل هوية، واتساق العلامة." },

    // الاقتصاد
    { key: "gold", title: "الذهب والمعادن", desc: "توقعات الذهب، عوامل التأثير، وسيناريوهات السعر." },
    { key: "currency", title: "تحويل العملات", desc: "USD→EGP، USD→SAR… أدلة + تحويل فوري." },
    { key: "crypto", title: "العملات الرقمية", desc: "أساسيات، مخاطر، تحليل، ومفاهيم تساعدك على الفهم." },
    { key: "markets", title: "اقتصاد وأسواق", desc: "مقالات اقتصادية عامة لفهم الصورة الكبيرة." },
  ];

  const CAT_MAP = new Map(CATEGORIES.map(c => [c.key, c]));

  let allPosts = [];
  let activeFilter = "all";
  let q = "";

  const esc = (s) =>
    String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  function setActiveChip(filter) {
    const f = (filter || "all").toLowerCase();
    chips.forEach(x => (x.style.opacity = "0.85"));
    const target = chips.find(c => (c.getAttribute("data-filter") || "all").toLowerCase() === f) || chips[0];
    target.style.opacity = "1";
  }

  function normalize(str) {
    return String(str || "").toLowerCase();
  }

  function matches(post) {
    const term = q.trim().toLowerCase();
    const filter = activeFilter;

    const text = normalize(
      `${post.title} ${post.description} ${(post.tags || []).join(" ")} ${(post.badges || []).join(" ")} ${post.category}`
    );

    const qOk = !term || text.includes(term);
    const fOk = filter === "all" || String(post.category || "").toLowerCase() === filter;

    return qOk && fOk;
  }

  function groupByCategory(list) {
    const groups = new Map();
    for (const p of list) {
      const cat = String(p.category || "other").toLowerCase();
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat).push(p);
    }
    // sort posts in each category newest first
    for (const [k, arr] of groups) {
      arr.sort((a, b) => new Date(b.date) - new Date(a.date));
      groups.set(k, arr);
    }
    return groups;
  }

  function cardHTML(p) {
    const postUrl = `/news/${esc(p.slug)}/`;
    const badges = (p.badges || []).slice(0, 4).map(b => `<span class="tag">${esc(b)}</span>`).join("");
    const toolBtn = p.toolUrl
      ? `<a class="btn secondary" href="${esc(p.toolUrl)}" style="margin-inline-start:8px">جرّب الأداة</a>`
      : "";

    return `
<article class="post-card">
  <img src="${esc(p.image || "/assets/og-best-time-instagram.jpg")}" alt="${esc(p.title)}" loading="lazy" />
  <div class="post-body">
    <div class="post-meta">
      ${badges}
      ${p.reading ? `<span>${esc(p.reading)}</span>` : ""}
      ${p.date ? `<span><time datetime="${esc(p.date)}">${esc(p.date)}</time></span>` : ""}
    </div>
    <h3><a href="${postUrl}">${esc(p.title)}</a></h3>
    <p>${esc(p.description || "")}</p>
  </div>
  <div class="post-footer">
    <a class="btn primary" href="${postUrl}">اقرأ الدليل</a>
    ${toolBtn}
  </div>
</article>`;
  }

  function buildItemListSchema(list) {
    if (!schemaEl) return;
    const items = list.slice(0, 30).map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: new URL(`/news/${p.slug}/`, location.origin).toString(),
      name: p.title
    }));
    schemaEl.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement: items
    });
  }

  function render() {
    const filtered = allPosts.filter(matches);
    const grouped = groupByCategory(filtered);

    // ترتيب عرض الأقسام: حسب CATEGORIES، ثم أي أقسام أخرى
    const orderedKeys = [
      ...CATEGORIES.map(c => c.key),
      ...[...grouped.keys()].filter(k => !CAT_MAP.has(k))
    ];

    const html = [];
    const schemaCollector = [];

    for (const key of orderedKeys) {
      const posts = grouped.get(key);
      if (!posts || !posts.length) continue;

      const meta = CAT_MAP.get(key) || { title: key, desc: "" };
      const showCount = 6;
      const visible = posts.slice(0, showCount);

      schemaCollector.push(...visible);

      html.push(`
<section class="posts-group" data-cat="${esc(key)}">
  <div class="section-block">
    <div class="section-head">
      <div>
        <h2>${esc(meta.title)}</h2>
        <p class="note">${esc(meta.desc || "")}</p>
      </div>
      <div class="sub-actions">
        <a class="btn secondary" href="/news/category/${esc(key)}/">كل مقالات القسم</a>
        ${posts.length > showCount ? `<button class="btn secondary js-more" data-cat="${esc(key)}" type="button">عرض المزيد</button>` : ""}
      </div>
    </div>

    <div class="grid" id="grid-${esc(key)}">
      ${visible.map(cardHTML).join("")}
    </div>
  </div>
</section>`);
    }

    sectionsRoot.innerHTML = html.join("");

    // bind "عرض المزيد" per section (يزيد 6 كل مرة)
    [...document.querySelectorAll(".js-more")].forEach(btn => {
      btn.addEventListener("click", () => {
        const cat = btn.getAttribute("data-cat");
        const posts = grouped.get(cat) || [];
        const grid = document.getElementById(`grid-${cat}`);
        if (!grid) return;

        const currentCount = grid.querySelectorAll(".post-card").length;
        const next = posts.slice(currentCount, currentCount + 6);
        next.forEach(p => grid.insertAdjacentHTML("beforeend", cardHTML(p)));

        // إخفاء الزر عند انتهاء المقالات
        if (currentCount + next.length >= posts.length) {
          btn.style.display = "none";
        }

        // تحديث schema على أساس أول 30 بطاقة ظاهرة تقريبًا
        buildItemListSchema(schemaCollector);
      });
    });

    buildItemListSchema(schemaCollector);
  }

  function updateURL() {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (activeFilter !== "all") params.set("cat", activeFilter);
    const url = params.toString() ? `${location.pathname}?${params.toString()}` : location.pathname;
    history.replaceState({}, "", url);
  }

  function initFromURL() {
    const params = new URLSearchParams(location.search);
    q = (params.get("q") || "").trim();
    activeFilter = (params.get("cat") || "all").trim().toLowerCase();
    if (qInput) qInput.value = q;
    setActiveChip(activeFilter);
  }

  async function init() {
    initFromURL();

    const res = await fetch(DATA_URL, { cache: "no-store" });
    allPosts = await res.json();

    // sort newest first globally
    allPosts.sort((a, b) => new Date(b.date) - new Date(a.date));

    // events
    qInput?.addEventListener("input", () => {
      q = qInput.value;
      updateURL();
      render();
    });

    chips.forEach(c => {
      c.addEventListener("click", () => {
        activeFilter = (c.getAttribute("data-filter") || "all").toLowerCase();
        setActiveChip(activeFilter);
        updateURL();
        render();
      });

      c.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          c.click();
        }
      });
    });

    render();
  }

  init().catch(() => {
    sectionsRoot.innerHTML = `<div class="note">تعذر تحميل المقالات الآن.</div>`;
  });
})();
