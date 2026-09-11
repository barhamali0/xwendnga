(function () {
  "use strict";

  /* =======================================================
     XWENDNGA APP ROUTER
     - Hash based SPA navigation
     - Keeps reader.js independent
     - Coordinates safely with script.js
     - Supports mobile Back / Forward
     ======================================================= */

  var DEFAULT_ROUTE = "home";

  var ROUTES = {
    home: {
      title: "سەرەکی"
    },

    library: {
      title: "کتێبخانە"
    },

    search: {
      title: "گەڕان"
    },

    cartoons: {
      title: "کارتۆن"
    },

    profile: {
      title: "پڕۆفایل"
    },

    settings: {
      title: "ڕێکخستنەکان"
    },

    favorites: {
      title: "دڵخواز"
    },

    vocab: {
      title: "وشەکانم"
    }
  };

  var state = {
    current: null,
    ready: false,
    ignoreNextLegacyNavigation: false,
    notificationOpen: false
  };


  /* =======================================================
     ROUTE HELPERS
     ======================================================= */

  function normalizeRoute(value) {
    var route = String(value || "")
      .replace(/^#/, "")
      .trim()
      .toLowerCase();

    if (!route) {
      return DEFAULT_ROUTE;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        ROUTES,
        route
      )
    ) {
      return route;
    }

    return DEFAULT_ROUTE;
  }


  function getRouteFromHash() {
    return normalizeRoute(
      window.location.hash
    );
  }


  function setHash(route, replace) {
    var next = normalizeRoute(route);
    var hash = "#" + next;

    if (replace) {
      if (window.location.hash !== hash) {
        window.history.replaceState(
          {
            xwendngaRoute: next
          },
          "",
          hash
        );
      }

      return next;
    }

    if (window.location.hash !== hash) {
      window.location.hash = hash;
    }

    return next;
  }


  /* =======================================================
     VIEW HELPERS
     ======================================================= */

  function getAllViews() {
    return Array.prototype.slice.call(
      document.querySelectorAll(
        "[data-app-view]"
      )
    );
  }


  function showViews(route) {
    var views = getAllViews();

    if (!views.length) {
      return false;
    }

    views.forEach(function (view) {
      var name = normalizeRoute(
        view.getAttribute(
          "data-app-view"
        )
      );

      var active = name === route;

      view.hidden = !active;

      view.classList.toggle(
        "active",
        active
      );

      view.setAttribute(
        "aria-hidden",
        active ? "false" : "true"
      );
    });

    return true;
  }


  function updateNavigation(route) {
    document
      .querySelectorAll(
        ".nav[data-nav], .desktop-link[data-nav], [data-nav-role='nav']"
      )
      .forEach(function (item) {
        var itemRoute = normalizeRoute(
          item.getAttribute("data-nav")
        );

        var active = itemRoute === route;

        item.classList.toggle(
          "active",
          active
        );

        if (active) {
          item.setAttribute(
            "aria-current",
            "page"
          );
        } else {
          item.removeAttribute(
            "aria-current"
          );
        }
      });
  }


  function updateTitle(route) {
    var title = ROUTES[route]
      ? ROUTES[route].title
      : ROUTES[DEFAULT_ROUTE].title;

    var titleElement =
      document.querySelector(
        "[data-app-title]"
      );

    if (titleElement) {
      titleElement.textContent = title;
    }

    document.title =
      title +
      " — خوێندنگە";
  }


  /* =======================================================
     LEGACY SCRIPT.JS COORDINATION
     ======================================================= */

  function dispatchLegacyNavigation(route) {
    var navigation =
      document.querySelector(
        "[data-nav='" +
          route.replace(/"/g, '\\"') +
          "']"
      );

    if (!navigation) {
      return;
    }

    state.ignoreNextLegacyNavigation =
      true;

    try {
      navigation.click();
    } finally {
      state.ignoreNextLegacyNavigation =
        false;
    }
  }


  function fireInput(input, value) {
    if (!input) {
      return;
    }

    input.value = value;

    try {
      input.dispatchEvent(
        new Event(
          "input",
          {
            bubbles: true
          }
        )
      );
    } catch (error) {
      var event =
        document.createEvent(
          "Event"
        );

      event.initEvent(
        "input",
        true,
        true
      );

      input.dispatchEvent(
        event
      );
    }
  }


  function syncLegacyBookList(filterMode) {
    var searchInput =
      document.getElementById(
        "searchInput"
      );

    if (!searchInput) {
      return;
    }

    if (
      filterMode ===
      "favorites"
    ) {
      dispatchLegacyNavigation(
        "favorites"
      );

      return;
    }

    if (
      filterMode ===
      "vocab"
    ) {
      dispatchLegacyNavigation(
        "vocab"
      );

      return;
    }

    fireInput(
      searchInput,
      ""
    );
  }


  function syncSearchResults() {
    var source =
      document.getElementById(
        "bookList"
      );

    var target =
      document.getElementById(
        "globalSearchResults"
      );

    if (!source || !target) {
      return;
    }

    target.innerHTML =
      source.innerHTML;
  }


  function openSearchWithValue(
    value
  ) {
    var text =
      String(
        value || ""
      ).trim();

    navigate(
      "search"
    );

    window.setTimeout(
      function () {
        var globalInput =
          document.getElementById(
            "globalSearchInput"
          );

        var localInput =
          document.getElementById(
            "searchInput"
          );

        if (globalInput) {
          globalInput.focus();

          if (text) {
            globalInput.value =
              text;
          }
        }

        if (localInput) {
          fireInput(
            localInput,
            text
          );
        }

        syncSearchResults();
      },
      0
    );
  }


  function runRouteHooks(route) {
    /*
     * The existing script.js continues to own
     * actual book/vocabulary rendering.
     * app.js only coordinates the correct view.
     */

    if (
      route ===
      "favorites"
    ) {
      dispatchLegacyNavigation(
        "favorites"
      );
    } else if (
      route ===
      "vocab"
    ) {
      dispatchLegacyNavigation(
        "vocab"
      );
    } else if (
      route ===
      "home" ||
      route ===
      "library"
    ) {
      syncLegacyBookList(
        "all"
      );
    }


    if (
      route ===
      "search"
    ) {
      syncSearchResults();

      window.setTimeout(
        syncSearchResults,
        0
      );
    }


    if (
      route ===
        "profile" &&
      typeof window.renderProfile ===
        "function"
    ) {
      try {
        window.renderProfile();
      } catch (error) {
        console.error(
          "Xwendnga profile view error:",
          error
        );
      }
    }


    if (
      route ===
        "settings" &&
      typeof window.renderSettingsPage ===
        "function"
    ) {
      try {
        window.renderSettingsPage();
      } catch (error) {
        console.error(
          "Xwendnga settings view error:",
          error
        );
      }
    }
  }


  /* =======================================================
     READER SAFETY
     ======================================================= */

  function readerIsOpen() {
    var reader =
      document.getElementById(
        "reader"
      );

    return !!(
      reader &&
      reader.classList.contains(
        "show"
      )
    );
  }


  function closeReaderSafely() {
    if (!readerIsOpen()) {
      return;
    }

    if (
      window.ReaderEngine &&
      typeof window.ReaderEngine.close ===
        "function"
    ) {
      try {
        window.ReaderEngine.close();
      } catch (error) {
        console.error(
          "Xwendnga reader close error:",
          error
        );
      }
    }
  }


  /* =======================================================
     NOTIFICATIONS
     ======================================================= */

  function getNotifications() {
    var fallback = [
      {
        id: "welcome",

        title:
          "بەخێربێیت بۆ خوێندنگە",

        text:
          "کاتێک ناوەڕۆکی نوێ زیاد بکرێت، ئاگاداریت دەکەینەوە.",

        time:
          "ئێستا",

        read:
          true
      }
    ];

    try {
      var saved =
        localStorage.getItem(
          "xwendnga_notifications"
        );

      if (!saved) {
        return fallback;
      }

      /*
       * One-time cleanup for the old broken-encoding
       * notification data. If the stored value contains
       * common mojibake markers, remove it and replace it
       * with the clean Kurdish notification above.
       */
      if (
        /[ØÙÛÚÝÞÃÂÐÑ]|â€|ðŸ/.test(
          saved
        )
      ) {
        localStorage.removeItem(
          "xwendnga_notifications"
        );

        localStorage.setItem(
          "xwendnga_notifications",
          JSON.stringify(
            fallback
          )
        );

        return fallback;
      }

      var parsed =
        JSON.parse(
          saved
        );

      if (
        !Array.isArray(
          parsed
        )
      ) {
        localStorage.removeItem(
          "xwendnga_notifications"
        );

        localStorage.setItem(
          "xwendnga_notifications",
          JSON.stringify(
            fallback
          )
        );

        return fallback;
      }

      return parsed;
    } catch (error) {
      return fallback;
    }
  }


  function saveNotifications(
    items
  ) {
    try {
      localStorage.setItem(
        "xwendnga_notifications",
        JSON.stringify(
          items
        )
      );
    } catch (error) {
      console.error(
        "Xwendnga notifications save error:",
        error
      );
    }
  }


  function notificationsEnabled() {
    try {
      var saved =
        localStorage.getItem(
          "xwendnga_notifications_enabled"
        );

      return saved !==
        "0";
    } catch (error) {
      return true;
    }
  }


  function setNotificationsEnabled(
    enabled
  ) {
    try {
      localStorage.setItem(
        "xwendnga_notifications_enabled",
        enabled
          ? "1"
          : "0"
      );
    } catch (error) {
      console.error(
        "Xwendnga notification setting error:",
        error
      );
    }
  }


  function closeNotifications() {
    var panel =
      document.getElementById(
        "notificationPanel"
      );

    var back =
      document.getElementById(
        "notificationBack"
      );

    if (panel) {
      panel.remove();
    }

    if (back) {
      back.remove();
    }

    state.notificationOpen =
      false;
  }


  function escapeHtml(value) {
    return String(
      value || ""
    )
      .replace(
        /&/g,
        "&amp;"
      )
      .replace(
        /</g,
        "&lt;"
      )
      .replace(
        />/g,
        "&gt;"
      )
      .replace(
        /"/g,
        "&quot;"
      )
      .replace(
        /'/g,
        "&#039;"
      );
  }


  function createNotificationsUI() {
    closeNotifications();

    if (
      !notificationsEnabled()
    ) {
      return;
    }

    var items =
      getNotifications();

    var back =
      document.createElement(
        "div"
      );

    back.id =
      "notificationBack";

    back.className =
      "notification-back";


    var panel =
      document.createElement(
        "section"
      );

    panel.id =
      "notificationPanel";

    panel.className =
      "notification-panel";

    panel.setAttribute(
      "role",
      "dialog"
    );

    panel.setAttribute(
      "aria-modal",
      "true"
    );

    panel.setAttribute(
      "aria-label",
      "ئاگادارییەکان"
    );


    var listHtml =
      items.length
        ? items
            .map(
              function (
                item
              ) {
                return (
                  '<article class="notification-item' +
                  (
                    item.read
                      ? " read"
                      : ""
                  ) +
                  '">' +

                  '<div class="notification-icon">' +

                  '<i class="fa-solid fa-bell"></i>' +

                  "</div>" +

                  '<div class="notification-content">' +

                  "<strong>" +

                  escapeHtml(
                    item.title ||
                      "ئاگاداری"
                  ) +

                  "</strong>" +

                  "<p>" +

                  escapeHtml(
                    item.text ||
                      ""
                  ) +

                  "</p>" +

                  "<small>" +

                  escapeHtml(
                    item.time ||
                      ""
                  ) +

                  "</small>" +

                  "</div>" +

                  "</article>"
                );
              }
            )
            .join("")
        : '<div class="notification-empty">هیچ ئاگادارییەک نییە</div>';


    panel.innerHTML =
      '<div class="notification-head">' +

      "<div>" +

      '<span class="section-kicker">ئاگادارییەکان</span>' +

      "<h3>ئاگادارییەکان</h3>" +

      "</div>" +

      '<button type="button" class="icon-btn" data-notification-close aria-label="داخستن">' +

      '<i class="fa-solid fa-xmark"></i>' +

      "</button>" +

      "</div>" +

      '<div class="notification-list">' +

      listHtml +

      "</div>" +

      '<div class="notification-footer">' +

      '<button type="button" class="ghost" data-notification-disable>' +

      "کوژاندنەوەی ئاگادارییەکان" +

      "</button>" +

      '<button type="button" class="primary" data-notification-read>' +

      "هەمووی بخوێنەوە" +

      "</button>" +

      "</div>";


    document.body.appendChild(
      back
    );

    document.body.appendChild(
      panel
    );


    back.addEventListener(
      "click",
      closeNotifications
    );


    panel.addEventListener(
      "click",
      function (
        event
      ) {

        var closeButton =
          event.target.closest(
            "[data-notification-close]"
          );

        if (closeButton) {
          closeNotifications();
          return;
        }


        var disableButton =
          event.target.closest(
            "[data-notification-disable]"
          );

        if (disableButton) {

          setNotificationsEnabled(
            false
          );

          closeNotifications();

          document
            .querySelectorAll(
              "[data-action='notifications']"
            )
            .forEach(
              function (
                button
              ) {

                button.setAttribute(
                  "aria-pressed",
                  "false"
                );
              }
            );

          return;
        }


        var readButton =
          event.target.closest(
            "[data-notification-read]"
          );

        if (readButton) {

          var stored =
            getNotifications().map(
              function (
                item
              ) {

                var copy =
                  Object.assign(
                    {},
                    item
                  );

                copy.read =
                  true;

                return copy;
              }
            );

          saveNotifications(
            stored
          );

          createNotificationsUI();
        }
      }
    );

    state.notificationOpen =
      true;
  }


  function toggleNotifications(
    button
  ) {
    if (
      state.notificationOpen
    ) {
      closeNotifications();
      return;
    }

    if (
      !notificationsEnabled()
    ) {
      setNotificationsEnabled(
        true
      );

      if (button) {
        button.setAttribute(
          "aria-pressed",
          "true"
        );
      }
    }

    createNotificationsUI();
  }


  /* =======================================================
     ROUTE RENDER
     ======================================================= */

  function renderRoute(
    route,
    options
  ) {
    var next =
      normalizeRoute(
        route
      );

    var previous =
      state.current;

    state.current =
      next;


    showViews(
      next
    );

    updateNavigation(
      next
    );

    updateTitle(
      next
    );

    runRouteHooks(
      next
    );


    if (
      previous !==
        next &&
      !(
        options &&
        options.preserveScroll
      )
    ) {
      window.scrollTo(
        0,
        0
      );
    }


    try {
      document.dispatchEvent(
        new CustomEvent(
          "xwendnga:routechange",
          {
            detail: {
              route:
                next,

              previous:
                previous
            }
          }
        )
      );
    } catch (error) {
      /*
       * CustomEvent is optional.
       * Route switching itself does not
       * depend on this event.
       */
    }
  }


  /* =======================================================
     PUBLIC NAVIGATION
     ======================================================= */

  function navigate(
    route
  ) {
    var next =
      normalizeRoute(
        route
      );

    if (
      next ===
      state.current
    ) {
      renderRoute(
        next,
        {
          preserveScroll:
            true
        }
      );

      return next;
    }

    setHash(
      next,
      false
    );

    return next;
  }


  /* =======================================================
     HASH CHANGE
     ======================================================= */

  function onHashChange() {
    renderRoute(
      getRouteFromHash()
    );
  }


  /* =======================================================
     NAVIGATION CLICK HANDLER
     ======================================================= */

  function bindNavigation() {
    document.addEventListener(
      "click",
      function (
        event
      ) {

        if (
          state.ignoreNextLegacyNavigation
        ) {
          return;
        }


        var target =
          event.target &&
          typeof event.target.closest ===
            "function"
            ? event.target.closest(
                "[data-nav]"
              )
            : null;

        if (!target) {
          return;
        }


        var route =
          normalizeRoute(
            target.getAttribute(
              "data-nav"
            )
          );


        /*
         * app.js owns SPA navigation.
         * Prevent script.js from also treating
         * the same navigation as a legacy filter
         * change.
         */

        event.preventDefault();
        event.stopImmediatePropagation();


        navigate(
          route
        );
      },
      true
    );
  }


  /* =======================================================
     SEARCH HANDLERS
     ======================================================= */

  function bindSearch() {
    var localSearch =
      document.getElementById(
        "searchInput"
      );

    if (localSearch) {

      localSearch.addEventListener(
        "keydown",
        function (
          event
        ) {

          if (
            event.key ===
            "Enter"
          ) {

            event.preventDefault();

            openSearchWithValue(
              localSearch.value
            );
          }
        }
      );
    }


    var globalSearch =
      document.getElementById(
        "globalSearchInput"
      );

    if (globalSearch) {

      globalSearch.addEventListener(
        "input",
        function () {

          var localInput =
            document.getElementById(
              "searchInput"
            );

          if (!localInput) {
            return;
          }

          fireInput(
            localInput,
            globalSearch.value
          );

          syncSearchResults();
        }
      );
    }
  }


  /* =======================================================
     ACTION HANDLERS
     ======================================================= */

  function bindActions() {
    document.addEventListener(
      "click",
      function (
        event
      ) {

        var notificationButton =
          event.target &&
          typeof event.target.closest ===
            "function"
            ? event.target.closest(
                "[data-action='notifications']"
              )
            : null;

        if (!notificationButton) {
          return;
        }

        event.preventDefault();

        toggleNotifications(
          notificationButton
        );
      }
    );
  }


  /* =======================================================
     OPTIONAL VIEW HOOKS
     ======================================================= */

  function prepareOptionalViews() {
    var profile =
      document.querySelector(
        "[data-app-view='profile']"
      );

    if (
      profile &&
      !profile.getAttribute(
        "data-profile-ready"
      )
    ) {

      profile.setAttribute(
        "data-profile-ready",
        "true"
      );
    }


    var settings =
      document.querySelector(
        "[data-app-view='settings']"
      );

    if (
      settings &&
      !settings.getAttribute(
        "data-settings-ready"
      )
    ) {

      settings.setAttribute(
        "data-settings-ready",
        "true"
      );
    }
  }


  /* =======================================================
     INIT
     ======================================================= */

  function init() {

    if (state.ready) {
      return;
    }

    state.ready =
      true;


    prepareOptionalViews();

    bindNavigation();

    bindSearch();

    bindActions();


    window.addEventListener(
      "hashchange",
      onHashChange
    );


    if (
      !window.location.hash
    ) {

      setHash(
        DEFAULT_ROUTE,
        true
      );
    }


    renderRoute(
      getRouteFromHash()
    );
  }


  /* =======================================================
     PUBLIC API
     ======================================================= */

  window.XwendngaApp = {

    navigate:
      navigate,

    go:
      navigate,

    getRoute:
      function () {
        return state.current;
      },

    getRoutes:
      function () {
        return Object.keys(
          ROUTES
        );
      },

    render:
      function (
        route
      ) {

        renderRoute(
          normalizeRoute(
            route
          )
        );
      },

    openSearch:
      function (
        value
      ) {

        openSearchWithValue(
          value
        );
      },

    openNotifications:
      function () {

        toggleNotifications();
      },

    closeNotifications:
      closeNotifications,

    notificationsEnabled:
      notificationsEnabled,

    setNotificationsEnabled:
      setNotificationsEnabled
  };


  /* =======================================================
     START
     ======================================================= */

  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      init,
      {
        once:
          true
      }
    );

  } else {

    init();
  }

})();
