const PAGE_ROUTES = { dashboard: "Dashboard", products: "Products", sales: "Sales", reports: "Reports", settings: "Settings", admin: "Admin" };
let activePageId = null;

function pageFromLocation() {
  const segment = location.pathname.split("/").filter(Boolean)[0] || "Dashboard";
  if (segment.toLowerCase() === "updates") {
    const isAdmin = localStorage.getItem("igh_kinglegacy_is_admin") === "1";
    history.replaceState({ pageId: isAdmin ? "admin" : "dashboard" }, "", isAdmin ? "/Admin" : "/Dashboard");
    if (isAdmin) sessionStorage.setItem("igh_pending_admin_tab", "updates");
    return isAdmin ? "admin" : "dashboard";
  }
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
  activePageId = pageId;
  if (updateHistory && location.pathname.toLowerCase() !== `/${PAGE_ROUTES[pageId].toLowerCase()}`) history.pushState({ pageId }, "", `/${PAGE_ROUTES[pageId]}`);
  if (pageId === "admin" && sessionStorage.getItem("igh_pending_admin_tab") === "updates") {
    sessionStorage.removeItem("igh_pending_admin_tab");
    document.getElementById("admin-updates-tab")?.click();
  }
  window.scrollTo({ top: 0 });
}
