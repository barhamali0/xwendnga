(function () {
  "use strict";

  /* =======================================================
     XWENDNGA APP ROUTER
     - Hash based navigation
     - No page reload for internal views
     - Keeps reader.js completely independent
     - Works safely with the current HTML while the SPA
       view containers are being added to index.html
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
    ready: false
  };


  /* =======================================================
     ROUTE HELPERS
     ======================================================= */

  function normalizeRoute(value) {
    var route =
      String(value || "")
        .replace(/^#/, "")
        .trim()
        .toLowerCase();

    if (!route) {
      return DEFAULT_ROUTE;
    }

    return Object.prototype.hasOwnProperty.call(
      ROUTES,
      route
    )
      ? route
      : DEFAULT_ROUTE;
  }


  function getRouteFromHash() {
    return normalizeRoute(
      window.location.hash
    );
  }


  function setHash(
    route,
    replace
  ) {
    var next =
      normalizeRoute(route);

    var hash =
      "#" +
      next;

    if (replace) {

      if (
        window.location.hash !==
        hash
      ) {

        window.history.replaceState(
          {
            xwendngaRoute:
              next
          },
          "",
          hash
        );
      }

      return next;
    }

    if (
      window.location.hash !==
      hash
    ) {

      window.location.hash =
        hash;
    }

    return next;
  }


  /* =======================================================
     VIEW HELPERS
     ======================================================= */

  function getViewElement(
    route
  ) {
    return document.getElementById(
      "view-" +
        route
    );
  }


  function getLegacySection(
    route
  ) {

    var ids = {
      home:
        "homeSection",

      library:
        "librarySection",

      search:
        "searchSection",

      cartoons:
        "cartoonsSection",

      profile:
        "profileSection",

      favorites:
        "favoritesSection",

      vocab:
        "vocabSection"
    };

    var id =
      ids[route];

    return id
      ? document.getElementById(id)
      : null;
  }


  function getAllViews() {

    return Array.prototype.slice.call(
      document.querySelectorAll(
        "[data-app-view], .app-view"
      )
    );
  }


  function showView(
    route
  ) {

    var allViews =
      getAllViews();

    var hasViewSystem =
      allViews.length >
      0;

    if (!hasViewSystem) {
      return false;
    }

    allViews.forEach(
      function (
        view
      ) {

        var name =
          normalizeRoute(
            view.getAttribute(
              "data-app-view"
            ) ||
            String(
              view.id ||
              ""
            ).replace(
              /^view-/,
              ""
            )
          );

        var active =
          name ===
          route;

        view.hidden =
          !active;

        view.classList.toggle(
          "active",
          active
        );

        view.setAttribute(
          "aria-hidden",
          active
            ? "false"
            : "true"
        );
      }
    );

    return true;
  }


  function showLegacySection(
    route
  ) {

    var knownIds = [
      "homeSection",
      "librarySection",
      "searchSection",
      "cartoonsSection",
      "profileSection",
      "favoritesSection",
      "vocabSection"
    ];

    var found =
      false;

    knownIds.forEach(
      function (
        id
      ) {

        var section =
          document.getElementById(
            id
          );

        if (!section) {
          return;
        }

        var sectionRoute =
          id.replace(
            /Section$/,
            ""
          );

        var active =
          sectionRoute ===
          route;

        section.hidden =
          !active;

        section.classList.toggle(
          "active",
          active
        );

        if (active) {
          found = true;
        }
      }
    );

    return found;
  }


  /* =======================================================
     NAVIGATION UI
     ======================================================= */

  function updateNavigation(
    route
  ) {

    document
      .querySelectorAll(
        "[data-nav]"
      )
      .forEach(
        function (
          item
        ) {

          var itemRoute =
            normalizeRoute(
              item.getAttribute(
                "data-nav"
              )
            );

          var active =
            itemRoute ===
            route;

          item.classList.toggle(
            "active",
            active
          );

          item.setAttribute(
            "aria-current",
            active
              ? "page"
              : "false"
          );
        }
      );
  }


  /* =======================================================
     READER SAFETY
     ======================================================= */

  function closeReaderWhenLeavingReaderOnly(
    route
  ) {

    /*
     * reader.js owns the reader UI.
     *
     * The router deliberately does NOT
     * close or modify the reader.
     *
     * This isolated hook is reserved for
     * future reader-specific routing.
     */

    return route;
  }


  /* =======================================================
     ROUTE HOOKS
     ======================================================= */

  function runRouteHooks(
    route
  ) {

    if (
      route ===
        "vocab" &&
      typeof window.renderVocab ===
        "function"
    ) {

      try {

        window.renderVocab();

      } catch (
        error
      ) {

        console.error(
          "Xwendnga vocab view error:",
          error
        );
      }
    }


    if (
      route ===
        "favorites" &&
      typeof window.renderBooks ===
        "function"
    ) {

      try {

        window.renderBooks();

      } catch (
        error
      ) {

        console.error(
          "Xwendnga favorites view error:",
          error
        );
      }
    }
  }


  /* =======================================================
     PAGE TITLE
     ======================================================= */

  function announceRoute(
    route
  ) {

    var titleElement =
      document.querySelector(
        "[data-app-title]"
      );

    if (titleElement) {

      titleElement.textContent =
        ROUTES[route].title;
    }

    document.title =
      ROUTES[route].title +
      " — خوێندنگە";
  }


  /* =======================================================
     CUSTOM ROUTE EVENT
     ======================================================= */

  function dispatchRouteEvent(
    route,
    previous
  ) {

    try {

      document.dispatchEvent(
        new CustomEvent(
          "xwendnga:routechange",
          {
            detail: {
              route:
                route,

              previous:
                previous
            }
          }
        )
      );

    } catch (
      error
    ) {

      /*
       * Older browsers that do not support
       * CustomEvent can safely ignore this.
       */
    }
  }


  /* =======================================================
     RENDER ROUTE
     ======================================================= */

  function renderRoute(
    route
  ) {

    var next =
      normalizeRoute(
        route
      );

    var previous =
      state.current;

    state.current =
      next;


    /*
     * Only app views inside index.html
     * are touched here.
     *
     * reader.js stays independent.
     */

    var usedViewSystem =
      showView(
        next
      );


    if (!usedViewSystem) {

      showLegacySection(
        next
      );
    }


    updateNavigation(
      next
    );

    announceRoute(
      next
    );

    runRouteHooks(
      next
    );

    closeReaderWhenLeavingReaderOnly(
      next
    );

    dispatchRouteEvent(
      next,
      previous
    );
  }


  /* =======================================================
     PUBLIC NAVIGATION
     ======================================================= */

  function navigate(
    route
  ) {

    setHash(
      route,
      false
    );
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
     NAVIGATION EVENTS
     ======================================================= */

  function bindNavigation() {

    /*
     * Capture phase makes routing happen
     * before the existing script.js
     * data-nav handler.
     *
     * Existing handlers are intentionally
     * left untouched.
     */

    document.addEventListener(
      "click",
      function (
        event
      ) {

        var target =
          event.target.closest(
            "[data-nav]"
          );

        if (!target) {
          return;
        }

        var route =
          normalizeRoute(
            target.getAttribute(
              "data-nav"
            )
          );

        if (route) {

          navigate(
            route
          );
        }
      },
      true
    );
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


    bindNavigation();


    window.addEventListener(
      "hashchange",
      onHashChange
    );


    var hash =
      window.location.hash;


    if (!hash) {

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
      }
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
