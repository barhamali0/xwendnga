(function(){
"use strict";

if(window.pdfjsLib){
  pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";
}

var books=[];
var vocab=[];
var currentBook=null;
var currentPage=0;
var currentWord="";
var currentLang="en";
var filter="all";
var query="";
var readerFont=20;
var siteTheme="cyan";
var readerTheme="paper";
var music=[];
var musicIndex=-1;
var musicVolume=.32;
var speechVolume=.85;
var speechState="stopped";
var speechUtterance=null;
var speechTimer=null;
var speechWordIndex=0;
var speechRate=0.85; 
var translatedPages={};
var pageKurdish=false;

var currentPdfDoc=null;
var viewMode='canvas'; 

var CATEGORIES=["گشتی","زمان","ئەدەب","مێژوو","زانست","فەلسەفە","ئایین","ئینگلیزی"];

var SITE_THEMES={
 cyan:{name:"شینی ئاسمانی",a:"#35bbff",b:"#7b61ff",bg:"#07111f",bg2:"#0d182a",surface:"#111f34",surface2:"#182943",line:"#29405d"},
 violet:{name:"مۆری",a:"#8b6cff",b:"#d35cff",bg:"#0b081b",bg2:"#160f2a",surface:"#1d1735",surface2:"#282047",line:"#47386a"},
 emerald:{name:"سەوزی",a:"#22c98b",b:"#0ca6a0",bg:"#061611",bg2:"#0c241d",surface:"#102b23",surface2:"#173b30",line:"#2b5849"},
 sunset:{name:"خۆرئاوابوون",a:"#ff8a4c",b:"#ff4f81",bg:"#190b09",bg2:"#291410",surface:"#351914",surface2:"#48231d",line:"#693b30"},
 ruby:{name:"سووری",a:"#ff536d",b:"#c93dff",bg:"#18070d",bg2:"#280d19",surface:"#361421",surface2:"#451b2d",line:"#643247"},
 royal:{name:"شینی قووڵ",a:"#4c7dff",b:"#36c4ff",bg:"#061029",bg2:"#0b1940",surface:"#10204a",surface2:"#17295a",line:"#304a80"},
 gold:{name:"زێڕی",a:"#f2bf4a",b:"#ff8554",bg:"#160f05",bg2:"#281809",surface:"#34230e",surface2:"#452d12",line:"#66491f"},
 rose:{name:"پەمەیی",a:"#f05bd5",b:"#ff7b8e",bg:"#150714",bg2:"#250e22",surface:"#34152f",surface2:"#451c3f",line:"#623457"},
 ocean:{name:"دەریایی",a:"#20d6d6",b:"#3a7bff",bg:"#041216",bg2:"#06242b",surface:"#0c3038",surface2:"#10434e",line:"#255b67"},
 graphite:{name:"گرافایت",a:"#aab7c8",b:"#62728a",bg:"#0a0e13",bg2:"#141923",surface:"#1c242e",surface2:"#27303d",line:"#3c4858"},
 lime:{name:"لایمی",a:"#a7df45",b:"#24c68a",bg:"#0d1605",bg2:"#17260a",surface:"#223613",surface2:"#30471b",line:"#4d652b"},
 midnight:{name:"میدناو",a:"#607dff",b:"#8b5cf6",bg:"#050817",bg2:"#0a1025",surface:"#101833",surface2:"#182344",line:"#2f4069"}
};

var READER_THEMES={
 paper:{name:"سپی",bg:"#f4f6f9",paper:"#ffffff",fg:"#1d2a3d",toolbar:"#ffffff"},
 cream:{name:"ڪرێمی",bg:"#eee5d1",paper:"#fff9e7",fg:"#403728",toolbar:"#f7edd8"},
 mint:{name:"سەوزی کاڵ",bg:"#dfece5",paper:"#f4fbf7",fg:"#203c31",toolbar:"#edf7f1"},
 sky:{name:"ئاسمانی",bg:"#dceef4",paper:"#f2fbff",fg:"#24414b",toolbar:"#eaf7fa"},
 rose:{name:"پەمەیی",bg:"#f0dfe2",paper:"#fff5f6",fg:"#4a2d33",toolbar:"#fff0f2"},
 lavender:{name:"مۆری",bg:"#e6def4",paper:"#fbf8ff",fg:"#332b46",toolbar:"#f2ecfb"},
 sand:{name:"خۆڵەمێشی",bg:"#e7ded2",paper:"#fbf4eb",fg:"#493b2e",toolbar:"#f4ebdf"},
 forest:{name:"دارستان",bg:"#dee8de",paper:"#f5fbf3",fg:"#213525",toolbar:"#edf6eb"},
 sepia:{name:"ڪتێبی کۆن",bg:"#e6dbc6",paper:"#f7eddb",fg:"#4a3925",toolbar:"#f0e4d0"},
 slate:{name:"سڵەیت",bg:"#dce1e7",paper:"#eef1f5",fg:"#263341",toolbar:"#e8ecf1"},
 night:{name:"شەو",bg:"#0b1420",paper:"#101b2c",fg:"#e9f2fc",toolbar:"#122035"},
 black:{name:"ڕەش",bg:"#050505",paper:"#0b0b0b",fg:"#f1f1f1",toolbar:"#101010"}
};

function $(id){return document.getElementById(id);}
function toast(t){var x=$("toast");x.textContent=t;x.className="toast show";clearTimeout(toast._t);toast._t=setTimeout(function(){x.className="toast"},1800);}
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"})[c];});}

function updateTelegramBtn(){
  var btn=$("telegramBtn");
  if(!btn)return;
  var readerOpen=$("reader")&&$("reader").classList.contains("show");
  var sheetOpen=document.querySelector(".sheet.open, .back.open");
  var activeNav=document.querySelector(".nav.active");
  var isHome=activeNav&&activeNav.getAttribute("data-nav")==="home";

  if(isHome && !readerOpen && !sheetOpen){
    btn.style.display="flex";
  } else {
    btn.style.display="none";
  }
}

function openSheet(back,sheet){back.classList.add("open");sheet.classList.add("open");updateTelegramBtn();}
function closeSheet(back,sheet){back.classList.remove("open");sheet.classList.remove("open");updateTelegramBtn();}

function updateThemeBadges(){
  var st=SITE_THEMES[siteTheme]||SITE_THEMES.cyan;
  var rt=READER_THEMES[readerTheme]||READER_THEMES.paper;
  if($("siteThemeLabel")) $("siteThemeLabel").textContent=st.name;
  if($("siteThemeDot")) $("siteThemeDot").style.background=st.a;
  if($("readerThemeLabel")) $("readerThemeLabel").textContent=rt.name;
  if($("readerThemeDot")) $("readerThemeDot").style.background=rt.bg;
}

function setSiteTheme(k){
  var t=SITE_THEMES[k]||SITE_THEMES.cyan;
  siteTheme=k;
  var r=document.documentElement;
  r.style.setProperty("--a",t.a);r.style.setProperty("--b",t.b);r.style.setProperty("--accent",t.a);
  r.style.setProperty("--bg",t.bg);r.style.setProperty("--bg2",t.bg2);r.style.setProperty("--surface",t.surface);r.style.setProperty("--surface2",t.surface2);r.style.setProperty("--line",t.line);
  try{localStorage.setItem("kh_site_theme",k)}catch(e){}
  renderSiteThemes();
  updateThemeBadges();
}
function applyReaderTheme(){
  var t=READER_THEMES[readerTheme]||READER_THEMES.paper;
  var r=$("reader");
  r.style.setProperty("--reader-bg",t.bg);r.style.setProperty("--paper",t.paper);r.style.setProperty("--reader-fg",t.fg);
  updateThemeBadges();
}
function renderSiteThemes(){
  var box=$("siteThemes"),out="";
  for(var k in SITE_THEMES){var t=SITE_THEMES[k];out+='<button class="theme '+(k===siteTheme?"active":"")+'" data-site-theme="'+k+'" title="'+esc(t.name)+'" style="background:linear-gradient(145deg,'+t.bg2+','+t.bg+')"><i style="background:'+t.a+'"></i><b style="background:linear-gradient(90deg,'+t.a+','+t.b+')"></b></button>';}
  box.innerHTML=out;
}
function renderReaderThemes(){
  var box=$("readerThemes"),out="";
  for(var k in READER_THEMES){var t=READER_THEMES[k];out+='<button class="theme '+(k===readerTheme?"active":"")+'" data-reader-theme="'+k+'" title="'+esc(t.name)+'" style="background:'+t.bg+'"><i style="background:'+t.fg+'"></i><b style="background:'+t.fg+'"></b></button>';}
  box.innerHTML=out;
}

function dbOpen(){
  return new Promise(function(resolve,reject){
    var req=indexedDB.open("kh_reader_v10",1);
    req.onupgradeneeded=function(){if(!req.result.objectStoreNames.contains("books"))req.result.createObjectStore("books",{keyPath:"id"});};
    req.onsuccess=function(){resolve(req.result)};
    req.onerror=function(){reject(req.error)};
  });
}
function dbAll(){
  return dbOpen().then(function(db){return new Promise(function(resolve,reject){var q=db.transaction("books","readonly").objectStore("books").getAll();q.onsuccess=function(){resolve(q.result||[])};q.onerror=function(){reject(q.error)};});});
}
function dbPut(b){
  return dbOpen().then(function(db){return new Promise(function(resolve,reject){var tx=db.transaction("books","readwrite");tx.objectStore("books").put(b);tx.oncomplete=resolve;tx.onerror=function(){reject(tx.error)};});});
}
function dbDel(id){
  return dbOpen().then(function(db){return new Promise(function(resolve,reject){var tx=db.transaction("books","readwrite");tx.objectStore("books").delete(id);tx.oncomplete=resolve;tx.onerror=function(){reject(tx.error)};});});
}

function loadLocal(){
  try{
    var v=localStorage.getItem("kh_vocab");vocab=v?JSON.parse(v):[];
    readerFont=Number(localStorage.getItem("kh_font")||20);
    siteTheme=localStorage.getItem("kh_site_theme")||"cyan";
    readerTheme=localStorage.getItem("kh_reader_theme")||"paper";
  }catch(e){}
}
function detectLang(text){
  var t=String(text||"").slice(0,20000);
  var kuChars=(t.match(/[\u06D5\u06CE\u0695\u06B5\u06A4\u06C6\u06B7\u06F6]/g)||[]).length;
  var faChars=(t.match(/[\u067E\u0686\u0698\u06AF]/g)||[]).length;
  if(kuChars>=2) return "ku";
  if(faChars>=2) return "fa";
  if(/[\u0600-\u06FF]/.test(t)) return "ar";
  return "en";
}

function extractPDF(file){
  return new Promise(function(resolve,reject){
    if(!window.pdfjsLib){reject(new Error("PDF engine"));return;}
    var fr=new FileReader();
    fr.onload=function(){
      try{
        var data=new Uint8Array(fr.result);
        pdfjsLib.getDocument({data:data}).promise.then(function(pdf){
          var pages=[], chain=Promise.resolve();

          for(let i=1;i<=pdf.numPages;i++){
            (function(pageNo){
              chain=chain.then(function(){
                return pdf.getPage(pageNo).then(function(page){
                  return page.getTextContent({
                    normalizeWhitespace:false,
                    disableCombineTextItems:true
                  }).then(function(c){
                    var t = (c.items||[]).map(function(x){return x.str||""}).join(" ").trim();
                    pages.push(t);
                  });
                });
              });
            })(i);
          }

          chain.then(function(){
            resolve({pages:pages,lang:detectLang(pages.join("\n")), pdfData: data});
          }).catch(reject);
        }).catch(reject);
      }catch(e){reject(e)}
    };
    fr.onerror=function(){reject(fr.error)};
    fr.readAsArrayBuffer(file);
  });
}

function addPDF(file){
  if(!file)return;
  toast("PDF خەریڪی خوێندنەوەیە...");
  extractPDF(file).then(function(d){
    var b={
      id:String(Date.now())+"_"+Math.floor(Math.random()*10000),
      title:file.name.replace(/\.pdf$/i,""),
      author:"",
      category:"گشتی",
      isPublished:true,
      pages:d.pages,
      pdfData:d.pdfData, 
      lang:d.lang,
      pageCount:d.pages.length,
      currentPage:0,
      progress:0,
      favorite:false,
      addedAt:Date.now()
    };
    return dbPut(b).then(function(){books.push(b);renderBooks();toast("ڪتێبەڪە زیادڪرا");});
  }).catch(function(e){console.error(e);toast("نەتوانرا PDF بخوێندرێتەوە");});
  $("pdfInput").value="";
}

function filtered(){
  var a=books.slice().sort(function(x,y){return y.addedAt-x.addedAt});
  if(filter==="favorites") a=a.filter(function(x){return x.favorite});
  else if(filter==="recent") a=a.slice(0,8);
  else if(filter!=="all") a=a.filter(function(x){return (x.category||"گشتی")===filter;});

  if(query){
    var q=query.toLowerCase();
    a=a.filter(function(x){return (x.title+" "+(x.author||"")+" "+(x.category||"")).toLowerCase().indexOf(q)>=0;});
  }
  return a;
}

function langName(lang){
  if(lang==="ku") return "ڪوردی";
  if(lang==="fa") return "فارسی";
  if(lang==="ar") return "عەرەبی";
  return "ئینگلیزی";
}

function renderBooks(){
  $("bookCount").textContent=books.length;
  $("wordCount").textContent=vocab.length;
  var a=filtered();
  $("resultHint").textContent=a.length+" ڪتێب";
  if(!a.length){
    $("bookList").innerHTML='<div class="empty" style="text-align:center;padding:30px;color:var(--muted)"><i class="fa-solid fa-book-open" style="font-size:32px;margin-bottom:8px"></i><h3 style="margin:7px 0 3px;color:#dfe8f2;font-size:14px">'+(query?"هیچ ئەنجامێڪ نەدۆزرایەوە":"لەم پۆلەدا هێشتا ڪتێب نییە")+'</h3><div style="font-size:11px">دەتوانیت لە سەرەوە PDF نوێ زیاد بڪەیت.</div></div>';
    return;
  }
  $("bookList").innerHTML=a.map(function(b){
    var p=Math.round((b.progress||0)*100);
    return '<article class="book" data-book="'+esc(b.id)+'"><button class="fav" data-action="fav"><i class="'+(b.favorite?"fa-solid":"fa-regular")+' fa-heart"></i></button><div class="cover"><i class="fa-solid fa-book-bookmark"></i></div><div class="book-main"><div class="book-title">'+esc(b.title)+'</div><div class="book-author">'+esc(b.author||"نووسەری دیارینەکراو")+'</div><div class="meta"><span><i class="fa-regular fa-file-lines"></i> '+b.pageCount+' لاپەڕە</span><span><i class="fa-solid fa-language"></i> '+(langName(b.lang))+'</span><span class="tag-badge">'+esc(b.category||"گشتی")+'</span></div><div class="progress"><span style="width:'+p+'%"></span></div><div class="actions"><button class="small primary" data-action="open-book"><i class="fa-solid fa-book-open"></i> خوێندنەوە</button><button class="small" data-action="del-book"><i class="fa-regular fa-trash-can"></i></button></div></div></article>';
  }).join("");
}

function renderOwnerPanel(){
  $("ownerTotalBooks").textContent=books.length;
  $("ownerPublicBooks").textContent=books.filter(function(b){return b.isPublished!==false;}).length;
  $("ownerPendingBooks").textContent=books.filter(function(b){return b.isPublished===false;}).length;
  $("ownerTotalAudios").textContent=music.length;

  var list=$("ownerBooksList");
  if(!books.length){
    list.innerHTML='<div style="color:var(--muted);font-size:11px;text-align:center;padding:12px">هیچ پەڕتووڪێڪ بۆ بەڕێوەبردن نییە.</div>';
    return;
  }
  list.innerHTML=books.map(function(b){
    return '<div style="background:var(--surface2);border:1px solid var(--line);border-radius:12px;padding:8px 10px;display:flex;align-items:center;justify-content:space-between;gap:8px">'+
      '<div style="min-width:0;flex:1"><strong style="font-size:12px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(b.title)+'</strong>'+
      '<span style="font-size:10px;color:var(--muted)">پۆل: </span>'+
      '<select data-owner-cat="'+esc(b.id)+'" style="font-size:10px;border:1px solid var(--line);background:var(--surface);color:#fff;border-radius:6px;padding:2px 4px">'+
        CATEGORIES.map(function(c){return '<option value="'+esc(c)+'" '+(b.category===c?"selected":"")+'>'+esc(c)+'</option>'}).join("")+
      '</select></div>'+
      '<div style="display:flex;gap:5px">'+
        '<button data-owner-toggle="'+esc(b.id)+'" class="icon-btn" style="width:32px;height:32px;font-size:11px;color:'+(b.isPublished!==false?"#22c98b":"var(--gold)")+'" title="گۆڕینی دۆخ">'+
          '<i class="fa-solid '+(b.isPublished!==false?"fa-globe":"fa-lock")+'"></i>'+
        '</button>'+
        '<button data-owner-del="'+esc(b.id)+'" class="icon-btn" style="width:32px;height:32px;font-size:11px;color:#ff536d" title="سڕینەوە">'+
          '<i class="fa-regular fa-trash-can"></i>'+
        '</button>'+
      '</div>'+
    '</div>';
  }).join("");
}

function toggleFav(id){var b=books.find(function(x){return x.id===id});if(!b)return;b.favorite=!b.favorite;dbPut(b).then(renderBooks)}
function delBook(id){var b=books.find(function(x){return x.id===id});if(!b)return;if(!confirm("دڵنیایت لە سڕینەوەی «"+b.title+"»؟"))return;dbDel(id).then(function(){books=books.filter(function(x){return x.id!==id});renderBooks();renderOwnerPanel();toast("ڪتێبەڪە سڕایەوە")});}

function clearSpeakHighlight(){
  var a=document.querySelectorAll(".rw.speaking");
  for(var i=0;i<a.length;i++) a[i].classList.remove("speaking");
}

function setSpeakIcon(){
  var b=$("readerSpeak");
  b.className="rbtn"+(speechState==="playing"?" speaking":"");
  b.innerHTML=speechState==="playing"?'<i class="fa-solid fa-pause"></i>':'<i class="fa-solid fa-play"></i>';
}

function highlightWord(i){
  clearSpeakHighlight();
  var a=document.querySelectorAll(".rw"), w=a[i];
  if(w){
    w.classList.add("speaking");
    try{w.scrollIntoView({block:"center",behavior:"smooth"})}catch(e){}
  }
}

function stopSpeech(){
  if(window.speechSynthesis) window.speechSynthesis.cancel();
  speechState="stopped";
  speechUtterance=null;
  clearTimeout(speechTimer);
  speechTimer=null;
  speechWordIndex=0;
  clearSpeakHighlight();
  setSpeakIcon();
}

function getWordDelay(word, rate){
  var r = rate || 0.85;
  var clean = String(word||"").replace(/^[.,!?;:()"'،؛؟]+|[.,!?;:()"'،؛؟]+$/g, "");
  var len = clean.length || 1;
  var ms = 190 + (len * 40);
  if(/[.!?؟]/.test(word)) ms += 320;
  else if(/[,،;:]/.test(word)) ms += 160;
  return ms / r;
}

function runHighlightLoop(){
  if(speechState!=="playing") return;
  var words=document.querySelectorAll(".rw");
  if(speechWordIndex>=words.length){
    stopSpeech();
    return;
  }
  highlightWord(speechWordIndex);
  var curWordText=words[speechWordIndex]?words[speechWordIndex].textContent:"";
  var delay=getWordDelay(curWordText, speechRate);

  speechWordIndex++;
  speechTimer=setTimeout(runHighlightLoop, delay);
}

function speakRemainingText(startIndex){
  var words=document.querySelectorAll(".rw");
  if(startIndex>=words.length){
    stopSpeech();
    return;
  }

  var remainingWords=[];
  for(var i=startIndex; i<words.length; i++){
    remainingWords.push(words[i].textContent);
  }
  var textToSpeak=remainingWords.join(" ");

  if(window.speechSynthesis) window.speechSynthesis.cancel();

  var u=new SpeechSynthesisUtterance(textToSpeak);
  speechUtterance=u;
  u.lang=(currentBook.lang==="ar"?"ar-SA":currentBook.lang==="fa"?"fa-IR":currentBook.lang==="ku"?"ku-Arab":"en-US");
  u.volume=speechVolume;
  u.rate=speechRate;

  u.onend=function(){
    stopSpeech();
  };
  u.onerror=function(e){
    if(e.error!=="interrupted" && e.error!=="canceled"){
      stopSpeech();
    }
  };

  window.speechSynthesis.speak(u);
  runHighlightLoop();
}

function startPageSpeech(){
  if(!window.speechSynthesis){toast("خوێندنەوەی دەنگی لەم وێبگەڕەدا بەردەست نییە");return;}

  if(speechState==="playing"){
    if(window.speechSynthesis) window.speechSynthesis.cancel();
    clearTimeout(speechTimer);
    speechState="paused";
    setSpeakIcon();
    return;
  }

  if(speechState==="paused"){
    speechState="playing";
    setSpeakIcon();
    speakRemainingText(speechWordIndex);
    return;
  }

  var text=$("readerText").innerText.trim();
  if(!text || viewMode==='canvas'){toast("تکایە سەرەتا دەقەڪە بڪەرەوە");return;}

  speechState="playing";
  speechWordIndex=0;
  setSpeakIcon();
  speakRemainingText(0);
}

function paintText(text){
  var box=$("readerText");box.innerHTML="";
  var arr=text.match(/\S+/g)||[],frag=document.createDocumentFragment();
  for(var i=0;i<arr.length;i++){
    var s=document.createElement("span");
    s.className="rw";
    s.textContent=arr[i];
    var clean=arr[i].replace(/^[.,!?;:()"'،؛؟]+|[.,!?;:()"'،؛؟]+$/g,"");
    if(clean)s.setAttribute("data-word",clean);
    frag.appendChild(s);
    if(i<arr.length-1)frag.appendChild(document.createTextNode(" "));
  }
  box.appendChild(frag);
}

// ناردنی ڕاستەوخۆی لاپەڕەی کتێبەکە بۆ Google Lens
function shareToLens() {
  if(!currentPdfDoc){
     toast("وێنەی ئەم پەڕتووکە بەردەست نییە");
     return;
  }
  toast("وێنەی لاپەڕە ئامادە دەکرێت بۆ Google Lens...");
  
  currentPdfDoc.getPage(currentPage + 1).then(function(page){
     var viewport = page.getViewport({scale: 2.2});
     var offCanvas = document.createElement("canvas");
     offCanvas.width = viewport.width;
     offCanvas.height = viewport.height;
     var ctx = offCanvas.getContext('2d');
     
     page.render({canvasContext: ctx, viewport: viewport}).promise.then(function(){
        offCanvas.toBlob(function(blob){
           var file = new File([blob], "xwendnga_page_" + (currentPage+1) + ".jpg", {type: "image/jpeg"});
           if (navigator.canShare && navigator.canShare({ files: [file] })) {
               navigator.share({
                   title: 'Google Lens',
                   text: 'خوێندنەوەی دەق لە لاپەڕە',
                   files: [file]
               }).catch(function(e){ console.log(e); });
           } else {
               // دابەزاندنی ڕاستەوخۆ ئەگەر مۆبایلەکەت پێویستی پێبوو
               var a = document.createElement("a");
               a.href = URL.createObjectURL(blob);
               a.download = "Page_" + (currentPage+1) + ".jpg";
               a.click();
               toast("وێنەکە دابەزێنرا، ئێستا لە Google Lens دەتوانیت وشەکان هەڵبژێریت.");
           }
        }, "image/jpeg", 0.95);
     });
  });
}

function renderPage(){
  if(!currentBook)return;
  clearSpeakHighlight();

  $("rTitle").textContent=currentBook.title;
  $("rSub").textContent="لاپەڕە "+(currentPage+1)+" لە "+currentBook.pageCount;
  $("pageInput").value=currentPage+1;
  $("pageTotal").textContent="/ "+currentBook.pageCount;

  var canvas = $("pdfCanvas");
  var textBox = $("readerText");
  var toggleBtn = $("viewToggleBtn");

  if(viewMode === 'canvas' && currentPdfDoc) {
     canvas.style.display = "block";
     textBox.style.display = "none";
     if(toggleBtn){
         toggleBtn.innerHTML = '<i class="fa-solid fa-robot"></i>';
         toggleBtn.style.color = "#f05bd5"; 
         toggleBtn.classList.remove("active");
     }

     currentPdfDoc.getPage(currentPage + 1).then(function(page) {
        var scale = 2.0; 
        var viewport = page.getViewport({scale: scale});
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        var ctx = canvas.getContext('2d');
        var renderContext = { canvasContext: ctx, viewport: viewport };
        page.render(renderContext);
     });
  } else {
     canvas.style.display = "none";
     textBox.style.display = "block";
     if(toggleBtn){
         toggleBtn.innerHTML = '<i class="fa-regular fa-image"></i>';
         toggleBtn.style.color = "";
         toggleBtn.classList.add("active");
     }

     var text=currentBook.pages[currentPage]||"";
     var cleanTextForCheck = text.replace(/Scanned by CamScanner/gi, "").replace(/[\W_]+/g, "").trim();

     if(cleanTextForCheck.length < 30) {
        $("readerText").className="rtext rtl";
        $("readerText").style.fontSize=""; 
        $("readerText").innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;padding:40px 20px;"><i class="fa-solid fa-expand" style="font-size:48px;color:var(--a);margin-bottom:15px;"></i><h3 style="color:var(--reader-fg);margin:0 0 10px;font-size:18px;">ئەم لاپەڕەیە سکانکراوە</h3><p style="color:var(--muted);font-size:13px;line-height:1.8;max-width:300px;margin:0 auto 20px;">دەقی دیجیتاڵی لەم لاپەڕەیەدا نییە. تکایە دوگمەی سەرەوەی Google Lens یان دوگمەی خوارەوە بەکاربهێنە بۆ دەرهێنانی دەقەکە.</p><button class="primary" data-action="share-lens" style="padding:12px 20px;border-radius:12px;font-size:12px;display:flex;align-items:center;justify-content:center;gap:8px;margin:0 auto;"><i class="fa-solid fa-expand"></i> ناردن بۆ Google Lens</button></div>';
     } else {
        $("readerText").className="rtext"+(["ar","fa","ku"].indexOf(currentBook.lang)>=0?" rtl":" ltr");
        $("readerText").style.fontSize=readerFont+"px";
        paintText(text);
     }
  }

  currentBook.currentPage=currentPage;
  currentBook.progress=currentBook.pageCount>1?currentPage/(currentBook.pageCount-1):1;
  dbPut(currentBook);
}

function openBook(id){
  stopSpeech();
  currentBook=books.find(function(x){return x.id===id});
  if(!currentBook)return;
  
  currentPage=Math.max(0,Math.min(currentBook.pageCount-1,currentBook.currentPage||0));
  pageKurdish=false;
  $("readerKurdish").classList.remove("active");
  $("reader").classList.add("show");
  applyReaderTheme();

  viewMode = (currentBook.lang === 'ku' || currentBook.lang === 'ar' || currentBook.lang === 'fa') ? 'canvas' : 'text';

  if(currentBook.pdfData){
     $("readerText").innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">خەریڪی بارڪردنی لاپەڕە...</div>';
     $("pdfCanvas").style.display = "none";
     $("readerText").style.display = "block";
     
     pdfjsLib.getDocument({data: currentBook.pdfData}).promise.then(function(pdf){
        currentPdfDoc = pdf;
        renderPage();
     }).catch(function(e){
        console.error("PDF Load Error:", e);
        currentPdfDoc = null;
        viewMode = 'text';
        renderPage();
     });
  } else {
     currentPdfDoc = null;
     viewMode = 'text';
     renderPage();
  }
  updateTelegramBtn();
}

function changePage(d){
  if(!currentBook)return;closeTools();var n=currentPage+d;if(n<0||n>=currentBook.pageCount)return;stopSpeech();pageKurdish=false;$("readerKurdish").classList.remove("active");currentPage=n;renderPage();
}

function translateText(text){
  var url="https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ckb&dt=t&q="+encodeURIComponent(text);
  return fetch(url).then(function(r){if(!r.ok)throw new Error("translate");return r.json()}).then(function(j){return (j[0]||[]).map(function(x){return x[0]||""}).join("")||"—";});
}

function togglePageKurdish(){
  if(!currentBook)return;
  stopSpeech();
  pageKurdish=!pageKurdish;$("readerKurdish").classList.toggle("active",pageKurdish);
  if(!pageKurdish){renderPage();return;}
  var key=currentBook.id+"_"+currentPage;
  $("rSub").textContent="لاپەڕە "+(currentPage+1)+" • ڪوردی";
  if(translatedPages[key]){showTranslatedPage(translatedPages[key]);return;}
  $("readerText").textContent="خەریڪی وەرگێڕانی لاپەڕەیە...";
  translateText(currentBook.pages[currentPage]||"").then(function(t){translatedPages[key]=t;showTranslatedPage(t)}).catch(function(){pageKurdish=false;$("readerKurdish").classList.remove("active");renderPage();toast("وەرگێڕان سەرکەوتوو نەبوو")});
}

function showTranslatedPage(t){
  $("readerText").className="rtext rtl";
  $("readerText").style.fontSize=readerFont+"px";
  paintText(t);
}

function openWordModal(word){
  currentWord=word;currentLang=currentBook?currentBook.lang:"en";
  $("modalWord").textContent=word;
  $("modalKu").textContent="چاوەڕوانی...";
  $("modalThird").textContent="چاوەڕوانی...";
  $("modalThirdLabel").textContent=currentLang==="en"?"بە عەرەبی":(currentLang==="ku"||currentLang==="fa"?"بە ئینگلیزی":"بە ئینگلیزی");
  openSheet($("wordBack"),$("wordSheet"));
  translateText(word).then(function(t){$("modalKu").textContent=t}).catch(function(){$("modalKu").textContent="کێشەی ئینتەرنێت"});
  var target=currentLang==="en"?"ar":"en";
  var url="https://translate.googleapis.com/translate_a/single?client=gtx&sl="+currentLang+"&tl="+target+"&dt=t&q="+encodeURIComponent(word);
  fetch(url).then(function(r){return r.json()}).then(function(j){$("modalThird").textContent=(j[0]||[]).map(function(x){return x[0]||""}).join("")||"—"}).catch(function(){$("modalThird").textContent="—"});
}

function openSentenceModal(text){
  var clean=String(text||"").trim();
  if(!clean || clean.length<2)return;
  $("sentenceOriginal").textContent=clean;
  $("sentenceKu").textContent="چاوەڕوانی...";
  openSheet($("sentenceBack"),$("sentenceSheet"));
  translateText(clean).then(function(t){
    $("sentenceKu").textContent=t;
  }).catch(function(){
    $("sentenceKu").textContent="کێشەی ئینتەرنێت";
  });
}

function saveWord(){
  if(!currentWord)return;
  var exists=vocab.some(function(v){return v.word.toLowerCase()===currentWord.toLowerCase()&&v.lang===currentLang});
  if(exists){toast("ئەم وشەیە پێشتر خەزنڪراوە");return;}
  vocab.unshift({id:String(Date.now()),word:currentWord,lang:currentLang,ku:$("modalKu").textContent,third:$("modalThird").textContent});
  try{localStorage.setItem("kh_vocab",JSON.stringify(vocab))}catch(e){}
  renderBooks();
  closeSheet($("wordBack"),$("wordSheet"));
  toast("وشەڪە خەزنڪرا");
}

function renderVocab(){
  var back=document.createElement("div"),sheet=document.createElement("div");
  back.className="back open";sheet.className="sheet open";
  sheet.innerHTML='<div class="handle"></div><div class="section-head"><h3>وشەڪانم</h3><button class="icon-btn" data-temp-close>×</button></div><div style="margin-top:10px">'+(vocab.length?vocab.map(function(v){return '<div class="field"><div style="font-weight:800;color:#f4c85c;font-size:17px">'+esc(v.word)+'</div><div style="margin-top:5px;line-height:1.8">'+esc(v.ku)+'<br><span style="color:var(--muted)">'+esc(v.third)+'</span></div><div class="hero-actions"><button class="ghost" data-vspeak="'+esc(v.word)+'" data-vlang="'+esc(v.lang)+'">گوێگرتن</button><button class="ghost" data-vdel="'+esc(v.id)+'">سڕینەوە</button></div></div>'}).join(""):'<div style="text-align:center;color:var(--muted);padding:25px">هێشتا وشەیەڪ نییە</div>')+'</div>';
  document.body.appendChild(back);document.body.appendChild(sheet);
  updateTelegramBtn();
  function close(){back.remove();sheet.remove();updateTelegramBtn();}
  back.addEventListener("click",close);
  sheet.addEventListener("click",function(e){
    if(e.target.closest("[data-temp-close]"))close();
    var s=e.target.closest("[data-vspeak]");
    if(s){speakText(s.getAttribute("data-vspeak"),s.getAttribute("data-vlang"))}
    var d=e.target.closest("[data-vdel]");
    if(d){
      vocab=vocab.filter(function(v){return v.id!==d.getAttribute("data-vdel")});
      try{localStorage.setItem("kh_vocab",JSON.stringify(vocab))}catch(e){}
      close();renderVocab();renderBooks();
    }
  }); 
}

function speakText(text,lang){
  if(!window.speechSynthesis)return;
  window.speechSynthesis.cancel();
  var u=new SpeechSynthesisUtterance(text);
  u.lang=lang==="en"?"en-US":lang==="fa"?"fa-IR":lang==="ku"?"ku-Arab":"ar-SA";
  u.volume=speechVolume;
  u.rate=speechRate;
  window.speechSynthesis.speak(u);
}

function showTools(type){
  var title=$("toolsTitle"),body=$("toolsBody");
  if(type==="volume"){
    title.textContent="کۆنترۆڵی دەنگ";
    body.innerHTML='<div class="vols"><div class="vol"><label><span>🎵 دەنگ</span><b id="mvt">'+Math.round(musicVolume*100)+'%</b></label><input id="mvr" type="range" min="0" max="100" value="'+Math.round(musicVolume*100)+'"></div><div class="vol"><label><span>🔊 خوێندنەوە</span><b id="svt">'+Math.round(speechVolume*100)+'%</b></label><input id="svr" type="range" min="0" max="100" value="'+Math.round(speechVolume*100)+'"></div></div><div class="reader-col-title">ڕەنگی لاپەڕە</div><div class="reader-colors">'+Object.keys(READER_THEMES).map(function(k){var t=READER_THEMES[k];return '<button data-inline-reader-theme="'+k+'" title="'+esc(t.name)+'" style="background:'+t.bg+';outline:'+(k===readerTheme?'2px solid var(--a)':'none')+'"><span style="background:'+t.fg+'"></span></button>'}).join("")+'</div>';
    $("mvr").oninput=function(){musicVolume=Number(this.value)/100;$("audio").volume=musicVolume;$("mvt").textContent=Math.round(musicVolume*100)+"%";try{localStorage.setItem("kh_music_volume",musicVolume)}catch(e){}};
    $("svr").oninput=function(){speechVolume=Number(this.value)/100;$("svt").textContent=Math.round(speechVolume*100)+"%";try{localStorage.setItem("kh_speech_volume",speechVolume)}catch(e){}};
    $("mvr").focus();
  }else if(type==="music"){
    title.textContent="فایلە دەنگییەکان";
    body.innerHTML='<div class="tracks">'+(music.length?music.map(function(t,i){return '<div class="track '+(i===musicIndex?'active':'')+'"><button data-inline-play="'+i+'"><i class="fa-solid '+(i===musicIndex&&!$("audio").paused?'fa-pause':'fa-play')+'"></i></button><span>'+esc(t.name)+'</span></div>'}).join(""):'<div style="color:var(--muted);font-size:11px;padding:12px;text-align:center">هێشتا دەنگ زیاد نەڪراوە.</div>')+'</div><div class="hero-actions"><button class="primary" data-action="add-music">زیادڪردنی دەنگ</button></div>';
  }else{
    title.textContent="ڕەنگی لاپەڕە";
    body.innerHTML='<div class="reader-colors">'+Object.keys(READER_THEMES).map(function(k){var t=READER_THEMES[k];return '<button data-inline-reader-theme="'+k+'" title="'+esc(t.name)+'" style="background:'+t.bg+';outline:'+(k===readerTheme?'2px solid var(--a)':'none')+'"><span style="background:'+t.fg+'"></span></button>'}).join("")+'</div>';
  }
  $("readerTools").classList.add("show");
}
function closeTools(){$("readerTools").classList.remove("show");}
function addMusicFiles(files){for(var i=0;i<files.length;i++)music.push({name:files[i].name,url:URL.createObjectURL(files[i])});if(musicIndex<0&&music.length)loadTrack(0,false);renderTracks();renderOwnerPanel();}
function loadTrack(i,play){if(!music[i])return;musicIndex=i;$("audio").src=music[i].url;$("audio").volume=musicVolume;$("nowName").textContent=music[i].name;$("nowSub").textContent="دەنگی هەڵبژێردراو";renderTracks();if(play)$("audio").play().catch(function(){})}
function renderTracks(){$("tracks").innerHTML=music.length?music.map(function(t,i){return '<div class="track"><button data-track="'+i+'"><i class="fa-solid '+(i===musicIndex&&!$("audio").paused?'fa-pause':'fa-play')+'"></i></button><span>'+esc(t.name)+'</span><button data-track-del="'+i+'"><i class="fa-regular fa-trash-can"></i></button></div>'}).join(""):'<div style="color:var(--muted);font-size:10px;text-align:center;padding:8px">هیچ دەنگێڪ نییە.</div>';}

document.addEventListener("click",function(e){
  var a=e.target.closest("[data-action]");
  if(a){
    var act=a.getAttribute("data-action");
    
    // دوگمەی ناردنی ڕاستەوخۆ بۆ Google Lens
    if(act==="share-lens"){
        shareToLens();
        return;
    }

    if(act==="settings"){renderSiteThemes();renderReaderThemes();updateThemeBadges();$("fontSize").value=readerFont;openSheet($("sheetBack"),$("settingsSheet"));return}
    if(act==="close-settings"){closeSheet($("sheetBack"),$("settingsSheet"));return}
    if(act==="owner-panel"){renderOwnerPanel();openSheet($("ownerBack"),$("ownerSheet"));return}
    if(act==="close-owner"){closeSheet($("ownerBack"),$("ownerSheet"));return}
    if(act==="add-pdf"){$("pdfInput").click();return}
    if(act==="continue"){var b=books.slice().sort(function(x,y){return y.progress-x.progress})[0];if(b)openBook(b.id);else toast("هێشتا ڪتێب نییە");return}
    if(act==="add-music"){$("musicInput").click();return}
    if(act==="play-pause"){var au=$("audio");if(musicIndex<0&&music.length){loadTrack(0,true)}else if(au.paused){au.play().catch(function(){})}else au.pause();return}
    if(act==="next-track"){if(music.length)loadTrack((musicIndex+1)%music.length,true);return}
    if(act==="prev-track"){if(music.length)loadTrack((musicIndex-1+music.length)%music.length,true);return}
    if(act==="open-book"){var card=a.closest(".book");if(card)openBook(card.getAttribute("data-book"));return}
    if(act==="fav"){var fc=a.closest(".book");if(fc)toggleFav(fc.getAttribute("data-book"));return}
    if(act==="del-book"){var dc=a.closest(".book");if(dc)delBook(dc.getAttribute("data-book"));return}
    if(act==="clear-vocab"){if(confirm("هەموو وشەڪان بسڕدرێنەوە؟")){vocab=[];try{localStorage.setItem("kh_vocab","[]")}catch(e){}renderBooks();toast("وشەڪان سڕانەوە")}return}
    
    if(act==="toggle-view"){
        if(!currentPdfDoc){
            toast("وێنەی ڕەسەنی ئەم پەڕتووڪە بەردەست نییە");
            return;
        }
        viewMode = (viewMode === 'canvas') ? 'text' : 'canvas';
        renderPage();
        return;
    }

    if(act==="reader-close"){
        stopSpeech();
        $("reader").classList.remove("show");
        currentBook=null;
        currentPdfDoc=null;
        pageKurdish=false;
        closeTools();
        updateTelegramBtn();
        return;
    }
    if(act==="reader-speak"){startPageSpeech();return}
    if(act==="reader-kurdish"){togglePageKurdish();return}
    if(act==="reader-tools"){showTools("volume");return}
    if(act==="reader-music"){showTools("music");return}
    if(act==="font-down"){readerFont=Math.max(16,readerFont-1);$("fontSize").value=readerFont;renderPage();return}
    if(act==="font-up"){readerFont=Math.min(30,readerFont+1);$("fontSize").value=readerFont;renderPage();return}
    if(act==="page-prev"){changePage(-1);return}
    if(act==="page-next"){changePage(1);return}
    if(act==="tools-close"){closeTools();return}
    if(act==="save-progress"){if(currentBook)dbPut(currentBook);toast("شوێنی خوێندنەوە پاشەکەوت ڪرا");return}
    if(act==="close-word"){closeSheet($("wordBack"),$("wordSheet"));return}
    if(act==="close-sentence"){closeSheet($("sentenceBack"),$("sentenceSheet"));return}
    if(act==="speak-word"){speakText(currentWord,currentLang);return}
    if(act==="save-word"){saveWord();return}
  }

  var th=e.target.closest("[data-toggle-target]");
  if(th){
    var targetId=th.getAttribute("data-toggle-target");
    var wrap=$(targetId);
    if(wrap){
      var isHidden=wrap.classList.contains("hidden");
      document.querySelectorAll(".setting-collapse").forEach(function(c){c.classList.add("hidden")});
      document.querySelectorAll(".setting-header").forEach(function(h){h.classList.remove("open")});
      if(isHidden){
        wrap.classList.remove("hidden");
        th.classList.add("open");
      }
    }
    return;
  }

  var od=e.target.closest("[data-owner-del]");
  if(od){delBook(od.getAttribute("data-owner-del"));return;}
  var ot=e.target.closest("[data-owner-toggle]");
  if(ot){
    var bid=ot.getAttribute("data-owner-toggle");
    var bk=books.find(function(x){return x.id===bid});
    if(bk){
      bk.isPublished = bk.isPublished === false ? true : false;
      dbPut(bk).then(function(){renderOwnerPanel();renderBooks();toast("دۆخی پەڕتووڪ گۆڕدرا")});
    }
    return;
  }

  var n=e.target.closest("[data-nav]");
  if(n){
    var v=n.getAttribute("data-nav");
    document.querySelectorAll(".nav").forEach(function(x){x.classList.toggle("active",x===n)});
    updateTelegramBtn();
    if(v==="vocab"){renderVocab();return}
    filter=v==="favorites"?"favorites":"all";
    document.querySelectorAll(".chip").forEach(function(c){c.classList.toggle("active",c.getAttribute("data-filter")===filter)});
    renderBooks();
    return;
  }
  var ch=e.target.closest("[data-filter]");
  if(ch){filter=ch.getAttribute("data-filter");document.querySelectorAll(".chip").forEach(function(c){c.classList.toggle("active",c.getAttribute("data-filter")===filter)});renderBooks();return}
  var st=e.target.closest("[data-site-theme]");if(st){setSiteTheme(st.getAttribute("data-site-theme"));return}
  var rt=e.target.closest("[data-reader-theme]");if(rt){readerTheme=rt.getAttribute("data-reader-theme");try{localStorage.setItem("kh_reader_theme",readerTheme)}catch(err){}applyReaderTheme();renderReaderThemes();renderSiteThemes();return}
  var ir=e.target.closest("[data-inline-reader-theme]");if(ir){readerTheme=ir.getAttribute("data-inline-reader-theme");try{localStorage.setItem("kh_reader_theme",readerTheme)}catch(err){}applyReaderTheme();showTools("volume");toast("ڕەنگی لاپەڕە گۆڕدرا");return}
  var ip=e.target.closest("[data-inline-play]");
  if(ip){
    var ii=Number(ip.getAttribute("data-inline-play"));
    if(ii===musicIndex && !$("audio").paused) $("audio").pause();
    else loadTrack(ii,true);
    showTools("music");
    return;
  }
  var tp=e.target.closest("[data-track]");if(tp){var i=Number(tp.getAttribute("data-track"));if(i===musicIndex&&!$("audio").paused)$("audio").pause();else loadTrack(i,true);return}
  var td=e.target.closest("[data-track-del]");if(td){var di=Number(td.getAttribute("data-track-del"));URL.revokeObjectURL(music[di].url);music.splice(di,1);if(musicIndex===di){$("audio").pause();musicIndex=-1;$("audio").src="";$("nowName").textContent="هیچ دەنگێڪ نییە"}renderTracks();renderOwnerPanel();return}
  var vw=e.target.closest("[data-vspeak]");if(vw){speakText(vw.getAttribute("data-vspeak"),vw.getAttribute("data-vlang"));return}
  var vd=e.target.closest("[data-vdel]");if(vd){vocab=vocab.filter(function(v){return v.id!==vd.getAttribute("data-vdel")});try{localStorage.setItem("kh_vocab",JSON.stringify(vocab))}catch(err){}renderBooks();return}
  var w=e.target.closest(".rw");
  if(w&&w.getAttribute("data-word")){
    if(window.getSelection&&!window.getSelection().isCollapsed){
      var sel=window.getSelection().toString().trim();
      if(sel.length>1){
        if(speechState==="playing"){
          if(window.speechSynthesis) window.speechSynthesis.cancel();
          clearTimeout(speechTimer);
          speechState="paused";
          setSpeakIcon();
        }
        openSentenceModal(sel);
        return;
      }
    }
    if(speechState==="playing"){
      if(window.speechSynthesis) window.speechSynthesis.cancel();
      clearTimeout(speechTimer);
      speechState="paused";
      setSpeakIcon();
    }
    document.querySelectorAll(".rw.selected").forEach(function(x){x.classList.remove("selected")});
    w.classList.add("selected");
    openWordModal(w.getAttribute("data-word"));
    return;
  }
});

document.addEventListener("change",function(e){
  var oc=e.target.closest("[data-owner-cat]");
  if(oc){
    var bid=oc.getAttribute("data-owner-cat");
    var bk=books.find(function(x){return x.id===bid});
    if(bk){
      bk.category=oc.value;
      dbPut(bk).then(function(){renderBooks();toast("پۆلی پەڕتووڪ نوێڪرایەوە")});
    }
  }
});

$("sheetBack").addEventListener("click",function(){closeSheet($("sheetBack"),$("settingsSheet"))});
$("ownerBack").addEventListener("click",function(){closeSheet($("ownerBack"),$("ownerSheet"))});
$("wordBack").addEventListener("click",function(){closeSheet($("wordBack"),$("wordSheet"))});
$("sentenceBack").addEventListener("click",function(){closeSheet($("sentenceBack"),$("sentenceSheet"))});
$("pdfInput").addEventListener("change",function(){addPDF(this.files[0])});
$("musicInput").addEventListener("change",function(){addMusicFiles(this.files);this.value=""});
$("searchInput").addEventListener("input",function(){query=this.value.trim();renderBooks()});
$("audio").addEventListener("timeupdate",function(){if(this.duration)$("audioRange").value=Math.round(this.currentTime/this.duration*100)});
$("audio").addEventListener("ended",function(){if(music.length)loadTrack((musicIndex+1)%music.length,true)});
$("audio").addEventListener("play",renderTracks);$("audio").addEventListener("pause",renderTracks);
$("audioRange").addEventListener("input",function(){var a=$("audio");if(a.duration)a.currentTime=a.duration*(Number(this.value)/100)});
$("pageInput").addEventListener("change",function(){if(currentBook){var n=Math.max(1,Math.min(currentBook.pageCount,Number(this.value||1)));stopSpeech();currentPage=n-1;pageKurdish=false;$("readerKurdish").classList.remove("active");renderPage()}});
$("fontSize").addEventListener("change",function(){readerFont=Number(this.value);try{localStorage.setItem("kh_font",readerFont)}catch(e){}if(currentBook)renderPage()});

function init(){
  loadLocal();
  try{musicVolume=Number(localStorage.getItem("kh_music_volume")||.32);speechVolume=Number(localStorage.getItem("kh_speech_volume")||.85)}catch(e){}
  setSiteTheme(siteTheme);applyReaderTheme();renderSiteThemes();renderReaderThemes();updateThemeBadges();setSpeakIcon();renderTracks();
  dbAll().then(function(a){books=a||[];renderBooks();updateTelegramBtn();}).catch(function(e){console.error(e);books=[];renderBooks();updateTelegramBtn();});
}
init();

})();
