(function () {
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
  var BOOK_COVERS_BUCKET = "book-covers";
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

    if (!file) {
      return Promise.reject(
        new Error(
          "فایل بۆ بارکردن دیاری نەکراوە"
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

    try {
      return Promise.resolve(
        supabaseClient.storage
          .from(bucket)
          .remove([
            path
          ])
      ).then(
        function (result) {
          if (result && result.error) {
            throw result.error;
          }

          return result || null;
        }
      );
    } catch (error) {
      return Promise.reject(error);
    }
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

    if (language === "کوردی") lang = "ku";
    else if (language === "عەرەبی") lang = "ar";
    else if (language === "فارسی") lang = "fa";
    else if (language === "ئینگلیزی") lang = "en";

    var ownerProfile = row.profiles || null;
    if (Array.isArray(ownerProfile)) {
      ownerProfile = ownerProfile[0] || null;
    }

    return {
      id: String(row.id),
      remoteId: row.id,
      ownerId: row.owner_id || null,
      status: row.status || "approved",
      rejectionReason: row.rejection_reason || "",
      reviewedBy: row.reviewed_by || null,
      reviewedAt: row.reviewed_at || null,
      title: row.title || "",
      author: row.author || "",
      language: row.language || "",
      category: row.category || "گشتی",
      description: row.description || "",
      keywords: row.keywords || "",
      cover_url: row.cover_url || "",
      pdf_url: row.pdf_url || "",
      ownerProfile: ownerProfile,
      pages: [],
      pdfData: null,
      lang: lang,
      pageCount: Number(row.pages) || 0,
      currentPage: 0,
      progress: 0,
      favorite: false,
      bookmarked: false,
      isPublished: (row.status || "approved") === "approved",
      addedAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
      updatedAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
      isRemote: true
    };
  }

  function loadOwnerProfiles(ownerIds) {
    var ids = Array.from(
      new Set(
        (ownerIds || [])
          .filter(function (id) {
            return !!id;
          })
          .map(function (id) {
            return String(id);
          })
      )
    );

    if (!ids.length || !supabaseReady()) {
      return Promise.resolve({});
    }

    return supabaseClient
      .from("profiles")
      .select("id,display_name,username,avatar_url")
      .in("id", ids)
      .then(function (result) {
        if (result.error) {
          console.warn("loadOwnerProfiles:", result.error);
          return {};
        }

        var map = {};

        (result.data || []).forEach(function (profile) {
          if (profile && profile.id) {
            map[String(profile.id)] = profile;
          }
        });

        return map;
      });
  }

  function attachOwnerProfiles(bookItems) {
    var items = Array.isArray(bookItems) ? bookItems : [];
    var ownerIds = items.map(function (book) {
      return book && book.ownerId ? book.ownerId : null;
    });

    return loadOwnerProfiles(ownerIds)
      .then(function (profilesMap) {
        items.forEach(function (book) {
          if (!book) return;

          var ownerId = book.ownerId ? String(book.ownerId) : "";

          book.ownerProfile =
            (ownerId && profilesMap[ownerId])
              ? profilesMap[ownerId]
              : (
                  authState.user &&
                  ownerId === String(authState.user.id) &&
                  authState.profile
                    ? {
                        display_name: authState.profile.display_name || "",
                        username: authState.profile.username || "",
                        avatar_url: authState.profile.avatar_url || ""
                      }
                    : null
                );
        });

        return items;
      });
  }

  function loadRemoteBooks() {
    if (!supabaseReady()) {
      return Promise.resolve([]);
    }

    return supabaseClient
      .from("books")
      .select(
        "id,created_at,title,author,language,category,description,pages,cover_url,pdf_url,keywords,owner_id,status,rejection_reason,reviewed_by,reviewed_at"
      )
      .order("created_at", { ascending: false })
      .then(function (result) {
        if (result.error) {
          throw result.error;
        }

        var items = (result.data || [])
          .map(mapRemoteBook)
          .filter(Boolean);

        return attachOwnerProfiles(items);
      });
  }

  function insertRemoteBook(
    book
  ) {
    if (!supabaseReady()) {
      return Promise.reject(new Error("Supabase بەردەست نییە"));
    }

    return supabaseClient
      .from("books")
      .insert({
        title: book.title || "",
        author: book.author || "",
        language: book.language || book.lang || "en",
        category: book.category || "گشتی",
        description: book.description || "",
        pages: Number(book.pageCount) || 0,
        cover_url: book.cover_url || "",
        pdf_url: book.pdf_url || "",
        keywords: book.keywords || "",
        owner_id: authState.user ? authState.user.id : null
      })
      .select(
        "id,created_at,title,author,language,category,description,pages,cover_url,pdf_url,keywords,owner_id,status,rejection_reason,reviewed_by,reviewed_at"
      )
      .single()
      .then(function (result) {
        if (result.error) {
          throw result.error;
        }

        return attachOwnerProfiles([
          mapRemoteBook(result.data)
        ]).then(function (items) {
          return items[0] || mapRemoteBook(result.data);
        });
      });
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

    var coverPath =
      storagePathFromPublicUrl(
        book.cover_url,
        BOOK_COVERS_BUCKET
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

          return Promise.all([
            deleteFromStorage(
              BOOKS_BUCKET,
              pdfPath
            ),
            deleteFromStorage(
              BOOK_COVERS_BUCKET,
              coverPath
            )
          ]);
        }
      );
  }

  function loadRemoteMusic() {
    if (!supabaseReady()) {
      return Promise.resolve([]);
    }

    return supabaseClient
      .from("music")
      .select(
        "id,created_at,title,artist,category,cover_url,audio_url,duration,owner_id,status,rejection_reason,reviewed_by,reviewed_at"
      )
      .order("created_at", { ascending: false })
      .then(function (result) {
        if (result.error) {
          throw result.error;
        }

        return (result.data || []).map(function (row) {
          return {
            id: String(row.id),
            remoteId: row.id,
            ownerId: row.owner_id || null,
            status: row.status || "approved",
            rejectionReason: row.rejection_reason || "",
            reviewedBy: row.reviewed_by || null,
            reviewedAt: row.reviewed_at || null,
            name: row.title || "",
            artist: row.artist || "",
            category: row.category || "",
            cover_url: row.cover_url || "",
            audio_url: row.audio_url || "",
            duration: Number(row.duration) || 0,
            url: row.audio_url || "",
            isRemote: true
          };
        });
      });
  }

  function insertRemoteMusic(
    track
  ) {
    if (!supabaseReady()) {
      return Promise.reject(new Error("Supabase بەردەست نییە"));
    }

    return supabaseClient
      .from("music")
      .insert({
        title: track.name || "",
        artist: track.artist || "",
        category: track.category || "",
        cover_url: track.cover_url || "",
        audio_url: track.audio_url || "",
        duration: Math.round(Number(track.duration)) || 0
      })
      .select(
        "id,created_at,title,artist,category,cover_url,audio_url,duration,owner_id,status,rejection_reason,reviewed_by,reviewed_at"
      )
      .single()
      .then(function (result) {
        if (result.error) {
          throw result.error;
        }

        var row = result.data || {};
        return {
          id: String(row.id),
          remoteId: row.id,
          ownerId: row.owner_id || null,
          status: row.status || "pending",
          rejectionReason: row.rejection_reason || "",
          reviewedBy: row.reviewed_by || null,
          reviewedAt: row.reviewed_at || null,
          name: row.title || "",
          artist: row.artist || "",
          category: row.category || "",
          cover_url: row.cover_url || "",
          audio_url: row.audio_url || "",
          duration: Number(row.duration) || 0,
          url: row.audio_url || "",
          isRemote: true
        };
      });
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

  /* =======================================================
     AUTH / ROLES / CLOUD USER DATA
     ======================================================= */

  var authState = {
    user: null,
    profile: null,
    isAdmin: false,
    role: "anonymous",
    loading: true,
    favorites: {},
    savedWords: []
  };

  function favoriteKey(itemType, itemId) {
    return String(itemType || "book") + ":" + String(itemId);
  }

  var AUTH_RECOVERY_NOTICE =
    "هەژمارەکەت دروست بوو. ئەگەر پشتڕاستکردنەوەی ئیمەیڵ چالاک بێت، تکایە ئیمەیڵەکەت پشتڕاست بکەوە و پاشان بچۆ ژوورەوە.";

  var PREMIUM_PAYMENT_INFO = {
    fastpay: "ژمارەی FastPay ـەکەت لێرە دابنێ",
    fib: "ژمارەی FIB ـەکەت لێرە دابنێ",
    telegram: "@about_Barham"
  };

  var filter = "all";
  var query = "";
  var libraryMode = "public";

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
      $("settingsSiteThemes") ||
      $("siteThemes");

    if (!box) {
      return;
    }

    var modern =
      box.id ===
      "settingsSiteThemes";

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

            if (modern) {
              return (
                '<button class="settings-theme-option ' +
                (
                  key === siteTheme
                    ? "active"
                    : ""
                ) +
                '" type="button" data-site-theme="' +
                esc(key) +
                '" title="' +
                esc(theme.name) +
                '">' +
                '<span class="settings-theme-swatch" style="--theme-color:' +
                theme.a +
                '"></span>' +
                '<span class="settings-theme-name">' +
                esc(theme.name) +
                '</span>' +
                '</button>'
              );
            }

            return (
              '<button class="theme ' +
              (
                key === siteTheme
                  ? "active"
                  : ""
              ) +
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
              "</button>"
            );
          }
        )
        .join("");
  }

  function renderReaderThemes() {
    var box =
      $("settingsReaderThemes") ||
      $("readerThemes");

    if (!box) {
      return;
    }

    var modern =
      box.id ===
      "settingsReaderThemes";

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

            if (modern) {
              return (
                '<button class="settings-reader-option ' +
                (
                  key === readerTheme
                    ? "active"
                    : ""
                ) +
                '" type="button" data-set-reader-theme="' +
                esc(key) +
                '" title="' +
                esc(theme.name) +
                '">' +
                '<span class="settings-reader-swatch" style="--reader-fg:' +
                theme.fg + ';background:' + theme.bg + '"></span>' +
                '<span class="settings-theme-name">' +
                esc(theme.name) +
                '</span>' +
                '</button>'
              );
            }

            return (
              '<button class="theme ' +
              (
                key === readerTheme
                  ? "active"
                  : ""
              ) +
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


  /* XWENDNGA V3.0 — COVER CAPTURE + STORAGE CLEANUP HARDENING */


  /* =======================================================
     ADD BOOK FORM
     ======================================================= */

  var addBookCoverObjectUrl = "";
  var selectedBookCoverFile = null;

  function setAddBookMessage(message, type) {
    var box = $("addBookFormMessage");
    if (!box) return;
    box.textContent = message || "";
    box.className = "add-book-form-message" + (type ? " " + type : "");
  }

  function resetAddBookCoverPreview() {
    var preview = $("bookCoverPreview");
    if (addBookCoverObjectUrl) {
      try {
        URL.revokeObjectURL(addBookCoverObjectUrl);
      } catch (error) {}
      addBookCoverObjectUrl = "";
    }
    if (preview) {
      preview.innerHTML = '<i class="fa-solid fa-image"></i>';
    }
    if ($("bookCoverName")) {
      $("bookCoverName").textContent = "ئارەزوومەندانەیە";
    }
  }

  function resetAddBookForm() {
    selectedBookCoverFile = null;

    var form = $("addBookForm");
    if (form) form.reset();
    if ($("bookPdfName")) $("bookPdfName").textContent = "PDF ـەکە هەڵبژێرە";
    resetAddBookCoverPreview();
    setAddBookMessage("", "");
  }

  function closeAddBookSheet() {
    var shell = $("addBookSheet");
    var back = $("addBookBack");
    if (!shell) return;
    shell.setAttribute("aria-hidden", "true");
    closeSheet(back, shell);
    resetAddBookForm();
  }

  function openAddBookSheet() {
    if (!authState.user) {
      openAuthModal("login", "بۆ زیادکردنی کتێب سەرەتا بچۆ ژوورەوە.");
      return;
    }
    var shell = $("addBookSheet");
    var back = $("addBookBack");
    if (!shell || !back) return;
    resetAddBookForm();
    shell.setAttribute("aria-hidden", "false");
    openSheet(back, shell);
  }

  function handleBookCoverPreview(file) {
    var preview = $("bookCoverPreview");
    if (!preview) return;

    resetAddBookCoverPreview();
    selectedBookCoverFile = null;

    if (!file) return;
    if (!String(file.type || "").startsWith("image/")) {
      setAddBookMessage("تکایە فایلێکی وێنە هەڵبژێرە.", "error");
      return;
    }

    selectedBookCoverFile = file;
    addBookCoverObjectUrl = URL.createObjectURL(file);
    preview.innerHTML = '<img src="' + esc(addBookCoverObjectUrl) + '" alt="پێشبینینی بەرگی کتێب">';
    if ($("bookCoverName")) {
      $("bookCoverName").textContent = file.name || "وێنەی بەرگ";
    }
  }

  function submitAddBookForm(event) {
    event.preventDefault();

    if (!authState.user) {
      openAuthModal("login", "بۆ زیادکردنی کتێب سەرەتا بچۆ ژوورەوە.");
      return;
    }

    var pdfInput = $("bookPdfInput");
    var coverInput = $("bookCoverInput");
    var titleInput = $("bookTitleInput");
    var authorInput = $("bookAuthorInput");
    var categoryInput = $("bookCategoryInput");
    var languageInput = $("bookLanguageInput");
    var descriptionInput = $("bookDescriptionInput");
    var submitButton = $("addBookSubmit");

    var pdfFiles = pdfInput && pdfInput.files
      ? Array.from(pdfInput.files || [])
      : [];

    var coverFiles = coverInput && coverInput.files
      ? Array.from(coverInput.files || [])
      : [];

    var pdfFile = pdfFiles[0] || null;
    var coverFile =
      selectedBookCoverFile ||
      coverFiles[0] ||
      null;

    var title = String(titleInput && titleInput.value || "").trim();
    var author = String(authorInput && authorInput.value || "").trim();
    var category = String(categoryInput && categoryInput.value || "گشتی").trim() || "گشتی";
    var language = String(languageInput && languageInput.value || "کوردی").trim() || "کوردی";
    var description = String(descriptionInput && descriptionInput.value || "").trim();

    if (!pdfFile) {
      setAddBookMessage("تکایە سەرەتا فایلی PDF هەڵبژێرە.", "error");
      return;
    }
    if (pdfFile.type && pdfFile.type !== "application/pdf") {
      setAddBookMessage("تکایە تەنیا فایلێکی PDF هەڵبژێرە.", "error");
      return;
    }
    if (!title) {
      setAddBookMessage("ناوی کتێب پێویستە.", "error");
      return;
    }
    if (coverFile && !String(coverFile.type || "").startsWith("image/")) {
      setAddBookMessage("فایلی بەرگ دەبێت وێنە بێت.", "error");
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.classList.add("is-loading");
    }
    setAddBookMessage(
      coverFile
        ? "کتێبەکە و بەرگەکەی خەریکی بارکردنن..."
        : "کتێبەکە خەریکی بارکردنە...",
      ""
    );

    var uploadedPdfPath = "";
    var uploadedCoverPath = "";

    Promise.resolve(authState.profile || null)
      .then(function () {
        var uid = authState.user.id;
        var safePdfName = pdfFile.name
          .replace(/[^a-zA-Z0-9._-]+/g, "-")
          .replace(/-+/g, "-")
          .replace(/^[-.]+|[-.]+$/g, "") || "book.pdf";

        var pdfPath = uid + "/" + Date.now() + "-" + Math.floor(Math.random() * 1000000) + "-" + safePdfName;
        uploadedPdfPath = pdfPath;

        var coverPromise = Promise.resolve({
          url: "",
          path: ""
        });

        if (coverFile) {
          var safeCoverName = (coverFile.name || "cover")
            .replace(/[^a-zA-Z0-9._-]+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^[-.]+|[-.]+$/g, "") || "cover.jpg";

          var coverPath = uid + "/" + Date.now() + "-" +
            Math.floor(Math.random() * 1000000) + "-" + safeCoverName;

          uploadedCoverPath = coverPath;

          coverPromise = uploadToStorage(
            BOOK_COVERS_BUCKET,
            coverPath,
            coverFile
          );
        }

        return Promise.all([
          uploadToStorage(
            BOOKS_BUCKET,
            pdfPath,
            pdfFile
          ),
          coverPromise,
          extractPDF(pdfFile)
        ]).then(function (results) {
          var pdfUploaded = results[0];
          var coverUploaded = results[1];
          var data = results[2];

          var book = {
            title: title,
            author: author,
            category: category,
            description: description,
            keywords: "",
            language: language,
            lang: data.lang || "en",
            pageCount: data.pageCount || 0,
            cover_url: coverUploaded.url || "",
            pdf_url: pdfUploaded.url
          };

          return insertRemoteBook(book).then(function (remoteBook) {
            remoteBook.pdfData = data.pdfData;
            remoteBook.pages = data.pages || [];
            remoteBook.lang = data.lang || remoteBook.lang || "en";
            remoteBook.pageCount = data.pageCount || 0;
            remoteBook.currentPage = 0;
            remoteBook.progress = 0;
            remoteBook.favorite = !!authState.favorites[
              favoriteKey("book", remoteBook.remoteId)
            ];
            remoteBook.bookmarked = false;
            remoteBook.isPublished = remoteBook.status === "approved";
            remoteBook.isRemote = true;
            return remoteBook;
          });
        });
      })
      .then(function (savedBook) {
        books.unshift(savedBook);
        renderBooks();
        renderOwnerPanel();
        renderProfile();
        closeAddBookSheet();
        toast(savedBook.status === "approved"
          ? "کتێبەکە ڕاستەوخۆ بڵاوکرایەوە"
          : "کتێبەکە نێردرا بۆ پشکنین");
      })
      .catch(function (error) {
        console.error("submitAddBookForm:", error);
        var cleanupTasks = [];

        if (uploadedPdfPath) {
          cleanupTasks.push(
            Promise.resolve(
              deleteFromStorage(
                BOOKS_BUCKET,
                uploadedPdfPath
              )
            ).catch(
              function (cleanupError) {
                console.error(
                  "PDF cleanup:",
                  cleanupError
                );
              }
            )
          );
        }

        if (uploadedCoverPath) {
          cleanupTasks.push(
            Promise.resolve(
              deleteFromStorage(
                BOOK_COVERS_BUCKET,
                uploadedCoverPath
              )
            ).catch(
              function (cleanupError) {
                console.error(
                  "Cover cleanup:",
                  cleanupError
                );
              }
            )
          );
        }

        return Promise.all(cleanupTasks).finally(function () {
          setAddBookMessage("نەتوانرا کتێب زیاد بکرێت: " + String(error && error.message || "هەڵە").slice(0, 140), "error");
          if (submitButton) {
            submitButton.disabled = false;
            submitButton.classList.remove("is-loading");
          }
        });
      });
  }

  function initAddBookForm() {
    var form = $("addBookForm");
    var coverInput = $("bookCoverInput");
    var pdfInput = $("bookPdfInput");

    if (form) {
      form.addEventListener("submit", submitAddBookForm);
    }

    if (coverInput) {
      coverInput.addEventListener("change", function () {
        var file = this.files && this.files[0] ? this.files[0] : null;
        handleBookCoverPreview(file);
      });
    }

    if (pdfInput) {
      pdfInput.addEventListener("change", function () {
        var file = this.files && this.files[0] ? this.files[0] : null;
        if ($("bookPdfName")) {
          $("bookPdfName").textContent = file ? file.name : "PDF ـەکە هەڵبژێرە";
        }
      });
    }
  }


  /* =======================================================
     ADD PDF → SUPABASE
     ======================================================= */

  function addPDF(
    file
  ) {
    if (!file) return;
    if (!supabaseReady()) {
      toast("Supabase پەیوەست نییە");
      return;
    }

    ensureAuthenticated("بۆ زیادکردنی کتێب سەرەتا دەبێت بچیتە ژوورەوە.")
      .then(function (ok) {
        if (!ok) return;
        return getFreshProfile().then(function (profile) {
          if (!profile) return;

          toast("PDF خەریکی بارکردنە...");

          var uid = authState.user.id;
          var safeName = file.name
            .replace(/[^a-zA-Z0-9._-]+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^[-.]+|[-.]+$/g, "") || "book.pdf";

          var path = (profile.role === "admin" ? "admin" : uid) +
            "/" + Date.now() + "-" + Math.floor(Math.random() * 1000000) + "-" + safeName;

          var uploadedPdfPath = path;

          return uploadToStorage(BOOKS_BUCKET, path, file)
            .then(function (uploaded) {
              return extractPDF(file).then(function (data) {
                var book = {
                  title: file.name.replace(/\.pdf$/i, ""),
                  author: "",
                  category: "گشتی",
                  description: "",
                  keywords: "",
                  lang: data.lang || "en",
                  pageCount: data.pageCount || 0,
                  cover_url: "",
                  pdf_url: uploaded.url
                };

                return insertRemoteBook(book).then(function (remoteBook) {
                  remoteBook.pdfData = data.pdfData;
                  remoteBook.pages = data.pages || [];
                  remoteBook.lang = data.lang || "en";
                  remoteBook.pageCount = data.pageCount || 0;
                  remoteBook.currentPage = 0;
                  remoteBook.progress = 0;
                  remoteBook.favorite = !!authState.favorites[favoriteKey("book", remoteBook.remoteId)];
                  remoteBook.bookmarked = false;
                  remoteBook.isPublished = remoteBook.status === "approved";
                  remoteBook.isRemote = true;
                  return remoteBook;
                });
              });
            })
            .then(function (savedBook) {
              books.unshift(savedBook);
              renderBooks();
              renderOwnerPanel();
              loadUserCloudData().catch(function (error) {
                console.error("reload user data after book upload", error);
              });
              toast(savedBook.status === "approved"
                ? "کتێبەکە ڕاستەوخۆ بڵاوکرایەوە"
                : "کتێبەکە نێردرا بۆ پشکنین");
            })
            .catch(function (error) {
              console.error("Supabase addPDF:", error);
              return Promise.resolve(
                deleteFromStorage(
                  BOOKS_BUCKET,
                  uploadedPdfPath
                )
              )
                .catch(function (cleanupError) {
                  console.error(
                    "Supabase PDF cleanup:",
                    cleanupError
                  );
                })
                .finally(function () {
                  toast(
                    "نەتوانرا PDF زیاد بکرێت: " +
                    String(error && error.message ? error.message : "هەڵە").slice(0, 120)
                  );
                });
            });
        });
      });
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
    var list = books.slice().sort(function (a, b) {
      return Number(b.addedAt || 0) - Number(a.addedAt || 0);
    });

    var libraryIsActive = !!document.querySelector(
      "[data-app-view='library'].active"
    );

    if (
      libraryIsActive &&
      libraryMode === "mine"
    ) {
      if (!authState.user) {
        return [];
      }

      list = list.filter(function (book) {
        return book.ownerId === authState.user.id;
      });
    } else {
      list = list.filter(function (book) {
        return (book.status || "approved") === "approved";
      });
    }

    if (filter === "favorites") {
      list = list.filter(function (book) {
        return !!book.favorite;
      });
    } else if (filter === "recent") {
      list = list.slice(0, 8);
    } else if (filter !== "all") {
      list = list.filter(function (book) {
        return (book.category || "گشتی") === filter;
      });
    }

    if (query) {
      var q = query.toLowerCase();
      list = list.filter(function (book) {
        var text = [book.title, book.author, book.category, book.description, book.language]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return text.indexOf(q) >= 0;
      });
    }

    return list;
  }

  function renderLibraryModeControls() {
    var section = $("librarySection");
    if (!section) return;

    var head = section.querySelector(".section-head");
    if (!head) return;

    var existing = $("libraryModeControls");
    if (!existing) {
      existing = document.createElement("div");
      existing.id = "libraryModeControls";
      existing.style.cssText =
        "display:flex;gap:7px;flex-wrap:wrap;margin-top:10px";
      head.insertAdjacentElement("afterend", existing);
    }

    var disabled = !authState.user;

    existing.innerHTML =
      '<button type="button" class="chip ' +
      (libraryMode === "public" ? "active" : "") +
      '" data-library-mode="public">کتێبخانەی گشتی</button>' +
      '<button type="button" class="chip ' +
      (libraryMode === "mine" ? "active" : "") +
      '" data-library-mode="mine"' +
      (disabled ? ' aria-disabled="true"' : '') +
      '>کتێبەکانی من</button>';
  }

  function setLibraryMode(mode) {
    if (mode !== "mine") {
      libraryMode = "public";
    } else {
      if (!authState.user) {
        libraryMode = "public";
        renderLibraryModeControls();
        openAuthModal(
          "login",
          "بۆ بینینی کتێبەکانی خۆت سەرەتا بچۆ ژوورەوە."
        );
        return;
      }

      libraryMode = "mine";
    }

    renderLibraryModeControls();
    renderBooks();
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
            : libraryMode === "mine"
            ? "هێشتا هیچ کتێبێکت نییە"
            : "هێشتا کتێب نییە"
        ) +
        "</h3>" +
        "<p>" +
        (
          query
            ? "وشە یان ناوی نووسەرێکی تر تاقی بکەوە."
            : libraryMode === "mine"
            ? "PDF ـێک زیاد بکە بۆ ئەوەی لێرە بیبینیت."
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
              (book.cover_url
                ? '<img class="book-cover-image" src="' + esc(book.cover_url) + '" alt="" loading="lazy" onerror="this.remove()">'
                : '') +
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

              (book.ownerProfile
                ? '<div class="book-attribution">' +
                  '<span class="book-owner-avatar">' +
                  (book.ownerProfile.avatar_url
                    ? '<img src="' + esc(book.ownerProfile.avatar_url) + '" alt="">'
                    : '<i class="fa-solid fa-user"></i>') +
                  '</span>' +
                  '<span class="book-owner-copy">' +
                    '<small>بڵاوکراوەتەوە لەلایەن:</small>' +
                    '<strong class="book-owner-name">' + esc(book.ownerProfile.display_name || "بێ ناو") + '</strong>' +
                    '<span class="book-owner-username' + (!book.ownerProfile.username ? ' muted' : '') + '">' +
                      (book.ownerProfile.username ? '@' + esc(normalizeUsername(book.ownerProfile.username)) : '@username') +
                    '</span>' +
                  '</span>' +
                '</div>'
                : '') +

              '<div class="actions">' +

              '<button class="small primary" data-action="open-book" type="button">' +
              '<i class="fa-solid fa-book-open"></i>' +
              " خوێندنەوە" +
              "</button>" +

              (authState.isAdmin
                ? '<button class="small" data-action="del-book" title="سڕینەوە" type="button"><i class="fa-regular fa-trash-can"></i></button>'
                : '') +

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
    if (!authState.user) {
      openAuthModal("login", "بۆ بەکارهێنانی دڵخوازەکان سەرەتا بچۆ ژوورەوە.");
      return;
    }

    var book = books.find(function (item) {
      return item.id === id;
    });
    if (!book || !book.isRemote) return;

    var remoteId = book.remoteId != null ? book.remoteId : Number(book.id);
    var nextState = !book.favorite;

    var request = nextState
      ? supabaseClient.from("favorites").insert({
          user_id: authState.user.id,
          item_type: "book",
          item_id: remoteId
        })
      : supabaseClient.from("favorites")
          .delete()
          .eq("user_id", authState.user.id)
          .eq("item_type", "book")
          .eq("item_id", remoteId);

    request.then(function (result) {
      if (result.error) throw result.error;
      book.favorite = nextState;
      if (nextState) authState.favorites[favoriteKey("book", remoteId)] = true;
      else delete authState.favorites[favoriteKey("book", remoteId)];
      renderBooks();
      toast(nextState
        ? "کتێبەکە خرایە ناو دڵخوازەکان"
        : "کتێبەکە لە دڵخوازەکان لابرا");
    }).catch(function (error) {
      console.error("favorite:", error);
      toast("نوێکردنەوەی دڵخواز سەرکەوتوو نەبوو");
    });
  }


  /* =======================================================
     DELETE BOOK
     ======================================================= */

  function deleteBook(
    id
  ) {
    if (!authState.isAdmin) {
      toast("تەنیا ئەدمین دەتوانێت کتێب بسڕێتەوە.");
      return;
    }

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
            "Dictionary Gemini:",
            error
          );

          return Promise.all([
            translateText(
              clean,
              "ckb"
            ).catch(
              function (
                fallbackError
              ) {
                console.error(
                  "Dictionary Kurdish fallback:",
                  fallbackError
                );

                return "";
              }
            ),

            translateText(
              clean,
              "ar"
            ).catch(
              function (
                fallbackError
              ) {
                console.error(
                  "Dictionary Arabic fallback:",
                  fallbackError
                );

                return "";
              }
            )
          ]).then(
            function (
              fallbackResults
            ) {
              if (
                requestId !==
                wordRequestId
              ) {
                return;
              }

              var fallbackKu =
                String(
                  fallbackResults[0] ||
                  ""
                ).trim();

              var fallbackAr =
                String(
                  fallbackResults[1] ||
                  ""
                ).trim();

              currentWordMeanings = {
                ku: fallbackKu
                  ? [fallbackKu]
                  : [],

                ar: fallbackAr
                  ? [fallbackAr]
                  : []
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
                          '\">' +
                          esc(
                            meaning
                          ) +
                          "</div>"
                        );
                      }
                    )
                    .join("");

                if (!fallbackKu) {
                  modalKu.textContent =
                    "نەتوانرا مانا بهێنرێت";
                }
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
                          '\">' +
                          esc(
                            meaning
                          ) +
                          "</div>"
                        );
                      }
                    )
                    .join("");

                if (!fallbackAr) {
                  modalAr.textContent =
                    "نەتوانرا مانا بهێنرێت";
                }
              }

              if (
                !fallbackKu &&
                !fallbackAr &&
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
      );
  }


  /* =======================================================
     VOCABULARY
     ======================================================= */

  function renderVocab() {
    var box = $("vocabList");
    if (!box) return;

    if (!vocab.length) {
      box.innerHTML =
        '<div class="empty" style="grid-column:1/-1">' +
        '<div class="empty-icon"><i class="fa-solid fa-language"></i></div>' +
        '<h3>هێشتا وشەیەک خەزن نەکراوە</h3>' +
        '<p>وشەیەک لە Reader هەڵبژێرە و خەزنی بکە.</p>' +
        '</div>';
      return;
    }

    box.innerHTML = vocab.map(function (item) {
      return (
        '<article class="book">' +
        '<div class="book-main">' +
        '<div class="book-title">' + esc(item.word) + '</div>' +
        '<div class="book-author">' + esc(item.meaning || "") + '</div>' +
        '<div class="actions">' +
        '<button class="small primary" data-vspeak="' + esc(item.word) + '" data-vlang="' + esc(item.lang || "en") + '" type="button">' +
        '<i class="fa-solid fa-volume-high"></i> دەنگ</button>' +
        '<button class="small" data-vdel="' + esc(item.id) + '" type="button">' +
        '<i class="fa-regular fa-trash-can"></i> سڕینەوە</button>' +
        '</div></div></article>'
      );
    }).join("");
  }



  function renderFavorites() {
    var box = $("favoritesList");
    if (!box) return;

    if (!authState.user) {
      box.innerHTML =
        '<div class="empty" style="grid-column:1/-1">' +
        '<div class="empty-icon"><i class="fa-solid fa-lock"></i></div>' +
        '<h3>دڵخوازەکانت پاش Login</h3>' +
        '<p>بۆ بینینی دڵخوازەکانت سەرەتا بچۆ ژوورەوە.</p>' +
        '<button class="primary empty-button" type="button" data-action="auth-login">' +
        '<i class="fa-solid fa-right-to-bracket"></i> چوونەژوورەوە' +
        '</button>' +
        '</div>';
      return;
    }

    var source = $("bookList");
    if (!source) return;

    var oldFilter = filter;
    var oldQuery = query;

    filter = "favorites";
    query = "";

    renderBooks();
    box.innerHTML = source.innerHTML;

    filter = oldFilter;
    query = oldQuery;
    renderBooks();
  }



  /* =======================================================
     OWNER PANEL
     ======================================================= */

  function renderOwnerPanel() {
    var shell = $("ownerSheet");
    if (!shell) return;

    if (!authState.isAdmin) {
      shell.setAttribute("aria-hidden", "true");
      closeSheet($("ownerBack"), shell);
      return;
    }

    shell.setAttribute("aria-hidden", "false");

    var total = $("ownerTotalBooks");
    var pub = $("ownerPublicBooks");
    var pending = $("ownerPendingBooks");
    var audios = $("ownerTotalAudios");

    if (total) total.textContent = books.length;
    if (pub) pub.textContent = books.filter(function (item) { return (item.status || "approved") === "approved"; }).length;
    if (pending) pending.textContent = books.filter(function (item) { return item.status === "pending"; }).length;
    if (audios) audios.textContent = music.length;

    var list = $("ownerBooksList");
    if (list) {
      var recent = books.slice(0, 20);
      list.innerHTML = recent.length
        ? recent.map(function (book) {
            var statusText = book.status === "pending" ? "چاوەڕوان" : book.status === "rejected" ? "ڕەتکراوە" : "بڵاوکراوە";
            var actions = '<button class="icon-btn" type="button" data-admin-book-open="' + esc(book.id) + '" title="کردنەوە"><i class="fa-solid fa-book-open"></i></button>';
            if (book.status === "pending") {
              actions += '<button class="icon-btn" type="button" data-admin-book-approve="' + esc(book.id) + '" title="پەسەندکردن"><i class="fa-solid fa-check"></i></button>';
              actions += '<button class="icon-btn" type="button" data-admin-book-reject="' + esc(book.id) + '" title="ڕەتکردنەوە"><i class="fa-solid fa-xmark"></i></button>';
            }
            actions += '<button class="icon-btn" type="button" data-admin-book-delete="' + esc(book.id) + '" title="سڕینەوە"><i class="fa-regular fa-trash-can"></i></button>';
            return '<div class="owner-book-row"><div class="owner-book-main"><strong>' + esc(book.title || "کتێب") + '</strong><small>' + esc(book.author || "بێ نووسەر") + ' · ' + statusText + '</small></div><div class="owner-book-actions">' + actions + '</div></div>';
          }).join("")
        : '<div class="empty" style="padding:20px">هێشتا ناوەڕۆک نییە.</div>';

      if (!$("adminExtraPanel")) {
        var extra = document.createElement("div");
        extra.id = "adminExtraPanel";
        extra.style.cssText = "margin-top:14px;display:grid;gap:12px";
        shell.appendChild(extra);
      }
    }

    var extraPanel = $("adminExtraPanel");
    if (extraPanel) {
      extraPanel.innerHTML =
        '<div style="display:grid;gap:8px"><strong style="font-size:12px;color:#fff">مۆڵەت و ناوەڕۆک</strong><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><button class="primary" type="button" data-action="add-pdf"><i class="fa-solid fa-file-circle-plus"></i> PDF</button><button class="primary" type="button" data-action="add-music"><i class="fa-solid fa-music"></i> موزیک</button></div></div>' +
        '<div id="adminUsersList" style="display:grid;gap:8px"></div>' +
        '<div id="adminMusicPending" style="display:grid;gap:8px"></div>';
    }

    loadAdminUsers().catch(function (error) { console.error("loadAdminUsers:", error); });
    loadAdminMusic().catch(function (error) { console.error("loadAdminMusic:", error); });
  }


  /* =======================================================
     MUSIC
     ======================================================= */

  function getPlayableMusic() {
    if (authState.isAdmin) return music.slice();
    return music.filter(function (track) {
      return (track.status || "approved") === "approved";
    });
  }

  function renderTracks() {
    var box = $("tracks");
    if (!box) return;

    var visibleMusic = getPlayableMusic();
    if (!visibleMusic.length) {
      box.innerHTML = '<div style="padding:15px;text-align:center;color:var(--muted);font-size:8px">هێشتا موزیکێک نییە</div>';
      return;
    }

    box.innerHTML = visibleMusic.map(function (track, index) {
      return (
        '<div class="track" data-track="' + index + '">' +
        '<button type="button" data-track-play="' + index + '">' +
        '<i class="fa-solid fa-play"></i>' +
        '</button>' +
        '<span>' + esc(track.name || "موزیک") + '</span>' +
        '</div>'
      );
    }).join("");
  }

  function addMusicFiles(
    files
  ) {
    if (!files || !files.length) return;
    if (!supabaseReady()) {
      toast("Supabase پەیوەست نییە");
      return;
    }

    ensureAuthenticated("بۆ زیادکردنی موزیک سەرەتا دەبێت بچیتە ژوورەوە.")
      .then(function (ok) {
        if (!ok) return;
        return getFreshProfile().then(function (profile) {
          if (!profile) return;

          var tasks = [];
          var uid = authState.user.id;

          for (var i = 0; i < files.length; i++) {
            (function (file) {
              if (!file) return;

              var fileName = String(
                file.name ||
                ""
              );

              var extension =
                fileName
                  .split(".")
                  .pop()
                  .toLowerCase();

              var allowedExtensions = {
                mp3: true,
                wav: true,
                m4a: true,
                ogg: true,
                aac: true
              };

              var hasAudioType =
                !!(
                  file.type &&
                  file.type.indexOf("audio/") === 0
                );

              if (
                !hasAudioType &&
                !allowedExtensions[extension]
              ) {
                return;
              }

              var safeName = fileName
                .replace(/[^a-zA-Z0-9._-]+/g, "-")
                .replace(/-+/g, "-")
                .replace(/^[-.]+|[-.]+$/g, "") || "audio";

              var path = (profile.role === "admin" ? "admin" : uid) +
                "/" + Date.now() + "-" + Math.floor(Math.random() * 1000000) + "-" + safeName;

              tasks.push(
                uploadToStorage(MUSIC_BUCKET, path, file)
                  .then(function (uploaded) {
                    var probe = document.createElement("audio");
                    probe.preload = "metadata";

                    return new Promise(function (resolve) {
                      var done = false;
                      function finish(duration) {
                        if (done) return;
                        done = true;
                        insertRemoteMusic({
                          name: file.name.replace(/\.[^.]+$/i, ""),
                          artist: "",
                          category: "",
                          cover_url: "",
                          audio_url: uploaded.url,
                          duration: Math.round(Number(duration)) || 0
                        }).then(resolve).catch(function (error) {
                          deleteFromStorage(MUSIC_BUCKET, path).catch(function () {});
                          resolve(Promise.reject(error));
                        });
                      }
                      probe.onloadedmetadata = function () { finish(probe.duration); };
                      probe.onerror = function () { finish(0); };
                      probe.src = uploaded.url;
                    });
                  })
              );
            })(files[i]);
          }

          if (!tasks.length) return;

          toast("موزیکەکان خەریکی بارکردنن...");

          return Promise.all(tasks)
            .then(function (remoteTracks) {
              remoteTracks.forEach(function (track) {
                music.push(track);
              });

              if (musicIndex < 0 && getPlayableMusic().length) {
                loadTrack(0, false);
              }

              renderTracks();
              toast(remoteTracks.every(function (track) {
                return track.status === "approved";
              })
                ? "موزیکەکان ڕاستەوخۆ بڵاوکرانەوە"
                : "موزیکەکان نێردران بۆ پشکنین");
            })
            .catch(function (error) {
              console.error("Supabase addMusicFiles:", error);
              toast(
                "نەتوانرا موزیک زیاد بکرێت: " +
                String(error && error.message ? error.message : "هەڵە").slice(0, 120)
              );
            });
        });
      });
  }


  function setMusicVolume(
    value
  ) {
    var next =
      Number(value);

    if (!Number.isFinite(next)) {
      next =
        0.32;
    }

    musicVolume =
      Math.max(
        0,
        Math.min(
          1,
          next
        )
      );

    try {
      localStorage.setItem(
        "kh_music_volume",
        String(musicVolume)
      );
    } catch (error) {}

    var audio =
      $("audio");

    if (audio) {
      audio.volume =
        musicVolume;
    }
  }

  function getMusicVolume() {
    return musicVolume;
  }

  function loadTrack(
    index,
    autoplay
  ) {
    var playable = getPlayableMusic();
    if (!playable[index]) return;

    var track = playable[index];
    var fullIndex = music.indexOf(track);
    musicIndex = fullIndex;

    var audio = $("audio");
    if (audio) {
      audio.src = track.url;
      audio.volume = musicVolume;

      var nowName = $("nowName");
      var nowSub = $("nowSub");
      if (nowName) nowName.textContent = track.name || "موزیک";
      if (nowSub) nowSub.textContent = track.artist || "موزیک";

      if (autoplay) {
        audio.play().catch(function () {});
      }
    }
    updatePlayButton();
  }

  function updatePlayButton() {
    var button = document.querySelector("[data-action='play-pause'] i");
    var audio = $("audio");
    if (!button || !audio) return;
    button.className = audio.paused
      ? "fa-solid fa-play"
      : "fa-solid fa-pause";
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

      if (name === "auth-login") {
        openAuthModal("login");
        return;
      }

      if (name === "auth-signup") {
        openAuthModal("signup");
        return;
      }

      if (name === "auth-signout") {
        signOut();
        return;
      }

      if (name === "edit-profile") {
        openProfileEdit();
        return;
      }

      if (name === "close-profile-edit") {
        closeProfileEdit();
        return;
      }

      if (name === "auth-close") {
        closeAuthModal();
        return;
      }

      if (name === "premium-info") {
        if (!authState.user) {
          openAuthModal("login", "سەرەتا بچۆ ژوورەوە بۆ زانیاری Premium.");
          return;
        }
        showPremiumInfo();
        return;
      }

      if (
        name ===
        "add-pdf"
      ) {
        openAddBookSheet();
        return;
      }

      if (
        name ===
        "close-add-book"
      ) {
        closeAddBookSheet();
        return;
      }

      if (
        name ===
        "add-music"
      ) {
        if (!authState.user) {
          openAuthModal("login", "بۆ زیادکردنی موزیک سەرەتا بچۆ ژوورەوە.");
          return;
        }
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
        if (
          window.XwendngaApp &&
          typeof window.XwendngaApp.navigate ===
            "function"
        ) {
          window.XwendngaApp.navigate(
            "settings"
          );
        } else {
          window.location.hash =
            "#settings";
        }

        return;
      }

      if (
        name ===
        "close-settings"
      ) {
        if (
          window.XwendngaApp &&
          typeof window.XwendngaApp.navigate ===
            "function"
        ) {
          window.XwendngaApp.navigate(
            "home"
          );
        }

        return;
      }

      if (
        name ===
        "owner-panel"
      ) {
        if (!authState.isAdmin) {
          openAuthModal("login", "تەنیا ئۆنەر دەتوانێت پانێڵی بەڕێوەبەر بکاتەوە.");
          return;
        }
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
        saveCurrentWordToCloud();
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
        var playable = getPlayableMusic();
        if (!playable.length) return;
        var current = music[musicIndex];
        var pIndex = playable.indexOf(current);
        var prev = pIndex <= 0 ? playable.length - 1 : pIndex - 1;
        loadTrack(prev, true);

        return;
      }

      if (
        name ===
        "next-track"
      ) {
        var playable = getPlayableMusic();
        if (!playable.length) return;
        var current = music[musicIndex];
        var pIndex = playable.indexOf(current);
        var next = pIndex >= playable.length - 1 ? 0 : pIndex + 1;
        loadTrack(next, true);

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
          !getPlayableMusic().length
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
        if (!authState.user) {
          openAuthModal("login", "بۆ خەزنکردنی وشەکان سەرەتا بچۆ ژوورەوە.");
          return;
        }
        supabaseClient.from("saved_words").delete().eq("user_id", authState.user.id)
          .then(function (result) {
            if (result.error) throw result.error;
            return loadSavedWords();
          })
          .then(function () {
            renderProfile();
            toast("وشەکان سڕانەوە");
          })
          .catch(function (error) {
            console.error("clear vocab:", error);
            toast("سڕینەوەی وشەکان سەرکەوتوو نەبوو");
          });
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
     AUTH / ADMIN DELEGATED ACTIONS
     ======================================================= */

  document.addEventListener("click", function (event) {
    var delVocab = event.target.closest("[data-vdel]");
    if (delVocab) {
      deleteSavedWord(delVocab.getAttribute("data-vdel"));
      return;
    }

    var approve = event.target.closest("[data-admin-book-approve]");
    if (approve) {
      updateBookStatus(approve.getAttribute("data-admin-book-approve"), "approved")
        .then(function () { toast("کتێبەکە پەسەند کرا"); })
        .catch(function (error) { toast(String(error.message || "هەڵە").slice(0, 120)); });
      return;
    }

    var reject = event.target.closest("[data-admin-book-reject]");
    if (reject) {
      var reason = window.prompt("هۆکاری ڕەتکردنەوە بنووسە:", "");
      if (reason === null) return;
      updateBookStatus(reject.getAttribute("data-admin-book-reject"), "rejected", reason)
        .then(function () { toast("کتێبەکە ڕەتکرایەوە"); })
        .catch(function (error) { toast(String(error.message || "هەڵە").slice(0, 120)); });
      return;
    }

    var delBook = event.target.closest("[data-admin-book-delete]");
    if (delBook) {
      deleteBook(delBook.getAttribute("data-admin-book-delete"));
      return;
    }

    var openAdminBook = event.target.closest("[data-admin-book-open]");
    if (openAdminBook) {
      openBook(openAdminBook.getAttribute("data-admin-book-open"));
      return;
    }

    var roleButton = event.target.closest("[data-admin-role-id]");
    if (roleButton) {
      updateUserRole(
        roleButton.getAttribute("data-admin-role-id"),
        roleButton.getAttribute("data-admin-next-role") || "premium"
      );
      return;
    }
  });


  document.addEventListener("click", function (event) {
    var approveMusic = event.target.closest("[data-admin-music-approve]");
    if (approveMusic) {
      updateMusicStatus(approveMusic.getAttribute("data-admin-music-approve"), "approved")
        .then(function () { toast("موزیکەکە پەسەند کرا"); });
      return;
    }

    var rejectMusic = event.target.closest("[data-admin-music-reject]");
    if (rejectMusic) {
      var reason = window.prompt("هۆکاری ڕەتکردنەوە بنووسە:", "");
      if (reason === null) return;
      updateMusicStatus(rejectMusic.getAttribute("data-admin-music-reject"), "rejected", reason)
        .then(function () { toast("موزیکەکە ڕەتکرایەوە"); });
      return;
    }

    var delMusic = event.target.closest("[data-admin-music-delete]");
    if (delMusic) {
      deleteMusicByAdmin(delMusic.getAttribute("data-admin-music-delete"));
      return;
    }

    var disableButton = event.target.closest("[data-admin-disable-id]");
    if (disableButton) {
      updateUserDisabled(
        disableButton.getAttribute("data-admin-disable-id"),
        disableButton.getAttribute("data-admin-disable-value") === "true"
      );
      return;
    }
  });

  /* =======================================================
     LIBRARY MODE
     ======================================================= */

  document.addEventListener(
    "click",
    function (event) {
      var modeButton = event.target.closest(
        "[data-library-mode]"
      );

      if (!modeButton) {
        return;
      }

      event.preventDefault();
      setLibraryMode(
        modeButton.getAttribute("data-library-mode")
      );
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

        renderReaderThemes();
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
        var selectedFiles = Array.from(
          this.files || []
        );

        addMusicFiles(
          selectedFiles
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
        var playable = getPlayableMusic();
      if (playable.length) {
        var current = music[musicIndex];
        var pIndex = playable.indexOf(current);
        var next = pIndex >= playable.length - 1 ? 0 : pIndex + 1;
        loadTrack(next, true);
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

        updateSettingsGeminiStatus();
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
      "input",
      function () {
        var value =
          Number(this.value);

        if (!Number.isFinite(value)) {
          return;
        }

        try {
          localStorage.setItem(
            "kh_font",
            String(value)
          );
        } catch (error) {}

        if (
          window.ReaderEngine &&
          typeof window.ReaderEngine.setFontSize ===
            "function"
        ) {
          window.ReaderEngine.setFontSize(
            value
          );
        }

        var label =
          $("settingsFontValue");

        if (label) {
          label.textContent =
            value +
            "px";
        }
      }
    );
  }



  /* =======================================================
     MODERN SETTINGS CONTROLS
     ======================================================= */

  var settingsMusicRange =
    $("settingsMusicVolume");

  if (settingsMusicRange) {
    settingsMusicRange.addEventListener(
      "input",
      function () {
        var value =
          Number(this.value) /
          100;

        setMusicVolume(
          value
        );

        var label =
          $("settingsMusicValue");

        if (label) {
          label.textContent =
            Math.round(
              musicVolume * 100
            ) +
            "٪";
        }
      }
    );
  }

  document.addEventListener(
    "click",
    function (event) {
      var preset =
        event.target.closest(
          "[data-audio-preset]"
        );

      if (!preset) {
        return;
      }

      var value =
        Number(
          preset.getAttribute(
            "data-audio-preset"
          )
        );

      if (!Number.isFinite(value)) {
        return;
      }

      setMusicVolume(
        value / 100
      );

      var range =
        $("settingsMusicVolume");
      var label =
        $("settingsMusicValue");

      if (range) {
        range.value =
          String(value);
      }

      if (label) {
        label.textContent =
          value +
          "٪";
      }

      document
        .querySelectorAll(
          "[data-audio-preset]"
        )
        .forEach(
          function (button) {
            button.classList.toggle(
              "active",
              Number(
                button.getAttribute(
                  "data-audio-preset"
                )
              ) === value
            );
          }
        );
    }
  );

  var geminiToggle =
    $("settingsGeminiToggle");

  if (geminiToggle) {
    geminiToggle.addEventListener(
      "click",
      function () {
        var input =
          $("geminiApiKey");

        if (!input) {
          return;
        }

        var hidden =
          input.type ===
          "password";

        input.type =
          hidden
            ? "text"
            : "password";

        this.innerHTML =
          hidden
            ? '<i class="fa-regular fa-eye-slash"></i>'
            : '<i class="fa-regular fa-eye"></i>';
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
    function (event) {
      renderBooks();
      renderVocab();
      renderOwnerPanel();
      renderTracks();
      updateTelegramBtn();
      renderLibraryModeControls();
      renderSettingsPage();

      var route =
        event &&
        event.detail
          ? event.detail.route
          : "";

      if (route === "favorites") {
        renderFavorites();
      }

      if (route === "search") {
        var searchTarget = $("globalSearchResults");
        var searchSource = $("bookList");

        if (
          searchTarget &&
          searchSource
        ) {
          searchTarget.innerHTML =
            searchSource.innerHTML;
        }
      }
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
        if (
          window.XwendngaApp &&
          typeof window.XwendngaApp.navigate ===
            "function"
        ) {
          window.XwendngaApp.navigate(
            "settings"
          );
        } else {
          window.location.hash =
            "#settings";
        }

        window.setTimeout(
          renderSettingsPage,
          0
        );
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

    renderProfile:
      renderProfile,

    renderSettingsPage:
      renderSettingsPage,

    setMusicVolume:
      setMusicVolume,

    getMusicVolume:
      getMusicVolume,

    dbPut:
      dbPut,

    authState:
      authState,

    reloadFromSupabase:
      function () {
        var booksPromise =
          loadRemoteBooks()
            .then(function (items) {
              books = items || [];
              applyFavoritesToBooks();
              renderBooks();
              renderLibraryModeControls();
              renderOwnerPanel();
              return books;
            })
            .catch(function (error) {
              console.error(
                "Reload books:",
                error
              );
              books = [];
              renderBooks();
              renderLibraryModeControls();
              renderOwnerPanel();
              return books;
            });

        var musicPromise =
          loadRemoteMusic()
            .then(function (items) {
              music = items || [];
              renderTracks();
              updatePlayButton();
              renderOwnerPanel();
              return music;
            })
            .catch(function (error) {
              console.error(
                "Reload music:",
                error
              );
              music = [];
              renderTracks();
              updatePlayButton();
              renderOwnerPanel();
              return music;
            });

        return Promise.all([
          booksPromise,
          musicPromise
        ]).then(function () {
          return {
            books: books,
            music: music
          };
        });
      }
  };



  /* =======================================================
     AUTHENTICATION / USER PROFILE / CLOUD DATA
     ======================================================= */

  function injectAuthUI() {
    if ($("xwAuthModal")) return;

    var modal = document.createElement("div");
    modal.id = "xwAuthModal";
    modal.innerHTML =
      '<div id="xwAuthBackdrop" style="position:fixed;inset:0;background:rgba(0,0,0,.66);backdrop-filter:blur(10px);z-index:9998;display:none"></div>' +
      '<section id="xwAuthPanel" role="dialog" aria-modal="true" aria-label="هەژمار" style="position:fixed;inset:auto 14px 18px;max-width:520px;margin:auto;z-index:9999;background:linear-gradient(145deg,#182943,#101f34);border:1px solid rgba(255,255,255,.10);border-radius:24px;padding:18px;display:none;box-shadow:0 30px 70px rgba(0,0,0,.4)">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px">' +
      '<div><div style="font-size:8px;color:#8ea1b7;letter-spacing:1px">XWENDNGA ACCOUNT</div><h3 id="xwAuthTitle" style="margin:5px 0 0;color:#fff;font-size:20px">چوونەژوورەوە</h3></div>' +
      '<button class="icon-btn" type="button" data-action="auth-close"><i class="fa-solid fa-xmark"></i></button></div>' +
      '<div id="xwAuthMessage" style="min-height:20px;color:#9fb1c5;font-size:9px;line-height:1.8;margin-bottom:8px"></div>' +
      '<div id="xwAuthFields"></div>' +
      '</section>';
    document.body.appendChild(modal);

    $("xwAuthBackdrop").addEventListener("click", closeAuthModal);
  }

  function normalizeUsername(value) {
    return String(value || "")
      .trim()
      .replace(/^@+/, "")
      .trim();
  }

  function validateUsername(value) {
    var username = normalizeUsername(value);
    if (!username) {
      return "تکایە ناوی بەکارهێنەر بنووسە.";
    }
    if (/\s/u.test(username)) {
      return "ناوی بەکارهێنەر نابێت بۆشایی هەبێت.";
    }
    if (username.length < 2 || username.length > 30) {
      return "ناوی بەکارهێنەر دەبێت لە 2 تا 30 پیت بێت.";
    }
    return "";
  }

  function openAuthModal(mode, message) {
    injectAuthUI();
    var title = $("xwAuthTitle");
    var fields = $("xwAuthFields");
    var msg = $("xwAuthMessage");

    mode = mode === "signup" ? "signup" : "login";
    title.textContent = mode === "signup" ? "دروستکردنی هەژمار" : "چوونەژوورەوە";
    msg.textContent = message || "";

    fields.innerHTML =
      '<form id="xwAuthForm" style="display:grid;gap:10px">' +
      (mode === "signup"
        ? '<label style="display:grid;gap:5px;color:#9fb1c5;font-size:9px">ناوی بەکارهێنەر<input id="xwAuthUsername" type="text" autocomplete="username" placeholder="@username" required style="min-height:46px;border:1px solid rgba(255,255,255,.10);border-radius:13px;background:#0b1727;color:#fff;padding:0 12px"></label>'
        : '') +
      '<label style="display:grid;gap:5px;color:#9fb1c5;font-size:9px">ئیمەیڵ<input id="xwAuthEmail" type="email" autocomplete="email" required style="min-height:46px;border:1px solid rgba(255,255,255,.10);border-radius:13px;background:#0b1727;color:#fff;padding:0 12px"></label>' +
      '<label style="display:grid;gap:5px;color:#9fb1c5;font-size:9px">وشەی نهێنی<input id="xwAuthPassword" type="password" autocomplete="current-password" minlength="6" required style="min-height:46px;border:1px solid rgba(255,255,255,.10);border-radius:13px;background:#0b1727;color:#fff;padding:0 12px"></label>' +
      '<button class="primary" type="submit" style="min-height:48px">' + (mode === "signup" ? "دروستکردنی هەژمار" : "چوونەژوورەوە") + '</button>' +
      '<button class="ghost" type="button" data-auth-mode="' + (mode === "signup" ? "login" : "signup") + '">' + (mode === "signup" ? "هەژمارم هەیە" : "دروستکردنی هەژمار") + '</button>' +
      '</form>';

    $("xwAuthBackdrop").style.display = "block";
    $("xwAuthPanel").style.display = "block";

    $("xwAuthForm").addEventListener("submit", function (event) {
      event.preventDefault();
      var email = $("xwAuthEmail").value.trim();
      var password = $("xwAuthPassword").value;
      if (mode === "signup") {
        var username = normalizeUsername($("xwAuthUsername").value);
        var usernameError = validateUsername(username);
        if (usernameError) {
          authMessage(usernameError);
          return;
        }
        signUp(email, password, username);
      } else {
        signIn(email, password);
      }
    });

    var modeButton = fields.querySelector("[data-auth-mode]");
    if (modeButton) {
      modeButton.addEventListener("click", function () {
        openAuthModal(modeButton.getAttribute("data-auth-mode"));
      });
    }
  }

  function closeAuthModal() {
    if ($("xwAuthBackdrop")) $("xwAuthBackdrop").style.display = "none";
    if ($("xwAuthPanel")) $("xwAuthPanel").style.display = "none";
  }

  function authMessage(text) {
    injectAuthUI();
    var msg = $("xwAuthMessage");
    if (msg) msg.textContent = text || "";
  }

  function signIn(email, password) {
    if (!supabaseReady()) {
      authMessage("Supabase پەیوەست نییە.");
      return;
    }
    authMessage("خەریکی چوونەژوورەوەیت...");
    supabaseClient.auth.signInWithPassword({ email: email, password: password })
      .then(function (result) {
        if (result.error) throw result.error;
        closeAuthModal();
        return refreshAuthState();
      })
      .catch(function (error) {
        console.error("signIn:", error);
        authMessage("چوونەژوورەوە سەرکەوتوو نەبوو: " + String(error.message || "هەڵە").slice(0, 140));
      });
  }

  function signUp(email, password, username) {
    if (!supabaseReady()) {
      authMessage("Supabase پەیوەست نییە.");
      return;
    }

    var cleanUsername = normalizeUsername(username);
    var usernameError = validateUsername(cleanUsername);
    if (usernameError) {
      authMessage(usernameError);
      return;
    }

    authMessage("خەریکی دروستکردنی هەژمارە...");
    supabaseClient.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          username: cleanUsername
        }
      }
    }).then(function (result) {
      if (result.error) throw result.error;

      var userId = result.data && result.data.user
        ? result.data.user.id
        : null;

      if (result.data && result.data.session && userId) {
        return supabaseClient
          .from("profiles")
          .update({
            username: cleanUsername
          })
          .eq("id", userId)
          .then(function (profileResult) {
            if (profileResult.error) throw profileResult.error;
            closeAuthModal();
            return refreshAuthState();
          });
      }

      authMessage(AUTH_RECOVERY_NOTICE + "\nناوی بەکارهێنەر: @" + cleanUsername);
    }).catch(function (error) {
      console.error("signUp:", error);
      var message = String(error.message || "هەڵە");
      if (error && (error.code === "23505" || message.toLowerCase().indexOf("duplicate") >= 0)) {
        authMessage("ئەم ناوی بەکارهێنەرە پێشتر بەکارهاتووە. ناوێکی تر هەڵبژێرە.");
        return;
      }
      authMessage("دروستکردنی هەژمار سەرکەوتوو نەبوو: " + message.slice(0, 140));
    });
  }

  function signOut() {
    if (!supabaseReady()) return;
    supabaseClient.auth.signOut().then(function (result) {
      if (result.error) throw result.error;
      closeAuthModal();
    }).catch(function (error) {
      console.error("signOut:", error);
      toast("دەرچوون سەرکەوتوو نەبوو");
    });
  }

  function getFreshProfile() {
    if (!authState.user) return Promise.resolve(null);

    var metadata = authState.user.user_metadata || {};

    function applyProfile(profileData) {
      var profile = profileData || {};
      authState.profile = profile;

      var profileRole = profile.role || "user";
      var premiumActive =
        profileRole === "premium" &&
        (
          !profile.premium_until ||
          new Date(profile.premium_until).getTime() > Date.now()
        );

      authState.role =
        profileRole === "admin"
          ? "admin"
          : premiumActive
            ? "premium"
            : "user";

      authState.isAdmin = authState.role === "admin";
      updateAuthUI();
      return profile;
    }

    return supabaseClient
      .from("profiles")
      .select("id,role,premium_until,book_limit,music_limit,is_disabled,created_at,updated_at,display_name,username,avatar_url,phone,birth_date,gender")
      .eq("id", authState.user.id)
      .single()
      .then(function (result) {
        if (result.error) {
          throw result.error;
        }

        var profile = result.data || {};
        var metadataUsername = normalizeUsername(metadata.username || "");

        if (!profile.username && metadataUsername) {
          return supabaseClient
            .from("profiles")
            .update({ username: metadataUsername })
            .eq("id", authState.user.id)
            .then(function () {
              profile.username = metadataUsername;
              return profile;
            })
            .catch(function () {
              return profile;
            });
        }

        return profile;
      })
      .then(function (profile) {
        return applyProfile(profile);
      })
      .catch(function (error) {
        console.warn("getFreshProfile fallback:", error);

        var fallbackProfile = Object.assign(
          {},
          authState.profile || {},
          {
            id: authState.user.id,
            display_name: metadata.display_name || (authState.profile && authState.profile.display_name) || "",
            username: normalizeUsername(metadata.username || (authState.profile && authState.profile.username) || ""),
            avatar_url: metadata.avatar_url || (authState.profile && authState.profile.avatar_url) || "",
            phone: metadata.phone || (authState.profile && authState.profile.phone) || "",
            birth_date: metadata.birth_date || (authState.profile && authState.profile.birth_date) || "",
            gender: metadata.gender || (authState.profile && authState.profile.gender) || "",
            role: (authState.profile && authState.profile.role) || metadata.role || "user",
            premium_until: (authState.profile && authState.profile.premium_until) || metadata.premium_until || null,
            book_limit: (authState.profile && authState.profile.book_limit) || metadata.book_limit || 3,
            music_limit: (authState.profile && authState.profile.music_limit) || metadata.music_limit || 5,
            is_disabled: false
          }
        );

        return applyProfile(fallbackProfile);
      });
  }

  function loadFavorites() {
    if (!authState.user) {
      authState.favorites = {};
      return Promise.resolve();
    }
    return supabaseClient
      .from("favorites")
      .select("item_id,item_type")
      .eq("user_id", authState.user.id)
      .then(function (result) {
        if (result.error) throw result.error;
        authState.favorites = {};
        (result.data || []).forEach(function (row) {
          authState.favorites[favoriteKey(row.item_type, row.item_id)] = true;
        });
      });
  }

  function loadSavedWords() {
    if (!authState.user) {
      vocab = [];
      authState.savedWords = [];
      return Promise.resolve();
    }
    return supabaseClient
      .from("saved_words")
      .select("id,user_id,word,lang,meaning,created_at")
      .eq("user_id", authState.user.id)
      .order("created_at", { ascending: false })
      .then(function (result) {
        if (result.error) throw result.error;
        authState.savedWords = result.data || [];
        vocab = authState.savedWords.map(function (row) {
          return {
            id: String(row.id),
            word: row.word || "",
            lang: row.lang || "en",
            meaning: row.meaning || "",
            createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
          };
        });
        renderVocab();
      });
  }

  function applyFavoritesToBooks() {
    books.forEach(function (book) {
      if (book && book.remoteId != null) {
        book.favorite = !!authState.favorites[favoriteKey("book", book.remoteId)];
      }
    });
  }

  function userBookUsage() {
    if (!authState.user) return 0;
    return books.filter(function (book) {
      return book.ownerId === authState.user.id &&
        (book.status === "pending" || book.status === "approved");
    }).length;
  }

  function userMusicUsage() {
    if (!authState.user) return 0;
    return music.filter(function (track) {
      return track.ownerId === authState.user.id &&
        (track.status === "pending" || track.status === "approved");
    }).length;
  }

  function loadUserCloudData() {
    if (!authState.user) {
      authState.favorites = {};
      authState.savedWords = [];
      vocab = [];
      renderVocab();
      renderBooks();
      return Promise.resolve();
    }

    return Promise.all([
      loadFavorites(),
      loadSavedWords()
    ]).then(function () {
      applyFavoritesToBooks();
      renderBooks();
      renderVocab();
      renderProfile();
    });
  }

  function ensureAuthenticated(message) {
    if (authState.user) return Promise.resolve(true);
    openAuthModal("login", message || "سەرەتا بچۆ ژوورەوە.");
    return Promise.resolve(false);
  }

  function injectProfileEditUI() {
    if ($("profileEditSheet")) return;

    var wrap = document.createElement("div");
    wrap.innerHTML =
      '<div id="profileEditBack" class="back"></div>' +
      '<section id="profileEditSheet" class="sheet profile-edit-sheet" role="dialog" aria-modal="true" aria-label="دەستکاریی پڕۆفایل">' +
        '<div class="handle"></div>' +
        '<div class="profile-edit-head">' +
          '<div class="sheet-title-wrap">' +
            '<span class="sheet-icon"><i class="fa-solid fa-user-pen"></i></span>' +
            '<div><div class="section-kicker">PROFILE</div><h3>دەستکاریی پڕۆفایل</h3></div>' +
          '</div>' +
          '<button class="icon-btn" type="button" data-action="close-profile-edit"><i class="fa-solid fa-xmark"></i></button>' +
        '</div>' +
        '<div id="profileEditMessage" class="sheet-description"></div>' +
        '<form id="profileEditForm" class="profile-edit-grid">' +
          '<div class="profile-edit-avatar-row">' +
            '<div id="profileEditAvatar" class="profile-edit-avatar"><i class="fa-solid fa-user"></i></div>' +
            '<div class="profile-edit-grid">' +
              '<label class="profile-edit-field"><span>وێنەی پڕۆفایل</span><input id="profileAvatarInput" type="file" accept="image/*"></label>' +
              '<p class="profile-edit-help">وێنەیەکی خۆت هەڵبژێرە بۆ پڕۆفایل.</p>' +
            '</div>' +
          '</div>' +
          '<label class="profile-edit-field"><span>ناو</span><input id="profileDisplayNameInput" type="text" autocomplete="name" maxlength="80" placeholder="ناوی تەواوی کەسەکە"></label>' +
          '<label class="profile-edit-field"><span>ناوی بەکارهێنەر</span><input id="profileUsernameInput" type="text" autocomplete="username" maxlength="30" placeholder="@username" required></label>' +
          '<label class="profile-edit-field"><span>ئیمەیڵ</span><input id="profileEmailInput" type="email" readonly></label>' +
          '<label class="profile-edit-field"><span>ژمارەی مۆبایل</span><input id="profilePhoneInput" type="tel" autocomplete="tel" maxlength="30" placeholder="ئارەزوومەندانە"></label>' +
          '<label class="profile-edit-field"><span>ڕۆژی لەدایکبوون</span><input id="profileBirthDateInput" type="date"></label>' +
          '<label class="profile-edit-field"><span>ڕەگەز</span><select id="profileGenderInput"><option value="">دیاری نەکراوە</option><option value="نێر">نێر</option><option value="مێ">مێ</option></select></label>' +
          '<div class="profile-edit-actions">' +
            '<button class="ghost" type="button" data-action="close-profile-edit">پاشگەزبوونەوە</button>' +
            '<button class="primary" type="submit">پاشەکەوتکردن</button>' +
          '</div>' +
        '</form>' +
      '</section>';

    while (wrap.firstChild) {
      document.body.appendChild(wrap.firstChild);
    }

    var input = $("profileAvatarInput");
    if (input) {
      input.addEventListener("change", function () {
        var file = input.files && input.files[0];
        var preview = $("profileEditAvatar");
        if (!file || !preview) return;
        if (window.FileReader) {
          var reader = new FileReader();
          reader.onload = function () {
            preview.innerHTML = '<img src="' + esc(String(reader.result || "")) + '" alt="">';
          };
          reader.readAsDataURL(file);
        }
      });
    }

    var form = $("profileEditForm");
    if (form) {
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        saveProfileEdits();
      });
    }

    var back = $("profileEditBack");
    if (back) {
      back.addEventListener("click", function () {
        closeSheet($("profileEditBack"), $("profileEditSheet"));
      });
    }
  }

  function renderProfileEditValues() {
    injectProfileEditUI();

    var profile = authState.profile || {};
    var user = authState.user;
    if (!user) return;

    var avatar = $("profileEditAvatar");
    if (avatar) {
      avatar.innerHTML = profile.avatar_url
        ? '<img src="' + esc(profile.avatar_url) + '" alt="">'
        : '<i class="fa-solid fa-user"></i>';
    }

    if ($("profileDisplayNameInput")) $("profileDisplayNameInput").value = profile.display_name || "";
    if ($("profileUsernameInput")) $("profileUsernameInput").value = profile.username ? "@" + normalizeUsername(profile.username) : "";
    if ($("profileEmailInput")) $("profileEmailInput").value = user.email || "";
    if ($("profilePhoneInput")) $("profilePhoneInput").value = profile.phone || "";
    if ($("profileBirthDateInput")) $("profileBirthDateInput").value = profile.birth_date || "";
    if ($("profileGenderInput")) $("profileGenderInput").value = profile.gender || "";
    if ($("profileEditMessage")) $("profileEditMessage").textContent = "";
    if ($("profileAvatarInput")) $("profileAvatarInput").value = "";
  }

  function openProfileEdit() {
    if (!authState.user) {
      openAuthModal("login", "سەرەتا بچۆ ژوورەوە.");
      return;
    }

    renderProfileEditValues();
    openSheet($("profileEditBack"), $("profileEditSheet"));
  }

  function closeProfileEdit() {
    closeSheet($("profileEditBack"), $("profileEditSheet"));
  }

  function setProfileEditMessage(text) {
    var el = $("profileEditMessage");
    if (el) el.textContent = text || "";
  }

  function saveProfileEdits() {
    if (!authState.user || !supabaseReady()) return;

    var cleanUsername = normalizeUsername($("profileUsernameInput").value);
    var usernameError = validateUsername(cleanUsername);
    if (usernameError) {
      setProfileEditMessage(usernameError);
      return;
    }

    var displayName = String($("profileDisplayNameInput").value || "").trim();
    var phone = String($("profilePhoneInput").value || "").trim();
    var birthDate = String($("profileBirthDateInput").value || "").trim();
    var gender = String($("profileGenderInput").value || "").trim();
    var avatarInput = $("profileAvatarInput");
    var file = avatarInput && avatarInput.files ? avatarInput.files[0] : null;

    setProfileEditMessage("خەریکی پاشەکەوتکردنی زانیارییەکانە...");

    var oldAvatarUrl = authState.profile && authState.profile.avatar_url
      ? authState.profile.avatar_url
      : "";

    var avatarPromise = Promise.resolve(oldAvatarUrl);

    if (file) {
      var safeExtension = (String(file.name || "").split(".").pop() || "jpg")
        .replace(/[^a-zA-Z0-9]/g, "")
        .toLowerCase() || "jpg";
      var path = authState.user.id + "/" + Date.now() + "-" + Math.random().toString(36).slice(2, 10) + "." + safeExtension;

      avatarPromise = uploadToStorage("avatars", path, file).then(function (result) {
        return result.url || "";
      });
    }

    avatarPromise
      .then(function (avatarUrl) {
        var patch = {
          display_name: displayName || null,
          username: cleanUsername,
          avatar_url: avatarUrl || oldAvatarUrl || null,
          phone: phone || null,
          birth_date: birthDate || null,
          gender: gender || null
        };

        return supabaseClient
          .from("profiles")
          .update(patch)
          .eq("id", authState.user.id)
          .then(function (result) {
            if (result.error) throw result.error;

            return supabaseClient.auth
              .updateUser({
                data: {
                  display_name: patch.display_name || null,
                  username: patch.username || null,
                  avatar_url: patch.avatar_url || null,
                  phone: patch.phone || null,
                  birth_date: patch.birth_date || null,
                  gender: patch.gender || null
                }
              })
              .catch(function (metadataError) {
                console.warn("saveProfileEdits metadata:", metadataError);
              })
              .then(function () {
                return patch;
              });
          });
      })
      .then(function (patch) {
        authState.profile = Object.assign({}, authState.profile || {}, patch);
        closeProfileEdit();
        renderProfile();
        toast("پڕۆفایل پاشەکەوت کرا");
      })
      .catch(function (error) {
        console.error("saveProfileEdits:", error);
        var message = String(error && error.message || "هەڵە");
        if (error && (error.code === "23505" || message.toLowerCase().indexOf("duplicate") >= 0)) {
          setProfileEditMessage("ئەم ناوی بەکارهێنەرە پێشتر بەکارهاتووە.");
          return;
        }
        setProfileEditMessage("پاشەکەوتکردن سەرکەوتوو نەبوو: " + message.slice(0, 120));
      });
  }

  function renderProfile() {
    var page = document.querySelector("[data-app-view='profile'] .profile-page");
    if (!page) return;

    if (!authState.user) {
      page.innerHTML =
        '<div class="profile-hero"><div class="profile-avatar-wrap"><div class="profile-avatar"><i class="fa-solid fa-user-lock"></i></div></div><div class="profile-intro"><div class="section-kicker">ACCOUNT</div><h2 class="section-title">هەژمارێکت دروست بکە</h2><p class="profile-welcome">بە Login ـکردن دڵخوازەکان و وشە خەزنکراوەکانت لەگەڵت لە هەموو ئامێرێک دەمێننەوە.</p></div></div>' +
        '<div class="profile-menu"><button class="profile-menu-item" type="button" data-action="auth-login"><span class="profile-menu-icon"><i class="fa-solid fa-right-to-bracket"></i></span><span class="profile-menu-copy"><strong>چوونەژوورەوە</strong><small>بچۆ ناو هەژمارەکەت</small></span><i class="fa-solid fa-chevron-left profile-menu-arrow"></i></button>' +
        '<button class="profile-menu-item" type="button" data-action="auth-signup"><span class="profile-menu-icon"><i class="fa-solid fa-user-plus"></i></span><span class="profile-menu-copy"><strong>دروستکردنی هەژمار</strong><small>ئەکاونتێکی نوێ دروست بکە</small></span><i class="fa-solid fa-chevron-left profile-menu-arrow"></i></button></div>';
      return;
    }

    var profile = authState.profile || {};
    var roleLabel = authState.isAdmin ? "OWNER / ADMIN 👑" : (authState.role === "premium" ? "PREMIUM" : "USER");
    var profileName = String(profile.display_name || "").trim() || "بێ ناو";
    var profileUsername = normalizeUsername(profile.username || "");
    var profileEmail = esc(authState.user.email || "");
    var planText = authState.isAdmin
      ? "دەسەڵاتی تەواوی پلاتفۆرم"
      : authState.role === "premium"
        ? (profile.premium_until
            ? "Premium ـی چالاک تا " + new Date(profile.premium_until).toLocaleDateString("ku-IQ")
            : "Premium ـی چالاک")
        : "سنووری نێردان: 3 کتێب + 5 موزیک";

    var bookLimit = authState.isAdmin ? "∞" : (profile.book_limit != null ? profile.book_limit : "3");
    var musicLimit = authState.isAdmin ? "∞" : (profile.music_limit != null ? profile.music_limit : "5");
    var bookUsage = userBookUsage();
    var musicUsage = userMusicUsage();

    var myBooks = books.filter(function (book) {
      return authState.user && book.ownerId === authState.user.id;
    });
    var myMusic = music.filter(function (track) {
      return authState.user && track.ownerId === authState.user.id;
    });

    var avatarMarkup = profile.avatar_url
      ? '<img src="' + esc(profile.avatar_url) + '" alt="">'
      : '<i class="fa-solid ' + (authState.isAdmin ? 'fa-crown' : 'fa-user') + '"></i>';

    page.innerHTML =
      '<div class="profile-hero">' +
        '<div class="profile-public-avatar">' + avatarMarkup + '</div>' +
        '<div class="profile-intro">' +
          '<div class="section-kicker">' + roleLabel + '</div>' +
          '<h2 class="section-title">' + esc(profileName) + '</h2>' +
          '<div class="profile-username">' + (profileUsername ? '@' + esc(profileUsername) : '@username') + '</div>' +
          '<p class="profile-welcome">' + planText + '</p>' +
        '</div>' +
      '</div>' +
      '<button class="primary" type="button" data-action="edit-profile" style="margin-top:10px;min-height:48px"><i class="fa-solid fa-user-pen"></i> دەستکاریی پڕۆفایل</button>' +
      '<div style="display:grid;gap:9px;margin-top:12px">' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:9px">' +
      '<div style="padding:13px;border:1px solid rgba(255,255,255,.06);border-radius:16px;background:rgba(255,255,255,.025)"><small style="color:#8ea1b7;font-size:7px">کتێب</small><strong style="display:block;color:#fff;font-size:18px;margin-top:4px">' + bookUsage + ' / ' + bookLimit + '</strong></div>' +
      '<div style="padding:13px;border:1px solid rgba(255,255,255,.06);border-radius:16px;background:rgba(255,255,255,.025)"><small style="color:#8ea1b7;font-size:7px">موزیک</small><strong style="display:block;color:#fff;font-size:18px;margin-top:4px">' + musicUsage + ' / ' + musicLimit + '</strong></div>' +
      '</div>' +
      '<div class="profile-menu">' +
      '<button class="profile-menu-item" type="button" data-nav="favorites"><span class="profile-menu-icon"><i class="fa-solid fa-heart"></i></span><span class="profile-menu-copy"><strong>دڵخوازەکانم</strong><small>' + Object.keys(authState.favorites).length + ' دانە</small></span><i class="fa-solid fa-chevron-left profile-menu-arrow"></i></button>' +
      '<button class="profile-menu-item" type="button" data-nav="vocab"><span class="profile-menu-icon"><i class="fa-solid fa-language"></i></span><span class="profile-menu-copy"><strong>وشەکانم</strong><small>' + vocab.length + ' وشە</small></span><i class="fa-solid fa-chevron-left profile-menu-arrow"></i></button>' +
      '<button class="profile-menu-item" type="button" data-action="premium-info"><span class="profile-menu-icon"><i class="fa-solid fa-crown"></i></span><span class="profile-menu-copy"><strong>' + (authState.role === "premium" || authState.isAdmin ? 'پلانی ئێستا' : 'Upgrade to Premium') + '</strong><small>' + (authState.isAdmin ? 'Owner' : authState.role === 'premium' ? 'Premium' : 'پارەدان بە دەستی لە Telegram') + '</small></span><i class="fa-solid fa-chevron-left profile-menu-arrow"></i></button>' +
      (authState.isAdmin ? '<button class="profile-menu-item" type="button" data-action="owner-panel"><span class="profile-menu-icon"><i class="fa-solid fa-crown"></i></span><span class="profile-menu-copy"><strong>پانێڵی بەڕێوەبەر</strong><small>کۆنترۆڵی هەموو پلاتفۆرم</small></span><i class="fa-solid fa-chevron-left profile-menu-arrow"></i></button>' : '') +
      '<button class="profile-menu-item" type="button" data-action="auth-signout"><span class="profile-menu-icon"><i class="fa-solid fa-right-from-bracket"></i></span><span class="profile-menu-copy"><strong>دەرچوون</strong><small>لە هەژمارەکەت دەرچۆ</small></span><i class="fa-solid fa-chevron-left profile-menu-arrow"></i></button>' +
      '</div>' +
      '<div style="margin-top:2px;padding:13px;border:1px solid rgba(255,255,255,.06);border-radius:18px;background:rgba(255,255,255,.02)">' +
      '<strong style="color:#fff;font-size:11px">ناوەڕۆکی من</strong>' +
      '<div id="mySubmissionsList" style="display:grid;gap:7px;margin-top:9px"></div>' +
      '</div></div>';

    var subBox = $("mySubmissionsList");
    if (subBox) {
      var rows = [];
      myBooks.forEach(function (book) {
        rows.push('<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;padding:9px;border-radius:12px;background:rgba(255,255,255,.025)"><span style="min-width:0;color:#dbe7f3;font-size:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(book.title) + '</span><small style="color:' + (book.status === 'approved' ? '#7ee2ad' : book.status === 'rejected' ? '#ff8b9d' : '#f5cd68') + ';font-size:7px">' + (book.status === 'approved' ? 'پەسەندکراو' : book.status === 'rejected' ? 'ڕەتکراوە' : 'چاوەڕوان') + '</small></div>');
      });
      myMusic.forEach(function (track) {
        rows.push('<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;padding:9px;border-radius:12px;background:rgba(255,255,255,.025)"><span style="min-width:0;color:#dbe7f3;font-size:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(track.name) + '</span><small style="color:' + (track.status === 'approved' ? '#7ee2ad' : track.status === 'rejected' ? '#ff8b9d' : '#f5cd68') + ';font-size:7px">' + (track.status === 'approved' ? 'پەسەندکراو' : track.status === 'rejected' ? 'ڕەتکراوە' : 'چاوەڕوان') + '</small></div>');
      });
      subBox.innerHTML = rows.length ? rows.join('') : '<small style="color:#7f91a6;font-size:8px">هێشتا هیچ ناوەڕۆکێکت نەناردووە.</small>';
    }
  }


  function getSettingsFontSize() {
    var saved =
      Number(
        localStorage.getItem("kh_font") || 20
      );

    return Number.isFinite(saved)
      ? Math.max(14, Math.min(34, saved))
      : 20;
  }

  function updateSettingsGeminiStatus() {
    var status =
      $("settingsGeminiStatus");

    if (!status) {
      return;
    }

    var key =
      (
        localStorage.getItem("kh_gemini_key") || ""
      ).trim();

    status.classList.toggle(
      "connected",
      !!key
    );

    status.textContent =
      key
        ? "پەیوەستە"
        : "پەیوەست نییە";
  }

  function renderSettingsPage() {
    var page =
      document.querySelector(
        "[data-app-view='settings']"
      );

    if (!page) {
      return;
    }

    var profile =
      authState.profile || {};

    var user =
      authState.user;

    var displayName =
      String(
        profile.display_name ||
        profile.username ||
        (user && user.email
          ? user.email.split("@")[0]
          : "بەکارهێنەر")
      ).trim() ||
      "بەکارهێنەر";

    var username =
      normalizeUsername(
        profile.username ||
        (user && user.user_metadata
          ? user.user_metadata.username
          : "")
      );

    var email =
      user && user.email
        ? user.email
        : "";

    var nameEl =
      $("settingsProfileName");
    var usernameEl =
      $("settingsProfileUsername");
    var emailEl =
      $("settingsProfileEmail");
    var premiumEl =
      $("settingsPremiumBadge");
    var avatar =
      $("settingsProfileAvatar");
    var avatarIcon =
      $("settingsProfileAvatarIcon");

    if (nameEl) {
      nameEl.textContent =
        displayName;
    }

    if (usernameEl) {
      usernameEl.textContent =
        username
          ? "@" + username
          : "@username";
    }

    if (emailEl) {
      emailEl.textContent =
        email ||
        "ئیمەیل بەردەست نییە";
      emailEl.title =
        email || "";
    }

    if (premiumEl) {
      premiumEl.classList.toggle(
        "show",
        authState.role === "premium" ||
        authState.isAdmin
      );
    }

    if (avatar) {
      var avatarUrl =
        String(
          profile.avatar_url || ""
        ).trim();

      if (avatarUrl) {
        avatar.src = avatarUrl;
        avatar.classList.remove("hidden");
        if (avatarIcon) {
          avatarIcon.classList.add("hidden");
        }
      } else {
        avatar.removeAttribute("src");
        avatar.classList.add("hidden");
        if (avatarIcon) {
          avatarIcon.classList.remove("hidden");
        }
      }
    }

    var fontRange =
      $("fontSize");
    var fontValue =
      getSettingsFontSize();

    if (fontRange) {
      fontRange.value =
        String(fontValue);
    }

    var fontLabel =
      $("settingsFontValue");

    if (fontLabel) {
      fontLabel.textContent =
        fontValue +
        "px";
    }

    var musicRange =
      $("settingsMusicVolume");

    if (musicRange) {
      musicRange.value =
        String(
          Math.round(
            musicVolume * 100
          )
        );
    }

    var musicLabel =
      $("settingsMusicValue");

    if (musicLabel) {
      musicLabel.textContent =
        Math.round(
          musicVolume * 100
        ) +
        "٪";
    }

    renderSiteThemes();
    renderReaderThemes();
    updateThemeBadges();
    updateSettingsGeminiStatus();
  }

  function updateAuthUI() {
    var ownerButtons = document.querySelectorAll("[data-action='owner-panel']");
    ownerButtons.forEach(function (button) {
      button.hidden = !authState.isAdmin;
    });

    renderProfile();
    renderSettingsPage();

    var profileButton = document.querySelector(".profile-action");
    if (profileButton) {
      profileButton.title = authState.user ? (authState.user.email || "پڕۆفایل") : "چوونەژوورەوە / پڕۆفایل";
      profileButton.setAttribute("aria-label", profileButton.title);
    }
  }

  function refreshAuthState() {
    if (!supabaseReady()) return Promise.resolve();

    authState.loading = true;

    return supabaseClient.auth.getSession()
      .then(function (result) {
        if (result.error) throw result.error;
        authState.user = result.data && result.data.session ? result.data.session.user : null;
        return authState.user ? getFreshProfile() : null;
      })
      .then(function () {
        if (authState.user && authState.profile) {
          var booksPromise =
            loadRemoteBooks()
              .then(function (items) {
                books = items || [];
                applyFavoritesToBooks();
                return books;
              })
              .catch(function (error) {
                console.error(
                  "Refresh auth books:",
                  error
                );
                return books;
              });

          var musicPromise =
            loadRemoteMusic()
              .then(function (items) {
                music = items || [];
                return music;
              })
              .catch(function (error) {
                console.error(
                  "Refresh auth music:",
                  error
                );
                return music;
              });

          return Promise.all([
            booksPromise,
            musicPromise,
            loadUserCloudData()
          ]);
        }
        authState.role = "anonymous";
        authState.isAdmin = false;
        authState.profile = null;
        authState.favorites = {};
        authState.savedWords = [];
        vocab = [];
        return null;
      })
      .then(function () {
        authState.loading = false;
        updateAuthUI();
        renderBooks();
        renderTracks();
        renderOwnerPanel();
        if (authState.isAdmin) {
          loadAdminUsers().catch(function (adminError) { console.error("loadAdminUsers:", adminError); });
        }
      })
      .catch(function (error) {
        authState.loading = false;
        console.error("refreshAuthState:", error);
        updateAuthUI();
      });
  }

  function initAuth() {
    injectAuthUI();

    if (!supabaseReady()) {
      authState.loading = false;
      updateAuthUI();
      return;
    }

    supabaseClient.auth.onAuthStateChange(function () {
      window.setTimeout(function () {
        refreshAuthState();
      }, 0);
    });

    refreshAuthState();
  }

  function updateTelegramBtnForPremium() {
    var btn = $("telegramBtn");
    if (!btn) return;
    btn.href = "https://t.me/" + PREMIUM_PAYMENT_INFO.telegram.replace(/^@/, "");
  }

  function showPremiumInfo() {
    injectAuthUI();
    var message = authState.role === "premium" || authState.isAdmin
      ? "پلانی ئێستات چالاکە."
      : "بۆ Premium، پارەکە بە FastPay یان FIB بنێرە و لە Telegram پەیوەندیم پێوە بکە.";

    openAuthModal("login", message);

    var premiumTitle = $("xwAuthTitle");
    if (premiumTitle) {
      premiumTitle.textContent =
        authState.isAdmin
          ? "پلانی ئەدمین"
          : authState.role === "premium"
            ? "پلانی Premium"
            : "Upgrade to Premium";
    }

    var fields = $("xwAuthFields");
    fields.innerHTML =
      '<div style="display:grid;gap:10px">' +
      '<div style="padding:13px;border-radius:15px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);color:#d9e5f1;font-size:10px;line-height:2"><strong>FastPay</strong><br>' + esc(PREMIUM_PAYMENT_INFO.fastpay) + '<br><br><strong>FIB</strong><br>' + esc(PREMIUM_PAYMENT_INFO.fib) + '<br><br>دوای ناردنی پارە، ئیمەیڵی هەژمارەکەت لە Telegram بنێرە.</div>' +
      '<a href="https://t.me/' + PREMIUM_PAYMENT_INFO.telegram.replace(/^@/, "") + '" target="_blank" rel="noopener noreferrer" class="primary" style="min-height:48px;display:grid;place-items:center">پەیوەندی بە Telegram</a>' +
      '</div>';
  }

  function saveCurrentWordToCloud() {
    if (!currentWord) return;
    if (!authState.user) {
      openAuthModal("login", "بۆ خەزنکردنی وشە سەرەتا بچۆ ژوورەوە.");
      return;
    }

    var payload = {
      user_id: authState.user.id,
      word: currentWord,
      lang: currentWordLang || "en",
      meaning: currentWordMeanings.ku[0] || currentWordMeanings.ar[0] || ""
    };

    supabaseClient.from("saved_words").insert(payload)
      .select("id,user_id,word,lang,meaning,created_at")
      .single()
      .then(function (result) {
        if (result.error) throw result.error;
        return loadSavedWords();
      })
      .then(function () {
        toast("وشەکە خەزن کرا");
        renderProfile();
      })
      .catch(function (error) {
        console.error("save word:", error);
        if (String(error && error.message || "").toLowerCase().indexOf("duplicate") >= 0) {
          toast("ئەم وشەیە پێشتر خەزن کراوە");
        } else {
          toast("خەزنکردنی وشە سەرکەوتوو نەبوو");
        }
      });
  }

  function deleteSavedWord(id) {
    if (!authState.user) return;
    supabaseClient.from("saved_words")
      .delete()
      .eq("id", Number(id))
      .eq("user_id", authState.user.id)
      .then(function (result) {
        if (result.error) throw result.error;
        return loadSavedWords();
      })
      .then(function () {
        renderProfile();
        toast("وشەکە سڕایەوە");
      })
      .catch(function (error) {
        console.error("delete saved word:", error);
        toast("سڕینەوەی وشە سەرکەوتوو نەبوو");
      });
  }

  function updateBookStatus(id, status, reason) {
    if (!authState.isAdmin) return Promise.reject(new Error("Admin تەنیا دەتوانێت دۆخ بگۆڕێت."));
    var patch = {
      status: status,
      rejection_reason: status === "rejected" ? (reason || "") : null
    };
    return supabaseClient.from("books").update(patch).eq("id", Number(id)).then(function (result) {
      if (result.error) throw result.error;
      return Promise.all([loadRemoteBooks(), loadRemoteMusic()]);
    }).then(function (result) {
      books = result[0] || [];
      music = result[1] || [];
      return loadUserCloudData().catch(function () {});
    }).then(function () {
      renderBooks();
      renderOwnerPanel();
    });
  }

  function deleteMusicByAdmin(id) {
    if (!authState.isAdmin) return;
    var track = music.find(function (item) { return item.id === String(id); });
    if (!track) return;
    if (!window.confirm("دڵنیایت لە سڕینەوەی «" + track.name + "»؟")) return;
    var path = storagePathFromPublicUrl(track.audio_url, MUSIC_BUCKET);
    supabaseClient.from("music").delete().eq("id", Number(track.remoteId != null ? track.remoteId : track.id))
      .then(function (result) {
        if (result.error) throw result.error;
        return deleteFromStorage(MUSIC_BUCKET, path);
      })
      .then(function () {
        music = music.filter(function (item) { return item.id !== String(id); });
        renderTracks();
        renderOwnerPanel();
        renderProfile();
        toast("موزیکەکە سڕایەوە");
      })
      .catch(function (error) {
        console.error("deleteMusicByAdmin:", error);
        toast("سڕینەوەی موزیک سەرکەوتوو نەبوو");
      });
  }

  function updateMusicStatus(id, status, reason) {
    if (!authState.isAdmin) return Promise.reject(new Error("Admin تەنیا دەتوانێت دۆخ بگۆڕێت."));
    return supabaseClient.from("music").update({
      status: status,
      rejection_reason: status === "rejected" ? (reason || "") : null
    }).eq("id", Number(id)).then(function (result) {
      if (result.error) throw result.error;
      return loadRemoteMusic();
    }).then(function (items) {
      music = items || [];
      renderTracks();
      renderOwnerPanel();
    });
  }

  function loadAdminMusic() {
    if (!authState.isAdmin) return Promise.resolve();
    var box = $("adminMusicPending");
    if (!box) return Promise.resolve();

    var rows = music.filter(function (track) { return track.status === "pending" || track.status === "rejected"; }).slice(0, 30);
    box.innerHTML =
      '<strong style="font-size:12px;color:#fff">موزیکی چاوەڕوانەکان</strong>' +
      (rows.length ? rows.map(function (track) {
        var statusText = track.status === "rejected" ? "ڕەتکراوە" : "چاوەڕوان";
        var actions = '';
        if (track.status === "pending") {
          actions += '<button class="icon-btn" type="button" data-admin-music-approve="' + esc(track.id) + '" title="پەسەندکردن"><i class="fa-solid fa-check"></i></button>';
          actions += '<button class="icon-btn" type="button" data-admin-music-reject="' + esc(track.id) + '" title="ڕەتکردنەوە"><i class="fa-solid fa-xmark"></i></button>';
        }
        actions += '<button class="icon-btn" type="button" data-admin-music-delete="' + esc(track.id) + '" title="سڕینەوە"><i class="fa-regular fa-trash-can"></i></button>';
        return '<div class="owner-book-row"><div class="owner-book-main"><strong>' + esc(track.name || "موزیک") + '</strong><small>' + esc(track.artist || "") + ' · ' + statusText + '</small></div><div class="owner-book-actions">' + actions + '</div></div>';
      }).join("") : '<div class="empty" style="padding:14px">هیچ موزیکێکی چاوەڕوان نییە.</div>');
  }

  function loadAdminUsers() {
    if (!authState.isAdmin) return Promise.resolve();

    return supabaseClient
      .rpc("admin_list_users")
      .then(function (result) {
        if (result.error) throw result.error;

        var box = $("adminUsersList");
        if (!box) return;

        var rows = result.data || [];
        box.innerHTML =
          '<strong style="font-size:12px;color:#fff">بەکارهێنەران</strong>' +
          '<small style="color:#7f91a6;font-size:7px">وێنە، ناو، @username و ئیمەیڵی بەکارهێنەران لێرەدا بە شێوەی پارێزراو نیشان دەدرێت.</small>' +
          (rows.length ? rows.slice(0, 50).map(function (row) {
            var isSelf = row.id === authState.user.id;
            var label = row.role === "admin" ? "ADMIN" : row.role === "premium" ? "PREMIUM" : "USER";
            var next = row.role === "premium" ? "user" : "premium";
            var disabled = row.is_disabled;
            var avatar = row.avatar_url
              ? '<img src="' + esc(row.avatar_url) + '" alt="" style="width:44px;height:44px;border-radius:14px;object-fit:cover;border:1px solid rgba(255,255,255,.10)">' 
              : '<div style="width:44px;height:44px;border-radius:14px;display:grid;place-items:center;background:linear-gradient(135deg,var(--a),var(--b));color:#fff"><i class="fa-solid fa-user"></i></div>';
            var displayName = row.display_name || "بێ ناو";
            var username = normalizeUsername(row.username || "");
            var email = row.email || "";
            return '<div style="display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px;align-items:center;padding:10px;border:1px solid rgba(255,255,255,.06);border-radius:14px;background:rgba(255,255,255,.02)">' +
              avatar +
              '<div style="min-width:0"><strong style="display:block;color:#fff;font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(displayName) + '</strong>' +
              '<div style="margin-top:2px;color:var(--a);font-size:7px;direction:ltr;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (username ? '@' + esc(username) : '@username') + '</div>' +
              '<div style="margin-top:2px;color:#a7b7c9;font-size:7px;word-break:break-word">' + esc(email) + '</div>' +
              '<small style="display:block;margin-top:3px;color:' + (disabled ? '#ff8b9d' : '#8295aa') + ';font-size:7px">' + label + (disabled ? ' · ناچالاک' : '') + '</small></div>' +
              '<div style="display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end;grid-column:1 / -1">' +
              (!isSelf ? '<button class="small" type="button" data-admin-role-id="' + esc(row.id) + '" data-admin-next-role="' + next + '">' + (row.role === 'premium' ? 'لابردنی Premium' : 'کردنی Premium') + '</button><button class="small" type="button" data-admin-disable-id="' + esc(row.id) + '" data-admin-disable-value="' + (disabled ? 'false' : 'true') + '">' + (disabled ? 'چالاککردن' : 'ناچالاککردن') + '</button>' : '<span style="color:#f5cd68;font-size:8px">ئۆنەر</span>') +
              '</div></div>';
          }).join("") : '<div class="empty" style="padding:14px">هێشتا بەکارهێنەر نییە.</div>');
      });
  }

  function updateUserDisabled(userId, disabled) {
    if (!authState.isAdmin) return;
    return supabaseClient.from("profiles").update({ is_disabled: !!disabled }).eq("id", userId)
      .then(function (result) {
        if (result.error) throw result.error;
        return loadAdminUsers();
      })
      .catch(function (error) {
        console.error("updateUserDisabled:", error);
        toast("گۆڕینی دۆخی هەژمار سەرکەوتوو نەبوو");
      });
  }

  function updateUserRole(userId, role) {
    if (!authState.isAdmin) return;
    return supabaseClient.from("profiles").update({
      role: role,
      premium_until: role === "premium" ? null : null,
      book_limit: role === "premium" ? null : 3,
      music_limit: role === "premium" ? null : 5
    }).eq("id", userId).then(function (result) {
      if (result.error) throw result.error;
      return loadAdminUsers();
    }).catch(function (error) {
      console.error("updateUserRole:", error);
      toast("گۆڕینی ڕۆڵ سەرکەوتوو نەبوو");
    });
  }

  window.renderProfile = renderProfile;
  window.renderSettingsPage = renderSettingsPage;

  /* =======================================================
     INIT
     ======================================================= */

  function init() {
    /* Saved words require login and are loaded from Supabase. */
    vocab = [];

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
    renderSettingsPage();

    renderVocab();
    renderTracks();
    updatePlayButton();
    initAddBookForm();
    injectAuthUI();
    updateTelegramBtnForPremium();
    initAuth();

    /*
     * Shared public data comes from Supabase.
     */
    loadRemoteBooks()
      .then(function (items) {
        books = items || [];
        applyFavoritesToBooks();
        renderBooks();
        renderLibraryModeControls();
        renderOwnerPanel();
        updateTelegramBtn();
      })
      .catch(function (error) {
        console.error(
          "Initial Supabase books load:",
          error
        );

        /*
         * Keep the existing local IndexedDB fallback
         * so old books are not silently lost on this device.
         */
        dbAll()
          .then(function (storedBooks) {
            books =
              Array.isArray(storedBooks)
                ? storedBooks
                : [];

            renderBooks();
            renderLibraryModeControls();
            renderOwnerPanel();
            updateTelegramBtn();
          })
          .catch(function (dbError) {
            console.error(
              "Fallback local DB load:",
              dbError
            );

            books = [];
            renderBooks();
            renderLibraryModeControls();
            renderOwnerPanel();
            updateTelegramBtn();
          });

        toast(
          "نەتوانرا کتێبەکانی Supabase باربکرێن"
        );
      });

    loadRemoteMusic()
      .then(function (items) {
        music = items || [];
        renderTracks();
        updatePlayButton();
        renderOwnerPanel();
      })
      .catch(function (error) {
        console.error(
          "Initial Supabase music load:",
          error
        );

        music = [];
        renderTracks();
        updatePlayButton();
        renderOwnerPanel();

        toast(
          "نەتوانرا موزیکی Supabase باربکرێت"
        );
      });
  }


  init();

})();
