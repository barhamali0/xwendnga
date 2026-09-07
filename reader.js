(function(){
"use strict";

var GEMINI_MODEL = "gemini-1.5-flash";

if(window.pdfjsLib && !pdfjsLib.GlobalWorkerOptions.workerSrc){
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";
}

var currentBook = null;
var currentPage = 0;
var currentPdfDoc = null;
var viewMode = "canvas";
var isAiLoading = false;
var aiExtractedPages = {};
var geminiApiKey = "";
var readerFont = 20;
var readerTheme = "paper";
var pageKurdish = false;
var translatedPages = {};
var canvasZoom = 1.0;

var speechVolume = 0.85;
var speechState = "stopped";
var speechUtterance = null;
var speechTimer = null;
var speechWordIndex = 0;
var speechRate = 0.85;

var READER_THEMES = {
  paper:{name:"سپی",bg:"#f4f6f9",paper:"#ffffff",fg:"#1d2a3d"},
  cream:{name:"کرێمی",bg:"#eee5d1",paper:"#fff9e7",fg:"#403728"},
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

function $(id){
  return document.getElementById(id);
}

function esc(s){
  return String(s==null?"":s).replace(
    /[&<>"']/g,
    function(c){
      return({
        "&":"&amp;",
        "<":"&lt;",
        ">":"&gt;",
        '"':"&quot;",
        "'":"&#039;"
      })[c];
    }
  );
}

function toast(t){
  var x=$("toast");

  if(!x)return;

  x.textContent=t;
  x.className="toast show";

  clearTimeout(toast._t);

  toast._t=setTimeout(
    function(){
      x.className="toast";
    },
    2400
  );
}

function loadReaderData(){

  try{

    geminiApiKey=
      (
        localStorage.getItem(
          "kh_gemini_key"
        )||""
      ).trim();

    readerFont=
      Number(
        localStorage.getItem(
          "kh_font"
        )||20
      );

    readerTheme=
      localStorage.getItem(
        "kh_reader_theme"
      )||"paper";

    speechVolume=
      Number(
        localStorage.getItem(
          "kh_speech_volume"
        )||0.85
      );

    var ae=
      localStorage.getItem(
        "kh_ai_pages"
      );

    aiExtractedPages=
      ae?
      JSON.parse(ae):
      {};

  }catch(e){}
}

function applyReaderTheme(){

  var t=
    READER_THEMES[readerTheme]||
    READER_THEMES.paper;

  var r=$("reader");

  if(!r)return;

  r.style.setProperty(
    "--reader-bg",
    t.bg
  );

  r.style.setProperty(
    "--paper",
    t.paper
  );

  r.style.setProperty(
    "--reader-fg",
    t.fg
  );
}

function clearSpeakHighlight(){

  var a=
    document.querySelectorAll(
      ".rw.speaking"
    );

  for(
    var i=0;
    i<a.length;
    i++
  ){
    a[i].classList.remove(
      "speaking"
    );
  }
}

function setSpeakIcon(){

  var b=$("readerSpeak");

  if(!b)return;

  b.className=
    "rbtn"+
    (
      speechState==="playing"?
      " speaking":
      ""
    );

  b.innerHTML=
    speechState==="playing"?
    '<i class="fa-solid fa-pause"></i>':
    '<i class="fa-solid fa-play"></i>';
}

function highlightWord(i){

  clearSpeakHighlight();

  var a=
    document.querySelectorAll(
      ".rw"
    );

  var w=a[i];

  if(w){

    w.classList.add(
      "speaking"
    );

    try{
      w.scrollIntoView({
        block:"center",
        behavior:"smooth"
      });
    }catch(e){}
  }
}

function stopSpeech(){

  if(
    window.speechSynthesis
  ){
    window.speechSynthesis.cancel();
  }

  speechState="stopped";
  speechUtterance=null;

  clearTimeout(
    speechTimer
  );

  speechTimer=null;
  speechWordIndex=0;

  clearSpeakHighlight();
  setSpeakIcon();
}

function getWordDelay(
  word,
  rate
){

  var r=
    rate||0.85;

  var clean=
    String(word||"").replace(
      /^[.,!?;:()"'،؛؟]+|[.,!?;:()"'،؛؟]+$/g,
      ""
    );

  var len=
    clean.length||1;

  var ms=
    190+
    (
      len*40
    );

  if(
    /[.!?؟]/.test(
      word
    )
  ){
    ms+=320;
  }else if(
    /[,،;:]/.test(
      word
    )
  ){
    ms+=160;
  }

  return ms/r;
}

function runHighlightLoop(){

  if(
    speechState!=="playing"
  ){
    return;
  }

  var words=
    document.querySelectorAll(
      ".rw"
    );

  if(
    speechWordIndex>=
    words.length
  ){
    stopSpeech();
    return;
  }

  highlightWord(
    speechWordIndex
  );

  var curWordText=
    words[speechWordIndex]?
    words[speechWordIndex].textContent:
    "";

  var delay=
    getWordDelay(
      curWordText,
      speechRate
    );

  speechWordIndex++;

  speechTimer=
    setTimeout(
      runHighlightLoop,
      delay
    );
}

function speakRemainingText(
  startIndex
){

  var words=
    document.querySelectorAll(
      ".rw"
    );

  if(
    startIndex>=
    words.length
  ){
    stopSpeech();
    return;
  }

  var remainingWords=[];

  for(
    var i=startIndex;
    i<words.length;
    i++
  ){

    remainingWords.push(
      words[i].textContent
    );
  }

  var textToSpeak=
    remainingWords.join(
      " "
    );

  if(
    window.speechSynthesis
  ){
    window.speechSynthesis.cancel();
  }

  var u=
    new SpeechSynthesisUtterance(
      textToSpeak
    );

  speechUtterance=u;

  u.lang=
    currentBook.lang==="ar"?
    "ar-SA":
    currentBook.lang==="fa"?
    "fa-IR":
    currentBook.lang==="ku"?
    "ku-Arab":
    "en-US";

  u.volume=speechVolume;
  u.rate=speechRate;

  u.onend=function(){
    stopSpeech();
  };

  u.onerror=function(e){

    if(
      e.error!=="interrupted"&&
      e.error!=="canceled"
    ){
      stopSpeech();
    }
  };

  window.speechSynthesis.speak(u);

  runHighlightLoop();
}

function startPageSpeech(){

  if(
    !window.speechSynthesis
  ){
    toast(
      "خوێندنەوەی دەنگی لەم مۆبایلەدا بەردەست نییە"
    );
    return;
  }

  if(
    speechState==="playing"
  ){

    if(
      window.speechSynthesis
    ){
      window.speechSynthesis.cancel();
    }

    clearTimeout(
      speechTimer
    );

    speechState="paused";
    setSpeakIcon();

    return;
  }

  if(
    speechState==="paused"
  ){

    speechState="playing";
    setSpeakIcon();

    speakRemainingText(
      speechWordIndex
    );

    return;
  }

  var text=
    $("readerText")?
    $("readerText").innerText.trim():
    "";

  if(
    !text||
    viewMode==="canvas"
  ){

    toast(
      "تکایە سەرەتا بە 🤖 دەقەکە دەربکە"
    );

    return;
  }

  speechState="playing";
  speechWordIndex=0;

  setSpeakIcon();

  speakRemainingText(0);
}

function paintText(
  text
){

  var box=$("readerText");

  if(!box)return;

  box.innerHTML="";

  var arr=
    text.match(
      /\S+/g
    )||[];

  var frag=
    document.createDocumentFragment();

  for(
    var i=0;
    i<arr.length;
    i++
  ){

    var s=
      document.createElement(
        "span"
      );

    s.className="rw";
    s.textContent=
      arr[i];

    var clean=
      arr[i].replace(
        /^[.,!?;:()"'،؛؟]+|[.,!?;:()"'،؛؟]+$/g,
        ""
      );

    if(clean){
      s.setAttribute(
        "data-word",
        clean
      );
    }

    frag.appendChild(s);

    if(
      i<arr.length-1
    ){
      frag.appendChild(
        document.createTextNode(
          " "
        )
      );
    }
  }

  box.appendChild(
    frag
  );
}

function extractTextWithGemini(){

  geminiApiKey=
    (
      localStorage.getItem(
        "kh_gemini_key"
      )||""
    ).trim();

  if(!geminiApiKey){

    toast(
      "تکایە سەرەتا کلیلی Gemini لە ڕێکخستنەکان دابنێ!"
    );

    if(
      window.AppLib&&
      window.AppLib.openSettings
    ){
      window.AppLib.openSettings();
    }

    return;
  }

  if(!currentPdfDoc){

    toast(
      "وێنەی لاپەڕە بەردەست نییە"
    );

    return;
  }

  if(isAiLoading)return;

  isAiLoading=true;

  toast(
    "Gemini خەریکی دەرهێنانی دەقەکەیە... 🤖"
  );

  currentPdfDoc
    .getPage(
      currentPage+1
    )
    .then(
      function(page){

        var viewport=
          page.getViewport({
            scale:2.0
          });

        var offCanvas=
          document.createElement(
            "canvas"
          );

        offCanvas.width=
          viewport.width;

        offCanvas.height=
          viewport.height;

        var ctx=
          offCanvas.getContext(
            "2d"
          );

        return page.render({
          canvasContext:ctx,
          viewport:viewport
        }).promise.then(
          function(){

            var base64Img=
              offCanvas
                .toDataURL(
                  "image/jpeg",
                  0.85
                )
                .split(",")[1];

            var url=
              "https://generativelanguage.googleapis.com/v1beta/models/"+
              encodeURIComponent(
                GEMINI_MODEL
              )+
              ":generateContent?key="+
              encodeURIComponent(
                geminiApiKey
              );

            var payload={
              contents:[
                {
                  parts:[
                    {
                      text:
                        "ئەم دەقە وەک خۆی بە زمانی کوردی سۆرانی پاک و ڕوون دەربکە. تەنیا خودی دەقەکە بنووسەوە، هیچ پێشەکی و هیچ ڕوونکردنەوەیەکی تر مەنووسە."
                    },
                    {
                      inlineData:{
                        mimeType:
                          "image/jpeg",
                        data:
                          base64Img
                      }
                    }
                  ]
                }
              ]
            };

            return fetch(
              url,
              {
                method:"POST",
                headers:{
                  "Content-Type":
                    "application/json"
                },
                body:
                  JSON.stringify(
                    payload
                  )
              }
            );
          }
        );
      }
    )
    .then(
      function(res){

        if(!res.ok){

          return res.json()
            .then(
              function(ej){

                var msg=
                  (
                    ej&&
                    ej.error&&
                    ej.error.message
                  )||
                  (
                    "Status "+
                    res.status
                  );

                throw new Error(
                  msg
                );
              }
            )
            .catch(
              function(err){
                throw new Error(
                  err.message||
                  (
                    "Status "+
                    res.status
                  )
                );
              }
            );
        }

        return res.json();
      }
    )
    .then(
      function(data){

        var text=
          data.candidates&&
          data.candidates[0]&&
          data.candidates[0].content&&
          data.candidates[0].content.parts&&
          data.candidates[0].content.parts[0]&&
          data.candidates[0].content.parts[0].text;

        if(!text){
          throw new Error(
            "دەق دەرنەهێنرا"
          );
        }

        var key=
          currentBook.id+
          "_"+
          currentPage;

        aiExtractedPages[key]=
          text;

        try{
          localStorage.setItem(
            "kh_ai_pages",
            JSON.stringify(
              aiExtractedPages
            )
          );
        }catch(e){}

        isAiLoading=false;
        viewMode="text";

        renderPage();

        toast(
          "دەقەکە بە سەرکەوتوویی دەرهێنرا! ✨"
        );
      }
    )
    .catch(
      function(err){

        isAiLoading=false;

        console.error(
          "Gemini OCR Error:",
          err
        );

        var m=
          err.message||"";

        if(
          m.indexOf(
            "API_KEY_INVALID"
          )>=0||
          m.indexOf(
            "400"
          )>=0
        ){

          toast(
            "کلیلی Gemini هەڵەیە، لە ڕێکخستنەکان چاکی بکە"
          );

        }else{

          toast(
            "هەڵەی Gemini: "+
            (
              m.length>40?
              m.slice(0,40)+"...":
              m
            )
          );
        }
      }
    );
}

function detectSourceLang(
  text
){

  var s=
    String(
      text||""
    ).trim();

  if(!s)return "en";

  var ku=
    (
      s.match(
        /[\u06D5\u06CE\u0695\u06B5\u06A4\u06C6\u06B7\u06F6]/g
      )||[]
    ).length;

  var fa=
    (
      s.match(
        /[\u067E\u0686\u0698\u06AF]/g
      )||[]
    ).length;

  var ar=
    (
      s.match(
        /[\u0600-\u06FF]/g
      )||[]
    ).length;

  var en=
    (
      s.match(
        /[A-Za-z]/g
      )||[]
    ).length;

  if(ku>=1)return "ku";
  if(fa>=1&&en===0)return "fa";
  if(en>0&&en>=ar)return "en";
  if(ar>0)return "ar";

  return "en";
}

function mapTranslationLang(
  lang,
  forMyMemory
){

  var l=
    String(
      lang||""
    ).toLowerCase();

  if(
    l==="ckb"||
    l==="ku-arab"||
    l==="ku"
  ){

    return forMyMemory?
      "ku":
      "ckb";
  }

  if(
    l==="ar"||
    l==="ar-sa"
  ){
    return "ar";
  }

  if(
    l==="fa"||
    l==="fa-ir"
  ){
    return "fa";
  }

  if(
    l==="en"||
    l==="en-us"
  ){
    return "en";
  }

  return forMyMemory?
    "en":
    "ckb";
}

function translateText(
  text,
  targetLang
){

  var clean=
    String(
      text||""
    ).trim();

  if(!clean){
    return Promise.resolve("");
  }

  var googleTarget=
    mapTranslationLang(
      targetLang||"ckb",
      false
    );

  var source=
    detectSourceLang(
      clean
    );

  var googleSource=
    mapTranslationLang(
      source,
      false
    );

  if(
    googleSource===
    googleTarget
  ){

    return Promise.resolve(
      clean
    );
  }

  var googleUrl=
    "https://translate.googleapis.com/translate_a/single"+
    "?client=gtx"+
    "&sl="+
    encodeURIComponent(
      googleSource
    )+
    "&tl="+
    encodeURIComponent(
      googleTarget
    )+
    "&dt=t"+
    "&q="+
    encodeURIComponent(
      clean
    );

  return fetch(
    googleUrl
  )

  .then(
    function(r){

      if(!r.ok){
        throw new Error(
          "Google HTTP "+
          r.status
        );
      }

      return r.json();
    }
  )

  .then(
    function(j){

      var result=
        (j[0]||[])
          .map(
            function(x){
              return x[0]||"";
            }
          )
          .join("")
          .trim();

      if(!result){

        throw new Error(
          "Google returned empty translation"
        );
      }

      return result;
    }
  )

  .catch(
    function(){

      var mmSource=
        mapTranslationLang(
          source,
          true
        );

      var mmTarget=
        mapTranslationLang(
          targetLang||"ckb",
          true
        );

      if(
        mmSource===
        mmTarget
      ){

        return clean;
      }

      var pair=
        mmSource+
        "|"+
        mmTarget;

      var mmUrl=
        "https://api.mymemory.translated.net/get"+
        "?q="+
        encodeURIComponent(
          clean.slice(0,500)
        )+
        "&langpair="+
        encodeURIComponent(
          pair
        );

      return fetch(
        mmUrl
      )

      .then(
        function(r){

          if(!r.ok){

            throw new Error(
              "MyMemory HTTP "+
              r.status
            );
          }

          return r.json();
        }
      )

      .then(
        function(data){

          if(
            data&&
            data.responseStatus&&
            Number(
              data.responseStatus
            )!==200
          ){

            throw new Error(
              "MyMemory "+
              data.responseStatus
            );
          }

          var result=
            data&&
            data.responseData&&
            data.responseData.translatedText;

          if(!result){

            throw new Error(
              "MyMemory returned empty translation"
            );
          }

          return String(
            result
          ).trim();
        }
      );
    }
  );
}

function togglePageKurdish(){

  if(!currentBook)return;

  stopSpeech();

  pageKurdish=
    !pageKurdish;

  if(
    $("readerKurdish")
  ){
    $("readerKurdish")
      .classList.toggle(
        "active",
        pageKurdish
      );
  }

  if(!pageKurdish){

    renderPage();

    return;
  }

  var key=
    currentBook.id+
    "_"+
    currentPage;

  if(
    $("rSub")
  ){

    $("rSub").textContent=
      "لاپەڕە "+
      (
        currentPage+1
      )+
      " • کوردی";
  }

  if(
    translatedPages[key]
  ){

    showTranslatedPage(
      translatedPages[key]
    );

    return;
  }

  if(
    $("readerText")
  ){

    $("readerText").textContent=
      "خەریکی وەرگێڕانی لاپەڕەیە...";
  }

  var textToTranslate=
    (
      currentBook.pages&&
      currentBook.pages[currentPage]
    )||
    "";

  translateText(
    textToTranslate,
    "ckb"
  )

  .then(
    function(t){

      translatedPages[key]=
        t;

      showTranslatedPage(
        t
      );
    }
  )

  .catch(
    function(){

      pageKurdish=false;

      if(
        $("readerKurdish")
      ){

        $("readerKurdish")
          .classList.remove(
            "active"
          );
      }

      renderPage();

      toast(
        "وەرگێڕان سەرکەوتوو نەبوو"
      );
    }
  );
}

function showTranslatedPage(
  t
){

  var rText=
    $("readerText");

  if(!rText)return;

  rText.className=
    "rtext rtl";

  rText.style.fontSize=
    readerFont+
    "px";

  paintText(t);
}

function showReaderTools(){

  var title=
    $("toolsTitle");

  var body=
    $("toolsBody");

  if(
    !title||
    !body
  ){
    return;
  }

  var currentMusicVolume=
    window.AppLib&&
    window.AppLib.getMusicVolume?
    window.AppLib.getMusicVolume():
    0.32;

  title.textContent=
    "کۆنترۆڵی دەنگ و ڕەنگ";

  body.innerHTML=
    '<div class="vols">'+

    '<div class="vol">'+
    '<label><span>🎵 دەنگی مۆسیقا</span><b id="mvt">'+
    Math.round(
      currentMusicVolume*100
    )+
    '%</b></label>'+
    '<input id="mvr" type="range" min="0" max="100" value="'+
    Math.round(
      currentMusicVolume*100
    )+
    '">'+
    '</div>'+

    '<div class="vol">'+
    '<label><span>🔊 دەنگی خوێندنەوە</span><b id="svt">'+
    Math.round(
      speechVolume*100
    )+
    '%</b></label>'+
    '<input id="svr" type="range" min="0" max="100" value="'+
    Math.round(
      speechVolume*100
    )+
    '">'+
    '</div>'+

    '</div>'+

    '<div class="reader-col-title" style="margin-top:12px;font-size:12px;font-weight:700;">ڕەنگی لاپەڕە</div>'+

    '<div class="reader-colors">'+

    Object.keys(
      READER_THEMES
    ).map(
      function(k){

        var t=
          READER_THEMES[k];

        return '<button data-reader-theme-choice="'+
          k+
          '" title="'+
          esc(t.name)+
          '" style="background:'+
          t.bg+
          ';outline:'+
          (
            k===readerTheme?
            "2px solid var(--a)":
            "none"
          )+
          '">'+
          '<span style="background:'+
          t.fg+
          '"></span>'+
          '</button>';
      }
    ).join("")+

    '</div>';

  var svr=
    $("svr");

  if(svr){

    svr.oninput=
      function(){

        speechVolume=
          Number(
            this.value
          )/100;

        if(
          $("svt")
        ){

          $("svt").textContent=
            Math.round(
              speechVolume*100
            )+
            "%";
        }

        try{
          localStorage.setItem(
            "kh_speech_volume",
            speechVolume
          );
        }catch(e){}
      };
  }

  var mvr=
    $("mvr");

  if(mvr){

    mvr.oninput=
      function(){

        var v=
          Number(
            this.value
          )/100;

        if(
          $("mvt")
        ){

          $("mvt").textContent=
            Math.round(
              v*100
            )+
            "%";
        }

        if(
          window.AppLib&&
          window.AppLib.setMusicVolume
        ){

          window.AppLib.setMusicVolume(
            v
          );
        }
      };
  }

  var rt=
    $("readerTools");

  if(rt){
    rt.classList.add(
      "show"
    );
  }
}

function closeReaderTools(){

  var rt=
    $("readerTools");

  if(rt){
    rt.classList.remove(
      "show"
    );
  }
}

function applyCanvasZoomStyle(){

  var canvas=
    $("pdfCanvas");

  if(!canvas)return;

  var widthPercent=
    Math.round(
      canvasZoom*100
    );

  canvas.style.display=
    "block";

  canvas.style.width=
    widthPercent+
    "%";

  canvas.style.maxWidth=
    "none";

  canvas.style.height=
    "auto";

  canvas.style.margin=
    "0 auto";

  var paper=
    document.querySelector(
      ".paper"
    );

  if(paper){

    paper.style.width=
      "100%";

    paper.style.maxWidth=
      "820px";

    paper.style.overflow=
      "visible";
  }
}

function renderPage(){

  if(!currentBook)return;

  clearSpeakHighlight();

  if(
    $("rTitle")
  ){

    $("rTitle").textContent=
      currentBook.title;
  }

  if(
    $("rSub")
  ){

    $("rSub").textContent=
      "لاپەڕە "+
      (
        currentPage+1
      )+
      " لە "+
      currentBook.pageCount;
  }

  if(
    $("pageInput")
  ){

    $("pageInput").value=
      currentPage+1;
  }

  if(
    $("pageTotal")
  ){

    $("pageTotal").textContent=
      "/ "+
      currentBook.pageCount;
  }

  var canvas=
    $("pdfCanvas");

  var textBox=
    $("readerText");

  var toggleBtn=
    $("viewToggleBtn");

  var key=
    currentBook.id+
    "_"+
    currentPage;

  var aiText=
    aiExtractedPages[key];

  if(
    viewMode==="canvas"&&
    currentPdfDoc
  ){

    if(canvas){
      canvas.style.display=
        "block";
    }

    if(textBox){
      textBox.style.display=
        "none";
    }

    if(toggleBtn){

      toggleBtn.innerHTML=
        '<i class="fa-solid fa-robot"></i>';

      toggleBtn.style.color=
        aiText?
        "#22c98b":
        "";

      toggleBtn.classList.remove(
        "active"
      );
    }

    currentPdfDoc
      .getPage(
        currentPage+1
      )
      .then(
        function(page){

          var scale=2.0;

          var viewport=
            page.getViewport({
              scale:scale
            });

          canvas.width=
            viewport.width;

          canvas.height=
            viewport.height;

          var ctx=
            canvas.getContext(
              "2d"
            );

          return page
            .render({
              canvasContext:ctx,
              viewport:viewport
            })
            .promise;
        }
      )
      .then(
        function(){
          applyCanvasZoomStyle();
        }
      )
      .catch(
        function(e){
          console.error(
            "Canvas render error:",
            e
          );
          toast(
            "نەتوانرا لاپەڕەکە پیشان بدرێت"
          );
        }
      );

  }else{

    if(canvas){
      canvas.style.display=
        "none";
    }

    if(textBox){
      textBox.style.display=
        "block";
    }

    var paper=
      document.querySelector(
        ".paper"
      );

    if(paper){

      paper.style.maxWidth=
        "100%";

      paper.style.width=
        "100%";

      paper.style.overflowX=
        "visible";
    }

    if(toggleBtn){

      toggleBtn.innerHTML=
        '<i class="fa-regular fa-image"></i>';

      toggleBtn.style.color=
        "#f05bd5";

      toggleBtn.classList.add(
        "active"
      );
    }

    var text=
      aiText||
      (
        currentBook.pages?
        currentBook.pages[currentPage]:
        ""
      )||
      "";

    if(!text.trim()){

      textBox.className=
        "rtext rtl";

      textBox.style.fontSize=
        "14px";

      textBox.innerHTML=
        '<div style="text-align:center;padding:60px 20px;color:var(--muted);line-height:2;">'+
        '<i class="fa-solid fa-robot" style="font-size:36px;color:var(--b);display:block;margin-bottom:12px;"></i>'+
        'دەقی دیجیتاڵی لەسەر ئەم لاپەڕەیە نییە.<br>'+
        'دەست لە دوگمەی سەرەوە بدە بۆ گەڕانەوە بۆ وێنەی ڕەسەن، یان دەقی کوردی دەربهێنە.'+
        '</div>';

    }else{

      textBox.className=
        "rtext"+
        (
          ["ar","fa","ku"].indexOf(
            currentBook.lang
          )>=0?
          " rtl":
          " ltr"
        );

      textBox.style.fontSize=
        readerFont+
        "px";

      paintText(
        text
      );
    }
  }

  currentBook.currentPage=
    currentPage;

  currentBook.progress=
    currentBook.pageCount>1?
    currentPage/
    (
      currentBook.pageCount-1
    ):
    1;

  if(
    window.AppLib&&
    window.AppLib.dbPut
  ){

    window.AppLib.dbPut(
      currentBook
    );
  }
}

function changePage(d){

  if(!currentBook)return;

  closeReaderTools();

  var n=
    currentPage+d;

  if(
    n<0||
    n>=currentBook.pageCount
  ){
    return;
  }

  stopSpeech();

  pageKurdish=false;

  if(
    $("readerKurdish")
  ){

    $("readerKurdish")
      .classList.remove(
        "active"
      );
  }

  currentPage=n;

  renderPage();
}

window.ReaderEngine={

  open:function(book){

    stopSpeech();

    currentBook=
      book;

    loadReaderData();

    applyReaderTheme();

    currentPage=
      Math.max(
        0,
        Math.min(
          currentBook.pageCount-1,
          currentBook.currentPage||0
        )
      );

    pageKurdish=false;

    canvasZoom=1.0;

    if(
      $("readerKurdish")
    ){

      $("readerKurdish")
        .classList.remove(
          "active"
        );
    }

    if(
      $("reader")
    ){

      $("reader")
        .classList.add(
          "show"
        );
    }

    viewMode=
      currentBook.pdfData?
      "canvas":
      "text";

    if(
      currentBook.pdfData
    ){

      if(
        $("readerText")
      ){

        $("readerText")
          .innerHTML=
          '<div style="text-align:center;padding:40px;color:var(--muted)">خەریکی بارکردنی لاپەڕە...</div>';

        $("readerText")
          .style.display=
          "block";
      }

      if(
        $("pdfCanvas")
      ){

        $("pdfCanvas")
          .style.display=
          "none";
      }

      var dataToRender=
        new Uint8Array(
          currentBook.pdfData
        ).slice(0);

      pdfjsLib
        .getDocument({
          data:dataToRender
        })
        .promise
        .then(
          function(pdf){

            currentPdfDoc=
              pdf;

            renderPage();
          }
        )
        .catch(
          function(e){

            console.error(
              "PDF Load Error:",
              e
            );

            currentPdfDoc=
              null;

            viewMode=
              "text";

            renderPage();
          }
        );

    }else{

      currentPdfDoc=
        null;

      viewMode=
        "text";

      renderPage();
    }

    if(
      window.AppLib&&
      window.AppLib.updateTelegram
    ){

      window.AppLib.updateTelegram();
    }
  },

  close:function(){

    stopSpeech();

    if(
      $("reader")
    ){

      $("reader")
        .classList.remove(
          "show"
        );
    }

    currentBook=
      null;

    currentPdfDoc=
      null;

    pageKurdish=
      false;

    closeReaderTools();

    if(
      window.AppLib&&
      window.AppLib.updateTelegram
    ){

      window.AppLib.updateTelegram();
    }
  }
};

document.addEventListener(
  "click",
  function(e){

    var a=
      e.target.closest(
        "[data-action]"
      );

    if(a){

      var act=
        a.getAttribute(
          "data-action"
        );

      if(
        act==="toggle-view"||
        act==="run-gemini"
      ){

        var key=
          currentBook?
          (
            currentBook.id+
            "_"+
            currentPage
          ):
          "";

        if(
          viewMode==="canvas"
        ){

          if(
            aiExtractedPages[key]
          ){

            viewMode=
              "text";

            renderPage();

          }else{

            extractTextWithGemini();
          }

        }else{

          viewMode=
            "canvas";

          renderPage();
        }

        return;
      }

      if(
        act==="page-prev"
      ){

        changePage(-1);
        return;
      }

      if(
        act==="page-next"
      ){

        changePage(1);
        return;
      }

      if(
        act==="reader-close"
      ){

        window.ReaderEngine.close();
        return;
      }

      if(
        act==="reader-speak"
      ){

        startPageSpeech();
        return;
      }

      if(
        act==="reader-kurdish"
      ){

        togglePageKurdish();
        return;
      }

      if(
        act==="reader-tools"||
        act==="reader-music"
      ){

        showReaderTools();
        return;
      }

      if(
        act==="tools-close"
      ){

        closeReaderTools();
        return;
      }

      if(
        act==="font-up"
      ){

        if(
          viewMode==="canvas"
        ){

          canvasZoom=
            Math.min(
              2.5,
              Math.round(
                (
                  canvasZoom+0.25
                )*100
              )/100
            );

          applyCanvasZoomStyle();

          toast(
            "گەورەکردن: "+
            Math.round(
              canvasZoom*100
            )+
            "%"
          );

        }else{

          readerFont=
            Math.min(
              32,
              readerFont+1
            );

          try{
            localStorage.setItem(
              "kh_font",
              readerFont
            );
          }catch(err){}

          renderPage();
        }

        return;
      }

      if(
        act==="font-down"
      ){

        if(
          viewMode==="canvas"
        ){

          canvasZoom=
            Math.max(
              0.75,
              Math.round(
                (
                  canvasZoom-0.25
                )*100
              )/100
            );

          applyCanvasZoomStyle();

          toast(
            "بچووککردن: "+
            Math.round(
              canvasZoom*100
            )+
            "%"
          );

        }else{

          readerFont=
            Math.max(
              14,
              readerFont-1
            );

          try{
            localStorage.setItem(
              "kh_font",
              readerFont
            );
          }catch(err){}

          renderPage();
        }

        return;
      }

      if(
        act==="save-progress"
      ){

        if(
          currentBook&&
          window.AppLib&&
          window.AppLib.dbPut
        ){

          window.AppLib.dbPut(
            currentBook
          );
        }

        toast(
          "شوێنی خوێندنەوە پاشەکەوت کرا"
        );

        return;
      }
    }

    var rtc=
      e.target.closest(
        "[data-reader-theme-choice]"
      );

    if(rtc){

      readerTheme=
        rtc.getAttribute(
          "data-reader-theme-choice"
        );

      try{

        localStorage.setItem(
          "kh_reader_theme",
          readerTheme
        );

      }catch(err){}

      applyReaderTheme();

      showReaderTools();

      toast(
        "ڕەنگی لاپەڕە گۆڕدرا"
      );

      return;
    }
  }
);

var pInput=
  $("pageInput");

if(pInput){

  pInput.addEventListener(
    "change",
    function(){

      if(currentBook){

        var n=
          Math.max(
            1,
            Math.min(
              currentBook.pageCount,
              Number(
                this.value||1
              )
            )
          );

        stopSpeech();

        currentPage=
          n-1;

        pageKurdish=false;

        renderPage();
      }
    }
  );
}

})();
