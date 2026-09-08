const PAGE_ROUTES = { dashboard: "Dashboard", products: "Products", sales: "Sales", reports: "Reports", settings: "Settings", updates: "Updates", admin: "Admin" };

function pageFromLocation() {
  const segment = location.pathname.split("/").filter(Boolean)[0] || "Dashboard";
  const pageId = Object.keys(PAGE_ROUTES).find(key => PAGE_ROUTES[key].toLowerCase() === segment.toLowerCase());
  return pageId || "dashboard";
}

function showPage(pageId, updateHistory = true) {
  if (!PAGE_ROUTES[pageId]) pageId = "dashboard";
  if (pageId === "admin" && localStorage.getItem("igh_kinglegacy_is_admin") !== "1") {
    if (!localStorage.getItem(AUTH_TOKEN_KEY)) sessionStorage.setItem("igh_pending_admin_route", "1");
    toast("หน้านี้สำหรับ Admin เท่านั้น", "error");
    pageId = "dashboard";
    updateHistory = false;
    if (location.pathname.toLowerCase() === "/admin") history.replaceState({ pageId }, "", "/Dashboard");
  }
  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  document.getElementById("page-" + pageId).classList.remove("hidden");
  document.querySelectorAll("[data-nav]").forEach(el => {
    el.classList.toggle("nav-active", el.dataset.nav === pageId);
  });
  if (pageId === "dashboard") renderDashboard();
  if (pageId === "products") renderProducts();
  if (pageId === "sales") renderSalesHistory();
  if (pageId === "reports") renderReports();
  if (pageId === "updates") renderUpdatesPage();
  if (updateHistory && location.pathname.toLowerCase() !== `/${PAGE_ROUTES[pageId].toLowerCase()}`) history.pushState({ pageId }, "", `/${PAGE_ROUTES[pageId]}`);
  window.scrollTo({ top: 0 });
}

function renderUpdatesPage() {
  const log = document.getElementById("updates-page-log");
  const version = document.getElementById("updates-page-version");
  if (!log) return;
  if (version) version.textContent = APP_VERSION;
  log.innerHTML = APP_CHANGELOG.map(entry => `<div class="glass-card rounded-2xl p-4 border-l-2 border-indigo-400/70"><div class="flex items-center justify-between gap-2"><strong class="text-sm">${entry.version}</strong><span class="text-[11px] text-slate-400">${t("update_date_prefix")} ${entry.date}</span></div><ul class="mt-2 text-sm text-slate-300 list-disc list-inside">${entry.changes.map(change => `<li>${change}</li>`).join("")}</ul></div>`).join("");
}

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
  expiry.textContent = result.expiresAt ? `กำลังใช้งาน • หมดอายุ ${new Date(result.expiresAt).toLocaleString("th-TH")}` : "กำลังใช้งาน • อันลิมิต";
  if (toggle) toggle.textContent = "แสดงคีย์";
}

function applyTheme(theme) {
  document.documentElement.classList.toggle("light", theme === "light");
  localStorage.setItem(THEME_KEY, theme);
}

function initSkeleton(cb) {
  const skel = document.getElementById("app-skeleton");
  const app = document.getElementById("app-root");
  setTimeout(() => {
    skel.classList.add("hidden");
    app.classList.remove("hidden");
    cb();
  }, 350);
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
  document.getElementById("stock-alert-slider").value = state.settings.stockAlert;
  document.getElementById("stock-alert-value").textContent = state.settings.stockAlert;
  const catList = document.getElementById("settings-category-list");
  catList.innerHTML = state.settings.categories.map(c => `
    <span class="px-2.5 py-1 rounded-full text-xs bg-slate-700/60 border border-slate-600/50 flex items-center gap-1.5">
      ${c}
      <button data-cat="${c}" class="remove-cat-btn text-slate-400 hover:text-rose-400" aria-label="${t('aria_delete')}">×</button>
    </span>`).join("");
}

document.addEventListener("DOMContentLoaded", () => {
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
    event.currentTarget.textContent = showing ? "แสดงคีย์" : "ซ่อนคีย์";
  });
  document.getElementById("copy-current-key")?.addEventListener("click", async event => {
    const key = document.getElementById("user-key-settings")?.dataset.key || localStorage.getItem(AUTH_KEY_KEY) || "";
    if (await copyText(key)) { event.currentTarget.textContent = "คัดลอกแล้ว"; setTimeout(() => { event.currentTarget.textContent = "คัดลอก"; }, 1600); }
  });

  initSkeleton(() => {
    renderProducts();
    renderCrafting();
    renderSalesHistory();
    renderDashboard();
    renderReports();
    renderSettings();
    showPage(pageFromLocation(), false);
  });

  // Navigation (sidebar + bottom nav)
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
  document.getElementById("import-backup-input").addEventListener("change", (e) => {
    const f = e.target.files[0];
    if (f) importBackup(f);
    e.target.value = "";
  });
  document.getElementById("export-products-csv-btn").addEventListener("click", exportProductsCSV);
  document.getElementById("export-sales-csv-btn").addEventListener("click", exportSalesCSV);
});

function openMobileDrawer() {
  document.getElementById("mobile-nav-drawer")?.classList.add("nav-drawer-open");
  document.getElementById("mobile-nav-scrim")?.classList.remove("hidden");
  document.getElementById("mobile-menu-btn")?.setAttribute("aria-expanded", "true");
  document.getElementById("mobile-nav-drawer")?.setAttribute("aria-hidden", "false");
  document.body.classList.add("overflow-hidden");
}

function closeMobileDrawer() {
  document.getElementById("mobile-nav-drawer")?.classList.remove("nav-drawer-open");
  document.getElementById("mobile-nav-scrim")?.classList.add("hidden");
  document.getElementById("mobile-menu-btn")?.setAttribute("aria-expanded", "false");
  document.getElementById("mobile-nav-drawer")?.setAttribute("aria-hidden", "true");
  document.body.classList.remove("overflow-hidden");
}
