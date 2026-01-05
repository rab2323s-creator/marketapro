 (function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const issueMapAr = {
    disabled: "الحساب معطّل / تم تعطيله",
    locked: "الحساب مقفول / تم قفله مؤقتًا",
    hacked: "الحساب تم اختراقه",
    impersonation: "انتحال شخصية",
    defamation: "تشهير / إساءة",
  };

  const issueMapEn = {
    disabled: "Account disabled",
    locked: "Account locked temporarily",
    hacked: "Account hacked",
    impersonation: "Impersonation",
    defamation: "Defamation / Harassment",
  };

  function clean(v) {
    return String(v ?? "").trim();
  }

  function todayISO() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function buildText(lang, data) {
    const {
      issue,
      fullName,
      email,
      profileUrl,
      country,
      context,
      links,
    } = data;

    const issueLabel = lang === "ar" ? (issueMapAr[issue] || issue) : (issueMapEn[issue] || issue);
    const date = todayISO();

    if (lang === "ar") {
      const lines = [];
      lines.push("مرحبًا فريق دعم Meta،");
      lines.push("");
      lines.push("أتقدم بطلب مراجعة لقرار تقييد/تعطيل حسابي على فيسبوك، وأرجو إعادة التحقق من الحالة.");
      lines.push("");
      lines.push("بيانات الحساب:");
      if (fullName) lines.push(`- الاسم على الحساب: ${fullName}`);
      if (profileUrl) lines.push(`- رابط الحساب/الملف الشخصي: ${profileUrl}`);
      if (email) lines.push(`- البريد/الهاتف المرتبط (اختياري): ${email}`);
      if (country) lines.push(`- الدولة: ${country}`);
      lines.push(`- نوع المشكلة: ${issueLabel}`);
      lines.push(`- تاريخ الطلب: ${date}`);
      lines.push("");
      lines.push("توضيح مختصر لما حدث:");
      lines.push(context || "تم اتخاذ إجراء على الحساب، وأعتقد أن ذلك قد يكون بالخطأ أو نتيجة سوء فهم. أرجو مراجعة الحالة وإرشادي للخطوات المطلوبة لاستعادة الوصول.");
      if (links) {
        lines.push("");
        lines.push("روابط/أدلة مرتبطة (إن وجدت):");
        lines.push(links);
      }
      lines.push("");
      lines.push("أتعهد بالالتزام بمعايير المجتمع وشروط الاستخدام، وأرجو مراجعة بشرية للحالة وإعادة تفعيل الحساب إذا لم توجد مخالفة.");
      lines.push("");
      lines.push("شكرًا لكم.");
      return lines.join("\n");
    }

    // English
    const lines = [];
    lines.push("Hello Meta Support Team,");
    lines.push("");
    lines.push("I’m requesting a review of the decision to restrict/disable my Facebook account. Please re-check the case and restore access if this was a mistake.");
    lines.push("");
    lines.push("Account details:");
    if (fullName) lines.push(`- Name on the account: ${fullName}`);
    if (profileUrl) lines.push(`- Profile/Account URL: ${profileUrl}`);
    if (email) lines.push(`- Associated email/phone (optional): ${email}`);
    if (country) lines.push(`- Country: ${country}`);
    lines.push(`- Issue type: ${issueLabel}`);
    lines.push(`- Date: ${date}`);
    lines.push("");
    lines.push("Short explanation:");
    lines.push(context || "An action was taken on my account and I believe it may be a mistake or misunderstanding. Please review the case and advise the exact steps needed to regain access.");
    if (links) {
      lines.push("");
      lines.push("Related links/evidence (if any):");
      lines.push(links);
    }
    lines.push("");
    lines.push("I will comply with Community Standards and Terms of Service. Please restore my account if no violation is found.");
    lines.push("");
    lines.push("Thank you.");
    return lines.join("\n");
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.top = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    }
  }

  function setStatus(msg) {
    const el = $("copyStatus");
    if (!el) return;
    el.textContent = msg;
  }

  function getData() {
    return {
      issue: clean($("issue")?.value),
      fullName: clean($("fullName")?.value),
      email: clean($("email")?.value),
      profileUrl: clean($("profileUrl")?.value),
      country: clean($("country")?.value),
      context: clean($("context")?.value),
      links: clean($("links")?.value),
      lang: clean($("lang")?.value) || "ar",
    };
  }

  function generate() {
    const data = getData();
    const lang = data.lang === "en" ? "en" : "ar";
    const text = buildText(lang, data);
    const out = $("output");
    if (out) out.textContent = text;
    return text;
  }

  function shorten() {
    const data = getData();
    const lang = data.lang === "en" ? "en" : "ar";
    const issueLabel = lang === "ar" ? (issueMapAr[data.issue] || data.issue) : (issueMapEn[data.issue] || data.issue);
    const date = todayISO();

    const shortAr =
      `مرحبًا فريق دعم Meta،\n\n` +
      `أرجو مراجعة قرار تقييد/تعطيل حسابي على فيسبوك (${issueLabel}). ` +
      `الاسم: ${data.fullName || "—"}، الرابط: ${data.profileUrl || "—"}، التاريخ: ${date}.\n` +
      `تفاصيل مختصرة: ${data.context || "أعتقد أن هناك خطأ أو سوء فهم. أرجو مراجعة بشرية وإرشادي للخطوات."}\n\n` +
      `شكرًا لكم.`;

    const shortEn =
      `Hello Meta Support Team,\n\n` +
      `Please review the restriction/disable on my Facebook account (${issueLabel}). ` +
      `Name: ${data.fullName || "—"}, URL: ${data.profileUrl || "—"}, Date: ${date}.\n` +
      `Brief details: ${data.context || "I believe this may be a mistake. Please conduct a human review and advise next steps."}\n\n` +
      `Thank you.`;

    const out = $("output");
    if (out) out.textContent = (lang === "ar") ? shortAr : shortEn;
  }

  function resetForm() {
    ["fullName", "email", "profileUrl", "country", "context", "links"].forEach((id) => {
      const el = $(id);
      if (el) el.value = "";
    });
    if ($("issue")) $("issue").value = "disabled";
    if ($("lang")) $("lang").value = "ar";
    $("output").textContent = 'اضغط “توليد النص” لعرض نص الاعتراض هنا.';
    setStatus("تم المسح");
  }

  function wire() {
    $("btnGenerate")?.addEventListener("click", (e) => {
      e.preventDefault();
      generate();
      setStatus("تم توليد النص");
    });

    $("btnCopy")?.addEventListener("click", async (e) => {
      e.preventDefault();
      const text = $("output")?.textContent?.trim() || "";
      const finalText = text.includes("اضغط") ? generate() : text;
      const ok = await copyText(finalText);
      setStatus(ok ? "✅ تم نسخ النص" : "⚠️ لم يتم النسخ — انسخ يدويًا");
    });

    $("btnShorten")?.addEventListener("click", (e) => {
      e.preventDefault();
      shorten();
      setStatus("تم اختصار النص");
    });

    $("btnReset")?.addEventListener("click", (e) => {
      e.preventDefault();
      resetForm();
    });

    // إعادة توليد عند تغيير اللغة أو نوع المشكلة (مريح للمستخدم)
    $("lang")?.addEventListener("change", generate);
    $("issue")?.addEventListener("change", generate);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      wire();
    });
  } else {
    wire();
  }
})();

