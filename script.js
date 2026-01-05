(function(){
  'use strict';

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  function clean(v){
    return String(v||'').trim();
  }

  function nowISO(){
    const d = new Date();
    const pad = (n)=> String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }

  function buildArabic(data){
    const {
      name, profileUrl, email, phone, country,
      reason, details, tone
    } = data;

    const polite = tone === 'polite';

    const lines = [];
    lines.push('مرحبًا فريق دعم Meta،');
    lines.push('');

    if (polite){
      lines.push('أتقدم بطلب مراجعة قرار تعطيل/تقييد حسابي على فيسبوك، وأرجو التحقق من الأمر وإعادة تفعيل الحساب إذا كان هناك خطأ.');
    } else {
      lines.push('أرجو مراجعة قرار تعطيل/تقييد حسابي على فيسبوك وإعادة تفعيله، لأنني أعتقد أن هناك خطأ أو سوء فهم.');
    }

    lines.push('');
    lines.push('بيانات الحساب:');
    if (name) lines.push(`- الاسم على الحساب: ${name}`);
    if (profileUrl) lines.push(`- رابط الحساب/الملف الشخصي: ${profileUrl}`);
    if (email) lines.push(`- البريد المرتبط (إن وُجد): ${email}`);
    if (phone) lines.push(`- رقم الهاتف (إن وُجد): ${phone}`);
    if (country) lines.push(`- البلد: ${country}`);
    lines.push(`- تاريخ تقديم الطلب: ${nowISO()}`);

    lines.push('');
    lines.push('سبب المشكلة (حسب ما ظهر لي):');
    lines.push(`- ${reason || 'تعطيل/تقييد بدون توضيح كافٍ'}`);

    lines.push('');
    lines.push('توضيح مختصر:');
    if (details){
      lines.push(details);
    } else {
      lines.push('لم أقم بنشر محتوى مخالف عن قصد. إن وُجد منشور/نشاط تم اعتباره مخالفًا، أرجو مشاركتي بالتفاصيل أو إتاحة الفرصة لتصحيحه/حذفه.');
    }

    lines.push('');
    lines.push('تعهد:');
    lines.push('أتعهد بالالتزام بمعايير المجتمع وشروط الاستخدام، وأرجو إعادة تفعيل الحساب أو توضيح الخطوات المطلوبة لإتمام التحقق.');

    lines.push('');
    lines.push('شكرًا لكم.');

    return lines.join('\n');
  }

  function buildEnglish(data){
    const {
      name, profileUrl, email, phone, country,
      reason, details, tone
    } = data;

    const polite = tone === 'polite';

    const lines = [];
    lines.push('Hello Meta Support Team,');
    lines.push('');

    if (polite){
      lines.push('I’m requesting a review of the decision to disable/restrict my Facebook account. I kindly ask you to re-check the case and restore access if this was a mistake.');
    } else {
      lines.push('Please review the decision to disable/restrict my Facebook account and restore access. I believe this may be a mistake or misunderstanding.');
    }

    lines.push('');
    lines.push('Account details:');
    if (name) lines.push(`- Name on the account: ${name}`);
    if (profileUrl) lines.push(`- Profile/Account URL: ${profileUrl}`);
    if (email) lines.push(`- Associated email (if any): ${email}`);
    if (phone) lines.push(`- Phone number (if any): ${phone}`);
    if (country) lines.push(`- Country: ${country}`);
    lines.push(`- Date: ${nowISO()}`);

    lines.push('');
    lines.push('Issue reason (as shown to me):');
    lines.push(`- ${reason || 'Disabled/restricted without clear explanation'}`);

    lines.push('');
    lines.push('Short explanation:');
    if (details){
      lines.push(details);
    } else {
      lines.push('I did not intentionally violate any policies. If any content or activity was flagged, please share the details or allow me to remove/correct it.');
    }

    lines.push('');
    lines.push('Commitment:');
    lines.push('I will comply with Community Standards and Terms of Service. Please restore my account or advise the exact steps required to verify and regain access.');

    lines.push('');
    lines.push('Thank you.');

    return lines.join('\n');
  }

  async function copyText(text){
    try{
      await navigator.clipboard.writeText(text);
      return true;
    } catch(e){
      // fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly','');
      ta.style.position = 'fixed';
      ta.style.top = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    }
  }

  function setStatus(el, msg){
    if (!el) return;
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(setStatus._t);
    setStatus._t = setTimeout(()=>{ el.style.opacity = '.75'; }, 1400);
  }

  function init(){
    const form = $('#appealForm');
    const outAr = $('#outAr');
    const outEn = $('#outEn');
    const status = $('#copyStatus');

    const reasonSelect = $('#reason');
    const toneSelect = $('#tone');

    const btnGen = $('#btnGenerate');
    const btnCopyAr = $('#btnCopyAr');
    const btnCopyEn = $('#btnCopyEn');
    const btnClear = $('#btnClear');

    function getData(){
      return {
        name: clean($('#name').value),
        profileUrl: clean($('#profileUrl').value),
        email: clean($('#email').value),
        phone: clean($('#phone').value),
        country: clean($('#country').value),
        reason: clean(reasonSelect.value),
        details: clean($('#details').value),
        tone: clean(toneSelect.value)
      };
    }

    function generate(){
      const data = getData();
      outAr.value = buildArabic(data);
      outEn.value = buildEnglish(data);
    }

    btnGen?.addEventListener('click', (e)=>{
      e.preventDefault();
      generate();
      outAr?.focus();
    });

    btnCopyAr?.addEventListener('click', async (e)=>{
      e.preventDefault();
      if (!outAr.value) generate();
      const ok = await copyText(outAr.value);
      setStatus(status, ok ? '✅ تم نسخ النص العربي' : '⚠️ لم يتم النسخ — انسخ يدويًا');
    });

    btnCopyEn?.addEventListener('click', async (e)=>{
      e.preventDefault();
      if (!outEn.value) generate();
      const ok = await copyText(outEn.value);
      setStatus(status, ok ? '✅ English text copied' : '⚠️ Copy failed — please copy manually');
    });

    btnClear?.addEventListener('click', (e)=>{
      e.preventDefault();
      form?.reset();
      outAr.value = '';
      outEn.value = '';
      setStatus(status, 'تم المسح');
    });

    // Auto-generate on first load (nice UX)
    generate();

    // Generate on key fields change for convenience
    ['name','profileUrl','email','phone','country','details'].forEach(id=>{
      const el = $('#'+id);
      el?.addEventListener('input', ()=>{ /* light */ });
    });
    reasonSelect?.addEventListener('change', generate);
    toneSelect?.addEventListener('change', generate);
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
