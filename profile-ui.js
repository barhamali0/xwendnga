/* =========================================================
   XWENDNGA — PROFILE UI
   Phase 4B-6-C / Part 2
   Public Profile + My Profile Edit UI + My Profile renderer module
   ---------------------------------------------------------
   Scope:
   - Public Profile UI.
   - My Profile Edit UI / form interaction.
   - Auth Core / Session remain in script.js.
   - My Profile data writes use window.AppLib bridges.
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

  function renderPublicProfile(profile) {
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


  /* =========================================================
     MY PROFILE RENDERER — PHASE 4B-6-C / PART 2
     Main My Profile UI lives in this module.
     Auth Core / Session remain in script.js and are consumed
     through window.AppLib only.
     ========================================================= */

  function htmlEscape(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      }[char];
    });
  }

  function normalizeMyProfileUsername(value) {
    return String(value == null ? "" : value)
      .trim()
      .replace(/^@+/, "")
      .trim();
  }

  function getMyProfileData() {
    var api = appLib();
    var currentAuth = authState();

    if (!api || !currentAuth) {
      return {
        api: api,
        auth: currentAuth,
        books: [],
        music: []
      };
    }

    var bookItems = [];
    var musicItems = [];

    if (typeof api.getBooks === "function") {
      try {
        bookItems = api.getBooks();
      } catch (error) {
        console.warn("Xwendnga My Profile — getBooks:", error);
        bookItems = [];
      }
    }

    if (typeof api.getMusic === "function") {
      try {
        musicItems = api.getMusic();
      } catch (error) {
        console.warn("Xwendnga My Profile — getMusic:", error);
        musicItems = [];
      }
    }

    return {
      api: api,
      auth: currentAuth,
      books: Array.isArray(bookItems) ? bookItems : [],
      music: Array.isArray(musicItems) ? musicItems : []
    };
  }

  function myProfileUsage(items, userId) {
    if (!Array.isArray(items) || !userId) return 0;

    return items.filter(function (item) {
      return item &&
        String(item.ownerId || "") === String(userId) &&
        (item.status === "pending" || item.status === "approved");
    }).length;
  }

  function myProfileOwnedItems(items, userId) {
    if (!Array.isArray(items) || !userId) return [];

    return items.filter(function (item) {
      return item && String(item.ownerId || "") === String(userId);
    });
  }

  function myProfileStatusLabel(status) {
    if (status === "approved") return "پەسەندکراو";
    if (status === "rejected") return "ڕەتکراوە";
    return "چاوەڕوان";
  }

  function myProfileStatusClass(status) {
    if (status === "approved") return "is-approved";
    if (status === "rejected") return "is-rejected";
    return "is-pending";
  }

  function renderMyProfile() {
    var page = document.querySelector(
      "[data-app-view='profile'] .profile-page"
    );

    if (!page) return false;

    var data = getMyProfileData();
    var api = data.api;
    var currentAuth = data.auth;

    if (!currentAuth || !currentAuth.user) {
      page.innerHTML =
        '<div class="xwendnga-my-profile-hero profile-hero">' +
          '<div class="xwendnga-my-profile-avatar-wrap profile-avatar-wrap">' +
            '<div class="xwendnga-my-profile-avatar profile-avatar"><i class="fa-solid fa-user-lock"></i></div>' +
          '</div>' +
          '<div class="xwendnga-my-profile-intro profile-intro">' +
            '<div class="xwendnga-my-profile-kicker section-kicker">ACCOUNT</div>' +
            '<h2 class="xwendnga-my-profile-name section-title">هەژمارێکت دروست بکە</h2>' +
            '<p class="xwendnga-my-profile-welcome profile-welcome">بە Login ـکردن دڵخوازەکان و وشە خەزنکراوەکانت لەگەڵت لە هەموو ئامێرێک دەمێننەوە.</p>' +
          '</div>' +
        '</div>' +
        '<div class="xwendnga-my-profile-menu profile-menu">' +
          '<button class="xwendnga-my-profile-menu-item profile-menu-item" type="button" data-action="auth-login">' +
            '<span class="xwendnga-my-profile-menu-icon profile-menu-icon"><i class="fa-solid fa-right-to-bracket"></i></span>' +
            '<span class="xwendnga-my-profile-menu-copy profile-menu-copy"><strong>چوونەژوورەوە</strong><small>بچۆ ناو هەژمارەکەت</small></span>' +
            '<i class="xwendnga-my-profile-menu-arrow profile-menu-arrow fa-solid fa-chevron-left"></i>' +
          '</button>' +
          '<button class="xwendnga-my-profile-menu-item profile-menu-item" type="button" data-action="auth-signup">' +
            '<span class="xwendnga-my-profile-menu-icon profile-menu-icon"><i class="fa-solid fa-user-plus"></i></span>' +
            '<span class="xwendnga-my-profile-menu-copy profile-menu-copy"><strong>دروستکردنی هەژمار</strong><small>ئەکاونتێکی نوێ دروست بکە</small></span>' +
            '<i class="xwendnga-my-profile-menu-arrow profile-menu-arrow fa-solid fa-chevron-left"></i>' +
          '</button>' +
        '</div>';
      return true;
    }

    var profile = currentAuth.profile || {};
    var roleLabelValue = currentAuth.isAdmin
      ? "OWNER / ADMIN 👑"
      : (currentAuth.role === "premium" ? "PREMIUM" : "USER");

    var profileName = String(profile.display_name || "").trim() || "بێ ناو";
    var profileUsername = normalizeMyProfileUsername(profile.username || "");

    var planText = currentAuth.isAdmin
      ? "دەسەڵاتی تەواوی پلاتفۆرم"
      : currentAuth.role === "premium"
        ? (profile.premium_until
            ? "Premium ـی چالاک تا " + new Date(profile.premium_until).toLocaleDateString("ku-IQ")
            : "Premium ـی چالاک")
        : "سنووری نێردان: 3 کتێب + 5 موزیک";

    var bookLimit = currentAuth.isAdmin
      ? "∞"
      : (profile.book_limit != null ? profile.book_limit : "3");

    var musicLimit = currentAuth.isAdmin
      ? "∞"
      : (profile.music_limit != null ? profile.music_limit : "5");

    var userId = String(currentAuth.user.id || "");
    var bookUsage = myProfileUsage(data.books, userId);
    var musicUsage = myProfileUsage(data.music, userId);
    var myBooks = myProfileOwnedItems(data.books, userId);
    var myMusic = myProfileOwnedItems(data.music, userId);
    var favoriteCount = Object.keys(currentAuth.favorites || {}).length;
    var vocabCount = Array.isArray(currentAuth.savedWords)
      ? currentAuth.savedWords.length
      : 0;

    var avatarMarkup = profile.avatar_url
      ? '<img src="' + htmlEscape(profile.avatar_url) + '" alt="">'
      : '<i class="fa-solid ' + (currentAuth.isAdmin ? "fa-crown" : "fa-user") + '"></i>';

    page.innerHTML =
      '<div class="xwendnga-my-profile-hero profile-hero">' +
        '<div class="xwendnga-my-profile-avatar-wrap profile-avatar-wrap">' +
          '<div class="xwendnga-my-profile-avatar xwendnga-my-profile-avatar--public profile-public-avatar">' + avatarMarkup + '</div>' +
        '</div>' +
        '<div class="xwendnga-my-profile-intro profile-intro">' +
          '<div class="xwendnga-my-profile-kicker section-kicker">' + roleLabelValue + '</div>' +
          '<h2 class="xwendnga-my-profile-name section-title">' + htmlEscape(profileName) + '</h2>' +
          '<div class="xwendnga-my-profile-username profile-username">' +
            (profileUsername ? "@" + htmlEscape(profileUsername) : "@username") +
          '</div>' +
          '<p class="xwendnga-my-profile-welcome profile-welcome">' + planText + '</p>' +
        '</div>' +
      '</div>' +
      '<button class="xwendnga-my-profile-edit-button primary" type="button" data-action="edit-profile">' +
        '<i class="fa-solid fa-user-pen"></i> دەستکاریی پڕۆفایل' +
      '</button>' +
      '<div class="xwendnga-my-profile-usage">' +
        '<div class="xwendnga-my-profile-usage-grid">' +
          '<div class="xwendnga-my-profile-usage-card">' +
            '<small class="xwendnga-my-profile-usage-label">کتێب</small>' +
            '<strong class="xwendnga-my-profile-usage-value">' + bookUsage + ' / ' + bookLimit + '</strong>' +
          '</div>' +
          '<div class="xwendnga-my-profile-usage-card">' +
            '<small class="xwendnga-my-profile-usage-label">موزیک</small>' +
            '<strong class="xwendnga-my-profile-usage-value">' + musicUsage + ' / ' + musicLimit + '</strong>' +
          '</div>' +
        '</div>' +
        '<div class="xwendnga-my-profile-menu profile-menu">' +
          '<button class="xwendnga-my-profile-menu-item profile-menu-item" type="button" data-nav="favorites">' +
            '<span class="xwendnga-my-profile-menu-icon profile-menu-icon"><i class="fa-solid fa-heart"></i></span>' +
            '<span class="xwendnga-my-profile-menu-copy profile-menu-copy"><strong>دڵخوازەکانم</strong><small>' + favoriteCount + ' دانە</small></span>' +
            '<i class="xwendnga-my-profile-menu-arrow profile-menu-arrow fa-solid fa-chevron-left"></i>' +
          '</button>' +
          '<button class="xwendnga-my-profile-menu-item profile-menu-item" type="button" data-nav="vocab">' +
            '<span class="xwendnga-my-profile-menu-icon profile-menu-icon"><i class="fa-solid fa-language"></i></span>' +
            '<span class="xwendnga-my-profile-menu-copy profile-menu-copy"><strong>وشەکانم</strong><small>' + vocabCount + ' وشە</small></span>' +
            '<i class="xwendnga-my-profile-menu-arrow profile-menu-arrow fa-solid fa-chevron-left"></i>' +
          '</button>' +
          '<button class="xwendnga-my-profile-menu-item profile-menu-item" type="button" data-action="premium-info">' +
            '<span class="xwendnga-my-profile-menu-icon profile-menu-icon"><i class="fa-solid fa-crown"></i></span>' +
            '<span class="xwendnga-my-profile-menu-copy profile-menu-copy"><strong>' +
              (currentAuth.role === "premium" || currentAuth.isAdmin ? "پلانی ئێستا" : "Upgrade to Premium") +
            '</strong><small>' +
              (currentAuth.isAdmin ? "Owner" : currentAuth.role === "premium" ? "Premium" : "پارەدان بە دەستی لە Telegram") +
            '</small></span>' +
            '<i class="xwendnga-my-profile-menu-arrow profile-menu-arrow fa-solid fa-chevron-left"></i>' +
          '</button>' +
          (currentAuth.isAdmin
            ? '<button class="xwendnga-my-profile-menu-item profile-menu-item" type="button" data-action="owner-panel">' +
                '<span class="xwendnga-my-profile-menu-icon profile-menu-icon"><i class="fa-solid fa-crown"></i></span>' +
                '<span class="xwendnga-my-profile-menu-copy profile-menu-copy"><strong>پانێڵی بەڕێوەبەر</strong><small>کۆنترۆڵی هەموو پلاتفۆرم</small></span>' +
                '<i class="xwendnga-my-profile-menu-arrow profile-menu-arrow fa-solid fa-chevron-left"></i>' +
              '</button>'
            : "") +
          '<button class="xwendnga-my-profile-menu-item profile-menu-item" type="button" data-action="auth-signout">' +
            '<span class="xwendnga-my-profile-menu-icon profile-menu-icon"><i class="fa-solid fa-right-from-bracket"></i></span>' +
            '<span class="xwendnga-my-profile-menu-copy profile-menu-copy"><strong>دەرچوون</strong><small>لە هەژمارەکەت دەرچۆ</small></span>' +
            '<i class="xwendnga-my-profile-menu-arrow profile-menu-arrow fa-solid fa-chevron-left"></i>' +
          '</button>' +
        '</div>' +
        '<div class="xwendnga-my-profile-submissions">' +
          '<strong class="xwendnga-my-profile-submissions-title">ناوەڕۆکی من</strong>' +
          '<div class="xwendnga-my-profile-submissions-list" id="mySubmissionsList"></div>' +
        '</div>' +
      '</div>';

    var subBox = document.getElementById("mySubmissionsList");
    if (subBox) {
      var rows = [];

      myBooks.forEach(function (book) {
        var status = String(book.status || "pending").toLowerCase();
        rows.push(
          '<div class="xwendnga-my-profile-submission">' +
            '<span class="xwendnga-my-profile-submission-title">' +
              htmlEscape(book.title || "") +
            '</span>' +
            '<small class="xwendnga-my-profile-submission-status ' + myProfileStatusClass(status) + '">' +
              myProfileStatusLabel(status) +
            '</small>' +
          '</div>'
        );
      });

      myMusic.forEach(function (track) {
        var status = String(track.status || "pending").toLowerCase();
        rows.push(
          '<div class="xwendnga-my-profile-submission">' +
            '<span class="xwendnga-my-profile-submission-title">' +
              htmlEscape(track.name || "") +
            '</span>' +
            '<small class="xwendnga-my-profile-submission-status ' + myProfileStatusClass(status) + '">' +
              myProfileStatusLabel(status) +
            '</small>' +
          '</div>'
        );
      });

      subBox.innerHTML = rows.length
        ? rows.join("")
        : '<small class="xwendnga-my-profile-submissions-empty">هێشتا هیچ ناوەڕۆکێکت نەناردووە.</small>';
    }

    return true;
  }

  /* =========================================================
     MY PROFILE EDIT UI — PHASE 4B-6-C / PART 1
     UI and form interaction only.
     Auth Core / Session stay in script.js and are consumed
     through window.AppLib.
     ========================================================= */

  var editState = {
    ready: false,
    open: false,
    saving: false,
    requestToken: 0
  };

  var editRoot = null;
  var editBackdrop = null;
  var editSheet = null;
  var editForm = null;
  var editMessage = null;
  var editAvatar = null;
  var editCloseButton = null;

  function appLib() {
    return window.AppLib || null;
  }

  function authState() {
    var api = appLib();
    return api && api.authState ? api.authState : null;
  }

  function showProfileToast(message) {
    var toast = document.getElementById("toast");
    if (!toast) return;

    toast.textContent = String(message || "");
    toast.className = "toast show";

    clearTimeout(showProfileToast._timer);
    showProfileToast._timer = window.setTimeout(function () {
      toast.className = "toast";
    }, 2600);
  }

  function setProfileEditMessage(message) {
    if (!editMessage) return;
    editMessage.textContent = message || "";
  }

  function clearEditMessage() {
    setProfileEditMessage("");
  }

  function renderEditAvatar(url) {
    if (!editAvatar) return;

    var safe = safeUrl(url);
    while (editAvatar.firstChild) {
      editAvatar.removeChild(editAvatar.firstChild);
    }

    if (safe) {
      var image = createElement("img", null, {
        src: safe,
        alt: "",
        loading: "eager",
        referrerpolicy: "no-referrer"
      });
      editAvatar.appendChild(image);
    } else {
      var icon = createElement("i", null, {
        class: "fa-regular fa-user",
        "aria-hidden": "true"
      });
      editAvatar.appendChild(icon);
    }
  }

  function renderEditFilePreview(file) {
    if (!file || !editAvatar || !window.FileReader) return;

    var token = ++editState.requestToken;
    var reader = new FileReader();

    reader.onload = function () {
      if (token !== editState.requestToken) return;
      while (editAvatar.firstChild) {
        editAvatar.removeChild(editAvatar.firstChild);
      }

      var image = createElement("img", null, {
        src: String(reader.result || ""),
        alt: ""
      });
      editAvatar.appendChild(image);
    };

    reader.onerror = function () {
      if (token !== editState.requestToken) return;
      renderEditAvatar("");
    };

    reader.readAsDataURL(file);
  }

  function injectProfileEditUI() {
    if (editState.ready && editRoot) return;

    editRoot = createElement("div", "xwendnga-profile-edit-root");
    editRoot.id = "xwendngaProfileEditRoot";
    editRoot.setAttribute("aria-hidden", "true");

    editBackdrop = createElement("button", "xwendnga-profile-edit-backdrop", {
      type: "button",
      ariaLabel: "داخستن"
    });

    editSheet = createElement("section", "xwendnga-profile-edit-sheet", {
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": "xwendngaProfileEditTitle"
    });

    var handle = createElement("div", "xwendnga-profile-edit-handle", {
      "aria-hidden": "true"
    });

    var header = createElement("header", "xwendnga-profile-edit-head");

    var headerTitle = createElement("div", "xwendnga-profile-edit-head-title");

    var headerIcon = createElement("span", "xwendnga-profile-edit-head-icon", {
      "aria-hidden": "true"
    });
    headerIcon.innerHTML = '<i class="fa-solid fa-user-pen"></i>';

    var titleWrap = createElement("div");
    titleWrap.appendChild(createElement("div", "xwendnga-profile-edit-kicker", {
      text: "PROFILE"
    }));
    titleWrap.appendChild(createElement("h3", null, {
      text: "دەستکاریی پڕۆفایل",
      id: "xwendngaProfileEditTitle"
    }));

    headerTitle.appendChild(headerIcon);
    headerTitle.appendChild(titleWrap);

    editCloseButton = createElement("button", "xwendnga-profile-edit-close", {
      type: "button",
      ariaLabel: "داخستن"
    });
    editCloseButton.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';

    header.appendChild(headerTitle);
    header.appendChild(editCloseButton);

    editMessage = createElement("div", "xwendnga-profile-edit-message", {
      role: "status",
      "aria-live": "polite"
    });

    editForm = createElement("form", "xwendnga-profile-edit-form", {
      id: "xwendngaProfileEditForm"
    });

    var avatarRow = createElement("div", "xwendnga-profile-edit-avatar-row");
    editAvatar = createElement("div", "xwendnga-profile-edit-avatar", {
      "aria-hidden": "true"
    });

    var avatarFields = createElement("div", "xwendnga-profile-edit-avatar-fields");
    var avatarLabel = createElement("label", "xwendnga-profile-edit-field");
    avatarLabel.appendChild(createElement("span", null, {
      text: "وێنەی پڕۆفایل"
    }));

    var avatarInput = createElement("input", null, {
      id: "xwendngaProfileAvatarInput",
      type: "file",
      accept: "image/*"
    });
    avatarLabel.appendChild(avatarInput);

    avatarFields.appendChild(avatarLabel);
    avatarFields.appendChild(createElement("p", "xwendnga-profile-edit-help", {
      text: "وێنەیەکی خۆت هەڵبژێرە بۆ پڕۆفایل."
    }));

    avatarRow.appendChild(editAvatar);
    avatarRow.appendChild(avatarFields);
    editForm.appendChild(avatarRow);

    function addField(label, id, type, attrs) {
      var field = createElement("label", "xwendnga-profile-edit-field");
      field.appendChild(createElement("span", null, { text: label }));

      var input = createElement(
        type === "select" ? "select" : "input",
        null,
        Object.assign({ id: id }, attrs || {})
      );

      field.appendChild(input);
      editForm.appendChild(field);
      return input;
    }

    addField("ناو", "xwendngaProfileDisplayNameInput", "input", {
      type: "text",
      autocomplete: "name",
      maxlength: "80",
      placeholder: "ناوی تەواوی کەسەکە"
    });

    addField("ناوی بەکارهێنەر", "xwendngaProfileUsernameInput", "input", {
      type: "text",
      autocomplete: "username",
      maxlength: "30",
      placeholder: "@username",
      required: "required"
    });

    addField("ئیمەیڵ", "xwendngaProfileEmailInput", "input", {
      type: "email",
      readonly: "readonly",
      autocomplete: "email"
    });

    addField("ژمارەی مۆبایل", "xwendngaProfilePhoneInput", "input", {
      type: "tel",
      autocomplete: "tel",
      maxlength: "30",
      placeholder: "ئارەزوومەندانە"
    });

    addField("ڕۆژی لەدایکبوون", "xwendngaProfileBirthDateInput", "input", {
      type: "date"
    });

    var gender = addField("ڕەگەز", "xwendngaProfileGenderInput", "select");
    gender.appendChild(createElement("option", null, {
      value: "",
      text: "دیاری نەکراوە"
    }));
    gender.appendChild(createElement("option", null, {
      value: "نێر",
      text: "نێر"
    }));
    gender.appendChild(createElement("option", null, {
      value: "مێ",
      text: "مێ"
    }));

    var actions = createElement("div", "xwendnga-profile-edit-actions");

    var cancelButton = createElement("button", "xwendnga-profile-edit-button xwendnga-profile-edit-button-ghost", {
      type: "button",
      text: "پاشگەزبوونەوە"
    });

    var saveButton = createElement("button", "xwendnga-profile-edit-button xwendnga-profile-edit-button-primary", {
      type: "submit"
    });
    saveButton.innerHTML = '<i class="fa-solid fa-check"></i><span>پاشەکەوتکردن</span>';

    actions.appendChild(cancelButton);
    actions.appendChild(saveButton);
    editForm.appendChild(actions);

    editSheet.appendChild(handle);
    editSheet.appendChild(header);
    editSheet.appendChild(editMessage);
    editSheet.appendChild(editForm);

    editRoot.appendChild(editBackdrop);
    editRoot.appendChild(editSheet);
    document.body.appendChild(editRoot);

    avatarInput.addEventListener("change", function () {
      var file = avatarInput.files && avatarInput.files[0];
      if (!file) {
        var current = (authState() && authState().profile) || {};
        renderEditAvatar(current.avatar_url || "");
        return;
      }
      renderEditFilePreview(file);
    });

    editForm.addEventListener("submit", function (event) {
      event.preventDefault();
      saveProfileEdits();
    });

    cancelButton.addEventListener("click", closeProfileEdit);
    editCloseButton.addEventListener("click", closeProfileEdit);
    editBackdrop.addEventListener("click", closeProfileEdit);

    editState.ready = true;
    editState.open = false;
    renderEditAvatar("");
  }

  function renderProfileEditValues() {
    injectProfileEditUI();

    var api = appLib();
    var currentAuth = authState();

    if (!currentAuth || !currentAuth.user) return Promise.resolve(false);

    clearEditMessage();

    var fallbackProfile = currentAuth.profile || {};

    var setValues = function (profile) {
      var source = profile || fallbackProfile;

      renderEditAvatar(source.avatar_url || "");

      var displayName = document.getElementById("xwendngaProfileDisplayNameInput");
      var username = document.getElementById("xwendngaProfileUsernameInput");
      var email = document.getElementById("xwendngaProfileEmailInput");
      var phone = document.getElementById("xwendngaProfilePhoneInput");
      var birthDate = document.getElementById("xwendngaProfileBirthDateInput");
      var gender = document.getElementById("xwendngaProfileGenderInput");
      var avatarInput = document.getElementById("xwendngaProfileAvatarInput");

      if (displayName) displayName.value = source.display_name || "";
      if (username) username.value = source.username ? "@" + normalizeId(source.username).replace(/^@/, "") : "";
      if (email) email.value = currentAuth.user.email || "";
      if (phone) phone.value = source.phone || "";
      if (birthDate) birthDate.value = source.birth_date || "";
      if (gender) gender.value = source.gender || "";
      if (avatarInput) avatarInput.value = "";

      return true;
    };

    if (api && typeof api.getMyProfile === "function") {
      return Promise.resolve(api.getMyProfile())
        .then(function (profile) {
          return setValues(profile || fallbackProfile);
        })
        .catch(function () {
          return setValues(fallbackProfile);
        });
    }

    return Promise.resolve(setValues(fallbackProfile));
  }

  function openProfileEdit() {
    injectProfileEditUI();

    var currentAuth = authState();
    if (!currentAuth || !currentAuth.user) {
      return;
    }

    editState.open = true;
    editState.requestToken++;
    editRoot.classList.add("is-open");
    editRoot.setAttribute("aria-hidden", "false");
    document.body.classList.add("xwendnga-profile-edit-lock");

    renderProfileEditValues().then(function () {
      if (!editState.open) return;
      window.setTimeout(function () {
        if (editCloseButton) editCloseButton.focus();
      }, 30);
    });
  }

  function closeProfileEdit() {
    if (!editRoot) return;

    editState.open = false;
    editState.saving = false;
    editState.requestToken++;
    editRoot.classList.remove("is-open");
    editRoot.setAttribute("aria-hidden", "true");
    document.body.classList.remove("xwendnga-profile-edit-lock");
    clearEditMessage();
  }

  function saveProfileEdits() {
    if (editState.saving) return;

    var api = appLib();
    var currentAuth = authState();

    if (!api || !currentAuth || !currentAuth.user) {
      return;
    }

    if (
      typeof api.updateMyProfile !== "function" ||
      typeof api.uploadMyAvatar !== "function"
    ) {
      setProfileEditMessage("پەیوەندی پڕۆفایل بەردەست نییە.");
      return;
    }

    var displayName = String(
      (document.getElementById("xwendngaProfileDisplayNameInput") || {}).value || ""
    ).trim();

    var username = String(
      (document.getElementById("xwendngaProfileUsernameInput") || {}).value || ""
    ).trim();

    var phone = String(
      (document.getElementById("xwendngaProfilePhoneInput") || {}).value || ""
    ).trim();

    var birthDate = String(
      (document.getElementById("xwendngaProfileBirthDateInput") || {}).value || ""
    ).trim();

    var gender = String(
      (document.getElementById("xwendngaProfileGenderInput") || {}).value || ""
    ).trim();

    var usernameClean = username.replace(/^@+/, "").trim();

    if (!usernameClean) {
      setProfileEditMessage("ناوی بەکارهێنەر پێویستە.");
      return;
    }

    if (
      typeof usernameClean.normalize === "function"
    ) {
      usernameClean = usernameClean.normalize("NFKC");
    }

    var avatarInput = document.getElementById("xwendngaProfileAvatarInput");
    var file = avatarInput && avatarInput.files ? avatarInput.files[0] : null;

    editState.saving = true;
    setProfileEditMessage("خەریکی پاشەکەوتکردنی زانیارییەکانە...");

    var currentProfile = currentAuth.profile || {};
    var oldAvatarUrl = String(currentProfile.avatar_url || "").trim();

    var avatarPromise = file
      ? Promise.resolve(api.uploadMyAvatar(file)).then(function (result) {
          return String(result && result.url || "").trim();
        })
      : Promise.resolve(oldAvatarUrl);

    avatarPromise
      .then(function (avatarUrl) {
        return api.updateMyProfile({
          display_name: displayName,
          username: usernameClean,
          avatar_url: avatarUrl || oldAvatarUrl || "",
          phone: phone,
          birth_date: birthDate,
          gender: gender
        });
      })
      .then(function () {
        editState.saving = false;
        closeProfileEdit();

        renderMyProfile();

        showProfileToast("پڕۆفایل پاشەکەوت کرا");
      })
      .catch(function (error) {
        editState.saving = false;

        console.error("Xwendnga Profile UI — saveProfileEdits:", error);

        var message = String(error && error.message || "هەڵە");
        if (
          error &&
          (
            error.code === "23505" ||
            message.toLowerCase().indexOf("duplicate") >= 0
          )
        ) {
          setProfileEditMessage("ئەم ناوی بەکارهێنەرە پێشتر بەکارهاتووە.");
          return;
        }

        setProfileEditMessage(
          "پاشەکەوتکردن سەرکەوتوو نەبوو: " + message.slice(0, 120)
        );
      });
  }

  function handleProfileEditClick(event) {
    var target = event && event.target;
    if (!target || !target.closest) return;

    var action = target.closest("[data-action]");
    if (!action) return;

    var name = action.getAttribute("data-action");

    if (name === "edit-profile") {
      event.preventDefault();
      event.stopPropagation();
      openProfileEdit();
      return;
    }

    if (name === "close-profile-edit") {
      event.preventDefault();
      event.stopPropagation();
      closeProfileEdit();
    }
  }

  function handleProfileEditKeydown(event) {
    if (!editState.open) return;

    if (event.key === "Escape") {
      event.preventDefault();
      closeProfileEdit();
    }
  }

  function initMyProfileEditUI() {
    if (editState.ready) return;

    injectProfileEditUI();

    document.addEventListener("click", handleProfileEditClick, true);
    document.addEventListener("keydown", handleProfileEditKeydown);

    editState.ready = true;
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
        renderPublicProfile(profile);
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

    initMyProfileEditUI();

    state.ready = true;

    if (window.XwendngaApp && typeof window.XwendngaApp.getRoute === "function" && window.XwendngaApp.getRoute() === "profile") {
      renderMyProfile();
    }
  }

  window[MODULE_NAME] = {
    init: init,
    open: loadProfile,
    close: closeSheet,
    renderMyProfile: renderMyProfile,
    renderPublicProfile: renderPublicProfile,
    openMyProfileEdit: openProfileEdit,
    closeMyProfileEdit: closeProfileEdit,
    saveMyProfileEdits: saveProfileEdits,
    getEditState: function () {
      return {
        ready: editState.ready,
        open: editState.open,
        saving: editState.saving
      };
    },
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
