/* =========================================================
   reader.js
   خوێندنگە — Premium Reader / PDF / Gemini / TTS
   ========================================================= */

(function () {
  "use strict";

  var GEMINI_MODEL =
    "gemini-1.5-flash";

  var currentBook = null;
  var currentPage = 0;
  var currentPdfDoc = null;

  var viewMode =
    "canvas";

  var aiLoading = false;
  var aiPages = {};

  var pageKurdish = false;
  var translatedPages = {};

  var readerFont = 20;
  var readerTheme = "paper";

  var canvasZoom = 1;

  var speechState =
    "stopped";

  var speechTimer = null;
  var speechWordIndex = 0;
  var speechRate = 0.85;
  var speechVolume = 0.85;

  var touchStartX = 0;
  var touchStartY = 0;
  var pinchStartDistance = 0;
  var pinchStartZoom = 1;

  var idleTimer = null;

  var THEMES = {
    paper: {
      name: "سپی",
      bg: "#f4f6f9",
      paper: "#ffffff",
      fg: "#1d2a3d"
    },
    cream: {
      name: "کرێمی",
      bg: "#eee5d1",
      paper: "#fff9e7",
      fg: "#403728"
    },
    mint: {
      name: "سەوزی کاڵ",
      bg: "#dfece5",
      paper: "#f4fbf7",
      fg: "#203c31"
    },
    sky: {
      name: "ئاسمانی",
      bg: "#dceef4",
      paper: "#f2fbff",
      fg: "#24414b"
    },
    rose: {
      name: "پەمەیی",
      bg: "#f0dfe2",
      paper: "#fff5f6",
      fg: "#4a2d33"
    },
    lavender: {
      name: "مۆری",
      bg: "#e6def4",
      paper: "#fbf8ff",
      fg: "#332b46"
    },
    sand: {
      name: "خۆڵەمێشی",
      bg: "#e7ded2",
      paper: "#fbf4eb",
      fg: "#493b2e"
    },
    forest: {
      name: "دارستان",
      bg: "#dee8de",
      paper: "#f5fbf3",
      fg: "#213525"
    },
    sepia: {
      name: "کەتیبی کۆن",
      bg: "#e6dbc6",
      paper: "#f7eddb",
      fg: "#4a3925"
    },
    slate: {
      name: "سڵەیت",
      bg: "#dce1e7",
      paper: "#eef1f5",
      fg: "#263341"
    },
    night: {
      name: "شەو",
      bg: "#0b1420",
      paper: "#101b2c",
      fg: "#e9f2fc"
    },
    black: {
      name: "ڕەش",
      bg: "#050505",
      paper: "#0b0b0b",
      fg: "#f1f1f1"
    }
  };

  function $(id) {
    return document.getElementById(id);
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(
      /[&<>"']/g,
      function (char) {
        return {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;"
        }[char];
      }
    );
  }

  function toast(message) {
    var el =
      $("toast");

    if (!el) return;

    el.textContent =
      message;

    el.className =
      "toast show";

    clearTimeout(
      toast._timer
    );

    toast._timer =
      setTimeout(
        function () {
          el.className =
            "toast";
        },
        2500
      );
  }

  function saveJSON(
    key,
    value
  ) {
    try {
      localStorage.setItem(
        key,
        JSON.stringify(value)
      );
    } catch (e) {}
  }

  function loadJSON(
    key,
    fallback
  ) {
    try {
      var value =
        localStorage.getItem(
          key
        );

      if (!value) {
        return fallback;
      }

      return JSON.parse(
        value
      );
    } catch (e) {
      return fallback;
    }
  }

  function loadSettings() {
    try {
      readerFont =
        Number(
          localStorage.getItem(
            "kh_font"
          ) || 20
        );

      if (
        !Number.isFinite(
          readerFont
        )
      ) {
        readerFont = 20;
      }

      readerTheme =
        localStorage.getItem(
          "kh_reader_theme"
        ) || "paper";

      speechVolume =
        Number(
          localStorage.getItem(
            "kh_speech_volume"
          ) || 0.85
        );

      if (
        !Number.isFinite(
          speechVolume
        )
      ) {
        speechVolume = 0.85;
      }

      aiPages =
        loadJSON(
          "kh_ai_pages",
          {}
        );
    } catch (e) {}
  }

  function applyTheme() {
    var theme =
      THEMES[
        readerTheme
      ] ||
      THEMES.paper;

    var reader =
      $("reader");

    if (!reader) return;

    reader.style.setProperty(
      "--reader-bg",
      theme.bg
    );

    reader.style.setProperty(
      "--paper",
      theme.paper
    );

    reader.style.setProperty(
      "--reader-fg",
      theme.fg
    );
  }

  function setFontSize(
    size
  ) {
    var value =
      Number(size);

    if (
      !Number.isFinite(
        value
      )
    ) {
      return;
    }

    readerFont =
      Math.max(
        14,
        Math.min(
          34,
          value
        )
      );

    saveJSON(
      "kh_font",
      readerFont
    );

    renderPage();
  }

  function updateReaderStatus() {
    if (!currentBook) {
      return;
    }

    var sub =
      $("rSub");

    if (sub) {
      sub.textContent =
        "لاپەڕە " +
        (currentPage + 1) +
        " لە " +
        currentBook.pageCount;
    }

    var input =
      $("pageInput");

    if (input) {
      input.value =
        currentPage + 1;
    }

    var total =
      $("pageTotal");

    if (total) {
      total.textContent =
        "/ " +
        currentBook.pageCount;
    }

    var progress =
      $("readerProgress");

    if (progress) {
      var percent =
        currentBook.pageCount >
        1
          ? (
              currentPage /
              (
                currentBook.pageCount -
                1
              )
            ) *
            100
          : 100;

      progress.style.width =
        Math.max(
          0,
          Math.min(
            100,
            percent
          )
        ) +
        "%";
    }
  }

  function setBookmarkVisual(
    active
  ) {
    var button =
      $("bookmarkButton");

    if (!button) {
      return;
    }

    button.classList.toggle(
      "bookmarked",
      !!active
    );

    button.setAttribute(
      "aria-pressed",
      active
        ? "true"
        : "false"
    );

    button.innerHTML =
      active
        ? '<i class="fa-solid fa-bookmark"></i>'
        : '<i class="fa-regular fa-bookmark"></i>';
  }

  function clearSpeechHighlight() {
    document
      .querySelectorAll(
        ".rw.speaking"
      )
      .forEach(
        function (item) {
          item.classList.remove(
            "speaking"
          );
        }
      );
  }

  function updateSpeechButton() {
    var button =
      $("readerSpeak");

    if (!button) {
      return;
    }

    button.className =
      "rbtn" +
      (
        speechState ===
        "playing"
          ? " speaking"
          : ""
      );

    button.innerHTML =
      speechState ===
      "playing"
        ? '<i class="fa-solid fa-pause"></i>'
        : '<i class="fa-solid fa-play"></i>';
  }

  function stopSpeech(
    resetIndex
  ) {
    if (
      window.speechSynthesis
    ) {
      window.speechSynthesis.cancel();
    }

    clearTimeout(
      speechTimer
    );

    speechTimer =
      null;

    speechState =
      "stopped";

    clearSpeechHighlight();

    if (
      resetIndex !==
      false
    ) {
      speechWordIndex =
        0;
    }

    updateSpeechButton();
  }

  function getWordDelay(
    word
  ) {
    var text =
      String(
        word || ""
      ).replace(
        /^[.,!?;:()"'،؛؟]+|[.,!?;:()"'،؛؟]+$/g,
        ""
      );

    var length =
      text.length || 1;

    var delay =
      190 +
      length * 40;

    if (
      /[.!?؟]/.test(
        word
      )
    ) {
      delay +=
        320;
    } else if (
      /[,،;:]/.test(
        word
      )
    ) {
      delay +=
        160;
    }

    return (
      delay /
      speechRate
    );
  }

  function highlightWord(
    index
  ) {
    clearSpeechHighlight();

    var words =
      document.querySelectorAll(
        ".rw"
      );

    var word =
      words[index];

    if (!word) {
      return;
    }

    word.classList.add(
      "speaking"
    );

    try {
      word.scrollIntoView({
        block: "center",
        behavior: "smooth"
      });
    } catch (e) {}
  }

  function speechLoop() {
    if (
      speechState !==
      "playing"
    ) {
      return;
    }

    var words =
      document.querySelectorAll(
        ".rw"
      );

    if (
      speechWordIndex >=
      words.length
    ) {
      stopSpeech();
      return;
    }

    highlightWord(
      speechWordIndex
    );

    var text =
      words[
        speechWordIndex
      ]
        ? words[
            speechWordIndex
          ].textContent
        : "";

    speechWordIndex +=
      1;

    speechTimer =
      setTimeout(
        speechLoop,
        getWordDelay(text)
      );
  }

  function speechFromIndex(
    index
  ) {
    var words =
      document.querySelectorAll(
        ".rw"
      );

    if (
      index >=
      words.length
    ) {
      stopSpeech();
      return;
    }

    var parts = [];

    for (
      var i = index;
      i < words.length;
      i++
    ) {
      parts.push(
        words[i].textContent
      );
    }

    var text =
      parts.join(
        " "
      );

    if (
      window.speechSynthesis
    ) {
      window.speechSynthesis.cancel();
    }

    var utterance =
      new SpeechSynthesisUtterance(
        text
      );

    var lang =
      currentBook &&
      currentBook.lang
        ? currentBook.lang
        : "en";

    if (lang === "ar") {
      utterance.lang =
        "ar-SA";
    } else if (
      lang === "ku"
    ) {
      utterance.lang =
        "ku-Arab";
    } else if (
      lang === "fa"
    ) {
      utterance.lang =
        "fa-IR";
    } else {
      utterance.lang =
        "en-US";
    }

    utterance.rate =
      speechRate;

    utterance.volume =
      speechVolume;

    utterance.onend =
      function () {
        stopSpeech();
      };

    utterance.onerror =
      function (event) {
        if (
          event.error ===
            "interrupted" ||
          event.error ===
            "canceled"
        ) {
          return;
        }

        stopSpeech();
      };

    speechWordIndex =
      index;

    speechState =
      "playing";

    updateSpeechButton();

    window.speechSynthesis.speak(
      utterance
    );

    speechLoop();
  }

  function startSpeech() {
    if (
      !window.speechSynthesis
    ) {
      toast(
        "خوێندنەوەی دەنگی بەردەست نییە"
      );
      return;
    }

    if (
      viewMode ===
      "canvas"
    ) {
      toast(
        "سەرەتا دەقەکە دەربهێنە بە 🤖"
      );
      return;
    }

    if (
      speechState ===
      "playing"
    ) {
      stopSpeech(
        false
      );
      speechState =
        "paused";
      updateSpeechButton();
      return;
    }

    if (
      speechState ===
      "paused"
    ) {
      speechFromIndex(
        speechWordIndex
      );
      return;
    }

    var text =
      $("readerText");

    if (
      !text ||
      !text.innerText.trim()
    ) {
      toast(
        "هیچ دەقێک بۆ خوێندنەوە نییە"
      );
      return;
    }

    speechFromIndex(
      0
    );
  }

  function paintText(
    text
  ) {
    var box =
      $("readerText");

    if (!box) {
      return;
    }

    box.innerHTML =
      "";

    var words =
      String(
        text || ""
      ).match(
        /\S+/g
      ) || [];

    var fragment =
      document.createDocumentFragment();

    words.forEach(
      function (word, index) {
        var span =
          document.createElement(
            "span"
          );

        span.className =
          "rw";

        span.textContent =
          word;

        var clean =
          word.replace(
            /^[.,!?;:()"'،؛؟]+|[.,!?;:()"'،؛؟]+$/g,
            ""
          );

        if (clean) {
          span.setAttribute(
            "data-word",
            clean
          );
        }

        fragment.appendChild(
          span
        );

        if (
          index <
          words.length -
            1
        ) {
          fragment.appendChild(
            document.createTextNode(
              " "
            )
          );
        }
      }
    );

    box.appendChild(
      fragment
    );
  }

  function getGeminiKey() {
    try {
      return (
        localStorage.getItem(
          "kh_gemini_key"
        ) || ""
      ).trim();
    } catch (e) {
      return "";
    }
  }

  function geminiPromptFor(
    language
  ) {
    if (
      language ===
      "en"
    ) {
      return (
        "Extract this page exactly as readable English text. " +
        "Preserve words, paragraphs, punctuation and numbers. " +
        "Return only the extracted text."
      );
    }

    if (
      language ===
      "ar"
    ) {
      return (
        "استخرج نص الصفحة كما هو باللغة العربية الفصحى. " +
        "حافظ على الكلمات وعلامات الترقيم والفقرات. " +
        "أعد النص فقط دون شرح."
      );
    }

    return (
      "ئەم لاپەڕەیە بە وردی بخوێنەوە و تەنها دەقی " +
      "کوردی سۆرانیی ستاندارد و پاک بۆ دەربکە. " +
      "بادینی، کورمانجی، فارسی یان لاتینی بەکارمەهێنە. " +
      "هەموو وشەکان، خاڵبەندی و ڕیزبەندی پاراگرافەکان بپارێزە. " +
      "تەنها خودی دەقەکە بنووسەوە."
    );
  }

  function extractTextWithGemini() {
    if (
      aiLoading
    ) {
      return;
    }

    var key =
      getGeminiKey();

    if (!key) {
      toast(
        "تکایە کلیلی Gemini لە ڕێکخستنەکان دابنێ"
      );

      if (
        window.AppLib &&
        window.AppLib.openSettings
      ) {
        window.AppLib.openSettings();
      }

      return;
    }

    if (
      !currentBook ||
      !currentPdfDoc
    ) {
      toast(
        "لاپەڕەی PDF بەردەست نییە"
      );
      return;
    }

    aiLoading =
      true;

    toast(
      "Gemini خەریکی دەرهێنانی دەقەکەیە..."
    );

    currentPdfDoc
      .getPage(
        currentPage + 1
      )
      .then(function (page) {
        var viewport =
          page.getViewport({
            scale: 2
          });

        var canvas =
          document.createElement(
            "canvas"
          );

        canvas.width =
          viewport.width;

        canvas.height =
          viewport.height;

        var context =
          canvas.getContext(
            "2d"
          );

        return page
          .render({
            canvasContext:
              context,
            viewport:
              viewport
          })
          .promise.then(
            function () {
              return canvas
                .toDataURL(
                  "image/jpeg",
                  0.88
                )
                .split(",")[1];
            }
          );
      })
      .then(function (
        base64
      ) {
        var url =
          "https://generativelanguage.googleapis.com/v1beta/models/" +
          encodeURIComponent(
            GEMINI_MODEL
          ) +
          ":generateContent?key=" +
          encodeURIComponent(
            key
          );

        var payload = {
          contents: [
            {
              parts: [
                {
                  text:
                    geminiPromptFor(
                      currentBook.lang
                    )
                },
                {
                  inlineData: {
                    mimeType:
                      "image/jpeg",
                    data:
                      base64
                  }
                }
              ]
            }
          ]
        };

        return fetch(
          url,
          {
            method:
              "POST",
            headers: {
              "Content-Type":
                "application/json"
            },
            body:
              JSON.stringify(
                payload
              )
          }
        );
      })
      .then(
        function (response) {
          if (!response.ok) {
            return response
              .json()
              .catch(
                function () {
                  return null;
                }
              )
              .then(function (
                data
              ) {
                var message =
                  data &&
                  data.error &&
                  data.error
                    .message
                    ? data.error
                        .message
                    : "HTTP " +
                      response.status;

                throw new Error(
                  message
                );
              });
          }

          return response.json();
        }
      )
      .then(function (
        data
      ) {
        var text =
          data &&
          data.candidates &&
          data.candidates[0] &&
          data.candidates[0]
            .content &&
          data.candidates[0]
            .content.parts &&
          data.candidates[0]
            .content.parts[0] &&
          data.candidates[0]
            .content.parts[0].text;

        if (!text) {
          throw new Error(
            "دەق نەدۆزرایەوە"
          );
        }

        var pageKey =
          currentBook.id +
          "_" +
          currentPage;

        aiPages[
          pageKey
        ] = String(
          text
        ).trim();

        saveJSON(
          "kh_ai_pages",
          aiPages
        );

        viewMode =
          "text";

        aiLoading =
          false;

        renderPage();

        toast(
          "دەقەکە دەرهێنرا ✨"
        );
      })
      .catch(function (
        error
      ) {
        aiLoading =
          false;

        console.error(
          "Gemini OCR:",
          error
        );

        toast(
          "Gemini: " +
            (
              error.message ||
              "هەڵە"
            ).slice(
              0,
              70
            )
        );
      });
  }

  function detectSourceLang(
    text
  ) {
    if (
      window.AppLib &&
      typeof window.AppLib.detectSourceLang ===
        "function"
    ) {
      return window.AppLib.detectSourceLang(
        text
      );
    }

    var value =
      String(
        text || ""
      ).trim();

    var ku =
      (
        value.match(
          /[\u06D5\u06CE\u0695\u06B5\u06A4\u06C6\u06B7\u06F6]/g
        ) || []
      ).length;

    var english =
      (
        value.match(
          /[A-Za-z]/g
        ) || []
      ).length;

    var arabic =
      (
        value.match(
          /[\u0600-\u06FF]/g
        ) || []
      ).length;

    if (ku) {
      return "ku";
    }

    if (
      english &&
      english >= arabic
    ) {
      return "en";
    }

    return "ar";
  }

  function translateText(
    text,
    targetLang
  ) {
    if (
      window.AppLib &&
      typeof window.AppLib.translateText ===
        "function"
    ) {
      return window.AppLib.translateText(
        text,
        targetLang
      );
    }

    return Promise.reject(
      new Error(
        "translateText unavailable"
      )
    );
  }

  function showTranslatedPage(
    text
  ) {
    var box =
      $("readerText");

    if (!box) return;

    box.className =
      "rtext ku rtl";

    box.style.fontSize =
      readerFont +
      "px";

    paintText(
      text
    );
  }

  function toggleKurdishPage() {
    if (!currentBook) {
      return;
    }

    stopSpeech();

    pageKurdish =
      !pageKurdish;

    var button =
      $("readerKurdish");

    if (button) {
      button.classList.toggle(
        "active",
        pageKurdish
      );
    }

    if (
      !pageKurdish
    ) {
      renderPage();
      return;
    }

    var key =
      currentBook.id +
      "_" +
      currentPage;

    if (
      translatedPages[key]
    ) {
      showTranslatedPage(
        translatedPages[key]
      );

      return;
    }

    /*
     * ئەگەر text نەبوو و AI data هەیە،
     * ئەوە بەکار دەهێنین.
     */
    var sourceText =
      (
        aiPages[key] ||
        (
          currentBook.pages &&
          currentBook.pages[
            currentPage
          ]
        ) ||
        ""
      ).trim();

    if (!sourceText) {
      toast(
        "سەرەتا دەقی لاپەڕەکە بە 🤖 دەربهێنە"
      );

      pageKurdish =
        false;

      if (button) {
        button.classList.remove(
          "active"
        );
      }

      renderPage();
      return;
    }

    var box =
      $("readerText");

    if (box) {
      box.className =
        "rtext ku rtl";

      box.textContent =
        "خەریکی وەرگێڕانە...";
    }

    translateText(
      sourceText,
      "ckb"
    )
      .then(function (
        translation
      ) {
        if (!translation) {
          throw new Error(
            "empty translation"
          );
        }

        translatedPages[key] =
          translation;

        saveJSON(
          "kh_translated_pages",
          translatedPages
        );

        showTranslatedPage(
          translation
        );

        toast(
          "وەرگێڕان تەواو بوو"
        );
      })
      .catch(function (
        error
      ) {
        console.error(
          "Page translation:",
          error
        );

        pageKurdish =
          false;

        if (button) {
          button.classList.remove(
            "active"
          );
        }

        renderPage();

        toast(
          "وەرگێڕان سەرکەوتوو نەبوو"
        );
      });
  }

  function applyCanvasZoom() {
    var canvas =
      $("pdfCanvas");

    if (!canvas) {
      return;
    }

    canvas.style.display =
      "block";

    canvas.style.width =
      (
        canvasZoom * 100
      ).toFixed(0) +
      "%";

    canvas.style.maxWidth =
      "none";

    canvas.style.height =
      "auto";

    canvas.style.margin =
      "0 auto";

    var paper =
      document.querySelector(
        ".paper"
      );

    if (paper) {
      paper.style.width =
        "100%";
      paper.style.maxWidth =
        "820px";
      paper.style.overflow =
        "visible";
    }
  }

  function setCanvasZoom(
    value
  ) {
    canvasZoom =
      Math.max(
        0.75,
        Math.min(
          2.5,
          Number(value) || 1
        )
      );

    applyCanvasZoom();
  }

  function renderCanvasPage() {
    if (
      !currentPdfDoc ||
      !currentBook
    ) {
      return Promise.resolve();
    }

    var canvas =
      $("pdfCanvas");

    if (!canvas) {
      return Promise.reject(
        new Error(
          "pdfCanvas نەدۆزرایەوە"
        )
      );
    }

    var text =
      $("readerText");

    if (text) {
      text.style.display =
        "none";
    }

    canvas.style.display =
      "block";

    return currentPdfDoc
      .getPage(
        currentPage + 1
      )
      .then(function (page) {
        var scale =
          2;

        var viewport =
          page.getViewport({
            scale:
              scale
          });

        var context =
          canvas.getContext(
            "2d"
          );

        if (!context) {
          throw new Error(
            "Canvas context missing"
          );
        }

        /*
         * Reset canvas before rendering.
         */
        canvas.width =
          Math.floor(
            viewport.width
          );

        canvas.height =
          Math.floor(
            viewport.height
          );

        return page
          .render({
            canvasContext:
              context,
            viewport:
              viewport
          })
          .promise;
      })
      .then(function () {
        applyCanvasZoom();
      });
  }

  function renderTextPage() {
    var canvas =
      $("pdfCanvas");

    var box =
      $("readerText");

    if (canvas) {
      canvas.style.display =
        "none";
    }

    if (!box) {
      return;
    }

    box.style.display =
      "block";

    var key =
      currentBook.id +
      "_" +
      currentPage;

    var text =
      (
        aiPages[key] ||
        (
          currentBook.pages &&
          currentBook.pages[
            currentPage
          ]
        ) ||
        ""
      ).trim();

    if (!text) {
      box.className =
        "rtext " +
        (
          currentBook.lang ===
          "en"
            ? "en ltr"
            : currentBook.lang ===
              "ar"
            ? "ar rtl"
            : "ku rtl"
        );

      box.style.fontSize =
        "14px";

      box.innerHTML =
        '<div style="padding:55px 18px;text-align:center;color:var(--muted);line-height:2">' +
        '<i class="fa-solid fa-robot" style="font-size:34px;color:var(--b);display:block;margin-bottom:10px"></i>' +
        "لەسەر ئەم لاپەڕەیە دەقی دیجیتاڵی نییە.<br>" +
        "دوگمەی 🤖 دابگرە بۆ دەرهێنانی دەق." +
        "</div>";

      return;
    }

    var lang =
      currentBook.lang;

    if (aiPages[key]) {
      if (
        /[A-Za-z]/.test(
          text
        ) &&
        !/[\u0600-\u06FF]/.test(
          text
        )
      ) {
        lang = "en";
      } else {
        lang = "ku";
      }
    }

    box.className =
      "rtext " +
      (
        lang ===
        "en"
          ? "en ltr"
          : lang ===
            "ar"
          ? "ar rtl"
          : "ku rtl"
      );

    box.style.fontSize =
      readerFont +
      "px";

    paintText(
      text
    );
  }

  function updateViewButton() {
    var button =
      $("viewToggleBtn");

    if (!button) {
      return;
    }

    if (
      viewMode ===
      "canvas"
    ) {
      button.innerHTML =
        '<i class="fa-solid fa-robot"></i>' +
        (
          button.querySelector(
            "span"
          )
            ? "<span>دەق</span>"
            : ""
        );

      button.classList.remove(
        "active"
      );

      return;
    }

    button.innerHTML =
      '<i class="fa-regular fa-image"></i>' +
      (
        button.querySelector(
          "span"
        )
          ? "<span>وێنە</span>"
          : ""
      );

    button.classList.add(
      "active"
    );
  }

  function renderPage() {
    if (
      !currentBook
    ) {
      return;
    }

    stopSpeech();

    updateReaderStatus();

    var key =
      currentBook.id +
      "_" +
      currentPage;

    if (
      $("rTitle")
    ) {
      $("rTitle").textContent =
        currentBook.title;
    }

    var savedPage =
      Number(
        currentBook.currentPage
      ) || 0;

    setBookmarkVisual(
      savedPage ===
        currentPage &&
        currentBook.bookmarked ===
          true
    );

    if (
      pageKurdish
    ) {
      var translated =
        translatedPages[key];

      if (translated) {
        showTranslatedPage(
          translated
        );
      } else {
        toggleKurdishPage();
      }

      return;
    }

    if (
      viewMode ===
        "canvas" &&
      currentPdfDoc
    ) {
      renderCanvasPage().catch(
        function (error) {
          console.error(
            "Canvas render:",
            error
          );

          viewMode =
            "text";

          renderTextPage();

          toast(
            "پیشاندانی Canvas سەرکەوتوو نەبوو"
          );
        }
      );
    } else {
      renderTextPage();
    }

    updateViewButton();

    currentBook.currentPage =
      currentPage;

    currentBook.progress =
      currentBook.pageCount >
      1
        ? currentPage /
          (
            currentBook.pageCount -
            1
          )
        : 1;

    currentBook.updatedAt =
      Date.now();

    if (
      window.AppLib &&
      typeof window.AppLib.dbPut ===
        "function"
    ) {
      window.AppLib.dbPut(
        currentBook
      ).catch(
        function (error) {
          console.error(
            "reader save:",
            error
          );
        }
      );
    }
  }

  function changePage(
    delta
  ) {
    if (
      !currentBook
    ) {
      return;
    }

    var next =
      currentPage +
      delta;

    if (
      next < 0 ||
      next >=
        currentBook.pageCount
    ) {
      return;
    }

    stopSpeech();

    currentPage =
      next;

    pageKurdish =
      false;

    var button =
      $("readerKurdish");

    if (button) {
      button.classList.remove(
        "active"
      );
    }

    canvasZoom =
      1;

    renderPage();
  }

  function toggleView() {
    if (
      !currentBook
    ) {
      return;
    }

    stopSpeech();

    var key =
      currentBook.id +
      "_" +
      currentPage;

    if (
      viewMode ===
      "canvas"
    ) {
      if (
        aiPages[key]
      ) {
        viewMode =
          "text";

        renderPage();
        return;
      }

      extractTextWithGemini();
      return;
    }

    viewMode =
      "canvas";

    renderPage();
  }

  function saveProgress() {
    if (
      !currentBook
    ) {
      return;
    }

    currentBook.currentPage =
      currentPage;

    currentBook.progress =
      currentBook.pageCount >
      1
        ? currentPage /
          (
            currentBook.pageCount -
            1
          )
        : 1;

    currentBook.bookmarked =
      true;

    if (
      window.AppLib &&
      typeof window.AppLib.dbPut ===
        "function"
    ) {
      window.AppLib.dbPut(
        currentBook
      )
        .then(function () {
          setBookmarkVisual(
            true
          );

          toast(
            "شوێنی خوێندنەوە پاشەکەوت کرا"
          );
        })
        .catch(function () {
          toast(
            "پاشەکەوتکردن سەرکەوتوو نەبوو"
          );
        });
    }
  }

  function showReaderTools() {
    var tools =
      $("readerTools");

    var body =
      $("toolsBody");

    if (
      !tools ||
      !body
    ) {
      return;
    }

    var musicVol =
      window.AppLib &&
      typeof window.AppLib.getMusicVolume ===
        "function"
        ? window.AppLib.getMusicVolume()
        : 0.32;

    body.innerHTML =
      '<div class="vols">' +

      '<div class="vol">' +
      '<label><span>🎵 دەنگی مۆسیقا</span><b id="mvt">' +
      Math.round(
        musicVol *
          100
      ) +
      "%</b></label>" +
      '<input id="mvr" type="range" min="0" max="100" value="' +
      Math.round(
        musicVol *
          100
      ) +
      '">' +
      "</div>" +

      '<div class="vol">' +
      '<label><span>🔊 دەنگی خوێندنەوە</span><b id="svt">' +
      Math.round(
        speechVolume *
          100
      ) +
      "%</b></label>" +
      '<input id="svr" type="range" min="0" max="100" value="' +
      Math.round(
        speechVolume *
          100
      ) +
      '">' +
      "</div>" +

      "</div>" +

      '<div class="reader-col-title">ڕەنگی لاپەڕە</div>' +

      '<div class="reader-colors">' +

      Object.keys(
        THEMES
      )
        .map(function (key) {
          var theme =
            THEMES[key];

          return (
            '<button data-reader-theme-choice="' +
            esc(key) +
            '" title="' +
            esc(
              theme.name
            ) +
            '" style="background:' +
            theme.bg +
            ";outline:" +
            (
              key ===
              readerTheme
                ? "2px solid var(--a)"
                : "none"
            ) +
            '">' +
            '<span style="background:' +
            theme.fg +
            '"></span>' +
            "</button>"
          );
        })
        .join("") +

      "</div>";

    var musicRange =
      $("mvr");

    if (
      musicRange
    ) {
      musicRange.oninput =
        function () {
          var value =
            Number(
              this.value
            ) / 100;

          if (
            window.AppLib &&
            typeof window.AppLib.setMusicVolume ===
              "function"
          ) {
            window.AppLib.setMusicVolume(
              value
            );
          }

          var label =
            $("mvt");

          if (label) {
            label.textContent =
              Math.round(
                value *
                  100
              ) +
              "%";
          }
        };
    }

    var speechRange =
      $("svr");

    if (
      speechRange
    ) {
      speechRange.oninput =
        function () {
          speechVolume =
            Number(
              this.value
            ) / 100;

          var label =
            $("svt");

          if (label) {
            label.textContent =
              Math.round(
                speechVolume *
                  100
              ) +
              "%";
          }

          try {
            localStorage.setItem(
              "kh_speech_volume",
              String(
                speechVolume
              )
            );
          } catch (e) {}
        };
    }

    tools.classList.add(
      "show"
    );
  }

  function closeReaderTools() {
    var tools =
      $("readerTools");

    if (tools) {
      tools.classList.remove(
        "show"
      );
    }
  }

  function revealChrome() {
    var reader =
      $("reader");

    if (!reader) {
      return;
    }

    reader.classList.remove(
      "reader-idle"
    );

    clearTimeout(
      idleTimer
    );

    idleTimer =
      setTimeout(
        function () {
          if (
            reader.classList.contains(
              "show"
            )
          ) {
            reader.classList.add(
              "reader-idle"
            );
          }
        },
        3500
      );
  }

  window.ReaderEngine = {
    open: function (book) {
      stopSpeech();

      loadSettings();

      currentBook =
        book;

      currentPdfDoc =
        null;

      currentPage =
        Math.max(
          0,
          Math.min(
            (
              currentBook.pageCount ||
              1
            ) - 1,
            Number(
              currentBook.currentPage
            ) || 0
          )
        );

      pageKurdish =
        false;

      canvasZoom =
        1;

      applyTheme();

      setBookmarkVisual(
        currentBook.bookmarked ===
          true
      );

      var reader =
        $("reader");

      if (reader) {
        reader.classList.add(
          "show"
        );
      }

      revealChrome();

      /*
       * English books:
       * if digital text exists -> text mode.
       * otherwise -> canvas mode.
       *
       * Kurdish/Arabic books with PDF:
       * canvas is the default.
       */
      var pageText =
        (
          currentBook.pages &&
          currentBook.pages[
            currentPage
          ]
        ) ||
        "";

      if (
        currentBook.lang ===
        "en" &&
        pageText.trim()
      ) {
        viewMode =
          "text";
      } else {
        viewMode =
          currentBook.pdfData
            ? "canvas"
            : "text";
      }

      updateReaderStatus();

      var toggle =
        $("readerKurdish");

      if (toggle) {
        toggle.classList.remove(
          "active"
        );
      }

      if (
        currentBook.pdfData
      ) {
        var bytes =
          new Uint8Array(
            currentBook.pdfData
          ).slice(
            0
          );

        if (
          !window.pdfjsLib
        ) {
          toast(
            "PDF.js بەردەست نییە"
          );

          viewMode =
            "text";

          renderPage();

          return;
        }

        pdfjsLib
          .getDocument({
            data: bytes
          })
          .promise
          .then(
            function (pdf) {
              currentPdfDoc =
                pdf;

              renderPage();
            }
          )
          .catch(
            function (error) {
              console.error(
                "PDF load:",
                error
              );

              currentPdfDoc =
                null;

              /*
               * ئەگەر PDF نەکراوە،
               * دەقە دیجیتاڵییەکەی خۆی
               * هەوڵی پیشاندان دەدەین.
               */
              viewMode =
                "text";

              renderPage();

              toast(
                "PDF نەکرایەوە، دەقی بەردەست پیشان دەدرێت"
              );
            }
          );
      } else {
        renderPage();
      }

      if (
        window.AppLib &&
        typeof window.AppLib.updateTelegram ===
          "function"
      ) {
        window.AppLib.updateTelegram();
      }
    },

    close: function () {
      stopSpeech();

      clearTimeout(
        idleTimer
      );

      closeReaderTools();

      var reader =
        $("reader");

      if (reader) {
        reader.classList.remove(
          "show"
        );
      }

      currentBook =
        null;

      currentPdfDoc =
        null;

      pageKurdish =
        false;

      if (
        window.AppLib &&
        typeof window.AppLib.updateTelegram ===
          "function"
      ) {
        window.AppLib.updateTelegram();
      }
    },

    setFontSize:
      setFontSize,

    applyTheme:
      applyTheme
  };

  document.addEventListener(
    "click",
    function (event) {
      var action =
        event.target.closest(
          "[data-action]"
        );

      if (!action) {
        return;
      }

      var name =
        action.getAttribute(
          "data-action"
        );

      if (
        name ===
        "toggle-view"
      ) {
        toggleView();
        return;
      }

      if (
        name ===
        "run-gemini"
      ) {
        extractTextWithGemini();
        return;
      }

      if (
        name ===
        "page-prev"
      ) {
        changePage(
          -1
        );
        return;
      }

      if (
        name ===
        "page-next"
      ) {
        changePage(
          1
        );
        return;
      }

      if (
        name ===
        "reader-close"
      ) {
        window.ReaderEngine.close();
        return;
      }

      if (
        name ===
        "reader-speak"
      ) {
        startSpeech();
        return;
      }

      if (
        name ===
        "reader-kurdish"
      ) {
        toggleKurdishPage();
        return;
      }

      if (
        name ===
        "reader-tools" ||
        name ===
        "reader-music"
      ) {
        showReaderTools();
        return;
      }

      if (
        name ===
        "tools-close"
      ) {
        closeReaderTools();
        return;
      }

      if (
        name ===
        "font-up"
      ) {
        if (
          viewMode ===
          "canvas"
        ) {
          setCanvasZoom(
            canvasZoom +
              0.25
          );

          toast(
            "زووم: " +
              Math.round(
                canvasZoom *
                  100
              ) +
              "%"
          );
        } else {
          setFontSize(
            readerFont + 1
          );
        }

        return;
      }

      if (
        name ===
        "font-down"
      ) {
        if (
          viewMode ===
          "canvas"
        ) {
          setCanvasZoom(
            canvasZoom -
              0.25
          );

          toast(
            "زووم: " +
              Math.round(
                canvasZoom *
                  100
              ) +
              "%"
          );
        } else {
          setFontSize(
            readerFont - 1
          );
        }

        return;
      }

      if (
        name ===
        "save-progress"
      ) {
        saveProgress();
        return;
      }
    }
  );

  var pageInput =
    $("pageInput");

  if (pageInput) {
    pageInput.addEventListener(
      "change",
      function () {
        if (
          !currentBook
        ) {
          return;
        }

        var number =
          Number(
            this.value || 1
          );

        number =
          Math.max(
            1,
            Math.min(
              currentBook.pageCount,
              number
            )
          );

        stopSpeech();

        currentPage =
          number - 1;

        pageKurdish =
          false;

        canvasZoom =
          1;

        var button =
          $("readerKurdish");

        if (button) {
          button.classList.remove(
            "active"
          );
        }

        renderPage();
      }
    );
  }

  var reader =
    $("reader");

  if (reader) {
    [
      "pointerdown",
      "keydown",
      "wheel",
      "touchstart",
      "click"
    ].forEach(
      function (eventName) {
        reader.addEventListener(
          eventName,
          revealChrome,
          {
            passive: true
          }
        );
      }
    );
  }

  var body =
    $("readerBody");

  if (body) {
    body.addEventListener(
      "touchstart",
      function (event) {
        if (
          event.touches.length ===
          2
        ) {
          var dx =
            event.touches[0]
              .clientX -
            event.touches[1]
              .clientX;

          var dy =
            event.touches[0]
              .clientY -
            event.touches[1]
              .clientY;

          pinchStartDistance =
            Math.hypot(
              dx,
              dy
            );

          pinchStartZoom =
            canvasZoom;
        } else if (
          event.touches.length ===
          1
        ) {
          touchStartX =
            event.touches[0]
              .clientX;

          touchStartY =
            event.touches[0]
              .clientY;
        }
      },
      {
        passive: true
      }
    );

    body.addEventListener(
      "touchmove",
      function (event) {
        if (
          event.touches.length ===
            2 &&
          viewMode ===
            "canvas" &&
          pinchStartDistance >
            0
        ) {
          var dx =
            event.touches[0]
              .clientX -
            event.touches[1]
              .clientX;

          var dy =
            event.touches[0]
              .clientY -
            event.touches[1]
              .clientY;

          var distance =
            Math.hypot(
              dx,
              dy
            );

          setCanvasZoom(
            pinchStartZoom *
              (
                distance /
                pinchStartDistance
              )
          );
        }
      },
      {
        passive: true
      }
    );

    body.addEventListener(
      "touchend",
      function (event) {
        if (
          pinchStartDistance >
          0
        ) {
          pinchStartDistance =
            0;

          canvasZoom =
            Math.round(
              canvasZoom *
                20
            ) / 20;

          applyCanvasZoom();

          return;
        }

        if (
          canvasZoom >
          1.05
        ) {
          return;
        }

        if (
          !event.changedTouches.length
        ) {
          return;
        }

        var dx =
          event.changedTouches[0]
            .clientX -
          touchStartX;

        var dy =
          event.changedTouches[0]
            .clientY -
          touchStartY;

        if (
          Math.abs(dx) >
            64 &&
          Math.abs(dx) >
            Math.abs(dy) *
              1.35
        ) {
          changePage(
            dx < 0
              ? 1
              : -1
          );
        }
      },
      {
        passive: true
      }
    );
  }

  document.addEventListener(
    "keydown",
    function (event) {
      var reader =
        $("reader");

      if (
        !reader ||
        !reader.classList.contains(
          "show"
        )
      ) {
        return;
      }

      if (
        event.key ===
        "ArrowLeft"
      ) {
        changePage(
          1
        );
      }

      if (
        event.key ===
        "ArrowRight"
      ) {
        changePage(
          -1
        );
      }

      if (
        event.key ===
        "Escape"
      ) {
        window.ReaderEngine.close();
      }

      if (
        event.key ===
        "+" ||
        event.key ===
        "="
      ) {
        if (
          viewMode ===
          "canvas"
        ) {
          setCanvasZoom(
            canvasZoom +
              0.25
          );
        }
      }

      if (
        event.key ===
        "-" ||
        event.key ===
        "_"
      ) {
        if (
          viewMode ===
          "canvas"
        ) {
          setCanvasZoom(
            canvasZoom -
              0.25
          );
        }
      }
    }
  );
})();
