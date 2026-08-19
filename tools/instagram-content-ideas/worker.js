// Cloudflare Worker — MarketAPro Instagram AI Content Strategist
// Required secret: OPENAI_API_KEY
// Optional variables:
//   OPENAI_MODEL = gpt-5-mini
//   ALLOWED_ORIGINS = https://marketapro.com,https://www.marketapro.com

const MAX_BODY_CHARS = 12000;
const MAX_AVOID_TITLES = 24;

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = buildCors(origin, env.ALLOWED_ORIGINS);

    if (request.method === "OPTIONS") {
      if (!cors.allowed) {
        return json({ error: "Origin not allowed" }, 403, cors.headers);
      }
      return new Response(null, { status: 204, headers: cors.headers });
    }

    if (request.method === "GET") {
      return json(
        {
          ok: true,
          service: "marketapro-content-ai",
          version: "2.0"
        },
        200,
        cors.headers
      );
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405, cors.headers);
    }

    if (!cors.allowed) {
      return json({ error: "Origin not allowed" }, 403, cors.headers);
    }

    if (!env.OPENAI_API_KEY) {
      return json(
        { error: "OPENAI_API_KEY is not configured" },
        500,
        cors.headers
      );
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

      const input = normalizeInput(body);
      const validationError = validateInput(input);

      if (validationError) {
        return json({ error: validationError }, 400, cors.headers);
      }

      const prompt = buildPrompt(input);
      const model = String(env.OPENAI_MODEL || "gpt-5-mini").trim();

      const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          input: prompt,
          max_output_tokens: 12000,
          text: {
            format: {
              type: "json_schema",
              name: "marketapro_instagram_content_plan",
              strict: true,
              schema: RESULT_SCHEMA
            }
          }
        })
      });

      const apiData = await openaiResponse.json();

      if (!openaiResponse.ok) {
        console.error("OpenAI request failed", {
          status: openaiResponse.status,
          type: apiData?.error?.type || null,
          code: apiData?.error?.code || null
        });

        return json(
          {
            error: "AI generation failed",
            message: friendlyApiError(openaiResponse.status, apiData)
          },
          502,
          cors.headers
        );
      }

      const outputText = extractOutputText(apiData);

      if (!outputText) {
        console.error("OpenAI output missing");
        return json(
          { error: "AI returned empty output" },
          502,
          cors.headers
        );
      }

      let parsed;
      try {
        parsed = JSON.parse(outputText);
      } catch {
        console.error("Could not parse structured output");
        return json(
          { error: "Could not parse AI response" },
          502,
          cors.headers
        );
      }

      const result = normalizeResult(parsed);

      return json(
        {
          success: true,
          mode: "ai",
          requestId: request.headers.get("cf-ray") || "",
          ...result
        },
        200,
        cors.headers
      );

    } catch (error) {
      console.error("Worker crashed", {
        name: error?.name || "Error",
        message: error?.message || "Unknown"
      });

      return json(
        {
          error: "Worker crashed",
          message: "حدث خطأ غير متوقع أثناء توليد المحتوى."
        },
        500,
        cors.headers
      );
    }
  }
};

const IDEA_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    angle: { type: "string" },
    hook: { type: "string" },
    script: { type: "string" },
    caption: { type: "string" },
    cta: { type: "string" },
    why: { type: "string" }
  },
  required: ["title", "angle", "hook", "script", "caption", "cta", "why"]
};

const RESULT_SCHEMA = {
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

    posts: {
      type: "array",
      items: IDEA_SCHEMA
    },

    reels: {
      type: "array",
      items: IDEA_SCHEMA
    },

    stories: {
      type: "array",
      items: IDEA_SCHEMA
    }
  },
  required: [
    "summary",
    "globalHook",
    "globalCTA",
    "strategyNote",
    "strategy",
    "posts",
    "reels",
    "stories"
  ]
};

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

function buildPrompt(input) {
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
أنت مستشار استراتيجي محترف لمحتوى Instagram.
مهمتك بناء خطة محتوى مخصصة فعلاً من بيانات النشاط، وليس إعطاء عناوين عامة أو نسخ قوالب متكررة.

بيانات الحساب:
- نوع الحساب: ${accountMap[input.accountType] || input.accountType || "غير محدد"}
- اسم البراند: ${input.brand || "غير محدد"}
- المجال/النشاط: ${input.niche}
- الجمهور المستهدف: ${input.audience}
- ما يقدمه أو يبيعه: ${input.offer}
- الهدف: ${goalMap[input.goal] || input.goal || "غير محدد"}
- النبرة: ${toneMap[input.tone] || input.tone || "غير محددة"}
- اللغة/اللهجة: ${input.language}
- درجة الإبداع: ${creativityMap[input.creativity] || input.creativity}
- تفاصيل إضافية: ${input.notes || "لا توجد"}

عناوين ظهرت سابقًا ويجب عدم تكرارها أو إعادة صياغتها بشكل قريب:
${avoid}

المطلوب:
1) summary: ملخص استراتيجي قصير يشرح زاوية الخطة.
2) globalHook: Hook عام واحد مناسب للحساب.
3) globalCTA: CTA عام واحد مناسب للهدف.
4) strategyNote: مبدأ واحد يشرح كيف تتوزع أنواع المحتوى.
5) strategy: خطة 7 أيام. كل يوم يحتوي day وformat وidea وobjective.
6) posts: ست أفكار بوست/كاروسيل مختلفة.
7) reels: ست أفكار ريلز مختلفة.
8) stories: ست أفكار ستوري مختلفة.

لكل فكرة ضمن posts وreels وstories أعط:
- title: عنوان الفكرة.
- angle: الزاوية مثل تعليمي، مقارنة، قصة، تفاعل، بيع ناعم، كواليس.
- hook: افتتاحية قصيرة وجذابة.
- script: طريقة تنفيذ عملية وواضحة.
- caption: مسودة Caption مناسبة للفكرة.
- cta: دعوة واحدة فقط للفعل.
- why: سبب مختصر لماذا تناسب هذه الفكرة الجمهور والهدف.

قواعد إلزامية:
- اكتب باللغة/اللهجة المطلوبة فقط، باستثناء المصطلحات التسويقية الشائعة عند الحاجة.
- اجعل جميع الأفكار مختلفة بوضوح في الزاوية والبنية.
- خصص النتائج للنشاط والجمهور والعرض المذكورين.
- لا تستخدم clickbait كاذب أو وعودًا مضمونة.
- ممنوع اختراع أرقام أو نسب أو نتائج أو شهادات عملاء أو دراسات حالة حدثت فعلاً.
- ممنوع اختراع منتجات أو خدمات أو خصومات أو ملفات أو أدوات أو روابط لم يذكرها المستخدم.
- إذا اقترحت دراسة حالة أو شهادة عميل، صغها كفكرة مستقبلية واشترط استخدام بيانات حقيقية.
- لا تقل "الرابط في البايو" إلا إذا كانت المعلومات المقدمة تؤكد وجود رابط مناسب.
- لا تقل "حمّل الملف" أو "استخدم أداتنا" إلا إذا ذكر المستخدم وجود هذا الملف أو الأداة.
- لا تنسب للبراند أي ميزة لم يذكرها المستخدم.
- لا تستخدم معلومات حساسة أو شخصية.
- إذا كانت تفاصيل المستخدم غير كافية لادعاء معين، استخدم صياغة محايدة.
- اجعل السكريبتات قابلة للتنفيذ، وليست تنظيرًا عامًا.
- للريلز: اذكر تسلسل اللقطات أو المشاهد عند فائدته.
- للستوري: استخدم تسلسلًا أو ملصقًا تفاعليًا عندما يناسب.
- للبوستات: استخدم بنية كاروسيل أو بوست ثابت حسب الفكرة.
- أعِد JSON فقط حسب الـschema المطلوب، بدون Markdown وبدون أي شرح خارجي.
`.trim();
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

function normalizeResult(data) {
  const idea = (x) => ({
    title: clean(x?.title, 180),
    angle: clean(x?.angle, 120),
    hook: clean(x?.hook, 300),
    script: clean(x?.script, 1600),
    caption: clean(x?.caption, 1600),
    cta: clean(x?.cta, 300),
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

    posts: Array.isArray(data?.posts)
      ? data.posts.slice(0, 6).map(idea)
      : [],

    reels: Array.isArray(data?.reels)
      ? data.reels.slice(0, 6).map(idea)
      : [],

    stories: Array.isArray(data?.stories)
      ? data.stories.slice(0, 6).map(idea)
      : []
  };
}

function clean(value, maxLength = 500) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, maxLength);
}

function buildCors(origin, configuredOrigins) {
  const configured = String(configuredOrigins || "").trim();

  // للتشغيل السريع: إذا لم تضبط ALLOWED_ORIGINS نسمح للجميع.
  // للإنتاج اضبط ALLOWED_ORIGINS داخل Cloudflare.
  if (!configured || configured === "*") {
    return {
      allowed: true,
      headers: corsHeaders("*")
    };
  }

  const allowedOrigins = configured
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

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
