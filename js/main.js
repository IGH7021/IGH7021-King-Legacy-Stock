function updateKeySettings(result = {}) {
  const panel = document.getElementById("user-key-settings");
  const value = document.getElementById("current-key-value");
  const expiry = document.getElementById("current-key-expiry");
  const toggle = document.getElementById("toggle-key-visibility");
  if (!panel || !value || !expiry) return;
  const key = localStorage.getItem(AUTH_KEY_KEY) || pendingAuthKey || "";
  const isAdmin = result.admin || localStorage.getItem("igh_kinglegacy_is_admin") === "1";
  panel.classList.toggle("hidden", isAdmin);
  panel.dataset.key = key;
  value.textContent = "•".repeat(Math.min(24, Math.max(8, key.length)));
  const locale = currentLang === "th" ? "th-TH" : "en-US";
  expiry.textContent = result.expiresAt ? t("key_active_expires", { date: new Date(result.expiresAt).toLocaleString(locale) }) : t("key_active_unlimited");
  if (toggle) toggle.textContent = toggle.dataset.showing === "true" ? t("key_hide") : t("key_show");
}

function applyTheme(theme) {
  document.documentElement.classList.toggle("light", theme === "light");
  localStorage.setItem(THEME_KEY, theme);
}

function initializeApp(cb) {
  const app = document.getElementById("app-root");
  app.classList.remove("hidden");
  cb();
  app.setAttribute("aria-busy", "false");
}

function initFloatingProducts() {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || window.matchMedia?.("(pointer: coarse)").matches) return;
  const products = state.products.filter(product => product.image).slice(0, 7);
  if (!products.length) return;
  const layer = document.createElement("div");
  layer.className = "floating-products";
  layer.setAttribute("aria-hidden", "true");
  products.forEach((product, index) => {
    const item = document.createElement("span");
    item.className = "floating-product";
    item.style.setProperty("--float-x", `${12 + (index * 13) % 78}%`);
    item.style.setProperty("--float-y", `${12 + (index * 23) % 72}%`);
    item.style.setProperty("--float-depth", `${index * 1.7}px`);
    item.style.setProperty("--float-delay", `${index * -1.2}s`);
    item.innerHTML = `<img src="${product.image}" alt="">`;
    layer.appendChild(item);
  });
  document.body.appendChild(layer);
  let frame = 0;
  document.addEventListener("mousemove", event => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      const x = (event.clientX / window.innerWidth - 0.5) * 2;
      const y = (event.clientY / window.innerHeight - 0.5) * 2;
      layer.style.setProperty("--mouse-x", `${x * 18}px`);
      layer.style.setProperty("--mouse-y", `${y * 18}px`);
      frame = 0;
    });
  }, { passive: true });
}

function renderSettings() {
  document.getElementById("app-version").textContent = APP_VERSION;
  const stockAlertSlider = document.getElementById("stock-alert-slider");
  stockAlertSlider.value = state.settings.stockAlert;
  updateStockAlertSliderProgress(stockAlertSlider);
  document.getElementById("stock-alert-value").textContent = state.settings.stockAlert;
  const catList = document.getElementById("settings-category-list");
  catList.innerHTML = state.settings.categories.map(c => `
    <span class="px-2.5 py-1 rounded-full text-xs bg-slate-700/60 border border-slate-600/50 flex items-center gap-1.5">
      ${c}
      <button data-cat="${c}" class="remove-cat-btn text-slate-400 hover:text-rose-400" aria-label="${t('aria_delete')}">×</button>
    </span>`).join("");
}

function updateStockAlertSliderProgress(slider) {
  const min = Number(slider.min) || 0;
  const max = Number(slider.max);
  const value = Number(slider.value);
  const progress = max > min ? Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100)) : 0;
  slider.style.setProperty("--slider-progress", `${progress}%`);
}

document.addEventListener("DOMContentLoaded", () => {
  initializeNumberSteppers();
  loadState();
  initFloatingProducts();
  bindModalDismiss();
  applyTheme(localStorage.getItem(THEME_KEY) || "dark");
  applyStaticTranslations();
  document.getElementById("toggle-key-visibility")?.addEventListener("click", event => {
    const panel = document.getElementById("user-key-settings");
    const value = document.getElementById("current-key-value");
    const key = panel?.dataset.key || localStorage.getItem(AUTH_KEY_KEY) || "";
    const showing = event.currentTarget.dataset.showing === "true";
    value.textContent = showing ? "•".repeat(Math.min(24, Math.max(8, key.length))) : key;
    event.currentTarget.dataset.showing = String(!showing);
    event.currentTarget.textContent = showing ? t("key_show") : t("key_hide");
  });
  document.getElementById("copy-current-key")?.addEventListener("click", async event => {
    const key = document.getElementById("user-key-settings")?.dataset.key || localStorage.getItem(AUTH_KEY_KEY) || "";
    if (await copyText(key)) { event.currentTarget.textContent = t("admin_copied"); setTimeout(() => { event.currentTarget.textContent = t("admin_copy"); }, 1600); }
  });

  initializeApp(() => {
    renderProducts();
    renderCrafting();
    renderSalesHistory();
    renderDashboard();
    renderReports();
    renderSettings();
    showPage(pageFromLocation(), false);
  });

  // App-wide navigation drawer
  document.querySelectorAll("[data-nav]").forEach(el => {
    el.addEventListener("click", () => { showPage(el.dataset.nav); closeMobileDrawer(); });
  });
  window.addEventListener("popstate", () => showPage(pageFromLocation(), false));

  const menuButton = document.getElementById("mobile-menu-btn");
  const closeButton = document.getElementById("mobile-menu-close");
  const scrim = document.getElementById("mobile-nav-scrim");
  menuButton?.addEventListener("click", openMobileDrawer);
  closeButton?.addEventListener("click", closeMobileDrawer);
  scrim?.addEventListener("click", closeMobileDrawer);
  document.addEventListener("keydown", event => {
    const drawer = document.getElementById("mobile-nav-drawer");
    if (!drawer?.classList.contains("nav-drawer-open")) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeMobileDrawer();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...drawer.querySelectorAll('button:not([disabled]):not(.hidden), a[href], [tabindex]:not([tabindex="-1"])')]
      .filter(element => element.getClientRects().length > 0);
    if (!focusable.length) { event.preventDefault(); drawer.focus(); return; }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });

  // Theme toggle
  document.querySelectorAll(".theme-toggle-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const isLight = document.documentElement.classList.contains("light");
      applyTheme(isLight ? "dark" : "light");
    });
  });

  const backToTop = document.getElementById("products-back-to-top");
  const updateBackToTop = () => {
    backToTop?.classList.toggle("back-to-top-visible", window.scrollY > 300);
  };
  window.addEventListener("scroll", updateBackToTop, { passive: true });
  backToTop?.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

  // Language toggle
  document.querySelectorAll(".lang-btn").forEach(btn => {
    btn.addEventListener("click", () => setLang(btn.dataset.lang));
  });

  // Settings: stock alert slider
  const slider = document.getElementById("stock-alert-slider");
  slider.addEventListener("input", (e) => {
    updateStockAlertSliderProgress(e.currentTarget);
    document.getElementById("stock-alert-value").textContent = e.target.value;
  });
  slider.addEventListener("change", (e) => {
    state.settings.stockAlert = parseInt(e.target.value);
    saveState();
    renderProducts();
    toast(t("toast_alert_updated"));
  });

  // Settings: add category
  document.getElementById("add-category-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("new-category-input");
    const val = input.value.trim();
    if (!val) return;
    if (state.settings.categories.includes(val)) { toast(t("toast_category_exists"), "error"); return; }
    state.settings.categories.push(val);
    saveState();
    renderSettings();
    renderCategoryOptions();
    input.value = "";
    toast(t("toast_category_added"));
  });
  document.getElementById("settings-category-list").addEventListener("click", (e) => {
    const btn = e.target.closest(".remove-cat-btn");
    if (!btn) return;
    const cat = btn.dataset.cat;
    const inUse = state.products.some(p => p.category === cat);
    if (inUse) { toast(t("toast_category_in_use"), "error"); return; }
    state.settings.categories = state.settings.categories.filter(c => c !== cat);
    saveState(); renderSettings(); renderCategoryOptions();
  });

  // Backup / Restore / CSV
  document.getElementById("export-backup-btn").addEventListener("click", exportBackup);
  document.getElementById("clear-account-data-btn")?.addEventListener("click", async event => {
    if (!window.confirm(t("confirm_clear_account_data"))) return;
    const button = event.currentTarget;
    button.disabled = true;
    try { await clearAccountData(); }
    finally { button.disabled = false; }
  });
  document.getElementById("import-backup-input").addEventListener("change", (e) => {
    const f = e.target.files[0];
    if (f) importBackup(f);
    e.target.value = "";
  });
  document.getElementById("export-products-csv-btn").addEventListener("click", exportProductsCSV);
  document.getElementById("export-sales-csv-btn").addEventListener("click", exportSalesCSV);

  document.querySelectorAll("[data-settings-tab]").forEach(button => button.addEventListener("click", () => {
    const tab = button.dataset.settingsTab;
    document.getElementById("page-settings")?.setAttribute("data-settings-active", tab);
    document.querySelectorAll("[data-settings-tab]").forEach(item => {
      const selected = item === button;
      item.classList.toggle("is-active", selected);
      item.setAttribute("aria-selected", String(selected));
    });
  }));
});

function openMobileDrawer() {
  const drawer = document.getElementById("mobile-nav-drawer");
  const scrim = document.getElementById("mobile-nav-scrim");
  const app = document.getElementById("app-root");
  const menuButton = document.getElementById("mobile-menu-btn");
  if (!drawer || drawer.classList.contains("nav-drawer-open")) return;
  menuButton?.setAttribute("aria-expanded", "true");
  menuButton?.setAttribute("aria-label", t("nav_close"));
  drawer.classList.add("nav-drawer-open");
  drawer.setAttribute("aria-hidden", "false");
  drawer.inert = false;
  if (scrim) { scrim.classList.add("nav-scrim-open"); scrim.setAttribute("aria-hidden", "false"); }
  if (app) app.inert = true;
  document.body.classList.add("nav-open");
  drawer.querySelector(".drawer-close")?.focus();
}

function closeMobileDrawer() {
  const drawer = document.getElementById("mobile-nav-drawer");
  const scrim = document.getElementById("mobile-nav-scrim");
  const app = document.getElementById("app-root");
  const menuButton = document.getElementById("mobile-menu-btn");
  if (!drawer || !drawer.classList.contains("nav-drawer-open")) return;
  drawer.classList.remove("nav-drawer-open");
  drawer.setAttribute("aria-hidden", "true");
  drawer.inert = true;
  if (scrim) { scrim.classList.remove("nav-scrim-open"); scrim.setAttribute("aria-hidden", "true"); }
  if (app) app.inert = false;
  document.body.classList.remove("nav-open");
  menuButton?.setAttribute("aria-expanded", "false");
  menuButton?.setAttribute("aria-label", t("nav_open"));
  menuButton?.focus();
}
