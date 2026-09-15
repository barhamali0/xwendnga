/* XWENDNGA — cinema-admin.js | Stage 5.4
   Cinema-only administration.
   - Owner/admin authentication sync
   - Dynamic Cinema header button
   - Document-level event delegation
   - Admin UI lives outside cinema-ui.js DOM
   - Explicit Supabase columns and error reporting
   - Movie/cartoon management
   - Dynamic video servers
   - SRT/VTT subtitle text import
   - Safe catalog refresh
*/
(function () {
  "use strict";

  var C = {
    url: "https://nretwjagqnisyihtuwwn.supabase.co",
    key: "sb_publishable_603X2LJm3l-diUOPeQxyPQ_NkrIiD7M",
    cinemas: "cinemas",
    servers: "cinema_servers",
    profiles: "profiles",
    view: '[data-app-view="cinema"]',
    catalog: "cinemaCatalog",
    root: "cinemaAdminRoot"
  };

  var S = {
    db: null,
    root: null,
    isAdmin: false,
    editing: null,
    cinemas: [],
    saving: false,
    opening: false,
    authBound: false,
    clickBound: false,
    observerBound: false
  };

  var TYPES = [
    ["movie", "فیلم"],
    ["cartoon", "کارتۆن"]
  ];

  var STATUS = [
    ["draft", "ڕەشنووس"],
    ["published", "بڵاوکراوە"],
    ["hidden", "شاراوە"]
  ];

  var LANGS = [
    ["ku", "کوردی"],
    ["en", "ئینگلیزی"],
    ["ar", "عەرەبی"],
    ["fa", "فارسی"]
  ];

  var CINEMA_COLUMNS = [
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
    "sub_ku",
    "sub_en",
    "sub_ar",
    "sub_fa",
    "created_at",
    "updated_at"
  ].join(",");

  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function val(sel) {
    var n = S.root && S.root.querySelector(sel);
    return n ? String(n.value || "").trim() : "";
  }

  function nint(v) {
    if (v === "" || v == null) {
      return null;
    }

    var n = parseInt(v, 10);

    return Number.isFinite(n) ? n : null;
  }

  function nnum(v) {
    if (v === "" || v == null) {
      return null;
    }

    var n = Number(v);

    return Number.isFinite(n) ? n : null;
  }

  function client() {
    if (S.db) {
      return S.db;
    }

    if (
      window.supabaseClient &&
      window.supabaseClient.auth &&
      typeof window.supabaseClient.from === "function"
    ) {
      S.db = window.supabaseClient;
      return S.db;
    }

    if (
      !window.supabase ||
      typeof window.supabase.createClient !== "function"
    ) {
      throw new Error("Supabase JS Client بەردەست نییە.");
    }

    S.db = window.supabase.createClient(C.url, C.key);

    return S.db;
  }

  function getView() {
    return document.querySelector(C.view);
  }

  function isCinemaActive() {
    var view = getView();

    if (!view || view.hidden) {
      return false;
    }

    if (view.getAttribute("aria-hidden") === "true") {
      return false;
    }

    var style = window.getComputedStyle(view);

    return style.display !== "none" && style.visibility !== "hidden";
  }

  function getRoot() {
    var root = document.getElementById(C.root);

    if (root) {
      return root;
    }

    if (!document.body) {
      return null;
    }

    root = document.createElement("div");
    root.id = C.root;
    root.className = "cinema-admin-root";
    root.style.display = "none";
    root.setAttribute("aria-hidden", "true");

    document.body.appendChild(root);

    return root;
  }

  function styles() {
    if (document.getElementById("xwCinemaAdminStyles")) {
      return;
    }

    var s = document.createElement("style");

    s.id = "xwCinemaAdminStyles";

    s.textContent = `
      .cinema-admin-root{
        position:fixed;
        inset:0;
        z-index:100000;
        overflow:auto;
        padding:clamp(12px,3vw,28px);
        color:#f7f9ff;
        background:rgba(3,6,13,.96);
        -webkit-overflow-scrolling:touch;
      }
      .cinema-admin-root *{box-sizing:border-box}
      .cinema-admin-root[aria-hidden="true"]{display:none !important}
      .ca-wrap{width:min(1180px,100%);margin:0 auto;display:flex;flex-direction:column;gap:16px;padding-bottom:32px}
      .ca-panel{padding:18px;border:1px solid rgba(255,255,255,.11);border-radius:24px;background:rgba(17,25,43,.94);box-shadow:0 24px 70px rgba(0,0,0,.38);backdrop-filter:blur(18px)}
      .ca-head{display:flex;align-items:center;justify-content:space-between;gap:14px}
      .ca-head h2{margin:0;font-size:1.25rem;font-weight:900}
      .ca-muted,.ca-note{color:#9aa8bd;font-size:.76rem;line-height:1.8}
      .ca-head .ca-muted{margin-top:5px}
      .ca-btn{min-height:42px;padding:0 14px;border:1px solid rgba(255,255,255,.12);border-radius:12px;color:#fff;background:rgba(255,255,255,.05);cursor:pointer;font:inherit;font-weight:800}
      .ca-btn:hover{background:rgba(124,92,255,.2)}
      .ca-btn:disabled{opacity:.55;cursor:not-allowed}
      .ca-primary{border-color:transparent;background:linear-gradient(135deg,#7c5cff,#27c7ff)}
      .ca-danger{color:#ffd8df;border-color:rgba(255,86,122,.25);background:rgba(255,86,122,.08)}
      .ca-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
      .ca-field{display:flex;flex-direction:column;gap:6px}
      .ca-full{grid-column:1/-1}
      .ca-label{font-size:.75rem;color:#cfd6e4;font-weight:800}
      .ca-input,.ca-select,.ca-text{width:100%;border:1px solid rgba(255,255,255,.11);border-radius:12px;color:#fff;background:rgba(2,6,14,.65);padding:11px 12px;outline:none;font:inherit}
      .ca-text{min-height:100px;resize:vertical;line-height:1.7}
      .ca-input:focus,.ca-select:focus,.ca-text:focus{border-color:rgba(124,92,255,.6);box-shadow:0 0 0 3px rgba(124,92,255,.1)}
      .ca-section{display:flex;flex-direction:column;gap:12px;margin-top:16px;padding:14px;border:1px solid rgba(255,255,255,.08);border-radius:18px;background:rgba(255,255,255,.025)}
      .ca-section-head{display:flex;align-items:center;justify-content:space-between;gap:10px}
      .ca-section-head strong{font-size:.86rem}
      .ca-sub-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .ca-sub{padding:11px;border:1px solid rgba(255,255,255,.08);border-radius:15px;background:rgba(0,0,0,.13)}
      .ca-sub strong{display:block;margin-bottom:7px;font-size:.75rem}
      .ca-file{width:100%;padding:8px;border:1px dashed rgba(255,255,255,.14);border-radius:10px;color:#bfc9da;background:rgba(255,255,255,.025)}
      .ca-server{display:flex;flex-direction:column;gap:10px;padding:12px;border:1px solid rgba(255,255,255,.09);border-radius:15px;background:rgba(0,0,0,.14)}
      .ca-server-head{display:flex;align-items:center;justify-content:space-between;gap:10px}
      .ca-server-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .ca-check{display:flex;align-items:center;gap:8px;color:#dce3ef;font-size:.75rem;font-weight:800}
      .ca-check input{accent-color:#7c5cff}
      .ca-footer{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:16px}
      .ca-list{display:flex;flex-direction:column;gap:10px}
      .ca-card{display:grid;grid-template-columns:62px minmax(0,1fr);gap:11px;padding:10px;border:1px solid rgba(255,255,255,.09);border-radius:16px;background:rgba(255,255,255,.025)}
      .ca-poster{width:62px;height:84px;border-radius:10px;overflow:hidden;background:#050812}
      .ca-poster img{width:100%;height:100%;object-fit:cover}
      .ca-title{margin:0;font-size:.85rem;font-weight:900}
      .ca-meta{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px;color:#9aa8bd;font-size:.67rem}
      .ca-pill{padding:4px 7px;border:1px solid rgba(255,255,255,.08);border-radius:999px;background:rgba(255,255,255,.035)}
      .ca-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}
      .ca-empty{padding:28px;text-align:center;color:#9aa8bd;border:1px dashed rgba(255,255,255,.1);border-radius:16px}
      .ca-alert,.ca-ok{padding:11px 13px;border-radius:13px;font-size:.75rem;line-height:1.8}
      .ca-alert{color:#ffdbe2;border:1px solid rgba(255,86,122,.22);background:rgba(255,86,122,.08)}
      .ca-ok{color:#d8ffef;border:1px solid rgba(49,211,154,.2);background:rgba(49,211,154,.07)}
      .ca-error-detail{margin-top:8px;white-space:pre-wrap;direction:ltr;text-align:left;word-break:break-word;font:12px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;color:#ffdbe2}
      .ca-admin-launch{white-space:nowrap}
      @media(max-width:700px){
        .ca-grid,.ca-sub-grid,.ca-server-grid{grid-template-columns:1fr}
        .ca-full{grid-column:auto}
        .ca-head{align-items:stretch;flex-direction:column}
        .ca-head > div:last-child{width:100%}
        .ca-head > div:last-child .ca-btn{flex:1 1 auto}
        .ca-admin-launch{width:100%}
      }
    `;

    document.head.appendChild(s);
  }

  function errorText(e) {
    if (!e) {
      return "هەڵەیەکی نەناسراو ڕوویدا.";
    }

    var parts = [];

    if (e.message) {
      parts.push(String(e.message));
    }

    if (e.code) {
      parts.push("Code: " + String(e.code));
    }

    if (e.details) {
      parts.push(String(e.details));
    }

    if (e.hint) {
      parts.push(String(e.hint));
    }

    return parts.join("\n") || String(e);
  }

  function message(text, ok) {
    if (!S.root) {
      return;
    }

    var old = S.root.querySelector(".ca-message");

    if (old) {
      old.remove();
    }

    if (!text) {
      return;
    }

    var box = document.createElement("div");

    box.className = "ca-message " + (ok ? "ca-ok" : "ca-alert");
    box.textContent = text;

    var wrap = S.root.querySelector(".ca-wrap");

    if (wrap) {
      wrap.insertBefore(box, wrap.firstChild);
    }
  }

  function showLoadError(e) {
    if (!S.root) {
      return;
    }

    S.root.innerHTML = `
      <div class="ca-wrap">
        <div class="ca-panel ca-alert">
          <strong>پانێڵی بەڕێوەبردنی سینەما کرایەوە، بەڵام داتاکان نەهاتن.</strong>
          <div class="ca-error-detail">${esc(errorText(e))}</div>
          <div class="ca-note" style="margin-top:10px">
            ئەگەر پەیامەکە permission denied یان RLS بوو، پێویستی بە Supabase Policy هەیە بۆ
            ${esc(C.cinemas)} و ${esc(C.servers)}. ئەمە کێشەی دوگمە نییە.
          </div>
          <div class="ca-footer">
            <button type="button" class="ca-btn" data-close-admin>داخستن ✕</button>
            <button type="button" class="ca-btn ca-primary" data-cinema-admin-retry>دووبارە هەوڵبدەوە</button>
          </div>
        </div>
      </div>
    `;
  }

  function empty() {
    return {
      title_en:"",
      title_ku:"",
      type:"movie",
      poster_url:"",
      backdrop_url:"",
      year:"",
      duration:"",
      rating:"",
      genres:"",
      synopsis_en:"",
      synopsis_ku:"",
      tmdb_id:"",
      status:"published",
      sub_ku:"",
      sub_en:"",
      sub_ar:"",
      sub_fa:"",
      servers:[]
    };
  }

  function rowForm(row, servers) {
    row = row || {};

    return {
      title_en:row.title_en || "",
      title_ku:row.title_ku || "",
      type:row.type || "movie",
      poster_url:row.poster_url || "",
      backdrop_url:row.backdrop_url || "",
      year:row.year == null ? "" : String(row.year),
      duration:row.duration || "",
      rating:row.rating == null ? "" : String(row.rating),
      genres:Array.isArray(row.genres)
        ? row.genres.join(", ")
        : (row.genres || ""),
      synopsis_en:row.synopsis_en || "",
      synopsis_ku:row.synopsis_ku || "",
      tmdb_id:row.tmdb_id == null ? "" : String(row.tmdb_id),
      status:row.status || "published",
      sub_ku:row.sub_ku || "",
      sub_en:row.sub_en || "",
      sub_ar:row.sub_ar || "",
      sub_fa:row.sub_fa || "",
      servers:(servers || []).map(function (s) {
        return {
          id:s.id || null,
          server_name:s.server_name || "",
          server_type:s.server_type || "",
          video_url:s.video_url || "",
          is_default:s.is_default === true,
          sort_order:s.sort_order == null ? "" : String(s.sort_order),
          status:s.status || "published"
        };
      })
    };
  }

  function formData() {
    var f = empty();

    [
      "title_en",
      "title_ku",
      "type",
      "poster_url",
      "backdrop_url",
      "year",
      "duration",
      "rating",
      "genres",
      "synopsis_en",
      "synopsis_ku",
      "tmdb_id",
      "status"
    ].forEach(function (k) {
      f[k] = val('[name="' + k + '"]');
    });

    LANGS.forEach(function (l) {
      f["sub_" + l[0]] = val('[name="sub_' + l[0] + '"]');
    });

    f.servers = Array.prototype.map.call(
      S.root.querySelectorAll("[data-server-row]"),
      function (r, i) {
        var name = r.querySelector("[data-server-name]");
        var type = r.querySelector("[data-server-type]");
        var url = r.querySelector("[data-server-url]");
        var def = r.querySelector("[data-server-default]");
        var order = r.querySelector("[data-server-order]");
        var status = r.querySelector("[data-server-status]");

        return {
          id:r.getAttribute("data-id") || null,
          server_name:name ? name.value || "" : "",
          server_type:type ? type.value || "" : "",
          video_url:url ? url.value || "" : "",
          is_default:!!(def && def.checked),
          sort_order:order ? order.value || String(i + 1) : String(i + 1),
          status:status ? status.value || "published" : "published"
        };
      }
    );

    return f;
  }

  function validate(f) {
    if (!f.title_ku && !f.title_en) {
      return "لانیکەم ناونیشانی کوردی یان ئینگلیزی بنووسە.";
    }

    if (
      f.rating !== "" &&
      (
        !Number.isFinite(Number(f.rating)) ||
        Number(f.rating) < 0 ||
        Number(f.rating) > 10
      )
    ) {
      return "نمرە دەبێت لەنێوان ٠ تا ١٠ بێت.";
    }

    if (f.year !== "" && nint(f.year) == null) {
      return "ساڵ دەبێت ژمارە بێت.";
    }

    if (f.tmdb_id !== "" && nint(f.tmdb_id) == null) {
      return "TMDB ID دەبێت ژمارە بێت.";
    }

    return "";
  }

  function serverHtml(servers) {
    if (!servers.length) {
      return '<div class="ca-note" data-no-server>هیچ سێرڤەرێک نییە. لە سەرەوە زیاد بکە.</div>';
    }

    return servers.map(function (s, i) {
      return `
        <div class="ca-server" data-server-row data-id="${esc(s.id || "")}">
          <div class="ca-server-head">
            <strong>سێرڤەر ${i + 1}</strong>
            <button type="button" class="ca-btn ca-danger" data-remove-server>سڕینەوە</button>
          </div>

          <div class="ca-server-grid">
            <label class="ca-field">
              <span class="ca-label">ناوی سێرڤەر</span>
              <input class="ca-input" data-server-name value="${esc(s.server_name)}" placeholder="سێرڤەری سەرەکی">
            </label>

            <label class="ca-field">
              <span class="ca-label">جۆری سێرڤەر</span>
              <input class="ca-input" data-server-type value="${esc(s.server_type)}" placeholder="direct">
            </label>

            <label class="ca-field" style="grid-column:1/-1">
              <span class="ca-label">لینکی ڤیدیۆ</span>
              <input class="ca-input" dir="ltr" data-server-url value="${esc(s.video_url)}" placeholder="https://...">
            </label>

            <label class="ca-field">
              <span class="ca-label">ڕیزبەندی</span>
              <input class="ca-input" data-server-order type="number" min="1" value="${esc(s.sort_order || String(i + 1))}">
            </label>

            <label class="ca-field">
              <span class="ca-label">دۆخ</span>
              <select class="ca-select" data-server-status>
                <option value="published"${s.status === "published" ? " selected" : ""}>بڵاوکراوە</option>
                <option value="hidden"${s.status === "hidden" ? " selected" : ""}>شاراوە</option>
              </select>
            </label>
          </div>

          <label class="ca-check">
            <input type="checkbox" data-server-default${s.is_default ? " checked" : ""}>
            ئەم سێرڤەرە سەرەکی بێت
          </label>
        </div>
      `;
    }).join("");
  }

  function subHtml(k, label, value) {
    return `
      <div class="ca-sub">
        <strong>${label}</strong>
        <input class="ca-file" type="file" accept=".srt,.vtt,text/plain" data-sub-file="${k}">
        <textarea class="ca-text" name="sub_${k}" data-sub-text="${k}" placeholder="دەقی SRT/VTT لێرە پەیست بکە...">${esc(value)}</textarea>
      </div>
    `;
  }

  function renderForm(f) {
    if (!S.root) {
      return;
    }

    S.root.innerHTML = `
      <div class="ca-wrap">
        <div class="ca-panel ca-head">
          <div>
            <h2>${S.editing ? "دەستکاریی ناوەڕۆک" : "زیادکردنی فیلم یان کارتۆن"}</h2>
            <div class="ca-muted">زانیارییەکانی فیلم، سێرڤەر و ژێرنووسەکان لێرە بەڕێوەبەرە.</div>
          </div>

          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button type="button" class="ca-btn" data-list>گەڕانەوە بۆ لیست</button>
            <button type="button" class="ca-btn" data-close-admin>داخستن ✕</button>
          </div>
        </div>

        <form class="ca-panel" data-form>
          <div class="ca-section" style="margin-top:0">
            <div class="ca-section-head"><strong>١. زانیاریی سەرەکی</strong></div>

            <div class="ca-grid">
              <label class="ca-field">
                <span class="ca-label">ناوی کوردی</span>
                <input class="ca-input" name="title_ku" value="${esc(f.title_ku)}">
              </label>

              <label class="ca-field">
                <span class="ca-label">ناوی ئینگلیزی</span>
                <input class="ca-input" dir="ltr" name="title_en" value="${esc(f.title_en)}">
              </label>

              <label class="ca-field">
                <span class="ca-label">جۆر</span>
                <select class="ca-select" name="type">
                  ${TYPES.map(function (x) {
                    return '<option value="' + esc(x[0]) + '"' +
                      (f.type === x[0] ? " selected" : "") +
                      ">" + esc(x[1]) + "</option>";
                  }).join("")}
                </select>
              </label>

              <label class="ca-field">
                <span class="ca-label">ساڵ</span>
                <input class="ca-input" name="year" type="number" value="${esc(f.year)}">
              </label>

              <label class="ca-field">
                <span class="ca-label">ماوە</span>
                <input class="ca-input" name="duration" value="${esc(f.duration)}" placeholder="1 کاتژمێر و 45 خولەک">
              </label>

              <label class="ca-field">
                <span class="ca-label">نمرە</span>
                <input class="ca-input" name="rating" type="number" min="0" max="10" step=".1" value="${esc(f.rating)}">
              </label>

              <label class="ca-field ca-full">
                <span class="ca-label">ژانەرەکان</span>
                <input class="ca-input" name="genres" value="${esc(f.genres)}" placeholder="ئەکشن, دراما, فەنتازیا">
              </label>

              <label class="ca-field">
                <span class="ca-label">لینکی پۆستەر</span>
                <input class="ca-input" dir="ltr" name="poster_url" value="${esc(f.poster_url)}" placeholder="https://...jpg">
              </label>

              <label class="ca-field">
                <span class="ca-label">لینکی Backdrop</span>
                <input class="ca-input" dir="ltr" name="backdrop_url" value="${esc(f.backdrop_url)}" placeholder="https://...jpg">
              </label>

              <label class="ca-field">
                <span class="ca-label">TMDB ID</span>
                <input class="ca-input" name="tmdb_id" type="number" value="${esc(f.tmdb_id)}" placeholder="550">
              </label>

              <label class="ca-field">
                <span class="ca-label">دۆخی بڵاوکردنەوە</span>
                <select class="ca-select" name="status">
                  ${STATUS.map(function (x) {
                    return '<option value="' + esc(x[0]) + '"' +
                      (f.status === x[0] ? " selected" : "") +
                      ">" + esc(x[1]) + "</option>";
                  }).join("")}
                </select>
              </label>

              <label class="ca-field">
                <span class="ca-label">کورتەی کوردی</span>
                <textarea class="ca-text" name="synopsis_ku">${esc(f.synopsis_ku)}</textarea>
              </label>

              <label class="ca-field">
                <span class="ca-label">کورتەی ئینگلیزی</span>
                <textarea class="ca-text" dir="ltr" name="synopsis_en">${esc(f.synopsis_en)}</textarea>
              </label>
            </div>
          </div>

          <div class="ca-section">
            <div class="ca-section-head">
              <strong>٢. سێرڤەرەکانی پەخشی ڤیدیۆ</strong>
              <button type="button" class="ca-btn ca-primary" data-add-server>+ زیادکردنی سێرڤەر</button>
            </div>

            <div data-server-list>${serverHtml(f.servers)}</div>
          </div>

          <div class="ca-section">
            <div class="ca-section-head"><strong>٣. ژێرنووسەکان (SRT/VTT)</strong></div>
            <div class="ca-sub-grid">
              ${LANGS.map(function (x) {
                return subHtml(x[0], x[1], f["sub_" + x[0]]);
              }).join("")}
            </div>
          </div>

          <div class="ca-footer">
            <button type="button" class="ca-btn" data-list>پاشگەزبوونەوە</button>
            <button type="submit" class="ca-btn ca-primary" data-save>
              ${S.saving ? "خەریکی پاشەکەوتکردنە..." : (S.editing ? "پاشەکەوتکردنی گۆڕانکاری" : "بڵاوکردنەوە")}
            </button>
          </div>
        </form>
      </div>
    `;

    bindForm();
  }

  function bindForm() {
    if (!S.root) {
      return;
    }

    var form = S.root.querySelector("[data-form]");

    if (form && !form.dataset.bound) {
      form.dataset.bound = "true";

      form.addEventListener("submit", function (e) {
        e.preventDefault();
        save();
      });
    }

    S.root.querySelectorAll("[data-sub-file]").forEach(function (input) {
      input.addEventListener("change", async function () {
        var file = input.files && input.files[0];

        if (!file) {
          return;
        }

        try {
          var t = await file.text();
          var area = S.root.querySelector(
            '[data-sub-text="' + input.dataset.subFile + '"]'
          );

          if (area) {
            area.value = t;
          }
        } catch (e) {
          message("خوێندنەوەی فایلی ژێرنووس سەرکەوتوو نەبوو.", false);
        }
      });
    });
  }

  function appAuthIsAdmin() {
    var auth =
      window.AppLib &&
      window.AppLib.authState
        ? window.AppLib.authState
        : null;

    if (!auth) {
      return null;
    }

    if (auth.loading) {
      return null;
    }

    if (!auth.user) {
      return false;
    }

    if (auth.profile && auth.profile.is_disabled === true) {
      return false;
    }

    return (
      auth.isAdmin === true ||
      (auth.profile && (
        auth.profile.role === "admin" ||
        auth.profile.role === "owner"
      ))
    );
  }

  async function checkAdminStatus(session) {
    try {
      var appResult = appAuthIsAdmin();

      if (appResult !== null) {
        S.isAdmin = appResult;
        return S.isAdmin;
      }

      S.db = S.db || client();

      var currentSession = session;

      if (!currentSession) {
        var sessionResult = await S.db.auth.getSession();

        if (sessionResult.error) {
          throw sessionResult.error;
        }

        currentSession =
          sessionResult.data &&
          sessionResult.data.session
            ? sessionResult.data.session
            : null;
      }

      var user = currentSession && currentSession.user;

      if (!user) {
        S.isAdmin = false;
        return false;
      }

      var pr = await S.db
        .from(C.profiles)
        .select("id,role,is_disabled")
        .eq("id", user.id)
        .maybeSingle();

      if (pr.error) {
        throw pr.error;
      }

      S.isAdmin = !!(
        pr.data &&
        pr.data.is_disabled !== true &&
        (
          pr.data.role === "admin" ||
          pr.data.role === "owner"
        )
      );

      return S.isAdmin;
    } catch (e) {
      console.error("Cinema admin auth:", e);
      S.isAdmin = false;
      return false;
    }
  }

  function setAdminButtonsVisible(visible) {
    document
      .querySelectorAll("[data-cinema-admin-open]")
      .forEach(function (button) {
        button.style.display = visible ? "" : "none";
        button.setAttribute("aria-hidden", visible ? "false" : "true");
      });
  }

  function ensureAdminButton() {
    var view = getView();

    if (!view) {
      return null;
    }

    var actions = view.querySelector(".cinema-header__actions");

    if (!actions) {
      return null;
    }

    var button = actions.querySelector("[data-cinema-admin-open]");

    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "cinema-action-btn ca-admin-launch";
      button.setAttribute("data-cinema-admin-open", "");
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("aria-label", "بەڕێوەبردنی سینەما");
      button.innerHTML =
        '<i class="fa-solid fa-gear" aria-hidden="true"></i> بەڕێوەبردنی سینەما';

      actions.appendChild(button);
    }

    button.style.display = S.isAdmin ? "" : "none";
    button.setAttribute("aria-hidden", S.isAdmin ? "false" : "true");

    return button;
  }

  function hideAdminCompletely() {
    setAdminButtonsVisible(false);

    if (S.root) {
      S.root.style.display = "none";
      S.root.setAttribute("aria-hidden", "true");
    }

    var catalog = document.getElementById(C.catalog);

    if (catalog) {
      catalog.style.display = "";
    }
  }

  function setButtonExpanded(expanded) {
    document
      .querySelectorAll("[data-cinema-admin-open]")
      .forEach(function (button) {
        button.setAttribute(
          "aria-expanded",
          expanded ? "true" : "false"
        );
      });
  }

  async function load() {
    S.db = S.db || client();

    var r = await S.db
      .from(C.cinemas)
      .select(CINEMA_COLUMNS)
      .order("created_at", { ascending:false });

    if (r.error) {
      throw r.error;
    }

    S.cinemas = Array.isArray(r.data) ? r.data : [];

    return S.cinemas;
  }

  async function openAdminPanel() {
    if (S.opening) {
      return;
    }

    S.opening = true;

    try {
      var ok = await checkAdminStatus();

      if (!ok) {
        hideAdminCompletely();
        alert(
          "ئەم بەشە تەنیا بۆ ئەدمین/ئۆنەرە. تکایە بە هەژماری ئۆنەر بچۆ ژوورەوە."
        );
        return;
      }

      styles();

      S.root = S.root || getRoot();

      if (!S.root) {
        alert("کۆنتەینەری بەڕێوەبردنی سینەما نەدۆزرایەوە.");
        return;
      }

      var catalog = document.getElementById(C.catalog);

      if (catalog) {
        catalog.style.display = "none";
      }

      S.root.style.display = "block";
      S.root.setAttribute("aria-hidden", "false");

      setButtonExpanded(true);

      S.root.innerHTML = `
        <div class="ca-wrap">
          <div class="ca-panel ca-note">خەریکی هێنانی داتاکانی سینەما...</div>
        </div>
      `;

      try {
        await load();
        list();
      } catch (e) {
        console.error("Cinema admin data load:", e);
        showLoadError(e);
      }
    } finally {
      S.opening = false;
    }
  }

  function closeAdminPanel() {
    if (S.root) {
      S.root.style.display = "none";
      S.root.setAttribute("aria-hidden", "true");
    }

    var catalog = document.getElementById(C.catalog);

    if (catalog) {
      catalog.style.display = "";
    }

    setButtonExpanded(false);
  }

  function list() {
    if (!S.root) {
      return;
    }

    S.editing = null;

    S.root.innerHTML = `
      <div class="ca-wrap">
        <div class="ca-panel ca-head">
          <div>
            <h2>بەڕێوەبردنی سینەما</h2>
            <div class="ca-muted">فیلم و کارتۆن زیاد بکە، سێرڤەر و ژێرنووسەکانیان ڕێکبخە.</div>
          </div>

          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button type="button" class="ca-btn ca-primary" data-new>+ زیادکردنی فیلم</button>
            <button type="button" class="ca-btn" data-close-admin>داخستن ✕</button>
          </div>
        </div>

        <div class="ca-panel">
          <div class="ca-list">
            ${
              S.cinemas.length
                ? S.cinemas.map(card).join("")
                : '<div class="ca-empty">هێشتا هیچ فیلم یان کارتۆنێک زیاد نەکراوە.</div>'
            }
          </div>
        </div>
      </div>
    `;
  }

  function card(c) {
    var title = c.title_ku || c.title_en || "بێ ناونیشان";

    return `
      <article class="ca-card">
        <div class="ca-poster">
          ${
            c.poster_url
              ? '<img src="' + esc(c.poster_url) +
                '" alt="' + esc(title) +
                '" onerror="this.onerror=null;this.style.display=\'none\'">'
              : ""
          }
        </div>

        <div>
          <h4 class="ca-title">${esc(title)}</h4>

          <div class="ca-meta">
            <span class="ca-pill">${esc(typeName(c.type))}</span>
            <span class="ca-pill">${esc(statusName(c.status))}</span>
            ${
              c.year != null
                ? '<span class="ca-pill">' + esc(c.year) + "</span>"
                : ""
            }
            ${
              c.rating != null
                ? '<span class="ca-pill">★ ' +
                  esc(Number(c.rating).toFixed(1)) +
                  "</span>"
                : ""
            }
          </div>

          <div class="ca-actions">
            <button type="button" class="ca-btn" data-edit="${esc(c.id)}">دەستکاری</button>
            <button type="button" class="ca-btn ca-danger" data-delete="${esc(c.id)}">سڕینەوە</button>
          </div>
        </div>
      </article>
    `;
  }

  function typeName(v) {
    var found = TYPES.find(function (x) {
      return x[0] === v;
    });

    return found ? found[1] : (v || "—");
  }

  function statusName(v) {
    var found = STATUS.find(function (x) {
      return x[0] === v;
    });

    return found ? found[1] : (v || "—");
  }

  async function edit(id) {
    try {
      var r = await S.db
        .from(C.cinemas)
        .select(CINEMA_COLUMNS)
        .eq("id", id)
        .maybeSingle();

      if (r.error) {
        throw r.error;
      }

      if (!r.data) {
        throw new Error("ناوەڕۆک نەدۆزرایەوە.");
      }

      var sr = await S.db
        .from(C.servers)
        .select("*")
        .eq("cinema_id", id)
        .order("sort_order", { ascending:true });

      if (sr.error) {
        throw sr.error;
      }

      S.editing = id;

      renderForm(rowForm(r.data, sr.data || []));
    } catch (e) {
      console.error("Cinema edit:", e);
      message(
        "نەتوانرا ناوەڕۆکەکە بۆ دەستکاری بکرێتەوە: " +
        errorText(e),
        false
      );
    }
  }

  async function save() {
    if (S.saving) {
      return;
    }

    var f = formData();
    var validationError = validate(f);

    if (validationError) {
      message(validationError, false);
      return;
    }

    var ok = await checkAdminStatus();

    if (!ok) {
      hideAdminCompletely();
      alert("سێشنی ئەدمین بەردەست نییە. تکایە دووبارە بچۆ ژوورەوە.");
      return;
    }

    S.saving = true;

    var saveButton = S.root && S.root.querySelector("[data-save]");

    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent = "خەریکی پاشەکەوتکردنە...";
    }

    try {
      var payload = {
        title_en:f.title_en || null,
        title_ku:f.title_ku || null,
        type:f.type,
        poster_url:f.poster_url || null,
        backdrop_url:f.backdrop_url || null,
        year:nint(f.year),
        duration:f.duration || null,
        rating:nnum(f.rating),
        genres:f.genres
          .split(",")
          .map(function (x) {
            return x.trim();
          })
          .filter(Boolean),
        synopsis_en:f.synopsis_en || null,
        synopsis_ku:f.synopsis_ku || null,
        tmdb_id:nint(f.tmdb_id),
        status:f.status,
        sub_ku:f.sub_ku || null,
        sub_en:f.sub_en || null,
        sub_ar:f.sub_ar || null,
        sub_fa:f.sub_fa || null
      };

      var id = S.editing;

      if (id) {
        var u = await S.db
          .from(C.cinemas)
          .update(payload)
          .eq("id", id)
          .select("id")
          .maybeSingle();

        if (u.error) {
          throw u.error;
        }
      } else {
        var ins = await S.db
          .from(C.cinemas)
          .insert(payload)
          .select("id")
          .single();

        if (ins.error) {
          throw ins.error;
        }

        id = ins.data.id;
      }

      await saveServers(id, f.servers);
      await load();

      if (
        window.XwendngaCinemaUI &&
        typeof window.XwendngaCinemaUI.load === "function"
      ) {
        await window.XwendngaCinemaUI.load();
      }

      list();

      message(
        S.editing
          ? "ناوەڕۆکەکە نوێ کرایەوە."
          : "ناوەڕۆکەکە زیاد کرا.",
        true
      );
    } catch (e) {
      console.error("Cinema save:", e);
      message(
        "پاشەکەوتکردن سەرکەوتوو نەبوو:\n" + errorText(e),
        false
      );
    } finally {
      S.saving = false;
    }
  }

  async function saveServers(cinemaId, servers) {
    var old = await S.db
      .from(C.servers)
      .select("id")
      .eq("cinema_id", cinemaId);

    if (old.error) {
      throw old.error;
    }

    var active = servers.filter(function (s) {
      return s.server_name.trim() || s.video_url.trim();
    });

    if (
      active.length &&
      !active.some(function (s) {
        return s.is_default;
      })
    ) {
      active[0].is_default = true;
    }

    var ids = active
      .filter(function (s) {
        return s.id;
      })
      .map(function (s) {
        return s.id;
      });

    var toRemove = (old.data || [])
      .map(function (s) {
        return s.id;
      })
      .filter(function (id) {
        return ids.indexOf(id) < 0;
      });

    if (toRemove.length) {
      var del = await S.db
        .from(C.servers)
        .delete()
        .in("id", toRemove);

      if (del.error) {
        throw del.error;
      }
    }

    for (var i = 0; i < active.length; i++) {
      var s = active[i];

      var payload = {
        cinema_id:cinemaId,
        episode_id:null,
        server_name:s.server_name.trim() || "سێرڤەر",
        server_type:s.server_type.trim() || "direct",
        video_url:s.video_url.trim(),
        is_default:s.is_default === true,
        sort_order:nint(s.sort_order) || i + 1,
        status:s.status || "published"
      };

      var r;

      if (s.id) {
        r = await S.db
          .from(C.servers)
          .update(payload)
          .eq("id", s.id)
          .eq("cinema_id", cinemaId);
      } else {
        r = await S.db
          .from(C.servers)
          .insert(payload);
      }

      if (r.error) {
        throw r.error;
      }
    }
  }

  async function remove(id) {
    if (!confirm("دڵنیایت لە سڕینەوەی ئەم فیلمە؟")) {
      return;
    }

    var ok = await checkAdminStatus();

    if (!ok) {
      hideAdminCompletely();
      alert("سێشنی ئەدمین بەردەست نییە.");
      return;
    }

    try {
      var sr = await S.db
        .from(C.servers)
        .delete()
        .eq("cinema_id", id);

      if (sr.error) {
        throw sr.error;
      }

      var r = await S.db
        .from(C.cinemas)
        .delete()
        .eq("id", id);

      if (r.error) {
        throw r.error;
      }

      await load();

      if (
        window.XwendngaCinemaUI &&
        typeof window.XwendngaCinemaUI.load === "function"
      ) {
        await window.XwendngaCinemaUI.load();
      }

      list();
      message("ناوەڕۆکەکە سڕایەوە.", true);
    } catch (e) {
      console.error("Cinema delete:", e);
      message(
        "سڕینەوە سەرکەوتوو نەبوو:\n" + errorText(e),
        false
      );
    }
  }

  function bindDelegatedClicks() {
    if (S.clickBound) {
      return;
    }

    S.clickBound = true;

    document.addEventListener("click", function (e) {
      var target = e.target;

      if (!target) {
        return;
      }

      if (target.nodeType !== 1) {
        target = target.parentElement;
      }

      if (!target || typeof target.closest !== "function") {
        return;
      }

      var openButton = target.closest("[data-cinema-admin-open]");

      if (openButton) {
        e.preventDefault();
        e.stopPropagation();
        openAdminPanel();
        return;
      }

      var closeButton = target.closest("[data-close-admin]");

      if (closeButton) {
        e.preventDefault();
        e.stopPropagation();
        closeAdminPanel();
        return;
      }

      var retryButton = target.closest("[data-cinema-admin-retry]");

      if (retryButton) {
        e.preventDefault();
        e.stopPropagation();
        openAdminPanel();
        return;
      }

      var newButton = target.closest("[data-new]");

      if (newButton && S.root && S.root.contains(newButton)) {
        e.preventDefault();
        S.editing = null;
        renderForm(empty());
        return;
      }

      var listButton = target.closest("[data-list]");

      if (listButton && S.root && S.root.contains(listButton)) {
        e.preventDefault();
        list();
        return;
      }

      var editButton = target.closest("[data-edit]");

      if (editButton && S.root && S.root.contains(editButton)) {
        e.preventDefault();
        edit(editButton.getAttribute("data-edit"));
        return;
      }

      var deleteButton = target.closest("[data-delete]");

      if (deleteButton && S.root && S.root.contains(deleteButton)) {
        e.preventDefault();
        remove(deleteButton.getAttribute("data-delete"));
        return;
      }

      var addServerButton = target.closest("[data-add-server]");

      if (addServerButton && S.root && S.root.contains(addServerButton)) {
        e.preventDefault();

        var f = formData();

        f.servers.push({
          id:null,
          server_name:"سێرڤەری سەرەکی",
          server_type:"direct",
          video_url:"",
          is_default:f.servers.length === 0,
          sort_order:String(f.servers.length + 1),
          status:"published"
        });

        renderForm(f);
        return;
      }

      var removeServerButton = target.closest("[data-remove-server]");

      if (
        removeServerButton &&
        S.root &&
        S.root.contains(removeServerButton)
      ) {
        e.preventDefault();

        var form = formData();
        var rows = Array.prototype.slice.call(
          S.root.querySelectorAll("[data-server-row]")
        );
        var row = removeServerButton.closest("[data-server-row]");
        var index = rows.indexOf(row);

        if (index >= 0) {
          form.servers.splice(index, 1);
        }

        if (
          form.servers.length &&
          !form.servers.some(function (x) {
            return x.is_default;
          })
        ) {
          form.servers[0].is_default = true;
        }

        renderForm(form);
      }
    });
  }

  function bindDelegatedChanges() {
    document.addEventListener("change", function (e) {
      var target = e.target;

      if (!target || !S.root || !S.root.contains(target)) {
        return;
      }

      if (target.matches("[data-server-default]") && target.checked) {
        S.root
          .querySelectorAll("[data-server-default]")
          .forEach(function (item) {
            if (item !== target) {
              item.checked = false;
            }
          });
      }
    });
  }

  function bindAuthSync() {
    if (S.authBound) {
      return;
    }

    S.authBound = true;

    try {
      S.db = S.db || client();

      if (
        S.db &&
        S.db.auth &&
        typeof S.db.auth.onAuthStateChange === "function"
      ) {
        S.db.auth.onAuthStateChange(function (_event, session) {
          window.setTimeout(function () {
            checkAdminStatus(session).then(function (ok) {
              if (ok) {
                if (isCinemaActive()) {
                  ensureAdminButton();
                }
              } else {
                hideAdminCompletely();
              }
            });
          }, 0);
        });
      }
    } catch (e) {
      console.error("Cinema auth listener:", e);
    }
  }

  function startObserver() {
    if (S.observerBound || !document.body) {
      return;
    }

    var view = getView();

    if (!view) {
      return;
    }

    S.observerBound = true;

    var scheduled = false;

    function schedule() {
      if (scheduled) {
        return;
      }

      scheduled = true;

      window.setTimeout(function () {
        scheduled = false;

        if (!isCinemaActive()) {
          if (S.root && S.root.style.display !== "none") {
            closeAdminPanel();
          }
          return;
        }

        if (S.isAdmin) {
          ensureAdminButton();
        }
      }, 0);
    }

    var observer = new MutationObserver(schedule);

    observer.observe(view, {
      childList:true,
      subtree:true
    });

    S.observer = observer;
  }

  function bindRouteSync() {
    document.addEventListener("xwendnga:routechange", function (event) {
      var route =
        event &&
        event.detail
          ? event.detail.route
          : null;

      if (route === "cinema") {
        window.setTimeout(function () {
          checkAdminStatus().then(function (ok) {
            if (ok) {
              ensureAdminButton();
            } else {
              hideAdminCompletely();
            }
          });
        }, 0);
      } else {
        closeAdminPanel();
      }
    });
  }

  function init() {
    styles();

    S.root = getRoot();

    bindDelegatedClicks();
    bindDelegatedChanges();
    bindAuthSync();
    bindRouteSync();
    startObserver();

    checkAdminStatus().then(function (ok) {
      if (!ok) {
        hideAdminCompletely();
        return;
      }

      if (isCinemaActive()) {
        ensureAdminButton();
      }
    });
  }

  window.XwendngaCinemaAdmin = {
    checkAdminStatus:checkAdminStatus,
    open:openAdminPanel,
    close:closeAdminPanel
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once:true });
  } else {
    init();
  }
})();
