/* ======================================================
   XWENDNGA — GLOBAL SEARCH UI
   Phase 4A-3 (Production Ready & Polished)
   ====================================================== */

(function () {
  "use strict";

  var SUPABASE_URL = "https://nretwjagqnisyihtuwwn.supabase.co";
  var SUPABASE_KEY = "sb_publishable_603X2LJm3l-diUOPeXqyPQ_NkrIiD7M";
  var sbClient = null;

  var state = {
    ready: false,
    filter: "all",
    query: "",
    results: { cinema: [], books: [], music: [], members: [] },
    counts: { cinema: 0, books: 0, music: 0, members: 0 },
    timer: null,
    requestId: 0
  };

  var DEBOUNCE_MS = 250;

  function getInput() { return document.getElementById("globalSearchInput"); }
  function getRoot() { return document.getElementById("globalSearchFilters"); }
  function getResults() { return document.getElementById("globalSearchResults"); }

  function normalize(value) {
    return String(value == null ? "" : value).toLowerCase().trim();
  }

  function escapeHTML(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getSupabaseClient() {
    if (!sbClient && window.supabase && typeof window.supabase.createClient === "function") {
      sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
    return sbClient;
  }

  function getCinemaItems() {
    try {
      if (window.XwendngaCinemaUI && typeof window.XwendngaCinemaUI.getItems === "function") {
        var items = window.XwendngaCinemaUI.getItems();
        return Array.isArray(items) ? items.slice() : [];
      }
    } catch (e) { console.warn("Xwendnga Search: cinema source failed.", e); }
    return [];
  }

  function getBooks() {
    try {
      if (window.AppLib && typeof window.AppLib.getBooks === "function") {
        var books = window.AppLib.getBooks();
        return Array.isArray(books) ? books.slice() : [];
      }
    } catch (e) { console.warn("Xwendnga Search: books source failed.", e); }
    return [];
  }

  function getMusic() {
    try {
      if (window.AppLib && typeof window.AppLib.getMusic === "function") {
        var music = window.AppLib.getMusic();
        return Array.isArray(music) ? music.slice() : [];
      }
    } catch (e) { console.warn("Xwendnga Search: music source failed.", e); }
    return [];
  }

  async function getMembers(query) {
    try {
      var client = getSupabaseClient();
      if (!query || !client) return [];

      var safeQuery = String(query).replace(/[%_,]/g, "").trim();
      if (!safeQuery) return [];

      var response = await client
        .from("profiles")
        .select("id, display_name, username, avatar_url")
        .or("display_name.ilike.%" + safeQuery + "%,username.ilike.%" + safeQuery + "%")
        .limit(20);

      if (response && response.error) {
        return [];
      }
      return response && Array.isArray(response.data) ? response.data : [];
    } catch (e) {
      return [];
    }
  }

  function itemText(item, fields) {
    return fields.map(function (key) { return item && item[key]; }).filter(Boolean).join(" ");
  }

  function filterItems(items, fields, query) {
    var q = normalize(query);
    if (!q) return [];
    return items.filter(function (item) {
      return normalize(itemText(item, fields)).indexOf(q) !== -1;
    });
  }

  function getId(item) {
    return item && (item.id || item.book_id || item.music_id || item.content_id);
  }

  function getImage(item) {
    return item && (
      item.poster_url || item.poster || item.cover_url || item.cover ||
      item.image_url || item.avatar_url || item.thumbnail_url || ""
    );
  }

  function titleFor(item) {
    return (item && (
      item.title_ku || item.title_en || item.title || item.name || ""
    ));
  }

  function updateCounts() {
    var root = getRoot();
    if (!root) return;

    var counts = state.counts;
    root.querySelectorAll("[data-search-filter]").forEach(function (button) {
      var filter = button.getAttribute("data-search-filter") || "all";
      var count = filter === "all"
        ? counts.cinema + counts.books + counts.music + counts.members
        : (Object.prototype.hasOwnProperty.call(counts, filter) ? counts[filter] : 0);

      var span = button.querySelector("span");
      if (span) {
        if (!button.dataset.baseLabel) {
          button.dataset.baseLabel = span.textContent.replace(/\s*\(\d+\)\s*$/, "").trim();
        }
        span.textContent = button.dataset.baseLabel + (count > 0 ? " (" + count + ")" : "");
      }
    });
  }

  function setActiveFilter(filter, button) {
    var root = getRoot();
    if (!root || !button) return;

    state.filter = filter || "all";

    root.querySelectorAll("[data-search-filter]").forEach(function (item) {
      var active = item === button;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-selected", active ? "true" : "false");
    });

    var results = getResults();
    if (results) results.setAttribute("data-search-results", state.filter);

    renderResults();

    window.dispatchEvent(new CustomEvent("xwendnga:search-filter-change", {
      detail: { filter: state.filter }
    }));
  }

  function imageMarkup(url, alt, className) {
    if (!url) return '<div class="' + className + ' xwendnga-search-placeholder"><i class="fa-solid fa-image"></i></div>';
    return '<img class="' + className + '" src="' + escapeHTML(url) +
      '" alt="' + escapeHTML(alt) + '" loading="lazy" onerror="this.style.display=\'none\'">';
  }

  function renderCinemaCard(item) {
    var id = getId(item), title = titleFor(item);
    var sub = item.year || (item.type === "movie" ? "فیلم" : "زنجیرە");
    return '<button type="button" class="xwendnga-search-card" ' +
      'data-search-action="cinema" data-id="' + escapeHTML(id || "") + '">' +
      imageMarkup(getImage(item), title, "xwendnga-search-poster") +
      '<span class="xwendnga-search-card-body"><strong class="xwendnga-search-card-title">' +
      escapeHTML(title) + '</strong><small class="xwendnga-search-card-meta">' + escapeHTML(sub) + '</small></span></button>';
  }

  function renderBookCard(item) {
    var id = getId(item), title = titleFor(item);
    var author = item.author || "نووسەری نەزانراو";
    return '<button type="button" class="xwendnga-search-card" ' +
      'data-search-action="book" data-id="' + escapeHTML(id || "") + '">' +
      imageMarkup(getImage(item), title, "xwendnga-search-cover") +
      '<span class="xwendnga-search-card-body"><strong class="xwendnga-search-card-title">' +
      escapeHTML(title) + '</strong><small class="xwendnga-search-card-meta">' + escapeHTML(author) + '</small></span></button>';
  }

  function renderMusicCard(item) {
    var title = titleFor(item);
    var artist = item && (item.artist || item.artist_name || item.author || "موزیک");
    return '<div class="xwendnga-search-card">' +
      imageMarkup(getImage(item), title, "xwendnga-search-music-art") +
      '<span class="xwendnga-search-card-body"><strong class="xwendnga-search-card-title">' +
      escapeHTML(title) + '</strong><small class="xwendnga-search-card-meta">' +
      escapeHTML(artist) + '</small></span></div>';
  }

  function renderMemberCard(item) {
    var displayName = item && item.display_name || item.username || "بەکارهێنەر";
    var username = item && item.username ? "@" + item.username.replace(/^@/, "") : "";
    return '<button type="button" class="xwendnga-search-card xwendnga-search-card-member" ' +
      'data-search-action="member" data-id="' + escapeHTML(item && item.id || "") + '">' +
      imageMarkup(item && item.avatar_url, displayName, "xwendnga-search-avatar") +
      '<span class="xwendnga-search-card-body"><strong class="xwendnga-search-card-title">' +
      escapeHTML(displayName) + '</strong>' +
      (username ? '<small class="xwendnga-search-card-meta" style="direction:ltr;text-align:right;color:var(--a);">' +
        escapeHTML(username) + '</small>' : "") +
      '</span></button>';
  }

  function renderSection(title, items, renderer, type) {
    if (!items.length) return "";
    return '<section class="xwendnga-search-section" data-search-section="' + type + '">' +
      '<div class="xwendnga-search-section-head"><h3 class="xwendnga-search-section-title">' + escapeHTML(title) + '</h3><span>' + items.length + '</span></div>' +
      '<div class="xwendnga-search-grid">' + items.map(renderer).join("") + '</div></section>';
  }

  function renderEmptyState(isInitial) {
    if (isInitial) {
      return '<div class="xwendnga-search-empty"><div class="xwendnga-search-empty-icon"><i class="fa-solid fa-magnifying-glass"></i></div><h3>لە خوێندنگەدا بگەڕێ</h3><p>وشە یان ناوی شتێک بنووسە بۆ دۆزینەوەی ئەنجامەکان.</p></div>';
    }
    return '<div class="xwendnga-search-empty"><div class="xwendnga-search-empty-icon"><i class="fa-solid fa-circle-exclamation"></i></div><h3>هیچ ئەنجامێک نەدۆزرایەوە</h3><p>دڵنیابەرەوە لە ڕاستی و دروستیی وشەکان.</p></div>';
  }

  function renderResults() {
    var target = getResults();
    if (!target) return;
    if (!state.query) {
      target.innerHTML = renderEmptyState(true);
      return;
    }

    var html = "";
    if (state.filter === "all" || state.filter === "cinema")
      html += renderSection("سینەما", state.results.cinema, renderCinemaCard, "cinema");
    if (state.filter === "all" || state.filter === "books")
      html += renderSection("کتێب", state.results.books, renderBookCard, "books");
    if (state.filter === "all" || state.filter === "music")
      html += renderSection("موزیک", state.results.music, renderMusicCard, "music");
    if (state.filter === "all" || state.filter === "members")
      html += renderSection("ئەندامان", state.results.members, renderMemberCard, "members");

    target.innerHTML = html || renderEmptyState(false);
  }

  function openCinema(item) {
    try {
      if (window.AppLib && typeof window.AppLib.openCinema === "function") {
        window.AppLib.openCinema(item);
        return;
      }

      console.warn("Xwendnga Search: AppLib.openCinema is unavailable.");
    } catch (e) {
      console.warn("Xwendnga Search: cinema open failed.", e);
    }
  }

  function openBook(item) {
    try {
      if (window.AppLib && typeof window.AppLib.openBook === "function")
        window.AppLib.openBook(getId(item));
    } catch (e) { console.warn("Xwendnga Search: book open failed.", e); }
  }

  function handleAction(event) {
    var card = event.target.closest("[data-search-action]");
    var target = getResults();
    if (!card || !target || !target.contains(card)) return;

    var action = card.getAttribute("data-search-action");
    var id = card.getAttribute("data-id") || "";

    if (action === "cinema") {
      var cinema = state.results.cinema.find(function (item) {
        return String(getId(item) || "") === String(id);
      });
      if (cinema) openCinema(cinema);
    } else if (action === "book") {
      var book = state.results.books.find(function (item) {
        return String(getId(item) || "") === String(id);
      });
      if (book) openBook(book);
    } else if (action === "member") {
      var member = state.results.members.find(function (item) {
        return String(item && item.id || "") === String(id);
      });
      if (member) {
        window.dispatchEvent(new CustomEvent("xwendnga:profile-open", { detail: member }));
      }
    }
  }

  async function runSearch(query) {
    var requestId = ++state.requestId;
    state.query = String(query || "").trim();

    if (!state.query) {
      state.results = { cinema: [], books: [], music: [], members: [] };
      state.counts = { cinema: 0, books: 0, music: 0, members: 0 };
      updateCounts();
      renderResults();
      return;
    }

    var cinema = filterItems(getCinemaItems(), ["title_ku", "title_en", "title", "name", "original_title", "description"], state.query);
    var books = filterItems(getBooks(), ["title", "name", "author", "category", "description"], state.query);
    var music = filterItems(getMusic(), ["title", "name", "artist", "category"], state.query);
    var members = await getMembers(state.query);

    if (requestId !== state.requestId) return;

    state.results = { cinema: cinema, books: books, music: music, members: members };
    state.counts = {
      cinema: cinema.length,
      books: books.length,
      music: music.length,
      members: members.length
    };

    updateCounts();
    renderResults();
  }

  function scheduleSearch() {
    var input = getInput();
    if (!input) return;
    clearTimeout(state.timer);
    state.timer = setTimeout(function () { runSearch(input.value); }, DEBOUNCE_MS);
  }

  function bind() {
    var root = getRoot(), input = getInput(), results = getResults();
    if (state.ready || !root || !input) return;

    state.ready = true;
    input.addEventListener("input", scheduleSearch);

    root.addEventListener("click", function (event) {
      var button = event.target.closest("[data-search-filter]");
      if (!button || !root.contains(button)) return;
      setActiveFilter(button.getAttribute("data-search-filter") || "all", button);
    });

    if (results) results.addEventListener("click", handleAction);

    var initial = root.querySelector('[data-search-filter="' + state.filter + '"]');
    if (initial) setActiveFilter(state.filter, initial);
    scheduleSearch();
  }

  function init() {
    if (document.readyState === "loading")
      document.addEventListener("DOMContentLoaded", bind, { once: true });
    else bind();
  }

  window.XwendngaSearchUI = {
    init: init,
    getFilter: function () { return state.filter; },
    search: runSearch
  };

  init();
})();

/* Phase 4A-3 Modern Responsive Cards CSS */
(function () {
  if (document.getElementById("xwendnga-search-cards-style")) return;
  var css = document.createElement("style");
  css.id = "xwendnga-search-cards-style";
  css.textContent = `
#globalSearchResults{width:100%;box-sizing:border-box}
.xwendnga-search-section{width:100%;margin:1.2rem 0}
.xwendnga-search-section-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:.8rem}
.xwendnga-search-section-title{margin:0;font-size:15px;font-weight:800;color:#fff}
.xwendnga-search-section-head span{font-size:11px;color:var(--muted);background:rgba(255,255,255,.06);padding:2px 8px;border-radius:12px}
.xwendnga-search-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:.85rem}
.xwendnga-search-card{min-width:0;width:100%;box-sizing:border-box;border:1px solid rgba(255,255,255,.07);padding:8px;border-radius:16px;background:var(--surface2,#182943);text-align:right;cursor:pointer;overflow:hidden;display:flex;flex-direction:column;gap:6px;transition:transform .16s ease}
.xwendnga-search-card:active{transform:scale(0.97)}
.xwendnga-search-poster,.xwendnga-search-cover{width:100%;aspect-ratio:2/3;object-fit:cover;border-radius:10px;background:#0b1727;display:block}
.xwendnga-search-avatar{width:46px;height:46px;flex:0 0 46px;object-fit:cover;border-radius:14px;background:linear-gradient(135deg,var(--a),var(--b));display:block}
.xwendnga-search-music-art{width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:10px;background:#0b1727;display:block}
.xwendnga-search-card-member{flex-direction:row;align-items:center;gap:12px;padding:10px}
.xwendnga-search-card-body{min-width:0;display:flex;flex-direction:column;gap:2px}
.xwendnga-search-card-title,.xwendnga-search-card-meta{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.xwendnga-search-card-title{font-size:12px;font-weight:700;color:#fff}
.xwendnga-search-card-meta{color:var(--muted);font-size:10px}
.xwendnga-search-placeholder{width:100%;aspect-ratio:2/3;background:rgba(255,255,255,.04);border-radius:10px;display:grid;place-items:center;color:rgba(255,255,255,.2)}
@media(max-width:640px){.xwendnga-search-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:.65rem}}
`;
  document.head.appendChild(css);
})();
