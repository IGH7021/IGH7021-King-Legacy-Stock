function showPage(pageId) {
  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  document.getElementById("page-" + pageId).classList.remove("hidden");
  document.querySelectorAll("[data-nav]").forEach(el => {
    el.classList.toggle("nav-active", el.dataset.nav === pageId);
  });
  if (pageId === "dashboard") renderDashboard();
  if (pageId === "products") renderProducts();
  if (pageId === "sales") renderSalesHistory();
  if (pageId === "reports") renderReports();
  window.scrollTo({ top: 0 });
}

function applyTheme(theme) {
  document.documentElement.classList.toggle("light", theme === "light");
  localStorage.setItem(THEME_KEY, theme);
  document.querySelectorAll(".theme-icon").forEach(el => el.textContent = theme === "light" ? "🌙" : "☀️");
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

function renderSettings() {
  document.getElementById("app-version").textContent = APP_VERSION;
  document.getElementById("update-log").innerHTML = APP_CHANGELOG.map(entry => `
    <div class="border-l-2 border-indigo-400/70 pl-3">
      <div class="flex items-center justify-between gap-2">
        <strong class="text-sm">${entry.version}</strong>
        <span class="text-[11px] text-slate-400">${t("update_date_prefix")} ${entry.date}</span>
      </div>
      <ul class="mt-1 text-xs text-slate-400 list-disc list-inside">${entry.changes.map(change => `<li>${change}</li>`).join("")}</ul>
    </div>`).join("");
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
  bindModalDismiss();
  applyTheme(localStorage.getItem(THEME_KEY) || "dark");
  applyStaticTranslations();

  initSkeleton(() => {
    renderProducts();
    renderSalesHistory();
    renderDashboard();
    renderReports();
    renderSettings();
    showPage("dashboard");
  });

  // Navigation (sidebar + bottom nav)
  document.querySelectorAll("[data-nav]").forEach(el => {
    el.addEventListener("click", () => showPage(el.dataset.nav));
  });

  // Theme toggle
  document.querySelectorAll(".theme-toggle-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const isLight = document.documentElement.classList.contains("light");
      applyTheme(isLight ? "dark" : "light");
    });
  });

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
