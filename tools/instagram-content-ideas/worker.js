// MarketAPro Instagram AI — Cloudflare Worker v2.1
// Secret required: OPENAI_API_KEY
// Optional:
// OPENAI_MODEL = gpt-5-mini
// ALLOWED_ORIGINS = https://marketapro.com,https://www.marketapro.com

const MAX_BODY_CHARS = 14000;
const MAX_AVOID_TITLES = 24;

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = buildCors(origin, env.ALLOWED_ORIGINS);

    if (request.method === "OPTIONS") {
      if (!cors.allowed) return json({ error: "Origin not allowed" }, 403, cors.headers);
      return new Response(null, { status: 204, headers: cors.headers });
    }

    if (request.method === "GET") {
      return json({ ok: true, service: "marketapro-content-ai", version: "2.1" }, 200, cors.headers);
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405, cors.headers);
    }

    if (!cors.allowed) {
      return json({ error: "Origin not allowed" }, 403, cors.headers);
    }

    if (!env.OPENAI_API_KEY) {
      return json({ error: "OPENAI_API_KEY is not configured" }, 500, cors.headers);
    }

    try {
      const raw = await request.text();
      if (!raw || raw.length > MAX_BODY_CHARS) {
        return json({ error: "Invalid request size" }, 413, cors.headers);
      }

      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        return json({ error: "Invalid JSON" }, 400, cors.headers);
      }

      const action = String(body?.action || "plan").trim();

      if (action === "expand") {
        return await handleExpand(body, env, cors.headers);
      }

      return await handlePlan(body, env, cors.headers);

    } catch (error) {
      console.error("Worker crashed", {
        name: error?.name || "Error",
        message: error?.message || "Unknown"
      });

      return json(
        { error: "Worker crashed", message: "حدث خطأ غير متوقع أثناء توليد المحتوى." },
        500,
        cors.headers
      );
    }
  }
};

async function handlePlan(body, env, corsHeaders) {
  const input = normalizeInput(body);
  const validationError = validateInput(input);
  if (validationError) {
    return json({ error: validationError }, 400, corsHeaders);
  }

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      summary: { type: "string" },
      globalHook: { type: "string" },
      globalCTA: { type: "string" },
      strategyNote: { type: "string" },
      strategy: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            day: { type: "string" },
            format: { type: "string" },
            idea: { type: "string" },
            objective: { type: "string" }
          },
          required: ["day", "format", "idea", "objective"]
        }
      },
      posts: { type: "array", items: IDEA_SUMMARY_SCHEMA },
      reels: { type: "array", items: IDEA_SUMMARY_SCHEMA },
      stories: { type: "array", items: IDEA_SUMMARY_SCHEMA }
    },
    required: [
      "summary", "globalHook", "globalCTA", "strategyNote",
      "strategy", "posts", "reels", "stories"
    ]
  };

  const result = await callOpenAI({
    env,
    prompt: buildPlanPrompt(input),
    schema,
    schemaName: "marketapro_instagram_plan",
    maxOutputTokens: 5200
  });

  if (!result.ok) {
    return json(result.body, result.status, corsHeaders);
  }

  return json({
    success: true,
    mode: "ai",
    ...normalizePlan(result.data)
  }, 200, corsHeaders);
}

async function handleExpand(body, env, corsHeaders) {
  const context = normalizeInput(body?.context || {});
  const validationError = validateInput(context);
  if (validationError) {
    return json({ error: validationError }, 400, corsHeaders);
  }

  const idea = {
    typeLabel: clean(body?.idea?.typeLabel, 40),
    title: clean(body?.idea?.title, 180),
    angle: clean(body?.idea?.angle, 120),
    hook: clean(body?.idea?.hook, 320),
    why: clean(body?.idea?.why, 600)
  };

  if (!idea.title || !idea.typeLabel) {
    return json({ error: "Missing idea" }, 400, corsHeaders);
  }

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      script: { type: "string" },
      caption: { type: "string" },
      cta: { type: "string" },
      executionTip: { type: "string" }
    },
    required: ["script", "caption", "cta", "executionTip"]
  };

  const result = await callOpenAI({
    env,
    prompt: buildExpandPrompt(context, idea),
    schema,
    schemaName: "marketapro_instagram_idea_details",
    maxOutputTokens: 2200
  });

  if (!result.ok) {
    return json(result.body, result.status, corsHeaders);
  }

  return json({
    success: true,
    script: clean(result.data?.script, 1800),
    caption: clean(result.data?.caption, 1800),
    cta: clean(result.data?.cta, 320),
    executionTip: clean(result.data?.executionTip, 700)
  }, 200, corsHeaders);
}

const IDEA_SUMMARY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    angle: { type: "string" },
    hook: { type: "string" },
    why: { type: "string" }
  },
  required: ["title", "angle", "hook", "why"]
};

async function callOpenAI({ env, prompt, schema, schemaName, maxOutputTokens }) {
  const model = String(env.OPENAI_MODEL || "gpt-5-mini").trim();

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: prompt,
      reasoning: {
        effort: "minimal"
      },
      max_output_tokens: maxOutputTokens,
      text: {
        format: {
          type: "json_schema",
          name: schemaName,
          strict: true,
          schema
        }
      }
    })
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("OpenAI request failed", {
      status: response.status,
      type: data?.error?.type || null,
      code: data?.error?.code || null
    });

    return {
      ok: false,
      status: 502,
      body: {
        error: "AI generation failed",
        message: friendlyApiError(response.status, data)
      }
    };
  }

  const outputText = extractOutputText(data);

  if (!outputText) {
    return {
      ok: false,
      status: 502,
      body: { error: "AI returned empty output" }
    };
  }

  try {
    return {
      ok: true,
      data: JSON.parse(outputText)
    };
  } catch {
    console.error("Could not parse structured output");
    return {
      ok: false,
      status: 502,
      body: { error: "Could not parse AI response" }
    };
  }
}

function buildPlanPrompt(input) {
  const accountMap = {
    business: "تجاري / شركة / متجر",
    creator: "صانع محتوى / مؤثر",
    personal: "شخصي / لايف ستايل",
    model: "موديلز / فاشن / تصوير"
  };

  const goalMap = {
    engagement: "زيادة التفاعل والحفظ والمشاركة والتعليقات",
    followers: "زيادة الوصول والمتابعين المناسبين",
    sales: "زيادة المبيعات أو الحجوزات بطريقة واقعية",
    trust: "بناء الثقة وإظهار الخبرة",
    leads: "الحصول على رسائل واستفسارات مؤهلة"
  };

  const toneMap = {
    friendly: "ودّي وبسيط وطبيعي",
    professional: "احترافي وواثق وواضح",
    bold: "جريء وجذاب دون مبالغة",
    educational: "تعليمي ومباشر",
    emotional: "عاطفي وملهم دون ابتذال"
  };

  const creativityMap = {
    balanced: "متوازن بين الإبداع وسهولة التنفيذ",
    safe: "عملي ومحافظ وسهل التطبيق",
    creative: "إبداعي مع زوايا غير مكررة",
    experimental: "جريء وتجريبي لكن قابل للتنفيذ"
  };

  const avoid = input.avoidTitles.length
    ? input.avoidTitles.map((x, i) => `${i + 1}. ${x}`).join("\n")
    : "لا يوجد.";

  return `
أنت مستشار محتوى Instagram محترف. أنشئ خطة أفكار مخصصة وسريعة، ولا تكتب السكريبت أو الكابشن الكامل الآن.

بيانات الحساب:
- نوع الحساب: ${accountMap[input.accountType] || input.accountType || "غير محدد"}
- البراند: ${input.brand || "غير محدد"}
- المجال: ${input.niche}
- الجمهور: ${input.audience}
- العرض/الخدمة: ${input.offer}
- الهدف: ${goalMap[input.goal] || input.goal || "غير محدد"}
- النبرة: ${toneMap[input.tone] || input.tone || "غير محددة"}
- اللغة/اللهجة: ${input.language}
- الإبداع: ${creativityMap[input.creativity] || input.creativity}
- ملاحظات: ${input.notes || "لا توجد"}

تجنب تكرار هذه العناوين أو إعادة صياغتها بشكل قريب:
${avoid}

المطلوب:
- summary: ملخص استراتيجي من جملتين كحد أقصى.
- globalHook: Hook عام قصير.
- globalCTA: CTA عام واحد.
- strategyNote: جملة واحدة عن توزيع المحتوى.
- strategy: 7 أيام بالضبط.
- posts: 6 أفكار بالضبط.
- reels: 6 أفكار بالضبط.
- stories: 6 أفكار بالضبط.

لكل فكرة أعط فقط:
title + angle + hook + why

قواعد:
- خصص كل فكرة للنشاط والجمهور والعرض المذكور.
- لا تعطِ أفكارًا من نوع "5 أخطاء في المطعم" إذا كان النشاط مطعمًا إلا إذا كانت الأخطاء تخص تجربة العميل أو اختيار الوجبة بشكل منطقي.
- للمطاعم والمتاجر والمنتجات: فضّل التصوير الحقيقي، المنتج، المقارنات، الكواليس، تجربة العميل، الاختيارات والتفاعل على النصائح العامة.
- ممنوع اختراع أرقام أو نسب أو شهادات أو نتائج.
- ممنوع اختراع عروض أو منتجات أو ملفات أو روابط غير مذكورة.
- لا تقل "الرابط في البايو" ما لم يذكر المستخدم وجود رابط.
- اجعل الـHook قصيرًا قدر الإمكان.
- اجعل why جملة قصيرة جدًا.
- لا تكرر الزوايا.
- أعد JSON فقط حسب الـschema.
`.trim();
}

function buildExpandPrompt(input, idea) {
  return `
أنت كاتب محتوى Instagram محترف. طوّر الفكرة التالية فقط إلى تفاصيل تنفيذية جاهزة للمراجعة.

السياق:
- البراند: ${input.brand || "غير محدد"}
- المجال: ${input.niche}
- الجمهور: ${input.audience}
- العرض/الخدمة: ${input.offer}
- الهدف: ${input.goal}
- النبرة: ${input.tone}
- اللغة/اللهجة: ${input.language}
- ملاحظات: ${input.notes || "لا توجد"}

الفكرة:
- النوع: ${idea.typeLabel}
- العنوان: ${idea.title}
- الزاوية: ${idea.angle}
- Hook: ${idea.hook}
- سبب الملاءمة: ${idea.why}

أعط:
- script: تنفيذ عملي ومحدد. للريلز اذكر تسلسل اللقطات. للستوري اذكر تسلسل الشرائح/الملصقات. للبوست اذكر بنية الكاروسيل أو البوست.
- caption: مسودة Caption طبيعية وغير طويلة بلا داعٍ.
- cta: CTA واحد فقط ومناسب للهدف.
- executionTip: نصيحة تنفيذ قصيرة.

قواعد:
- لا تخترع أسعارًا أو عروضًا أو أرقامًا أو شهادات أو نتائج.
- لا تخترع منتجًا أو خدمة غير مذكورة.
- لا تقل "الرابط في البايو" إلا إذا ذُكر وجوده.
- استخدم معلومات حقيقية من السياق فقط.
- لا تكرر الـHook داخل الـCaption حرفيًا.
- أعد JSON فقط حسب الـschema.
`.trim();
}

function normalizeInput(body) {
  return {
    accountType: clean(body?.accountType, 40),
    brand: clean(body?.brand, 80),
    niche: clean(body?.niche, 140),
    audience: clean(body?.audience, 420),
    offer: clean(body?.offer, 420),
    goal: clean(body?.goal, 40),
    tone: clean(body?.tone, 40),
    language: clean(body?.language, 80) || "العربية الفصحى المبسطة",
    creativity: clean(body?.creativity, 40) || "balanced",
    notes: clean(body?.notes, 500),
    avoidTitles: Array.isArray(body?.avoidTitles)
      ? body.avoidTitles
          .slice(0, MAX_AVOID_TITLES)
          .map((x) => clean(x, 180))
          .filter(Boolean)
      : []
  };
}

function validateInput(input) {
  if (input.niche.length < 3) return "Missing or invalid niche";
  if (input.audience.length < 5) return "Missing or invalid audience";
  if (input.offer.length < 5) return "Missing or invalid offer";
  return "";
}

function normalizePlan(data) {
  const idea = (x) => ({
    title: clean(x?.title, 180),
    angle: clean(x?.angle, 120),
    hook: clean(x?.hook, 320),
    why: clean(x?.why, 600)
  });

  return {
    summary: clean(data?.summary, 500),
    globalHook: clean(data?.globalHook, 400),
    globalCTA: clean(data?.globalCTA, 400),
    strategyNote: clean(data?.strategyNote, 500),
    strategy: Array.isArray(data?.strategy)
      ? data.strategy.slice(0, 7).map((x, i) => ({
          day: clean(x?.day, 40) || `اليوم ${i + 1}`,
          format: clean(x?.format, 80),
          idea: clean(x?.idea, 240),
          objective: clean(x?.objective, 160)
        }))
      : [],
    posts: Array.isArray(data?.posts) ? data.posts.slice(0, 6).map(idea) : [],
    reels: Array.isArray(data?.reels) ? data.reels.slice(0, 6).map(idea) : [],
    stories: Array.isArray(data?.stories) ? data.stories.slice(0, 6).map(idea) : []
  };
}

function extractOutputText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }
  if (!Array.isArray(data?.output)) return "";

  const parts = [];
  for (const item of data.output) {
    if (!Array.isArray(item?.content)) continue;
    for (const content of item.content) {
      if (content?.type === "output_text" && typeof content.text === "string") {
        parts.push(content.text);
      }
    }
  }
  return parts.join("\n").trim();
}

function clean(value, maxLength = 500) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, maxLength);
}

function buildCors(origin, configuredOrigins) {
  const configured = String(configuredOrigins || "").trim();

  if (!configured || configured === "*") {
    return { allowed: true, headers: corsHeaders("*") };
  }

  const allowedOrigins = configured.split(",").map((x) => x.trim()).filter(Boolean);
  const allowed = !origin || allowedOrigins.includes(origin);

  return {
    allowed,
    headers: corsHeaders(allowed && origin ? origin : allowedOrigins[0] || "")
  };
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "null",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      ...extraHeaders
    }
  });
}

function friendlyApiError(status, data) {
  const code = data?.error?.code || "";
  if (status === 401) return "مفتاح OpenAI غير صالح أو غير مفعّل.";
  if (status === 429 || code === "insufficient_quota") {
    return "تم الوصول إلى حد الاستخدام أو لا يوجد رصيد API كافٍ.";
  }
  if (status >= 500) return "خدمة الذكاء الاصطناعي غير متاحة مؤقتًا.";
  return "تعذر تنفيذ طلب الذكاء الاصطناعي.";
}
