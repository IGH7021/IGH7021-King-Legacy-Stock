const PAGE_ROUTES = { dashboard: "Dashboard", products: "Products", sales: "Sales", reports: "Reports", settings: "Settings", updates: "Updates", admin: "Admin" };
let activePageId = null;

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
  if (activePageId === pageId) return;
  document.querySelectorAll(".page").forEach(page => page.classList.add("hidden"));
  document.getElementById("page-" + pageId).classList.remove("hidden");
  document.querySelectorAll("[data-nav]").forEach(element => {
    element.classList.toggle("nav-active", element.dataset.nav === pageId);
  });
  if (pageId === "dashboard") renderDashboard();
  if (pageId === "products") renderProducts();
  if (pageId === "sales") renderSalesHistory();
  if (pageId === "reports") renderReports();
  if (pageId === "updates") renderUpdatesPage();
  activePageId = pageId;
  if (updateHistory && location.pathname.toLowerCase() !== `/${PAGE_ROUTES[pageId].toLowerCase()}`) history.pushState({ pageId }, "", `/${PAGE_ROUTES[pageId]}`);
  window.scrollTo({ top: 0 });
}

function renderUpdatesPage() {
  const log = document.getElementById("updates-page-log");
  const version = document.getElementById("updates-page-version");
  if (!log) return;
  if (version) version.textContent = APP_VERSION;
  log.innerHTML = APP_CHANGELOG.map(entry => `<div class="glass-card rounded-2xl p-4 border-l-2 border-indigo-400/70"><div class="flex items-center justify-between gap-2"><strong class="text-sm">${entry.version}</strong><span class="text-[11px] text-slate-400">${t("update_date_prefix")} ${entry.date} • ${t("update_time_prefix")} ${entry.time || t("update_time_unknown")}</span></div><ul class="mt-2 text-sm text-slate-300 list-disc list-inside">${entry.changes.map(change => `<li>${change}</li>`).join("")}</ul></div>`).join("");
}