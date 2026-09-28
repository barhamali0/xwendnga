/* =========================================================
   XWENDNGA — cinema-ui.js
   Stage 3 / Cinema Catalog UI

   Responsibility:
   - Load published cinema records from Supabase
   - Render cinema header + catalog cards
   - Search and filter
   - Handle catalog-only interactions

   Safety:
   - Does not modify script.js
   - Does not modify reader.js
   - Does not own SPA navigation
   - Does not play video or manage subtitles
   - Emits a custom event for the future cinema player
   ========================================================= */

(function () {
  "use strict";

  var CONFIG = {
    supabaseUrl: "https://nretwjagqnisyihtuwwn.supabase.co",
    supabasePublishableKey:
      "sb_publishable_603X2LJm3l-diUOPeXqyPQ_NkrIiD7M",

    table: "cinemas",

    viewSelector: '[data-app-view="cinema"]',
    rootId: "cinemaCatalog"
  };

  var state = {
    ready: false,
    loading: false,
    items: [],
    filtered: [],
    query: "",
    type: "all",
    genre: "all",
    year: "all",
    sort: "newest",
    telegramByCinema: {}
  };

  var client = null;
  var root = null;


  /* =====================================================
     HELPERS
     ===================================================== */

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }


  function normalizeText(value) {
    return String(value == null ? "" : value)
      .trim()
      .toLocaleLowerCase();
  }


  function safeArray(value) {
    var source = Array.isArray(value)
      ? value
      : typeof value === "string"
        ? [value]
        : [];

    return source
      .reduce(function (result, item) {
        if (item == null) {
          return result;
        }

        return result.concat(String(item).split(/[،,]/));
      }, [])
      .map(function (item) {
        return item.trim();
      })
      .filter(Boolean);
  }


  function getPoster(item) {
    return String(item.poster_url || "").trim();
  }


  function getBackdrop(item) {
    return String(
      item.backdrop_url || item.poster_url || ""
    ).trim();
  }


  function getTitle(item) {
    return String(
      item.title_ku || item.title_en || "بێ ناونیشان"
    ).trim();
  }


  function getOriginalTitle(item) {
    return String(item.title_en || "").trim();
  }


  function typeLabel(type) {
    var labels = {
      movie: "فیلم",
      series: "زنجیرە",
      anime: "ئەنیمی",
      cartoon: "کارتۆن"
    };

    return labels[type] || type || "سینەما";
  }


  function formatRating(value) {
    if (value === null || value === undefined || value === "") {
      return "—";
    }

    var number = Number(value);

    if (!Number.isFinite(number)) {
      return "—";
    }

    return number.toFixed(1);
  }


  function getUniqueGenres(items) {
    var map = {};

    items.forEach(function (item) {
      safeArray(item.genres).forEach(function (genre) {
        var key = String(genre).trim();

        if (key) {
          map[key] = true;
        }
      });
    });

    return Object.keys(map).sort(function (a, b) {
      return a.localeCompare(b, "ku");
    });
  }


  function getUniqueYears(items) {
    var map = {};

    items.forEach(function (item) {
      var year = String(item && item.year != null ? item.year : "").trim();

      if (year) {
        map[year] = true;
      }
    });

    return Object.keys(map).sort(function (a, b) {
      var numberA = Number(a);
      var numberB = Number(b);

      if (Number.isFinite(numberA) && Number.isFinite(numberB)) {
        return numberB - numberA;
      }

      return b.localeCompare(a, "ku");
    });
  }


  function dispatchDataReady(items) {
    var detail = {
      items: Array.isArray(items) ? items.slice() : [],
      count: Array.isArray(items) ? items.length : 0
    };

    try {
      window.dispatchEvent(
        new CustomEvent("xwendnga:cinema-data-ready", {
          detail: detail
        })
      );
    } catch (error) {
      var event;

      try {
        event = document.createEvent("CustomEvent");
        event.initCustomEvent(
          "xwendnga:cinema-data-ready",
          true,
          false,
          detail
        );
        window.dispatchEvent(event);
      } catch (fallbackError) {
        console.error(
          "Xwendnga cinema data event error:",
          fallbackError
        );
      }
    }
  }


  function dispatchOpen(item, episodeId) {
    try {
      window.dispatchEvent(
        new CustomEvent("xwendnga:cinema-open", {
          detail: {
            item: item,
            episodeId: episodeId || null
          }
        })
      );
    } catch (error) {
      var event;

      try {
        event = document.createEvent("CustomEvent");
        event.initCustomEvent(
          "xwendnga:cinema-open",
          true,
          false,
          { item: item, episodeId: episodeId || null }
        );
        window.dispatchEvent(event);
      } catch (fallbackError) {
        console.error(
          "Xwendnga cinema open event error:",
          fallbackError
        );
      }
    }
  }


  /* =====================================================
     SUPABASE
     ===================================================== */

  function createSupabaseClient() {
    if (
      window.supabase &&
      typeof window.supabase.createClient === "function"
    ) {
      try {
        return window.supabase.createClient(
          CONFIG.supabaseUrl,
          CONFIG.supabasePublishableKey
        );
      } catch (error) {
        console.error(
          "Xwendnga cinema Supabase client error:",
          error
        );
      }
    }

    return null;
  }


  async function fetchCinemas() {
    if (!client) {
      throw new Error("Supabase بەردەست نییە.");
    }

    var result = await client
      .from(CONFIG.table)
      .select([
        "id",
        "tmdb_id",
        "title_en",
        "title_ku",
        "type",
        "original_language",
        "poster_url",
        "backdrop_url",
        "year",
        "duration",
        "rating",
        "genres",
        "synopsis_en",
        "synopsis_ku",
        "status",
        "created_at",
        "updated_at"
      ].join(","))
      .eq("status", "published")
      .order("created_at", {
        ascending: false
      });

    if (result.error) {
      throw result.error;
    }

    return Array.isArray(result.data)
      ? result.data
      : [];
  }


  function safeExternalUrl(value) {
    var s = String(value || "").trim();

    if (!/^https?:\/\//i.test(s)) {
      return "";
    }

    try {
      var url = new URL(s);

      return /^https?:$/i.test(url.protocol)
        ? url.href
        : "";
    } catch (error) {
      return "";
    }
  }


  function isTelegramServer(server) {
    if (!server) {
      return false;
    }

    var name = String(server.server_name || "")
      .trim()
      .toLowerCase();

    if (
      name.indexOf("telegram") >= 0 ||
      name.indexOf("تێلیگرام") >= 0
    ) {
      return true;
    }

    var url = safeExternalUrl(server.video_url);

    if (!url) {
      return false;
    }

    try {
      return new URL(url).hostname.toLowerCase() === "t.me";
    } catch (error) {
      return false;
    }
  }


  async function loadTelegramAvailability(items) {
    state.telegramByCinema = {};

    if (
      !client ||
      !Array.isArray(items) ||
      !items.length
    ) {
      return;
    }

    var ids = items
      .map(function (item) {
        return item && item.id != null
          ? String(item.id)
          : "";
      })
      .filter(Boolean);

    if (!ids.length) {
      return;
    }

    try {
      var result = await client
        .from("cinema_servers")
        .select("cinema_id,server_name,server_type,video_url")
        .eq("status", "published")
        .in("cinema_id", ids);

      if (result.error) {
        throw result.error;
      }

      (Array.isArray(result.data) ? result.data : [])
        .forEach(function (server) {
          if (
            server &&
            server.cinema_id != null &&
            isTelegramServer(server)
          ) {
            state.telegramByCinema[
              String(server.cinema_id)
            ] = true;
          }
        });
    } catch (error) {
      console.warn(
        "Xwendnga cinema Telegram availability check failed:",
        error
      );
    }
  }




  /* =====================================================
     DOM / TEMPLATE
     ===================================================== */

  function ensureRoot() {
    var view = document.querySelector(CONFIG.viewSelector);

    if (!view) {
      return null;
    }

    var existing = document.getElementById(CONFIG.rootId);

    if (existing) {
      return existing;
    }

    var section = document.createElement("section");

    section.id = CONFIG.rootId;

    view.innerHTML = "";
    view.appendChild(section);

    return section;
  }


  var PROGRESS_KEY = "xwendnga_cinema_progress";

  function readCinemaProgress() {
    try {
      var raw = localStorage.getItem(PROGRESS_KEY);
      var data = raw ? JSON.parse(raw) : {};
      return data && typeof data === "object" && !Array.isArray(data)
        ? data
        : {};
    } catch (error) {
      return {};
    }
  }

  function progressItems() {
    var stored = readCinemaProgress();
    var result = [];

    Object.keys(stored).forEach(function (key) {
      var progress = stored[key];

      if (!progress || typeof progress !== "object") {
        return;
      }

      var currentTime = Number(progress.currentTime);
      var duration = Number(progress.duration);
      var percent = Number(progress.percent);

      if (!Number.isFinite(currentTime) || !Number.isFinite(duration) || duration <= 0) {
        return;
      }

      if (!Number.isFinite(percent)) {
        percent = currentTime / duration * 100;
      }

      if (currentTime <= 10 || percent >= 95) {
        return;
      }

      var item = state.items.find(function (entry) {
        return String(entry.id) === String(progress.cinemaId || key.split("::")[0]);
      });

      if (!item) {
        return;
      }

      result.push({
        progressKey: key,
        item: item,
        progress: progress,
        percent: Math.max(0, Math.min(100, percent)),
        updatedAt: Number(progress.updatedAt) || 0
      });
    });

    return result
      .sort(function (a, b) {
        return b.updatedAt - a.updatedAt;
      });
  }

  function renderContinueWatching() {
    var host = document.getElementById("cinemaContinueWatching");
    if (!host) {
      return;
    }

    var entries = progressItems();

    if (!entries.length) {
      host.innerHTML = "";
      host.hidden = true;
      return;
    }

    host.hidden = false;
    host.innerHTML = [
      '<div class="cinema-section__head">',
        '<div>',
          '<h2 class="cinema-section__title">بەردەوام بە لە سەیرکردن</h2>',
          '<p class="cinema-section__hint">لەو شوێنەی وەستابوویتەوە بەردەوام بە</p>',
        '</div>',
      '</div>',
      '<div class="cinema-wide-grid">',
        entries.map(function (entry) {
          var item = entry.item;
          var progress = entry.progress;
          var title = getTitle(item);
          var episodeLabel = progress.episodeNumber != null
            ? "ئەڵقە " + String(progress.episodeNumber)
            : "";
          var meta = [
            typeLabel(item.type),
            episodeLabel,
            item.duration ? String(item.duration) : ""
          ].filter(Boolean);

          return [
            '<article class="cinema-wide-card" data-cinema-progress-key="' + escapeHtml(String(entry.progressKey)) + '">',
              '<button type="button" class="cinema-wide-card__thumb" data-cinema-progress-open="' + escapeHtml(String(entry.progressKey)) + '" aria-label="بەردەوام بە لە ' + escapeHtml(title) + '">',
                item.poster_url
                  ? '<img src="' + escapeHtml(item.poster_url) + '" alt="" loading="lazy">'
                  : "",
              '</button>',
              '<div class="cinema-wide-card__body">',
                '<h3 class="cinema-wide-card__title">' + escapeHtml(title) + '</h3>',
                '<div class="cinema-wide-card__meta">' + escapeHtml(meta.join(" • ")) + '</div>',
                '<div class="cinema-progress" aria-label="' + escapeHtml(entry.percent.toFixed(0) + "%") + '">',
                  '<span style="width:' + entry.percent.toFixed(2) + '%"></span>',
                '</div>',
              '</div>',
            '</article>'
          ].join("");
        }).join(""),
      '</div>'
    ].join("");

    host.querySelectorAll("[data-cinema-progress-open]").forEach(function (button) {
      button.addEventListener("click", function () {
        var progressKey = button.getAttribute("data-cinema-progress-open");
        var entry = entries.find(function (candidate) {
          return String(candidate.progressKey) === String(progressKey);
        });
        if (entry) {
          dispatchOpen(entry.item, entry.progress.episodeId || null);
        }
      });
    });
  }

  function renderShell() {
    if (!root) {
      return;
    }

    root.innerHTML = [
      '<section class="cinema-shell">',

        '<header class="cinema-header">',
          '<div class="cinema-header__main">',
            '<div class="cinema-section__link">XWENDNGA • CINEMA</div>',
            '<div class="cinema-header__title-row">',
              '<h2 class="cinema-header__title">سینەما</h2>',
              '<div class="cinema-header__count" aria-label="ژمارەی ناوەڕۆکەکان">',
                '<strong id="cinemaContentCount">0</strong>',
                '<span>ناوەڕۆک</span>',
              '</div>',
            '</div>',
            '<p class="cinema-header__subtitle">فیلم، ئەنیمی، زنجیرە و کارتۆن لە یەک شوێن</p>',
          '</div>',
          '<div class="cinema-header__actions"></div>',
        '</header>',

        '<div class="cinema-toolbar">',
          '<div class="cinema-search">',
            '<i class="fa-solid fa-magnifying-glass cinema-search__icon" aria-hidden="true"></i>',
            '<input',
              ' id="cinemaSearchInput"',
              ' type="search"',
              ' autocomplete="off"',
              ' placeholder="گەڕان بۆ فیلم، ئەنیمی یان زنجیرە..."',
              ' aria-label="گەڕان لە سینەما"',
            '>',
          '</div>',
        '</div>',

        '<div class="cinema-filterbar" id="cinemaFilterBar" aria-label="فلتەرەکانی سینەما">',
          '<div class="cinema-filterbar__row cinema-filterbar__row--primary">',
            '<div class="cinema-filter" data-cinema-filter="categories">',
              '<button class="cinema-filter__trigger" type="button" data-cinema-filter-trigger="categories" aria-haspopup="true" aria-expanded="false">',
                '<span>چەشنەکان</span>',
                '<i class="fa-solid fa-chevron-down" aria-hidden="true"></i>',
              '</button>',
              '<div class="cinema-filter__menu" data-cinema-filter-menu="categories" hidden>',
                '<div class="cinema-filter__group-label">جۆر</div>',
                '<div class="cinema-filter__options">',
                  '<button type="button" class="cinema-filter__option" data-cinema-type="all">هەموو جۆرەکان</button>',
                  '<button type="button" class="cinema-filter__option" data-cinema-type="movie">فیلم</button>',
                  '<button type="button" class="cinema-filter__option" data-cinema-type="series">زنجیرە</button>',
                  '<button type="button" class="cinema-filter__option" data-cinema-type="anime">ئەنیمی</button>',
                  '<button type="button" class="cinema-filter__option" data-cinema-type="cartoon">کارتۆن</button>',
                '</div>',
                '<div class="cinema-filter__group-label cinema-filter__group-label--secondary">ژانەر</div>',
                '<div class="cinema-filter__options" id="cinemaGenreFilters" aria-label="ژانەرەکان"></div>',
              '</div>',
            '</div>',

            '<div class="cinema-filter" data-cinema-filter="year">',
              '<button class="cinema-filter__trigger" type="button" data-cinema-filter-trigger="year" aria-haspopup="true" aria-expanded="false">',
                '<span>ساڵ</span>',
                '<i class="fa-solid fa-chevron-down" aria-hidden="true"></i>',
              '</button>',
              '<div class="cinema-filter__menu cinema-filter__menu--years" data-cinema-filter-menu="year" hidden>',
                '<div class="cinema-filter__options" id="cinemaYearFilters" aria-label="ساڵەکان"></div>',
              '</div>',
            '</div>',
          '</div>',

          '<div class="cinema-filterbar__row cinema-filterbar__row--secondary">',
            '<div class="cinema-filter" data-cinema-filter="sort">',
              '<button class="cinema-filter__trigger" type="button" data-cinema-filter-trigger="sort" aria-haspopup="true" aria-expanded="false">',
                '<span>ڕیزکردن</span>',
                '<i class="fa-solid fa-chevron-down" aria-hidden="true"></i>',
              '</button>',
              '<div class="cinema-filter__menu cinema-filter__menu--sort" data-cinema-filter-menu="sort" hidden>',
                '<div class="cinema-filter__options">',
                  '<button type="button" class="cinema-filter__option" data-cinema-sort="newest">نوێترین</button>',
                  '<button type="button" class="cinema-filter__option" data-cinema-sort="oldest">کۆنترین</button>',
                  '<button type="button" class="cinema-filter__option" data-cinema-sort="rating">بەرزترین نمرە</button>',
                  '<button type="button" class="cinema-filter__option" data-cinema-sort="title">بەپێی ناو</button>',
                '</div>',
              '</div>',
            '</div>',
          '</div>',

          '<div id="cinemaActiveFilters" class="cinema-active-filters" aria-live="polite"></div>',
        '</div>',

        '<section id="cinemaContinueWatching" class="cinema-section" hidden aria-label="بەردەوام بە لە سەیرکردن"></section>',

        '<section class="cinema-section">',
          '<div class="cinema-section__head">',
            '<div>',
              '<h2 class="cinema-section__title">کەتەلۆگی سینەما</h2>',
              '<p class="cinema-section__hint">هەموو ناوەڕۆکی بڵاوکراوە</p>',
            '</div>',
            '<span id="cinemaResultCount" class="cinema-section__link">0</span>',
          '</div>',
          '<div id="cinemaGrid" class="cinema-grid" aria-live="polite"></div>',
        '</section>',

      '</section>'
    ].join("");

    bindControls();
  }


  function renderLoading() {
    var grid = document.getElementById("cinemaGrid");

    if (grid) {
      grid.innerHTML = [1, 2, 3, 4, 5, 6]
        .map(function () {
          return [
            '<article class="cinema-skeleton-card" aria-hidden="true">',
              '<div class="cinema-skeleton-card__poster"></div>',
              '<div class="cinema-skeleton-card__body">',
                '<span class="cinema-skeleton-card__title"></span>',
                '<span class="cinema-skeleton-card__meta"></span>',
              '</div>',
            '</article>'
          ].join("");
        })
        .join("");
    }
  }


  function renderError(message) {
    var grid = document.getElementById("cinemaGrid");

    if (!grid) {
      return;
    }

    grid.innerHTML = [
      '<div class="cinema-section" style="grid-column:1/-1">',
        '<div class="cinema-section__hint"><i class="fa-solid fa-circle-exclamation"></i></div>',
        '<h3>هێنانی ناوەڕۆک سەرکەوتوو نەبوو</h3>',
        '<p>',
          escapeHtml(message || "هەڵەیەک ڕوویدا."),
        '</p>',
        '<button id="cinemaRetry" class="cinema-action-btn cinema-action-btn--primary" type="button">',
          '<i class="fa-solid fa-rotate-right"></i>',
          ' دووبارە هەوڵبدەوە',
        '</button>',
      '</div>'
    ].join("");

    var retry = document.getElementById("cinemaRetry");

    if (retry) {
      retry.addEventListener("click", load);
    }
  }


  function renderGenres() {
    var genreTarget = document.getElementById("cinemaGenreFilters");
    var yearTarget = document.getElementById("cinemaYearFilters");

    if (genreTarget) {
      var genres = getUniqueGenres(state.items);

      genreTarget.innerHTML = [
        '<button type="button" class="cinema-filter__option" data-cinema-genre="all">',
          '<span>هەموو ژانەرەکان</span>',
        '</button>'
      ].concat(
        genres.map(function (genre) {
          return '<button type="button" class="cinema-filter__option" data-cinema-genre="' +
            escapeHtml(genre) +
            '">' +
            '<span>' + escapeHtml(genre) + '</span>' +
            '</button>';
        })
      ).join("");
    }

    if (yearTarget) {
      var years = getUniqueYears(state.items);

      yearTarget.innerHTML = [
        '<button type="button" class="cinema-filter__option" data-cinema-year="all">هەموو ساڵەکان</button>'
      ].concat(
        years.map(function (year) {
          return '<button type="button" class="cinema-filter__option" data-cinema-year="' +
            escapeHtml(year) +
            '">' +
            escapeHtml(year) +
            '</button>';
        })
      ).join("");
    }

    updateFilterUI();
  }


  function filterSortLabel(sort) {
    var labels = {
      newest: "نوێترین",
      oldest: "کۆنترین",
      rating: "بەرزترین نمرە",
      title: "بەپێی ناو"
    };

    return labels[sort] || labels.newest;
  }


  function closeCinemaFilters() {
    if (!root) {
      return;
    }

    root.querySelectorAll("[data-cinema-filter]").forEach(function (filter) {
      filter.classList.remove("is-open");
    });

    root.querySelectorAll("[data-cinema-filter-menu]").forEach(function (menu) {
      menu.hidden = true;
    });

    root.querySelectorAll("[data-cinema-filter-trigger]").forEach(function (trigger) {
      trigger.setAttribute("aria-expanded", "false");
    });
  }


  function toggleCinemaFilter(name) {
    if (!root) {
      return;
    }

    var filter = root.querySelector('[data-cinema-filter="' + name + '"]');
    var menu = root.querySelector('[data-cinema-filter-menu="' + name + '"]');
    var trigger = root.querySelector('[data-cinema-filter-trigger="' + name + '"]');

    if (!filter || !menu || !trigger) {
      return;
    }

    var shouldOpen = !filter.classList.contains("is-open");

    closeCinemaFilters();

    if (shouldOpen) {
      filter.classList.add("is-open");
      menu.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
    }
  }


  function updateFilterUI() {
    if (!root) {
      return;
    }

    var categoryTrigger = root.querySelector('[data-cinema-filter-trigger="categories"] span');
    var yearTrigger = root.querySelector('[data-cinema-filter-trigger="year"] span');
    var sortTrigger = root.querySelector('[data-cinema-filter-trigger="sort"] span');

    if (categoryTrigger) {
      categoryTrigger.textContent = "چەشنەکان";
    }

    if (yearTrigger) {
      yearTrigger.textContent = state.year === "all" ? "ساڵ" : state.year;
    }

    if (sortTrigger) {
      sortTrigger.textContent = filterSortLabel(state.sort);
    }

    root.querySelectorAll("[data-cinema-type]").forEach(function (option) {
      option.classList.toggle(
        "is-active",
        String(option.getAttribute("data-cinema-type") || "all") === String(state.type)
      );
    });

    root.querySelectorAll("[data-cinema-genre]").forEach(function (option) {
      option.classList.toggle(
        "is-active",
        normalizeText(option.getAttribute("data-cinema-genre") || "") === normalizeText(state.genre)
      );
    });

    root.querySelectorAll("[data-cinema-year]").forEach(function (option) {
      option.classList.toggle(
        "is-active",
        String(option.getAttribute("data-cinema-year") || "all") === String(state.year)
      );
    });

    root.querySelectorAll("[data-cinema-sort]").forEach(function (option) {
      option.classList.toggle(
        "is-active",
        String(option.getAttribute("data-cinema-sort") || "newest") === String(state.sort)
      );
    });

    var active = document.getElementById("cinemaActiveFilters");

    if (!active) {
      return;
    }

    var tags = [];

    if (state.type !== "all") {
      tags.push(
        '<button type="button" class="cinema-filter-tag" data-cinema-remove-filter="type" aria-label="لابردنی فلتەری جۆر">' +
          '<span>' + escapeHtml(typeLabel(state.type)) + '</span>' +
          '<i class="fa-solid fa-xmark" aria-hidden="true"></i>' +
        '</button>'
      );
    }

    if (state.genre !== "all") {
      tags.push(
        '<button type="button" class="cinema-filter-tag" data-cinema-remove-filter="genre" aria-label="لابردنی فلتەری ژانەر">' +
          '<span>' + escapeHtml(state.genre) + '</span>' +
          '<i class="fa-solid fa-xmark" aria-hidden="true"></i>' +
        '</button>'
      );
    }

    if (state.year !== "all") {
      tags.push(
        '<button type="button" class="cinema-filter-tag" data-cinema-remove-filter="year" aria-label="لابردنی فلتەری ساڵ">' +
          '<span>' + escapeHtml(state.year) + '</span>' +
          '<i class="fa-solid fa-xmark" aria-hidden="true"></i>' +
        '</button>'
      );
    }

    active.innerHTML = tags.join("");
    active.hidden = tags.length === 0;
  }


  function cardHtml(item) {
    var poster = getPoster(item);
    var title = getTitle(item);
    var meta = [];

    if (item.year) {
      meta.push(String(item.year));
    }

    if (Number.isFinite(Number(item.rating))) {
      meta.push("★ " + formatRating(item.rating));
    }

    meta.push(typeLabel(item.type));

    var posterHtml = poster
      ? '<img class="cinema-card__poster" src="' + escapeHtml(poster) + '" alt="' + escapeHtml(title) + '" loading="lazy">'
      : '<div class="cinema-card__poster" aria-hidden="true"></div>';

    var telegramBadge = state.telegramByCinema[
      String(item.id)
    ]
      ? '<span class="cinema-card__telegram" data-cinema-telegram="true" title="سێرڤەری تێلیگرام بەردەستە" aria-label="سێرڤەری تێلیگرام بەردەستە"><i class="fa-brands fa-telegram" aria-hidden="true"></i></span>'
      : "";

    return [
      '<article class="cinema-card" data-cinema-card-id="' + escapeHtml(item.id) + '">',
        '<div class="cinema-card__visual">',
          posterHtml,
          '<span class="cinema-card__badge"><i class="fa-solid fa-circle-play"></i> ' + escapeHtml(typeLabel(item.type)) + '</span>',
          Number.isFinite(Number(item.rating))
            ? '<span class="cinema-card__rating"><i class="fa-solid fa-star"></i> ' + escapeHtml(formatRating(item.rating)) + '</span>'
            : "",
          telegramBadge,
          '<button class="cinema-card__play" type="button" data-cinema-open-id="' + escapeHtml(item.id) + '" aria-label="بینینی ' + escapeHtml(title) + '">',
            '<i class="fa-solid fa-play"></i>',
          '</button>',
        '</div>',
        '<div class="cinema-card__body">',
          '<h3 class="cinema-card__name">' + escapeHtml(title) + '</h3>',
          '<div class="cinema-card__meta">',
            meta.map(function (value) {
              return '<span>' + escapeHtml(value) + '</span>';
            }).join('<span class="cinema-card__meta-separator" aria-hidden="true">•</span>'),
          '</div>',
        '</div>',
      '</article>'
    ].join("");
  }


  function renderGrid(items) {
    var grid = document.getElementById("cinemaGrid");
    var count = document.getElementById("cinemaResultCount");

    if (count) {
      count.textContent = String(items.length);
    }

    var totalCount = document.getElementById("cinemaContentCount");

    if (totalCount) {
      totalCount.textContent = String(state.items.length);
    }

    if (!grid) {
      return;
    }

    if (!items.length) {
      grid.innerHTML = [
        '<div class="cinema-section" style="grid-column:1/-1">',
          '<div class="cinema-section__hint"><i class="fa-solid fa-film"></i></div>',
          '<h3>هیچ ناوەڕۆکێک نەدۆزرایەوە</h3>',
          '<p>وشەی گەڕان یان فلتەرەکان بگۆڕە.</p>',
        '</div>'
      ].join("");
      return;
    }

    grid.innerHTML = items.map(cardHtml).join("");
    bindOpenButtons(grid);
  }


  /* =====================================================
     FILTER / SEARCH / SORT
     ===================================================== */

  function sortItems(items) {
    return items.slice().sort(function (a, b) {
      if (state.sort === "rating") {
        return Number(b.rating || 0) - Number(a.rating || 0);
      }

      if (state.sort === "title") {
        return getTitle(a).localeCompare(getTitle(b), "ku");
      }

      var dateA = new Date(a.created_at || 0).getTime();
      var dateB = new Date(b.created_at || 0).getTime();

      return state.sort === "oldest"
        ? dateA - dateB
        : dateB - dateA;
    });
  }


  function applyFilters() {
    var query = normalizeText(state.query);

    var filtered = state.items.filter(function (item) {
      var typeMatches =
        state.type === "all" ||
        normalizeText(item.type) === normalizeText(state.type);

      if (!typeMatches) {
        return false;
      }

      var itemGenres = safeArray(item.genres).map(normalizeText);

      var genreMatches =
        state.genre === "all" ||
        itemGenres.indexOf(normalizeText(state.genre)) >= 0;

      if (!genreMatches) {
        return false;
      }

      var yearMatches =
        state.year === "all" ||
        String(item.year == null ? "" : item.year) === String(state.year);

      if (!yearMatches) {
        return false;
      }

      if (!query) {
        return true;
      }

      var haystack = [
        item.title_ku,
        item.title_en,
        item.synopsis_ku,
        item.synopsis_en,
        item.original_language,
        safeArray(item.genres).join(" "),
        item.year
      ]
        .filter(function (value) {
          return value !== null && value !== undefined;
        })
        .join(" ");

      return normalizeText(haystack).indexOf(query) >= 0;
    });

    state.filtered = sortItems(filtered);

    renderContinueWatching();
    renderGrid(state.filtered);
    updateFilterUI();
  }


  /* =====================================================
     EVENTS
     ===================================================== */

  function bindOpenButtons(container) {
    if (!container) {
      return;
    }

    container
      .querySelectorAll("[data-cinema-open-id]")
      .forEach(function (button) {
        button.addEventListener("click", function () {
          var id = button.getAttribute("data-cinema-open-id");

          var item = state.items.find(function (entry) {
            return String(entry.id) === String(id);
          });

          if (item) {
            dispatchOpen(item);
          }
        });
      });
  }


  function bindControls() {
    if (!root) {
      return;
    }

    var search = document.getElementById("cinemaSearchInput");
    var filterBar = document.getElementById("cinemaFilterBar");

    if (search) {
      search.addEventListener("input", function () {
        state.query = search.value || "";
        applyFilters();
      });
    }

    if (filterBar) {
      filterBar.addEventListener("click", function (event) {
        var trigger = event.target.closest("[data-cinema-filter-trigger]");

        if (trigger && filterBar.contains(trigger)) {
          toggleCinemaFilter(trigger.getAttribute("data-cinema-filter-trigger") || "");
          return;
        }

        var typeOption = event.target.closest("[data-cinema-type]");
        if (typeOption && filterBar.contains(typeOption)) {
          state.type = typeOption.getAttribute("data-cinema-type") || "all";
          closeCinemaFilters();
          applyFilters();
          return;
        }

        var genreOption = event.target.closest("[data-cinema-genre]");
        if (genreOption && filterBar.contains(genreOption)) {
          state.genre = String(genreOption.getAttribute("data-cinema-genre") || "all");
          closeCinemaFilters();
          applyFilters();
          return;
        }

        var yearOption = event.target.closest("[data-cinema-year]");
        if (yearOption && filterBar.contains(yearOption)) {
          state.year = String(yearOption.getAttribute("data-cinema-year") || "all");
          closeCinemaFilters();
          applyFilters();
          return;
        }

        var sortOption = event.target.closest("[data-cinema-sort]");
        if (sortOption && filterBar.contains(sortOption)) {
          state.sort = sortOption.getAttribute("data-cinema-sort") || "newest";
          closeCinemaFilters();
          applyFilters();
          return;
        }

        var removeFilter = event.target.closest("[data-cinema-remove-filter]");
        if (removeFilter && filterBar.contains(removeFilter)) {
          var filterName = removeFilter.getAttribute("data-cinema-remove-filter") || "";

          if (filterName === "type") {
            state.type = "all";
          } else if (filterName === "genre") {
            state.genre = "all";
          } else if (filterName === "year") {
            state.year = "all";
          }

          applyFilters();
        }
      });
    }

    document.addEventListener("click", function (event) {
      if (!filterBar || filterBar.contains(event.target)) {
        return;
      }

      closeCinemaFilters();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeCinemaFilters();
      }
    });
  }


  /* =====================================================
     LOAD / PUBLIC API
     ===================================================== */

  async function load() {
    if (!root || state.loading) {
      return;
    }

    state.loading = true;
    renderLoading();

    try {
      state.items = await fetchCinemas();

      await loadTelegramAvailability(state.items);

      dispatchDataReady(state.items);

      renderGenres();
      applyFilters();
    } catch (error) {
      console.error(
        "Xwendnga cinema catalog error:",
        error
      );

      renderError(
        error && error.message
          ? error.message
          : "هێنانی داتا سەرکەوتوو نەبوو."
      );
    } finally {
      state.loading = false;
    }
  }


  function init() {
    if (state.ready) {
      return;
    }

    root = ensureRoot();

    if (!root) {
      return;
    }

    state.ready = true;
    client = createSupabaseClient();

    renderShell();

    load();
  }


  function refresh() {
    if (!state.ready) {
      init();
      return;
    }

    load();
  }


  window.addEventListener("xwendnga:cinema-player-close", renderContinueWatching);

  window.XwendngaCinemaUI = {
    init: init,
    load: load,
    refresh: refresh,
    getItems: function () {
      return state.items.slice();
    },
    getFilteredItems: function () {
      return state.filtered.slice();
    }
  };


  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

})();
