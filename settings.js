/* =========================================================
   XWENDNGA — settings.js
   Settings page controller
   ========================================================= */

(function () {
  "use strict";

  /* =======================================================
     HELPERS
     ======================================================= */

  function $(id) {
    return document.getElementById(id);
  }


  function save(key, value) {
    try {
      localStorage.setItem(key, String(value));
    } catch (error) {
      console.error("Settings save:", error);
    }
  }


  function load(key, fallback) {
    try {
      var value = localStorage.getItem(key);

      return value === null
        ? fallback
        : value;
    } catch (error) {
      console.error("Settings load:", error);
      return fallback;
    }
  }


  /* =======================================================
     SITE THEMES
     ======================================================= */

  var SITE_THEMES = {

    cyan: {
      name: "شینی ئاسمانی",
      a: "#35bbff",
      b: "#7b61ff",
      bg: "#07111f",
      bg2: "#0d182a",
      surface: "#111f34",
      surface2: "#182943",
      line: "#29405d"
    },

    violet: {
      name: "مۆری",
      a: "#8b6cff",
      b: "#d35cff",
      bg: "#0b081b",
      bg2: "#160f2a",
      surface: "#1d1735",
      surface2: "#282047",
      line: "#47386a"
    },

    emerald: {
      name: "سەوزی",
      a: "#22c98b",
      b: "#0ca6a0",
      bg: "#061611",
      bg2: "#0c241d",
      surface: "#102b23",
      surface2: "#173b30",
      line: "#2b5849"
    },

    sunset: {
      name: "خۆرئاوابوون",
      a: "#ff8a4c",
      b: "#ff4f81",
      bg: "#190b09",
      bg2: "#291410",
      surface: "#351914",
      surface2: "#48231d",
      line: "#693b30"
    },

    ruby: {
      name: "سووری",
      a: "#ff536d",
      b: "#c93dff",
      bg: "#18070d",
      bg2: "#280d19",
      surface: "#361421",
      surface2: "#451b2d",
      line: "#623247"
    },

    royal: {
      name: "شینی قووڵ",
      a: "#4c7dff",
      b: "#36c4ff",
      bg: "#061029",
      bg2: "#0b1940",
      surface: "#10204a",
      surface2: "#17295a",
      line: "#304a80"
    },

    gold: {
      name: "زێڕی",
      a: "#f2bf4a",
      b: "#ff8554",
      bg: "#160f05",
      bg2: "#281809",
      surface: "#34230e",
      surface2: "#452d12",
      line: "#66491f"
    },

    rose: {
      name: "پەمەیی",
      a: "#f05bd5",
      b: "#ff7b8e",
      bg: "#150714",
      bg2: "#250e22",
      surface: "#34152f",
      surface2: "#451c3f",
      line: "#623457"
    },

    ocean: {
      name: "دەریایی",
      a: "#20d6d6",
      b: "#3a7bff",
      bg: "#041216",
      bg2: "#06242b",
      surface: "#0c3038",
      surface2: "#10434e",
      line: "#255b67"
    },

    graphite: {
      name: "گرافایت",
      a: "#aab7c8",
      b: "#62728a",
      bg: "#0a0e13",
      bg2: "#141923",
      surface: "#1c242e",
      surface2: "#27303d",
      line: "#3c4858"
    },

    lime: {
      name: "لایمی",
      a: "#a7df45",
      b: "#24c68a",
      bg: "#0d1605",
      bg2: "#17260a",
      surface: "#223613",
      surface2: "#30471b",
      line: "#4d652b"
    },

    midnight: {
      name: "میدناو",
      a: "#607dff",
      b: "#8b5cf6",
      bg: "#050817",
      bg2: "#0a1025",
      surface: "#101833",
      surface2: "#182344",
      line: "#2f4069"
    }

  };


  /* =======================================================
     READER THEMES
     ======================================================= */

  var READER_THEMES = {

    paper: {
      name: "سپی",
      bg: "#f4f6f9",
      paper: "#ffffff",
      fg: "#1d2a3d"
    },

    cream: {
      name: "کرێمی",
      bg: "#eee5d1",
      paper: "#fff9e7",
      fg: "#403728"
    },

    mint: {
      name: "سەوزی کاڵ",
      bg: "#dfece5",
      paper: "#f4fbf7",
      fg: "#203c31"
    },

    sky: {
      name: "ئاسمانی",
      bg: "#dceef4",
      paper: "#f2fbff",
      fg: "#24414b"
    },

    rose: {
      name: "پەمەیی",
      bg: "#f0dfe2",
      paper: "#fff5f6",
      fg: "#4a2d33"
    },

    lavender: {
      name: "مۆری",
      bg: "#e6def4",
      paper: "#fbf8ff",
      fg: "#332b46"
    },

    sand: {
      name: "خۆڵەمێشی",
      bg: "#e7ded2",
      paper: "#fbf4eb",
      fg: "#493b2e"
    },

    forest: {
      name: "دارستان",
      bg: "#dee8de",
      paper: "#f5fbf3",
      fg: "#213525"
    },

    sepia: {
      name: "کەتیبی کۆن",
      bg: "#e6dbc6",
      paper: "#f7eddb",
      fg: "#4a3925"
    },

    slate: {
      name: "سڵەیت",
      bg: "#dce1e7",
      paper: "#eef1f5",
      fg: "#263341"
    },

    night: {
      name: "شەو",
      bg: "#0b1420",
      paper: "#101b2c",
      fg: "#e9f2fc"
    },

    black: {
      name: "ڕەش",
      bg: "#050505",
      paper: "#0b0b0b",
      fg: "#f1f1f1"
    }

  };


  /* =======================================================
     CURRENT SETTINGS
     ======================================================= */

  var currentSiteTheme =
    load(
      "kh_site_theme",
      "cyan"
    );

  var currentReaderTheme =
    load(
      "kh_reader_theme",
      "paper"
    );


  if (!SITE_THEMES[currentSiteTheme]) {
    currentSiteTheme = "cyan";
  }

  if (!READER_THEMES[currentReaderTheme]) {
    currentReaderTheme = "paper";
  }


  /* =======================================================
     APPLY SITE THEME
     ======================================================= */

  function applySiteTheme(key) {

    var theme =
      SITE_THEMES[key] ||
      SITE_THEMES.cyan;

    currentSiteTheme =
      SITE_THEMES[key]
        ? key
        : "cyan";

    var root =
      document.documentElement;

    root.style.setProperty(
      "--a",
      theme.a
    );

    root.style.setProperty(
      "--b",
      theme.b
    );

    root.style.setProperty(
      "--accent",
      theme.a
    );

    root.style.setProperty(
      "--bg",
      theme.bg
    );

    root.style.setProperty(
      "--bg2",
      theme.bg2
    );

    root.style.setProperty(
      "--surface",
      theme.surface
    );

    root.style.setProperty(
      "--surface2",
      theme.surface2
    );

    root.style.setProperty(
      "--line",
      theme.line
    );

    save(
      "kh_site_theme",
      currentSiteTheme
    );
  }


  /* =======================================================
     RENDER SITE THEMES
     ======================================================= */

  function renderSiteThemes() {

    var box =
      $("siteThemes");

    if (!box) {
      return;
    }

    box.innerHTML =
      Object.keys(
        SITE_THEMES
      )
        .map(
          function (key) {

            var theme =
              SITE_THEMES[key];

            return (
              '<button ' +
              'class="theme-choice ' +
              (
                key === currentSiteTheme
                  ? "active"
                  : ""
              ) +
              '" ' +
              'type="button" ' +
              'data-site-theme="' +
              key +
              '" ' +
              'style="background:' +
              theme.bg2 +
              '">' +

              '<span ' +
              'class="theme-choice-dot" ' +
              'style="background:' +
              theme.a +
              '">' +
              '</span>' +

              '<span ' +
              'class="theme-choice-bar" ' +
              'style="background:linear-gradient(90deg,' +
              theme.a +
              "," +
              theme.b +
              ')">' +
              '</span>' +

              '<strong>' +
              theme.name +
              '</strong>' +

              '</button>'
            );
          }
        )
        .join("");
  }


  /* =======================================================
     APPLY READER THEME
     ======================================================= */

  function applyReaderTheme(key) {

    if (!READER_THEMES[key]) {
      key = "paper";
    }

    currentReaderTheme = key;

    save(
      "kh_reader_theme",
      currentReaderTheme
    );

  }


  /* =======================================================
     RENDER READER THEMES
     ======================================================= */

  function renderReaderThemes() {

    var box =
      $("readerThemes");

    if (!box) {
      return;
    }

    box.innerHTML =
      Object.keys(
        READER_THEMES
      )
        .map(
          function (key) {

            var theme =
              READER_THEMES[key];

            var dark =
              key === "night" ||
              key === "black";

            return (
              '<button ' +
              'class="reader-choice ' +
              (
                key === currentReaderTheme
                  ? "active"
                  : ""
              ) +
              '" ' +
              'type="button" ' +
              'data-reader-theme="' +
              key +
              '" ' +
              'style="background:' +
              theme.bg +
              ';color:' +
              theme.fg +
              '">' +

              '<span ' +
              'class="reader-choice-dot" ' +
              'style="background:' +
              theme.fg +
              '">' +
              '</span>' +

              '<strong ' +
              (
                dark
                  ? 'style="color:' +
                    theme.fg +
                    '"'
                  : ""
              ) +
              '>' +

              theme.name +

              '</strong>' +

              '</button>'
            );
          }
        )
        .join("");
  }


  /* =======================================================
     GEMINI KEY
     ======================================================= */

  var geminiInput =
    $("geminiApiKey");

  var geminiToggle =
    $("geminiToggle");

  var saveGemini =
    $("saveGemini");


  if (geminiInput) {

    geminiInput.value =
      load(
        "kh_gemini_key",
        ""
      );

  }


  if (
    geminiToggle &&
    geminiInput
  ) {

    geminiToggle.addEventListener(
      "click",
      function () {

        var isHidden =
          geminiInput.type ===
          "password";

        geminiInput.type =
          isHidden
            ? "text"
            : "password";

        this.innerHTML =
          isHidden
            ? '<i class="fa-regular fa-eye-slash"></i>'
            : '<i class="fa-regular fa-eye"></i>';

      }
    );

  }


  if (saveGemini) {

    saveGemini.addEventListener(
      "click",
      function () {

        var value =
          geminiInput
            ? geminiInput.value.trim()
            : "";

        save(
          "kh_gemini_key",
          value
        );

        this.innerHTML =
          '<i class="fa-solid fa-check"></i> پاشەکەوت کرا';

        var button =
          this;

        setTimeout(
          function () {

            button.innerHTML =
              '<i class="fa-solid fa-floppy-disk"></i> پاشەکەوتکردنی کلیلی Gemini';

          },
          1600
        );

      }
    );

  }


  /* =======================================================
     FONT SIZE
     ======================================================= */

  var fontSize =
    $("readerFontSize");


  if (fontSize) {

    var savedFont =
      load(
        "kh_font",
        "20"
      );

    if (
      ["18", "20", "23", "26", "30"]
        .indexOf(savedFont) === -1
    ) {
      savedFont = "20";
    }

    fontSize.value =
      savedFont;


    fontSize.addEventListener(
      "change",
      function () {

        save(
          "kh_font",
          this.value
        );

      }
    );

  }


  /* =======================================================
     NOTIFICATIONS
     ======================================================= */

  var notificationsSwitch =
    $("notificationsSwitch");


  if (notificationsSwitch) {

    var savedNotifications =
      load(
        "kh_notifications_enabled",
        "true"
      );

    notificationsSwitch.checked =
      savedNotifications ===
      "true";


    notificationsSwitch.addEventListener(
      "change",
      function () {

        save(
          "kh_notifications_enabled",
          this.checked
        );

      }
    );

  }


  /* =======================================================
     ANIMATION
     ======================================================= */

  var animationSwitch =
    $("animationSwitch");


  function applyAnimationSetting(enabled) {

    document.documentElement.classList.toggle(
      "reduce-motion",
      !enabled
    );

  }


  if (animationSwitch) {

    var savedAnimation =
      load(
        "kh_animations_enabled",
        "true"
      );

    animationSwitch.checked =
      savedAnimation ===
      "true";

    applyAnimationSetting(
      animationSwitch.checked
    );


    animationSwitch.addEventListener(
      "change",
      function () {

        save(
          "kh_animations_enabled",
          this.checked
        );

        applyAnimationSetting(
          this.checked
        );

      }
    );

  }


  /* =======================================================
     AUTO SAVE
     ======================================================= */

  var autoSaveSwitch =
    $("autoSaveSwitch");


  if (autoSaveSwitch) {

    var savedAutoSave =
      load(
        "kh_auto_save",
        "true"
      );

    autoSaveSwitch.checked =
      savedAutoSave ===
      "true";


    autoSaveSwitch.addEventListener(
      "change",
      function () {

        save(
          "kh_auto_save",
          this.checked
        );

      }
    );

  }


  /* =======================================================
     THEME EVENTS
     ======================================================= */

  document.addEventListener(
    "click",
    function (event) {

      var siteButton =
        event.target.closest(
          "[data-site-theme]"
        );

      if (siteButton) {

        var siteKey =
          siteButton.getAttribute(
            "data-site-theme"
          );

        if (
          SITE_THEMES[siteKey]
        ) {

          applySiteTheme(
            siteKey
          );

          renderSiteThemes();

        }

        return;
      }


      var readerButton =
        event.target.closest(
          "[data-reader-theme]"
        );

      if (readerButton) {

        var readerKey =
          readerButton.getAttribute(
            "data-reader-theme"
          );

        if (
          READER_THEMES[readerKey]
        ) {

          applyReaderTheme(
            readerKey
          );

          renderReaderThemes();

        }

      }

    }
  );


  /* =======================================================
     CLEAR LOCAL DATA
     ======================================================= */

  var clearLocalData =
    $("clearLocalData");


  if (clearLocalData) {

    clearLocalData.addEventListener(
      "click",
      function () {

        var confirmed =
          window.confirm(
            "دڵنیایت؟ ئەمە داتاکانی ناوخۆی ئەم ئامێرە دەسڕێتەوە."
          );

        if (!confirmed) {
          return;
        }


        try {
          localStorage.clear();
        } catch (error) {
          console.error(
            "Clear localStorage:",
            error
          );
        }


        try {
          sessionStorage.clear();
        } catch (error) {
          console.error(
            "Clear sessionStorage:",
            error
          );
        }


        window.location.reload();

      }
    );

  }


  /* =======================================================
     NOTIFICATION BUTTON
     ======================================================= */

  var notificationButton =
    $("notificationButton");


  if (notificationButton) {

    notificationButton.addEventListener(
      "click",
      function () {

        window.alert(
          "بەشی ئاگادارییەکان لە قۆناغی داهاتوودا تەواو دەکرێت."
        );

      }
    );

  }


  /* =======================================================
     INITIALIZE
     ======================================================= */

  applySiteTheme(
    currentSiteTheme
  );

  renderSiteThemes();

  renderReaderThemes();


  /* =======================================================
     PUBLIC OBJECT
     ======================================================= */

  window.XwendngaSettings = {

    applySiteTheme:
      applySiteTheme,

    applyReaderTheme:
      applyReaderTheme

  };

})();
