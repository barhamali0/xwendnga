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
var musicVolume = 0.32;
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

var READER_THEMES = {
  paper:{name:"سپی",bg:"#f4f6f9",paper:"#ffffff",fg:"#1d2a3d"},
  cream:{name:"ڪرێمی",bg:"#eee5d1",paper:"#fff9e7",fg:"#403728"},
  mint:{name:"سەوزی کاڵ",bg:"#dfece5",paper:"#f4fbf7",fg:"#203c31"},
  sky:{name:"ئاسمانی",bg:"#dceef4",paper:"#f2fbff",fg:"#24414b"},
  rose:{name:"پەمەیی",bg:"#f0dfe2",paper:"#fff5f6",fg:"#4a2d33"},
  lavender:{name:"مۆری",bg:"#e6def4",paper:"#fbf8ff",fg:"#332b46"},
  sand:{name:"خۆڵەمێشی",bg:"#e7ded2",paper:"#fbf4eb",fg:"#493b2e"},
  forest:{name:"دارستان",bg:"#dee8de",paper:"#f5fbf3",fg:"#213525"},
  sepia:{name:"ڪتێبی کۆن",bg:"#e6dbc6",paper:"#f7eddb",fg:"#4a3925"},
  slate:{name:"سڵەیت",bg:"#dce1e7",paper:"#eef1f5",fg:"#263341"},
  night:{name:"شەو",bg:"#0b1420",paper:"#101b2c",fg:"#e9f2fc"},
  black:{name:"ڕەش",bg:"#050505",paper:"#0b0b0b",fg:"#f1f1f1"}
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

function openSheet(back,sheet){
  if(!back || !sheet) return;
  back.classList.add("open");
  sheet.classList.add("open");
  updateTelegramBtn();
}
function closeSheet(back,sheet){
  if(!back || !sheet) return;
  back.classList.remove("open");
  sheet.classList.remove("open");
  updateTelegramBtn();
}

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
  openSettings: function(){
    openSheet($("sheetBack"), $("settingsSheet"));
  },
  getMusicVolume: function(){ return musicVolume; },
  setMusicVolume: function(v){
    musicVolume = v;
    var au = $("audio");
    if(au) au.volume = v;
    try { localStorage.setItem("kh_music_volume", v); } catch(e){}
  }
};

function updateThemeBadges(){
  var st = SITE_THEMES[siteTheme] || SITE_THEMES.cyan;
  var rt = READER_THEMES[readerTheme] || READER_THEMES.paper;
  if($("siteThemeLabel")) $("siteThemeLabel").textContent = st.name;
  if($("siteThemeDot")) $("siteThemeDot").style.background = st.a;
  if($("readerThemeLabel")) $("readerThemeLabel").textContent = rt.name;
  if($("readerThemeDot")) $("readerThemeDot").style.background = rt.bg;
}

function setSiteTheme(k){
  var t = SITE_THEMES[k] || SITE_THEMES.cyan;
  siteTheme = k;
  var r = document.documentElement;
  r.style.setProperty("--a",t.a); r.style.setProperty("--b",t.b); r.style.setProperty("--accent",t.a);
  r.style.setProperty("--bg",t.bg); r.style.setProperty("--bg2",t.bg2); r.style.setProperty("--surface",t.surface); r.style.setProperty("--surface2",t.surface2); r.style.setProperty("--line",t.line);
  try { localStorage.setItem("kh_site_theme", k); } catch(e){}
  renderSiteThemes();
  updateThemeBadges();
}

function renderSiteThemes(){
  var box = $("siteThemes");
  if(!box) return;
  var out = "";
  for(var k in SITE_THEMES){
    var t = SITE_THEMES[k];
    out += '<button class="theme '+(k===siteTheme?"active":"")+'" data-site-theme="'+k+'" title="'+esc(t.name)+'" style="background:linear-gradient(145deg,'+t.bg2+','+t.bg+')"><i style="background:'+t.a+'"></i><b style="background:linear-gradient(90deg,'+t.a+','+t.b+')"></b></button>';
  }
  box.innerHTML = out;
}

function renderReaderThemes(){
  var box = $("readerThemes");
  if(!box) return;
  var out = "";
  for(var k in READER_THEMES){
    var t = READER_THEMES[k];
    out += '<button class="theme '+(k===readerTheme?"active":"")+'" data-set-reader-theme="'+k+'" title="'+esc(t.name)+'" style="background:'+t.bg+'"><i style="background:'+t.fg+'"></i><b style="background:'+t.fg+'"></b></button>';
  }
  box.innerHTML = out;
}

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
  if($("pdfInput")) $("pdfInput").value = "";
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
  if($("bookCount")) $("bookCount").textContent = books.length;
  if($("wordCount")) $("wordCount").textContent = vocab.length;
  var a = filtered();
  if($("resultHint")) $("resultHint").textContent = a.length + " ڪتێب";
  var bList = $("bookList");
  if(!bList) return;
  if(!a.length){
    bList.innerHTML = '<div class="empty" style="text-align:center;padding:30px;color:var(--muted)"><i class="fa-solid fa-book-open" style="font-size:32px;margin-bottom:8px"></i><h3 style="margin:7px 0 3px;color:#dfe8f2;font-size:14px">'+(query?"هیچ ئەنجامێڪ نەدۆزرایەوە":"لەم پۆلەدا هێشتا ڪتێب نییە")+'</h3><div style="font-size:11px">دەتوانیت لە سەرەوە PDF نوێ زیاد بڪەیت.</div></div>';
    return;
  }
  bList.innerHTML = a.map(function(b){
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

function renderOwnerPanel(){
  if($("ownerTotalBooks")) $("ownerTotalBooks").textContent = books.length;
  if($("ownerPublicBooks")) $("ownerPublicBooks").textContent = books.filter(function(b){return b.isPublished!==false;}).length;
  if($("ownerPendingBooks")) $("ownerPendingBooks").textContent = books.filter(function(b){return b.isPublished===false;}).length;
  if($("ownerTotalAudios")) $("ownerTotalAudios").textContent = music.length;

  var list = $("ownerBooksList");
  if(!list) return;
  if(!books || !books.length){
    list.innerHTML = '<div style="color:var(--muted);font-size:11px;text-align:center;padding:12px">هیچ پەڕتووڪێڪ بۆ بەڕێوەبردن نییە.</div>';
    return;
  }
  list.innerHTML = books.map(function(b){
    var cat = b.category || "گشتی";
    return '<div style="background:var(--surface2);border:1px solid var(--line);border-radius:12px;padding:8px 10px;display:flex;align-items:center;justify-content:space-between;gap:8px">'+
      '<div style="min-width:0;flex:1"><strong style="font-size:12px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(b.title)+'</strong>'+
      '<span style="font-size:10px;color:var(--muted)">پۆل: </span>'+
      '<select data-owner-cat="'+esc(b.id)+'" style="font-size:10px;border:1px solid var(--line);background:var(--surface);color:#fff;border-radius:6px;padding:2px 4px">'+
        CATEGORIES.map(function(c){return '<option value="'+esc(c)+'" '+(cat===c?"selected":"")+'>'+esc(c)+'</option>'}).join("")+
      '</select></div>'+
      '<div style="display:flex;gap:5px">'+
        '<button data-owner-del="'+esc(b.id)+'" class="icon-btn" style="width:32px;height:32px;font-size:11px;color:#ff536d" title="سڕینەوە">'+
          '<i class="fa-regular fa-trash-can"></i>'+
        '</button>'+
      '</div>'+
    '</div>';
  }).join("");
}

// سیستەمی وەرگێڕانی خێرا بەبێ وەستان لەسەر «چاوەڕوانی...»
function translateText(text, targetLang){
  var tl = targetLang || "ckb";
  var url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=" + encodeURIComponent(tl) + "&dt=t&q=" + encodeURIComponent(text);

  return fetch(url)
    .then(function(r){
      if(!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function(j){
      var res = (j[0]||[]).map(function(x){ return x[0]||""; }).join("").trim();
      return res || "—";
    })
    .catch(function(){
      // ئەگەر گووگڵ بلۆک بوو بەهۆی ڤی‌پی‌ئین یان هێڵ، ڕاستەوخۆ سێرڤەری دووەم کار دەکات
      var pair = "auto|" + (tl === "ckb" ? "ku" : tl);
      var fbUrl = "https://api.mymemory.translated.net/get?q=" + encodeURIComponent(text) + "&langpair=" + pair;
      return fetch(fbUrl)
        .then(function(r){ return r.json(); })
        .then(function(data){
          return (data && data.responseData && data.responseData.translatedText) || "نەتوانرا وەربگێڕدرێت";
        })
        .catch(function(){
          return "کێشەی هێڵ";
        });
    });
}

function openWordModal(word){
  currentWord = word;
  
  var sheet = $("wordSheet");
  if(sheet){
    sheet.innerHTML = '<div class="handle"></div>' +
      '<div class="section-head"><h3>فەرهەنگ</h3><button class="icon-btn" data-action="close-word"><i class="fa-solid fa-xmark"></i></button></div>' +
      '<div class="field"><label>وشە</label><div id="modalWord" style="font-size:20px;font-weight:800;color:#f4c85c;display:flex;justify-content:space-between;align-items:center;">'+esc(word)+'<button class="icon-btn" data-vspeak="'+esc(word)+'" data-vlang="en" style="width:32px;height:32px;font-size:13px;color:var(--a);"><i class="fa-solid fa-volume-high"></i></button></div></div>' +
      '<div class="field"><label>بە ڪوردی</label><div id="modalKu" style="font-size:15px;color:#fff;">چاوەڕوانی...</div></div>' +
      '<div class="field"><label>بە عەرەبی</label><div id="modalAr" style="display:flex;justify-content:space-between;align-items:center;font-size:15px;color:#fff;"><span id="modalArText">چاوەڕوانی...</span><button class="icon-btn" id="modalArSpeakBtn" style="width:32px;height:32px;font-size:13px;color:#22c98b;"><i class="fa-solid fa-volume-high"></i></button></div></div>' +
      '<div class="hero-actions" style="margin-top:14px;"><button class="primary" data-action="save-word">خەزنڪردنی وشەڪە</button></div>';
  }

  openSheet($("wordBack"), $("wordSheet"));

  translateText(word, "ckb").then(function(t){
    if($("modalKu")) $("modalKu").textContent = t;
  });

  translateText(word, "ar").then(function(t){
    var mArText = $("modalArText");
    var mArBtn = $("modalArSpeakBtn");
    if(mArText) mArText.textContent = t;
    if(mArBtn) {
      mArBtn.setAttribute("data-vspeak", t);
      mArBtn.setAttribute("data-vlang", "ar");
    }
  });
}

function openSentenceModal(text){
  var clean = String(text||"").trim();
  if(!clean || clean.length < 2) return;
  if($("sentenceOriginal")) $("sentenceOriginal").textContent = clean;
  if($("sentenceKu")) $("sentenceKu").textContent = "چاوەڕوانی...";
  openSheet($("sentenceBack"), $("sentenceSheet"));
  translateText(clean, "ckb").then(function(t){
    if($("sentenceKu")) $("sentenceKu").textContent = t;
  });
}

function saveWord(){
  if(!currentWord) return;
  var exists = vocab.some(function(v){ return v.word.toLowerCase() === currentWord.toLowerCase(); });
  if(exists){ toast("ئەم وشەیە پێشتر خەزنڪراوە"); return; }
  
  var kuText = $("modalKu") ? $("modalKu").textContent : "";
  var arText = $("modalArText") ? $("modalArText").textContent : "";
  
  vocab.unshift({id:String(Date.now()), word:currentWord, ku:kuText, third:arText});
  try { localStorage.setItem("kh_vocab", JSON.stringify(vocab)); } catch(e){}
  renderBooks();
  closeSheet($("wordBack"), $("wordSheet"));
  toast("وشەڪە خەزنڪرا");
}

function speakText(text, lang){
  if(!window.speechSynthesis) { toast("دەنگ بەردەست نییە"); return; }
  window.speechSynthesis.cancel();
  var u = new SpeechSynthesisUtterance(text);
  u.lang = lang === "ar" ? "ar-SA" : "en-US";
  u.volume = 1.0;
  u.rate = 0.85;
  window.speechSynthesis.speak(u);
}

function renderVocab(){
  var back = document.createElement("div"), sheet = document.createElement("div");
  back.className = "back open"; sheet.className = "sheet open";
  sheet.innerHTML = '<div class="handle"></div><div class="section-head"><h3>وشەڪانم</h3><button class="icon-btn" data-temp-close>×</button></div><div style="margin-top:10px;max-height:350px;overflow:auto;">' +
    (vocab.length ? vocab.map(function(v){
      return '<div class="field" style="margin-bottom:10px"><div style="font-weight:800;color:#f4c85c;font-size:17px;display:flex;justify-content:space-between;align-items:center;">'+esc(v.word)+'<button class="icon-btn" data-vspeak="'+esc(v.word)+'" data-vlang="en" style="width:28px;height:28px;font-size:11px"><i class="fa-solid fa-volume-high"></i></button></div><div style="margin-top:5px;line-height:1.8">'+esc(v.ku)+'<br><span style="color:var(--muted);display:flex;justify-content:space-between;align-items:center;">'+esc(v.third)+'<button class="icon-btn" data-vspeak="'+esc(v.third)+'" data-vlang="ar" style="width:28px;height:28px;font-size:11px"><i class="fa-solid fa-volume-high"></i></button></span></div><div class="hero-actions" style="margin-top:8px"><button class="ghost" data-vdel="'+esc(v.id)+'">سڕینەوە</button></div></div>';
    }).join("") : '<div style="text-align:center;color:var(--muted);padding:25px">هێشتا وشەیەڪ نییە</div>') + '</div>';
  
  document.body.appendChild(back); document.body.appendChild(sheet);
  updateTelegramBtn();
  function close(){ back.remove(); sheet.remove(); updateTelegramBtn(); }
  back.addEventListener("click", close);
  sheet.addEventListener("click", function(e){
    if(e.target.closest("[data-temp-close]")) close();
    var d = e.target.closest("[data-vdel]");
    if(d){
      vocab = vocab.filter(function(v){ return v.id !== d.getAttribute("data-vdel"); });
      try { localStorage.setItem("kh_vocab", JSON.stringify(vocab)); } catch(err){}
      close(); renderVocab(); renderBooks();
    }
  });
}

function addMusicFiles(files){
  for(var i=0; i<files.length; i++) music.push({name:files[i].name, url:URL.createObjectURL(files[i])});
  if(musicIndex < 0 && music.length) loadTrack(0, false);
  renderTracks();
}

function loadTrack(i, play){
  if(!music[i]) return;
  musicIndex = i;
  var au = $("audio");
  if(au){
    au.src = music[i].url;
    au.volume = musicVolume;
  }
  if($("nowName")) $("nowName").textContent = music[i].name;
  if($("nowSub")) $("nowSub").textContent = "دەنگی هەڵبژێردراو";
  renderTracks();
  updatePlayButtonUI();
  if(play && au) {
    au.play().then(updatePlayButtonUI).catch(function(){});
  }
}

// هاوسەنگکردنی تەواوی ئایکۆنی ▶️ و ⏸️ بۆ ئەوەی پێچەوانە نەبنەوە
function updatePlayButtonUI(){
  var mainBtn = document.querySelector(".music-btn.big[data-action='play-pause']");
  var au = $("audio");
  var isPlaying = au && !au.paused && musicIndex >= 0;
  if(mainBtn) {
    mainBtn.innerHTML = isPlaying ? '<i class="fa-solid fa-pause"></i>' : '<i class="fa-solid fa-play"></i>';
  }
  var trackBtns = document.querySelectorAll("[data-track]");
  trackBtns.forEach(function(tb){
    var idx = Number(tb.getAttribute("data-track"));
    var icon = tb.querySelector("i");
    if(icon){
      if(idx === musicIndex && isPlaying){
        icon.className = "fa-solid fa-pause";
      } else {
        icon.className = "fa-solid fa-play";
      }
    }
  });
}

function renderTracks(){
  var box = $("tracks");
  if(!box) return;
  box.innerHTML = music.length ? music.map(function(t, i){
    var au = $("audio");
    var isPlaying = (i === musicIndex && au && !au.paused);
    return '<div class="track" data-track-card="'+i+'" style="cursor:pointer;"><button data-track="'+i+'"><i class="fa-solid '+(isPlaying?'fa-pause':'fa-play')+'"></i></button><span>'+esc(t.name)+'</span></div>';
  }).join("") : '<div style="color:var(--muted);font-size:10px;text-align:center;padding:8px">هیچ دەنگێڪ نییە.</div>';
}

document.addEventListener("click", function(e){
  var vs = e.target.closest("[data-vspeak]");
  if(vs){
    speakText(vs.getAttribute("data-vspeak"), vs.getAttribute("data-vlang"));
    return;
  }

  var a = e.target.closest("[data-action]");
  if(a){
    var act = a.getAttribute("data-action");

    if(act === "owner-panel"){
      openSheet($("ownerBack"), $("ownerSheet"));
      try { renderOwnerPanel(); } catch(err){}
      return;
    }
    if(act === "close-owner"){ closeSheet($("ownerBack"), $("ownerSheet")); return; }

    if(act === "open-book"){
      var card = a.closest(".book");
      if(card) openBook(card.getAttribute("data-book"));
      return;
    }
    if(act === "fav"){
      var fc = a.closest(".book");
      if(fc){
        var bid = fc.getAttribute("data-book");
        var bk = books.find(function(x){ return x.id === bid; });
        if(bk){ bk.favorite = !bk.favorite; dbPut(bk).then(renderBooks); }
      }
      return;
    }
    if(act === "del-book"){
      var dc = a.closest(".book");
      if(dc){
        var delId = dc.getAttribute("data-book");
        if(confirm("ئەم کتێبە بسڕدرێتەوە؟")){
          dbDel(delId).then(function(){ books = books.filter(function(x){return x.id!==delId;}); renderBooks(); toast("کتێبەکە سڕایەوە"); });
        }
      }
      return;
    }
    if(act === "continue"){
      var bTop = books.slice().sort(function(x,y){ return y.progress - x.progress; })[0];
      if(bTop) openBook(bTop.id); else toast("هێشتا ڪتێب نییە");
      return;
    }
    if(act === "add-pdf"){ if($("pdfInput")) $("pdfInput").click(); return; }
    if(act === "add-music"){ if($("musicInput")) $("musicInput").click(); return; }
    
    if(act === "play-pause"){
      var au = $("audio");
      if(au){
        if(musicIndex < 0 && music.length){
          loadTrack(0, true);
        } else if(au.paused){
          au.play().then(updatePlayButtonUI).catch(function(){});
        } else {
          au.pause();
          updatePlayButtonUI();
        }
      }
      return;
    }
    if(act === "next-track"){ if(music.length) loadTrack((musicIndex+1)%music.length, true); return; }
    if(act === "prev-track"){ if(music.length) loadTrack((musicIndex-1+music.length)%music.length, true); return; }
    
    if(act === "settings"){
      renderSiteThemes();
      renderReaderThemes();
      updateThemeBadges();
      if($("geminiApiKey")) $("geminiApiKey").value = localStorage.getItem("kh_gemini_key") || "";
      openSheet($("sheetBack"), $("settingsSheet"));
      return;
    }
    if(act === "close-settings"){ closeSheet($("sheetBack"), $("settingsSheet")); return; }
    if(act === "clear-vocab"){
      if(confirm("هەموو وشەکان بسڕدرێنەوە؟")){ vocab = []; try{localStorage.setItem("kh_vocab","[]")}catch(err){} renderBooks(); toast("وشەکان سڕانەوە"); }
      return;
    }
    if(act === "close-word"){ closeSheet($("wordBack"), $("wordSheet")); return; }
    if(act === "save-word"){ saveWord(); return; }
    if(act === "close-sentence"){ closeSheet($("sentenceBack"), $("sentenceSheet")); return; }
  }

  // کلیک لەسەر تڕاک بۆ لێدان یان وەستان
  var tc = e.target.closest("[data-track-card]");
  if(tc){
    var tIdx = Number(tc.getAttribute("data-track-card"));
    var audioEl = $("audio");
    if(tIdx === musicIndex && audioEl && !audioEl.paused){
      audioEl.pause();
      updatePlayButtonUI();
    } else {
      loadTrack(tIdx, true);
    }
    return;
  }

  var th = e.target.closest("[data-toggle-target]");
  if(th){
    var targetId = th.getAttribute("data-toggle-target");
    var wrap = $(targetId);
    if(wrap){
      var isHidden = wrap.classList.contains("hidden");
      document.querySelectorAll(".setting-collapse").forEach(function(c){ c.classList.add("hidden"); });
      document.querySelectorAll(".setting-header").forEach(function(h){ h.classList.remove("open"); });
      if(isHidden){ wrap.classList.remove("hidden"); th.classList.add("open"); }
    }
    return;
  }

  var n = e.target.closest("[data-nav]");
  if(n){
    var v = n.getAttribute("data-nav");
    document.querySelectorAll(".nav").forEach(function(x){ x.classList.toggle("active", x===n); });
    updateTelegramBtn();
    if(v === "vocab"){ renderVocab(); return; }
    filter = v === "favorites" ? "favorites" : "all";
    document.querySelectorAll(".chip").forEach(function(c){ c.classList.toggle("active", c.getAttribute("data-filter")===filter); });
    renderBooks();
    return;
  }

  var ch = e.target.closest("[data-filter]");
  if(ch){
    filter = ch.getAttribute("data-filter");
    document.querySelectorAll(".chip").forEach(function(c){ c.classList.toggle("active", c===ch); });
    renderBooks();
    return;
  }

  var st = e.target.closest("[data-site-theme]");
  if(st){ setSiteTheme(st.getAttribute("data-site-theme")); return; }

  var srt = e.target.closest("[data-set-reader-theme]");
  if(srt){
    readerTheme = srt.getAttribute("data-set-reader-theme");
    try { localStorage.setItem("kh_reader_theme", readerTheme); } catch(err){}
    renderReaderThemes();
    updateThemeBadges();
    return;
  }

  var w = e.target.closest(".rw");
  if(w && w.getAttribute("data-word")){
    if(window.getSelection && !window.getSelection().isCollapsed){
      var sel = window.getSelection().toString().trim();
      if(sel.length > 1){ openSentenceModal(sel); return; }
    }
    openWordModal(w.getAttribute("data-word"));
    return;
  }
});

document.addEventListener("change", function(e){
  var oc = e.target.closest("[data-owner-cat]");
  if(oc){
    var bid = oc.getAttribute("data-owner-cat");
    var bk = books.find(function(x){ return x.id === bid; });
    if(bk){
      bk.category = oc.value;
      dbPut(bk).then(function(){ renderBooks(); toast("پۆل نوێکرایەوە"); });
    }
  }
});

if($("sheetBack")) $("sheetBack").addEventListener("click", function(){ closeSheet($("sheetBack"), $("settingsSheet")); });
if($("ownerBack")) $("ownerBack").addEventListener("click", function(){ closeSheet($("ownerBack"), $("ownerSheet")); });
if($("wordBack")) $("wordBack").addEventListener("click", function(){ closeSheet($("wordBack"), $("wordSheet")); });
if($("sentenceBack")) $("sentenceBack").addEventListener("click", function(){ closeSheet($("sentenceBack"), $("sentenceSheet")); });
if($("pdfInput")) $("pdfInput").addEventListener("change", function(){ addPDF(this.files[0]); });
if($("musicInput")) $("musicInput").addEventListener("change", function(){ addMusicFiles(this.files); this.value = ""; });
if($("searchInput")) $("searchInput").addEventListener("input", function(){ query = this.value.trim(); renderBooks(); });

var au = $("audio");
if(au){
  au.addEventListener("timeupdate", function(){
    if(this.duration && $("audioRange")) $("audioRange").value = Math.round(this.currentTime / this.duration * 100);
  });
  au.addEventListener("ended", function(){
    if(music.length) loadTrack((musicIndex+1)%music.length, true);
  });
  au.addEventListener("play", updatePlayButtonUI);
  au.addEventListener("pause", updatePlayButtonUI);
}

if($("audioRange")){
  $("audioRange").addEventListener("input", function(){
    var au = $("audio");
    if(au && au.duration) au.currentTime = au.duration * (Number(this.value) / 100);
  });
}

if($("geminiApiKey")){
  $("geminiApiKey").addEventListener("input", function(){
    try { localStorage.setItem("kh_gemini_key", this.value.trim()); } catch(e){}
  });
}

if($("fontSize")){
  $("fontSize").addEventListener("change", function(){
    try { localStorage.setItem("kh_font", this.value); } catch(e){}
  });
}

function init(){
  try {
    var v = localStorage.getItem("kh_vocab"); vocab = v ? JSON.parse(v) : [];
    siteTheme = localStorage.getItem("kh_site_theme") || "cyan";
    readerTheme = localStorage.getItem("kh_reader_theme") || "paper";
    musicVolume = Number(localStorage.getItem("kh_music_volume") || 0.32);
  } catch(e){}
  setSiteTheme(siteTheme);
  renderReaderThemes();
  updateThemeBadges();
  renderTracks();
  updatePlayButtonUI();
  dbAll().then(function(a){ books = a || []; renderBooks(); updateTelegramBtn(); });
}
init();

})();
