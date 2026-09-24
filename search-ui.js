/* ======================================================
   XWENDNGA — SEARCH UI FOUNDATION
   Phase 4A-1

   Scope of this file:
   - Search filter/chip UI only.
   - No search engine.
   - No Supabase queries.
   - No Books / Cinema / Music / Members integration.
   ====================================================== */

(function () {
  "use strict";

  var state = {
    ready: false,
    filter: "all"
  };

  function getRoot() {
    return document.getElementById("globalSearchFilters");
  }

  function getResults() {
    return document.getElementById("globalSearchResults");
  }

  function setActiveFilter(filter, button) {
    var root = getRoot();

    if (!root || !button) {
      return;
    }

    state.filter = filter || "all";

    root.querySelectorAll("[data-search-filter]").forEach(function (item) {
      var isActive = item === button;

      item.classList.toggle("is-active", isActive);
      item.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    var results = getResults();

    if (results) {
      results.setAttribute("data-search-results", state.filter);
    }

    /*
      Foundation event for the later search engine.
      Phase 4A-1 intentionally has no listener for this event.
    */
    window.dispatchEvent(
      new CustomEvent("xwendnga:search-filter-change", {
        detail: {
          filter: state.filter
        }
      })
    );
  }

  function bind() {
    var root = getRoot();

    if (!root || state.ready) {
      return;
    }

    state.ready = true;

    root.addEventListener("click", function (event) {
      var button = event.target.closest("[data-search-filter]");

      if (!button || !root.contains(button)) {
        return;
      }

      setActiveFilter(
        button.getAttribute("data-search-filter") || "all",
        button
      );
    });

    var initial = root.querySelector(
      '[data-search-filter="' + state.filter + '"]'
    );

    if (initial) {
      setActiveFilter(state.filter, initial);
    }
  }

  function init() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", bind, { once: true });
    } else {
      bind();
    }
  }

  window.XwendngaSearchUI = {
    init: init,
    getFilter: function () {
      return state.filter;
    }
  };

  init();
})();
