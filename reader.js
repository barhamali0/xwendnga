/* =========================================================
   reader.js
   خوێندنگە — Reader / PDF / Gemini / TTS
   ========================================================= */

(function () {
  "use strict";

  var GEMINI_MODEL = "gemini-3.6-flash";

  var currentBook = null;
  var currentPage = 0;
  var currentPdfDoc = null;

  var viewMode = "canvas";

  var pageKurdish = false;
  var aiLoading = false;

  var aiPages = {};
  var translatedPages = {};

  var readerFont = 20;
  var readerTheme = "paper";

  var canvasZoom = 1;

  var speechState = "stopped";
  var speechRate = 0.85;
  var speechVolume = 0.85;
  var speechTimer = null;
  var speechWordIndex = 0;

  var touchStartX = 0;
  var touchStartY = 0;

  var pinchStartDistance = 0;
  var pinchStartZoom = 1;

  var idleTimer = null;

  var renderRequestId = 0;
  var wordRenderTimer = null;

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
    return String(
      value == null ? "" : value
    ).replace(
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
    var el = $("toast");

    if (!el) {
      return;
    }

    el.textContent = message;
    el.className = "toast show";

    clearTimeout(toast._timer);

    toast._timer = setTimeout(
      function () {
        el.className = "toast";
      },
      2600
    );
  }

  function saveJSON(key, value) {
    try {
      localStorage.setItem(
        key,
        JSON.stringify(value)
      );
    } catch (e) {}
  }

  function loadJSON(key, fallback) {
    try {
      var value =
        localStorage.getItem(
          key
        );

      return value
        ? JSON.parse(value)
        : fallback;
    } catch (e) {
      return fallback;
    }
  }

  /* =======================================================
     SETTINGS
     ======================================================= */

  function loadSettings() {
    var savedFont =
      Number(
        localStorage.getItem(
          "kh_font"
        ) || 20
      );

    readerFont =
      Number.isFinite(
        savedFont
      )
        ? savedFont
        : 20;

    readerFont =
      Math.max(
        14,
        Math.min(
          34,
          readerFont
        )
      );

    readerTheme =
      localStorage.getItem(
        "kh_reader_theme"
      ) ||
      "paper";

    var savedSpeechVolume =
      Number(
        localStorage.getItem(
          "kh_speech_volume"
        ) ||
          0.85
      );

    speechVolume =
      Number.isFinite(
        savedSpeechVolume
      )
        ? Math.max(
            0,
            Math.min(
              1,
              savedSpeechVolume
            )
          )
        : 0.85;

    aiPages =
      loadJSON(
        "kh_ai_pages",
        {}
      );

    translatedPages =
      loadJSON(
        "kh_translated_pages",
        {}
      );
  }

  function applyTheme() {
    var theme =
      THEMES[
        readerTheme
      ] ||
      THEMES.paper;

    var reader =
      $("reader");

    if (!reader) {
      return;
    }

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

  /* =======================================================
     STATUS / ZOOM
     ======================================================= */

  function updateZoomReadout() {
    var readout =
      $("zoomReadout");

    if (!readout) {
      return;
    }

    var percent;

    if (
      viewMode ===
      "canvas"
    ) {
      percent =
        Math.round(
          canvasZoom *
            100
        );
    } else {
      percent =
        Math.round(
          (
            readerFont /
            20
          ) *
            100
        );
    }

    percent =
      Math.max(
        50,
        Math.min(
          250,
          percent
        )
      );

    readout.textContent =
      percent +
      "%";
  }

  function updateReaderStatus() {
    if (!currentBook) {
      return;
    }

    var title =
      $("rTitle");

    if (title) {
      title.textContent =
        currentBook.title ||
        "کتێب";
    }

    var sub =
      $("rSub");

    if (sub) {
      sub.textContent =
        "لاپەڕە " +
        (
          currentPage +
          1
        ) +
        " لە " +
        (
          currentBook.pageCount ||
          1
        );
    }

    var input =
      $("pageInput");

    if (input) {
      input.value =
        currentPage +
        1;
    }

    var total =
      $("pageTotal");

    if (total) {
      total.textContent =
        "/ " +
        (
          currentBook.pageCount ||
          1
        );
    }

    var progress =
      $("readerProgress");

    if (progress) {
      var totalPages =
        Number(
          currentBook.pageCount
        ) || 1;

      var percent =
        totalPages <= 1
          ? 100
          : (
              currentPage /
              (
                totalPages -
                1
              )
            ) *
            100;

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

  function setFontSize(
    value
  ) {
    var size =
      Number(value);

    if (
      !Number.isFinite(
        size
      )
    ) {
      return;
    }

    readerFont =
      Math.max(
        14,
        Math.min(
          34,
          size
        )
      );

    try {
      localStorage.setItem(
        "kh_font",
        String(
          readerFont
        )
      );
    } catch (e) {}

    if (
      viewMode ===
      "text"
    ) {
      renderPage();
    }

    updateZoomReadout();
  }

  function setCanvasZoom(
    value
  ) {
    var zoom =
      Number(value);

    if (
      !Number.isFinite(
        zoom
      )
    ) {
      zoom = 1;
    }

    canvasZoom =
      Math.max(
        0.5,
        Math.min(
          2.5,
          zoom
        )
      );

    applyCanvasZoom();
    updateZoomReadout();
  }

  function applyCanvasZoom() {
    var canvas =
      $("pdfCanvas");

    if (!canvas) {
      updateZoomReadout();
      return;
    }

    canvas.style.display =
      "block";

    canvas.style.width =
      (
        canvasZoom *
        100
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
      paper.style.overflow =
        "visible";
    }

    updateZoomReadout();
  }

  /* =======================================================
     LANGUAGE
     ======================================================= */

  function detectPageLanguage(
    text
  ) {
    var value =
      String(
        text || ""
      );

    var ku =
      (
        value.match(
          /[\u06D5\u06CE\u0695\u06B5\u06A4\u06C6\u06B7\u06F6]/g
        ) || []
      ).length;

    var fa =
      (
        value.match(
          /[\u067E\u0686\u0698\u06AF]/g
        ) || []
      ).length;

    var en =
      (
        value.match(
          /[A-Za-z]/g
        ) || []
      ).length;

    var ar =
      (
        value.match(
          /[\u0600-\u06FF]/g
        ) || []
      ).length;

    if (
      ku >= 2
    ) {
      return "ku";
    }

    if (
      fa >= 2 &&
      en === 0
    ) {
      return "fa";
    }

    if (
      en >
      ar
    ) {
      return "en";
    }

    if (
      ar >
      0
    ) {
      return "ar";
    }

    return "en";
  }

  function detectWordLanguage(
    word,
    pageLang
  ) {
    var value =
      String(
        word || ""
      );

    if (
      /[A-Za-z]/.test(
        value
      )
    ) {
      return "en";
    }

    if (
      /[\u06D5\u06CE\u0695\u06B5\u06A4\u06C6\u06B7\u06F6]/.test(
        value
      )
    ) {
      return "ku";
    }

    if (
      /[\u067E\u0686\u0698\u06AF]/.test(
        value
      )
    ) {
      return "fa";
    }

    if (
      /[\u0600-\u06FF]/.test(
        value
      )
    ) {
      return "ar";
    }

    return (
      pageLang ||
      "en"
    );
  }

  function cleanWord(
    word
  ) {
    return String(
      word || ""
    )
      .replace(
        /^[\s"'“”‘’.,!?;:()[\]{}،؛؟…—-]+/g,
        ""
      )
      .replace(
        /[\s"'“”‘’.,!?;:()[\]{}،؛؟…—-]+$/g,
        ""
      )
      .trim();
  }

  /* =======================================================
     WORD-BY-WORD RENDERING
     ======================================================= */

  function clearWordRenderingTimer() {
    clearTimeout(
      wordRenderTimer
    );

    wordRenderTimer =
      null;
  }

  function paintText(
    text
  ) {
    clearWordRenderingTimer();

    var box =
      $("readerText");

    if (!box) {
      return;
    }

    var source =
      String(
        text || ""
      )
        .replace(
          /\r\n/g,
          "\n"
        )
        .replace(
          /\r/g,
          "\n"
        );

    var pageLang =
      detectPageLanguage(
        source
      );

    box.innerHTML =
      "";

    box.className =
      "rtext " +
      (
        pageLang ===
        "en"
          ? "en ltr"
          : pageLang ===
            "ar"
          ? "ar rtl"
          : pageLang ===
            "fa"
          ? "fa rtl"
          : "ku rtl"
      );

    box.style.fontSize =
      readerFont +
      "px";

    var fragment =
      document.createDocumentFragment();

    var lines =
      source.split(
        "\n"
      );

    lines.forEach(
      function (
        line,
        lineIndex
      ) {

        var words =
          line.match(
            /\S+/g
          ) || [];

        words.forEach(
          function (
            rawWord,
            wordIndex
          ) {

            var word =
              cleanWord(
                rawWord
              );

            var span =
              document.createElement(
                "span"
              );

            span.className =
              "rw";

            span.textContent =
              rawWord;

            if (word) {

              span.setAttribute(
                "data-word",
                word
              );

              var wordLang =
                detectWordLanguage(
                  word,
                  pageLang
                );

              if (
                wordLang ===
                "ku"
              ) {

                span.classList.add(
                  "lang-ku"
                );

              } else if (
                wordLang ===
                "ar"
              ) {

                span.classList.add(
                  "lang-ar"
                );

              } else if (
                wordLang ===
                "fa"
              ) {

                span.classList.add(
                  "lang-fa"
                );

              } else {

                span.classList.add(
                  "lang-en"
                );
              }
            }

            fragment.appendChild(
              span
            );

            if (
              wordIndex <
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

        if (
          lineIndex <
          lines.length -
            1
        ) {

          fragment.appendChild(
            document.createElement(
              "br"
            )
          );
        }
      }
    );

    box.appendChild(
      fragment
    );
  }

  /* =======================================================
     PDF TEXT RECONSTRUCTION
     ======================================================= */

  function reconstructPdfText(
    items
  ) {
    if (
      !items ||
      !items.length
    ) {
      return "";
    }

    var clean =
      items
        .filter(
          function (
            item
          ) {
            return (
              item &&
              String(
                item.str ||
                  ""
              ).length >
                0 &&
              item.transform &&
              item.transform.length >=
                6
            );
          }
        )
        .map(
          function (
            item
          ) {

            var t =
              item.transform;

            var x =
              Number(
                t[4]
              ) || 0;

            var y =
              Number(
                t[5]
              ) || 0;

            var a =
              Number(
                t[0]
              ) || 0;

            var b =
              Number(
                t[1]
              ) || 0;

            var fontSize =
              Math.sqrt(
                a * a +
                  b * b
              ) ||
              Number(
                item.height
              ) ||
              10;

            var width =
              Number(
                item.width
              );

            if (
              !Number.isFinite(
                width
              )
            ) {

              width =
                Math.max(
                  1,
                  String(
                    item.str ||
                      ""
                  ).length *
                    fontSize *
                    0.45
                );
            }

            return {
              str:
                String(
                  item.str ||
                    ""
                ),

              x:
                x,

              y:
                y,

              width:
                Math.max(
                  0,
                  width
                ),

              fontSize:
                Math.max(
                  1,
                  fontSize
                ),

              dir:
                item.dir ||
                ""
            };
          }
        );

    if (!clean.length) {
      return "";
    }

    clean.sort(
      function (
        a,
        b
      ) {
        return (
          b.y -
          a.y
        );
      }
    );

    var lines = [];

    clean.forEach(
      function (
        item
      ) {

        var found =
          null;

        for (
          var i = 0;
          i < lines.length;
          i++
        ) {

          var line =
            lines[i];

          var tolerance =
            Math.max(
              2.5,
              Math.min(
                9,
                Math.max(
                  line.fontSize,
                  item.fontSize
                ) *
                  0.55
              )
            );

          if (
            Math.abs(
              line.y -
                item.y
            ) <=
            tolerance
          ) {

            found =
              line;

            break;
          }
        }

        if (!found) {

          found = {
            y:
              item.y,

            fontSize:
              item.fontSize,

            items:
              []
          };

          lines.push(
            found
          );
        }

        found.items.push(
          item
        );

        found.fontSize =
          Math.max(
            found.fontSize,
            item.fontSize
          );
      }
    );

    lines.sort(
      function (
        a,
        b
      ) {
        return (
          b.y -
          a.y
        );
      }
    );

    function getDirection(
      line
    ) {

      var rtl =
        0;

      var ltr =
        0;

      line.items.forEach(
        function (
          item
        ) {

          var value =
            item.str;

          if (
            item.dir ===
            "rtl"
          ) {
            rtl++;
          }

          if (
            item.dir ===
            "ltr"
          ) {
            ltr++;
          }

          if (
            /[\u0600-\u06FF]/.test(
              value
            )
          ) {
            rtl++;
          }

          if (
            /[A-Za-z]/.test(
              value
            )
          ) {
            ltr++;
          }
        }
      );

      return rtl >
        ltr
        ? "rtl"
        : "ltr";
    }

    function buildLine(
      line
    ) {

      var direction =
        getDirection(
          line
        );

      line.items.sort(
        function (
          a,
          b
        ) {

          return direction ===
            "rtl"
            ? b.x -
                a.x
            : a.x -
                b.x;
        }
      );

      var useful =
        line.items.filter(
          function (
            item
          ) {
            return String(
              item.str
            ).trim().length > 0;
          }
        );

      var singleLetters =
        useful.filter(
          function (
            item
          ) {

            return /^[A-Za-z]$/.test(
              String(
                item.str
              ).trim()
            );
          }
        ).length;

      var charByCharEnglish =
        direction ===
          "ltr" &&
        useful.length >=
          3 &&
        singleLetters /
          useful.length >=
          0.55;

      var parts = [];

      useful.forEach(
        function (
          current
        ) {

          if (!parts.length) {

            parts.push({
              text:
                current.str,

              left:
                current.x,

              right:
                current.x +
                current.width,

              fontSize:
                current.fontSize
            });

            return;
          }

          var previous =
            parts[
              parts.length -
                1
            ];

          var currentLeft =
            current.x;

          var currentRight =
            current.x +
            current.width;

          var gap;

          if (
            direction ===
            "rtl"
          ) {

            gap =
              previous.left -
              currentRight;

          } else {

            gap =
              currentLeft -
              previous.right;
          }

          if (
            !Number.isFinite(
              gap
            )
          ) {
            gap = 0;
          }

          var fontSize =
            Math.max(
              1,
              previous.fontSize,
              current.fontSize
            );

          var threshold;

          if (
            charByCharEnglish
          ) {

            threshold =
              Math.max(
                0.7,
                fontSize *
                  0.82
              );

          } else {

            threshold =
              Math.max(
                1.8,
                fontSize *
                  0.48
              );
          }

          var explicitSpace =
            /\s$/.test(
              previous.text
            ) ||
            /^\s/.test(
              current.str
            );

          if (
            explicitSpace ||
            gap >
              threshold
          ) {

            previous.text =
              previous.text.replace(
                /\s+$/g,
                ""
              ) +
              " ";

            parts.push({
              text:
                current.str,

              left:
                currentLeft,

              right:
                currentRight,

              fontSize:
                current.fontSize
            });

          } else {

            previous.text +=
              current.str;

            previous.left =
              Math.min(
                previous.left,
                currentLeft
              );

            previous.right =
              Math.max(
                previous.right,
                currentRight
              );

            previous.fontSize =
              Math.max(
                previous.fontSize,
                current.fontSize
              );
          }
        }
      );

      return parts
        .map(
          function (
            part
          ) {
            return part.text;
          }
        )
        .join("")
        .replace(
          /[ \t]+/g,
          " "
        )
        .trim();
    }

    var output = [];

    lines.forEach(
      function (
        line
      ) {

        var text =
          buildLine(
            line
          );

        if (
          text
        ) {

          output.push({
            y:
              line.y,

            fontSize:
              line.fontSize,

            text:
              text
          });
        }
      }
    );

    var result =
      "";

    for (
      var i = 0;
      i < output.length;
      i++
    ) {

      var current =
        output[i];

      if (!result) {

        result =
          current.text;

        continue;
      }

      var previous =
        output[
          i - 1
        ];

      var verticalGap =
        Math.abs(
          previous.y -
            current.y
        );

      var size =
        Math.max(
          1,
          previous.fontSize,
          current.fontSize
        );

      result +=
        (
          verticalGap >
          size *
            1.8
            ? "\n\n"
            : "\n"
        ) +
        current.text;
    }

    return result
      .replace(
        /[ \t]+\n/g,
        "\n"
      )
      .replace(
        /\n[ \t]+/g,
        "\n"
      )
      .replace(
        /[ \t]{2,}/g,
        " "
      )
      .trim();
  }

  /* =======================================================
     CANVAS PDF
     ======================================================= */

  function renderCanvasPage() {

    if (
      !currentPdfDoc
    ) {
      return Promise.reject(
        new Error(
          "PDF document نەدۆزرایەوە"
        )
      );
    }

    var canvas =
      $("pdfCanvas");

    var text =
      $("readerText");

    if (
      !canvas
    ) {
      return Promise.reject(
        new Error(
          "Canvas نەدۆزرایەوە"
        )
      );
    }

    if (text) {
      text.style.display =
        "none";
    }

    canvas.style.display =
      "block";

    var pageNumber =
      currentPage +
      1;

    return currentPdfDoc
      .getPage(
        pageNumber
      )
      .then(
        function (
          page
        ) {

          var viewport =
            page.getViewport({
              scale:
                2
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

          canvas.width =
            Math.ceil(
              viewport.width
            );

          canvas.height =
            Math.ceil(
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
        }
      )
      .then(
        function () {
          applyCanvasZoom();
          updateZoomReadout();
        }
      );
  }

  /* =======================================================
     TEXT PAGE
     ======================================================= */

  function renderTextPage(
    requestId
  ) {

    var canvas =
      $("pdfCanvas");

    var box =
      $("readerText");

    if (!box) {
      return;
    }

    if (canvas) {
      canvas.style.display =
        "none";
    }

    box.style.display =
      "block";

    if (!currentBook) {
      return;
    }

    var key =
      currentBook.id +
      "_" +
      currentPage;

    /*
     * AI OCR text has priority.
     */
    if (
      aiPages[key]
    ) {

      paintText(
        aiPages[key]
      );

      updateZoomReadout();

      return Promise.resolve();
    }

    /*
     * Rebuild text directly from the live PDF.
     * This fixes old stored English text too.
     */
    if (
      currentPdfDoc
    ) {

      return currentPdfDoc
        .getPage(
          currentPage +
            1
        )
        .then(
          function (
            page
          ) {

            return page.getTextContent({
              normalizeWhitespace:
                false,

              disableCombineTextItems:
                true
            });
          }
        )
        .then(
          function (
            content
          ) {

            if (
              requestId !==
              renderRequestId
            ) {
              return;
            }

            var rebuilt =
              reconstructPdfText(
                content.items
              );

            if (
              rebuilt
            ) {

              if (
                currentBook.pages
              ) {

                currentBook.pages[
                  currentPage
                ] =
                  rebuilt;
              }

              paintText(
                rebuilt
              );

              updateZoomReadout();

              return;
            }

            renderStoredText(
              box,
              ""
            );
          }
        )
        .catch(
          function (
            error
          ) {

            console.error(
              "Text extraction:",
              error
            );

            if (
              requestId !==
              renderRequestId
            ) {
              return;
            }

            renderStoredText(
              box,
              currentBook.pages &&
                currentBook.pages[
                  currentPage
                ]
                ? currentBook.pages[
                    currentPage
                  ]
                : ""
            );
          }
        );
    }

    renderStoredText(
      box,
      currentBook.pages &&
        currentBook.pages[
          currentPage
        ]
        ? currentBook.pages[
            currentPage
          ]
        : ""
    );
  }

  function renderStoredText(
    box,
    text
  ) {

    var value =
      String(
        text || ""
      ).trim();

    if (!value) {

      box.className =
        "rtext en ltr";

      box.style.fontSize =
        "14px";

      box.innerHTML =
        '<div style="padding:55px 18px;text-align:center;color:var(--muted);line-height:2">' +

        '<i class="fa-solid fa-robot" style="font-size:34px;color:var(--b);display:block;margin-bottom:10px"></i>' +

        "لەسەر ئەم لاپەڕەیە دەقی دیجیتاڵی نییە.<br>" +

        "دوگمەی 🤖 دابگرە بۆ دەرهێنانی دەق." +

        "</div>";

      updateZoomReadout();

      return;
    }

    paintText(
      value
    );

    updateZoomReadout();
  }

  /* =======================================================
     GEMINI OCR
     ======================================================= */

  function getGeminiKey() {
    try {
      return (
        localStorage.getItem(
          "kh_gemini_key"
        ) ||
        ""
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
        "Read this book page carefully and extract the text exactly as readable English text.\n" +
        "IMPORTANT:\n" +
        "- Never put spaces between letters of the same English word.\n" +
        "- Keep normal English word boundaries.\n" +
        "- Preserve punctuation.\n" +
        "- Preserve headings and paragraphs.\n" +
        "- Preserve numbers.\n" +
        "- Do not summarize.\n" +
        "- Do not explain.\n" +
        "- Return only the extracted text."
      );
    }

    if (
      language ===
      "ar"
    ) {

      return (
        "اقرأ صفحة الكتاب بدقة واستخرج النص العربي كما يظهر.\n" +
        "- لا تضع مسافات بين حروف الكلمة الواحدة.\n" +
        "- حافظ على الكلمات وعلامات الترقيم والفقرات والعناوين والأرقام.\n" +
        "- لا تلخص.\n" +
        "- لا تشرح.\n" +
        "- أعد النص فقط."
      );
    }

    return (
      "ئەم لاپەڕەی کتێبە بە وردی بخوێنەوە و دەقەکەی دەربهێنە.\n" +
      "- تەنها کوردی سۆرانیی ستاندارد بەکاربهێنە.\n" +
      "- بادینی یان کورمانجی بەکارمەهێنە.\n" +
      "- فارسی بەجێی وشەی کوردی مەهێنە.\n" +
      "- لاتینی مەنووسە.\n" +
      "- لەنێوان پیتەکانی هەمان وشەدا بۆشایی مەخە.\n" +
      "- وشە، خاڵبەندی، سەردێڕ و پاراگرافەکان بپارێزە.\n" +
      "- پوختە مەکە.\n" +
      "- هیچ شروڤەیەک مەدە.\n" +
      "- تەنها دەقی دەرهێنراو بگەڕێنەوە."
    );
  }

  function extractTextWithGemini() {

    if (
      aiLoading
    ) {
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

    var apiKey =
      getGeminiKey();

    if (!apiKey) {

      toast(
        "تکایە کلیلی Gemini لە ڕێکخستنەکان دابنێ"
      );

      if (
        window.AppLib &&
        typeof window.AppLib.openSettings ===
          "function"
      ) {

        window.AppLib.openSettings();
      }

      return;
    }

    aiLoading =
      true;

    var button =
      $("viewToggleBtn");

    if (button) {

      button.disabled =
        true;

      button.innerHTML =
        '<i class="fa-solid fa-spinner fa-spin"></i>' +
        "<span>خەریکە...</span>";
    }

    toast(
      "Gemini خەریکی خوێندنەوەی لاپەڕەکەیە..."
    );

    currentPdfDoc
      .getPage(
        currentPage +
          1
      )
      .then(
        function (
          page
        ) {

          var viewport =
            page.getViewport({
              scale:
                2
            });

          var tempCanvas =
            document.createElement(
              "canvas"
            );

          tempCanvas.width =
            Math.ceil(
              viewport.width
            );

          tempCanvas.height =
            Math.ceil(
              viewport.height
            );

          var context =
            tempCanvas.getContext(
              "2d"
            );

          if (!context) {
            throw new Error(
              "Temporary canvas unavailable"
            );
          }

          return page
            .render({
              canvasContext:
                context,

              viewport:
                viewport
            })
            .promise
            .then(
              function () {

                return tempCanvas
                  .toDataURL(
                    "image/jpeg",
                    0.9
                  )
                  .split(
                    ","
                  )[1];
              }
            );
        }
      )
      .then(
        function (
          base64
        ) {

          var endpoint =
            "https://generativelanguage.googleapis.com/v1beta/models/" +
            encodeURIComponent(
              GEMINI_MODEL
            ) +
            ":generateContent";

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
                    inline_data: {
                      mime_type:
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
            endpoint,
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",

                "x-goog-api-key":
                  apiKey
              },

              body:
                JSON.stringify(
                  payload
                )
            }
          );
        }
      )
      .then(
        function (
          response
        ) {

          return response
            .json()
            .catch(
              function () {
                return {};
              }
            )
            .then(
              function (
                data
              ) {

                if (
                  !response.ok
                ) {

                  var message =
                    data &&
                    data.error &&
                    data.error.message
                      ? data.error.message
                      : "Gemini HTTP " +
                        response.status;

                  throw new Error(
                    message
                  );
                }

                return data;
              }
            );
        }
      )
      .then(
        function (
          data
        ) {

          var parts =
            data &&
            data.candidates &&
            data.candidates[0] &&
            data.candidates[0]
              .content &&
            data.candidates[0]
              .content.parts
              ? data.candidates[0]
                  .content.parts
              : [];

          var text =
            parts
              .map(
                function (
                  part
                ) {

                  return (
                    part &&
                    part.text
                      ? part.text
                      : ""
                  );
                }
              )
              .join(
                "\n"
              )
              .trim();

          if (!text) {

            throw new Error(
              "Gemini دەقی لاپەڕەکە نەگەڕاندەوە"
            );
          }

          var key =
            currentBook.id +
            "_" +
            currentPage;

          aiPages[key] =
            text;

          saveJSON(
            "kh_ai_pages",
            aiPages
          );

          viewMode =
            "text";

          pageKurdish =
            false;

          var kurButton =
            $("readerKurdish");

          if (kurButton) {
            kurButton.classList.remove(
              "active"
            );
          }

          aiLoading =
            false;

          updateViewButton();
          updateReaderStatus();

          renderPage();

          toast(
            "دەقەکە بە سەرکەوتوویی دەرهێنرا"
          );
        }
      )
      .catch(
        function (
          error
        ) {

          aiLoading =
            false;

          console.error(
            "Gemini OCR:",
            error
          );

          updateViewButton();

          toast(
            "Gemini: " +
              (
                error.message ||
                "هەڵە"
              ).slice(
                0,
                120
              )
          );
        }
      )
      .finally(
        function () {

          aiLoading =
            false;

          if (button) {
            button.disabled =
              false;
          }

          updateViewButton();
        }
      );
  }

  function updateViewButton() {

    var button =
      $("viewToggleBtn");

    if (!button) {
      return;
    }

    button.disabled =
      false;

    if (aiLoading) {

      button.innerHTML =
        '<i class="fa-solid fa-spinner fa-spin"></i>' +
        "<span>خەریکە...</span>";

      return;
    }

    if (
      viewMode ===
      "canvas"
    ) {

      button.innerHTML =
        '<i class="fa-solid fa-robot"></i>' +
        "<span>دەق</span>";

      button.classList.remove(
        "active"
      );

    } else {

      button.innerHTML =
        '<i class="fa-regular fa-image"></i>' +
        "<span>وێنە</span>";

      button.classList.add(
        "active"
      );
    }
  }

  /* =======================================================
     KURDISH PAGE TRANSLATION
     ======================================================= */

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

    var cached =
      translatedPages[key];

    if (cached) {

      viewMode =
        "text";

      paintText(
        cached
      );

      updateViewButton();
      updateZoomReadout();

      return;
    }

    var sourceText =
      aiPages[key] ||
      (
        currentBook.pages &&
        currentBook.pages[
          currentPage
        ]
      ) ||
      "";

    sourceText =
      String(
        sourceText
      ).trim();

    if (!sourceText) {

      pageKurdish =
        false;

      if (button) {
        button.classList.remove(
          "active"
        );
      }

      toast(
        "سەرەتا دەقی لاپەڕەکە دەربهێنە"
      );

      return;
    }

    var box =
      $("readerText");

    var canvas =
      $("pdfCanvas");

    if (canvas) {
      canvas.style.display =
        "none";
    }

    if (box) {

      box.style.display =
        "block";

      box.className =
        "rtext ku rtl";

      box.style.fontSize =
        readerFont +
        "px";

      box.innerHTML =
        '<div class="dictionary-loading">خەریکی وەرگێڕانە...</div>';
    }

    translateText(
      sourceText,
      "ckb"
    )
      .then(
        function (
          translated
        ) {

          if (!translated) {
            throw new Error(
              "Empty translation"
            );
          }

          translatedPages[key] =
            translated;

          saveJSON(
            "kh_translated_pages",
            translatedPages
          );

          viewMode =
            "text";

          paintText(
            translated
          );

          updateViewButton();
          updateZoomReadout();

          toast(
            "وەرگێڕانی کوردی تەواو بوو"
          );
        }
      )
      .catch(
        function (
          error
        ) {

          console.error(
            "Kurdish translation:",
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
        }
      );
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
        "Translation service unavailable"
      )
    );
  }

  /* =======================================================
     PAGE RENDER
     ======================================================= */

  function renderPage() {

    if (!currentBook) {
      return;
    }

    var requestId =
      ++renderRequestId;

    stopSpeech();

    updateReaderStatus();
    updateZoomReadout();
    updateViewButton();

    if (
      pageKurdish
    ) {

      var key =
        currentBook.id +
        "_" +
        currentPage;

      if (
        translatedPages[key]
      ) {

        viewMode =
          "text";

        paintText(
          translatedPages[key]
        );

        updateViewButton();
        updateZoomReadout();

        return;
      }

      /*
       * If no translated cache exists, translation
       * function will be called by toggleKurdishPage.
       */
      toggleKurdishPage();

      return;
    }

    if (
      viewMode ===
        "canvas" &&
      currentPdfDoc
    ) {

      renderCanvasPage()
        .catch(
          function (
            error
          ) {

            if (
              requestId !==
              renderRequestId
            ) {
              return;
            }

            console.error(
              "Canvas render error:",
              error
            );

            viewMode =
              "text";

            updateViewButton();

            renderTextPage(
              requestId
            );

            updateZoomReadout();
          }
        );

    } else {

      renderTextPage(
        requestId
      );
    }

    updateReaderStatus();
    updateZoomReadout();
  }

  function changePage(
    delta
  ) {

    if (!currentBook) {
      return;
    }

    var total =
      Number(
        currentBook.pageCount
      ) || 1;

    var next =
      currentPage +
      delta;

    if (
      next < 0 ||
      next >=
        total
    ) {
      return;
    }

    stopSpeech();

    currentPage =
      next;

    pageKurdish =
      false;

    canvasZoom =
      1;

    var kurButton =
      $("readerKurdish");

    if (kurButton) {
      kurButton.classList.remove(
        "active"
      );
    }

    updateReaderStatus();
    updateZoomReadout();

    renderPage();
  }

  function goToPage(
    pageNumber
  ) {

    if (!currentBook) {
      return;
    }

    var total =
      Number(
        currentBook.pageCount
      ) || 1;

    var number =
      Number(
        pageNumber
      );

    if (
      !Number.isFinite(
        number
      )
    ) {
      return;
    }

    number =
      Math.max(
        1,
        Math.min(
          total,
          Math.round(
            number
          )
        )
      );

    stopSpeech();

    currentPage =
      number -
      1;

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

    updateReaderStatus();
    updateZoomReadout();

    renderPage();
  }

  /* =======================================================
     VIEW TOGGLE
     ======================================================= */

  function toggleView() {

    if (!currentBook) {
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
        updateViewButton();
        updateZoomReadout();

        return;
      }

      extractTextWithGemini();

      return;
    }

    viewMode =
      "canvas";

    pageKurdish =
      false;

    var kurButton =
      $("readerKurdish");

    if (kurButton) {
      kurButton.classList.remove(
        "active"
      );
    }

    canvasZoom =
      1;

    renderPage();
    updateViewButton();
    updateZoomReadout();
  }

  /* =======================================================
     BOOKMARK / SAVE
     ======================================================= */

  function saveProgress() {

    if (!currentBook) {
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
        .then(
          function () {

            setBookmarkVisual(
              true
            );

            toast(
              "شوێنی خوێندنەوە پاشەکەوت کرا"
            );
          }
        )
        .catch(
          function (
            error
          ) {

            console.error(
              error
            );

            toast(
              "پاشەکەوتکردن سەرکەوتوو نەبوو"
            );
          }
        );
    }
  }

  /* =======================================================
     SPEECH
     ======================================================= */

  function clearSpeechHighlight() {

    document
      .querySelectorAll(
        ".rw.speaking"
      )
      .forEach(
        function (
          item
        ) {

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

    button.classList.toggle(
      "speaking",
      speechState ===
        "playing"
    );

    button.innerHTML =
      speechState ===
        "playing"
        ? '<i class="fa-solid fa-pause"></i>'
        : '<i class="fa-solid fa-play"></i>';
  }

  function stopSpeech(
    reset
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
      reset !==
      false
    ) {
      speechWordIndex =
        0;
    }

    updateSpeechButton();
  }

  function getSpeechLang(
    value
  ) {

    var lang =
      detectWordLanguage(
        value,
        currentBook &&
          currentBook.lang
      );

    if (
      lang ===
      "ku"
    ) {
      return "ku-Arab";
    }

    if (
      lang ===
      "ar"
    ) {
      return "ar-SA";
    }

    if (
      lang ===
      "fa"
    ) {
      return "fa-IR";
    }

    return "en-US";
  }

  function speakCurrentWord(
    element
  ) {

    if (
      !element ||
      !window.speechSynthesis
    ) {
      return;
    }

    var text =
      element.textContent.trim();

    if (!text) {
      return;
    }

    var utterance =
      new SpeechSynthesisUtterance(
        text
      );

    utterance.lang =
      getSpeechLang(
        text
      );

    utterance.rate =
      speechRate;

    utterance.volume =
      speechVolume;

    utterance.onstart =
      function () {

        clearSpeechHighlight();

        element.classList.add(
          "speaking"
        );
      };

    utterance.onend =
      function () {

        element.classList.remove(
          "speaking"
        );
      };

    utterance.onerror =
      function () {

        element.classList.remove(
          "speaking"
        );
      };

    window.speechSynthesis.cancel();

    window.speechSynthesis.speak(
      utterance
    );
  }

  function speechWords() {
    return Array.from(
      document.querySelectorAll(
        ".rw"
      )
    );
  }

  function speechDelay(
    text
  ) {

    var value =
      String(
        text || ""
      );

    var base =
      210;

    var length =
      Math.max(
        1,
        value.length
      );

    var delay =
      base +
      length *
        30;

    if (
      /[.!?؟]/.test(
        value
      )
    ) {

      delay +=
        400;

    } else if (
      /[,،;:]/.test(
        value
      )
    ) {

      delay +=
        180;
    }

    return (
      delay /
      Math.max(
        .4,
        speechRate
      )
    );
  }

  function speechLoop() {

    if (
      speechState !==
      "playing"
    ) {
      return;
    }

    var words =
      speechWords();

    if (
      speechWordIndex >=
      words.length
    ) {

      stopSpeech();
      return;
    }

    clearSpeechHighlight();

    var current =
      words[
        speechWordIndex
      ];

    if (!current) {
      stopSpeech();
      return;
    }

    current.classList.add(
      "speaking"
    );

    try {
      current.scrollIntoView({
        block:
          "center",
        behavior:
          "smooth"
      });
    } catch (e) {}

    speechWordIndex++;

    speechTimer =
      setTimeout(
        speechLoop,
        speechDelay(
          current.textContent
        )
      );
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
        "سەرەتا دەقەکە بە 🤖 دەربهێنە"
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

      speechState =
        "playing";

      updateSpeechButton();

      speechLoop();

      return;
    }

    speechWordIndex =
      0;

    speechState =
      "playing";

    updateSpeechButton();

    speechLoop();
  }

  /* =======================================================
     TOOLS
     ======================================================= */

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

    var musicVolume =
      window.AppLib &&
      typeof window.AppLib.getMusicVolume ===
        "function"
        ? window.AppLib.getMusicVolume()
        : 0.32;

    body.innerHTML =
      '<div class="vols">' +

      '<div class="vol">' +

      '<label>' +
      "<span>🎵 دەنگی مۆسیقا</span>" +
      '<b id="mvt">' +
      Math.round(
        musicVolume *
          100
      ) +
      "%</b>" +
      "</label>" +

      '<input id="mvr" type="range" min="0" max="100" value="' +
      Math.round(
        musicVolume *
          100
      ) +
      '">' +

      "</div>" +

      '<div class="vol">' +

      "<label>" +
      "<span>🔊 دەنگی خوێندنەوە</span>" +
      '<b id="svt">' +
      Math.round(
        speechVolume *
          100
      ) +
      "%</b>" +
      "</label>" +

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
        .map(
          function (
            key
          ) {

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
          }
        )
        .join("") +

      "</div>";

    var musicRange =
      $("mvr");

    if (musicRange) {

      musicRange.addEventListener(
        "input",
        function () {

          var value =
            Number(
              this.value
            ) /
            100;

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
        }
      );
    }

    var speechRange =
      $("svr");

    if (speechRange) {

      speechRange.addEventListener(
        "input",
        function () {

          speechVolume =
            Number(
              this.value
            ) /
            100;

          try {

            localStorage.setItem(
              "kh_speech_volume",
              String(
                speechVolume
              )
            );

          } catch (e) {}

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
        }
      );
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

  /* =======================================================
     IDLE UI
     ======================================================= */

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

  /* =======================================================
     READER ENGINE
     ======================================================= */

  window.ReaderEngine = {

    open:
      function (
        book
      ) {

        if (!book) {
          return;
        }

        stopSpeech();

        loadSettings();

        currentBook =
          book;

        currentPdfDoc =
          null;

        var storedPage =
          Number(
            currentBook.currentPage
          ) || 0;

        var total =
          Number(
            currentBook.pageCount
          ) || 1;

        currentPage =
          Math.max(
            0,
            Math.min(
              total -
                1,
              storedPage
            )
          );

        viewMode =
          currentBook.pdfData
            ? "canvas"
            : "text";

        pageKurdish =
          false;

        canvasZoom =
          1;

        applyTheme();

        updateReaderStatus();
        updateZoomReadout();
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

        var kurButton =
          $("readerKurdish");

        if (kurButton) {
          kurButton.classList.remove(
            "active"
          );
        }

        updateViewButton();

        /*
         * Always send a fresh COPY to PDF.js.
         * This prevents ArrayBuffer detachment
         * from destroying the stored PDF.
         */
        if (
          currentBook.pdfData &&
          window.pdfjsLib
        ) {

          var bytes =
            new Uint8Array(
              currentBook.pdfData
            ).slice(
              0
            );

          pdfjsLib
            .getDocument({
              data:
                bytes
            })
            .promise
            .then(
              function (
                pdf
              ) {

                currentPdfDoc =
                  pdf;

                renderPage();
              }
            )
            .catch(
              function (
                error
              ) {

                console.error(
                  "PDF load:",
                  error
                );

                currentPdfDoc =
                  null;

                viewMode =
                  "text";

                updateViewButton();
                renderPage();

                toast(
                  "PDF بە Canvas نەکراوە، دەقی بەردەست پیشان دەدرێت"
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

    close:
      function () {

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

          reader.classList.remove(
            "reader-idle"
          );
        }

        currentBook =
          null;

        currentPdfDoc =
          null;

        currentPage =
          0;

        pageKurdish =
          false;

        ++renderRequestId;

        updateZoomReadout();

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

  /* =======================================================
     ACTIONS
     ======================================================= */

  document.addEventListener(
    "click",
    function (
      event
    ) {

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
        "toggle-view"
      ) {

        toggleView();
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

        } else {

          setFontSize(
            readerFont +
              1
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

        } else {

          setFontSize(
            readerFont -
              1
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

  /* =======================================================
     READER THEME CHOICE
     ======================================================= */

  document.addEventListener(
    "click",
    function (
      event
    ) {

      var button =
        event.target.closest(
          "[data-reader-theme-choice]"
        );

      if (!button) {
        return;
      }

      var key =
        button.getAttribute(
          "data-reader-theme-choice"
        );

      if (
        !THEMES[key]
      ) {
        return;
      }

      readerTheme =
        key;

      try {

        localStorage.setItem(
          "kh_reader_theme",
          readerTheme
        );

      } catch (e) {}

      applyTheme();
      showReaderTools();
    }
  );

  /* =======================================================
     PAGE INPUT
     ======================================================= */

  var pageInput =
    $("pageInput");

  if (pageInput) {

    pageInput.addEventListener(
      "change",
      function () {

        goToPage(
          this.value
        );
      }
    );

    pageInput.addEventListener(
      "keydown",
      function (
        event
      ) {

        if (
          event.key ===
          "Enter"
        ) {

          goToPage(
            this.value
          );

          this.blur();
        }
      }
    );
  }

  /* =======================================================
     WORD CLICK
     ======================================================= */

  document.addEventListener(
    "click",
    function (
      event
    ) {

      var word =
        event.target.closest(
          ".rw"
        );

      if (!word) {
        return;
      }

      /*
       * Do not open dictionary when user is
       * selecting text by dragging.
       */
      var selection =
        window.getSelection
          ? window
              .getSelection()
              .toString()
              .trim()
          : "";

      if (
        selection &&
        selection.length >
          1
      ) {
        return;
      }

      var value =
        word.getAttribute(
          "data-word"
        );

      if (!value) {
        return;
      }

      /*
       * script.js owns the dictionary modal.
       */
      if (
        window.AppLib &&
        typeof window.AppLib.openWordModal ===
          "function"
      ) {

        window.AppLib.openWordModal(
          value
        );

        return;
      }

      /*
       * The current script.js keeps the word
       * modal internal, so this fallback dispatches
       * a custom event for compatibility.
       */
      try {

        document.dispatchEvent(
          new CustomEvent(
            "xwendnga:word",
            {
              detail: {
                word:
                  value
              }
            }
          )
        );

      } catch (e) {}
    }
  );

  /* =======================================================
     TOUCH / SWIPE / PINCH
     ======================================================= */

  var readerBody =
    $("readerBody");

  if (readerBody) {

    readerBody.addEventListener(
      "touchstart",
      function (
        event
      ) {

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
        passive:
          true
      }
    );

    readerBody.addEventListener(
      "touchmove",
      function (
        event
      ) {

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

          if (
            distance >
            0
          ) {

            setCanvasZoom(
              pinchStartZoom *
                (
                  distance /
                  pinchStartDistance
                )
            );
          }
        }
      },
      {
        passive:
          true
      }
    );

    readerBody.addEventListener(
      "touchend",
      function (
        event
      ) {

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
            ) /
            20;

          applyCanvasZoom();
          updateZoomReadout();

          return;
        }

        if (
          canvasZoom >
          1.05
        ) {
          return;
        }

        if (
          !event.changedTouches ||
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
            65 &&
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
        passive:
          true
      }
    );
  }

  /* =======================================================
     KEYBOARD
     ======================================================= */

  document.addEventListener(
    "keydown",
    function (
      event
    ) {

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

        return;
      }

      if (
        event.key ===
        "ArrowRight"
      ) {

        changePage(
          -1
        );

        return;
      }

      if (
        event.key ===
        "Escape"
      ) {

        window.ReaderEngine.close();

        return;
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

        return;
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

  /* =======================================================
     IDLE CHROME
     ======================================================= */

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
      function (
        eventName
      ) {

        reader.addEventListener(
          eventName,
          revealChrome,
          {
            passive:
              true
          }
        );
      }
    );
  }

})();
