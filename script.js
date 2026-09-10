function () {
  "use strict";

  /* =======================================================
     SUPABASE
     ======================================================= */

  var SUPABASE_URL = "https://nretwjagqnisyihtuwwn.supabase.co";

  var SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_603X2LJm3l-diUOPeXqyPQ_NkrIiD7M";

  var supabaseClient =
    window.supabase &&
    typeof window.supabase.createClient === "function"
      ? window.supabase.createClient(
          SUPABASE_URL,
          SUPABASE_PUBLISHABLE_KEY
        )
      : null;

  var BOOKS_BUCKET = "books";
  var MUSIC_BUCKET = "music";


  /* =======================================================
     SUPABASE HELPERS
     ======================================================= */

  function supabaseReady() {
    return !!supabaseClient;
  }

  function publicStorageUrl(bucket, path) {
    if (!supabaseReady() || !path) {
      return "";
    }

    var result =
      supabaseClient.storage
        .from(bucket)
        .getPublicUrl(path);

    return result && result.data
      ? result.data.publicUrl || ""
      : "";
  }

  function storagePathFromPublicUrl(
    url,
    bucket
  ) {
    var value =
      String(url || "");

    var marker =
      "/storage/v1/object/public/" +
      bucket +
      "/";

    var index =
      value.indexOf(marker);

    if (index < 0) {
      return "";
    }

    try {
      return decodeURIComponent(
        value.slice(
          index + marker.length
        )
      );
    } catch (error) {
      return value.slice(
        index + marker.length
      );
    }
  }

  function uploadToStorage(
    bucket,
    path,
    file
  ) {
    if (!supabaseReady()) {
      return Promise.reject(
        new Error(
          "Supabase بەردەست نییە"
        )
      );
    }

    return supabaseClient.storage
      .from(bucket)
      .upload(
        path,
        file,
        {
          cacheControl:
            "3600",
          upsert:
            false,
          contentType:
            file &&
            file.type
              ? file.type
              : undefined
        }
      )
      .then(
        function (result) {
          if (result.error) {
            throw result.error;
          }

          return {
            path:
              path,

            url:
              publicStorageUrl(
                bucket,
                path
              )
          };
        }
      );
  }

  function deleteFromStorage(
    bucket,
    path
  ) {
    if (
      !supabaseReady() ||
      !path
    ) {
      return Promise.resolve();
    }

    return supabaseClient.storage
      .from(bucket)
      .remove([
        path
      ])
      .then(
        function (result) {
          if (result.error) {
            throw result.error;
          }
        }
      );
  }

  function mapRemoteBook(
    row
  ) {
    if (!row) {
      return null;
    }

    var language =
      row.language ||
      "en";

    var lang =
      language;

    if (
      language ===
      "کوردی"
    ) {
      lang =
        "ku";
    } else if (
      language ===
      "عەرەبی"
    ) {
      lang =
        "ar";
    } else if (
      language ===
      "فارسی"
    ) {
      lang =
        "fa";
    } else if (
      language ===
      "ئینگلیزی"
    ) {
      lang =
        "en";
    }

    return {
      id:
        String(
          row.id
        ),

      remoteId:
        row.id,

      title:
        row.title ||
        "",

      author:
        row.author ||
        "",

      language:
        row.language ||
        "",

      category:
        row.category ||
        "گشتی",

      description:
        row.description ||
        "",

      keywords:
        row.keywords ||
        "",

      cover_url:
        row.cover_url ||
        "",

      pdf_url:
        row.pdf_url ||
        "",

      pages:
        [],

      pdfData:
        null,

      lang:
        lang,

      pageCount:
        Number(
          row.pages
        ) ||
        0,

      currentPage:
        0,

      progress:
        0,

      favorite:
        false,

      bookmarked:
        false,

      isPublished:
        true,

      addedAt:
        row.created_at
          ? new Date(
              row.created_at
            ).getTime()
          : Date.now(),

      updatedAt:
        row.created_at
          ? new Date(
              row.created_at
            ).getTime()
          : Date.now(),

      isRemote:
        true
    };
  }

  function loadRemoteBooks() {
    if (!supabaseReady()) {
      return Promise.resolve(
        []
      );
    }

    return supabaseClient
      .from("books")
      .select(
        "id,created_at,title,author,language,category,description,pages,cover_url,pdf_url,keywords"
      )
      .order(
        "created_at",
        {
          ascending:
            false
        }
      )
      .then(
        function (result) {
          if (result.error) {
            throw result.error;
          }

          return (
            result.data ||
            []
          )
            .map(
              mapRemoteBook
            )
            .filter(
              Boolean
            );
        }
      );
  }

  function insertRemoteBook(
    book
  ) {
    if (!supabaseReady()) {
      return Promise.reject(
        new Error(
          "Supabase بەردەست نییە"
        )
      );
    }

    return supabaseClient
      .from("books")
      .insert({
        title:
          book.title ||
          "",

        author:
          book.author ||
          "",

        language:
          book.lang ||
          "en",

        category:
          book.category ||
          "گشتی",

        description:
          book.description ||
          "",

        pages:
          Number(
            book.pageCount
          ) ||
          0,

        cover_url:
          book.cover_url ||
          "",

        pdf_url:
          book.pdf_url ||
          "",

        keywords:
          book.keywords ||
          ""
      })
      .select(
        "id,created_at,title,author,language,category,description,pages,cover_url,pdf_url,keywords"
      )
      .single()
      .then(
        function (result) {
          if (result.error) {
            throw result.error;
          }

          return mapRemoteBook(
            result.data
          );
        }
      );
  }

  function deleteRemoteBook(
    book
  ) {
    if (
      !supabaseReady() ||
      !book
    ) {
      return Promise.resolve();
    }

    var remoteId =
      book.remoteId != null
        ? book.remoteId
        : book.id;

    var pdfPath =
      storagePathFromPublicUrl(
        book.pdf_url,
        BOOKS_BUCKET
      );

    return supabaseClient
      .from("books")
      .delete()
      .eq(
        "id",
        remoteId
      )
      .then(
        function (result) {
          if (result.error) {
            throw result.error;
          }

          return deleteFromStorage(
            BOOKS_BUCKET,
            pdfPath
          );
        }
      );
  }

  function loadRemoteMusic() {
    if (!supabaseReady()) {
      return Promise.resolve(
        []
      );
    }

    return supabaseClient
      .from("music")
      .select(
        "id,created_at,title,artist,category,cover_url,audio_url,duration"
      )
      .order(
        "created_at",
        {
          ascending:
            false
        }
      )
      .then(
        function (result) {
          if (result.error) {
            throw result.error;
          }

          return (
            result.data ||
            []
          ).map(
            function (row) {
              return {
                id:
                  String(
                    row.id
                  ),

                remoteId:
                  row.id,

                name:
                  row.title ||
                  "",

                artist:
                  row.artist ||
                  "",

                category:
                  row.category ||
                  "",

                cover_url:
                  row.cover_url ||
                  "",

                audio_url:
                  row.audio_url ||
                  "",

                duration:
                  Number(
                    row.duration
                  ) ||
                  0,

                url:
                  row.audio_url ||
                  "",

                isRemote:
                  true
              };
            }
          );
        }
      );
  }

  function insertRemoteMusic(
    track
  ) {
    if (!supabaseReady()) {
      return Promise.reject(
        new Error(
          "Supabase بەردەست نییە"
        )
      );
    }

    return supabaseClient
      .from("music")
      .insert({
        title:
          track.name ||
          "",

        artist:
          track.artist ||
          "",

        category:
          track.category ||
          "",

        cover_url:
          track.cover_url ||
          "",

        audio_url:
          track.audio_url ||
          "",

        duration:
          Number(
            track.duration
          ) ||
          0
      })
      .select(
        "id,created_at,title,artist,category,cover_url,audio_url,duration"
      )
      .single()
      .then(
        function (result) {
          if (result.error) {
            throw result.error;
          }

          var row =
            result.data;

          return {
            id:
              String(
                row.id
              ),

            remoteId:
              row.id,

            name:
              row.title ||
              "",

            artist:
              row.artist ||
              "",

            category:
              row.category ||
              "",

            cover_url:
              row.cover_url ||
              "",

            audio_url:
              row.audio_url ||
              "",

            duration:
              Number(
                row.duration
              ) ||
              0,

            url:
              row.audio_url ||
              "",

            isRemote:
              true
          };
        }
      );
  }

  function deleteRemoteMusic(
    track
  ) {
    if (
      !supabaseReady() ||
      !track
    ) {
      return Promise.resolve();
    }

    var remoteId =
      track.remoteId != null
        ? track.remoteId
        : track.id;

    var audioPath =
      storagePathFromPublicUrl(
        track.audio_url,
        MUSIC_BUCKET
      );

    return supabaseClient
      .from("music")
      .delete()
      .eq(
        "id",
        remoteId
      )
      .then(
        function (result) {
          if (result.error) {
            throw result.error;
          }

          return deleteFromStorage(
            MUSIC_BUCKET,
            audioPath
          );
        }
      );
  }


  /* =======================================================
     GLOBAL STATE
     ======================================================= */

  var books = [];
  var vocab = [];
  var music = [];
  var musicIndex = -1;

  var filter = "all";
  var query = "";

  var siteTheme = "cyan";
  var readerTheme = "paper";

  var musicVolume =
    0.32;

  var GEMINI_MODEL =
    "gemini-3.6-flash";

  var currentWord = "";
  var currentWordLang =
    "en";

  var currentWordMeanings = {
    ku: [],
    ar: []
  };

  var wordRequestId = 0;


  /* =======================================================
     CATEGORIES
     ======================================================= */

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


  /* =======================================================
     SITE THEMES
     ======================================================= */

  var SITE_THEMES = {

    cyan: {
      name:
        "شینی ئاسمانی",
      a:
        "#35bbff",
      b:
        "#7b61ff",
      bg:
        "#07111f",
      bg2:
        "#0d182a",
      surface:
        "#111f34",
      surface2:
        "#182943",
      line:
        "#29405d"
    },

    violet: {
      name:
        "مۆری",
      a:
        "#8b6cff",
      b:
        "#d35cff",
      bg:
        "#0b081b",
      bg2:
        "#160f2a",
      surface:
        "#1d1735",
      surface2:
        "#282047",
      line:
        "#47386a"
    },

    emerald: {
      name:
        "سەوزی",
      a:
        "#22c98b",
      b:
        "#0ca6a0",
      bg:
        "#061611",
      bg2:
        "#0c241d",
      surface:
        "#102b23",
      surface2:
        "#173b30",
      line:
        "#2b5849"
    },

    sunset: {
      name:
        "خۆرئاوابوون",
      a:
        "#ff8a4c",
      b:
        "#ff4f81",
      bg:
        "#190b09",
      bg2:
        "#291410",
      surface:
        "#351914",
      surface2:
        "#48231d",
      line:
        "#693b30"
    },

    ruby: {
      name:
        "سووری",
      a:
        "#ff536d",
      b:
        "#c93dff",
      bg:
        "#18070d",
      bg2:
        "#280d19",
      surface:
        "#361421",
      surface2:
        "#451b2d",
      line:
        "#623247"
    },

    royal: {
      name:
        "شینی قووڵ",
      a:
        "#4c7dff",
      b:
        "#36c4ff",
      bg:
        "#061029",
      bg2:
        "#0b1940",
      surface:
        "#10204a",
      surface2:
        "#17295a",
      line:
        "#304a80"
    },

    gold: {
      name:
        "زێڕی",
      a:
        "#f2bf4a",
      b:
        "#ff8554",
      bg:
        "#160f05",
      bg2:
        "#281809",
      surface:
        "#34230e",
      surface2:
        "#452d12",
      line:
        "#66491f"
    },

    rose: {
      name:
        "پەمەیی",
      a:
        "#f05bd5",
      b:
        "#ff7b8e",
      bg:
        "#150714",
      bg2:
        "#250e22",
      surface:
        "#34152f",
      surface2:
        "#451c3f",
      line:
        "#623457"
    },

    ocean: {
      name:
        "دەریایی",
      a:
        "#20d6d6",
      b:
        "#3a7bff",
      bg:
        "#041216",
      bg2:
        "#06242b",
      surface:
        "#0c3038",
      surface2:
        "#10434e",
      line:
        "#255b67"
    },

    graphite: {
      name:
        "گرافایت",
      a:
        "#aab7c8",
      b:
        "#62728a",
      bg:
        "#0a0e13",
      bg2:
        "#141923",
      surface:
        "#1c242e",
      surface2:
        "#27303d",
      line:
        "#3c4858"
    },

    lime: {
      name:
        "لایمی",
      a:
        "#a7df45",
      b:
        "#24c68a",
      bg:
        "#0d1605",
      bg2:
        "#17260a",
      surface:
        "#223613",
      surface2:
        "#30471b",
      line:
        "#4d652b"
    },

    midnight: {
      name:
        "میدناو",
      a:
        "#607dff",
      b:
        "#8b5cf6",
      bg:
        "#050817",
      bg2:
        "#0a1025",
      surface:
        "#101833",
      surface2:
        "#182344",
      line:
        "#2f4069"
    }
  };


  /* =======================================================
     READER THEMES
     ======================================================= */

  var READER_THEMES = {

    paper: {
      name:
        "سپی",
      bg:
        "#f4f6f9",
      paper:
        "#ffffff",
      fg:
        "#1d2a3d"
    },

    cream: {
      name:
        "کرێمی",
      bg:
        "#eee5d1",
      paper:
        "#fff9e7",
      fg:
        "#403728"
    },

    mint: {
      name:
        "سەوزی کاڵ",
      bg:
        "#dfece5",
      paper:
        "#f4fbf7",
      fg:
        "#203c31"
    },

    sky: {
      name:
        "ئاسمانی",
      bg:
        "#dceef4",
      paper:
        "#f2fbff",
      fg:
        "#24414b"
    },

    rose: {
      name:
        "پەمەیی",
      bg:
        "#f0dfe2",
      paper:
        "#fff5f6",
      fg:
        "#4a2d33"
    },

    lavender: {
      name:
        "مۆری",
      bg:
        "#e6def4",
      paper:
        "#fbf8ff",
      fg:
        "#332b46"
    },

    sand: {
      name:
        "خۆڵەمێشی",
      bg:
        "#e7ded2",
      paper:
        "#fbf4eb",
      fg:
        "#493b2e"
    },

    forest: {
      name:
        "دارستان",
      bg:
        "#dee8de",
      paper:
        "#f5fbf3",
      fg:
        "#213525"
    },

    sepia: {
      name:
        "کەتیبی کۆن",
      bg:
        "#e6dbc6",
      paper:
        "#f7eddb",
      fg:
        "#4a3925"
    },

    slate: {
      name:
        "سڵەیت",
      bg:
        "#dce1e7",
      paper:
        "#eef1f5",
      fg:
        "#263341"
    },

    night: {
      name:
        "شەو",
      bg:
        "#0b1420",
      paper:
        "#101b2c",
      fg:
        "#e9f2fc"
    },

    black: {
      name:
        "ڕەش",
      bg:
        "#050505",
      paper:
        "#0b0b0b",
      fg:
        "#f1f1f1"
    }
  };


  /* =======================================================
     HELPERS
     ======================================================= */

  function $(id) {
    return document.getElementById(
      id
    );
  }

  function esc(value) {
    return String(
      value == null
        ? ""
        : value
    ).replace(
      /[&<>"']/g,
      function (char) {
        return {
          "&":
            "&amp;",

          "<":
            "&lt;",

          ">":
            "&gt;",

          '"':
            "&quot;",

          "'":
            "&#039;"
        }[
          char
        ];
      }
    );
  }

  function saveJSON(
    key,
    value
  ) {
    try {
      localStorage.setItem(
        key,
        JSON.stringify(
          value
        )
      );
    } catch (error) {
      console.error(
        "localStorage save:",
        error
      );
    }
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
    } catch (error) {
      console.error(
        "localStorage load:",
        key,
        error
      );

      return fallback;
    }
  }

  function toast(
    message
  ) {
    var el =
      $("toast");

    if (!el) {
      return;
    }

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
        2600
      );
  }


  /* =======================================================
     TELEGRAM VISIBILITY
     ======================================================= */

  function updateTelegramBtn() {
    var btn =
      $("telegramBtn");

    if (!btn) {
      return;
    }

    var reader =
      $("reader");

    var readerOpen =
      reader &&
      reader.classList.contains(
        "show"
      );

    var activeNav =
      document.querySelector(
        ".nav.active, .desktop-link.active"
      );

    var activeName =
      activeNav
        ? activeNav.getAttribute(
            "data-nav"
          )
        : "home";

    var isHome =
      !activeName ||
      activeName ===
        "home";

    var sheetOpen =
      !!document.querySelector(
        ".sheet.open,.back.open"
      );

    btn.style.display =
      isHome &&
      !readerOpen &&
      !sheetOpen
        ? "flex"
        : "none";
  }


  /* =======================================================
     SHEETS
     ======================================================= */

  function openSheet(
    back,
    sheet
  ) {
    if (
      !back ||
      !sheet
    ) {
      return;
    }

    back.classList.add(
      "open"
    );

    sheet.classList.add(
      "open"
    );

    updateTelegramBtn();
  }

  function closeSheet(
    back,
    sheet
  ) {
    if (
      !back ||
      !sheet
    ) {
      return;
    }

    back.classList.remove(
      "open"
    );

    sheet.classList.remove(
      "open"
    );

    updateTelegramBtn();
  }


  /* =======================================================
     INDEXEDDB
     ======================================================= */

  function dbOpen() {
    return new Promise(
      function (
        resolve,
        reject
      ) {
        if (!window.indexedDB) {
          reject(
            new Error(
              "IndexedDB بەردەست نییە"
            )
          );

          return;
        }

        var request =
          indexedDB.open(
            "kh_reader_v10",
            1
          );

        request.onupgradeneeded =
          function () {
            var db =
              request.result;

            if (
              !db.objectStoreNames.contains(
                "books"
              )
            ) {
              db.createObjectStore(
                "books",
                {
                  keyPath:
                    "id"
                }
              );
            }
          };

        request.onsuccess =
          function () {
            resolve(
              request.result
            );
          };

        request.onerror =
          function () {
            reject(
              request.error ||
                new Error(
                  "نەتوانرا IndexedDB بکرێتەوە"
                )
            );
          };
      }
    );
  }

  function dbAll() {
    return dbOpen()
      .then(
        function (db) {
          return new Promise(
            function (
              resolve,
              reject
            ) {
              var tx;

              try {
                tx =
                  db.transaction(
                    "books",
                    "readonly"
                  );
              } catch (error) {
                reject(error);

                return;
              }

              var request =
                tx
                  .objectStore(
                    "books"
                  )
                  .getAll();

              request.onsuccess =
                function () {
                  resolve(
                    request.result ||
                      []
                  );
                };

              request.onerror =
                function () {
                  reject(
                    request.error
                  );
                };
            }
          );
        }
      );
  }

  function dbPut(
    book
  ) {
    return dbOpen()
      .then(
        function (db) {
          return new Promise(
            function (
              resolve,
              reject
            ) {
              var tx;

              try {
                tx =
                  db.transaction(
                    "books",
                    "readwrite"
                  );
              } catch (error) {
                reject(error);

                return;
              }

              tx
                .objectStore(
                  "books"
                )
                .put(book);

              tx.oncomplete =
                function () {
                  resolve(
                    book
                  );
                };

              tx.onerror =
                function () {
                  reject(
                    tx.error ||
                      new Error(
                        "نەتوانرا کتێب پاشەکەوت بکرێت"
                      )
                  );
                };

              tx.onabort =
                function () {
                  reject(
                    tx.error ||
                      new Error(
                        "پاشەکەوتکردن هەڵوەشایەوە"
                      )
                  );
                };
            }
          );
        }
      );
  }

  function dbDelete(
    id
  ) {
    return dbOpen()
      .then(
        function (db) {
          return new Promise(
            function (
              resolve,
              reject
            ) {
              var tx;

              try {
                tx =
                  db.transaction(
                    "books",
                    "readwrite"
                  );
              } catch (error) {
                reject(error);

                return;
              }

              tx
                .objectStore(
                  "books"
                )
                .delete(id);

              tx.oncomplete =
                function () {
                  resolve();
                };

              tx.onerror =
                function () {
                  reject(
                    tx.error
                  );
                };

              tx.onabort =
                function () {
                  reject(
                    tx.error
                  );
                };
            }
          );
        }
      );
  }


  /* =======================================================
     THEME HELPERS
     ======================================================= */

  function updateThemeBadges() {
    var site =
      SITE_THEMES[
        siteTheme
      ] ||
      SITE_THEMES.cyan;

    var reader =
      READER_THEMES[
        readerTheme
      ] ||
      READER_THEMES.paper;

    var siteLabel =
      $("siteThemeLabel");

    var siteDot =
      $("siteThemeDot");

    var readerLabel =
      $("readerThemeLabel");

    var readerDot =
      $("readerThemeDot");

    if (siteLabel) {
      siteLabel.textContent =
        site.name;
    }

    if (siteDot) {
      siteDot.style.background =
        site.a;
    }

    if (readerLabel) {
      readerLabel.textContent =
        reader.name;
    }

    if (readerDot) {
      readerDot.style.background =
        reader.bg;
    }
  }

  function setSiteTheme(
    key
  ) {
    var theme =
      SITE_THEMES[
        key
      ] ||
      SITE_THEMES.cyan;

    siteTheme =
      SITE_THEMES[key]
        ? key
        : "cyan";

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
        siteTheme
      );
    } catch (error) {}

    renderSiteThemes();
    updateThemeBadges();
  }

  function renderSiteThemes() {
    var box =
      $("siteThemes");

    if (!box) {
      return;
    }

    box.innerHTML =
      Object.keys(
        SITE_THEMES
      )
        .map(
          function (key) {
            var theme =
              SITE_THEMES[
                key
              ];

            return (
              '<button class="theme ' +
              (
                key ===
                siteTheme
                  ? "active"
                  : ""
              ) +
              '" data-site-theme="' +
              esc(
                key
              ) +
              '" title="' +
              esc(
                theme.name
              ) +
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

              "</button>"
            );
          }
        )
        .join("");
  }

  function renderReaderThemes() {
    var box =
      $("readerThemes");

    if (!box) {
      return;
    }

    box.innerHTML =
      Object.keys(
        READER_THEMES
      )
        .map(
          function (key) {
            var theme =
              READER_THEMES[
                key
              ];

            return (
              '<button class="theme ' +
              (
                key ===
                readerTheme
                  ? "active"
                  : ""
              ) +
              '" data-set-reader-theme="' +
              esc(
                key
              ) +
              '" title="' +
              esc(
                theme.name
              ) +
              '" style="background:' +
              theme.bg +
              '">' +

              '<i style="background:' +
              theme.fg +
              '"></i>' +

              '<b style="background:' +
              theme.fg +
              '"></b>' +

              "</button>"
            );
          }
        )
        .join("");
  }


  /* =======================================================
     LANGUAGE DETECTION
     ======================================================= */

  function detectLang(
    text
  ) {
    var sample =
      String(
        text || ""
      ).slice(
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

    if (
      kurdish >=
        3 &&
      (
        arabic <
          120 ||
        kurdish /
          Math.max(
            arabic,
            1
          ) >=
          0.02
      )
    ) {
      return "ku";
    }

    if (
      persian >=
        2 &&
      english ===
        0 &&
      persian >=
        kurdish
    ) {
      return "fa";
    }

    if (
      english >
        0 &&
      english >=
        arabic
    ) {
      return "en";
    }

    if (
      arabic >
        0
    ) {
      return "ar";
    }

    return "en";
  }

  function detectSourceLang(
    text
  ) {
    var source =
      String(
        text || ""
      ).trim();

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

    if (
      ku >=
      1
    ) {
      return "ku";
    }

    if (
      fa >=
        1 &&
      en ===
        0
    ) {
      return "fa";
    }

    if (
      en >
        0 &&
      en >=
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


  /* =======================================================
     PDF IMPORT
     ======================================================= */

  function normalizePdfText(
    items
  ) {
    if (
      !items ||
      !items.length
    ) {
      return "";
    }

    return items
      .map(
        function (item) {
          return String(
            item &&
            item.str
              ? item.str
              : ""
          );
        }
      )
      .join(" ")
      .replace(
        /[ \t]+/g,
        " "
      )
      .trim();
  }

  function extractPDF(
    file
  ) {
    return new Promise(
      function (
        resolve,
        reject
      ) {
        if (!file) {
          reject(
            new Error(
              "PDF file نەدۆزرایەوە"
            )
          );

          return;
        }

        if (!window.pdfjsLib) {
          reject(
            new Error(
              "PDF.js بەردەست نییە"
            )
          );

          return;
        }

        var reader =
          new FileReader();

        reader.onload =
          function () {
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

              var pdfBytes =
                new Uint8Array(
                  buffer.slice(
                    0
                  )
                );

              var storedBytes =
                new Uint8Array(
                  buffer.slice(
                    0
                  )
                );

              pdfjsLib
                .getDocument({
                  data:
                    pdfBytes
                })
                .promise
                .then(
                  function (pdf) {
                    var pages =
                      [];

                    var chain =
                      Promise.resolve();

                    for (
                      let pageNumber =
                        1;
                      pageNumber <=
                        pdf.numPages;
                      pageNumber++
                    ) {
                      (function (
                        pageNo
                      ) {
                        chain =
                          chain.then(
                            function () {
                              return pdf
                                .getPage(
                                  pageNo
                                )
                                .then(
                                  function (
                                    page
                                  ) {
                                    return page
                                      .getTextContent(
                                        {
                                          normalizeWhitespace:
                                            false,

                                          disableCombineTextItems:
                                            true
                                        }
                                      )
                                      .then(
                                        function (
                                          content
                                        ) {
                                          pages.push(
                                            normalizePdfText(
                                              content.items
                                            )
                                          );
                                        }
                                      );
                                  }
                                );
                            }
                          );
                      })(
                        pageNumber
                      );
                    }

                    return chain.then(
                      function () {
                        resolve({
                          pages:
                            pages,

                          lang:
                            detectLang(
                              pages.join(
                                "\n"
                              )
                            ),

                          pageCount:
                            pdf.numPages,

                          pdfData:
                            storedBytes
                        });
                      }
                    );
                  }
                )
                .catch(
                  reject
                );

            } catch (error) {
              reject(
                error
              );
            }
          };

        reader.onerror =
          function () {
            reject(
              reader.error ||
                new Error(
                  "PDF خوێندرایەوە نەبوو"
                )
            );
          };

        reader.readAsArrayBuffer(
          file
        );
      }
    );
  }


  /* =======================================================
     ADD PDF → SUPABASE
     ======================================================= */

  function addPDF(
    file
  ) {
    if (!file) {
      return;
    }

    if (!supabaseReady()) {
      toast(
        "Supabase پەیوەست نییە"
      );

      return;
    }

    toast(
      "PDF خەریکی بارکردنە..."
    );

    var safeName =
      file.name
        .replace(
          /[^a-zA-Z0-9._-]+/g,
          "-"
        )
        .replace(
          /-+/g,
          "-"
        )
        .replace(
          /^[-.]+|[-.]+$/g,
          ""
        ) ||
      "book.pdf";

    var path =
      Date.now() +
      "-" +
      Math.floor(
        Math.random() *
          1000000
      ) +
      "-" +
      safeName;

    var uploadedPdfPath =
      path;

    uploadToStorage(
      BOOKS_BUCKET,
      path,
      file
    )
      .then(
        function (
          uploaded
        ) {
          return extractPDF(
            file
          ).then(
            function (
              data
            ) {
              var book = {
                title:
                  file.name.replace(
                    /\.pdf$/i,
                    ""
                  ),

                author:
                  "",

                category:
                  "گشتی",

                description:
                  "",

                keywords:
                  "",

                lang:
                  data.lang ||
                  "en",

                pageCount:
                  data.pageCount ||
                  0,

                cover_url:
                  "",

                pdf_url:
                  uploaded.url
              };

              return insertRemoteBook(
                book
              ).then(
                function (
                  remoteBook
                ) {
                  remoteBook.pdfData =
                    data.pdfData;

                  remoteBook.pages =
                    data.pages ||
                    [];

                  remoteBook.lang =
                    data.lang ||
                    "en";

                  remoteBook.pageCount =
                    data.pageCount ||
                    0;

                  remoteBook.currentPage =
                    0;

                  remoteBook.progress =
                    0;

                  remoteBook.favorite =
                    false;

                  remoteBook.bookmarked =
                    false;

                  remoteBook.isPublished =
                    true;

                  remoteBook.isRemote =
                    true;

                  return remoteBook;
                }
              );
            }
          );
        }
      )
      .then(
        function (
          savedBook
        ) {
          books.unshift(
            savedBook
          );

          renderBooks();
          renderOwnerPanel();

          toast(
            "کتێبەکە بە سەرکەوتوویی زیادکرا"
          );
        }
      )
      .catch(
        function (
          error
        ) {
          console.error(
            "Supabase addPDF:",
            error
          );

          deleteFromStorage(
            BOOKS_BUCKET,
            uploadedPdfPath
          )
            .catch(
              function (
                cleanupError
              ) {
                console.error(
                  "Supabase PDF cleanup:",
                  cleanupError
                );
              }
            )
            .finally(
              function () {
                toast(
                  "نەتوانرا PDF زیاد بکرێت: " +
                  String(
                    error &&
                    error.message
                      ? error.message
                      : "هەڵە"
                  ).slice(
                    0,
                    100
                  )
                );
              }
            );
        }
      );

    var input =
      $("pdfInput");

    if (input) {
      input.value =
        "";
    }
  }


  /* =======================================================
     BOOK HELPERS
     ======================================================= */

  function langName(
    lang
  ) {
    if (
      lang ===
      "ku"
    ) {
      return "کوردی";
    }

    if (
      lang ===
      "ar"
    ) {
      return "عەرەبی";
    }

    if (
      lang ===
      "fa"
    ) {
      return "فارسی";
    }

    return "ئینگلیزی";
  }

  function getLatestBook() {
    if (
      !books.length
    ) {
      return null;
    }

    var candidates =
      books
        .slice()
        .sort(
          function (
            a,
            b
          ) {
            var aTime =
              Number(
                a.updatedAt ||
                a.addedAt ||
                0
              );

            var bTime =
              Number(
                b.updatedAt ||
                b.addedAt ||
                0
              );

            return (
              bTime -
              aTime
            );
          }
        );

    var started =
      candidates.find(
        function (
          book
        ) {
          return (
            (
              Number(
                book.progress
              ) ||
              0
            ) >
              0 ||
            (
              Number(
                book.currentPage
              ) ||
              0
            ) >
              0
          );
        }
      );

    return (
      started ||
      candidates[0] ||
      null
    );
  }


  /* =======================================================
     BOOK LIST + HOME STATS
     ======================================================= */

  function filteredBooks() {
    var list =
      books
        .slice()
        .sort(
          function (
            a,
            b
          ) {
            return (
              Number(
                b.addedAt ||
                0
              ) -
              Number(
                a.addedAt ||
                0
              )
            );
          }
        );

    if (
      filter ===
      "favorites"
    ) {
      list =
        list.filter(
          function (
            book
          ) {
            return !!book.favorite;
          }
        );

    } else if (
      filter ===
      "recent"
    ) {
      list =
        list.slice(
          0,
          8
        );

    } else if (
      filter !==
      "all"
    ) {
      list =
        list.filter(
          function (
            book
          ) {
            return (
              book.category ||
              "گشتی"
            ) ===
              filter;
          }
        );
    }

    if (
      query
    ) {
      var q =
        query.toLowerCase();

      list =
        list.filter(
          function (
            book
          ) {
            var text =
              [
                book.title,
                book.author,
                book.category
              ]
                .filter(
                  Boolean
                )
                .join(" ")
                .toLowerCase();

            return (
              text.indexOf(
                q
              ) >=
              0
            );
          }
        );
    }

    return list;
  }

  function updateHomeStats() {
    var bookCount =
      $("bookCount");

    var favoriteCount =
      $("favoriteCount");

    var wordCount =
      $("wordCount");

    if (
      bookCount
    ) {
      bookCount.textContent =
        books.length;
    }

    if (
      favoriteCount
    ) {
      favoriteCount.textContent =
        books.filter(
          function (
            book
          ) {
            return !!book.favorite;
          }
        ).length;
    }

    if (
      wordCount
    ) {
      wordCount.textContent =
        vocab.length;
    }

    var latest =
      getLatestBook();

    var progress =
      0;

    var title =
      "";

    if (
      latest
    ) {
      title =
        latest.title ||
        "";

      var numericProgress =
        Number(
          latest.progress
        );

      if (
        Number.isFinite(
          numericProgress
        )
      ) {
        progress =
          numericProgress;
      }

      if (
        progress <=
          0 &&
        latest.pageCount
      ) {
        var current =
          Number(
            latest.currentPage
          ) ||
          0;

        var pageCount =
          Number(
            latest.pageCount
          ) ||
          1;

        progress =
          pageCount >
          1
            ? current /
              (
                pageCount -
                1
              )
            : current >
                0
            ? 1
            : 0;
      }
    }

    progress =
      Math.max(
        0,
        Math.min(
          1,
          progress
        )
      );

    var progressPercent =
      Math.round(
        progress *
          100
      );

    var continueLabel =
      $(
        "continueProgressLabel"
      );

    var continueBar =
      $(
        "continueProgress"
      );

    var continueTitle =
      document.querySelector(
        ".continue-info h3"
      );

    if (
      continueLabel
    ) {
      continueLabel.textContent =
        progressPercent +
        "%";
    }

    if (
      continueBar
    ) {
      continueBar.style.width =
        progressPercent +
        "%";
    }

    if (
      continueTitle
    ) {
      continueTitle.textContent =
        latest
          ? title
          : "کتێبەکەت لەوێیە";
    }
  }

  function renderBooks() {
    var list =
      filteredBooks();

    var count =
      $("bookCount");

    var favorites =
      $("favoriteCount");

    var words =
      $("wordCount");

    var hint =
      $("resultHint");

    var box =
      $("bookList");

    if (
      count
    ) {
      count.textContent =
        books.length;
    }

    if (
      favorites
    ) {
      favorites.textContent =
        books.filter(
          function (
            book
          ) {
            return !!book.favorite;
          }
        ).length;
    }

    if (
      words
    ) {
      words.textContent =
        vocab.length;
    }

    if (
      hint
    ) {
      hint.textContent =
        list.length +
        " کتێب";
    }

    updateHomeStats();

    if (!box) {
      return;
    }

    if (
      !list.length
    ) {
      box.innerHTML =
        '<div class="empty library-empty" style="grid-column:1/-1">' +
        '<div class="empty-icon">' +
        '<i class="fa-solid fa-book-open"></i>' +
        "</div>" +
        "<h3>" +
        (
          query
            ? "هیچ ئەنجامێک نەدۆزرایەوە"
            : "هێشتا کتێب نییە"
        ) +
        "</h3>" +
        "<p>" +
        (
          query
            ? "وشە یان ناوی نووسەرێکی تر تاقی بکەوە."
            : "PDF ـێک زیاد بکە بۆ دەستپێکردنی خوێندنەوە."
        ) +
        "</p>" +
        '<button class="primary empty-button" type="button" data-action="add-pdf">' +
        '<i class="fa-solid fa-file-circle-plus"></i>' +
        " زیادکردنی PDF" +
        "</button>" +
        "</div>";

      return;
    }

    box.innerHTML =
      list
        .map(
          function (
            book
          ) {
            var progress =
              Number(
                book.progress
              ) ||
              0;

            if (
              progress <=
                0 &&
              book.pageCount
            ) {
              var current =
                Number(
                  book.currentPage
                ) ||
                0;

              var pageCount =
                Number(
                  book.pageCount
                ) ||
                1;

              progress =
                pageCount >
                1
                  ? current /
                    (
                      pageCount -
                      1
                    )
                  : current >
                      0
                  ? 1
                  : 0;
            }

            progress =
              Math.max(
                0,
                Math.min(
                  1,
                  progress
                )
              );

            var percent =
              Math.round(
                progress *
                  100
              );

            return (
              '<article class="book" data-book="' +
              esc(
                book.id
              ) +
              '">' +

              '<button class="fav" data-action="fav" title="دڵخواز" type="button">' +

              '<i class="' +
              (
                book.favorite
                  ? "fa-solid"
                  : "fa-regular"
              ) +
              ' fa-heart"></i>' +

              "</button>" +

              '<div class="cover">' +
              '<i class="fa-solid fa-book-bookmark"></i>' +
              "</div>" +

              '<div class="book-main">' +

              '<div class="book-title">' +
              esc(
                book.title
              ) +
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
              (
                book.pageCount ||
                0
              ) +
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
              percent +
              '%"></span>' +
              "</div>" +

              '<div class="actions">' +

              '<button class="small primary" data-action="open-book" type="button">' +
              '<i class="fa-solid fa-book-open"></i>' +
              " خوێندنەوە" +
              "</button>" +

              '<button class="small" data-action="del-book" title="سڕینەوە" type="button">' +
              '<i class="fa-regular fa-trash-can"></i>' +
              "</button>" +

              "</div>" +
              "</div>" +
              "</article>"
            );
          }
        )
        .join("");
  }


  /* =======================================================
     OPEN BOOK
     ======================================================= */

  function openBook(
    id
  ) {
    var book =
      books.find(
        function (
          item
        ) {
          return (
            item.id ===
            id
          );
        }
      );

    if (!book) {
      toast(
        "کتێبەکە نەدۆزرایەوە"
      );

      return;
    }

    if (
      book.isRemote &&
      !book.pdfData &&
      book.pdf_url
    ) {
      toast(
        "PDF خەریکی دابەزاندنە..."
      );

      fetch(
        book.pdf_url
      )
        .then(
          function (
            response
          ) {
            if (
              !response.ok
            ) {
              throw new Error(
                "PDF HTTP " +
                response.status
              );
            }

            return response.arrayBuffer();
          }
        )
        .then(
          function (
            buffer
          ) {
            book.pdfData =
              new Uint8Array(
                buffer
              );

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
        )
        .catch(
          function (
            error
          ) {
            console.error(
              "Remote PDF open:",
              error
            );

            toast(
              "PDF نەکرایەوە: " +
              String(
                error.message ||
                "هەڵە"
              ).slice(
                0,
                100
              )
            );
          }
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


  /* =======================================================
     FAVORITE
     ======================================================= */

  function toggleFavorite(
    id
  ) {
    var book =
      books.find(
        function (
          item
        ) {
          return (
            item.id ===
            id
          );
        }
      );

    if (!book) {
      return;
    }

    book.favorite =
      !book.favorite;

    book.updatedAt =
      Date.now();

    if (
      book.isRemote
    ) {
      renderBooks();
      toast(
        book.favorite
          ? "کتێبەکە خرایە ناو دڵخوازەکان"
          : "کتێبەکە لە دڵخوازەکان لابرا"
      );

      return;
    }

    dbPut(
      book
    )
      .then(
        function () {
          renderBooks();
          renderOwnerPanel();

          toast(
            book.favorite
              ? "کتێبەکە خرایە ناو دڵخوازەکان"
              : "کتێبەکە لە دڵخوازەکان لابرا"
          );
        }
      )
      .catch(
        function (
          error
        ) {
          console.error(
            "favorite:",
            error
          );

          toast(
            "نوێکردنەوەی دڵخواز سەرکەوتوو نەبوو"
          );
        }
      );
  }


  /* =======================================================
     DELETE BOOK
     ======================================================= */

  function deleteBook(
    id
  ) {
    var book =
      books.find(
        function (
          item
        ) {
          return (
            item.id ===
            id
          );
        }
      );

    if (!book) {
      return;
    }

    if (
      !window.confirm(
        "دڵنیایت لە سڕینەوەی «" +
        book.title +
        "»؟"
      )
    ) {
      return;
    }

    if (
      book.isRemote &&
      supabaseReady()
    ) {
      toast(
        "خەریکی سڕینەوەی کتێبەکەیە..."
      );

      deleteRemoteBook(
        book
      )
        .then(
          function () {
            books =
              books.filter(
                function (
                  item
                ) {
                  return (
                    item.id !==
                    id
                  );
                }
              );

            renderBooks();
            renderOwnerPanel();

            toast(
              "کتێبەکە لە داتابەیس و Storage سڕایەوە"
            );
          }
        )
        .catch(
          function (
            error
          ) {
            console.error(
              "Supabase deleteBook:",
              error
            );

            toast(
              "سڕینەوە تەواو نەبوو: " +
              String(
                error &&
                error.message
                  ? error.message
                  : "هەڵە"
              ).slice(
                0,
                110
              )
            );
          }
        );

      return;
    }

    dbDelete(
      id
    )
      .then(
        function () {
          books =
            books.filter(
              function (
                item
              ) {
                return (
                  item.id !==
                  id
                );
              }
            );

          renderBooks();
          renderOwnerPanel();

          toast(
            "کتێبەکە سڕایەوە"
          );
        }
      )
      .catch(
        function (
          error
        ) {
          console.error(
            "deleteBook:",
            error
          );

          toast(
            "سڕینەوە سەرکەوتوو نەبوو"
          );
        }
      );
  }


  /* =======================================================
     TRANSLATION HELPERS
     ======================================================= */

  function mapTranslationLang(
    lang,
    myMemory
  ) {
    var value =
      String(
        lang || ""
      ).toLowerCase();

    if (
      value ===
        "ckb" ||
      value ===
        "ku" ||
      value ===
        "ku-arab"
    ) {
      return myMemory
        ? "ku"
        : "ckb";
    }

    if (
      value ===
        "ar" ||
      value ===
        "ar-sa"
    ) {
      return "ar";
    }

    if (
      value ===
        "fa" ||
      value ===
        "fa-ir"
    ) {
      return "fa";
    }

    if (
      value ===
        "en" ||
      value ===
        "en-us"
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
      latin >
        0 &&
      latin >
        arabic
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

    if (
      mapTranslationLang(
        targetLang,
        false
      ) ===
        "ckb" &&
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
      return Promise.resolve(
        ""
      );
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
        targetLang ||
          "ckb",
        false
      );

    if (
      sl ===
      tl
    ) {
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

    return fetch(
      url
    )
      .then(
        function (
          response
        ) {
          if (
            !response.ok
          ) {
            throw new Error(
              "Google HTTP " +
              response.status
            );
          }

          return response.json();
        }
      )
      .then(
        function (
          data
        ) {
          var result =
            (
              data[0] ||
              []
            )
              .map(
                function (
                  part
                ) {
                  return (
                    part[0] ||
                    ""
                  );
                }
              )
              .join(
                ""
              )
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
        }
      );
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
      return Promise.resolve(
        ""
      );
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
        targetLang ||
          "ckb",
        true
      );

    if (
      sl ===
      tl
    ) {
      return Promise.resolve(
        sourceText
      );
    }

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
        sl +
        "|" +
        tl
      );

    return fetch(
      url
    )
      .then(
        function (
          response
        ) {
          if (
            !response.ok
          ) {
            throw new Error(
              "MyMemory HTTP " +
              response.status
            );
          }

          return response.json();
        }
      )
      .then(
        function (
          data
        ) {
          if (
            data &&
            data.responseStatus &&
            Number(
              data.responseStatus
            ) !==
              200
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
        }
      );
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
      return Promise.resolve(
        ""
      );
    }

    var source =
      detectSourceLang(
        value
      );

    return googleTranslateText(
      value,
      source,
      targetLang ||
        "ckb"
    )
      .catch(
        function () {
          return myMemoryTranslateText(
            value,
            source,
            targetLang ||
              "ckb"
          );
        }
      );
  }

  function uniqueStrings(
    values
  ) {
    var output = [];
    var seen = {};

    (
      values ||
      []
    ).forEach(
      function (
        value
      ) {
        var clean =
          String(
            value || ""
          )
            .replace(
              /\s+/g,
              " "
            )
            .trim();

        if (!clean) {
          return;
        }

        var key =
          clean.toLowerCase();

        if (
          !seen[key]
        ) {
          seen[key] =
            true;

          output.push(
            clean
          );
        }
      }
    );

    return output.slice(
      0,
      5
    );
  }


  /* =======================================================
     GEMINI DICTIONARY
     ======================================================= */

  function geminiMeanings(
    word,
    targetLang
  ) {
    var apiKey =
      (
        localStorage.getItem(
          "kh_gemini_key"
        ) ||
        ""
      ).trim();

    if (!apiKey) {
      return Promise.reject(
        new Error(
          "NO_GEMINI_KEY"
        )
      );
    }

    var cleanWord =
      String(
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

    if (!cleanWord) {
      return Promise.reject(
        new Error(
          "EMPTY_WORD"
        )
      );
    }

    var isSorani =
      targetLang ===
      "ckb";

    var target =
      isSorani
        ? "کوردی سۆرانیی ستاندارد"
        : "عەرەبیی فەصیح و ستاندارد";

    var prompt =
      "You are the dictionary engine of a Kurdish learning app.\n\n" +

      "SOURCE WORD:\n" +
      cleanWord +
      "\n\n" +

      "TARGET LANGUAGE:\n" +
      target +
      "\n\n" +

      "TASK:\n" +

      (
        isSorani
          ? "Translate the source word into clean Standard Central Kurdish (Sorani) only."
          : "Translate the source word into clear Modern Standard Arabic only."
      ) +

      "\n\n" +

      "MEANING ORDER:\n" +
      "1. MAIN = the primary and most common dictionary meaning.\n" +
      "2. RELATED = a close useful alternative meaning.\n" +
      "3. RELATED = another common contextual meaning, only if real.\n" +
      "4. RELATED = another useful contextual meaning, only if real.\n" +
      "5. RELATED = only when genuinely necessary.\n\n" +

      "RULES:\n" +
      "- The first meaning MUST be the main meaning.\n" +
      "- Later meanings must be genuinely related.\n" +
      "- Do not invent meanings.\n" +
      "- Keep each meaning short and dictionary-like.\n" +
      "- Prefer 1 to 5 words per meaning.\n" +
      "- No examples.\n" +
      "- No explanations.\n" +
      "- No numbering.\n" +
      "- No transliteration.\n" +
      "- Do not repeat the source word.\n" +

      (
        isSorani
          ? "\nSORANI QUALITY RULES:\n- Use only standard Sorani Kurdish vocabulary.\n- Never use Badini.\n- Never use Kurmanji.\n- Never use Persian as a replacement vocabulary.\n- Never use Latin transliteration.\n- Do not return English words inside Sorani meanings."
          : "\nARABIC QUALITY RULES:\n- Use Modern Standard Arabic.\n- Do not use dialect unless necessary."
      ) +

      "\n\n" +

      'RETURN ONLY THIS JSON SHAPE:\n{"meanings":["main meaning","related meaning","related meaning"]}';

    var url =
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
                prompt
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
            "application/json",

          "x-goog-api-key":
            apiKey
        },

        body:
          JSON.stringify(
            payload
          )
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
                  .content
                  .parts
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
              "Gemini هیچ وەڵامێکی نەدا"
            );
          }

          var start =
            text.indexOf(
              "{"
            );

          var end =
            text.lastIndexOf(
              "}"
            );

          if (
            start >=
              0 &&
            end >
              start
          ) {
            text =
              text.slice(
                start,
                end +
                  1
              );
          }

          var parsed;

          try {
            parsed =
              JSON.parse(
                text
              );
          } catch (error) {
            throw new Error(
              "Gemini JSON نەدروستە"
            );
          }

          var meanings =
            uniqueStrings(
              parsed &&
              parsed.meanings
            );

          if (
            !meanings.length
          ) {
            throw new Error(
              "Gemini مانای وشە نەهێنا"
            );
          }

          return meanings;
        }
      );
  }


  /* =======================================================
     WORD / DICTIONARY
     ======================================================= */

  function speakText(
    text,
    lang
  ) {
    if (
      !("speechSynthesis" in
        window)
    ) {
      toast(
        "خوێندنەوەی دەنگی بەردەست نییە"
      );

      return;
    }

    var value =
      String(
        text || ""
      ).trim();

    if (!value) {
      return;
    }

    window.speechSynthesis.cancel();

    var utterance =
      new SpeechSynthesisUtterance(
        value
      );

    if (
      lang ===
      "ar"
    ) {
      utterance.lang =
        "ar-SA";
    } else if (
      lang ===
      "ku"
    ) {
      utterance.lang =
        "ku";
    } else if (
      lang ===
      "fa"
    ) {
      utterance.lang =
        "fa-IR";
    } else {
      utterance.lang =
        "en-US";
    }

    utterance.rate =
      0.85;

    utterance.volume =
      0.9;

    window.speechSynthesis.speak(
      utterance
    );
  }

  function openWordSheet(
    word
  ) {
    var clean =
      String(
        word || ""
      ).trim();

    if (!clean) {
      return;
    }

    currentWord =
      clean;

    var sourceLang =
      currentWordLang ||
      "en";

    var modalWord =
      $("modalWord");

    var modalKu =
      $("modalKu");

    var modalAr =
      $("modalArText");

    if (
      modalWord
    ) {
      modalWord.textContent =
        clean;
    }

    if (
      modalKu
    ) {
      modalKu.textContent =
        "چاوەڕوانی...";
    }

    if (
      modalAr
    ) {
      modalAr.textContent =
        "چاوەڕوانی...";
    }

    var back =
      $("wordBack");

    var sheet =
      $("wordSheet");

    openSheet(
      back,
      sheet
    );

    var requestId =
      ++wordRequestId;

    Promise.all([
      geminiMeanings(
        clean,
        "ckb"
      ),
      geminiMeanings(
        clean,
        "ar"
      )
    ])
      .then(
        function (
          results
        ) {
          if (
            requestId !==
            wordRequestId
          ) {
            return;
          }

          currentWordMeanings = {
            ku:
              results[0] ||
              [],

            ar:
              results[1] ||
              []
          };

          if (
            modalKu
          ) {
            modalKu.innerHTML =
              currentWordMeanings.ku
                .map(
                  function (
                    meaning,
                    index
                  ) {
                    return (
                      '<div class="meaning-line ' +
                      (
                        index ===
                        0
                          ? "main"
                          : ""
                      ) +
                      '">' +
                      esc(
                        meaning
                      ) +
                      "</div>"
                    );
                  }
                )
                .join("");
          }

          if (
            modalAr
          ) {
            modalAr.innerHTML =
              currentWordMeanings.ar
                .map(
                  function (
                    meaning,
                    index
                  ) {
                    return (
                      '<div class="meaning-line ' +
                      (
                        index ===
                        0
                          ? "main"
                          : ""
                      ) +
                      '">' +
                      esc(
                        meaning
                      ) +
                      "</div>"
                    );
                  }
                )
                .join("");
          }
        }
      )
      .catch(
        function (
          error
        ) {
          console.error(
            "Dictionary:",
            error
          );

          if (
            modalKu
          ) {
            modalKu.textContent =
              "نەتوانرا مانا بهێنرێت";
          }

          if (
            modalAr
          ) {
            modalAr.textContent =
              "نەتوانرا مانا بهێنرێت";
          }

          if (
            error &&
            error.message ===
              "NO_GEMINI_KEY"
          ) {
            toast(
              "تکایە کلیلی Gemini لە ڕێکخستنەکان دابنێ"
            );
          }
        }
      );
  }


  /* =======================================================
     VOCABULARY
     ======================================================= */

  function renderVocab() {
    var box =
      $("vocabList");

    if (!box) {
      return;
    }

    if (
      !vocab.length
    ) {
      box.innerHTML =
        '<div class="empty" style="grid-column:1/-1">' +
        '<div class="empty-icon">' +
        '<i class="fa-solid fa-language"></i>' +
        "</div>" +
        "<h3>هێشتا وشەیەک خەزن نەکراوە</h3>" +
        "<p>وشەیەک لە Reader هەڵبژێرە و خەزنی بکە.</p>" +
        "</div>";

      return;
    }

    box.innerHTML =
      vocab
        .map(
          function (
            item
          ) {
            return (
              '<article class="book">' +
              '<div class="book-main">' +

              '<div class="book-title">' +
              esc(
                item.word
              ) +
              "</div>" +

              '<div class="book-author">' +
              esc(
                item.meaning ||
                ""
              ) +
              "</div>" +

              '<div class="actions">' +

              '<button class="small primary" data-vspeak="' +
              esc(
                item.word
              ) +
              '" data-vlang="' +
              esc(
                item.lang ||
                "en"
              ) +
              '" type="button">' +

              '<i class="fa-solid fa-volume-high"></i>' +
              " دەنگ" +

              "</button>" +

              '<button class="small" data-vdel="' +
              esc(
                item.id
              ) +
              '" type="button">' +

              '<i class="fa-regular fa-trash-can"></i>' +
              " سڕینەوە" +

              "</button>" +

              "</div>" +
              "</div>" +
              "</article>"
            );
          }
        )
        .join("");
  }


  /* =======================================================
     OWNER PANEL
     ======================================================= */

  function renderOwnerPanel() {
    var total =
      $("ownerTotalBooks");

    var pub =
      $("ownerPublicBooks");

    var pending =
      $("ownerPendingBooks");

    var audios =
      $("ownerTotalAudios");

    if (
      total
    ) {
      total.textContent =
        books.length;
    }

    if (
      pub
    ) {
      pub.textContent =
        books.filter(
          function (
            item
          ) {
            return (
              item.isPublished !==
              false
            );
          }
        ).length;
    }

    if (
      pending
    ) {
      pending.textContent =
        books.filter(
          function (
            item
          ) {
            return (
              item.isPublished ===
              false
            );
          }
        ).length;
    }

    if (
      audios
    ) {
      audios.textContent =
        music.length;
    }

    var list =
      $("ownerBooksList");

    if (
      !list
    ) {
      return;
    }

    if (
      !books.length
    ) {
      list.innerHTML =
        '<div class="empty" style="padding:20px">' +
        "هێشتا کتێبێک نییە." +
        "</div>";

      return;
    }

    list.innerHTML =
      books
        .map(
          function (
            book
          ) {
            return (
              '<div class="owner-book-row" data-owner-book="' +
              esc(
                book.id
              ) +
              '">' +

              '<div class="owner-book-main">' +

              '<strong>' +
              esc(
                book.title ||
                "کتێب"
              ) +
              "</strong>" +

              "<small>" +
              esc(
                book.author ||
                "بێ نووسەر"
              ) +
              "</small>" +

              "</div>" +

              '<div class="owner-book-actions">' +

              '<button class="icon-btn" type="button" data-action="open-book" title="کردنەوە">' +
              '<i class="fa-solid fa-book-open"></i>' +
              "</button>" +

              '<button class="icon-btn" type="button" data-action="del-book" title="سڕینەوە">' +
              '<i class="fa-regular fa-trash-can"></i>' +
              "</button>" +

              "</div>" +

              "</div>"
            );
          }
        )
        .join("");
  }


  /* =======================================================
     MUSIC
     ======================================================= */

  function renderTracks() {
    var box =
      $("tracks");

    if (!box) {
      return;
    }

    if (
      !music.length
    ) {
      box.innerHTML =
        '<div style="padding:15px;text-align:center;color:var(--muted);font-size:8px">هێشتا موزیکێک نییە</div>';

      return;
    }

    box.innerHTML =
      music
        .map(
          function (
            track,
            index
          ) {
            return (
              '<div class="track" data-track="' +
              index +
              '">' +

              '<button type="button" data-track-play="' +
              index +
              '">' +

              '<i class="fa-solid fa-play"></i>' +

              "</button>" +

              "<span>" +
              esc(
                track.name ||
                "موزیک"
              ) +
              "</span>" +

              "</div>"
            );
          }
        )
        .join("");
  }

  function addMusicFiles(
    files
  ) {
    if (
      !files ||
      !files.length
    ) {
      return;
    }

    if (!supabaseReady()) {
      toast(
        "Supabase پەیوەست نییە"
      );

      return;
    }

    var tasks =
      [];

    for (
      var i = 0;
      i <
      files.length;
      i++
    ) {
      (function (
        file
      ) {
        if (
          !file ||
          !file.type ||
          file.type.indexOf(
            "audio/"
          ) !==
            0
        ) {
          return;
        }

        var safeName =
          file.name
            .replace(
              /[^a-zA-Z0-9._-]+/g,
              "-"
            )
            .replace(
              /-+/g,
              "-"
            )
            .replace(
              /^[-.]+|[-.]+$/g,
              ""
            ) ||
          "audio";

        var path =
          Date.now() +
          "-" +
          Math.floor(
            Math.random() *
              1000000
          ) +
          "-" +
          safeName;

        tasks.push(
          uploadToStorage(
            MUSIC_BUCKET,
            path,
            file
          )
            .then(
              function (
                uploaded
              ) {
                var probe =
                  document.createElement(
                    "audio"
                  );

                probe.preload =
                  "metadata";

                return new Promise(
                  function (
                    resolve
                  ) {
                    var done =
                      false;

                    function finish(
                      duration
                    ) {
                      if (
                        done
                      ) {
                        return;
                      }

                      done =
                        true;

                      insertRemoteMusic(
                        {
                          name:
                            file.name.replace(
                              /\.[^.]+$/i,
                              ""
                            ),

                          artist:
                            "",

                          category:
                            "",

                          cover_url:
                            "",

                          audio_url:
                            uploaded.url,

                          duration:
                            Number(
                              duration
                            ) ||
                            0
                        }
                      )
                        .then(
                          resolve
                        )
                        .catch(
                          function (
                            error
                          ) {
                            resolve(
                              Promise.reject(
                                error
                              )
                            );
                          }
                        );
                    }

                    probe.onloadedmetadata =
                      function () {
                        finish(
                          probe.duration
                        );
                      };

                    probe.onerror =
                      function () {
                        finish(
                          0
                        );
                      };

                    probe.src =
                      uploaded.url;
                  }
                );
              }
            )
        );
      })(
        files[i]
      );
    }

    if (
      !tasks.length
    ) {
      return;
    }

    toast(
      "موزیکەکان خەریکی بارکردنن..."
    );

    Promise.all(
      tasks
    )
      .then(
        function (
          remoteTracks
        ) {
          remoteTracks.forEach(
            function (
              track
            ) {
              music.push(
                track
              );
            }
          );

          if (
            musicIndex <
              0 &&
            music.length
          ) {
            loadTrack(
              0,
              false
            );
          }

          renderTracks();

          toast(
            "موزیکەکان بە سەرکەوتوویی زیادکران"
          );
        }
      )
      .catch(
        function (
          error
        ) {
          console.error(
            "Supabase addMusicFiles:",
            error
          );

          toast(
            "نەتوانرا موزیک زیاد بکرێت: " +
            String(
              error &&
              error.message
                ? error.message
                : "هەڵە"
            ).slice(
              0,
              100
            )
          );
        }
      );
  }

  function loadTrack(
    index,
    autoplay
  ) {
    if (
      !music[index]
    ) {
      return;
    }

    musicIndex =
      index;

    var audio =
      $("audio");

    if (
      audio
    ) {
      audio.src =
        music[index].url;

      audio.volume =
        musicVolume;
    }

    var name =
      $("nowName");

    var sub =
      $("nowSub");

    if (
      name
    ) {
      name.textContent =
        music[index].name;
    }

    if (
      sub
    ) {
      sub.textContent =
        music[index].artist ||
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
        .catch(
          function () {}
        );
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
      !!(
        audio &&
        !audio.paused &&
        musicIndex >=
          0
      );

    if (
      button
    ) {
      button.innerHTML =
        playing
          ? '<i class="fa-solid fa-pause"></i>'
          : '<i class="fa-solid fa-play"></i>';
    }

    document
      .querySelectorAll(
        "[data-track]"
      )
      .forEach(
        function (
          item
        ) {
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

          if (!icon) {
            return;
          }

          icon.className =
            "fa-solid " +
            (
              index ===
                musicIndex &&
              playing
                ? "fa-pause"
                : "fa-play"
            );
        }
      );
  }


  /* =======================================================
     ACTION HANDLER
     ======================================================= */

  document.addEventListener(
    "click",
    function (
      event
    ) {
      var speakButton =
        event.target.closest(
          "[data-vspeak]"
        );

      if (
        speakButton
      ) {
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

      var trackPlay =
        event.target.closest(
          "[data-track-play]"
        );

      if (
        trackPlay
      ) {
        var trackIndex =
          Number(
            trackPlay.getAttribute(
              "data-track-play"
            )
          );

        loadTrack(
          trackIndex,
          true
        );

        return;
      }

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
        "add-pdf"
      ) {
        var pdfInput =
          $("pdfInput");

        if (
          pdfInput
        ) {
          pdfInput.click();
        }

        return;
      }

      if (
        name ===
        "add-music"
      ) {
        var musicInput =
          $("musicInput");

        if (
          musicInput
        ) {
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

        if (
          card
        ) {
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
        var favoriteCard =
          action.closest(
            ".book"
          );

        if (
          favoriteCard
        ) {
          toggleFavorite(
            favoriteCard.getAttribute(
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
        var deleteCard =
          action.closest(
            ".book"
          );

        if (
          deleteCard
        ) {
          deleteBook(
            deleteCard.getAttribute(
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
        var latest =
          getLatestBook();

        if (
          latest
        ) {
          openBook(
            latest.id
          );
        } else {
          toast(
            "هێشتا کتێبێک نییە"
          );
        }

        return;
      }

      if (
        name ===
        "settings"
      ) {
        openSheet(
          $("sheetBack"),
          $("settingsSheet")
        );

        renderSiteThemes();
        renderReaderThemes();
        updateThemeBadges();

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
        openSheet(
          $("ownerBack"),
          $("ownerSheet")
        );

        renderOwnerPanel();

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
        "save-word"
      ) {
        if (
          !currentWord
        ) {
          return;
        }

        var item = {
          id:
            String(
              Date.now()
            ) +
            "_" +
            Math.floor(
              Math.random() *
                100000
            ),

          word:
            currentWord,

          lang:
            currentWordLang ||
            "en",

          meaning:
            (
              currentWordMeanings.ku[0] ||
              currentWordMeanings.ar[0] ||
              ""
            ),

          createdAt:
            Date.now()
        };

        vocab.push(
          item
        );

        saveJSON(
          "kh_vocab",
          vocab
        );

        renderVocab();
        renderBooks();

        toast(
          "وشەکە خەزن کرا"
        );

        return;
      }

      if (
        name ===
        "speak-word"
      ) {
        if (
          currentWord
        ) {
          speakText(
            currentWord,
            currentWordLang ||
              "en"
          );
        }

        return;
      }

      if (
        name ===
        "prev-track"
      ) {
        if (
          !music.length
        ) {
          return;
        }

        var prev =
          musicIndex <=
            0
            ? music.length -
              1
            : musicIndex -
              1;

        loadTrack(
          prev,
          true
        );

        return;
      }

      if (
        name ===
        "next-track"
      ) {
        if (
          !music.length
        ) {
          return;
        }

        var next =
          musicIndex >=
            music.length -
              1
            ? 0
            : musicIndex +
              1;

        loadTrack(
          next,
          true
        );

        return;
      }

      if (
        name ===
        "play-pause"
      ) {
        var audio =
          $("audio");

        if (
          !audio ||
          !music.length
        ) {
          return;
        }

        if (
          musicIndex <
          0
        ) {
          loadTrack(
            0,
            true
          );

          return;
        }

        if (
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
        "clear-vocab"
      ) {
        vocab =
          [];

        saveJSON(
          "kh_vocab",
          vocab
        );

        renderVocab();
        renderBooks();

        toast(
          "وشەکان سڕانەوە"
        );

        return;
      }

      if (
        name ===
        "reader-close"
      ) {
        if (
          window.ReaderEngine &&
          typeof window.ReaderEngine.close ===
            "function"
        ) {
          window.ReaderEngine.close();
        }

        return;
      }

      if (
        name ===
        "reader-tools"
      ) {
        if (
          window.ReaderEngine &&
          typeof window.ReaderEngine.openTools ===
            "function"
        ) {
          window.ReaderEngine.openTools();
        }

        return;
      }

      if (
        name ===
        "reader-music"
      ) {
        if (
          musicIndex >=
            0 &&
          music.length
        ) {
          openSheet(
            $("sheetBack"),
            $("settingsSheet")
          );
        } else {
          toast(
            "هێشتا موزیکێک نییە"
          );
        }

        return;
      }

      if (
        name ===
        "reader-speak"
      ) {
        if (
          window.ReaderEngine &&
          typeof window.ReaderEngine.toggleSpeech ===
            "function"
        ) {
          window.ReaderEngine.toggleSpeech();
        }

        return;
      }

      if (
        name ===
        "toggle-view"
      ) {
        if (
          window.ReaderEngine &&
          typeof window.ReaderEngine.toggleView ===
            "function"
        ) {
          window.ReaderEngine.toggleView();
        }

        return;
      }

      if (
        name ===
        "reader-kurdish"
      ) {
        if (
          window.ReaderEngine &&
          typeof window.ReaderEngine.toggleKurdish ===
            "function"
        ) {
          window.ReaderEngine.toggleKurdish();
        }

        return;
      }

      if (
        name ===
        "page-prev"
      ) {
        if (
          window.ReaderEngine &&
          typeof window.ReaderEngine.prevPage ===
            "function"
        ) {
          window.ReaderEngine.prevPage();
        }

        return;
      }

      if (
        name ===
        "page-next"
      ) {
        if (
          window.ReaderEngine &&
          typeof window.ReaderEngine.nextPage ===
            "function"
        ) {
          window.ReaderEngine.nextPage();
        }

        return;
      }

      if (
        name ===
        "font-down"
      ) {
        if (
          window.ReaderEngine &&
          typeof window.ReaderEngine.changeFontSize ===
            "function"
        ) {
          window.ReaderEngine.changeFontSize(
            -1
          );
        }

        return;
      }

      if (
        name ===
        "font-up"
      ) {
        if (
          window.ReaderEngine &&
          typeof window.ReaderEngine.changeFontSize ===
            "function"
        ) {
          window.ReaderEngine.changeFontSize(
            1
          );
        }

        return;
      }

      if (
        name ===
        "save-progress"
      ) {
        if (
          window.ReaderEngine &&
          typeof window.ReaderEngine.saveProgress ===
            "function"
        ) {
          window.ReaderEngine.saveProgress();
        }

        return;
      }

      if (
        name ===
        "tools-close"
      ) {
        if (
          window.ReaderEngine &&
          typeof window.ReaderEngine.closeTools ===
            "function"
        ) {
          window.ReaderEngine.closeTools();
        }

        return;
      }
    }
  );


  /* =======================================================
     FILTERS
     ======================================================= */

  document.addEventListener(
    "click",
    function (
      event
    ) {
      var filterButton =
        event.target.closest(
          "[data-filter]"
        );

      if (
        !filterButton
      ) {
        return;
      }

      var value =
        filterButton.getAttribute(
          "data-filter"
        );

      filter =
        value ||
        "all";

      document
        .querySelectorAll(
          "[data-filter]"
        )
        .forEach(
          function (
            item
          ) {
            item.classList.toggle(
              "active",
              item ===
                filterButton
            );
          }
        );

      renderBooks();
    }
  );


  /* =======================================================
     THEME EVENTS
     ======================================================= */

  document.addEventListener(
    "click",
    function (
      event
    ) {
      var siteButton =
        event.target.closest(
          "[data-site-theme]"
        );

      if (
        siteButton
      ) {
        setSiteTheme(
          siteButton.getAttribute(
            "data-site-theme"
          )
        );

        return;
      }

      var readerButton =
        event.target.closest(
          "[data-set-reader-theme]"
        );

      if (
        readerButton
      ) {
        var key =
          readerButton.getAttribute(
            "data-set-reader-theme"
          );

        readerTheme =
          key ||
          "paper";

        try {
          localStorage.setItem(
            "kh_reader_theme",
            readerTheme
          );
        } catch (error) {}

        updateThemeBadges();

        if (
          window.ReaderEngine &&
          typeof window.ReaderEngine.setTheme ===
            "function"
        ) {
          window.ReaderEngine.setTheme(
            readerTheme
          );
        }
      }

      var toggle =
        event.target.closest(
          "[data-toggle-target]"
        );

      if (
        toggle
      ) {
        var targetId =
          toggle.getAttribute(
            "data-toggle-target"
          );

        var target =
          $(targetId);

        if (
          target
        ) {
          target.classList.toggle(
            "hidden"
          );

          var icon =
            toggle.querySelector(
              ".arrow-icon"
            );

          if (
            icon
          ) {
            icon.classList.toggle(
              "open"
            );
          }
        }
      }
    }
  );


  /* =======================================================
     WORD SPEAK
     ======================================================= */

  document.addEventListener(
    "click",
    function (
      event
    ) {
      var arSpeak =
        event.target.closest(
          "#modalArSpeakBtn"
        );

      if (
        arSpeak
      ) {
        speakText(
          currentWordMeanings.ar[0] ||
            currentWord,
          "ar"
        );
      }
    }
  );


  /* =======================================================
     PDF / MUSIC INPUTS
     ======================================================= */

  var pdfInput =
    $("pdfInput");

  if (
    pdfInput
  ) {
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

  if (
    musicInput
  ) {
    musicInput.addEventListener(
      "change",
      function () {
        addMusicFiles(
          this.files
        );

        this.value =
          "";
      }
    );
  }


  /* =======================================================
     SEARCH
     ======================================================= */

  var search =
    $("searchInput");

  if (
    search
  ) {
    search.addEventListener(
      "input",
      function () {
        query =
          this.value.trim();

        renderBooks();
      }
    );
  }


  /* =======================================================
     GLOBAL SEARCH SUPPORT
     ======================================================= */

  var globalSearch =
    $("globalSearchInput");

  if (
    globalSearch
  ) {
    globalSearch.addEventListener(
      "input",
      function () {
        query =
          this.value.trim();

        renderBooks();

        var target =
          $("globalSearchResults");

        var source =
          $("bookList");

        if (
          target &&
          source
        ) {
          target.innerHTML =
            source.innerHTML;
        }
      }
    );
  }


  /* =======================================================
     AUDIO EVENTS
     ======================================================= */

  var audio =
    $("audio");

  if (
    audio
  ) {
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
            (
              this.currentTime /
              this.duration
            ) *
            100;
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

    audio.addEventListener(
      "ended",
      function () {
        if (
          music.length
        ) {
          var next =
            musicIndex >=
              music.length -
                1
              ? 0
              : musicIndex +
                1;

          loadTrack(
            next,
            true
          );
        }
      }
    );
  }

  var audioRange =
    $("audioRange");

  if (
    audioRange
  ) {
    audioRange.addEventListener(
      "input",
      function () {
        if (
          audio &&
          audio.duration
        ) {
          audio.currentTime =
            (
              Number(
                this.value
              ) /
              100
            ) *
            audio.duration;
        }
      }
    );
  }


  /* =======================================================
     MUSIC VOLUME
     ======================================================= */

  try {
    musicVolume =
      Number(
        localStorage.getItem(
          "kh_music_volume"
        ) ||
          0.32
      );

    if (
      !Number.isFinite(
        musicVolume
      )
    ) {
      musicVolume =
        0.32;
    }

    musicVolume =
      Math.max(
        0,
        Math.min(
          1,
          musicVolume
        )
      );

  } catch (error) {}


  /* =======================================================
     GEMINI KEY
     ======================================================= */

  var geminiInput =
    $("geminiApiKey");

  if (
    geminiInput
  ) {
    try {
      geminiInput.value =
        localStorage.getItem(
          "kh_gemini_key"
        ) ||
        "";
    } catch (error) {}

    geminiInput.addEventListener(
      "change",
      function () {
        try {
          localStorage.setItem(
            "kh_gemini_key",
            this.value.trim()
          );
        } catch (error) {}
      }
    );
  }


  /* =======================================================
     FONT SIZE
     ======================================================= */

  var fontSizeInput =
    $("fontSize");

  if (
    fontSizeInput
  ) {
    fontSizeInput.addEventListener(
      "change",
      function () {
        try {
          localStorage.setItem(
            "kh_font",
            this.value
          );
        } catch (error) {}

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


  /* =======================================================
     SHEET BACKDROPS
     ======================================================= */

  var sheetBack =
    $("sheetBack");

  if (
    sheetBack
  ) {
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

  if (
    ownerBack
  ) {
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

  if (
    wordBack
  ) {
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

  if (
    sentenceBack
  ) {
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


  /* =======================================================
     PAGE / BOOK ROUTE EVENTS
     ======================================================= */

  document.addEventListener(
    "xwendnga:routechange",
    function () {
      renderBooks();
      renderVocab();
      renderOwnerPanel();
      renderTracks();
      updateTelegramBtn();
    }
  );


  /* =======================================================
     READER WORD SELECTION SUPPORT
     ======================================================= */

  document.addEventListener(
    "click",
    function (
      event
    ) {
      var wordElement =
        event.target.closest(
          "[data-word]"
        );

      if (
        !wordElement
      ) {
        return;
      }

      var word =
        wordElement.getAttribute(
          "data-word"
        );

      if (
        !word
      ) {
        return;
      }

      currentWordLang =
        wordElement.classList.contains(
          "lang-ku"
        )
          ? "ku"
          : wordElement.classList.contains(
              "lang-ar"
            )
          ? "ar"
          : wordElement.classList.contains(
              "lang-fa"
            )
          ? "fa"
          : "en";

      openWordSheet(
        word
      );
    }
  );


  /* =======================================================
     READER API COORDINATION
     ======================================================= */

  window.AppLib = {
    openSettings:
      function () {
        openSheet(
          $("sheetBack"),
          $("settingsSheet")
        );

        renderSiteThemes();
        renderReaderThemes();
        updateThemeBadges();
      },

    updateTelegram:
      updateTelegramBtn,

    translateText:
      translateText,

    detectSourceLang:
      detectSourceLang,

    renderBooks:
      renderBooks,

    supabaseReady:
      supabaseReady,

    reloadFromSupabase:
      function () {
        return Promise.all([
          loadRemoteBooks(),
          loadRemoteMusic()
        ])
          .then(
            function (
              results
            ) {
              books =
                results[0] ||
                [];

              music =
                results[1] ||
                [];

              renderBooks();
              renderOwnerPanel();
              renderTracks();
              updatePlayButton();

              return {
                books:
                  books,

                music:
                  music
              };
            }
          );
      }
  };


  /* =======================================================
     INIT
     ======================================================= */

  function init() {
    vocab =
      loadJSON(
        "kh_vocab",
        []
      );

    siteTheme =
      localStorage.getItem(
        "kh_site_theme"
      ) ||
      "cyan";

    readerTheme =
      localStorage.getItem(
        "kh_reader_theme"
      ) ||
      "paper";

    try {
      musicVolume =
        Number(
          localStorage.getItem(
            "kh_music_volume"
          ) ||
            0.32
        );
    } catch (error) {
      musicVolume =
        0.32;
    }

    if (
      !Number.isFinite(
        musicVolume
      )
    ) {
      musicVolume =
        0.32;
    }

    setSiteTheme(
      siteTheme
    );

    renderReaderThemes();
    updateThemeBadges();

    renderVocab();
    renderTracks();
    updatePlayButton();

    /*
     * Shared public data comes from Supabase.
     */
    Promise.all([
      loadRemoteBooks(),
      loadRemoteMusic()
    ])
      .then(
        function (
          results
        ) {
          books =
            results[0] ||
            [];

          music =
            results[1] ||
            [];

          renderBooks();
          renderOwnerPanel();
          renderTracks();
          updatePlayButton();
          updateTelegramBtn();
        }
      )
      .catch(
        function (
          error
        ) {
          console.error(
            "Initial Supabase load:",
            error
          );

          /*
           * Keep the existing local IndexedDB fallback
           * so old books are not silently lost on this device.
           */
          dbAll()
            .then(
              function (
                storedBooks
              ) {
                books =
                  Array.isArray(
                    storedBooks
                  )
                    ? storedBooks
                    : [];

                renderBooks();
                renderOwnerPanel();
                updateTelegramBtn();
              }
            )
            .catch(
              function (
                dbError
              ) {
                console.error(
                  "Fallback local DB load:",
                  dbError
                );

                books =
                  [];

                renderBooks();
                renderOwnerPanel();
                updateTelegramBtn();
              }
            );

          toast(
            "نەتوانرا ناوەڕۆکی Supabase باربکرێت"
          );
        }
      );
  }


  init();

})();
