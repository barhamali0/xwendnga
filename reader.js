(function(){
"use strict";

var GEMINI_MODEL = "gemini-1.5-flash";

if(window.pdfjsLib && !pdfjsLib.GlobalWorkerOptions.workerSrc){
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";
}

var currentBook = null;
var currentPage = 0;
var currentPdfDoc = null;
var viewMode = 'canvas'; 
var isAiLoading = false;
var aiExtractedPages = {};
var geminiApiKey = "";
var readerFont = 20;
var readerTheme = "paper";
var pageKurdish = false;
var translatedPages = {};

var speechVolume = 0.85;
var speechState = "stopped";
var speechUtterance = null;
var speechTimer = null;
var speechWordIndex = 0;
var speechRate = 0.85;

var READER_THEMES = {
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

function $(id){ return document.getElementById(id); }
function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){return({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"})[c];}); }
function toast(t){
  var x = $("toast");
  if(!x) return;
  x.textContent = t;
  x.className = "toast show";
  clearTimeout(toast._t);
  toast._t = setTimeout(function(){ x.className = "toast"; }, 2400);
}

function loadReaderData(){
  try {
    geminiApiKey = localStorage.getItem("kh_gemini_key") || "";
    readerFont = Number(localStorage.getItem("kh_font") || 20);
    readerTheme = localStorage.getItem("kh_reader_theme") || "paper";
    speechVolume = Number(localStorage.getItem("kh_speech_volume") || 0.85);
    var ae = localStorage.getItem("kh_ai_pages");
    aiExtractedPages = ae ? JSON.parse(ae) : {};
  } catch(e){}
}

function applyReaderTheme(){
  var t = READER_THEMES[readerTheme] || READER_THEMES.paper;
  var r = $("reader");
  if(!r) return;
  r.style.setProperty("--reader-bg", t.bg);
  r.style.setProperty("--paper", t.paper);
  r.style.setProperty("--reader-fg", t.fg);
}

function clearSpeakHighlight(){
  var a = document.querySelectorAll(".rw.speaking");
  for(var i=0; i<a.length; i++) a[i].classList.remove("speaking");
}

function setSpeakIcon(){
  var b = $("readerSpeak");
  if(!b) return;
  b.className = "rbtn" + (speechState === "playing" ? " speaking" : "");
  b.innerHTML = speechState === "playing" ? '<i class="fa-solid fa-pause"></i>' : '<i class="fa-solid fa-play"></i>';
}

function highlightWord(i){
  clearSpeakHighlight();
  var a = document.querySelectorAll(".rw"), w = a[i];
  if(w){
    w.classList.add("speaking");
    try { w.scrollIntoView({block:"center", behavior:"smooth"}); } catch(e){}
  }
}

function stopSpeech(){
  if(window.speechSynthesis) window.speechSynthesis.cancel();
  speechState = "stopped";
  speechUtterance = null;
  clearTimeout(speechTimer);
  speechTimer = null;
  speechWordIndex = 0;
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
  if(speechState !== "playing") return;
  var words = document.querySelectorAll(".rw");
  if(speechWordIndex >= words.length){
    stopSpeech();
    return;
  }
  highlightWord(speechWordIndex);
  var curWordText = words[speechWordIndex] ? words[speechWordIndex].textContent : "";
  var delay = getWordDelay(curWordText, speechRate);
  speechWordIndex++;
  speechTimer = setTimeout(runHighlightLoop, delay);
}

function speakRemainingText(startIndex){
  var words = document.querySelectorAll(".rw");
  if(startIndex >= words.length){
    stopSpeech();
    return;
  }
  var remainingWords = [];
  for(var i=startIndex; i<words.length; i++){
    remainingWords.push(words[i].textContent);
  }
  var textToSpeak = remainingWords.join(" ");

  if(window.speechSynthesis) window.speechSynthesis.cancel();
  var u = new SpeechSynthesisUtterance(textToSpeak);
  speechUtterance = u;
  u.lang = (currentBook.lang==="ar" ? "ar-SA" : currentBook.lang==="fa" ? "fa-IR" : currentBook.lang==="ku" ? "ku-Arab" : "en-US");
  u.volume = speechVolume;
  u.rate = speechRate;

  u.onend = function(){ stopSpeech(); };
  u.onerror = function(e){
    if(e.error !== "interrupted" && e.error !== "canceled") stopSpeech();
  };

  window.speechSynthesis.speak(u);
  runHighlightLoop();
}

function startPageSpeech(){
  if(!window.speechSynthesis){ toast("خوێندنەوەی دەنگی لەم مۆبایلەدا بەردەست نییە"); return; }
  if(speechState === "playing"){
    if(window.speechSynthesis) window.speechSynthesis.cancel();
    clearTimeout(speechTimer);
    speechState = "paused";
    setSpeakIcon();
    return;
  }
  if(speechState === "paused"){
    speechState = "playing";
    setSpeakIcon();
    speakRemainingText(speechWordIndex);
    return;
  }
  var text = $("readerText").innerText.trim();
  if(!text || viewMode === 'canvas'){ toast("تکایە سەرەتا بە 🤖 دەقەڪە بڪەرەوە"); return; }
  speechState = "playing";
  speechWordIndex = 0;
  setSpeakIcon();
  speakRemainingText(0);
}

function paintText(text){
  var box = $("readerText");
  box.innerHTML = "";
  var arr = text.match(/\S+/g) || [];
  var frag = document.createDocumentFragment();
  for(var i=0; i<arr.length; i++){
    var s = document.createElement("span");
    s.className = "rw";
    s.textContent = arr[i];
    var clean = arr[i].replace(/^[.,!?;:()"'،؛؟]+|[.,!?;:()"'،؛؟]+$/g, "");
    if(clean) s.setAttribute("data-word", clean);
    frag.appendChild(s);
    if(i < arr.length-1) frag.appendChild(document.createTextNode(" "));
  }
  box.appendChild(frag);
}

function extractTextWithGemini(){
  geminiApiKey = localStorage.getItem("kh_gemini_key") || "";
  if(!geminiApiKey){
    toast("تڪایە سەرەتا کلیلی Gemini لە ڕێکخستنەکان دابنێ!");
    if(window.AppLib && window.AppLib.openSettings) window.AppLib.openSettings();
    return;
  }
  if(!currentPdfDoc){ toast("وێنەی لاپەڕە بەردەست نییە"); return; }
  if(isAiLoading) return;

  isAiLoading = true;
  toast("Gemini خەریڪی دەرهێنانی دەقەڪەیە بە کوردی... 🤖");

  currentPdfDoc.getPage(currentPage + 1).then(function(page){
    var viewport = page.getViewport({scale: 2.0});
    var offCanvas = document.createElement("canvas");
    offCanvas.width = viewport.width;
    offCanvas.height = viewport.height;
    var ctx = offCanvas.getContext('2d');

    page.render({canvasContext: ctx, viewport: viewport}).promise.then(function(){
      var base64Img = offCanvas.toDataURL("image/jpeg", 0.85).split(",")[1];
      var url = "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(GEMINI_MODEL) + ":generateContent?key=" + encodeURIComponent(geminiApiKey);

      var payload = {
        contents: [{
          parts: [
            { text: "ئەم دەقە وەڪو خۆی بەزمانی ڪوردی سۆرانی پاراو بەبێ هەڵە دەربڪە. تەنیا خودی دەقەڪە بنووسەوە بەبێ هیچ پێشەکی و پەیامێکی تر." },
            { inlineData: { mimeType: "image/jpeg", data: base64Img } }
          ]
        }]
      };

      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
      .then(function(res){
        if(!res.ok) throw new Error("کێشە لە پەیوەندی بە جێمینای (" + res.status + ")");
        return res.json();
      })
      .then(function(data){
        isAiLoading = false;
        var text = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;
        if(!text) throw new Error("دەق دەرنەهێنرا");

        var key = currentBook.id + "_" + currentPage;
        aiExtractedPages[key] = text;
        try { localStorage.setItem("kh_ai_pages", JSON.stringify(aiExtractedPages)); } catch(e){}

        viewMode = 'text';
        renderPage();
        toast("دەقەکە بە سەرکەوتوویی لە ڕێگەی Gemini دەرهێنرا! ✨");
      })
      .catch(function(err){
        isAiLoading = false;
        console.error(err);
        toast("هەڵە: کلیلەکەت نادروستە یان ئینتەرنێت کێشەی هەیە");
      });
    });
  });
}

function translateText(text){
  var url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ckb&dt=t&q=" + encodeURIComponent(text);
  return fetch(url).then(function(r){ return r.json(); }).then(function(j){ return (j[0]||[]).map(function(x){return x[0]||"";}).join("")||"—"; });
}

function togglePageKurdish(){
  if(!currentBook) return;
  stopSpeech();
  pageKurdish = !pageKurdish;
  if($("readerKurdish")) $("readerKurdish").classList.toggle("active", pageKurdish);
  if(!pageKurdish){ renderPage(); return; }

  var key = currentBook.id + "_" + currentPage;
  $("rSub").textContent = "لاپەڕە " + (currentPage + 1) + " • ڪوردی";
  if(translatedPages[key]){
    showTranslatedPage(translatedPages[key]);
    return;
  }
  $("readerText").textContent = "خەریڪی وەرگێڕانی لاپەڕەیە...";
  translateText(currentBook.pages[currentPage] || "").then(function(t){
    translatedPages[key] = t;
    showTranslatedPage(t);
  }).catch(function(){
    pageKurdish = false;
    if($("readerKurdish")) $("readerKurdish").classList.remove("active");
    renderPage();
    toast("وەرگێڕان سەرکەوتوو نەبوو");
  });
}

function showTranslatedPage(t){
  $("readerText").className = "rtext rtl";
  $("readerText").style.fontSize = readerFont + "px";
  paintText(t);
}

function showReaderTools(type){
  var title = $("toolsTitle"), body = $("toolsBody");
  if(!title || !body) return;
  
  if(type === "music"){
    title.textContent = "کۆنتڕۆڵی مۆسیقا";
    body.innerHTML = '<div style="text-align:center;padding:15px;color:var(--muted);font-size:12px;">لە بەشی خوارەوەی لاپەڕەی سەرەکی دەتوانیت دەنگ هەڵبژێریت.</div>';
  } else {
    title.textContent = "کۆنترۆڵی دەنگ و لاپەڕە";
    body.innerHTML = '<div class="vols">' +
      '<div class="vol"><label><span>🔊 دەنگی خوێندنەوە</span><b id="svt">'+Math.round(speechVolume*100)+'%</b></label>' +
      '<input id="svr" type="range" min="0" max="100" value="'+Math.round(speechVolume*100)+'"></div>' +
      '</div>' +
      '<div class="reader-col-title" style="margin-top:10px;font-size:12px;font-weight:700;">ڕەنگی لاپەڕە</div>' +
      '<div class="reader-colors">' +
      Object.keys(READER_THEMES).map(function(k){
        var t = READER_THEMES[k];
        return '<button data-reader-theme-choice="'+k+'" title="'+esc(t.name)+'" style="background:'+t.bg+';outline:'+(k===readerTheme?'2px solid var(--a)':'none')+'"><span style="background:'+t.fg+'"></span></button>';
      }).join("") +
      '</div>';

    var svr = $("svr");
    if(svr){
      svr.oninput = function(){
        speechVolume = Number(this.value) / 100;
        $("svt").textContent = Math.round(speechVolume * 100) + "%";
        try { localStorage.setItem("kh_speech_volume", speechVolume); } catch(e){}
      };
    }
  }
  $("readerTools").classList.add("show");
}

function closeReaderTools(){
  var rt = $("readerTools");
  if(rt) rt.classList.remove("show");
}

function renderPage(){
  if(!currentBook) return;
  clearSpeakHighlight();

  $("rTitle").textContent = currentBook.title;
  $("rSub").textContent = "لاپەڕە " + (currentPage + 1) + " لە " + currentBook.pageCount;
  $("pageInput").value = currentPage + 1;
  $("pageTotal").textContent = "/ " + currentBook.pageCount;

  var canvas = $("pdfCanvas");
  var textBox = $("readerText");
  var toggleBtn = $("viewToggleBtn");

  var key = currentBook.id + "_" + currentPage;
  var aiText = aiExtractedPages[key];

  if(viewMode === 'canvas' && currentPdfDoc) {
    canvas.style.display = "block";
    textBox.style.display = "none";
    if(toggleBtn){
      toggleBtn.innerHTML = '<i class="fa-solid fa-robot"></i>';
      toggleBtn.style.color = aiText ? "#22c98b" : "#f05bd5";
      toggleBtn.classList.remove("active");
    }

    currentPdfDoc.getPage(currentPage + 1).then(function(page) {
      var scale = 2.0; 
      var viewport = page.getViewport({scale: scale});
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      var ctx = canvas.getContext('2d');
      page.render({ canvasContext: ctx, viewport: viewport });
    });
  } else {
    canvas.style.display = "none";
    textBox.style.display = "block";
    if(toggleBtn){
      toggleBtn.innerHTML = '<i class="fa-regular fa-image"></i>';
      toggleBtn.style.color = "";
      toggleBtn.classList.add("active");
    }

    var text = aiText || currentBook.pages[currentPage] || "";
    var cleanTextForCheck = text.replace(/Scanned by CamScanner/gi, "").replace(/[\W_]+/g, "").trim();

    if(!aiText && cleanTextForCheck.length < 30) {
      $("readerText").className = "rtext rtl";
      $("readerText").style.fontSize = ""; 
      $("readerText").innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;padding:40px 20px;"><i class="fa-solid fa-robot" style="font-size:48px;color:var(--b);margin-bottom:15px;"></i><h3 style="color:var(--reader-fg);margin:0 0 10px;font-size:18px;">ئەم لاپەڕەیە سکانکراوە</h3><p style="color:var(--muted);font-size:13px;line-height:1.8;max-width:300px;margin:0 auto 20px;">دەقی دیجیتاڵی لەم لاپەڕەیەدا نییە. دەست لە دوگمەی خوارەوە بدە تاوەکوو بە زیرەکی دەستکردی Gemini دەقەکەت بە کوردییەکی پاراو بۆ دەربکات.</p><button class="primary" data-action="run-gemini" style="padding:12px 20px;border-radius:12px;font-size:12px;display:flex;align-items:center;justify-content:center;gap:8px;margin:0 auto;"><i class="fa-solid fa-robot"></i> دەرهێنانی دەق بە Gemini</button></div>';
    } else {
      $("readerText").className = "rtext" + (["ar","fa","ku"].indexOf(currentBook.lang)>=0 ? " rtl" : " ltr");
      $("readerText").style.fontSize = readerFont + "px";
      paintText(text);
    }
  }

  currentBook.currentPage = currentPage;
  currentBook.progress = currentBook.pageCount > 1 ? currentPage / (currentBook.pageCount - 1) : 1;
  if(window.AppLib && window.AppLib.dbPut) window.AppLib.dbPut(currentBook);
}

function changePage(d){
  if(!currentBook) return;
  closeReaderTools();
  var n = currentPage + d;
  if(n < 0 || n >= currentBook.pageCount) return;
  stopSpeech();
  pageKurdish = false;
  if($("readerKurdish")) $("readerKurdish").classList.remove("active");
  currentPage = n;
  renderPage();
}

window.ReaderEngine = {
  open: function(book){
    stopSpeech();
    currentBook = book;
    loadReaderData();
    applyReaderTheme();
    currentPage = Math.max(0, Math.min(currentBook.pageCount - 1, currentBook.currentPage || 0));
    pageKurdish = false;
    if($("readerKurdish")) $("readerKurdish").classList.remove("active");
    $("reader").classList.add("show");
    
    viewMode = (currentBook.lang === 'ku' || currentBook.lang === 'ar' || currentBook.lang === 'fa') ? 'canvas' : 'text';

    if(currentBook.pdfData){
      $("readerText").innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">خەریڪی بارڪردنی لاپەڕە...</div>';
      $("pdfCanvas").style.display = "none";
      $("readerText").style.display = "block";

      var dataToRender = new Uint8Array(currentBook.pdfData).slice(0);
      pdfjsLib.getDocument({data: dataToRender}).promise.then(function(pdf){
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
    if(window.AppLib && window.AppLib.updateTelegram) window.AppLib.updateTelegram();
  },
  close: function(){
    stopSpeech();
    $("reader").classList.remove("show");
    currentBook = null;
    currentPdfDoc = null;
    pageKurdish = false;
    closeReaderTools();
    if(window.AppLib && window.AppLib.updateTelegram) window.AppLib.updateTelegram();
  }
};

document.addEventListener("click", function(e){
  var a = e.target.closest("[data-action]");
  if(a){
    var act = a.getAttribute("data-action");

    if(act === "toggle-view" || act === "run-gemini"){
      var key = currentBook ? (currentBook.id + "_" + currentPage) : "";
      if(viewMode === 'canvas'){
        if(aiExtractedPages[key]){
          viewMode = 'text';
          renderPage();
        } else {
          extractTextWithGemini();
        }
      } else {
        viewMode = 'canvas';
        renderPage();
      }
      return;
    }
    if(act === "page-prev"){ changePage(-1); return; }
    if(act === "page-next"){ changePage(1); return; }
    if(act === "reader-close"){ window.ReaderEngine.close(); return; }
    if(act === "reader-speak"){ startPageSpeech(); return; }
    if(act === "reader-kurdish"){ togglePageKurdish(); return; }
    if(act === "reader-tools"){ showReaderTools("volume"); return; }
    if(act === "reader-music"){ showReaderTools("music"); return; }
    if(act === "tools-close"){ closeReaderTools(); return; }
    if(act === "font-down"){
      readerFont = Math.max(16, readerFont - 1);
      try { localStorage.setItem("kh_font", readerFont); } catch(err){}
      renderPage();
      return;
    }
    if(act === "font-up"){
      readerFont = Math.min(30, readerFont + 1);
      try { localStorage.setItem("kh_font", readerFont); } catch(err){}
      renderPage();
      return;
    }
    if(act === "save-progress"){
      if(currentBook && window.AppLib && window.AppLib.dbPut) window.AppLib.dbPut(currentBook);
      toast("شوێنی خوێندنەوە پاشەکەوت ڪرا");
      return;
    }
  }

  var rtc = e.target.closest("[data-reader-theme-choice]");
  if(rtc){
    readerTheme = rtc.getAttribute("data-reader-theme-choice");
    try { localStorage.setItem("kh_reader_theme", readerTheme); } catch(err){}
    applyReaderTheme();
    showReaderTools("volume");
    toast("ڕەنگی لاپەڕە گۆڕدرا");
    return;
  }
});

var pInput = $("pageInput");
if(pInput){
  pInput.addEventListener("change", function(){
    if(currentBook){
      var n = Math.max(1, Math.min(currentBook.pageCount, Number(this.value || 1)));
      stopSpeech();
      currentPage = n - 1;
      pageKurdish = false;
      renderPage();
    }
  });
}

})();
