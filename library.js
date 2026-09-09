/* =========================================================
   XWENDNGA — library.js
   Library page controller
   ========================================================= */

(function () {
  "use strict";

  var DB_NAME = "kh_reader_v10";
  var DB_VERSION = 1;
  var STORE_NAME = "books";


  /* =======================================================
     HELPERS
     ======================================================= */

  function $(id) {
    return document.getElementById(id);
  }


  function openDatabase() {
    return new Promise(function (resolve, reject) {

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
          DB_NAME,
          DB_VERSION
        );

      request.onupgradeneeded =
        function () {

          var db =
            request.result;

          if (
            !db.objectStoreNames.contains(
              STORE_NAME
            )
          ) {
            db.createObjectStore(
              STORE_NAME,
              {
                keyPath: "id"
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
                "نەتوانرا بنکەی داتا بکرێتەوە"
              )
          );
        };
    });
  }


  function getAllBooks() {

    return openDatabase()
      .then(function (db) {

        return new Promise(
          function (resolve, reject) {

            var transaction;

            try {

              transaction =
                db.transaction(
                  STORE_NAME,
                  "readonly"
                );

            } catch (error) {

              reject(error);
              return;

            }

            var request =
              transaction
                .objectStore(
                  STORE_NAME
                )
                .getAll();

            request.onsuccess =
              function () {

                resolve(
                  Array.isArray(
                    request.result
                  )
                    ? request.result
                    : []
                );

              };

            request.onerror =
              function () {

                reject(
                  request.error ||
                    new Error(
                      "خوێندنەوەی کتێبەکان سەرکەوتوو نەبوو"
                    )
                );

              };

          }
        );

      });

  }


  function getBookById(id) {

    return openDatabase()
      .then(function (db) {

        return new Promise(
          function (resolve, reject) {

            var transaction;

            try {

              transaction =
                db.transaction(
                  STORE_NAME,
                  "readonly"
                );

            } catch (error) {

              reject(error);
              return;

            }

            var request =
              transaction
                .objectStore(
                  STORE_NAME
                )
                .get(id);

            request.onsuccess =
              function () {

                resolve(
                  request.result ||
                    null
                );

              };

            request.onerror =
              function () {

                reject(
                  request.error ||
                    new Error(
                      "کتێبەکە نەخوێندرایەوە"
                    )
                );

              };

          }
        );

      });

  }


  /* =======================================================
     OPEN BOOK
     ======================================================= */

  function openBookFromLibrary(id) {

    if (!id) {
      return;
    }

    try {

      sessionStorage.setItem(
        "xwendnga_library_book_id",
        String(id)
      );

    } catch (error) {}

    window.location.href =
      "index.html";

  }


  /* =======================================================
     NAVIGATION
     ======================================================= */

  function goToPage(page) {

    var pages = {
      home: "index.html",
      library: "library.html",
      search: "search.html",
      cartoons: "cartoons.html",
      settings: "settings.html",
      profile: "profile.html"
    };

    if (
      !pages[page]
    ) {
      return;
    }

    window.location.href =
      pages[page];

  }


  /* =======================================================
     PAGE EVENTS
     ======================================================= */

  function bindNavigation() {

    document.addEventListener(
      "click",
      function (event) {

        var link =
          event.target.closest(
            "[data-page]"
          );

        if (!link) {
          return;
        }

        var page =
          link.getAttribute(
            "data-page"
          );

        if (
          page &&
          (
            page === "home" ||
            page === "library" ||
            page === "search" ||
            page === "cartoons" ||
            page === "settings" ||
            page === "profile"
          )
        ) {

          event.preventDefault();

          goToPage(
            page
          );

        }

      }
    );


    document.addEventListener(
      "click",
      function (event) {

        var button =
          event.target.closest(
            "[data-open-book]"
          );

        if (!button) {
          return;
        }

        event.preventDefault();

        openBookFromLibrary(
          button.getAttribute(
            "data-open-book"
          )
        );

      }
    );

  }


  /* =======================================================
     PUBLIC API
     ======================================================= */

  window.XwendngaLibrary = {

    getAllBooks:
      getAllBooks,

    getBookById:
      getBookById,

    openBook:
      openBookFromLibrary,

    goToPage:
      goToPage

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
      bindNavigation
    );

  } else {

    bindNavigation();

  }

})();
