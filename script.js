(function(){
"use strict";

var books = [];
var vocab = [];
var filter = "all";
var query = "";
var siteTheme = "cyan";
var readerTheme = "paper";
var music = [];
var musicIndex = -1;
var currentWord = "";
var currentLang = "en";

var CATEGORIES = ["گشتی","زمان","ئەدەب","مێژوو","زانست","فەلسەفە","ئایین","ئینگلیزی"];

var SITE_THEMES = {
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

function $(id){ return document.getElementById(id); }
function toast(t){ var x=$("toast"); if(!x)return; x.textContent=t; x.className="toast show"; clearTimeout(toast._t); toast._t=setTimeout(function(){x.className="toast"},2400); }
function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){return({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"})[c];}); }

function updateTelegramBtn(){
  var btn = $("telegramBtn");
  if(!btn) return;
  var readerOpen = $("reader") && $("reader").classList.contains("show");
  var sheetOpen = document.querySelector(".sheet.open, .back.open");
  var activeNav = document.querySelector(".nav.active");
  var isHome = activeNav && activeNav.getAttribute("data-nav") === "home";
  btn.style.display = (isHome && !readerOpen && !sheetOpen) ? "flex" : "none";
}

function openSheet(back,sheet){ back.classList.add("open"); sheet.classList.add("open"); updateTelegramBtn(); }
function closeSheet(back,sheet){ back.classList.remove("open"); sheet.classList.remove("open"); updateTelegramBtn(); }

function dbOpen(){
  return new Promise(function(resolve,reject){
    var req = indexedDB.open("kh_reader_v10", 1);
    req.onupgradeneeded = function(){ if(!req.result.objectStoreNames.contains("books")) req.result.createObjectStore("books",{keyPath:"id"}); };
    req.onsuccess = function(){ resolve(req.result); };
    req.onerror = function(){ reject(req.error); };
  });
}
function dbAll(){
  return dbOpen().then(function(db){ return new Promise(function(resolve,reject){ var q=db.transaction("books","readonly").objectStore("books").getAll(); q.onsuccess=function(){resolve(q.result||[])}; q.onerror=function(){reject(q.error)}; }); });
}
function dbPut(b){
  return dbOpen().then(function(db){ return new Promise(function(resolve,reject){ var tx=db.transaction("books","readwrite"); tx.objectStore("books").put(b); tx.oncomplete=resolve; tx.onerror=function(){reject(tx.error)}; }); });
}
function dbDel(id){
  return dbOpen().then(function(db){ return new Promise(function(resolve,reject){ var tx=db.transaction("books","readwrite"); tx.objectStore("books").delete(id); tx.oncomplete=resolve; tx.onerror=function(){reject(tx.error)}; }); });
}

window.AppLib = {
  dbPut: dbPut,
  updateTelegram: updateTelegramBtn,
  openSettings: function(){ openSheet($("sheetBack"), $("settingsSheet")); }
};

function detectLang(text){
  var t = String(text||"").slice(0,20000);
  var kuChars = (t.match(/[\u06D5\u06CE\u0695\u06B5\u06A4\u06C6\u06B7\u06F6]/g)||[]).length;
  var faChars = (t.match(/[\u067E\u0686\u0698\u06AF]/g)||[]).length;
  if(kuChars >= 2) return "ku";
  if(faChars >= 2) return "fa";
  if(/[\u0600-\u06FF]/.test(t)) return "ar";
  return "en";
}

function extractPDF(file){
  return new Promise(function(resolve,reject){
    if(!window.pdfjsLib){ reject(new Error("PDF engine")); return; }
    var fr = new FileReader();
    fr.onload = function(){
      try {
        var rawBuffer = fr.result;
        var dataForWorker = new Uint8Array(rawBuffer.slice(0));
        var dataToStore = new Uint8Array(rawBuffer);

        pdfjsLib.getDocument({data: dataForWorker}).promise.then(function(pdf){
          var pages = [], chain = Promise.resolve();
          for(let i=1; i<=pdf.numPages; i++){
            (function(pNo){
              chain = chain.then(function(){
                return pdf.getPage(pNo).then(function(page){
                  return page.getTextContent({normalizeWhitespace:false, disableCombineTextItems:true}).then(function(c){
                    pages.push((c.items||[]).map(function(x){return x.str||""}).join(" ").trim());
                  });
                });
              });
            })(i);
          }
          chain.then(function(){
            resolve({pages: pages, lang: detectLang(pages.join("\n")), pdfData: dataToStore});
          }).catch(reject);
        }).catch(reject);
      } catch(e){ reject(e); }
    };
    fr.onerror = function(){ reject(fr.error); };
    fr.readAsArrayBuffer(file);
  });
}

function addPDF(file){
  if(!file) return;
  toast("PDF خەریڪی خوێندنەوەیە...");
  extractPDF(file).then(function(d){
    var b = {
      id: String(Date.now()) + "_" + Math.floor(Math.random()*10000),
      title: file.name.replace(/\.pdf$/i,""),
      author: "",
      category: "گشتی",
      isPublished: true,
      pages: d.pages,
      pdfData: d.pdfData,
      lang: d.lang,
      pageCount: d.pages.length,
      currentPage: 0,
      progress: 0,
      favorite: false,
      addedAt: Date.now()
    };
    return dbPut(b).then(function(){ books.push(b); renderBooks(); toast("ڪتێبەڪە زیادڪرا"); });
  }).catch(function(e){ console.error(e); toast("نەتوانرا PDF بخوێندرێتەوە"); });
  $("pdfInput").value = "";
}

function filtered(){
  var a = books.slice().sort(function(x,y){ return y.addedAt - x.addedAt; });
  if(filter === "favorites") a = a.filter(function(x){ return x.favorite; });
  else if(filter === "recent") a = a.slice(0,8);
  else if(filter !== "all") a = a.filter(function(x){ return (x.category||"گشتی") === filter; });
  if(query){
    var q = query.toLowerCase();
    a = a.filter(function(x){ return (x.title+" "+(x.author||"")+" "+(x.category||"")).toLowerCase().indexOf(q)>=0; });
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
  $("bookCount").textContent = books.length;
  $("wordCount").textContent = vocab.length;
  var a = filtered();
  $("resultHint").textContent = a.length + " ڪتێب";
  if(!a.length){
    $("bookList").innerHTML = '<div class="empty" style="text-align:center;padding:30px;color:var(--muted)"><i class="fa-solid fa-book-open" style="font-size:32px;margin-bottom:8px"></i><h3 style="margin:7px 0 3px;color:#dfe8f2;font-size:14px">'+(query?"هیچ ئەنجامێڪ نەدۆزرایەوە":"لەم پۆلەدا هێشتا ڪتێب نییە")+'</h3><div style="font-size:11px">دەتوانیت لە سەرەوە PDF نوێ زیاد بڪەیت.</div></div>';
    return;
  }
  $("bookList").innerHTML = a.map(function(b){
    var p = Math.round((b.progress||0)*100);
    return '<article class="book" data-book="'+esc(b.id)+'"><button class="fav" data-action="fav"><i class="'+(b.favorite?"fa-solid":"fa-regular")+' fa-heart"></i></button><div class="cover"><i class="fa-solid fa-book-bookmark"></i></div><div class="book-main"><div class="book-title">'+esc(b.title)+'</div><div class="book-author">'+esc(b.author||"نووسەری دیارینەکراو")+'</div><div class="meta"><span><i class="fa-regular fa-file-lines"></i> '+b.pageCount+' لاپەڕە</span><span><i class="fa-solid fa-language"></i> '+(langName(b.lang))+'</span><span class="tag-badge">'+esc(b.category||"گشتی")+'</span></div><div class="progress"><span style="width:'+p+'%"></span></div><div class="actions"><button class="small primary" data-action="open-book"><i class="fa-solid fa-book-open"></i> خوێندنەوە</button><button class="small" data-action="del-book"><i class="fa-regular fa-trash-can"></i></button></div></div></article>';
  }).join("");
}

function openBook(id){
  var b = books.find(function(x){ return x.id === id; });
  if(!b) return;
  if(window.ReaderEngine && window.ReaderEngine.open){
    window.ReaderEngine.open(b);
  }
}

function setSiteTheme(k){
  var t = SITE_THEMES[k] || SITE_THEMES.cyan;
  siteTheme = k;
  var r = document.documentElement;
  r.style.setProperty("--a",t.a); r.style.setProperty("--b",t.b); r.style.setProperty("--accent",t.a);
  r.style.setProperty("--bg",t.bg); r.style.setProperty("--bg2",t.bg2); r.style.setProperty("--surface",t.surface); r.style.setProperty("--surface2",t.surface2); r.style.setProperty("--line",t.line);
  try { localStorage.setItem("kh_site_theme", k); } catch(e){}
}

function translateText(text){
  var url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ckb&dt=t&q=" + encodeURIComponent(text);
  return fetch(url).then(function(r){ return r.json(); }).then(function(j){ return (j[0]||[]).map(function(x){return x[0]||"";}).join("")||"—"; });
}

function openWordModal(word){
  currentWord = word;
  $("modalWord").textContent = word;
  $("modalKu").textContent = "چاوەڕوانی...";
  $("modalThird").textContent = "چاوەڕوانی...";
  openSheet($("wordBack"), $("wordSheet"));
  translateText(word).then(function(t){ $("modalKu").textContent = t; });
  var url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=" + encodeURIComponent(word);
  fetch(url).then(function(r){ return r.json(); }).then(function(j){ $("modalThird").textContent = (j[0]||[]).map(function(x){return x[0]||"";}).join("")||"—"; });
}

document.addEventListener("click", function(e){
  var a = e.target.closest("[data-action]");
  if(a){
    var act = a.getAttribute("data-action");
    if(act === "open-book"){
      var card = a.closest(".book");
      if(card) openBook(card.getAttribute("data-book"));
      return;
    }
    if(act === "add-pdf"){ $("pdfInput").click(); return; }
    if(act === "settings"){
      if($("geminiApiKey")) $("geminiApiKey").value = localStorage.getItem("kh_gemini_key") || "";
      openSheet($("sheetBack"), $("settingsSheet"));
      return;
    }
    if(act === "close-settings"){ closeSheet($("sheetBack"), $("settingsSheet")); return; }
    if(act === "del-book"){
      var dc = a.closest(".book");
      if(dc){
        var bid = dc.getAttribute("data-book");
        if(confirm("ئەم کتێبە بسڕدرێتەوە؟")){
          dbDel(bid).then(function(){ books = books.filter(function(x){return x.id!==bid;}); renderBooks(); toast("کتێبەکە سڕایەوە"); });
        }
      }
      return;
    }
    if(act === "close-word"){ closeSheet($("wordBack"), $("wordSheet")); return; }
  }

  var w = e.target.closest(".rw");
  if(w && w.getAttribute("data-word")){
    openWordModal(w.getAttribute("data-word"));
  }
});

$("sheetBack").addEventListener("click", function(){ closeSheet($("sheetBack"), $("settingsSheet")); });
$("wordBack").addEventListener("click", function(){ closeSheet($("wordBack"), $("wordSheet")); });
$("pdfInput").addEventListener("change", function(){ addPDF(this.files[0]); });
$("searchInput").addEventListener("input", function(){ query = this.value.trim(); renderBooks(); });

if($("geminiApiKey")){
  $("geminiApiKey").addEventListener("input", function(){
    try { localStorage.setItem("kh_gemini_key", this.value.trim()); } catch(e){}
  });
}

function init(){
  try {
    var v = localStorage.getItem("kh_vocab"); vocab = v ? JSON.parse(v) : [];
    siteTheme = localStorage.getItem("kh_site_theme") || "cyan";
  } catch(e){}
  setSiteTheme(siteTheme);
  dbAll().then(function(a){ books = a || []; renderBooks(); updateTelegramBtn(); });
}
init();

})();
