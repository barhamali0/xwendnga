/* =========================================================
   XWENDNGA — PROFILE UI
   Phase 4B-3
   Public Profile UI module
   ---------------------------------------------------------
   Scope:
   - Public Profile only in this phase.
   - No changes to script.js / search-ui.js are required.
   - My Profile integration is intentionally reserved for a later phase.
   ========================================================= */

(function (window, document) {
  "use strict";

  var MODULE_NAME = "XwendngaProfileUI";
  var ROOT_ID = "xwendngaPublicProfileRoot";

  var state = {
    ready: false,
    open: false,
    loading: false,
    error: null,
    profileId: "",
    requestToken: 0,
    profile: null
  };

  var root = null;
  var backdrop = null;
  var sheet = null;
  var content = null;
  var closeButton = null;

  function text(value, fallback) {
    var result = String(value == null ? "" : value).trim();
    return result || String(fallback == null ? "" : fallback);
  }

  function normalizeId(value) {
    return String(value == null ? "" : value).trim();
  }

  function safeUrl(value) {
    var url = String(value || "").trim();
    if (!url) return "";
    try {
      var parsed = new URL(url, window.location.href);
      if (parsed.protocol === "https:" || parsed.protocol === "http:") {
        return parsed.href;
      }
    } catch (e) {}
    return "";
  }

  function roleLabel(role) {
    var value = String(role || "user").trim().toLowerCase();
    if (value === "admin" || value === "owner") return "بەڕێوەبەر";
    if (value === "premium") return "Premium";
    return "ئەندام";
  }

  function roleClass(role) {
    var value = String(role || "user").trim().toLowerCase();
    if (value === "admin" || value === "owner") return "is-admin";
    if (value === "premium") return "is-premium";
    return "is-user";
  }

  function getBooks(profile) {
    return Array.isArray(profile && profile.books) ? profile.books : [];
  }

  function getMusic(profile) {
    return Array.isArray(profile && profile.music) ? profile.music : [];
  }

  function getItemTitle(item, fallback) {
    if (!item || typeof item !== "object") return fallback;
    return text(
      item.title || item.name || item.title_ku || item.title_en,
      fallback
    );
  }

  function getBookMeta(item) {
    if (!item || typeof item !== "object") return "";
    return text(item.author || item.author_name || item.writer || item.category, "");
  }

  function getMusicMeta(item) {
    if (!item || typeof item !== "object") return "";
    return text(item.artist || item.artist_name || item.author || item.category, "");
  }

  function createElement(tag, className, attrs) {
    var element = document.createElement(tag);
    if (className) element.className = className;

    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        var value = attrs[key];
        if (value == null) return;
        if (key === "text") element.textContent = value;
        else if (key === "html") element.innerHTML = value;
        else if (key === "ariaLabel") element.setAttribute("aria-label", value);
        else element.setAttribute(key, value);
      });
    }
    return element;
  }

  function clearContent() {
    if (!content) return;
    while (content.firstChild) content.removeChild(content.firstChild);
  }

  function renderFixedShell() {
    root = createElement("div", "xwendnga-public-profile-root");
    root.id = ROOT_ID;
    root.setAttribute("aria-hidden", "true");

    backdrop = createElement("button", "xwendnga-public-profile-backdrop", {
      type: "button",
      ariaLabel: "داخستن"
    });

    sheet = createElement("section", "xwendnga-public-profile-sheet", {
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": "xwendngaPublicProfileTitle"
    });

    var handle = createElement("div", "xwendnga-public-profile-handle", {
      "aria-hidden": "true"
    });

    var header = createElement("header", "xwendnga-public-profile-header");
    var headerTitle = createElement("div", "xwendnga-public-profile-header-title");
    var headerIcon = createElement("span", "xwendnga-public-profile-header-icon", {
      "aria-hidden": "true"
    });
    headerIcon.innerHTML = '<i class="fa-regular fa-user"></i>';

    var title = createElement("h2", null, {
      text: "پڕۆفایلی ئەندام",
      id: "xwendngaPublicProfileTitle"
    });

    closeButton = createElement("button", "xwendnga-public-profile-close", {
      type: "button",
      ariaLabel: "داخستن"
    });
    closeButton.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';

    headerTitle.appendChild(headerIcon);
    headerTitle.appendChild(title);
    header.appendChild(headerTitle);
    header.appendChild(closeButton);

    content = createElement("div", "xwendnga-public-profile-content");

    sheet.appendChild(handle);
    sheet.appendChild(header);
    sheet.appendChild(content);
    root.appendChild(backdrop);
    root.appendChild(sheet);
    document.body.appendChild(root);
  }

  function renderLoading() {
    clearContent();

    var hero = createElement("div", "xwendnga-public-profile-loading");
    hero.appendChild(createElement(
      "div",
      "xwendnga-public-profile-skeleton xwendnga-public-profile-skeleton-avatar"
    ));

    var lines = createElement("div", "xwendnga-public-profile-loading-lines");
    lines.appendChild(createElement(
      "div",
      "xwendnga-public-profile-skeleton xwendnga-public-profile-skeleton-title"
    ));
    lines.appendChild(createElement(
      "div",
      "xwendnga-public-profile-skeleton xwendnga-public-profile-skeleton-subtitle"
    ));
    hero.appendChild(lines);
    content.appendChild(hero);

    var stats = createElement("div", "xwendnga-public-profile-stats");
    [1, 2].forEach(function () {
      var stat = createElement(
        "div",
        "xwendnga-public-profile-stat xwendnga-public-profile-stat-skeleton"
      );
      stat.appendChild(createElement(
        "div",
        "xwendnga-public-profile-skeleton xwendnga-public-profile-skeleton-stat"
      ));
      stats.appendChild(stat);
    });
    content.appendChild(stats);

    var section = createElement("div", "xwendnga-public-profile-list-section");
    section.appendChild(createElement(
      "div",
      "xwendnga-public-profile-skeleton xwendnga-public-profile-skeleton-section"
    ));

    [1, 2, 3].forEach(function () {
      var card = createElement("div", "xwendnga-public-profile-content-skeleton-card");
      card.appendChild(createElement(
        "div",
        "xwendnga-public-profile-skeleton xwendnga-public-profile-skeleton-card-icon"
      ));
      card.appendChild(createElement(
        "div",
        "xwendnga-public-profile-skeleton xwendnga-public-profile-skeleton-card-text"
      ));
      section.appendChild(card);
    });
    content.appendChild(section);
  }

  function renderError(error) {
    clearContent();

    var wrapper = createElement(
      "div",
      "xwendnga-public-profile-state xwendnga-public-profile-state-error"
    );
    var icon = createElement("div", "xwendnga-public-profile-state-icon", {
      "aria-hidden": "true"
    });
    icon.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';

    wrapper.appendChild(icon);
    wrapper.appendChild(createElement("h3", null, {
      text: "نەتوانرا پڕۆفایلەکە بکرێتەوە"
    }));
    wrapper.appendChild(createElement("p", null, {
      text: text(
        error && error.message,
        "هەڵەیەک لە کاتی وەرگرتنی زانیارییەکانی پڕۆفایل ڕوویدا."
      )
    }));

    var retry = createElement(
      "button",
      "xwendnga-public-profile-action xwendnga-public-profile-action-primary",
      { type: "button", text: "دووبارە هەوڵدان" }
    );
    retry.addEventListener("click", function () {
      if (state.profileId) loadProfile(state.profileId);
    });
    wrapper.appendChild(retry);
    content.appendChild(wrapper);
  }

  function renderEmptyState(title, message, iconClass) {
    var wrapper = createElement("div", "xwendnga-public-profile-empty");
    var icon = createElement("div", "xwendnga-public-profile-empty-icon", {
      "aria-hidden": "true"
    });
    icon.innerHTML = '<i class="' + String(iconClass || "fa-regular fa-folder-open") + '"></i>';

    wrapper.appendChild(icon);
    wrapper.appendChild(createElement("h4", null, { text: title }));
    wrapper.appendChild(createElement("p", null, { text: message }));
    return wrapper;
  }

  function renderAvatar(profile) {
    var avatarWrap = createElement("div", "xwendnga-public-profile-avatar");
    var avatarUrl = safeUrl(profile && profile.avatar_url);
    var name = text(
      profile && profile.display_name,
      profile && profile.username ? profile.username : "بەکارهێنەر"
    );

    function fallback() {
      if (!avatarWrap) return;
      while (avatarWrap.firstChild) avatarWrap.removeChild(avatarWrap.firstChild);
      var element = createElement(
        "span",
        "xwendnga-public-profile-avatar-fallback",
        { "aria-hidden": "true" }
      );
      element.innerHTML = '<i class="fa-regular fa-user"></i>';
      avatarWrap.appendChild(element);
    }

    if (avatarUrl) {
      var image = createElement("img", null, {
        src: avatarUrl,
        alt: name,
        loading: "eager",
        referrerpolicy: "no-referrer"
      });
      image.addEventListener("error", fallback, { once: true });
      avatarWrap.appendChild(image);
    } else {
      fallback();
    }
    return avatarWrap;
  }

  function renderHero(profile) {
    var hero = createElement("div", "xwendnga-public-profile-hero");
    hero.appendChild(renderAvatar(profile));

    var identity = createElement("div", "xwendnga-public-profile-identity");
    var displayName = text(
      profile && profile.display_name,
      profile && profile.username ? profile.username : "بەکارهێنەر"
    );
    identity.appendChild(createElement("h3", "xwendnga-public-profile-name", {
      text: displayName
    }));

    var username = normalizeId(profile && profile.username);
    if (username) {
      identity.appendChild(createElement("div", "xwendnga-public-profile-username", {
        text: "@" + username.replace(/^@/, "")
      }));
    }

    var role = text(profile && profile.role, "user");
    identity.appendChild(createElement(
      "span",
      "xwendnga-public-profile-role " + roleClass(role),
      { text: roleLabel(role) }
    ));

    hero.appendChild(identity);
    return hero;
  }

  function renderStats(profile) {
    var books = getBooks(profile);
    var music = getMusic(profile);
    var stats = createElement("div", "xwendnga-public-profile-stats");

    var bookStat = createElement("div", "xwendnga-public-profile-stat");
    bookStat.appendChild(createElement("strong", null, { text: String(books.length) }));
    bookStat.appendChild(createElement("span", null, { text: "کتێب" }));

    var musicStat = createElement("div", "xwendnga-public-profile-stat");
    musicStat.appendChild(createElement("strong", null, { text: String(music.length) }));
    musicStat.appendChild(createElement("span", null, { text: "موزیک" }));

    stats.appendChild(bookStat);
    stats.appendChild(musicStat);
    return stats;
  }

  function renderBookCard(item) {
    var card = createElement("article", "xwendnga-public-profile-content-card");
    var icon = createElement("span", "xwendnga-public-profile-content-icon", {
      "aria-hidden": "true"
    });
    icon.innerHTML = '<i class="fa-solid fa-book-open"></i>';

    var body = createElement("div", "xwendnga-public-profile-content-body");
    body.appendChild(createElement("strong", null, {
      text: getItemTitle(item, "کتێبی بێ ناو")
    }));

    var meta = getBookMeta(item);
    if (meta) body.appendChild(createElement("small", null, { text: meta }));

    card.appendChild(icon);
    card.appendChild(body);
    return card;
  }

  function renderMusicCard(item) {
    var card = createElement("article", "xwendnga-public-profile-content-card");
    var icon = createElement(
      "span",
      "xwendnga-public-profile-content-icon xwendnga-public-profile-content-icon-music",
      { "aria-hidden": "true" }
    );
    icon.innerHTML = '<i class="fa-solid fa-music"></i>';

    var body = createElement("div", "xwendnga-public-profile-content-body");
    body.appendChild(createElement("strong", null, {
      text: getItemTitle(item, "موزیکی بێ ناو")
    }));

    var meta = getMusicMeta(item);
    if (meta) body.appendChild(createElement("small", null, { text: meta }));

    card.appendChild(icon);
    card.appendChild(body);
    return card;
  }

  function renderContentSection(title, items, type) {
    var section = createElement("section", "xwendnga-public-profile-list-section");
    var heading = createElement("div", "xwendnga-public-profile-section-heading");

    heading.appendChild(createElement("h4", null, { text: title }));
    heading.appendChild(createElement("span", "xwendnga-public-profile-section-count", {
      text: String(items.length)
    }));
    section.appendChild(heading);

    if (!items.length) {
      section.appendChild(renderEmptyState(
        type === "books" ? "کتێب نییە" : "موزیک نییە",
        type === "books"
          ? "ئەم ئەندامە هێشتا کتێبێکی گشتی نییە."
          : "ئەم ئەندامە هێشتا موزیکێکی گشتی نییە.",
        type === "books" ? "fa-solid fa-book-open" : "fa-solid fa-music"
      ));
      return section;
    }

    var list = createElement("div", "xwendnga-public-profile-content-list");
    items.slice(0, 20).forEach(function (item) {
      list.appendChild(type === "books" ? renderBookCard(item) : renderMusicCard(item));
    });
    section.appendChild(list);
    return section;
  }

  function renderProfile(profile) {
    clearContent();
    content.appendChild(renderHero(profile));
    content.appendChild(renderStats(profile));
    content.appendChild(renderContentSection(
      "کتێبە گشتییەکان",
      getBooks(profile),
      "books"
    ));
    content.appendChild(renderContentSection(
      "موزیکە گشتییەکان",
      getMusic(profile),
      "music"
    ));
  }

  function setOpenClasses(open) {
    if (!root) return;
    root.classList.toggle("is-open", open);
    root.setAttribute("aria-hidden", open ? "false" : "true");
    document.body.classList.toggle("xwendnga-public-profile-lock", open);
  }

  function openSheet() {
    if (!root) return;
    state.open = true;
    setOpenClasses(true);
    window.setTimeout(function () {
      if (closeButton) closeButton.focus();
    }, 30);
  }

  function closeSheet() {
    if (!root) return;
    state.open = false;
    setOpenClasses(false);
    state.loading = false;
    state.error = null;
  }

  function loadProfile(profileId) {
    var id = normalizeId(profileId);
    if (!id) {
      state.error = new Error("ناسنامەی پڕۆفایل دیاری نەکراوە");
      renderError(state.error);
      openSheet();
      return;
    }

    var token = ++state.requestToken;
    state.profileId = id;
    state.loading = true;
    state.error = null;
    state.profile = null;

    renderLoading();
    openSheet();

    if (!window.AppLib || typeof window.AppLib.getPublicProfile !== "function") {
      state.loading = false;
      state.error = new Error("Data Layer ـی پڕۆفایلی گشتی بەردەست نییە.");
      renderError(state.error);
      return;
    }

    Promise.resolve()
      .then(function () {
        return window.AppLib.getPublicProfile(id);
      })
      .then(function (profile) {
        if (token !== state.requestToken || !state.open) return;
        if (!profile) throw new Error("پڕۆفایلی گشتی نەدۆزرایەوە");

        state.loading = false;
        state.error = null;
        state.profile = profile;
        renderProfile(profile);
      })
      .catch(function (error) {
        if (token !== state.requestToken) return;
        state.loading = false;
        state.error = error || new Error("هەڵەیەک ڕوویدا");
        renderError(state.error);
      });
  }

  function handleProfileOpen(event) {
    var detail = event && event.detail ? event.detail : null;
    var id = "";

    if (detail && typeof detail === "object") {
      id = normalizeId(detail.id || detail.profile_id || detail.user_id);
    } else {
      id = normalizeId(detail);
    }

    if (!id) {
      renderError(new Error("ناسنامەی ئەندام نەدۆزرایەوە"));
      openSheet();
      return;
    }

    loadProfile(id);
  }

  function handleKeydown(event) {
    if (!state.open) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeSheet();
    }
  }

  function init() {
    if (state.ready) return;
    if (!document.body) {
      window.setTimeout(init, 0);
      return;
    }

    renderFixedShell();
    closeButton.addEventListener("click", closeSheet);
    backdrop.addEventListener("click", closeSheet);
    document.addEventListener("keydown", handleKeydown);
    window.addEventListener("xwendnga:profile-open", handleProfileOpen);
    state.ready = true;
  }

  window[MODULE_NAME] = {
    init: init,
    open: loadProfile,
    close: closeSheet,
    getState: function () {
      return {
        ready: state.ready,
        open: state.open,
        loading: state.loading,
        profileId: state.profileId,
        profile: state.profile
      };
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})(window, document);
