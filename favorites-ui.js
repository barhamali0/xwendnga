/* =========================================================
   XWENDNGA — favorites-ui.js
   Phase 6-D-2 — Unified Favorites View
   ---------------------------------------------------------
   Responsibility:
   - Render the unified Favorites page UI.
   - Show Book + Cinema favorites from user_content_state.
   - Provide All / Book / Cinema filters.
   - Keep Profile / Cinema / Reader modules independent.
   - Use window.AppLib for data/actions.
   ---------------------------------------------------------
   Does NOT:
   - Query Supabase directly.
   - Modify cinema-ui.js / profile-ui.js / reader.js.
   - Own SPA navigation.
   ========================================================= */

(function (window, document) {
  "use strict";

  var MODULE_NAME = "XwendngaFavoritesUI";
  var ROOT_ID = "favoritesList";
  var FILTERS_ID = "favoritesFilters";
  var VIEW_SELECTOR = '[data-app-view="favorites"]';

  var state = {
    ready: false,
    filter: "all",
    requestId: 0,
    bound: false
  };


  /* =========================================================
     HELPERS
     ========================================================= */

  function appLib() {
    return window.AppLib || null;
  }


  function authState() {
    var api = appLib();
    return api && api.authState ? api.authState : null;
  }


  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }


  function normalizeId(value) {
    return String(value == null ? "" : value).trim();
  }


  function isFavoriteType(value) {
    return value === "book" || value === "cinema";
  }


  function getBookId(book) {
    if (!book) return "";
    return normalizeId(
      book.remoteId != null
        ? book.remoteId
        : book.id
    );
  }


  function getCinemaId(item) {
    return normalizeId(item && item.id);
  }


  function formatUpdatedAt(value) {
    if (!value) return "";

    try {
      var date = new Date(value);
      if (!Number.isFinite(date.getTime())) return "";

      return date.toLocaleDateString("ckb-IQ", {
        year: "numeric",
        month: "short",
        day: "numeric"
      });
    } catch (e) {
      return "";
    }
  }


  function typeLabel(type) {
    if (type === "book") return "کتێب";
    return "سینەما";
  }


  function cinemaTypeLabel(type) {
    var labels = {
      movie: "فیلم",
      series: "زنجیرە",
      anime: "ئەنیمی",
      cartoon: "کارتۆن"
    };

    return labels[type] || "سینەما";
  }


  function typeIcon(type) {
    return type === "book"
      ? "fa-solid fa-book-open"
      : "fa-solid fa-film";
  }


  function getTitle(item, type) {
    if (!item) {
      return type === "book" ? "کتێبی بێ ناو" : "سینەمای بێ ناو";
    }

    if (type === "book") {
      return String(item.title || "کتێبی بێ ناو").trim();
    }

    return String(
      item.title_ku ||
      item.title_en ||
      "سینەمای بێ ناو"
    ).trim();
  }


  function getBooks() {
    var api = appLib();
    if (!api || typeof api.getBooks !== "function") {
      return [];
    }

    try {
      var items = api.getBooks();
      return Array.isArray(items) ? items : [];
    } catch (error) {
      console.warn("Xwendnga Favorites UI — getBooks:", error);
      return [];
    }
  }


  function getCinemaItems() {
    var cinema = window.XwendngaCinemaUI;
    if (!cinema || typeof cinema.getItems !== "function") {
      return [];
    }

    try {
      var items = cinema.getItems();
      return Array.isArray(items) ? items : [];
    } catch (error) {
      console.warn("Xwendnga Favorites UI — get cinema items:", error);
      return [];
    }
  }


  function findBook(id, books) {
    var normalized = normalizeId(id);

    for (var i = 0; i < books.length; i += 1) {
      if (getBookId(books[i]) === normalized) {
        return books[i];
      }
    }

    return null;
  }


  function findCinema(id, items) {
    var normalized = normalizeId(id);

    for (var i = 0; i < items.length; i += 1) {
      if (getCinemaId(items[i]) === normalized) {
        return items[i];
      }
    }

    return null;
  }


  function normalizeRows(rows) {
    return (Array.isArray(rows) ? rows : [])
      .filter(function (row) {
        return (
          row &&
          isFavoriteType(String(row.contentType || "")) &&
          normalizeId(row.contentId) &&
          row.isFavorite === true
        );
      })
      .map(function (row) {
        return {
          contentType: String(row.contentType),
          contentId: normalizeId(row.contentId),
          updatedAt: row.updatedAt || null
        };
      })
      .sort(function (a, b) {
        var aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        var bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return bTime - aTime;
      });
  }


  function filteredRows(rows) {
    if (state.filter === "all") {
      return rows;
    }

    return rows.filter(function (row) {
      return row.contentType === state.filter;
    });
  }


  /* =========================================================
     STYLES
     ========================================================= */

  function ensureStyles() {
    if (document.getElementById("xwendngaFavoritesStyles")) {
      return;
    }

    var style = document.createElement("style");
    style.id = "xwendngaFavoritesStyles";
    style.textContent = [
      ".favorites-page-section{min-width:0}",
      ".favorites-page-head{margin-bottom:10px}",
      ".favorites-page-hint{margin:5px 0 0;color:var(--muted);font-size:9px;line-height:1.8}",
      ".favorites-filter-group{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 18px}",
      ".favorites-filter{min-height:40px;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:0 14px;border:1px solid rgba(255,255,255,.08);border-radius:999px;color:rgba(255,255,255,.72);background:rgba(255,255,255,.035);font:inherit;font-size:10px;font-weight:800;cursor:pointer;transition:transform .18s ease,background .18s ease,border-color .18s ease,color .18s ease}",
      ".favorites-filter:hover{transform:translateY(-1px);color:#fff;border-color:rgba(255,255,255,.17);background:rgba(255,255,255,.06)}",
      ".favorites-filter.is-active{color:#fff;border-color:transparent;background:linear-gradient(135deg,var(--a),var(--b));box-shadow:0 10px 24px color-mix(in srgb,var(--a) 20%,transparent)}",
      ".favorites-filter:focus-visible{outline:2px solid currentColor;outline-offset:2px}",
      ".xwendnga-favorites-grid{align-items:stretch}",
      ".xwendnga-favorites-grid .book{height:100%}",
      ".xwendnga-favorite-cinema-card{position:relative;min-width:0;height:100%;display:flex;flex-direction:column;overflow:hidden;border:1px solid rgba(255,255,255,.075);border-radius:22px;background:linear-gradient(180deg,rgba(255,255,255,.035),rgba(255,255,255,.018));box-shadow:0 18px 42px rgba(0,0,0,.18)}",
      ".xwendnga-favorite-cinema-poster{position:relative;aspect-ratio:2 / 3;overflow:hidden;background:#0a1020}",
      ".xwendnga-favorite-cinema-poster img{display:block;width:100%;height:100%;object-fit:cover}",
      ".xwendnga-favorite-cinema-poster::after{content:\"\";position:absolute;inset:0;background:linear-gradient(180deg,rgba(2,4,10,.02) 30%,rgba(2,4,10,.78) 100%);pointer-events:none}",
      ".xwendnga-favorite-cinema-type{position:absolute;top:10px;inset-inline-start:10px;z-index:2;display:inline-flex;align-items:center;gap:6px;min-height:27px;padding:5px 9px;border:1px solid rgba(255,255,255,.12);border-radius:999px;color:#eef3fb;background:rgba(5,9,18,.58);font-size:9px;font-weight:800;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}",
      ".xwendnga-favorite-cinema-remove{position:absolute;top:10px;inset-inline-end:10px;z-index:3;width:34px;height:34px;display:grid;place-items:center;border:1px solid rgba(255,255,255,.12);border-radius:11px;color:#fff;background:rgba(5,9,18,.58);font:inherit;cursor:pointer;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);transition:transform .18s ease,background .18s ease,border-color .18s ease}",
      ".xwendnga-favorite-cinema-remove:hover{transform:translateY(-1px);background:rgba(255,83,109,.16);border-color:rgba(255,83,109,.28)}",
      ".xwendnga-favorite-cinema-body{display:flex;flex-direction:column;gap:8px;padding:13px;flex:1;min-width:0}",
      ".xwendnga-favorite-cinema-title{margin:0;color:var(--text);font-size:12px;font-weight:900;line-height:1.55;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}",
      ".xwendnga-favorite-cinema-meta{display:flex;flex-wrap:wrap;gap:6px;color:var(--muted);font-size:8px;line-height:1.5}",
      ".xwendnga-favorite-cinema-meta span{display:inline-flex;align-items:center;gap:4px;padding:4px 7px;border:1px solid rgba(255,255,255,.06);border-radius:999px;background:rgba(255,255,255,.025)}",
      ".xwendnga-favorite-cinema-actions{display:grid;grid-template-columns:1fr;gap:7px;margin-top:auto;padding-top:4px}",
      ".xwendnga-favorite-cinema-actions button{width:100%;min-height:38px;border:1px solid rgba(255,255,255,.09);border-radius:11px;color:#fff;background:rgba(255,255,255,.045);font:inherit;font-size:9px;font-weight:800;cursor:pointer}",
      ".xwendnga-favorite-cinema-actions .primary{border-color:transparent;background:linear-gradient(135deg,var(--a),var(--b))}",
      ".xwendnga-favorite-cinema-empty-poster{width:100%;height:100%;display:grid;place-items:center;color:rgba(255,255,255,.28);font-size:34px;background:radial-gradient(circle at 35% 25%,rgba(53,187,255,.12),transparent 48%),#0a1020}",
      ".xwendnga-favorites-state{grid-column:1 / -1;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:220px;padding:28px 18px;text-align:center;border:1px dashed rgba(255,255,255,.09);border-radius:22px;background:rgba(255,255,255,.02)}",
      ".xwendnga-favorites-state-icon{width:56px;height:56px;display:grid;place-items:center;margin-bottom:12px;border-radius:18px;color:rgba(255,255,255,.72);background:rgba(255,255,255,.06);font-size:20px}",
      ".xwendnga-favorites-state h3{margin:0 0 6px;color:#fff;font-size:15px;font-weight:900}",
      ".xwendnga-favorites-state p{max-width:430px;margin:0 0 14px;color:rgba(255,255,255,.52);font-size:10px;line-height:1.9}",
      ".xwendnga-favorites-state button{min-height:39px;padding:0 14px;border:0;border-radius:12px;color:#fff;background:linear-gradient(135deg,var(--a),var(--b));font:inherit;font-size:10px;font-weight:800;cursor:pointer}",
      "@media(max-width:640px){.favorites-filter-group{overflow-x:auto;flex-wrap:nowrap;padding-bottom:2px;scrollbar-width:none;-webkit-overflow-scrolling:touch}.favorites-filter-group::-webkit-scrollbar{display:none}.favorites-filter{flex:0 0 auto}.favorites-page-hint{font-size:8px}.xwendnga-favorite-cinema-body{padding:11px}.xwendnga-favorite-cinema-title{font-size:11px}}"
    ].join("");

    document.head.appendChild(style);
  }


  /* =========================================================
     STATE / UI
     ========================================================= */

  function setFilter(nextFilter) {
    if (["all", "book", "cinema"].indexOf(nextFilter) < 0) {
      nextFilter = "all";
    }

    state.filter = nextFilter;

    var filters = document.getElementById(FILTERS_ID);
    if (filters) {
      filters.querySelectorAll("[data-favorites-filter]").forEach(function (button) {
        var active = button.getAttribute("data-favorites-filter") === state.filter;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-selected", active ? "true" : "false");
      });
    }

    render();
  }


  function renderLoading() {
    var box = document.getElementById(ROOT_ID);
    if (!box) return;

    box.innerHTML = [
      '<div class="xwendnga-favorites-state">',
        '<div class="xwendnga-favorites-state-icon"><i class="fa-solid fa-spinner fa-spin"></i></div>',
        '<h3>دڵخوازەکان خەریکی بارکردنن</h3>',
        '<p>دڵخوازەکانت لەسەر خشتەی داتا دەخوێنینەوە.</p>',
      '</div>'
    ].join("");
  }


  function renderLogin() {
    var box = document.getElementById(ROOT_ID);
    if (!box) return;

    box.innerHTML = [
      '<div class="xwendnga-favorites-state">',
        '<div class="xwendnga-favorites-state-icon"><i class="fa-solid fa-heart"></i></div>',
        '<h3>دڵخوازەکانت پاش چوونەژوورەوە</h3>',
        '<p>بۆ بینینی دڵخوازەکانت سەرەتا بچۆ ژوورەوە.</p>',
        '<button type="button" data-action="auth-login"><i class="fa-solid fa-right-to-bracket"></i> چوونەژوورەوە</button>',
      '</div>'
    ].join("");
  }


  function renderEmpty() {
    var box = document.getElementById(ROOT_ID);
    if (!box) return;

    var title = "هێشتا دڵخوازێک نییە";
    var message = "کتێب یان ناوەڕۆکی سینەمایەک دڵخواز بکە تا لێرە پیشان بدرێت.";
    var icon = "fa-regular fa-heart";

    if (state.filter === "book") {
      title = "هێشتا کتێبێکی دڵخواز نییە";
      message = "هەر کتێبێک دڵخواز بکە، لێرە بە کارتی خۆی دەردەکەوێت.";
      icon = "fa-solid fa-book-open";
    } else if (state.filter === "cinema") {
      title = "هێشتا سینەمایەکی دڵخواز نییە";
      message = "هەر فیلمێک یان ناوەڕۆکی سینەما دڵخواز بکە، لێرە دەردەکەوێت.";
      icon = "fa-solid fa-film";
    }

    box.innerHTML = [
      '<div class="xwendnga-favorites-state">',
        '<div class="xwendnga-favorites-state-icon"><i class="' + icon + '"></i></div>',
        '<h3>' + escapeHtml(title) + '</h3>',
        '<p>' + escapeHtml(message) + '</p>',
      '</div>'
    ].join("");
  }


  /* =========================================================
     CARD RENDERERS
     ========================================================= */

  function renderBookCard(row, book) {
    var title = getTitle(book, "book");
    var author = String(
      (book && book.author) ||
      "نووسەری دیارینەکراو"
    ).trim();
    var pageCount = Number(book && book.pageCount) || 0;
    var language = String(book && (book.language || book.lang) || "").trim();
    var date = formatUpdatedAt(row.updatedAt);
    var id = escapeHtml(row.contentId);

    return [
      '<article class="book" data-favorite-type="book" data-favorite-id="' + id + '">',
        '<button class="fav" type="button" data-favorite-remove="1" aria-label="لابردن لە دڵخوازەکان" title="لابردن لە دڵخوازەکان">',
          '<i class="fa-solid fa-heart"></i>',
        '</button>',
        '<div class="cover">',
          book && book.cover_url
            ? '<img class="book-cover-image" src="' + escapeHtml(book.cover_url) + '" alt="" loading="lazy" onerror="this.onerror=null;this.style.display=\'none\'">'
            : '<i class="fa-solid fa-book-bookmark"></i>',
        '</div>',
        '<div class="book-main">',
          '<div class="book-title">' + escapeHtml(title) + '</div>',
          '<div class="book-author">' + escapeHtml(author) + '</div>',
          '<div class="meta">',
            '<span><i class="fa-regular fa-file-lines"></i> ' + escapeHtml(pageCount) + ' لاپەڕە</span>',
            language ? '<span><i class="fa-solid fa-language"></i> ' + escapeHtml(language) + '</span>' : '',
            '<span class="tag-badge"><i class="fa-solid fa-book-open"></i> کتێب</span>',
          '</div>',
          '<div class="favorites-card-source">',
            '<span><i class="fa-solid fa-heart"></i> دڵخواز</span>',
            date ? '<span>' + escapeHtml(date) + '</span>' : '',
          '</div>',
          '<div class="actions">',
            '<button class="small primary" type="button" data-favorite-open="1">',
              '<i class="fa-solid fa-book-open"></i> خوێندنەوە',
            '</button>',
            '<button class="small" type="button" data-favorite-remove="1">',
              '<i class="fa-regular fa-trash-can"></i>',
            '</button>',
          '</div>',
        '</div>',
      '</article>'
    ].join("");
  }


  function renderCinemaCard(row, item) {
    var title = getTitle(item, "cinema");
    var poster = String(item && item.poster_url || "").trim();
    var type = String(item && item.type || "").trim();
    var year = String(item && item.year || "").trim();
    var rating = Number(item && item.rating);
    var date = formatUpdatedAt(row.updatedAt);
    var id = escapeHtml(row.contentId);

    return [
      '<article class="xwendnga-favorite-cinema-card" data-favorite-type="cinema" data-favorite-id="' + id + '">',
        '<div class="xwendnga-favorite-cinema-poster">',
          poster
            ? '<img src="' + escapeHtml(poster) + '" alt="' + escapeHtml(title) + '" loading="lazy">'
            : '<div class="xwendnga-favorite-cinema-empty-poster"><i class="fa-solid fa-film"></i></div>',
          '<span class="xwendnga-favorite-cinema-type"><i class="' + typeIcon("cinema") + '" aria-hidden="true"></i> ' + escapeHtml(typeLabel("cinema")) + (type ? ' • ' + escapeHtml(cinemaTypeLabel(type)) : '') + '</span>',
          '<button class="xwendnga-favorite-cinema-remove" type="button" data-favorite-remove="1" aria-label="لابردن لە دڵخوازەکان" title="لابردن لە دڵخوازەکان">',
            '<i class="fa-solid fa-heart"></i>',
          '</button>',
        '</div>',
        '<div class="xwendnga-favorite-cinema-body">',
          '<h3 class="xwendnga-favorite-cinema-title">' + escapeHtml(title) + '</h3>',
          '<div class="xwendnga-favorite-cinema-meta">',
            year ? '<span><i class="fa-regular fa-calendar"></i> ' + escapeHtml(year) + '</span>' : '',
            Number.isFinite(rating) ? '<span><i class="fa-solid fa-star"></i> ' + escapeHtml(rating.toFixed(1)) + '</span>' : '',
            '<span><i class="fa-solid fa-heart"></i> دڵخواز</span>',
          '</div>',
          '<div class="xwendnga-favorite-cinema-actions">',
            '<button class="primary" type="button" data-favorite-open="1">',
              '<i class="fa-solid fa-play"></i> بینین',
            '</button>',
          '</div>',
        '</div>',
      '</article>'
    ].join("");
  }


  function renderCards(rows) {
    var box = document.getElementById(ROOT_ID);
    if (!box) return;

    var books = getBooks();
    var cinemaItems = getCinemaItems();
    var html = [];

    rows.forEach(function (row) {
      if (row.contentType === "book") {
        var book = findBook(row.contentId, books);
        if (book) {
          html.push(renderBookCard(row, book));
        }
        return;
      }

      if (row.contentType === "cinema") {
        var cinemaItem = findCinema(row.contentId, cinemaItems);
        if (cinemaItem) {
          html.push(renderCinemaCard(row, cinemaItem));
        }
      }
    });

    if (!html.length) {
      renderEmpty();
      return;
    }

    box.innerHTML = html.join("");
  }


  /* =========================================================
     DATA LOAD
     ========================================================= */

  function loadFavoritesAndRender() {
    var api = appLib();
    var currentAuth = authState();

    if (!api || typeof api.getFavorites !== "function") {
      return Promise.resolve();
    }

    if (!currentAuth || !currentAuth.user) {
      renderLogin();
      return Promise.resolve();
    }

    var requestId = ++state.requestId;
    renderLoading();

    return api.getFavorites()
      .then(function (rows) {
        if (requestId !== state.requestId) {
          return;
        }

        var normalized = normalizeRows(rows);
        var visible = filteredRows(normalized);

        renderCards(visible);
      })
      .catch(function (error) {
        if (requestId !== state.requestId) {
          return;
        }

        console.error("Xwendnga Favorites UI — load error:", error);

        var box = document.getElementById(ROOT_ID);
        if (!box) return;

        box.innerHTML = [
          '<div class="xwendnga-favorites-state">',
            '<div class="xwendnga-favorites-state-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>',
            '<h3>دڵخوازەکان نەهاتن</h3>',
            '<p>کێشەیەک لە کاتی وەرگرتنی دڵخوازەکاندا ڕوویدا.</p>',
            '<button type="button" data-favorites-retry><i class="fa-solid fa-rotate-right"></i> دووبارە هەوڵبدەوە</button>',
          '</div>'
        ].join("");
      });
  }


  function render() {
    ensureStyles();
    state.ready = true;
    return loadFavoritesAndRender();
  }


  /* =========================================================
     EVENTS
     ========================================================= */

  function bindFilterEvents() {
    var filters = document.getElementById(FILTERS_ID);
    if (!filters || filters.getAttribute("data-xwendnga-bound") === "1") {
      return;
    }

    filters.setAttribute("data-xwendnga-bound", "1");

    filters.addEventListener("click", function (event) {
      var button = event.target.closest("[data-favorites-filter]");
      if (!button) return;

      event.preventDefault();
      setFilter(button.getAttribute("data-favorites-filter") || "all");
    });
  }


  function bindRootEvents() {
    var box = document.getElementById(ROOT_ID);
    if (!box || state.bound) {
      return;
    }

    state.bound = true;

    box.addEventListener("click", function (event) {
      var retry = event.target.closest("[data-favorites-retry]");
      if (retry) {
        event.preventDefault();
        render();
        return;
      }

      var remove = event.target.closest("[data-favorite-remove]");
      var open = event.target.closest("[data-favorite-open]");
      var card = event.target.closest("[data-favorite-type]");

      if (remove && card) {
        event.preventDefault();
        var removeType = card.getAttribute("data-favorite-type");
        var removeId = card.getAttribute("data-favorite-id");
        var api = appLib();

        if (!api || typeof api.setFavorite !== "function") {
          return;
        }

        remove.disabled = true;

        api.setFavorite(removeType, removeId, false)
          .then(function () {
            render();
          })
          .catch(function (error) {
            console.error("Xwendnga Favorites UI — remove favorite:", error);
            remove.disabled = false;
          });
        return;
      }

      if (open && card) {
        event.preventDefault();

        var openType = card.getAttribute("data-favorite-type");
        var openId = card.getAttribute("data-favorite-id");
        var openApi = appLib();

        if (!openApi) return;

        if (openType === "book") {
          if (typeof openApi.openBook === "function") {
            openApi.openBook(openId);
          }
          return;
        }

        if (openType === "cinema") {
          var item = findCinema(openId, getCinemaItems());
          if (item && typeof openApi.openCinema === "function") {
            openApi.openCinema(item);
          }
        }
      }
    });
  }


  function bindLoginEvents() {
    document.addEventListener("click", function (event) {
      var button = event.target.closest("#" + ROOT_ID + " [data-action='auth-login']");
      if (!button) return;

      var api = appLib();
      if (!api) return;

      if (typeof api.openAuthModal === "function") {
        api.openAuthModal("login");
        return;
      }

      var legacy = document.querySelector("[data-action='auth-login']");
      if (legacy && legacy !== button) legacy.click();
    });
  }


  function bindGlobalStateEvents() {
    window.addEventListener("xwendnga:user-content-state-changed", function (event) {
      var detail = event && event.detail ? event.detail : {};
      if (
        detail.contentType === "book" ||
        detail.contentType === "cinema" ||
        detail.reason === "favorite"
      ) {
        render();
      }
    });

    window.addEventListener("xwendnga:cinema-data-ready", function () {
      var view = document.querySelector(VIEW_SELECTOR);
      if (view && !view.hidden) {
        render();
      }
    });

  }


  function init() {
    if (state.ready) {
      bindFilterEvents();
      bindRootEvents();
      return;
    }

    ensureStyles();
    bindFilterEvents();
    bindRootEvents();
    bindLoginEvents();
    bindGlobalStateEvents();
    state.ready = true;

    var view = document.querySelector(VIEW_SELECTOR);
    if (view && !view.hidden) {
      render();
    }
  }


  window.XwendngaFavoritesUI = {
    init: init,
    render: render,
    setFilter: setFilter,
    getFilter: function () {
      return state.filter;
    }
  };


  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

})(window, document);
