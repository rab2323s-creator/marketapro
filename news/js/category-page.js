(() => {
  const DATA_URL = "/news/data/posts.json";
  const grid = document.getElementById("postsGrid");
  const qInput = document.getElementById("q");
  const schemaEl = document.getElementById("itemlist-schema");

  const category = (document.body.getAttribute("data-category") || "").toLowerCase();
  let posts = [];
  let q = "";

  const esc = (s) =>
    String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  function cardHTML(p) {
    const url = `/news/${esc(p.slug)}/`;
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
    <h3><a href="${url}">${esc(p.title)}</a></h3>
    <p>${esc(p.description || "")}</p>
  </div>
  <div class="post-footer">
    <a class="btn primary" href="${url}">اقرأ الدليل</a>
    ${toolBtn}
  </div>
</article>`;
  }

  function buildSchema(list) {
    if (!schemaEl) return;
    const items = list.slice(0, 50).map((p, i) => ({
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
    const term = q.trim().toLowerCase();
    const filtered = posts.filter(p => {
      if (String(p.category || "").toLowerCase() !== category) return false;
      if (!term) return true;
      const text = `${p.title} ${p.description} ${(p.tags || []).join(" ")} ${(p.badges || []).join(" ")}`.toLowerCase();
      return text.includes(term);
    });

    // newest first
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    grid.innerHTML = filtered.map(cardHTML).join("") || `<div class="note">لا توجد مقالات في هذا القسم الآن.</div>`;
    buildSchema(filtered);
  }

  async function init() {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    posts = await res.json();

    qInput?.addEventListener("input", () => {
      q = qInput.value;
      render();
    });

    render();
  }

  init().catch(() => {
    grid.innerHTML = `<div class="note">تعذر تحميل المقالات الآن.</div>`;
  });
})();
