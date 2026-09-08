/* =========================================================
   script.js
   خوێندنگە — Core App
   ========================================================= */

(function () {
  "use strict";

  var books = [];
  var vocab = [];
  var music = [];
  var musicIndex = -1;

  var filter = "all";
  var query = "";

  var siteTheme = "cyan";
  var readerTheme = "paper";

  var musicVolume = 0.32;

  var currentWord = "";
  var currentWordLang = "en";
  var currentWordMeanings = {
    ku: [],
    ar: []
  };

  var CATEGORIES = [
    "گشتی",
    "زمان",
    "ئەدەب",
    "مێژوو",
    "زانست",
    "فەلسەفە",
    "ئایین",
    "ئینگلیزی"
  ];

  var SITE_THEMES = {
    cyan: {
      name: "شینی ئاسمانی",
      a: "#35bbff",
      b: "#7b61ff",
      bg: "#07111f",
      bg2: "#0d182a",
      surface: "#111f34",
      surface2: "#182943",
      line: "#29405d"
    },
    violet: {
      name: "مۆری",
      a: "#8b6cff",
      b: "#d35cff",
      bg: "#0b081b",
      bg2: "#160f2a",
      surface: "#1d1735",
      surface2: "#282047",
      line: "#47386a"
    },
    emerald: {
      name: "سەوزی",
      a: "#22c98b",
      b: "#0ca6a0",
      bg: "#061611",
      bg2: "#0c241d",
      surface: "#102b23",
      surface2: "#173b30",
      line: "#2b5849"
    },
    sunset: {
      name: "خۆرئاوابوون",
      a: "#ff8a4c",
      b: "#ff4f81",
      bg: "#190b09",
      bg2: "#291410",
      surface: "#351914",
      surface2: "#48231d",
      line: "#693b30"
    },
    ruby: {
      name: "سووری",
      a: "#ff536d",
      b: "#c93dff",
      bg: "#18070d",
      bg2: "#280d19",
      surface: "#361421",
      surface2: "#451b2d",
      line: "#623247"
    },
    royal: {
      name: "شینی قووڵ",
      a: "#4c7dff",
      b: "#36c4ff",
      bg: "#061029",
      bg2: "#0b1940",
      surface: "#10204a",
      surface2: "#17295a",
      line: "#304a80"
    },
    gold: {
      name: "زێڕی",
      a: "#f2bf4a",
      b: "#ff8554",
      bg: "#160f05",
      bg2: "#281809",
      surface: "#34230e",
      surface2: "#452d12",
      line: "#66491f"
    },
    rose: {
      name: "پەمەیی",
      a: "#f05bd5",
      b: "#ff7b8e",
      bg: "#150714",
      bg2: "#250e22",
      surface: "#34152f",
      surface2: "#451c3f",
      line: "#623457"
    },
    ocean: {
      name: "دەریایی",
      a: "#20d6d6",
      b: "#3a7bff",
      bg: "#041216",
      bg2: "#06242b",
      surface: "#0c3038",
      surface2: "#10434e",
      line: "#255b67"
    },
    graphite: {
      name: "گرافایت",
      a: "#aab7c8",
      b: "#62728a",
      bg: "#0a0e13",
      bg2: "#141923",
      surface: "#1c242e",
      surface2: "#27303d",
      line: "#3c4858"
    },
    lime: {
      name: "لایمی",
      a: "#a7df45",
      b: "#24c68a",
      bg: "#0d1605",
      bg2: "#17260a",
      surface: "#223613",
      surface2: "#30471b",
      line: "#4d652b"
    },
    midnight: {
      name: "میدناو",
      a: "#607dff",
      b: "#8b5cf6",
      bg: "#050817",
      bg2: "#0a1025",
      surface: "#101833",
      surface2: "#182344",
      line: "#2f4069"
    }
  };

  var READER_THEMES = {
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
      function (c) {
        return {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;"
        }[c];
      }
    );
  }

  function toast(message) {
    var el = $("toast");
    if (!el) return;

    el.textContent = message;
    el.className = "toast show";

    clearTimeout(toast._timer);

    toast._timer = setTimeout(function () {
      el.className = "toast";
    }, 2500);
  }

  function openSheet(back, sheet) {
    if (!back || !sheet) return;

    back.classList.add("open");
    sheet.classList.add("open");

    updateTelegramBtn();
  }

  function closeSheet(back, sheet) {
    if (!back || !sheet) return;

    back.classList.remove("open");
    sheet.classList.remove("open");

    updateTelegramBtn();
  }

  function updateTelegramBtn() {
    var btn = $("telegramBtn");
    if (!btn) return;

    var reader = $("reader");
    var readerOpen =
      reader &&
      reader.classList.contains("show");

    var activeNav = document.querySelector(
      ".nav.active"
    );

    var isHome =
      activeNav &&
      activeNav.getAttribute("data-nav") === "home";

    var sheetOpen = document.querySelector(
      ".sheet.open,.back.open"
    );

    btn.style.display =
      isHome &&
      !readerOpen &&
      !sheetOpen
        ? "flex"
        : "none";
  }

  function dbOpen() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) {
        reject(new Error("IndexedDB بەردەست نییە"));
        return;
      }

      var request = indexedDB.open(
        "kh_reader_v10",
        1
      );

      request.onupgradeneeded = function () {
        var db = request.result;

        if (!db.objectStoreNames.contains("books")) {
          db.createObjectStore("books", {
            keyPath: "id"
          });
        }
      };

      request.onsuccess = function () {
        resolve(request.result);
      };

      request.onerror = function () {
        reject(
          request.error ||
            new Error("نەتوانرا داتابەیس بکرێتەوە")
        );
      };
    });
  }

  function dbAll() {
    return dbOpen().then(function (db) {
      return new Promise(function (resolve, reject) {
        var transaction;

        try {
          transaction = db.transaction(
            "books",
            "readonly"
          );
        } catch (e) {
          reject(e);
          return;
        }

        var req = transaction
          .objectStore("books")
          .getAll();

        req.onsuccess = function () {
          resolve(req.result || []);
        };

        req.onerror = function () {
          reject(req.error);
        };
      });
    });
  }

  function dbPut(book) {
    return dbOpen().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx;

        try {
          tx = db.transaction(
            "books",
            "readwrite"
          );
        } catch (e) {
          reject(e);
          return;
        }

        tx.objectStore("books").put(book);

        tx.oncomplete = function () {
          resolve(book);
        };

        tx.onerror = function () {
          reject(
            tx.error ||
              new Error("نەتوانرا کتێبەکە پاشەکەوت بکرێت")
          );
        };

        tx.onabort = function () {
          reject(
            tx.error ||
              new Error("پاشەکەوتکردن هەڵوەشایەوە")
          );
        };
      });
    });
  }

  function dbDelete(id) {
    return dbOpen().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx;

        try {
          tx = db.transaction(
            "books",
            "readwrite"
          );
        } catch (e) {
          reject(e);
          return;
        }

        tx.objectStore("books").delete(id);

        tx.oncomplete = resolve;

        tx.onerror = function () {
          reject(tx.error);
        };
      });
    });
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
      var value = localStorage.getItem(key);

      if (!value) return fallback;

      return JSON.parse(value);
    } catch (e) {
      return fallback;
    }
  }

  function updateThemeBadges() {
    var site =
      SITE_THEMES[siteTheme] ||
      SITE_THEMES.cyan;

    var reader =
      READER_THEMES[readerTheme] ||
      READER_THEMES.paper;

    var siteLabel =
      $("siteThemeLabel");

    if (siteLabel) {
      siteLabel.textContent = site.name;
    }

    var siteDot =
      $("siteThemeDot");

    if (siteDot) {
      siteDot.style.background = site.a;
    }

    var readerLabel =
      $("readerThemeLabel");

    if (readerLabel) {
      readerLabel.textContent = reader.name;
    }

    var readerDot =
      $("readerThemeDot");

    if (readerDot) {
      readerDot.style.background = reader.bg;
    }
  }

  function setSiteTheme(key) {
    var theme =
      SITE_THEMES[key] ||
      SITE_THEMES.cyan;

    siteTheme = key;

    var root =
      document.documentElement;

    root.style.setProperty(
      "--a",
      theme.a
    );

    root.style.setProperty(
      "--b",
      theme.b
    );

    root.style.setProperty(
      "--accent",
      theme.a
    );

    root.style.setProperty(
      "--bg",
      theme.bg
    );

    root.style.setProperty(
      "--bg2",
      theme.bg2
    );

    root.style.setProperty(
      "--surface",
      theme.surface
    );

    root.style.setProperty(
      "--surface2",
      theme.surface2
    );

    root.style.setProperty(
      "--line",
      theme.line
    );

    try {
      localStorage.setItem(
        "kh_site_theme",
        key
      );
    } catch (e) {}

    renderSiteThemes();
    updateThemeBadges();
  }

  function renderSiteThemes() {
    var box = $("siteThemes");
    if (!box) return;

    var html = "";

    Object.keys(SITE_THEMES).forEach(function (key) {
      var theme = SITE_THEMES[key];

      html +=
        '<button class="theme ' +
        (key === siteTheme ? "active" : "") +
        '" data-site-theme="' +
        esc(key) +
        '" title="' +
        esc(theme.name) +
        '" style="background:linear-gradient(145deg,' +
        theme.bg2 +
        "," +
        theme.bg +
        ')">' +
        '<i style="background:' +
        theme.a +
        '"></i>' +
        '<b style="background:linear-gradient(90deg,' +
        theme.a +
        "," +
        theme.b +
        ')"></b>' +
        "</button>";
    });

    box.innerHTML = html;
  }

  function renderReaderThemes() {
    var box = $("readerThemes");
    if (!box) return;

    var html = "";

    Object.keys(READER_THEMES).forEach(
      function (key) {
        var theme =
          READER_THEMES[key];

        html +=
          '<button class="theme ' +
          (key === readerTheme
            ? "active"
            : "") +
          '" data-set-reader-theme="' +
          esc(key) +
          '" title="' +
          esc(theme.name) +
          '" style="background:' +
          theme.bg +
          '">' +
          '<i style="background:' +
          theme.fg +
          '"></i>' +
          '<b style="background:' +
          theme.fg +
          '"></b>' +
          "</button>";
      }
    );

    box.innerHTML = html;
  }

  function detectLang(text) {
    var sample =
      String(text || "").slice(
        0,
        20000
      );

    var kurdish =
      (
        sample.match(
          /[\u06D5\u06CE\u0695\u06B5\u06A4\u06C6\u06B7\u06F6]/g
        ) || []
      ).length;

    var persian =
      (
        sample.match(
          /[\u067E\u0686\u0698\u06AF]/g
        ) || []
      ).length;

    var english =
      (
        sample.match(
          /[A-Za-z]/g
        ) || []
      ).length;

    var arabic =
      (
        sample.match(
          /[\u0600-\u06FF]/g
        ) || []
      ).length;

    if (kurdish >= 2) return "ku";

    if (
      persian >= 2 &&
      english === 0
    ) {
      return "fa";
    }

    if (
      english > 0 &&
      english >= arabic
    ) {
      return "en";
    }

    if (arabic > 0) {
      return "ar";
    }

    return "en";
  }

  function normalizePdfText(items) {
    if (!items || !items.length) {
      return "";
    }

    return items
      .map(function (item) {
        return String(
          item && item.str
            ? item.str
            : ""
        );
      })
      .join(" ")
      .replace(/[ \t]+/g, " ")
      .trim();
  }

  function extractPDF(file) {
    return new Promise(function (resolve, reject) {
      if (!file) {
        reject(
          new Error("PDF file نەدۆزرایەوە")
        );
        return;
      }

      if (!window.pdfjsLib) {
        reject(
          new Error("PDF.js بەردەست نییە")
        );
        return;
      }

      var reader =
        new FileReader();

      reader.onload = function () {
        try {
          var buffer =
            reader.result;

          if (
            !buffer ||
            !buffer.byteLength
          ) {
            reject(
              new Error(
                "PDF buffer بەتاڵە"
              )
            );
            return;
          }

          /*
           * دوو copy دروست دەکەین:
           * یەکێک بۆ PDF.js
           * یەکێکی تر بۆ IndexedDB
           *
           * ئەمە کێشەی detached ArrayBuffer چارەسەر دەکات.
           */
          var pdfBytes =
            new Uint8Array(
              buffer.slice(0)
            );

          var storedBytes =
            new Uint8Array(
              buffer.slice(0)
            );

          pdfjsLib
            .getDocument({
              data: pdfBytes
            })
            .promise
            .then(function (pdf) {
              var pages = [];
              var chain =
                Promise.resolve();

              for (
                let pageNumber = 1;
                pageNumber <= pdf.numPages;
                pageNumber++
              ) {
                (function (pageNo) {
                  chain = chain.then(
                    function () {
                      return pdf
                        .getPage(pageNo)
                        .then(function (page) {
                          return page
                            .getTextContent({
                              normalizeWhitespace: false,
                              disableCombineTextItems: true
                            })
                            .then(function (content) {
                              pages.push(
                                normalizePdfText(
                                  content.items
                                )
                              );
                            });
                        });
                    }
                  );
                })(pageNumber);
              }

              return chain.then(
                function () {
                  resolve({
                    pages: pages,
                    lang: detectLang(
                      pages.join("\n")
                    ),
                    pageCount:
                      pdf.numPages,
                    pdfData:
                      storedBytes
                  });
                }
              );
            })
            .catch(reject);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = function () {
        reject(
          reader.error ||
            new Error(
              "PDF خوێندرایەوە نەبوو"
            )
        );
      };

      reader.readAsArrayBuffer(file);
    });
  }

  function addPDF(file) {
    if (!file) return;

    toast(
      "PDF خەریکی بارکردنە..."
    );

    extractPDF(file)
      .then(function (data) {
        var book = {
          id:
            String(Date.now()) +
            "_" +
            Math.floor(
              Math.random() *
                100000
            ),

          title:
            file.name.replace(
              /\.pdf$/i,
              ""
            ),

          author: "",

          category:
            "گشتی",

          isPublished:
            true,

          pages:
            data.pages || [],

          pdfData:
            data.pdfData,

          lang:
            data.lang || "en",

          pageCount:
            data.pageCount ||
            (data.pages
              ? data.pages.length
              : 0),

          currentPage: 0,

          progress: 0,

          favorite: false,

          addedAt:
            Date.now()
        };

        return dbPut(book);
      })
      .then(function (savedBook) {
        books.push(savedBook);

        renderBooks();
        renderOwnerPanel();

        toast(
          "کتێبەکە بە سەرکەوتوویی زیادکرا"
        );
      })
      .catch(function (error) {
        console.error(
          "addPDF:",
          error
        );

        toast(
          "نەتوانرا PDF زیاد بکرێت"
        );
      });

    var input = $("pdfInput");
    if (input) {
      input.value = "";
    }
  }

  function langName(lang) {
    if (lang === "ku") return "کوردی";
    if (lang === "ar") return "عەرەبی";
    if (lang === "fa") return "فارسی";
    return "ئینگلیزی";
  }

  function filteredBooks() {
    var list =
      books
        .slice()
        .sort(function (a, b) {
          return (
            (b.addedAt || 0) -
            (a.addedAt || 0)
          );
        });

    if (filter === "favorites") {
      list = list.filter(function (book) {
        return !!book.favorite;
      });
    } else if (filter === "recent") {
      list = list.slice(
        0,
        8
      );
    } else if (
      filter !== "all"
    ) {
      list = list.filter(function (book) {
        return (
          book.category ||
          "گشتی"
        ) === filter;
      });
    }

    if (query) {
      var q =
        query.toLowerCase();

      list = list.filter(function (book) {
        var text =
          [
            book.title,
            book.author,
            book.category
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

        return (
          text.indexOf(q) >= 0
        );
      });
    }

    return list;
  }

  function renderBooks() {
    var list =
      filteredBooks();

    var count =
      $("bookCount");

    if (count) {
      count.textContent =
        books.length;
    }

    var words =
      $("wordCount");

    if (words) {
      words.textContent =
        vocab.length;
    }

    var hint =
      $("resultHint");

    if (hint) {
      hint.textContent =
        list.length +
        " کتێب";
    }

    var container =
      $("bookList");

    if (!container) return;

    if (!list.length) {
      container.innerHTML =
        '<div class="empty" style="grid-column:1/-1;text-align:center;padding:35px;color:var(--muted)">' +
        '<i class="fa-solid fa-book-open" style="font-size:32px;margin-bottom:9px"></i>' +
        '<h3 style="margin:5px 0;color:#e9f2fb;font-size:14px">' +
        (query
          ? "هیچ ئەنجامێک نەدۆزرایەوە"
          : "هێشتا کتێب نییە") +
        "</h3>" +
        '<div style="font-size:10px">PDF ـێک زیاد بکە بۆ دەستپێکردن.</div>' +
        "</div>";

      return;
    }

    container.innerHTML =
      list
        .map(function (book) {
          var progress =
            Math.round(
              (Number(
                book.progress
              ) || 0) *
                100
            );

          return (
            '<article class="book" data-book="' +
            esc(book.id) +
            '">' +

            '<button class="fav" data-action="fav" title="دڵخواز">'+
            '<i class="' +
            (book.favorite
              ? "fa-solid"
              : "fa-regular") +
            ' fa-heart"></i>' +
            "</button>" +

            '<div class="cover">' +
            '<i class="fa-solid fa-book-bookmark"></i>' +
            "</div>" +

            '<div class="book-main">' +

            '<div class="book-title">' +
            esc(book.title) +
            "</div>" +

            '<div class="book-author">' +
            esc(
              book.author ||
              "نووسەری دیارینەکراو"
            ) +
            "</div>" +

            '<div class="meta">' +

            "<span>" +
            '<i class="fa-regular fa-file-lines"></i> ' +
            (book.pageCount || 0) +
            " لاپەڕە</span>" +

            "<span>" +
            '<i class="fa-solid fa-language"></i> ' +
            esc(
              langName(
                book.lang
              )
            ) +
            "</span>" +

            '<span class="tag-badge">' +
            esc(
              book.category ||
              "گشتی"
            ) +
            "</span>" +

            "</div>" +

            '<div class="progress">' +
            '<span style="width:' +
            progress +
            '%"></span>' +
            "</div>" +

            '<div class="actions">' +

            '<button class="small primary" data-action="open-book">' +
            '<i class="fa-solid fa-book-open"></i> خوێندنەوە' +
            "</button>" +

            '<button class="small" data-action="del-book" title="سڕینەوە">' +
            '<i class="fa-regular fa-trash-can"></i>' +
            "</button>" +

            "</div>" +

            "</div>" +
            "</article>"
          );
        })
        .join("");
  }

  function openBook(id) {
    var book =
      books.find(function (item) {
        return item.id === id;
      });

    if (!book) {
      toast(
        "کتێبەکە نەدۆزرایەوە"
      );
      return;
    }

    if (
      window.ReaderEngine &&
      typeof window.ReaderEngine.open ===
        "function"
    ) {
      window.ReaderEngine.open(
        book
      );
    } else {
      toast(
        "Reader هێشتا بارنەکراوە"
      );
    }
  }

  function toggleFavorite(id) {
    var book =
      books.find(function (item) {
        return item.id === id;
      });

    if (!book) return;

    book.favorite =
      !book.favorite;

    dbPut(book)
      .then(function () {
        renderBooks();
      })
      .catch(function (error) {
        console.error(
          "favorite:",
          error
        );
      });
  }

  function deleteBook(id) {
    var book =
      books.find(function (item) {
        return item.id === id;
      });

    if (!book) return;

    if (
      !window.confirm(
        "دڵنیایت لە سڕینەوەی «" +
          book.title +
          "»؟"
      )
    ) {
      return;
    }

    dbDelete(id)
      .then(function () {
        books =
          books.filter(
            function (item) {
              return (
                item.id !== id
              );
            }
          );

        renderBooks();
        renderOwnerPanel();

        toast(
          "کتێبەکە سڕایەوە"
        );
      })
      .catch(function (error) {
        console.error(
          "deleteBook:",
          error
        );

        toast(
          "سڕینەوە سەرکەوتوو نەبوو"
        );
      });
  }

  function detectSourceLang(text) {
    var source =
      String(text || "").trim();

    if (!source) {
      return "en";
    }

    var ku =
      (
        source.match(
          /[\u06D5\u06CE\u0695\u06B5\u06A4\u06C6\u06B7\u06F6]/g
        ) || []
      ).length;

    var fa =
      (
        source.match(
          /[\u067E\u0686\u0698\u06AF]/g
        ) || []
      ).length;

    var ar =
      (
        source.match(
          /[\u0600-\u06FF]/g
        ) || []
      ).length;

    var en =
      (
        source.match(
          /[A-Za-z]/g
        ) || []
      ).length;

    if (ku >= 1) {
      return "ku";
    }

    if (
      fa >= 1 &&
      en === 0
    ) {
      return "fa";
    }

    if (
      en > 0 &&
      en >= ar
    ) {
      return "en";
    }

    if (ar > 0) {
      return "ar";
    }

    return "en";
  }

  function mapTranslationLang(
    lang,
    myMemory
  ) {
    var value =
      String(
        lang || ""
      ).toLowerCase();

    if (
      value === "ckb" ||
      value === "ku" ||
      value === "ku-arab"
    ) {
      return myMemory
        ? "ku"
        : "ckb";
    }

    if (
      value === "ar" ||
      value === "ar-sa"
    ) {
      return "ar";
    }

    if (
      value === "fa" ||
      value === "fa-ir"
    ) {
      return "fa";
    }

    if (
      value === "en" ||
      value === "en-us"
    ) {
      return "en";
    }

    return myMemory
      ? "en"
      : "ckb";
  }

  function looksInvalidSorani(
    text
  ) {
    var value =
      String(
        text || ""
      ).trim();

    if (!value) {
      return true;
    }

    var latin =
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

    return (
      latin > 0 &&
      latin > arabic
    );
  }

  function cleanTranslation(
    text,
    targetLang
  ) {
    var value =
      String(
        text || ""
      )
        .replace(
          /\s+/g,
          " "
        )
        .trim();

    if (!value) {
      return "";
    }

    var target =
      mapTranslationLang(
        targetLang,
        false
      );

    /*
     * تەنیا بۆ وەرگێڕانی کوردی:
     * ئەگەر API بە ڕوونی لاتینی بگەڕێنێتەوە،
     * بە داتا هەڵەکەی ناچین.
     */
    if (
      target === "ckb" &&
      looksInvalidSorani(
        value
      )
    ) {
      return "";
    }

    return value;
  }

  function googleTranslateText(
    text,
    sourceLang,
    targetLang
  ) {
    var sourceText =
      String(
        text || ""
      ).trim();

    if (!sourceText) {
      return Promise.resolve("");
    }

    var sl =
      mapTranslationLang(
        sourceLang ||
          detectSourceLang(
            sourceText
          ),
        false
      );

    var tl =
      mapTranslationLang(
        targetLang || "ckb",
        false
      );

    if (sl === tl) {
      return Promise.resolve(
        sourceText
      );
    }

    var url =
      "https://translate.googleapis.com/translate_a/single" +
      "?client=gtx" +
      "&sl=" +
      encodeURIComponent(
        sl
      ) +
      "&tl=" +
      encodeURIComponent(
        tl
      ) +
      "&dt=t" +
      "&q=" +
      encodeURIComponent(
        sourceText
      );

    return fetch(url)
      .then(function (response) {
        if (!response.ok) {
          throw new Error(
            "Google HTTP " +
              response.status
          );
        }

        return response.json();
      })
      .then(function (data) {
        var result =
          (data[0] || [])
            .map(function (part) {
              return (
                part[0] || ""
              );
            })
            .join("")
            .trim();

        result =
          cleanTranslation(
            result,
            tl
          );

        if (!result) {
          throw new Error(
            "Google translation invalid"
          );
        }

        return result;
      });
  }

  function myMemoryTranslateText(
    text,
    sourceLang,
    targetLang
  ) {
    var sourceText =
      String(
        text || ""
      ).trim();

    if (!sourceText) {
      return Promise.resolve("");
    }

    var sl =
      mapTranslationLang(
        sourceLang ||
          detectSourceLang(
            sourceText
          ),
        true
      );

    var tl =
      mapTranslationLang(
        targetLang || "ckb",
        true
      );

    if (sl === tl) {
      return Promise.resolve(
        sourceText
      );
    }

    var langPair =
      sl +
      "|" +
      tl;

    var url =
      "https://api.mymemory.translated.net/get" +
      "?q=" +
      encodeURIComponent(
        sourceText.slice(
          0,
          500
        )
      ) +
      "&langpair=" +
      encodeURIComponent(
        langPair
      );

    return fetch(url)
      .then(function (response) {
        if (!response.ok) {
          throw new Error(
            "MyMemory HTTP " +
              response.status
          );
        }

        return response.json();
      })
      .then(function (data) {
        if (
          data &&
          data.responseStatus &&
          Number(
            data.responseStatus
          ) !== 200
        ) {
          throw new Error(
            "MyMemory " +
              data.responseStatus
          );
        }

        var result =
          data &&
          data.responseData &&
          data.responseData
            .translatedText;

        result =
          cleanTranslation(
            result,
            targetLang
          );

        if (!result) {
          throw new Error(
            "MyMemory translation invalid"
          );
        }

        return result;
      });
  }

  function translateText(
    text,
    targetLang
  ) {
    var value =
      String(
        text || ""
      ).trim();

    if (!value) {
      return Promise.resolve("");
    }

    var source =
      detectSourceLang(
        value
      );

    return googleTranslateText(
      value,
      source,
      targetLang || "ckb"
    ).catch(function () {
      return myMemoryTranslateText(
        value,
        source,
        targetLang || "ckb"
      );
    });
  }

  function uniqueStrings(
    values
  ) {
    var output = [];
    var seen = {};

    (values || []).forEach(
      function (value) {
        var clean =
          String(
            value || ""
          )
            .replace(
              /\s+/g,
              " "
            )
            .trim();

        if (!clean) return;

        var key =
          clean.toLowerCase();

        if (!seen[key]) {
          seen[key] = true;
          output.push(clean);
        }
      }
    );

    return output.slice(
      0,
      5
    );
  }

  function geminiMeanings(
    word,
    targetLang
  ) {
    var apiKey =
      (
        localStorage.getItem(
          "kh_gemini_key"
        ) || ""
      ).trim();

    if (!apiKey) {
      return Promise.reject(
        new Error(
          "NO_GEMINI_KEY"
        )
      );
    }

    var target =
      targetLang === "ckb"
        ? "کوردی سۆرانیی ستاندارد"
        : "عەرەبیی ستاندارد";

    var prompt =
      "وشەی «" +
      String(word || "").trim() +
      "» وەربگێڕە بۆ " +
      target +
      ".\n" +
      "تا 5 مانا یان هاوواتای جیاواز بدە، بە پێی بەکارهێنان.\n" +
      (
        targetLang ===
        "ckb"
          ? "تەنها کوردی سۆرانیی ستاندارد بەکاربهێنە. بادینی، کورمانجی، فارسی یان لاتینی بەکارمەهێنە."
          : "تەنها عەرەبیی ستاندارد بەکاربهێنە."
      ) +
      "\n" +
      'تەنها JSON بگەڕێنەوە: {"meanings":["..."]}';

    /*
     * generateContent ـەکە هەمان شێوازی
     * بەکارهێنانی API ـی پڕۆژەیە.
     */
    var url =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" +
      encodeURIComponent(
        apiKey
      );

    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ]
      })
    })
      .then(function (response) {
        if (!response.ok) {
          throw new Error(
            "Gemini HTTP " +
              response.status
          );
        }

        return response.json();
      })
      .then(function (data) {
        var raw =
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

        if (!raw) {
          throw new Error(
            "Gemini empty"
          );
        }

        raw =
          String(raw)
            .trim()
            .replace(
              /^```json\s*/i,
              ""
            )
            .replace(
              /^```\s*/i,
              ""
            )
            .replace(
              /\s*```$/i,
              ""
            )
            .trim();

        var parsed =
          JSON.parse(raw);

        var meanings =
          uniqueStrings(
            parsed.meanings || []
          );

        if (
          targetLang ===
          "ckb"
        ) {
          meanings =
            meanings.filter(
              function (item) {
                return !looksInvalidSorani(
                  item
                );
              }
            );
        }

        if (!meanings.length) {
          throw new Error(
            "No valid meanings"
          );
        }

        return meanings;
      });
  }

  function getTranslationMeanings(
    word,
    targetLang
  ) {
    var value =
      String(
        word || ""
      ).trim();

    if (!value) {
      return Promise.resolve(
        []
      );
    }

    return geminiMeanings(
      value,
      targetLang
    ).catch(function () {
      return Promise.all([
        googleTranslateText(
          value,
          detectSourceLang(
            value
          ),
          targetLang
        ).catch(function () {
          return "";
        }),
        myMemoryTranslateText(
          value,
          detectSourceLang(
            value
          ),
          targetLang
        ).catch(function () {
          return "";
        })
      ]).then(function (
        results
      ) {
        return uniqueStrings(
          results
        );
      });
    });
  }

  function renderMeanings(
    meanings,
    className
  ) {
    var list =
      uniqueStrings(
        meanings
      );

    if (!list.length) {
      return (
        '<span class="translation-empty">' +
        "وەرگێڕان بەردەست نەبوو" +
        "</span>"
      );
    }

    return (
      '<div class="meaning-list ' +
      esc(className || "") +
      '">' +
      list
        .map(function (item) {
          return (
            '<div class="meaning-item">' +
            esc(item) +
            "</div>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function speakText(
    text,
    lang
  ) {
    if (
      !window.speechSynthesis
    ) {
      toast(
        "دەنگ لەم وێبگەڕەدا بەردەست نییە"
      );
      return;
    }

    var value =
      String(
        text || ""
      ).trim();

    if (!value) return;

    window.speechSynthesis.cancel();

    var utterance =
      new SpeechSynthesisUtterance(
        value
      );

    var normalized =
      String(
        lang || ""
      ).toLowerCase();

    if (
      normalized === "ar" ||
      normalized === "ar-sa"
    ) {
      utterance.lang = "ar-SA";
    } else if (
      normalized === "ku" ||
      normalized === "ckb"
    ) {
      utterance.lang = "ku-Arab";
    } else if (
      normalized === "fa" ||
      normalized === "fa-ir"
    ) {
      utterance.lang = "fa-IR";
    } else {
      utterance.lang = "en-US";
    }

    utterance.rate = 0.85;
    utterance.volume = 1;

    window.speechSynthesis.speak(
      utterance
    );
  }

  function openWordModal(
    word
  ) {
    currentWord =
      String(
        word || ""
      ).trim();

    currentWordLang =
      detectSourceLang(
        currentWord
      );

    currentWordMeanings = {
      ku: [],
      ar: []
    };

    var sheet =
      $("wordSheet");

    if (!sheet) return;

    var sourceClass =
      currentWordLang ===
      "en"
        ? "english-text"
        : currentWordLang ===
            "ar" ||
          currentWordLang ===
            "fa"
        ? "arabic-text"
        : "kurdish-text";

    sheet.innerHTML =
      '<div class="handle"></div>' +

      '<div class="section-head">' +
      "<h3>فەرهەنگ</h3>" +
      '<button class="icon-btn" data-action="close-word">' +
      '<i class="fa-solid fa-xmark"></i>' +
      "</button>" +
      "</div>" +

      '<div class="field">' +
      "<label>وشە</label>" +
      '<div id="modalWord" class="source-word ' +
      sourceClass +
      '" style="display:flex;align-items:center;justify-content:space-between;gap:8px">' +

      "<span>" +
      esc(currentWord) +
      "</span>" +

      '<button class="icon-btn" data-vspeak="' +
      esc(currentWord) +
      '" data-vlang="' +
      esc(currentWordLang) +
      '" style="width:34px;height:34px;color:var(--a)">' +
      '<i class="fa-solid fa-volume-high"></i>' +
      "</button>" +

      "</div>" +
      "</div>" +

      '<div class="field">' +
      "<label>بە کوردی</label>" +
      '<div id="modalKu" class="translation-box ku-translation">' +
      "چاوەڕوانی..." +
      "</div>" +
      "</div>" +

      '<div class="field">' +
      "<label>بە عەرەبی</label>" +
      '<div id="modalAr" class="translation-box ar-translation">' +
      '<div id="modalArText">' +
      "چاوەڕوانی..." +
      "</div>" +
      '<button class="icon-btn" id="modalArSpeakBtn" style="width:34px;height:34px;color:#22c98b;margin-top:8px">' +
      '<i class="fa-solid fa-volume-high"></i>' +
      "</button>" +
      "</div>" +
      "</div>" +

      '<div class="hero-actions">' +
      '<button class="primary" data-action="save-word">' +
      "خەزنکردنی وشەکە" +
      "</button>" +
      "</div>";

    openSheet(
      $("wordBack"),
      sheet
    );

    getTranslationMeanings(
      currentWord,
      "ckb"
    )
      .then(function (meanings) {
        currentWordMeanings.ku =
          uniqueStrings(
            meanings
          );

        var el =
          $("modalKu");

        if (el) {
          el.innerHTML =
            renderMeanings(
              currentWordMeanings.ku,
              "ku-translation"
            );
        }
      })
      .catch(function () {
        var el =
          $("modalKu");

        if (el) {
          el.textContent =
            "وەرگێڕان بەردەست نەبوو";
        }
      });

    getTranslationMeanings(
      currentWord,
      "ar"
    )
      .then(function (meanings) {
        currentWordMeanings.ar =
          uniqueStrings(
            meanings
          );

        var text =
          $("modalArText");

        if (text) {
          text.innerHTML =
            renderMeanings(
              currentWordMeanings.ar,
              "ar-translation"
            );
        }

        var button =
          $("modalArSpeakBtn");

        if (button) {
          button.setAttribute(
            "data-vspeak",
            currentWordMeanings.ar.join(
              "، "
            )
          );

          button.setAttribute(
            "data-vlang",
            "ar"
          );
        }
      })
      .catch(function () {
        var text =
          $("modalArText");

        if (text) {
          text.textContent =
            "وەرگێڕان بەردەست نەبوو";
        }
      });
  }

  function openSentenceModal(
    sentence
  ) {
    var text =
      String(
        sentence || ""
      ).trim();

    if (
      text.length < 2
    ) {
      return;
    }

    var original =
      $("sentenceOriginal");

    var kurdish =
      $("sentenceKu");

    if (original) {
      original.textContent =
        text;
    }

    if (kurdish) {
      kurdish.textContent =
        "چاوەڕوانی...";
    }

    openSheet(
      $("sentenceBack"),
      $("sentenceSheet")
    );

    translateText(
      text,
      "ckb"
    )
      .then(function (result) {
        if (kurdish) {
          kurdish.textContent =
            result ||
            "وەرگێڕان بەردەست نەبوو";
        }
      })
      .catch(function () {
        if (kurdish) {
          kurdish.textContent =
            "وەرگێڕان بەردەست نەبوو";
        }
      });
  }

  function saveWord() {
    if (!currentWord) return;

    var exists =
      vocab.some(function (item) {
        return (
          String(
            item.word || ""
          ).toLowerCase() ===
          currentWord.toLowerCase()
        );
      });

    if (exists) {
      toast(
        "ئەم وشەیە پێشتر خەزنکراوە"
      );
      return;
    }

    var ku =
      currentWordMeanings.ku.join(
        "\n"
      );

    var ar =
      currentWordMeanings.ar.join(
        "\n"
      );

    vocab.unshift({
      id:
        String(Date.now()) +
        "_" +
        Math.floor(
          Math.random() * 10000
        ),

      word:
        currentWord,

      lang:
        currentWordLang,

      ku: ku,

      third: ar
    });

    saveJSON(
      "kh_vocab",
      vocab
    );

    renderBooks();

    closeSheet(
      $("wordBack"),
      $("wordSheet")
    );

    toast(
      "وشەکە خەزنکرا"
    );
  }

  function renderVocab() {
    var back =
      document.createElement(
        "div"
      );

    var sheet =
      document.createElement(
        "div"
      );

    back.className =
      "back open";

    sheet.className =
      "sheet open";

    sheet.innerHTML =
      '<div class="handle"></div>' +

      '<div class="section-head">' +
      "<h3>وشەکانم</h3>" +
      '<button class="icon-btn" data-temp-close>' +
      '<i class="fa-solid fa-xmark"></i>' +
      "</button>" +
      "</div>" +

      '<div style="margin-top:10px;max-height:400px;overflow:auto">' +

      (
        vocab.length
          ? vocab
              .map(function (item) {
                var source =
                  item.lang ||
                  detectSourceLang(
                    item.word
                  );

                return (
                  '<div class="field" style="margin-bottom:10px">' +

                  '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;font-weight:800;color:#f4c85c;font-size:17px">' +

                  '<span class="source-word ' +
                  (
                    source ===
                    "en"
                      ? "english-text"
                      : source ===
                          "ar" ||
                        source ===
                          "fa"
                      ? "arabic-text"
                      : "kurdish-text"
                  ) +
                  '">' +
                  esc(item.word) +
                  "</span>" +

                  '<button class="icon-btn" data-vspeak="' +
                  esc(item.word) +
                  '" data-vlang="' +
                  esc(source) +
                  '" style="width:30px;height:30px">' +
                  '<i class="fa-solid fa-volume-high"></i>' +
                  "</button>" +

                  "</div>" +

                  '<div class="saved-meanings ku-translation" style="margin-top:7px">' +
                  esc(
                    String(
                      item.ku || ""
                    ).replace(
                      /\n/g,
                      "، "
                    )
                  ) +
                  "</div>" +

                  '<div style="display:flex;gap:7px;align-items:flex-start;margin-top:7px">' +

                  '<div class="saved-meanings ar-translation" style="flex:1">' +
                  esc(
                    String(
                      item.third || ""
                    ).replace(
                      /\n/g,
                      "، "
                    )
                  ) +
                  "</div>" +

                  '<button class="icon-btn" data-vspeak="' +
                  esc(
                    item.third || ""
                  ) +
                  '" data-vlang="ar" style="width:30px;height:30px">' +
                  '<i class="fa-solid fa-volume-high"></i>' +
                  "</button>" +

                  "</div>" +

                  '<div class="hero-actions">' +

                  '<button class="ghost" data-vdel="' +
                  esc(
                    item.id
                  ) +
                  '">' +
                  "سڕینەوە" +
                  "</button>" +

                  "</div>" +

                  "</div>"
                );
              })
              .join("")
          : '<div style="padding:30px;text-align:center;color:var(--muted)">هێشتا وشەیەک خەزن نەکراوە</div>'
      ) +

      "</div>";

    document.body.appendChild(
      back
    );

    document.body.appendChild(
      sheet
    );

    updateTelegramBtn();

    function close() {
      back.remove();
      sheet.remove();
      updateTelegramBtn();
    }

    back.addEventListener(
      "click",
      close
    );

    sheet.addEventListener(
      "click",
      function (event) {
        var closeButton =
          event.target.closest(
            "[data-temp-close]"
          );

        if (closeButton) {
          close();
          return;
        }

        var del =
          event.target.closest(
            "[data-vdel]"
          );

        if (!del) return;

        var id =
          del.getAttribute(
            "data-vdel"
          );

        vocab =
          vocab.filter(
            function (item) {
              return (
                item.id !== id
              );
            }
          );

        saveJSON(
          "kh_vocab",
          vocab
        );

        close();

        renderVocab();
        renderBooks();
      }
    );
  }

  function addMusicFiles(
    files
  ) {
    if (!files) return;

    for (
      var i = 0;
      i < files.length;
      i++
    ) {
      var file =
        files[i];

      music.push({
        name:
          file.name,
        url:
          URL.createObjectURL(
            file
          )
      });
    }

    if (
      musicIndex < 0 &&
      music.length
    ) {
      loadTrack(
        0,
        false
      );
    }

    renderTracks();
  }

  function loadTrack(
    index,
    autoplay
  ) {
    if (!music[index]) {
      return;
    }

    musicIndex =
      index;

    var audio =
      $("audio");

    if (audio) {
      audio.src =
        music[index].url;

      audio.volume =
        musicVolume;
    }

    var name =
      $("nowName");

    if (name) {
      name.textContent =
        music[index].name;
    }

    var sub =
      $("nowSub");

    if (sub) {
      sub.textContent =
        "دەنگی هەڵبژێردراو";
    }

    renderTracks();
    updatePlayButton();

    if (
      autoplay &&
      audio
    ) {
      audio
        .play()
        .then(
          updatePlayButton
        )
        .catch(function () {});
    }
  }

  function updatePlayButton() {
    var audio =
      $("audio");

    var button =
      document.querySelector(
        ".music-btn.big[data-action='play-pause']"
      );

    var playing =
      audio &&
      !audio.paused &&
      musicIndex >= 0;

    if (button) {
      button.innerHTML =
        playing
          ? '<i class="fa-solid fa-pause"></i>'
          : '<i class="fa-solid fa-play"></i>';
    }

    document
      .querySelectorAll(
        "[data-track]"
      )
      .forEach(function (item) {
        var index =
          Number(
            item.getAttribute(
              "data-track"
            )
          );

        var icon =
          item.querySelector(
            "i"
          );

        if (!icon) return;

        icon.className =
          "fa-solid " +
          (
            index ===
              musicIndex &&
            playing
              ? "fa-pause"
              : "fa-play"
          );
      });
  }

  function renderTracks() {
    var box =
      $("tracks");

    if (!box) return;

    if (!music.length) {
      box.innerHTML =
        '<div style="text-align:center;padding:10px;color:var(--muted);font-size:10px">هیچ دەنگێک نییە.</div>';

      return;
    }

    box.innerHTML =
      music
        .map(function (track, index) {
          return (
            '<div class="track" data-track-card="' +
            index +
            '" style="cursor:pointer">' +

            '<button data-track="' +
            index +
            '">' +

            '<i class="fa-solid fa-play"></i>' +

            "</button>" +

            "<span>" +
            esc(track.name) +
            "</span>" +

            "</div>"
          );
        })
        .join("");

    updatePlayButton();
  }

  function renderOwnerPanel() {
    var total =
      $("ownerTotalBooks");

    if (total) {
      total.textContent =
        books.length;
    }

    var publicCount =
      $("ownerPublicBooks");

    if (publicCount) {
      publicCount.textContent =
        books.filter(
          function (book) {
            return (
              book.isPublished !==
              false
            );
          }
        ).length;
    }

    var pending =
      $("ownerPendingBooks");

    if (pending) {
      pending.textContent =
        books.filter(
          function (book) {
            return (
              book.isPublished ===
              false
            );
          }
        ).length;
    }

    var audioCount =
      $("ownerTotalAudios");

    if (audioCount) {
      audioCount.textContent =
        music.length;
    }

    var list =
      $("ownerBooksList");

    if (!list) return;

    if (!books.length) {
      list.innerHTML =
        '<div style="text-align:center;color:var(--muted);padding:12px;font-size:10px">هیچ کتێبێک نییە.</div>';
      return;
    }

    list.innerHTML =
      books
        .map(function (book) {
          var category =
            book.category ||
            "گشتی";

          return (
            '<div style="display:flex;align-items:center;gap:8px;background:var(--surface2);border:1px solid var(--line);padding:8px;border-radius:11px">' +

            '<div style="flex:1;min-width:0">' +

            '<strong style="font-size:11px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
            esc(book.title) +
            "</strong>" +

            '<div style="margin-top:5px">' +

            '<select data-owner-cat="' +
            esc(book.id) +
            '" style="font-size:10px;background:var(--surface);color:#fff;border:1px solid var(--line);border-radius:6px;padding:3px">' +

            CATEGORIES
              .map(
                function (cat) {
                  return (
                    '<option value="' +
                    esc(cat) +
                    '"' +
                    (
                      category ===
                      cat
                        ? " selected"
                        : ""
                    ) +
                    ">" +
                    esc(cat) +
                    "</option>"
                  );
                }
              )
              .join("") +

            "</select>" +

            "</div>" +

            "</div>" +

            '<button class="icon-btn" data-owner-del="' +
            esc(book.id) +
            '" style="width:32px;height:32px;color:#ff536d">' +
            '<i class="fa-regular fa-trash-can"></i>' +
            "</button>" +

            "</div>"
          );
        })
        .join("");
  }

  window.AppLib = {
    dbPut: dbPut,

    dbAll: dbAll,

    updateTelegram: updateTelegramBtn,

    openSettings: function () {
      renderSiteThemes();
      renderReaderThemes();
      updateThemeBadges();

      var apiInput =
        $("geminiApiKey");

      if (apiInput) {
        try {
          apiInput.value =
            localStorage.getItem(
              "kh_gemini_key"
            ) || "";
        } catch (e) {}
      }

      openSheet(
        $("sheetBack"),
        $("settingsSheet")
      );
    },

    getMusicVolume:
      function () {
        return musicVolume;
      },

    setMusicVolume:
      function (value) {
        var number =
          Number(value);

        if (
          !Number.isFinite(
            number
          )
        ) {
          number = 0.32;
        }

        musicVolume =
          Math.max(
            0,
            Math.min(
              1,
              number
            )
          );

        var audio =
          $("audio");

        if (audio) {
          audio.volume =
            musicVolume;
        }

        try {
          localStorage.setItem(
            "kh_music_volume",
            String(
              musicVolume
            )
          );
        } catch (e) {}
      },

    translateText:
      translateText,

    detectSourceLang:
      detectSourceLang
  };

  document.addEventListener(
    "click",
    function (event) {
      var speakButton =
        event.target.closest(
          "[data-vspeak]"
        );

      if (speakButton) {
        speakText(
          speakButton.getAttribute(
            "data-vspeak"
          ),
          speakButton.getAttribute(
            "data-vlang"
          )
        );

        return;
      }

      var action =
        event.target.closest(
          "[data-action]"
        );

      if (action) {
        var name =
          action.getAttribute(
            "data-action"
          );

        if (
          name ===
          "add-pdf"
        ) {
          var input =
            $("pdfInput");

          if (input) {
            input.click();
          }

          return;
        }

        if (
          name ===
          "add-music"
        ) {
          var musicInput =
            $("musicInput");

          if (musicInput) {
            musicInput.click();
          }

          return;
        }

        if (
          name ===
          "open-book"
        ) {
          var card =
            action.closest(
              ".book"
            );

          if (card) {
            openBook(
              card.getAttribute(
                "data-book"
              )
            );
          }

          return;
        }

        if (
          name ===
          "fav"
        ) {
          var cardFav =
            action.closest(
              ".book"
            );

          if (cardFav) {
            toggleFavorite(
              cardFav.getAttribute(
                "data-book"
              )
            );
          }

          return;
        }

        if (
          name ===
          "del-book"
        ) {
          var cardDel =
            action.closest(
              ".book"
            );

          if (cardDel) {
            deleteBook(
              cardDel.getAttribute(
                "data-book"
              )
            );
          }

          return;
        }

        if (
          name ===
          "continue"
        ) {
          if (!books.length) {
            toast(
              "هێشتا کتێب نییە"
            );
            return;
          }

          var latest =
            books
              .slice()
              .sort(
                function (a, b) {
                  return (
                    (b.updatedAt ||
                      b.addedAt ||
                      0) -
                    (a.updatedAt ||
                      a.addedAt ||
                      0)
                  );
                }
              )[0];

          if (latest) {
            openBook(
              latest.id
            );
          }

          return;
        }

        if (
          name ===
          "settings"
        ) {
          window.AppLib.openSettings();
          return;
        }

        if (
          name ===
          "close-settings"
        ) {
          closeSheet(
            $("sheetBack"),
            $("settingsSheet")
          );
          return;
        }

        if (
          name ===
          "owner-panel"
        ) {
          renderOwnerPanel();

          openSheet(
            $("ownerBack"),
            $("ownerSheet")
          );

          return;
        }

        if (
          name ===
          "close-owner"
        ) {
          closeSheet(
            $("ownerBack"),
            $("ownerSheet")
          );

          return;
        }

        if (
          name ===
          "close-word"
        ) {
          closeSheet(
            $("wordBack"),
            $("wordSheet")
          );

          return;
        }

        if (
          name ===
          "save-word"
        ) {
          saveWord();
          return;
        }

        if (
          name ===
          "close-sentence"
        ) {
          closeSheet(
            $("sentenceBack"),
            $("sentenceSheet")
          );

          return;
        }

        if (
          name ===
          "clear-vocab"
        ) {
          if (
            window.confirm(
              "هەموو وشە خەزنکراوەکان بسڕدرێنەوە؟"
            )
          ) {
            vocab = [];

            saveJSON(
              "kh_vocab",
              vocab
            );

            renderBooks();

            toast(
              "وشەکان سڕانەوە"
            );
          }

          return;
        }

        if (
          name ===
          "play-pause"
        ) {
          var audio =
            $("audio");

          if (!audio) {
            return;
          }

          if (
            musicIndex < 0 &&
            music.length
          ) {
            loadTrack(
              0,
              true
            );

          } else if (
            audio.paused
          ) {
            audio
              .play()
              .then(
                updatePlayButton
              )
              .catch(
                function () {}
              );
          } else {
            audio.pause();
            updatePlayButton();
          }

          return;
        }

        if (
          name ===
          "next-track"
        ) {
          if (!music.length) {
            return;
          }

          loadTrack(
            (
              musicIndex +
              1
            ) %
              music.length,
            true
          );

          return;
        }

        if (
          name ===
          "prev-track"
        ) {
          if (!music.length) {
            return;
          }

          loadTrack(
            (
              musicIndex -
              1 +
              music.length
            ) %
              music.length,
            true
          );

          return;
        }

        if (
          name ===
          "page-prev" ||
          name ===
          "page-next"
        ) {
          return;
        }
      }

      var track =
        event.target.closest(
          "[data-track-card]"
        );

      if (track) {
        var index =
          Number(
            track.getAttribute(
              "data-track-card"
            )
          );

        var audio =
          $("audio");

        if (
          index ===
            musicIndex &&
          audio &&
          !audio.paused
        ) {
          audio.pause();
          updatePlayButton();
        } else {
          loadTrack(
            index,
            true
          );
        }

        return;
      }

      var theme =
        event.target.closest(
          "[data-site-theme]"
        );

      if (theme) {
        setSiteTheme(
          theme.getAttribute(
            "data-site-theme"
          )
        );

        return;
      }

      var readerThemeButton =
        event.target.closest(
          "[data-set-reader-theme]"
        );

      if (readerThemeButton) {
        readerTheme =
          readerThemeButton.getAttribute(
            "data-set-reader-theme"
          );

        try {
          localStorage.setItem(
            "kh_reader_theme",
            readerTheme
          );
        } catch (e) {}

        renderReaderThemes();
        updateThemeBadges();

        if (
          window.ReaderEngine &&
          typeof window.ReaderEngine.applyTheme ===
            "function"
        ) {
          window.ReaderEngine.applyTheme();
        }

        return;
      }

      var accordion =
        event.target.closest(
          "[data-toggle-target]"
        );

      if (accordion) {
        var targetId =
          accordion.getAttribute(
            "data-toggle-target"
          );

        var target =
          $(targetId);

        if (!target) {
          return;
        }

        var wasHidden =
          target.classList.contains(
            "hidden"
          );

        document
          .querySelectorAll(
            ".setting-collapse"
          )
          .forEach(
            function (item) {
              item.classList.add(
                "hidden"
              );
            }
          );

        document
          .querySelectorAll(
            ".setting-header"
          )
          .forEach(
            function (item) {
              item.classList.remove(
                "open"
              );
            }
          );

        if (wasHidden) {
          target.classList.remove(
            "hidden"
          );

          accordion.classList.add(
            "open"
          );
        }

        return;
      }

      var navigation =
        event.target.closest(
          "[data-nav]"
        );

      if (navigation) {
        var nav =
          navigation.getAttribute(
            "data-nav"
          );

        document
          .querySelectorAll(
            ".nav"
          )
          .forEach(
            function (item) {
              item.classList.toggle(
                "active",
                item ===
                  navigation
              );
            }
          );

        updateTelegramBtn();

        if (
          nav ===
          "vocab"
        ) {
          renderVocab();
          return;
        }

        filter =
          nav ===
          "favorites"
            ? "favorites"
            : "all";

        document
          .querySelectorAll(
            ".chip"
          )
          .forEach(
            function (item) {
              item.classList.toggle(
                "active",
                item.getAttribute(
                  "data-filter"
                ) === filter
              );
            }
          );

        renderBooks();

        return;
      }

      var filterButton =
        event.target.closest(
          "[data-filter]"
        );

      if (filterButton) {
        filter =
          filterButton.getAttribute(
            "data-filter"
          );

        document
          .querySelectorAll(
            ".chip"
          )
          .forEach(
            function (item) {
              item.classList.toggle(
                "active",
                item ===
                  filterButton
              );
            }
          );

        renderBooks();

        return;
      }

      var ownerDelete =
        event.target.closest(
          "[data-owner-del]"
        );

      if (ownerDelete) {
        var ownerId =
          ownerDelete.getAttribute(
            "data-owner-del"
          );

        deleteBook(ownerId);

        return;
      }

      var word =
        event.target.closest(
          ".rw"
        );

      if (
        word &&
        word.getAttribute(
          "data-word"
        )
      ) {
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
          openSentenceModal(
            selection
          );
        } else {
          openWordModal(
            word.getAttribute(
              "data-word"
            )
          );
        }

        return;
      }
    }
  );

  document.addEventListener(
    "change",
    function (event) {
      var ownerCategory =
        event.target.closest(
          "[data-owner-cat]"
        );

      if (ownerCategory) {
        var id =
          ownerCategory.getAttribute(
            "data-owner-cat"
          );

        var book =
          books.find(function (item) {
            return item.id === id;
          });

        if (!book) return;

        book.category =
          ownerCategory.value;

        book.updatedAt =
          Date.now();

        dbPut(book)
          .then(function () {
            renderBooks();
            renderOwnerPanel();

            toast(
              "پۆلەکە نوێکرایەوە"
            );
          })
          .catch(function (error) {
            console.error(
              error
            );
          });

        return;
      }

      if (
        event.target ===
        $("pdfInput")
      ) {
        return;
      }
    }
  );

  var sheetBack =
    $("sheetBack");

  if (sheetBack) {
    sheetBack.addEventListener(
      "click",
      function () {
        closeSheet(
          $("sheetBack"),
          $("settingsSheet")
        );
      }
    );
  }

  var ownerBack =
    $("ownerBack");

  if (ownerBack) {
    ownerBack.addEventListener(
      "click",
      function () {
        closeSheet(
          $("ownerBack"),
          $("ownerSheet")
        );
      }
    );
  }

  var wordBack =
    $("wordBack");

  if (wordBack) {
    wordBack.addEventListener(
      "click",
      function () {
        closeSheet(
          $("wordBack"),
          $("wordSheet")
        );
      }
    );
  }

  var sentenceBack =
    $("sentenceBack");

  if (sentenceBack) {
    sentenceBack.addEventListener(
      "click",
      function () {
        closeSheet(
          $("sentenceBack"),
          $("sentenceSheet")
        );
      }
    );
  }

  var pdfInput =
    $("pdfInput");

  if (pdfInput) {
    pdfInput.addEventListener(
      "change",
      function () {
        addPDF(
          this.files &&
            this.files[0]
        );
      }
    );
  }

  var musicInput =
    $("musicInput");

  if (musicInput) {
    musicInput.addEventListener(
      "change",
      function () {
        addMusicFiles(
          this.files
        );

        this.value = "";
      }
    );
  }

  var search =
    $("searchInput");

  if (search) {
    search.addEventListener(
      "input",
      function () {
        query =
          this.value.trim();

        renderBooks();
      }
    );
  }

  var audio =
    $("audio");

  if (audio) {
    audio.addEventListener(
      "timeupdate",
      function () {
        var range =
          $("audioRange");

        if (
          range &&
          this.duration
        ) {
          range.value =
            String(
              Math.round(
                (
                  this.currentTime /
                  this.duration
                ) *
                  100
              )
            );
        }
      }
    );

    audio.addEventListener(
      "ended",
      function () {
        if (music.length) {
          loadTrack(
            (
              musicIndex +
              1
            ) %
              music.length,
            true
          );
        }
      }
    );

    audio.addEventListener(
      "play",
      updatePlayButton
    );

    audio.addEventListener(
      "pause",
      updatePlayButton
    );
  }

  var audioRange =
    $("audioRange");

  if (audioRange) {
    audioRange.addEventListener(
      "input",
      function () {
        var audio =
          $("audio");

        if (
          audio &&
          audio.duration
        ) {
          audio.currentTime =
            audio.duration *
            (
              Number(
                this.value
              ) / 100
            );
        }
      }
    );
  }

  var apiInput =
    $("geminiApiKey");

  if (apiInput) {
    apiInput.addEventListener(
      "input",
      function () {
        try {
          localStorage.setItem(
            "kh_gemini_key",
            this.value.trim()
          );
        } catch (e) {}
      }
    );
  }

  var fontSizeInput =
    $("fontSize");

  if (fontSizeInput) {
    fontSizeInput.addEventListener(
      "change",
      function () {
        try {
          localStorage.setItem(
            "kh_font",
            this.value
          );
        } catch (e) {}

        if (
          window.ReaderEngine &&
          typeof window.ReaderEngine.setFontSize ===
            "function"
        ) {
          window.ReaderEngine.setFontSize(
            Number(
              this.value
            )
          );
        }
      }
    );
  }

  function init() {
    vocab =
      loadJSON(
        "kh_vocab",
        []
      );

    siteTheme =
      localStorage.getItem(
        "kh_site_theme"
      ) || "cyan";

    readerTheme =
      localStorage.getItem(
        "kh_reader_theme"
      ) || "paper";

    musicVolume =
      Number(
        localStorage.getItem(
          "kh_music_volume"
        ) || 0.32
      );

    if (
      !Number.isFinite(
        musicVolume
      )
    ) {
      musicVolume = 0.32;
    }

    setSiteTheme(
      siteTheme
    );

    renderReaderThemes();
    renderTracks();
    updateThemeBadges();

    dbAll()
      .then(function (storedBooks) {
        books =
          Array.isArray(
            storedBooks
          )
            ? storedBooks
            : [];

        renderBooks();
        renderOwnerPanel();
        updateTelegramBtn();
      })
      .catch(function (error) {
        console.error(
          "dbAll:",
          error
        );

        books = [];

        renderBooks();
        renderOwnerPanel();
        updateTelegramBtn();
      });
  }

  init();
})();
