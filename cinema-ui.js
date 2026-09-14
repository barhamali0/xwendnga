/* =========================================================
   XWENDNGA — cinema-ui.js
   Stage 3 / Cinema Catalog UI

   Responsibility:
   - Load published cinema records from Supabase
   - Render hero + catalog cards
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
      "sb_publishable_603X2LJm3l-diUOPeQxyPQ_NkrIiD7M",

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
    sort: "newest"
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
    if (Array.isArray(value)) {
      return value.filter(function (item) {
        return item != null && String(item).trim() !== "";
      });
    }

    if (typeof value === "string") {
      return value
        .split(",")
        .map(function (item) {
          return item.trim();
        })
        .filter(Boolean);
    }

    return [];
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


  function dispatchOpen(item) {
    try {
      window.dispatchEvent(
        new CustomEvent("xwendnga:cinema-open", {
          detail: {
            item: item
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
          { item: item }
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
    section.className = "cinema-catalog-root";

    view.innerHTML = "";
    view.appendChild(section);

    return section;
  }


  function renderShell() {
    if (!root) {
      return;
    }

    root.innerHTML = [
      '<section class="cinema-shell">',
        '<div class="cinema-toolbar">',
          '<div class="cinema-search-wrap">',
            '<i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>',
            '<input',
              ' id="cinemaSearchInput"',
              ' class="cinema-search-input"',
              ' type="search"',
              ' autocomplete="off"',
              ' placeholder="گەڕان بۆ فیلم، ئەنیمی یان زنجیرە..."',
              ' aria-label="گەڕان لە سینەما"',
            '>',
            '<button',
              ' id="cinemaSearchClear"',
              ' class="cinema-search-clear"',
              ' type="button"',
              ' aria-label="پاککردنەوەی گەڕان"',
            '>',
              '<i class="fa-solid fa-xmark"></i>',
            '</button>',
          '</div>',
          '<div class="cinema-sort-wrap">',
            '<select id="cinemaSort" class="cinema-sort" aria-label="ڕیزکردن">',
              '<option value="newest">نوێترین</option>',
              '<option value="oldest">کۆنترین</option>',
              '<option value="rating">بەرزترین نمرە</option>',
              '<option value="title">بەپێی ناو</option>',
            '</select>',
          '</div>',
        '</div>',

        '<div class="cinema-filter-row" id="cinemaTypeFilters">',
          '<button class="cinema-filter active" type="button" data-cinema-type="all">هەموو</button>',
          '<button class="cinema-filter" type="button" data-cinema-type="movie">فیلم</button>',
          '<button class="cinema-filter" type="button" data-cinema-type="series">زنجیرە</button>',
          '<button class="cinema-filter" type="button" data-cinema-type="anime">ئەنیمی</button>',
          '<button class="cinema-filter" type="button" data-cinema-type="cartoon">کارتۆن</button>',
        '</div>',

        '<div class="cinema-filter-row cinema-genre-row" id="cinemaGenreFilters"></div>',

        '<section id="cinemaHero" class="cinema-hero" aria-label="فیلمی تایبەت"></section>',

        '<div class="cinema-results-head">',
          '<div>',
            '<div class="cinema-kicker">CINEMA</div>',
            '<h2 class="cinema-section-title">فیلم و ئەنیمی</h2>',
          '</div>',
          '<span id="cinemaResultCount" class="cinema-result-count">0</span>',
        '</div>',

        '<div id="cinemaGrid" class="cinema-grid" aria-live="polite"></div>',
      '</section>'
    ].join("");

    bindControls();
  }


  function renderLoading() {
    var grid = document.getElementById("cinemaGrid");
    var hero = document.getElementById("cinemaHero");

    if (hero) {
      hero.innerHTML = '<div class="cinema-loading cinema-hero-loading">چاوەڕوانی ناوەڕۆک...</div>';
    }

    if (grid) {
      grid.innerHTML = [1, 2, 3, 4, 5, 6]
        .map(function () {
          return '<article class="cinema-skeleton"></article>';
        })
        .join("");
    }
  }


  function renderError(message) {
    var grid = document.getElementById("cinemaGrid");
    var hero = document.getElementById("cinemaHero");

    if (hero) {
      hero.innerHTML = "";
    }

    if (!grid) {
      return;
    }

    grid.innerHTML = [
      '<div class="cinema-empty cinema-error" style="grid-column:1/-1">',
        '<div class="cinema-empty-icon"><i class="fa-solid fa-circle-exclamation"></i></div>',
        '<h3>هێنانی ناوەڕۆک سەرکەوتوو نەبوو</h3>',
        '<p>',
          escapeHtml(message || "هەڵەیەک ڕوویدا."),
        '</p>',
        '<button id="cinemaRetry" class="cinema-primary-btn" type="button">',
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


  function renderHero(items) {
    var hero = document.getElementById("cinemaHero");

    if (!hero) {
      return;
    }

    if (!items.length) {
      hero.innerHTML = "";
      return;
    }

    var featured = items
      .slice()
      .sort(function (a, b) {
        var ratingA = Number(a.rating || 0);
        var ratingB = Number(b.rating || 0);
        return ratingB - ratingA;
      })[0];

    var backdrop = getBackdrop(featured);
    var title = getTitle(featured);
    var original = getOriginalTitle(featured);
    var synopsis =
      featured.synopsis_ku ||
      featured.synopsis_en ||
      "";

    var genres = safeArray(featured.genres)
      .slice(0, 3)
      .map(escapeHtml)
      .join(" · ");

    var style = backdrop
      ? ' style="background-image:linear-gradient(90deg,rgba(5,9,17,.96) 0%,rgba(5,9,17,.72) 46%,rgba(5,9,17,.14) 100%),url(\'' +
        escapeHtml(backdrop.replace(/'/g, "%27")) +
        '\')"'
      : "";

    hero.innerHTML = [
      '<article class="cinema-hero-card"', style, '>',
        '<div class="cinema-hero-overlay">',
          '<div class="cinema-hero-copy">',
            '<div class="cinema-hero-meta">',
              '<span class="cinema-badge">',
                escapeHtml(typeLabel(featured.type)),
              '</span>',
              featured.year
                ? '<span>' + escapeHtml(featured.year) + '</span>'
                : "",
              featured.duration
                ? '<span>' + escapeHtml(featured.duration) + '</span>'
                : "",
              Number.isFinite(Number(featured.rating))
                ? '<span><i class="fa-solid fa-star"></i> ' + escapeHtml(formatRating(featured.rating)) + '</span>'
                : "",
            '</div>',
            '<h1>', escapeHtml(title), '</h1>',
            original && normalizeText(original) !== normalizeText(title)
              ? '<p class="cinema-original-title">' + escapeHtml(original) + '</p>'
              : "",
            synopsis
              ? '<p class="cinema-hero-synopsis">' + escapeHtml(synopsis) + '</p>'
              : "",
            genres
              ? '<div class="cinema-hero-genres">' + genres + '</div>'
              : "",
            '<div class="cinema-hero-actions">',
              '<button class="cinema-primary-btn" type="button" data-cinema-open-id="' + escapeHtml(featured.id) + '">',
                '<i class="fa-solid fa-play"></i>',
                ' بینە',
              '</button>',
              '<button class="cinema-secondary-btn" type="button" data-cinema-open-id="' + escapeHtml(featured.id) + '">',
                'زانیارییەکان',
              '</button>',
            '</div>',
          '</div>',
        '</div>',
      '</article>'
    ].join("");

    bindOpenButtons(hero);
  }


  function renderGenres() {
    var target = document.getElementById("cinemaGenreFilters");

    if (!target) {
      return;
    }

    var genres = getUniqueGenres(state.items);

    target.innerHTML = [
      '<button class="cinema-filter cinema-genre-filter active" type="button" data-cinema-genre="all">هەموو ژانەرەکان</button>'
    ].concat(
      genres.map(function (genre) {
        return '<button class="cinema-filter cinema-genre-filter" type="button" data-cinema-genre="' +
          escapeHtml(genre) +
          '">' +
          escapeHtml(genre) +
          '</button>';
      })
    ).join("");

    target.addEventListener("click", function (event) {
      var button = event.target.closest("[data-cinema-genre]");

      if (!button) {
        return;
      }

      state.genre = String(
        button.getAttribute("data-cinema-genre") || "all"
      );

      target
        .querySelectorAll("[data-cinema-genre]")
        .forEach(function (item) {
          item.classList.toggle(
            "active",
            item === button
          );
        });

      applyFilters();
    }, { once: true });
  }


  function cardHtml(item) {
    var poster = getPoster(item);
    var title = getTitle(item);
    var original = getOriginalTitle(item);
    var synopsis =
      item.synopsis_ku ||
      item.synopsis_en ||
      "";
    var genres = safeArray(item.genres);

    var posterHtml = poster
      ? '<img src="' + escapeHtml(poster) + '" alt="' + escapeHtml(title) + '" loading="lazy">'
      : '<div class="cinema-poster-fallback"><i class="fa-solid fa-film"></i></div>';

    return [
      '<article class="cinema-card" data-cinema-card-id="' + escapeHtml(item.id) + '">',
        '<button class="cinema-card-main" type="button" data-cinema-open-id="' + escapeHtml(item.id) + '">',
          '<div class="cinema-poster">',
            posterHtml,
            '<div class="cinema-poster-shade"></div>',
            '<div class="cinema-card-top">',
              '<span class="cinema-type-chip">', escapeHtml(typeLabel(item.type)), '</span>',
              Number.isFinite(Number(item.rating))
                ? '<span class="cinema-rating"><i class="fa-solid fa-star"></i> ' + escapeHtml(formatRating(item.rating)) + '</span>'
                : "",
            '</div>',
            '<div class="cinema-card-hover">',
              '<span class="cinema-play"><i class="fa-solid fa-play"></i></span>',
              '<div class="cinema-card-hover-meta">',
                item.year ? '<span>' + escapeHtml(item.year) + '</span>' : "",
                item.duration ? '<span>' + escapeHtml(item.duration) + '</span>' : "",
              '</div>',
              synopsis ? '<p>' + escapeHtml(synopsis) + '</p>' : "",
            '</div>',
          '</div>',
          '<div class="cinema-card-copy">',
            '<h3>' + escapeHtml(title) + '</h3>',
            original && normalizeText(original) !== normalizeText(title)
              ? '<p class="cinema-card-original">' + escapeHtml(original) + '</p>'
              : "",
            genres.length
              ? '<div class="cinema-card-genres">' + genres.slice(0, 2).map(escapeHtml).join(" · ") + '</div>'
              : '<div class="cinema-card-genres">سینەما</div>',
          '</div>',
        '</button>',
      '</article>'
    ].join("");
  }


  function renderGrid(items) {
    var grid = document.getElementById("cinemaGrid");
    var count = document.getElementById("cinemaResultCount");

    if (count) {
      count.textContent = String(items.length);
    }

    if (!grid) {
      return;
    }

    if (!items.length) {
      grid.innerHTML = [
        '<div class="cinema-empty" style="grid-column:1/-1">',
          '<div class="cinema-empty-icon"><i class="fa-solid fa-film"></i></div>',
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

    renderHero(state.filtered.length ? state.filtered : state.items);
    renderGrid(state.filtered);
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
    var clear = document.getElementById("cinemaSearchClear");
    var sort = document.getElementById("cinemaSort");
    var typeFilters = document.getElementById("cinemaTypeFilters");

    if (search) {
      search.addEventListener("input", function () {
        state.query = search.value || "";
        applyFilters();
      });
    }

    if (clear) {
      clear.addEventListener("click", function () {
        if (search) {
          search.value = "";
          state.query = "";
          search.focus();
        }

        applyFilters();
      });
    }

    if (sort) {
      sort.addEventListener("change", function () {
        state.sort = sort.value || "newest";
        applyFilters();
      });
    }

    if (typeFilters) {
      typeFilters.addEventListener("click", function (event) {
        var button = event.target.closest("[data-cinema-type]");

        if (!button) {
          return;
        }

        state.type = button.getAttribute("data-cinema-type") || "all";

        typeFilters
          .querySelectorAll("[data-cinema-type]")
          .forEach(function (item) {
            item.classList.toggle(
              "active",
              item === button
            );
          });

        applyFilters();
      });
    }
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
