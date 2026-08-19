# MarketAPro — Instagram Content SEO Pro v3

هذه النسخة مصممة لتتوافق بصريًا وبنيويًا مع أدوات MarketAPro الحالية، وتستفيد من العناصر الموجودة في صفحة تحليل حساب إنستغرام الناجحة: H1/H2 واضحان، Breadcrumbs، خطوات، نموذج مباشر، محتوى SEO ثابت، FAQ وروابط داخلية.

## عنوان SEO المعتمد

```html
<title>مولد محتوى انستقرام بالذكاء الاصطناعي مجانًا — MarketAPro</title>
```

## H1 المعتمد

```html
<h1>مولد محتوى انستقرام بالذكاء الاصطناعي مجانًا</h1>
```

## H2 الداعم

```html
<h2>أنشئ أفكار بوستات وريلز وستوري + Hook وكابشن وCTA وخطة محتوى 7 أيام</h2>
```

## الملفات

- `index.html`
- `instagram-content-ideas.js`
- `worker.js` (نسخة Cloudflare Worker v2.1 الحالية)

الصفحة تعتمد على ملف موقعك الحالي:

```html
<link rel="stylesheet" href="/style.css">
```

لذلك لن تكسر هوية MarketAPro.

## النشر على GitHub

ضع:

```text
/tools/instagram-content-ideas/index.html
/tools/instagram-content-ideas/instagram-content-ideas.js
```

## Cloudflare

إذا كان Worker v2.1 عندك يعمل، لا تحتاج تغييره. وضعت `worker.js` داخل الحزمة فقط كنسخة مرجعية كاملة.

## بعد النشر

1. تأكد أن canonical هو URL الحقيقي.
2. أنشئ صورة:
   `/assets/og-instagram-content-ideas.jpg`
3. أضف URL إلى sitemap.
4. اطلب إعادة الفهرسة من Google Search Console.
5. اربط الأداة من صفحة `/tools/` ومن أداة تحليل الحساب ومن مقالات السوشيال.
6. لا تغيّر Title/H1 باستمرار؛ اترك Google يعيد الزحف ويجمع بيانات.

## ملاحظة

Meta keywords غير مضافة عمدًا؛ Google لا يستخدمها لترتيب نتائج البحث. التركيز هنا على Title/H1، المحتوى المفيد، الروابط الداخلية، Schema وتجربة الأداة.
