import { apiInitializer } from "discourse/lib/api";

export default apiInitializer((api) => {
  const KEY_PREFIX = "category_calendar_my_events_";

  function currentUsername() {
    const user = api.getCurrentUser && api.getCurrentUser();
    return user?.username ?? null;
  }

  function categoryIdFromRouter() {
    try {
      const router = api.container.lookup("service:router");
      const attrs = router?.currentRoute?.attributes;
      if (attrs?.category?.id) return String(attrs.category.id);
      const params = router?.currentRoute?.params;
      if (params?.category_slug_path_with_id) {
        const m = String(params.category_slug_path_with_id).match(/-(\d+)$/);
        if (m) return m[1];
      }
    } catch (e) {}
    return null;
  }

  function getSiteSettings() {
    try {
      return api.container.lookup("service:site-settings");
    } catch (e) {
      return null;
    }
  }

  function parseCalendarCategories(raw = "") {
    return raw
      .split("|")
      .filter(Boolean)
      .map((stringSetting) => {
        const data = {};
        stringSetting
          .split(";")
          .filter(Boolean)
          .forEach((s) => {
            const parts = s.split("=");
            data[parts[0]] = parts[1];
          });
        return data;
      });
  }

  function categoryHasCalendar(catId) {
    const siteSettings = getSiteSettings();
    if (!siteSettings) return false;
    if (!siteSettings.discourse_post_event_enabled) return false;
    if (siteSettings.login_required && !api.getCurrentUser?.()) return false;
    if (!catId) return false;

    const parsed = parseCalendarCategories(siteSettings.calendar_categories || "");
    if (parsed.find((item) => item.categoryId === String(catId))) return true;

    const eventsCategories = (siteSettings.events_calendar_categories || "")
      .split("|")
      .filter(Boolean);
    if (eventsCategories.includes(String(catId))) return true;

    return false;
  }

  function storeKey(catId) {
    return `${KEY_PREFIX}${catId || "global"}`;
  }

  function isMineActive(catId) {
    try {
      return localStorage.getItem(storeKey(catId)) === "1";
    } catch (e) {
      return false;
    }
  }

  function setMineActive(catId, val) {
    try {
      localStorage.setItem(storeKey(catId), val ? "1" : "0");
    } catch (e) {}
  }

  // minimal CSS (safe defaults, uses --primary if present)
  if (!window.__cc_segmented_styles_installed) {
    window.__cc_segmented_styles_installed = true;
    const style = document.createElement("style");
    style.textContent = `
      .cc-segmented-toggle { display:inline-flex; border:1px solid var(--secondary-border); border-radius:4px; overflow:hidden; height:32px; }
      .cc-seg-half { padding:0 10px; cursor:pointer; user-select:none; font-weight:600; text-transform:uppercase; font-size:12px; line-height:32px; flex:1; text-align:center; background:transparent; border:0; }
      .cc-seg-half.right { border-left:1px solid var(--secondary-border); }
    `;
    document.head.appendChild(style);
  }

  // ajax prefilter: add attending_user when mine is active
  if (window.jQuery && !window.__cc_my_events_prefilter_installed) {
    window.__cc_my_events_prefilter_installed = true;
    jQuery.ajaxPrefilter(function (options) {
      try {
        const url = options.url || "";
        if (!url.includes("/discourse-post-event/events")) return;
        const catId = categoryIdFromRouter();
        if (!categoryHasCalendar(catId)) return;
        if (!isMineActive(catId)) return;
        const username = currentUsername();
        if (!username) return;
        if (typeof options.data === "string") {
          if (options.data.length > 0) options.data += "&";
          options.data += "attending_user=" + encodeURIComponent(username);
        } else {
          options.data = options.data || {};
          options.data.attending_user = username;
        }
      } catch (e) {}
    });
  }

  // helpers: parse css color and pick black/white contrast
  function parseCssColor(str) {
    if (!str) return null;
    str = str.trim();
    if (str.startsWith("rgb")) {
      const m = str.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const parts = m[1].split(",").map((p) => parseFloat(p.trim()));
      return { r: parts[0], g: parts[1], b: parts[2] };
    }
    if (str.startsWith("#")) {
      let hex = str.slice(1);
      if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
      const bigint = parseInt(hex, 16);
      return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
    }
    return null;
  }

  function luminance({ r, g, b }) {
    const srgb = [r / 255, g / 255, b / 255].map((c) =>
      c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    );
    return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
  }

  function contrastTextForCssColor(cssColor) {
    const parsed = parseCssColor(cssColor);
    if (!parsed) return "#000";
    return luminance(parsed) > 0.5 ? "#000" : "#fff";
  }

  function getPrimaryCss() {
    const doc = document.documentElement;
    let val = getComputedStyle(doc).getPropertyValue("--primary") || "";
    val = val.trim();
    if (!val) val = "#2b90ff";
    return val;
  }

  function createSegmented(catId) {
    const wrapper = document.createElement("div");
    wrapper.className = "cc-segmented-toggle";

    const left = document.createElement("button");
    left.type = "button";
    left.className = "cc-seg-half left";
    left.textContent = "ALL";

    const right = document.createElement("button");
    right.type = "button";
    right.className = "cc-seg-half right";
    right.textContent = "MY";

    function applyState() {
      const activeIsMine = isMineActive(catId);
      const primaryCss = getPrimaryCss();
      const contrast = contrastTextForCssColor(primaryCss);

      if (activeIsMine) {
        left.style.backgroundColor = "transparent";
        left.style.color = "";
        right.style.backgroundColor = primaryCss;
        right.style.color = contrast;
      } else {
        right.style.backgroundColor = "transparent";
        right.style.color = "";
        left.style.backgroundColor = primaryCss;
        left.style.color = contrast;
      }
    }

    left.addEventListener("click", () => {
      setMineActive(catId, false);
      applyState();
      window.location.reload();
    });

    right.addEventListener("click", () => {
      if (!currentUsername()) {
        window.location.href = "/session/new";
        return;
      }
      setMineActive(catId, true);
      applyState();
      window.location.reload();
    });

    wrapper.appendChild(left);
    wrapper.appendChild(right);
    wrapper.applyState = applyState;
    return wrapper;
  }

  function attachToListControls() {
    const catId = categoryIdFromRouter();
    if (!catId) return;
    if (!categoryHasCalendar(catId)) return;

    // const listControls = document.querySelectorAll(".fc-header-toolbar");
    const listControls = document.querySelectorAll(".list-controls");
    listControls.forEach((ctrl) => {
      if (!ctrl || ctrl.querySelector(".cc-segmented-toggle")) return;
      const seg = createSegmented(catId);
      ctrl.insertBefore(seg, ctrl.firstChild);
      seg.applyState();
    });
  }

  // lifecycle hooks
  document.addEventListener("DOMContentLoaded", () => setTimeout(attachToListControls, 50));
  api.onPageChange(() => setTimeout(attachToListControls, 50));
  window.addEventListener("popstate", () => setTimeout(attachToListControls, 50));
  const observer = new MutationObserver(() => attachToListControls());
  observer.observe(document.body, { childList: true, subtree: true });

  // initial attempt
  setTimeout(() => attachToListControls(), 150);
});
