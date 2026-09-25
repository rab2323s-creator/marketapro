(function(){
  "use strict";

  const $ = (id)=>document.getElementById(id);
  const state = { mode:"single", rows:[], followers:0, summary:null };

  function toast(msg){
    const el=$("toast");
    if(!el) return;
    el.textContent=msg;
    el.style.display="block";
    clearTimeout(window.__tkToast);
    window.__tkToast=setTimeout(()=>el.style.display="none",2200);
  }

  function normalizeDigits(input){
    return String(input ?? "")
      .replace(/[٠١٢٣٤٥٦٧٨٩]/g, d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d))
      .replace(/[۰۱۲۳۴۵۶۷۸۹]/g, d=>"۰۱۲۳۴۵۶۷۸۹".indexOf(d))
      .replace(/،/g,",")
      .trim();
  }

  function parseHumanNumber(input){
    if(input===null || input===undefined) return 0;
    let s=normalizeDigits(input).toLowerCase().replace(/\s+/g," ").trim();
    if(!s) return 0;

    let mult=1;
    if(/مليار|b\b/.test(s)){ mult=1e9; s=s.replace(/مليار|b\b/g,""); }
    else if(/مليون|m\b/.test(s)){ mult=1e6; s=s.replace(/مليون|m\b/g,""); }
    else if(/ألف|الف|k\b/.test(s)){ mult=1e3; s=s.replace(/ألف|الف|k\b/g,""); }

    s=s.replace(/[^0-9.,-]/g,"");
    if(s.includes(",") && !s.includes(".")){
      const parts=s.split(",");
      if(parts.length===2 && parts[1].length<=2) s=parts.join(".");
      else s=parts.join("");
    } else {
      s=s.replace(/,/g,"");
    }

    const n=parseFloat(s);
    return Number.isFinite(n) && n>=0 ? n*mult : 0;
  }

  function fmt(n, decimals=0){
    const v=Number(n);
    if(!Number.isFinite(v)) return "—";
    return new Intl.NumberFormat("ar",{
      maximumFractionDigits:decimals,
      minimumFractionDigits:decimals
    }).format(v);
  }

  function pct(n){
    if(!Number.isFinite(n)) return "—";
    const d = n < 0.1 ? 3 : n < 10 ? 2 : 1;
    return fmt(n,d)+"%";
  }

  function median(values){
    const a=values.filter(Number.isFinite).slice().sort((x,y)=>x-y);
    if(!a.length) return 0;
    const m=Math.floor(a.length/2);
    return a.length%2 ? a[m] : (a[m-1]+a[m])/2;
  }

  function mean(values){
    const a=values.filter(Number.isFinite);
    return a.length ? a.reduce((x,y)=>x+y,0)/a.length : 0;
  }

  function sum(values){ return values.reduce((a,b)=>a+(Number(b)||0),0); }

  function parseBatch(text){
    return normalizeDigits(text)
      .split(/\r?\n/)
      .map(s=>s.trim())
      .filter(Boolean)
      .map((line,i)=>{
        const parts=line.split(/\t|\||;|,/).map(s=>s.trim()).filter((s,idx,arr)=>!(s==="" && idx===arr.length-1));
        const nums=parts.map(parseHumanNumber);
        return {
          index:i+1,
          views:nums[0]||0,
          likes:nums[1]||0,
          comments:nums[2]||0,
          shares:nums[3]||0,
          saves:nums[4]||0
        };
      })
      .filter(r=>r.views>0);
  }

  function singleRow(){
    return [{
      index:1,
      views:parseHumanNumber($("views").value),
      likes:parseHumanNumber($("likes").value),
      comments:parseHumanNumber($("comments").value),
      shares:parseHumanNumber($("shares").value),
      saves:parseHumanNumber($("saves").value)
    }];
  }

  function enrich(row){
    const standard=row.likes+row.comments+row.shares;
    const extended=standard+row.saves;
    return {
      ...row,
      standard,
      extended,
      erViews:row.views>0 ? (standard/row.views)*100 : 0,
      erViewsExtended:row.views>0 ? (extended/row.views)*100 : 0,
      likeRate:row.views>0 ? (row.likes/row.views)*100 : 0,
      commentRate:row.views>0 ? (row.comments/row.views)*100 : 0,
      shareRate:row.views>0 ? (row.shares/row.views)*100 : 0,
      saveRate:row.views>0 ? (row.saves/row.views)*100 : 0
    };
  }

  function detectOutlier(rows){
    if(rows.length<5) return null;
    const medViews=median(rows.map(r=>r.views));
    if(!medViews) return null;
    const sorted=rows.slice().sort((a,b)=>b.views-a.views);
    const top=sorted[0];
    if(top.views >= medViews*3){
      const without=rows.filter(r=>r!==top);
      return {
        top,
        medViews,
        erWithout:weightedER(without),
        avgViewsWithout:mean(without.map(r=>r.views))
      };
    }
    return null;
  }

  function weightedER(rows){
    const views=sum(rows.map(r=>r.views));
    const interactions=sum(rows.map(r=>r.standard));
    return views>0 ? interactions/views*100 : 0;
  }

  function diagnosis(summary){
    const bits=[];
    if(summary.weightedER>=8) bits.push("التفاعل بالنسبة للمشاهدات مرتفع جدًا في هذه العينة.");
    else if(summary.weightedER>=4) bits.push("التفاعل بالنسبة للمشاهدات قوي في هذه العينة.");
    else if(summary.weightedER>=2) bits.push("التفاعل بالنسبة للمشاهدات متوسط ويستحق المقارنة بعينات سابقة من الحساب.");
    else bits.push("التفاعل بالنسبة للمشاهدات منخفض نسبيًا في هذه العينة؛ راقب الخطاف، الاحتفاظ، ودعوة التفاعل.");

    if(summary.shareRate>=0.5) bits.push("نسبة المشاركات بارزة، وهذا يشير إلى أن المحتوى قابل للتداول.");
    else if(summary.shareRate<0.1) bits.push("المشاركات منخفضة مقارنة بالمشاهدات؛ جرّب محتوى أكثر قابلية للإرسال أو المشاركة.");

    if(summary.commentRate>=0.2) bits.push("التعليقات قوية نسبيًا، ما يدل على قدرة المحتوى على تحفيز النقاش.");
    if(summary.saveRate>=0.5) bits.push("الحفظ قوي؛ المحتوى يبدو مرجعيًا أو مفيدًا للعودة إليه.");

    if(summary.followers>0){
      if(summary.reachRatio>=3) bits.push("متوسط المشاهدات يتجاوز عدد المتابعين بعدة مرات، ما يعني أن الوصول يتخطى قاعدة المتابعين بوضوح.");
      else if(summary.reachRatio<0.5) bits.push("متوسط المشاهدات أقل من نصف عدد المتابعين؛ لا تحكم على ER وحده وراجع الوصول والاحتفاظ.");
    }
    return bits;
  }

  function calculate(){
    $("formMessage").textContent="";
    const followers=parseHumanNumber($("followers").value);
    const rawRows=state.mode==="single" ? singleRow() : parseBatch($("batchData").value);

    if(!rawRows.length || rawRows.some(r=>!r.views)){
      $("formMessage").textContent="أدخل عدد المشاهدات لفيديو واحد على الأقل.";
      return;
    }
    if(rawRows.length>100){
      $("formMessage").textContent="حلّل حتى 100 فيديو في العملية الواحدة.";
      return;
    }

    const rows=rawRows.map(enrich);
    const totalViews=sum(rows.map(r=>r.views));
    const totalStandard=sum(rows.map(r=>r.standard));
    const totalSaves=sum(rows.map(r=>r.saves));
    const weighted=totalViews ? totalStandard/totalViews*100 : 0;
    const medianER=median(rows.map(r=>r.erViews));
    const avgViews=mean(rows.map(r=>r.views));
    const avgStandard=mean(rows.map(r=>r.standard));
    const erFollowers=followers>0 ? avgStandard/followers*100 : NaN;
    const reachRatio=followers>0 ? avgViews/followers : NaN;

    const summary={
      rows, followers, totalViews, totalStandard, totalSaves,
      weightedER:weighted,
      medianER,
      avgViews,
      erFollowers,
      reachRatio,
      likeRate: totalViews ? sum(rows.map(r=>r.likes))/totalViews*100 : 0,
      commentRate: totalViews ? sum(rows.map(r=>r.comments))/totalViews*100 : 0,
      shareRate: totalViews ? sum(rows.map(r=>r.shares))/totalViews*100 : 0,
      saveRate: totalViews ? totalSaves/totalViews*100 : 0,
      outlier:detectOutlier(rows)
    };
    state.rows=rows;
    state.followers=followers;
    state.summary=summary;
    render(summary);
  }

  function render(s){
    $("emptyState").hidden=true;
    $("resultContent").hidden=false;
    $("detailsSection").hidden=false;

    $("erViews").textContent=pct(s.weightedER);
    $("erFollowers").textContent=Number.isFinite(s.erFollowers)?pct(s.erFollowers):"أدخل المتابعين";
    $("medianER").textContent=pct(s.medianER);
    $("avgViews").textContent=fmt(s.avgViews);
    $("reachRatio").textContent=Number.isFinite(s.reachRatio)?fmt(s.reachRatio,2)+"×":"—";
    $("likeRate").textContent=pct(s.likeRate);
    $("commentRate").textContent=pct(s.commentRate);
    $("shareRate").textContent=pct(s.shareRate);
    $("saveRate").textContent=s.totalSaves>0?pct(s.saveRate):"—";

    const diag=diagnosis(s);
    $("diagnosis").innerHTML="<strong>قراءة النتيجة</strong><ul style=\"margin:8px 0 0;line-height:1.9\">"+
      diag.map(x=>"<li>"+escapeHtml(x)+"</li>").join("")+"</ul>";

    const ob=$("outlierBox");
    if(s.outlier){
      ob.hidden=false;
      ob.innerHTML="<strong>تنبيه: فيديو شاذ يؤثر في المتوسط</strong><p style=\"margin:7px 0 0\">"+
        "أعلى فيديو حقق "+fmt(s.outlier.top.views)+" مشاهدة، أي أكثر من 3× وسيط المشاهدات ("+fmt(s.outlier.medViews)+"). "+
        "معدل التفاعل الموزون بعد استبعاده مؤقتًا للمقارنة يصبح <strong>"+pct(s.outlier.erWithout)+"</strong>. "+
        "لا نحذف الفيديو من التقرير؛ نعرض هذه القراءة فقط حتى لا يخدعك المتوسط.</p>";
    }else{
      ob.hidden=true; ob.textContent="";
    }

    const tbody=$("videoRows");
    tbody.textContent="";
    s.rows.forEach(r=>{
      const tr=document.createElement("tr");
      [r.index,fmt(r.views),fmt(r.likes),fmt(r.comments),fmt(r.shares),fmt(r.saves),pct(r.erViews)].forEach(v=>{
        const td=document.createElement("td"); td.textContent=v; tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    history.replaceState(null,"","#results");
    toast("تم حساب معدل التفاعل");
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }

  function setMode(mode){
    state.mode=mode;
    const single=mode==="single";
    $("panel-single").hidden=!single;
    $("panel-batch").hidden=single;
    $("tab-single").setAttribute("aria-selected",String(single));
    $("tab-batch").setAttribute("aria-selected",String(!single));
    $("formMessage").textContent="";
  }

  function clearAll(){
    ["followers","views","likes","comments","shares","saves","batchData"].forEach(id=>$(id).value="");
    $("resultContent").hidden=true;
    $("emptyState").hidden=false;
    $("detailsSection").hidden=true;
    $("videoRows").textContent="";
    $("formMessage").textContent="";
    history.replaceState(null,"",location.pathname);
    state.rows=[]; state.summary=null;
    toast("تم المسح");
  }

  function loadExample(){
    $("followers").value="25K";
    if(state.mode==="single"){
      $("views").value="52K"; $("likes").value="3400"; $("comments").value="145"; $("shares").value="310"; $("saves").value="190";
    }else{
      $("batchData").value=[
        "52000 | 3400 | 145 | 310 | 190",
        "44000 | 2700 | 102 | 195 | 133",
        "68000 | 4200 | 178 | 390 | 240",
        "39000 | 2200 | 84 | 146 | 95",
        "210000 | 12800 | 520 | 1900 | 1100",
        "47000 | 2950 | 120 | 230 | 150"
      ].join("\n");
    }
    calculate();
  }

  function reportText(){
    const s=state.summary;
    if(!s) return "";
    const out=[
      "MarketAPro — حاسبة معدل التفاعل على تيك توك",
      "عدد الفيديوهات: "+s.rows.length,
      "إجمالي المشاهدات: "+fmt(s.totalViews),
      "ER حسب المشاهدات: "+pct(s.weightedER),
      "Median ER: "+pct(s.medianER),
      "متوسط المشاهدات: "+fmt(s.avgViews),
      "نسبة الإعجاب/المشاهدة: "+pct(s.likeRate),
      "نسبة التعليق/المشاهدة: "+pct(s.commentRate),
      "نسبة المشاركة/المشاهدة: "+pct(s.shareRate)
    ];
    if(s.totalSaves>0) out.push("نسبة الحفظ/المشاهدة: "+pct(s.saveRate));
    if(Number.isFinite(s.erFollowers)) out.push("ER حسب المتابعين: "+pct(s.erFollowers));
    if(Number.isFinite(s.reachRatio)) out.push("متوسط المشاهدات ÷ المتابعين: "+fmt(s.reachRatio,2)+"×");
    out.push("الرابط: https://marketapro.com/tools/حاسبة-معدل-التفاعل-تيك-توك/");
    return out.join("\n");
  }

  async function copyReport(){
    if(!state.summary){ toast("احسب النتيجة أولًا"); return; }
    const txt=reportText();
    try{ await navigator.clipboard.writeText(txt); toast("تم نسخ التقرير"); }
    catch(e){ window.prompt("انسخ التقرير:",txt); }
  }

  function downloadCSV(){
    if(!state.summary){ toast("احسب النتيجة أولًا"); return; }
    const lines=[["video","views","likes","comments","shares","saves","er_by_views_percent"]];
    state.rows.forEach(r=>lines.push([r.index,r.views,r.likes,r.comments,r.shares,r.saves,r.erViews.toFixed(4)]));
    const csv="\uFEFF"+lines.map(row=>row.join(",")).join("\n");
    const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url; a.download="marketapro-tiktok-engagement.csv"; document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast("تم تنزيل CSV");
  }

  $("tab-single").addEventListener("click",()=>setMode("single"));
  $("tab-batch").addEventListener("click",()=>setMode("batch"));
  $("calculateBtn").addEventListener("click",calculate);
  $("exampleBtn").addEventListener("click",loadExample);
  $("clearBtn").addEventListener("click",clearAll);
  $("copyBtn").addEventListener("click",copyReport);
  $("csvBtn").addEventListener("click",downloadCSV);

  document.addEventListener("keydown",(e)=>{
    if((e.ctrlKey||e.metaKey) && e.key==="Enter") calculate();
  });
})();