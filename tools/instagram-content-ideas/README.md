# MarketAPro — Instagram AI Content Ideas

نسخة كاملة مستقلة وجاهزة لـ GitHub Pages + Cloudflare Workers.

## الملفات

- `index.html` — الصفحة، SEO، Schema، FAQ والواجهة.
- `instagram-content-ideas.css` — التصميم الكامل.
- `instagram-content-ideas.js` — الواجهة، الاتصال بالـAI، rendering الآمن، fallback، النسخ والتنزيل.
- `worker.js` — Cloudflare Worker للاتصال بـ OpenAI API.

## 1) GitHub Pages

ضع هذه الملفات الثلاثة في مجلد الصفحة:

```text
/tools/instagram-content-ideas/
  index.html
  instagram-content-ideas.css
  instagram-content-ideas.js
```

إذا كان موقعك يستخدم نظام مسارات مختلفًا، عدّل الروابط داخل `index.html`.

## 2) Cloudflare Worker

افتح Worker:

`marketapro-content-ai`

ثم `Edit code` واستبدل الكود بالكامل بمحتوى `worker.js` ثم Deploy.

## 3) OpenAI Secret

داخل Cloudflare:

`Worker > Settings > Variables and Secrets > Add`

أضف Secret:

```text
Name: OPENAI_API_KEY
Value: sk-...
```

لا تضع المفتاح في GitHub أو `instagram-content-ideas.js`.

## 4) متغيرات Cloudflare الاختيارية

### OPENAI_MODEL

يمكنك إضافة Text variable:

```text
OPENAI_MODEL = gpt-5-mini
```

إذا لم تضفه، الكود يستخدم `gpt-5-mini` افتراضيًا.

### ALLOWED_ORIGINS

للتجربة، الكود يعمل حتى بدون هذا المتغير.

للإنتاج، أضف Text variable:

```text
ALLOWED_ORIGINS = https://marketapro.com,https://www.marketapro.com
```

إذا كنت تختبر مباشرة من github.io، أضف أصل GitHub Pages أيضًا مفصولًا بفاصلة.

## 5) رابط الـWorker في JavaScript

داخل `instagram-content-ideas.js` يوجد:

```js
const AI_ENDPOINT = "https://marketapro-content-ai.rab2323s.workers.dev";
```

إذا تغيّر رابط Worker، غيّر هذا السطر فقط.

## 6) نقاط أمان مهمة

- الـAPI key يبقى Secret داخل Cloudflare.
- مخرجات AI لا تُحقن باستخدام `innerHTML`.
- المدخلات مقيدة بالطول في الواجهة والـWorker.
- Worker لا يعرض تفاصيل خطأ OpenAI الحساسة للمستخدم.
- يوجد Fallback محلي إذا فشل AI.
- يفضل لاحقًا إضافة Cloudflare Rate Limiting وTurnstile إذا زاد الاستخدام العام.

## 7) SEO قبل النشر

تحقق من:

- الـcanonical:
  `https://marketapro.com/tools/instagram-content-ideas/`
- صورة Open Graph:
  `https://marketapro.com/assets/og-instagram-content-ideas.jpg`
- إضافة الصفحة إلى sitemap.xml.
- ربط الصفحة داخليًا من `/tools/` ومقالات السوشيال.
- إرسال الـURL إلى Google Search Console بعد النشر.

## 8) الاختبار

جرّب بيانات حقيقية في الصفحة. إذا ظهر Badge:

`AI`

فالـWorker يعمل.

إذا ظهر:

`FALLBACK`

فالواجهة شغالة لكن الاتصال بالـAI فشل، ويمكن مراجعة Cloudflare Observability logs.
