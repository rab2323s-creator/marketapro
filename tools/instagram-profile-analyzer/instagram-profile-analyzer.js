"use strict";
  const $ = (id) => document.getElementById(id);

  function toast(msg){
    const t = $('toast');
    t.textContent = msg;
    t.style.display = 'block';
    clearTimeout(window.__t);
    window.__t = setTimeout(()=>t.style.display='none', 1400);
  }
  function showError(msg){
    const box = $('debugBox');
    box.style.display = 'block';
    box.textContent = "خطأ:\n" + msg;
  }
  function clearError(){
    const box = $('debugBox');
    box.style.display = 'none';
    box.textContent = "";
  }
  function showWarn(msg){
    const w = $('warnBox');
    w.style.display = 'block';
    w.textContent = msg;
  }
  function clearWarn(){
    const w = $('warnBox');
    w.style.display = 'none';
    w.textContent = "";
  }

  function setStep(n){
    $('step1').classList.toggle('on', n===1);
    $('step2').classList.toggle('on', n===2);
    $('step3').classList.toggle('on', n===3);
  }
  function setLoading(isLoading, text){
    const loader = $('loader');
    loader.style.display = isLoading ? "flex" : "none";
    loader.setAttribute("aria-busy", String(!!isLoading));
    if(text) $('loaderText').textContent = text;
  }

  function sanitizeUsername(v){
    v = (v||"").trim().replace(/\s+/g,'');
    if(!v) return "";
    if(v.startsWith("https://") || v.startsWith("http://")) {
      const parts = v.split("/").filter(Boolean);
      v = parts[parts.length - 1] || v;
    }
    if(v.startsWith("@")) v = v.slice(1);
    v = v.replace(/[^a-zA-Z0-9._]/g,'');
    return v.toLowerCase();
  }

  // ✅ يعرض اليوزر داخل الصفحة بدون تغيير الـ Title
  function renderDynamicUsername(u){
    const label = $('dynamicUserLabel');
    const crumb = $('crumbTitle');
    if(!u){
      label.textContent = "ابدأ بإدخال @username للحصول على تقرير مخصص.";
      crumb.textContent = "تحليل حساب إنستغرام";
      return;
    }
    label.textContent = `أنت تحلل الآن: @${u} — أكمل الخطوات للحصول على تقرير نهائي.`;
    crumb.textContent = `تحليل حساب إنستغرام (@${u})`;
  }

  // ====== Numbers parsing (Arabic digits + k/m + separators) ======
  const AR_DIGITS = { '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9' };

  function normalizeArabicDigits(s){
    return String(s||"").replace(/[٠-٩]/g, d => AR_DIGITS[d] || d);
  }

  function normalizeDecimalSeparators(s){
    // يدعم الفاصلة العربية والنقطة العربية
    return String(s||"")
      .replace(/،/g, ',')
      .replace(/٫/g, '.')
      .replace(/٬/g, ',');
  }

  function parseOneNumber(token){
    if(!token) return NaN;
    let t = normalizeDecimalSeparators(normalizeArabicDigits(token)).trim();
    if(!t) return NaN;

    // remove spaces
    t = t.replace(/\s+/g,'');

    // detect multiplier: k / ألف / m / مليون
    let mult = 1;

    // Arabic words
    if(/ألف/.test(t)) { mult = 1000; t = t.replace(/ألف/g,''); }
    if(/مليون/.test(t)) { mult = 1000000; t = t.replace(/مليون/g,''); }

    // k/m suffix
    if(/[kK]$/.test(t)) { mult = 1000; t = t.slice(0,-1); }
    if(/[mM]$/.test(t)) { mult = 1000000; t = t.slice(0,-1); }

    // handle 1,234,567
    if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g,'');
    // handle 1.234.567
    if (/^\d{1,3}(\.\d{3})+(\,\d+)?$/.test(t)) t = t.replace(/\./g,'').replace(/,/g,'.');

    // keep digits + dot only
    t = t.replace(/[^\d.]/g,'');
    if(!t) return NaN;

    const n = Number(t);
    if(!Number.isFinite(n)) return NaN;
    return n * mult;
  }

  function parseNums(str){
    if(!str) return [];
    let s = normalizeDecimalSeparators(normalizeArabicDigits(str));
    const tokens = s.split(/[\n\r\t]+|(?:\s*,\s*)|(?:\s{2,})/);
    const out = [];
    for (let raw of tokens){
      const n = parseOneNumber(raw);
      if(Number.isFinite(n)) out.push(n);
    }
    return out;
  }

  function avg(arr){ return arr.length ? (arr.reduce((a,b)=>a+b,0) / arr.length) : 0; }
  function clamp(n,min,max){ return Math.max(min, Math.min(max,n)); }
  function fmt(n){ return Number(n||0).toLocaleString('ar'); }

  function scoreLabel(score){
    if(score>=85) return "ممتاز";
    if(score>=70) return "قوي";
    if(score>=55) return "متوسط";
    return "ضعيف";
  }
  function scoreGradient(score){
    if(score>=75) return "linear-gradient(135deg, rgba(34,197,94,.95), rgba(56,189,248,.65))";
    if(score>=55) return "linear-gradient(135deg, rgba(250,204,21,.95), rgba(56,189,248,.45))";
    return "linear-gradient(135deg, rgba(239,68,68,.95), rgba(56,189,248,.35))";
  }

  function benchmarks(type){
    if(type === "model") return {min:2.5, max:4.5, note:"للموديلز/الفاشن عادة 2.5%–4.5% للحسابات الصغيرة والمتوسطة."};
    if(type === "creator") return {min:1.8, max:3.8, note:"لصناع المحتوى عادة 1.8%–3.8% حسب المجال والحجم."};
    return {min:1.2, max:3.0, note:"للمتاجر عادة 1.2%–3.0% (يزيد مع UGC/Reviews)."};
  }

  function calcScore(type, er, commentRate){
    const b = benchmarks(type);
    const norm = clamp((er - b.min) / (b.max - b.min), 0, 1);
    let score = Math.round(35 + norm * 60);
    if(commentRate >= 0.12) score += 3;
    if(commentRate < 0.05) score -= 6;
    return clamp(score, 0, 100);
  }

  function verdictFrom(type, er, commentRate){
    if(type==="model"){
      if(er>=4 && commentRate>=0.12) return "جاهز للتعاون بقوة ✅";
      if(er>=3) return "جاهز للتعاون (متوسط) ✅";
      if(er>=1.8) return "يحتاج تحسين قبل التعاون ⚠️";
      return "غير جاهز للتعاون حاليًا ❌";
    }
    if(type==="creator"){
      if(er>=3.5) return "قابل للنمو بسرعة ✅";
      if(er>=2.2) return "نمو جيد لكن غير ثابت ⚠️";
      return "يحتاج إعادة ضبط ❌";
    }
    if(er>=2.8 && commentRate>=0.08) return "جيد للبيع (مع تحسين التحويل) ✅";
    if(er>=1.6) return "متوسط — محتوى ترويجي زائد ⚠️";
    return "ضعيف — يحتاج تغيير محتوى ❌";
  }

  function diagnosisPack(type, goal, er, commentRate){
    let diagnosis="", plan="", bullets=[], recs=[];

    if(type==="model"){
      if(er>=4 && commentRate>=0.12){
        diagnosis="حسابك قوي بصريًا + تفاعل حواري جيد. هذا يجعل البراندات تثق بالحساب أكثر.";
        plan="الأسبوع القادم: 3 Reels (BTS + Pose Tutorial + Before/After) + سؤال واضح في نهاية كل Reel.";
        bullets=["ثبت الهوية البصرية (ألوان/إضاءة/ستايل).","رد خلال أول ساعة على التعليقات.","Story Poll يومي لرفع التعليقات."];
        recs=["Reel: BTS كواليس + سؤال.","Reel: 3 بوزات + CTA حفظ.","Reel: Before/After + CTA تعليق."];
      } else if(er>=3){
        diagnosis="حسابك جذاب بصريًا والتفاعل جيد، لكن التعليقات تحتاج دفع أقوى ليظهر التفاعل كـ(Community) وليس لايك فقط.";
        plan="كل منشور ينتهي بسؤال A/B + رد خلال أول ساعة.";
        bullets=["التعليقات أهم من اللايك للتعاون.","سؤال اختيار A/B أفضل من سؤال عام.","ثبت توقيتين نشر لمدة 14 يوم."];
        recs=["CTA: أي لوك أفضل A أم B؟","CTA: اختر 1/2 بالتعليقات.","Story: سؤال + نتائج."];
      } else if(er>=1.8){
        diagnosis="التفاعل متوسط؛ غالبًا الـHook ضعيف أو النشر غير ثابت، مما يقلل فرص التعاون.";
        plan="5 Reels قصيرة (7–10 ثوان) مع Hook نصّي على الشاشة + CTA حفظ/تعليق.";
        bullets=["الـHook أول ثانيتين هو الفارق.","استخدم نص واضح على الفيديو.","انشر 4–5 مرات أسبوعيًا."];
        recs=["Reel: 3 بوزات سريعة + نص.","Carousel: أفضل 5 لقطات.","Story: تصويت يومي."];
      } else {
        diagnosis="التفاعل منخفض؛ قبل التعاون نحتاج رفع الوصول عبر محتوى قابل للحفظ والمشاركة.";
        plan="14 يوم: Reel يوميًا + Story سؤال يوميًا + Carousel قيمة مرتين أسبوعيًا.";
        bullets=["ابتعد عن النشر العشوائي.","ابنِ سلسلة أسبوعية ثابتة.","ركز على المحتوى القابل للحفظ."];
        recs=["Reel يومي: قبل/بعد أو كواليس.","Carousel مرتين: إضاءة/بوز/ستايل.","Story: سؤال + Poll."];
      }
    }

    if(type==="creator"){
      if(er>=3.5){
        diagnosis="تفاعل قوي؛ الأفضل الآن تثبيت نوعين محتوى وتكرارهما لتحويل التفاعل إلى نمو مستمر.";
        plan="7 أيام: Reel يوميًا + Carousel قيمة يومين + Story تصويت يوميًا.";
        bullets=["كرر أفضل صيغة محتوى بدل التشتت.","CTA حفظ يرفع الانتشار.","اختبر توقيتين فقط."];
        recs=["Reel: Hook قوي + فكرة واحدة.","Carousel: قائمة/خطوات قابلة للحفظ.","Story: سؤال/تصويت."];
      } else if(er>=2.2){
        diagnosis="نتائج جيدة لكن تحتاج نظام نشر + CTA أقوى لرفع التعليقات والحفظ.";
        plan="7 أيام: 4 Reels + 2 Carousel + سؤال مباشر + الرد خلال أول ساعة.";
        bullets=["CTA واحد واضح لكل منشور.","لا تغيّر النيش كل يوم.","اختبر شهرًا كاملًا."];
        recs=["4 Reels: خطأ شائع + حل.","2 Carousel: قيمة قابلة للحفظ.","Story: سؤال يومي."];
      } else {
        diagnosis="التفاعل ضعيف مقارنة بالمنافسين؛ غالبًا المشكلة في Hook أو نوع محتوى غير مناسب.";
        plan="14 يوم: Reels قصيرة قابلة للمشاركة + CTA حفظ + توقيتين ثابتين.";
        bullets=["ابدأ من مشكلة الجمهور لا من نفسك.","اختصر: 7–12 ثانية.","نص واضح على الشاشة."];
        recs=["Reel يومي: قبل/بعد أو نقطة واحدة.","Carousel: أخطاء شائعة أسبوعيًا.","Story: سؤال يومي."];
      }
    }

    if(type==="store"){
      if(er>=2.8 && commentRate>=0.08){
        diagnosis="التفاعل جيد — ممتاز. لكن المبيعات تحتاج (حل مشكلة + إثبات + عرض) وليس عروض فقط.";
        plan="الأسبوع القادم: 3 قيمة + 1 عرض + 2 Story FAQ + CTA واضح (اطلب/DM).";
        bullets=["ادمج UGC/Reviews لرفع الثقة.","CTA واضح (اطلب الآن/DM).","قلّل العروض المباشرة."];
        recs=["Carousel: مشكلة/حل + المنتج.","Reel: مراجعة عميل.","Story: FAQ."];
      } else if(er>=1.6){
        diagnosis="التفاعل متوسط؛ الناس تشاهد لكن لا تتفاعل لأن المحتوى ترويجي أكثر من التعليمي.";
        plan="2 Carousel تعليمية + 2 Reels تجربة/مراجعة + عرض واحد فقط.";
        bullets=["بدّل “اشترِ الآن” بـ “هذه مشكلة وحلها”.","UGC دليل أقوى من إعلان.","Story يومي أفضل من منشور بيع."];
        recs=["Reel: قبل/بعد نتيجة.","Carousel: دليل اختيار/مقارنة.","Story: أسئلة + إجابات."];
      } else {
        diagnosis="التفاعل منخفض؛ قبل البيع يجب بناء ثقة عبر قيمة + UGC + مراجعات.";
        plan="14 يوم: يومين قيمة + يوم UGC/Review + يوم Reel شرح + Story أسئلة يوميًا.";
        bullets=["ابنِ ثقة قبل الطلب.","محتوى مفيد لا دعائي.","ثبّت جدول أسبوعين."];
        recs=["UGC/Review مرتين أسبوعيًا.","Carousel قيمة مرتين.","Reel شرح 3 مرات."];
      }
    }

    if(goal==="sales") bullets.unshift("للمبيعات: أضف Reviews/UGC + CTA DM/واتساب مرة أسبوعيًا.");
    else if(goal==="followers") bullets.unshift("لزيادة المتابعين: ركّز على محتوى قابل للمشاركة + CTA متابعة واضح.");
    else bullets.unshift("لرفع التفاعل: سؤال واضح + CTA حفظ/تعليق + رد سريع أول ساعة.");

    return {diagnosis, plan, bullets, recs};
  }

  async function copyText(txt){
    try{ await navigator.clipboard.writeText(txt); toast("تم نسخ التقرير ✅"); }
    catch(e){ alert("تعذر النسخ تلقائيًا. انسخ يدويًا:\n\n" + txt); }
  }

  function setMeter(score){
    const fill = $('meterFill');
    fill.style.width = score + "%";
    fill.style.background = scoreGradient(score);
  }

  window.addEventListener('DOMContentLoaded', ()=>{
    const form = $('analyzerForm');

    $('username').addEventListener('input', ()=>{
      const u = sanitizeUsername($('username').value);
      renderDynamicUsername(u);
    });

    form.addEventListener('submit', (e)=>{
      e.preventDefault();
      clearError(); clearWarn();

      const u = sanitizeUsername($('username').value);
      if(!u){ showError("اكتب اسم مستخدم صحيح مثل: @marketapro"); return; }
      renderDynamicUsername(u);

      setLoading(true, "جارٍ تجهيز التحليل…");
      setTimeout(()=> setLoading(true, "جارٍ تجهيز المقارنة حسب نوع الحساب…"), 520);

      setTimeout(()=>{
        setLoading(false);
        $('confirmBox').style.display = "block";
        setStep(2);
        toast("تم تجهيز التحليل — أكمل البيانات للحصول على تقرير دقيق ✅");
        window.scrollTo({top: $('confirmBox').offsetTop - 90, behavior:"smooth"});
      }, 1100);
    });

    $('resetBtn').addEventListener('click', ()=>{
      $('username').value="";
      $('followers').value="";
      $('likesList').value="";
      $('commentsList').value="";
      $('goal').value="engagement";
      $('confirmBox').style.display="none";
      $('report').style.display="none";
      setLoading(false);
      clearError(); clearWarn();
      setStep(1);
      toast("تم المسح");
      renderDynamicUsername("");
      window.__reportText = "";
      window.scrollTo({top:0, behavior:"smooth"});
    });

    $('buildReportBtn').addEventListener('click', ()=>{
      clearError(); clearWarn();

      const u = sanitizeUsername($('username').value);
      const type = $('acctType').value;
      const goal = $('goal').value;

      const followers = parseOneNumber($('followers').value);
      const likesArr = parseNums($('likesList').value);
      const comArr = parseNums($('commentsList').value);

      if(!u){ showError("اسم المستخدم غير صحيح."); return; }
      if(!Number.isFinite(followers) || followers < 1){ showError("أدخل عدد المتابعين (يدعم 12.5k / ١٢٫٥k)."); return; }
      if(likesArr.length < 6){ showError("أدخل لايكات 6 منشورات على الأقل."); return; }
      if(comArr.length < 6){ showError("أدخل تعليقات 6 منشورات على الأقل."); return; }

      // ✅ مساواة القوائم تلقائياً
      const n = Math.min(likesArr.length, comArr.length);
      if(likesArr.length !== comArr.length){
        showWarn(`تنبيه: عدد اللايكات (${likesArr.length}) لا يساوي عدد التعليقات (${comArr.length}). سيتم استخدام أول ${n} منشورًا للحصول على تحليل عادل.`);
      }
      const likesUse = likesArr.slice(0, n);
      const comUse = comArr.slice(0, n);

      const avgLikes = avg(likesUse);
      const avgComments = avg(comUse);

      // حماية من إدخال خاطئ
      if(avgLikes > 0 && avgComments > avgLikes * 0.6){
        showError("الأرقام تبدو غير منطقية: متوسط التعليقات مرتفع جدًا مقارنة باللايكات.\nتأكد أنك أدخلت التعليقات كأرقام منفصلة (مثل: 12, 8, 15...)");
        return;
      }

      const likeRate = (avgLikes / followers) * 100;
      const commentRate = (avgComments / followers) * 100;
      const er = likeRate + commentRate;

      const b = benchmarks(type);
      const score = calcScore(type, er, commentRate);
      const verdict = verdictFrom(type, er, commentRate);
      const pack = diagnosisPack(type, goal, er, commentRate);

      $('reportTitle').textContent = `@${u} — معدل التفاعل: ${er.toFixed(2)}%`;
      $('benchmarkText').textContent = `${b.note} (نتيجتك: ${er.toFixed(2)}%)`;
      $('verdict').textContent = verdict;
      $('scoreText').textContent = `Score: ${score}/100 — ${scoreLabel(score)}`;
      setMeter(score);

      $('kFollowers').textContent = fmt(Math.round(followers));
      $('kAvgLikes').textContent = fmt(Math.round(avgLikes));
      $('kAvgComments').textContent = fmt(Math.round(avgComments));
      $('kER').textContent = er.toFixed(2) + "%";

      $('diagnosis').textContent = pack.diagnosis;
      $('plan').textContent = pack.plan;

      const bullets = $('bullets'); bullets.innerHTML="";
      pack.bullets.slice(0,6).forEach(x=>{ const li=document.createElement('li'); li.textContent=x; bullets.appendChild(li); });

      const recs = $('recs'); recs.innerHTML="";
      pack.recs.slice(0,6).forEach(x=>{ const li=document.createElement('li'); li.textContent=x; recs.appendChild(li); });

      $('report').style.display = "block";
      setStep(3);
      toast("تم إنشاء التقرير النهائي ✅");
      window.scrollTo({top: $('report').offsetTop - 85, behavior:"smooth"});

      window.__reportText =
`MarketAPro — تحليل حساب إنستغرام (@${u})

نوع الحساب: ${type==="model"?"موديل/فاشن":type==="creator"?"صانع محتوى":"متجر"}
الهدف: ${goal==="sales"?"مبيعات/تعاونات":goal==="followers"?"زيادة المتابعين":"زيادة التفاعل"}

المتابعون: ${Math.round(followers)}
عدد المنشورات المستخدمة في التحليل: ${n}

متوسط لايكات: ${Math.round(avgLikes)}
متوسط تعليقات: ${Math.round(avgComments)}
Engagement: ${er.toFixed(2)}%

الحكم: ${verdict}
Score: ${score}/100 — ${scoreLabel(score)}

التشخيص:
${pack.diagnosis}

خطوة الأسبوع القادم:
${pack.plan}

نقاط مهمة:
- ${pack.bullets.slice(0,6).join("\n- ")}

روابط:
- أفضل وقت للنشر: https://marketapro.com/tools/best-time-to-post-instagram/
- حاسبة التفاعل: https://marketapro.com/tools/instagram-engagement-calculator/
`;
    });

    $('copyBtn').addEventListener('click', ()=>{
      if(!window.__reportText){ showError("أنشئ التقرير أولًا ثم انسخه."); return; }
      copyText(window.__reportText);
    });

    renderDynamicUsername("");
  });
