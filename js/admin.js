const ADMIN_ANALYTICS_ENABLED = false;
const ADMIN_ANALYTICS_TABS = new Set(["overview", "users", "inventory", "orders"]);

function adminHeaders() { return { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem(AUTH_TOKEN_KEY)}` }; }
function enableAdminUi() {
  document.querySelectorAll(".admin-only:not(.page)").forEach(el => el.classList.remove("hidden"));
  bindAdminKeyFilters();
  loadAdminKeys().catch(error => { if (error.message === t("admin_access_denied")) { document.querySelectorAll(".admin-only").forEach(el => el.classList.add("hidden")); } else toast(error.message, "error"); });
  if (ADMIN_ANALYTICS_ENABLED) {
    loadAdminOverview();
    if (!adminOverviewTimer) adminOverviewTimer = setInterval(() => {
      if (document.visibilityState !== "visible" || document.getElementById("page-admin")?.classList.contains("hidden")) return;
      if (!document.getElementById("admin-overview-panel")?.classList.contains("hidden")) loadAdminOverview();
    }, 60000);
  }
  if (!adminRequestsTimer) adminRequestsTimer = setInterval(() => {
    if (document.visibilityState !== "visible") return;
    if (!document.getElementById("admin-inbox-panel")?.classList.contains("hidden")) {
      loadAdminInbox().catch(error => console.error("Could not refresh Admin inbox:", error));
    }
  }, 20000);
}
function formatRemaining(ms) {
  if (ms === null) return t("admin_key_time_permanent");
  if (ms <= 0) return t("admin_key_time_expired");
  const minutes = Math.floor(ms / 60000);
  return minutes < 60 ? t("admin_key_time_minutes", { n: minutes }) : t("admin_key_time_hours", { h: Math.floor(minutes / 60), m: minutes % 60 });
}
function keyTimeLabel(key) {
  if (key.archived) return t("admin_key_archived");
  if (key.waitingForFirstUse) return t("admin_key_waiting", { time: formatRemaining(key.durationMs) });
  if (!key.permanent && key.remainingMs <= 0 && key.extensionRemainingMs > 0) return t("admin_key_extension", { time: formatRemaining(key.extensionRemainingMs) });
  return formatRemaining(key.remainingMs);
}
function keyTypeLabel(key) { return t(key.archived ? "admin_key_type_history" : key.admin ? "admin_key_type_admin" : key.permanent ? "admin_key_type_unlimited" : "admin_key_type_timed"); }
function keyTypeClass(key) { if (key.admin) return "bg-orange-500/15 text-orange-300"; if (key.permanent) return "bg-slate-700/60 text-slate-300"; return "bg-amber-500/15 text-amber-300"; }
let adminKeyFilter = "all";
let adminKeysCache = [];
let adminFiltersBound = false;
let adminRequestsTimer = null;
let adminRequestsCache = [];
let adminRequestsLoadError = false;
let adminKeysHasLoaded = false;
let adminKeysLoadError = false;
let adminSuggestions = [];
let adminInboxLoaded = false;
let adminSuggestionsError = false;
let adminUpdatesLoaded = false;
let adminUpdatesError = false;
let adminUpdates = [];
let adminOverview = null;
let adminOverviewLoaded = false;
let adminOverviewFailed = false;
let adminOverviewTimer = null;
let adminRevenueChart = null;
let adminSelectedUserId = "";
let adminUserDetail = null;
let adminUserDetailError = false;

function adminFormatDate(value) {
  const date = typeof value === "number" ? value : Date.parse(value);
  return Number.isFinite(date) ? fmtDate(date) : "—";
}

function adminStatCard(label, value, accent = "") {
  return `<article class="admin-overview-stat glass-card rounded-xl p-3"><span class="text-xs text-slate-400">${escapeAdminRequestText(label)}</span><strong class="${accent}">${escapeAdminRequestText(value)}</strong></article>`;
}

function renderAdminOverviewStats() {
  const stats = document.getElementById("admin-overview-stats");
  if (!stats || stats.getAttribute("aria-busy") === "true") return;
  if (adminOverviewFailed || !adminOverview) {
    stats.replaceChildren();
    return;
  }
  const summary = adminOverview.summary;
  const cards = [
    [t("admin_metric_online"), fmtNum(summary.onlineUsers), "text-emerald-300"],
    [t("admin_metric_accessed"), fmtNum(summary.accessedToday), "text-sky-300"],
    [t("admin_metric_revenue"), fmtBaht(summary.todayRevenue), "text-amber-300"],
    [t("admin_metric_sales"), fmtNum(summary.totalSalesRecords), "text-indigo-300"],
    [t("admin_metric_users"), fmtNum(summary.totalUsers), ""],
    [t("admin_metric_orders"), fmtNum(summary.ordersToday), ""],
    [t("admin_metric_customers"), fmtNum(summary.customersToday), ""],
    [t("admin_metric_products"), fmtNum(summary.productRecords), ""],
    [t("admin_metric_low_stock"), fmtNum(summary.lowStockCount), summary.lowStockCount ? "text-rose-300" : "text-emerald-300"],
  ];
  stats.innerHTML = cards.map(([label, value, accent]) => adminStatCard(label, value, accent)).join("");
}

function renderAdminRevenueTrend() {
  if (!adminOverview) return;
  const canvas = document.getElementById("admin-revenue-chart");
  const table = document.getElementById("admin-revenue-chart-table");
  if (!canvas || !table) return;
  const trend = adminOverview.revenueTrend || [];
  const labels = trend.map(item => {
    const time = APP_TIME.startOfDateKey(item.date);
    return Number.isFinite(time)
      ? new Date(time).toLocaleDateString(currentLang === "th" ? "th-TH" : "en-US", { timeZone: APP_TIME.TIME_ZONE, day: "numeric", month: "short" })
      : item.date;
  });
  table.innerHTML = `<table><caption>${escapeAdminRequestText(t("admin_trend_title"))}</caption><tbody>${trend.map((item, index) => `<tr><th>${escapeAdminRequestText(labels[index])}</th><td>${escapeAdminRequestText(fmtBaht(item.revenue))}</td></tr>`).join("")}</tbody></table>`;
  if (typeof Chart === "undefined") {
    if (adminRevenueChart) { adminRevenueChart.destroy(); adminRevenueChart = null; }
    canvas.classList.add("hidden");
    table.className = "admin-revenue-fallback";
    const max = Math.max(1, ...trend.map(item => Number(item.revenue) || 0));
    table.innerHTML = trend.map((item, index) => `<div class="admin-revenue-bar-row"><span>${escapeAdminRequestText(labels[index])}</span><span class="admin-revenue-bar-track"><span style="width:${Math.max(0, Math.min(100, (item.revenue / max) * 100))}%"></span></span><strong>${escapeAdminRequestText(fmtBaht(item.revenue))}</strong></div>`).join("");
    return;
  }
  canvas.classList.remove("hidden");
  table.className = "sr-only";
  const chartData = {
    labels,
    datasets: [{
      label: t("admin_metric_revenue"),
      data: trend.map(item => Number(item.revenue) || 0),
      borderColor: "#fb923c",
      backgroundColor: "rgba(251,146,60,.14)",
      borderWidth: 2,
      pointRadius: 3,
      pointBackgroundColor: "#fb923c",
      tension: .3,
      fill: true,
    }],
  };
  if (adminRevenueChart) {
    adminRevenueChart.data = chartData;
    adminRevenueChart.update("none");
    return;
  }
  adminRevenueChart = new Chart(canvas.getContext("2d"), {
    type: "line",
    data: chartData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: "#94a3b8" } },
        y: { beginAtZero: true, grid: { color: "rgba(148,163,184,.16)" }, ticks: { color: "#94a3b8" } },
      },
    },
  });
}

function renderAdminBestSellers() {
  const list = document.getElementById("admin-best-sellers");
  if (!list || !adminOverview) return;
  list.innerHTML = adminOverview.bestSellers.length
    ? adminOverview.bestSellers.map((item, index) => `<article class="admin-list-row"><span class="admin-rank" aria-hidden="true">${index + 1}</span><div class="min-w-0 flex-1"><strong class="block text-sm truncate">${escapeAdminRequestText(item.name)}</strong><span class="text-xs text-slate-400">${fmtNum(item.quantity)} · ${fmtBaht(item.revenue)}</span></div></article>`).join("")
    : `<p class="text-sm text-slate-400">${escapeAdminRequestText(t("admin_inventory_empty"))}</p>`;
}

function renderAdminLowStock() {
  const list = document.getElementById("admin-low-stock-list");
  if (!list || !adminOverview) return;
  list.innerHTML = adminOverview.lowStock.length
    ? adminOverview.lowStock.slice(0, 12).map(item => `<article class="admin-list-row"><div class="min-w-0 flex-1"><strong class="block text-sm truncate">${escapeAdminRequestText(item.name)}</strong><span class="text-xs text-slate-400">${escapeAdminRequestText(item.owner)} · ${escapeAdminRequestText(item.category)}${item.method ? ` · ${escapeAdminRequestText(item.method)}` : ""}</span></div><strong class="text-rose-300 text-sm">${fmtNum(item.remaining)} ${t("admin_stock_remaining")}</strong></article>`).join("")
    : `<p class="text-sm text-emerald-300">${escapeAdminRequestText(t("admin_low_stock_none"))}</p>`;
}

function renderAdminOrders(container, orders, compact = false) {
  if (!container) return;
  if (!orders?.length) {
    container.innerHTML = `<p class="text-sm text-slate-400 py-3">${escapeAdminRequestText(t("admin_orders_empty"))}</p>`;
    return;
  }
  if (compact) {
    container.innerHTML = orders.slice(0, 8).map(order => `<article class="admin-list-row"><div class="min-w-0 flex-1"><strong class="block text-sm truncate">${escapeAdminRequestText(order.owner)}</strong><span class="text-xs text-slate-400">${escapeAdminRequestText(order.id)} · ${escapeAdminRequestText(adminFormatDate(order.date))}${order.customer ? ` · ${escapeAdminRequestText(order.customer)}` : ""}</span></div><strong class="text-sm text-emerald-300">${escapeAdminRequestText(fmtBaht(order.total))}</strong></article>`).join("");
    return;
  }
  container.innerHTML = `<table class="admin-data-table"><thead><tr><th>${escapeAdminRequestText(t("admin_order_id"))}</th><th>${escapeAdminRequestText(t("admin_col_user"))}</th><th>${escapeAdminRequestText(t("admin_col_date"))}</th><th>${escapeAdminRequestText(t("admin_order_customer"))}</th><th>${escapeAdminRequestText(t("admin_col_total"))}</th><th>${escapeAdminRequestText(t("admin_order_status"))}</th><th>${escapeAdminRequestText(t("admin_order_items"))}</th></tr></thead><tbody>${orders.map(order => `<tr><td>${escapeAdminRequestText(order.id)}</td><td><button type="button" class="admin-user-link" data-admin-user-id="${escapeAdminRequestText(order.ownerId)}">${escapeAdminRequestText(order.owner)}</button></td><td>${escapeAdminRequestText(adminFormatDate(order.date))}</td><td>${escapeAdminRequestText(order.customer || "—")}</td><td>${escapeAdminRequestText(fmtBaht(order.total))}</td><td>${escapeAdminRequestText(order.status)}</td><td>${fmtNum(order.lineCount)}</td></tr>`).join("")}</tbody></table>`;
}

function renderAdminInventory() {
  const list = document.getElementById("admin-inventory-list");
  const count = document.getElementById("admin-inventory-count");
  if (!list || !adminOverview) return;
  const inventory = adminOverview.inventory || [];
  if (count) count.textContent = t("admin_inventory_count", { count: inventory.length });
  if (!inventory.length) {
    list.innerHTML = `<p class="text-sm text-slate-400 py-4">${escapeAdminRequestText(t("admin_inventory_empty"))}</p>`;
    return;
  }
  list.innerHTML = `<table class="admin-data-table"><thead><tr><th>${escapeAdminRequestText(t("admin_col_name"))}</th><th>${escapeAdminRequestText(t("admin_col_category"))}</th><th>${escapeAdminRequestText(t("admin_col_accounts"))}</th><th>${escapeAdminRequestText(t("admin_col_remaining"))}</th><th>${escapeAdminRequestText(t("admin_col_low_stock"))}</th></tr></thead><tbody>${inventory.map(item => `<tr><td class="font-medium">${escapeAdminRequestText(item.name)}</td><td>${escapeAdminRequestText(item.category)}</td><td>${fmtNum(item.trackedAccounts)}</td><td>${fmtNum(item.remainingUnits)}${item.unlimitedAccounts ? ` <span class="text-sky-300">∞ ${fmtNum(item.unlimitedAccounts)}</span>` : ""}</td><td>${item.lowStockAccounts ? `<span class="text-rose-300">${fmtNum(item.lowStockAccounts)}</span>` : "—"}</td></tr>`).join("")}</tbody></table>`;
}

function renderAdminUsers() {
  const list = document.getElementById("admin-users-list");
  const count = document.getElementById("admin-users-count");
  if (!list || !adminOverview) return;
  const query = String(document.getElementById("admin-users-search")?.value || "").trim().toLowerCase();
  const users = adminOverview.users.filter(user => `${user.name} ${user.ownerId}`.toLowerCase().includes(query));
  if (count) count.textContent = t("admin_user_count", { count: users.length });
  list.innerHTML = users.length
    ? users.map(user => `<button type="button" class="admin-user-card ${adminSelectedUserId === user.ownerId ? "is-selected" : ""}" data-admin-user-id="${escapeAdminRequestText(user.ownerId)}"><span class="flex items-center justify-between gap-2"><strong class="truncate text-sm">${escapeAdminRequestText(user.name)}</strong><span class="admin-user-presence ${user.lastSeen && Date.now() - user.lastSeen <= 90000 ? "is-online" : ""}">${escapeAdminRequestText(user.lastSeen && Date.now() - user.lastSeen <= 90000 ? t("admin_online") : t("admin_offline"))}</span></span><span class="mt-1 block truncate text-xs text-slate-400">${escapeAdminRequestText(user.ownerId)}</span><span class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400"><span>${escapeAdminRequestText(t("admin_user_products"))}: ${fmtNum(user.productCount)}</span><span>${escapeAdminRequestText(t("admin_user_sales"))}: ${fmtNum(user.salesRecordCount)}</span><span>${escapeAdminRequestText(fmtBaht(user.revenue))}</span></span></button>`).join("")
    : `<p class="text-sm text-slate-400 py-3">${escapeAdminRequestText(t("admin_users_empty"))}</p>`;
}

function renderAdminUserDetail() {
  const panel = document.getElementById("admin-user-detail");
  if (!panel) return;
  if (adminUserDetailError) {
    panel.innerHTML = `<p class="text-sm text-rose-300" role="alert">${escapeAdminRequestText(t("admin_detail_load_failed"))}</p>`;
    return;
  }
  const detail = adminUserDetail;
  if (!detail) {
    panel.innerHTML = `<p class="text-sm text-slate-400">${escapeAdminRequestText(t("admin_details_select_user"))}</p>`;
    return;
  }
  const user = detail.user;
  const transactions = [
    ...detail.sales.map(item => ({ ...item, kind: item.source === "craft" ? t("production_cart_craft") : t("production_cart_product") })),
    ...detail.farmOrders.map(item => ({ ...item, kind: t("production_cart_farm") })),
    ...detail.upgradeOrders.map(item => ({ ...item, kind: t("production_cart_upgrade") })),
  ].sort((left, right) => (right.date || 0) - (left.date || 0));
  const productRows = detail.products.map(product => `<tr><td>${escapeAdminRequestText(product.name)}</td><td>${escapeAdminRequestText(product.category)}</td><td>${fmtNum(product.stock)}</td><td>${fmtNum(product.sold)}</td><td>${Number.isFinite(product.remaining) ? fmtNum(product.remaining) : "∞"}</td></tr>`).join("");
  const orderCards = detail.orders.map(order => `<article class="admin-list-row"><div class="min-w-0 flex-1"><strong class="block text-sm">${escapeAdminRequestText(order.id)} · ${escapeAdminRequestText(adminFormatDate(order.date))}</strong><span class="text-xs text-slate-400">${escapeAdminRequestText(order.customer || "—")} · ${escapeAdminRequestText(order.status)}</span><ul class="mt-1 text-xs text-slate-400">${order.lines.map(line => `<li>${escapeAdminRequestText(line.name)} × ${fmtNum(line.quantity)} · ${escapeAdminRequestText(fmtBaht(line.subtotal))}</li>`).join("")}</ul></div><strong class="text-sm text-emerald-300">${escapeAdminRequestText(fmtBaht(order.total))}</strong></article>`).join("");
  const activityCards = detail.activity.map(item => `<article class="admin-list-row"><div class="min-w-0 flex-1"><strong class="block text-sm">${escapeAdminRequestText(item.text || item.action || item.type)}</strong>${item.sub ? `<span class="block text-xs text-slate-400">${escapeAdminRequestText(item.sub)}</span>` : ""}</div><time class="shrink-0 text-xs text-slate-400">${escapeAdminRequestText(adminFormatDate(item.ts))}</time></article>`).join("");
  panel.innerHTML = `<div class="mb-4 flex flex-wrap items-start justify-between gap-2"><div><strong class="text-lg">${escapeAdminRequestText(user.name)}</strong><p class="mt-1 break-all text-xs text-slate-400">${escapeAdminRequestText(user.ownerId)}</p></div><span class="admin-user-presence ${user.online ? "is-online" : ""}">${escapeAdminRequestText(user.online ? t("admin_online") : t("admin_offline"))} · ${escapeAdminRequestText(adminFormatDate(user.lastSeen))}</span></div><div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">${adminStatCard(t("admin_user_products"), fmtNum(detail.products.length))}${adminStatCard(t("admin_user_sales"), fmtNum(detail.salesRecordCount))}${adminStatCard(t("admin_user_orders"), fmtNum(detail.orders.length))}${adminStatCard(t("admin_user_activity"), fmtNum(detail.activity.length))}</div><section class="mb-4"><h3 class="font-semibold mb-2">${escapeAdminRequestText(t("admin_user_products"))}</h3><div class="overflow-x-auto">${productRows ? `<table class="admin-data-table"><thead><tr><th>${escapeAdminRequestText(t("admin_col_name"))}</th><th>${escapeAdminRequestText(t("admin_col_category"))}</th><th>${escapeAdminRequestText(t("admin_product_stock"))}</th><th>${escapeAdminRequestText(t("admin_product_sold"))}</th><th>${escapeAdminRequestText(t("admin_col_remaining"))}</th></tr></thead><tbody>${productRows}</tbody></table>` : `<p class="text-sm text-slate-400">${escapeAdminRequestText(t("admin_inventory_empty"))}</p>`}</div></section><section class="mb-4"><h3 class="font-semibold mb-2">${escapeAdminRequestText(t("admin_user_sales"))}</h3><div class="flex flex-col gap-2">${transactions.slice(0, 30).map(item => `<article class="admin-list-row"><div class="min-w-0 flex-1"><strong class="block text-sm">${escapeAdminRequestText(item.productName)} · ${escapeAdminRequestText(item.kind)}</strong><span class="text-xs text-slate-400">${fmtNum(item.quantity)} · ${escapeAdminRequestText(adminFormatDate(item.date))}</span></div><strong class="text-sm text-emerald-300">${escapeAdminRequestText(fmtBaht(item.money))}</strong></article>`).join("") || `<p class="text-sm text-slate-400">${escapeAdminRequestText(t("admin_orders_empty"))}</p>`}</div></section><section class="mb-4"><h3 class="font-semibold mb-2">${escapeAdminRequestText(t("admin_user_orders"))}</h3><div class="flex flex-col gap-2">${orderCards || `<p class="text-sm text-slate-400">${escapeAdminRequestText(t("admin_orders_empty"))}</p>`}</div></section><section><h3 class="font-semibold mb-2">${escapeAdminRequestText(t("admin_user_activity"))}</h3><div class="flex flex-col gap-2">${activityCards || `<p class="text-sm text-slate-400">${escapeAdminRequestText(t("admin_user_no_activity"))}</p>`}</div></section>`;
}

function renderAdminAnalytics() {
  renderAdminOverviewStats();
  if (!adminOverview || adminOverviewFailed) return;
  const warning = document.getElementById("admin-overview-warning");
  if (warning) {
    warning.classList.toggle("hidden", !adminOverview.summary.invalidStateCount);
    warning.textContent = adminOverview.summary.invalidStateCount
      ? t("admin_invalid_state_warning", { count: adminOverview.summary.invalidStateCount })
      : "";
  }
  renderAdminRevenueTrend();
  renderAdminBestSellers();
  renderAdminLowStock();
  renderAdminOrders(document.getElementById("admin-recent-orders-list"), adminOverview.recentOrders, true);
  renderAdminInventory();
  renderAdminOrders(document.getElementById("admin-orders-list"), adminOverview.recentOrders);
  renderAdminUsers();
  renderAdminUserDetail();
}

async function loadAdminOverview() {
  if (!ADMIN_ANALYTICS_ENABLED) return;
  const stats = document.getElementById("admin-overview-stats");
  const error = document.getElementById("admin-overview-error");
  const shouldShowLoading = !adminOverviewLoaded || adminOverviewFailed;
  const finishLoading = shouldShowLoading ? beginAdminSkeleton(stats, 9, true) : () => {};
  if (adminOverviewFailed && error) error.classList.add("hidden");
  try {
    const response = await fetch("/api/admin/overview", { headers: adminHeaders() });
    const result = await readApiResponse(response);
    if (!response.ok) throw new Error(result.error || "ADMIN_ANALYTICS_UNAVAILABLE");
    if (!result || !result.summary || !Array.isArray(result.users)) throw new Error("INVALID_ADMIN_ANALYTICS_RESPONSE");
    adminOverview = result;
    adminOverviewFailed = false;
    if (error) error.classList.add("hidden");
  } catch (loadError) {
    adminOverviewFailed = true;
    if (error) error.classList.remove("hidden");
    console.error("Could not load Admin analytics:", loadError);
  } finally {
    adminOverviewLoaded = true;
    finishLoading();
    renderAdminAnalytics();
  }
}

async function loadAdminUserDetail(ownerId) {
  if (!ADMIN_ANALYTICS_ENABLED) return;
  adminSelectedUserId = ownerId;
  adminUserDetail = null;
  adminUserDetailError = false;
  renderAdminUsers();
  const panel = document.getElementById("admin-user-detail");
  if (panel) {
    panel.setAttribute("aria-busy", "true");
    panel.innerHTML = `<div class="admin-skeleton-card" aria-hidden="true"><span class="skeleton admin-skeleton-line"></span><span class="skeleton admin-skeleton-line admin-skeleton-line-short"></span></div>`;
  }
  try {
    const response = await fetch(`/api/admin/users/${encodeURIComponent(ownerId)}`, { headers: adminHeaders() });
    const result = await readApiResponse(response);
    if (!response.ok) throw new Error(result.error || "ADMIN_USER_DETAIL_LOAD_FAILED");
    adminUserDetail = result;
  } catch (error) {
    adminUserDetailError = true;
    console.error("Could not load Admin account details:", error);
  } finally {
    if (panel) panel.setAttribute("aria-busy", "false");
    renderAdminUserDetail();
  }
}

function adminCsvEscape(value) {
  let text = String(value ?? "");
  if (/^[\t\r ]*[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function exportAdminOrders() {
  const orders = adminOverview?.recentOrders || [];
  if (!orders.length) return;
  const rows = [
    ["orderId", "account", "date", "customer", "total", "status", "itemCount"],
    ...orders.map(order => [order.id, order.owner, adminFormatDate(order.date), order.customer, order.total, order.status, order.lineCount]),
  ];
  const blob = new Blob(["\uFEFF", rows.map(row => row.map(adminCsvEscape).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `kinglegacy-admin-orders-${Date.now()}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

window.refreshAdminAnalyticsTranslations = () => renderAdminAnalytics();
function beginAdminSkeleton(element, count, isStats = false) {
  if (!element) return () => {};
  element.setAttribute("aria-busy", "true");
  element.classList.add("skeleton-pending");
  element.innerHTML = Array.from({ length: count }, () => isStats
    ? `<div class="admin-stat-skeleton" aria-hidden="true"><span class="skeleton admin-skeleton-line"></span><span class="skeleton admin-skeleton-line admin-skeleton-line-short"></span></div>`
    : `<article class="admin-skeleton-card" aria-hidden="true"><span class="skeleton admin-skeleton-line"></span><span class="skeleton admin-skeleton-line admin-skeleton-line-short"></span></article>`).join("");
  const timer = setTimeout(() => element.classList.remove("skeleton-pending"), 200);
  return () => {
    clearTimeout(timer);
    element.classList.remove("skeleton-pending");
    element.setAttribute("aria-busy", "false");
  };
}
function escapeAdminRequestText(value) { return String(value ?? "").replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#039;" }[char])); }
function renderAdminInbox() {
  const list = document.getElementById("admin-inbox-list");
  const count = document.getElementById("admin-inbox-count");
  if (!list || !count || list.getAttribute("aria-busy") === "true") return;
  const entries = [
    ...adminSuggestions.map(item => ({ ...item, type: "suggestion", owner: item.displayName, avatar: item.avatarData })),
    ...adminRequestsCache.map(item => ({ ...item, type: "request", owner: item.owner, avatar: item.avatarUrl })),
  ].sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")));
  count.textContent = t("admin_inbox_count", { count: entries.length });
  const errors = [];
  if (adminSuggestionsError) errors.push(`<p class="text-sm text-rose-300">${t("admin_suggestions_load_failed")}</p>`);
  if (adminRequestsLoadError) errors.push(`<p class="text-sm text-rose-300">${t("admin_requests_load_failed")}</p>`);
  const cards = entries.map(item => {
    const online = item.type === "suggestion" && item.presenceStatus === "online";
    const avatar = typeof item.avatar === "string" && (
      /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(item.avatar)
      || /^https:\/\/lh3\.googleusercontent\.com\/[A-Za-z0-9_./=?&%-]+$/.test(item.avatar)
      || /^https:\/\/cdn\.discordapp\.com\/avatars\/\d+\/[A-Za-z0-9_]+\.png\?size=150$/.test(item.avatar)
    ) ? item.avatar : "";
    const createdAt = item.createdAt
      ? new Date(item.createdAt).toLocaleString(currentLang === "th" ? "th-TH" : "en-US", { timeZone: APP_TIME.TIME_ZONE })
      : item.requestDate || "";
    const provider = ["google", "discord"].includes(item.provider)
      ? t(`identity_provider_${item.provider}`)
      : "";
    const deleteButton = `<button type="button" class="admin-message-delete px-3 py-1.5 rounded-lg bg-rose-500/15 text-rose-300 text-xs" data-delete-inbox-message="${item.type}" data-message-id="${escapeAdminRequestText(item.id)}">${t("admin_inbox_delete")}</button>`;
    const presence = item.type === "suggestion"
      ? `<span class="presence-dot ${online ? "is-online" : "is-offline"}" role="img" aria-label="${t(online ? "presence_online" : "presence_offline")}"><span class="presence-halo" aria-hidden="true"></span></span>`
      : "";
    return `<article class="glass-card rounded-2xl p-4"><div class="flex items-start gap-3"><div class="profile-avatar-wrap admin-suggestion-avatar-wrap">${avatar ? `<img class="admin-suggestion-avatar" src="${escapeAdminRequestText(avatar)}" alt="">` : `<span class="admin-suggestion-avatar grid place-items-center" aria-hidden="true">👤</span>`}${presence}</div><div class="min-w-0 flex-1"><div class="flex flex-wrap items-center justify-between gap-2"><strong class="text-sm break-words">${escapeAdminRequestText(item.owner)}</strong><time class="text-xs text-slate-400">${escapeAdminRequestText(createdAt)}</time></div><div class="mt-1 flex flex-wrap items-center gap-2"><span class="admin-inbox-type">${t(item.type === "suggestion" ? "admin_inbox_suggestion" : "admin_inbox_request")}</span>${provider ? `<span class="text-xs text-slate-400">${escapeAdminRequestText(provider)}</span>` : ""}${item.type === "suggestion" ? `<span class="text-xs text-slate-400">${t(online ? "presence_online" : "presence_offline")}</span>` : ""}</div><p class="mt-3 text-sm whitespace-pre-wrap break-words">${escapeAdminRequestText(item.message)}</p></div>${deleteButton}</div></article>`;
  });
  if (!entries.length && !errors.length) errors.push(`<p class="text-sm text-slate-400">${t("admin_inbox_empty")}</p>`);
  list.innerHTML = [...errors, ...cards].join("");
}
async function loadAdminInbox() {
  const list = document.getElementById("admin-inbox-list");
  const finishLoading = !adminInboxLoaded ? beginAdminSkeleton(list, 3) : () => {};
  const load = async (path, errorCode) => {
    const response = await fetch(path, { headers: adminHeaders() });
    const result = await readApiResponse(response);
    if (!response.ok) throw new Error(result.error || errorCode);
    return result;
  };
  try {
    const [suggestions, requests] = await Promise.allSettled([
      load("/api/admin/suggestions", "SUGGESTION_STORAGE_UNAVAILABLE"),
      load("/api/admin/requests", "REQUEST_STORAGE_UNAVAILABLE"),
    ]);
    adminSuggestionsError = suggestions.status === "rejected";
    adminRequestsLoadError = requests.status === "rejected";
    if (suggestions.status === "fulfilled") adminSuggestions = suggestions.value;
    if (requests.status === "fulfilled") adminRequestsCache = requests.value;
    if (adminSuggestionsError || adminRequestsLoadError) {
      throw new Error("ADMIN_INBOX_PARTIAL_FAILURE");
    }
  } finally {
    adminInboxLoaded = true;
    finishLoading();
    renderAdminInbox();
  }
}
function renderAdminUpdates() {
  const list = document.getElementById("admin-updates-list");
  if (!list) return;
  if (adminUpdatesError) {
    list.innerHTML = `<p class="text-sm text-rose-300">${t("admin_updates_load_failed")}</p>`;
    return;
  }
  if (!adminUpdates.length) {
    list.innerHTML = `<p class="text-sm text-slate-400">${t("admin_updates_empty")}</p>`;
    return;
  }
  const locale = currentLang === "th" ? "th-TH" : "en-US";
  list.innerHTML = adminUpdates.map(entry => {
    const changes = currentLang === "en" && Array.isArray(entry.changesEn) ? entry.changesEn : entry.changes;
    const rawDate = entry.updatedAt || entry.date;
    const parsedDate = rawDate ? new Date(rawDate) : null;
    const date = parsedDate && Number.isFinite(parsedDate.getTime())
      ? parsedDate.toLocaleString(locale, { timeZone: APP_TIME.TIME_ZONE, dateStyle: "medium", ...(entry.updatedAt ? { timeStyle: "short" } : {}) })
      : "";
    const items = Array.isArray(changes) ? changes : [];
    return `<article class="glass-card rounded-2xl p-4 border-l-2 border-indigo-400/70"><div class="flex items-center justify-between gap-2"><strong class="text-sm">${escapeAdminRequestText(entry.version)}</strong><time class="text-[11px] text-slate-400">${escapeAdminRequestText(date)}</time></div><ul class="mt-2 text-sm text-slate-300 list-disc list-inside">${items.map(change => `<li>${escapeAdminRequestText(change)}</li>`).join("")}</ul></article>`;
  }).join("");
}
async function loadAdminUpdates() {
  const list = document.getElementById("admin-updates-list");
  if (!list) return;
  if (!adminUpdatesLoaded) {
    list.setAttribute("aria-busy", "true");
    list.innerHTML = `<article class="admin-skeleton-card" aria-hidden="true"><span class="skeleton admin-skeleton-line"></span><span class="skeleton admin-skeleton-line admin-skeleton-line-short"></span></article>`;
  }
  try {
    const response = await fetch("/api/admin/updates", { headers: adminHeaders() });
    const result = await readApiResponse(response);
    if (!response.ok) throw new Error(result.error || "ADMIN_UPDATES_LOAD_FAILED");
    if (!Array.isArray(result)) throw new Error("INVALID_ADMIN_UPDATES_RESPONSE");
    adminUpdates = result;
    adminUpdatesError = false;
    const version = document.getElementById("admin-updates-version");
    if (version) version.textContent = APP_VERSION;
  } catch (error) {
    adminUpdatesError = true;
    console.error("Could not load Admin update history:", error);
  } finally {
    adminUpdatesLoaded = true;
    list.setAttribute("aria-busy", "false");
    renderAdminUpdates();
  }
}
window.refreshAdminUpdateTranslations = renderAdminUpdates;
function bindAdminKeyFilters() {
  if (adminFiltersBound) return;
  adminFiltersBound = true;
  document.addEventListener("click", event => {
    const button = event.target.closest("[data-key-filter]");
    if (!button) return;
    adminKeyFilter = button.dataset.keyFilter;
    document.querySelectorAll("[data-key-filter]").forEach(item => item.classList.toggle("is-selected", item === button));
    renderAdminKeyList(adminKeysCache);
  });
}
function renderAdminKeyList(keys) {
  const list = document.getElementById("admin-key-list");
  if (list?.getAttribute("aria-busy") === "true") return;
  if (adminKeysLoadError) { list.innerHTML = `<p class="text-sm text-rose-300">${t("admin_key_load_failed")}</p>`; return; }
  const matchesFilter = key => adminKeyFilter === "all" || (adminKeyFilter === "archived" ? key.archived : adminKeyFilter === "expired" ? (!key.permanent && (key.archived || (!key.waitingForFirstUse && key.remainingMs <= 0))) : adminKeyFilter === "admin" ? key.admin : adminKeyFilter === "unlimited" ? (!key.admin && key.permanent) : adminKeyFilter === "limited" ? (!key.permanent && !key.archived && (key.waitingForFirstUse || key.remainingMs > 0)) : (key.admin || key.permanent || key.waitingForFirstUse || key.remainingMs > 0));
  const sortedKeys = keys.filter(matchesFilter).sort((a, b) => {
    const aExpired = a.archived || (!a.permanent && !a.waitingForFirstUse && a.remainingMs <= 0);
    const bExpired = b.archived || (!b.permanent && !b.waitingForFirstUse && b.remainingMs <= 0);
    if (aExpired !== bExpired) return aExpired ? 1 : -1;
    if (a.admin !== b.admin) return a.admin ? -1 : 1;
    if (a.permanent !== b.permanent) return a.permanent ? -1 : 1;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
  list.innerHTML = sortedKeys.map(key => {
    const expired = key.archived || (!key.permanent && !key.waitingForFirstUse && key.remainingMs <= 0);
    const stateColor = key.archived || expired ? "text-rose-300" : key.waitingForFirstUse ? "text-cyan-300" : "text-emerald-300";
    const owner = escapeReportText(key.user || t("admin_key_owner_none"));
    const keyValue = escapeReportText(key.value);
    const timeButtons = !key.permanent && !key.archived
      ? `<div class="key-time-controls"><button data-key-time="-1" data-key-id="${escapeReportText(key.id)}" type="button" aria-label="${t("admin_key_remove_hour")}" title="${t("admin_key_remove_hour")}">−1 h</button><button data-key-time="1" data-key-id="${escapeReportText(key.id)}" type="button" aria-label="${t("admin_key_add_hour")}" title="${t("admin_key_add_hour")}">+1 h</button></div>`
      : "";
    return `<div class="glass-card rounded-xl p-3 flex flex-wrap items-center gap-3 ${expired ? "opacity-70" : ""}"><code class="flex-1 text-xs break-all">${keyValue}</code><button data-copy-key="${keyValue}" type="button" class="px-3 py-1.5 rounded-lg bg-slate-700/60 text-xs">${t("admin_copy")}</button><span class="px-2 py-1 rounded-full text-[11px] ${keyTypeClass(key)}">${keyTypeLabel(key)}</span><span class="text-xs ${stateColor}">${owner} · ${keyTimeLabel(key)}</span>${timeButtons}</div>`;
  }).join("") || `<p class="text-sm text-slate-400 text-center py-6">${t("admin_key_empty")}</p>`;
}
function renderAdminKeyStats(keys) {
  const stats = document.getElementById("admin-key-stats");
  if (!stats) return;
  const active = keys.filter(key => key.permanent || key.waitingForFirstUse || key.remainingMs > 0).length;
  const expired = keys.filter(key => !key.permanent && (key.archived || (!key.waitingForFirstUse && key.remainingMs <= 0))).length;
  stats.innerHTML = `<div class="glass-card rounded-xl p-3"><small>${t("admin_stat_total")}</small><strong>${keys.length}</strong></div><div class="glass-card rounded-xl p-3"><small>${t("admin_stat_used")}</small><strong>${keys.filter(key => key.user).length}</strong></div><div class="glass-card rounded-xl p-3"><small>${t("admin_stat_active")}</small><strong>${active}</strong></div><div class="glass-card rounded-xl p-3"><small>${t("admin_stat_expired")}</small><strong>${expired}</strong></div>`;
}
window.refreshAdminKeyTranslations = () => { renderAdminKeyList(adminKeysCache); if (!adminKeysLoadError) renderAdminKeyStats(adminKeysCache); renderAdminInbox(); };
async function loadAdminKeys() {
  const list = document.getElementById("admin-key-list");
  const stats = document.getElementById("admin-key-stats");
  const finishListLoading = !adminKeysHasLoaded ? beginAdminSkeleton(list, 4) : () => {};
  const finishStatsLoading = !adminKeysHasLoaded ? beginAdminSkeleton(stats, 4, true) : () => {};
  try {
    const response = await fetch("/api/admin/keys", { headers: adminHeaders() });
    const keys = await readApiResponse(response);
    if (!response.ok) throw new Error(t("admin_access_denied"));
    adminKeysCache = keys;
    adminKeysLoadError = false;
    finishListLoading();
    finishStatsLoading();
    renderAdminKeyStats(keys);
    renderAdminKeyList(adminKeysCache);
    return { keys, expired: keys.filter(key => !key.permanent && (key.archived || (!key.waitingForFirstUse && key.remainingMs <= 0))) };
  } catch (error) {
    adminKeysLoadError = true;
    if (list) list.innerHTML = `<p class="text-sm text-rose-300">${t("admin_key_load_failed")}</p>`;
    if (stats) stats.replaceChildren();
    throw error;
  } finally {
    adminKeysHasLoaded = true;
    finishListLoading();
    finishStatsLoading();
  }
}
function downloadKeyReport(keys) {
  const report = { exportedAt: new Date().toISOString(), totalKeys: keys.length, expiredKeys: keys.filter(key => !key.permanent && (key.archived || (!key.waitingForFirstUse && key.remainingMs <= 0))).length, keys };
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `igh7021-key-report-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}
function escapeReportText(value) { return String(value ?? "-").replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#039;" }[char])); }
function printKeyReport(keys) {
  const popup = window.open("", "igh7021-key-report");
  if (!popup) return;
  const locale = currentLang === "th" ? "th-TH" : "en-US";
  const rows = keys.map((key, index) => {
    const status = key.archived ? t("admin_key_type_history") : key.waitingForFirstUse ? t("admin_key_waiting", { time: formatRemaining(key.durationMs) }) : key.permanent ? t("admin_key_type_unlimited") : key.remainingMs <= 0 ? t("admin_key_time_expired") : t("admin_key_status_active");
    return `<tr><td>${index + 1}</td><td><code>${escapeReportText(key.value)}</code></td><td>${escapeReportText(key.user || t("admin_key_owner_none"))}</td><td>${escapeReportText(status)}</td><td>${key.expiresAt ? escapeReportText(new Date(key.expiresAt).toLocaleString(locale, { timeZone: APP_TIME.TIME_ZONE })) : "-"}</td><td>${escapeReportText(keyTimeLabel(key))}</td></tr>`;
  }).join("");
  popup.document.write(`<!doctype html><html lang="${currentLang}"><head><meta charset="utf-8"><title>${t("admin_pdf_title")}</title><style>body{font-family:Arial,sans-serif;color:#20232a;padding:32px}h1{margin:0 0 6px;color:#c2410c}p{color:#64748b}table{width:100%;border-collapse:collapse;margin-top:24px;font-size:12px}th{background:#ea580c;color:#fff;text-align:left}th,td{border:1px solid #fed7aa;padding:9px;vertical-align:top}tr:nth-child(even){background:#fff7ed}code{word-break:break-all}@media print{body{padding:10px}h1{font-size:20px}}</style></head><body><h1>${t("admin_pdf_title")}</h1><p>${t("admin_pdf_description")}<br>${t("admin_pdf_created")} ${escapeReportText(new Date().toLocaleString(locale, { timeZone: APP_TIME.TIME_ZONE }))} · ${t("admin_pdf_all_keys", { count: keys.length })}</p><table><thead><tr><th>#</th><th>Key</th><th>${t("admin_pdf_user")}</th><th>${t("admin_pdf_status")}</th><th>${t("admin_pdf_expires")}</th><th>${t("admin_pdf_remaining")}</th></tr></thead><tbody>${rows || `<tr><td colspan="6">${t("admin_pdf_empty")}</td></tr>`}</tbody></table></body></html>`);
  popup.document.close(); popup.focus(); popup.print();
}
document.addEventListener("DOMContentLoaded", () => {
  const isAdmin = localStorage.getItem("igh_kinglegacy_is_admin") === "1";
  if (isAdmin) enableAdminUi();
  if (ADMIN_ANALYTICS_ENABLED) document.getElementById("admin-overview-retry")?.addEventListener("click", async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try { await loadAdminOverview(); }
    finally { button.disabled = false; }
  });
  const refresh = () => loadAdminKeys().catch(error => toast(error.message, "error"));
  document.querySelectorAll("[data-admin-tab]").forEach(button => button.addEventListener("click", () => {
    const selectedTab = button.dataset.adminTab;
    if (!ADMIN_ANALYTICS_ENABLED && ADMIN_ANALYTICS_TABS.has(selectedTab)) return;
    ["overview", "users", "inventory", "orders", "keys", "inbox", "updates"].forEach(name => {
      document.getElementById(`admin-${name}-panel`)?.classList.toggle("hidden", selectedTab !== name);
    });
    document.querySelectorAll("[data-admin-tab]").forEach(tab => {
      const selected = tab === button;
      tab.classList.toggle("is-active", selected);
      tab.setAttribute("aria-selected", String(selected));
    });
    if (selectedTab === "overview") loadAdminOverview();
    if (selectedTab === "users") renderAdminUsers();
    if (selectedTab === "inventory") renderAdminInventory();
    if (selectedTab === "orders") renderAdminOrders(document.getElementById("admin-orders-list"), adminOverview?.recentOrders || []);
    if (selectedTab === "inbox") loadAdminInbox().catch(error => console.error("Could not load Admin inbox:", error));
    if (selectedTab === "updates") loadAdminUpdates();
  }));
  document.getElementById("admin-users-search")?.addEventListener("input", renderAdminUsers);
  document.addEventListener("click", event => {
    if (!ADMIN_ANALYTICS_ENABLED) return;
    const userButton = event.target.closest("[data-admin-user-id]");
    if (!userButton) return;
    document.querySelector('[data-admin-tab="users"]')?.click();
    loadAdminUserDetail(userButton.dataset.adminUserId);
  });
  document.getElementById("admin-export-orders")?.addEventListener("click", exportAdminOrders);
  document.getElementById("admin-key-form")?.addEventListener("submit", async event => { event.preventDefault(); try { const response = await fetch("/api/admin/keys", { method: "POST", headers: adminHeaders(), body: JSON.stringify({ hours: Number(document.getElementById("admin-hours").value), permanent: document.getElementById("admin-permanent").checked, admin: document.getElementById("admin-key-is-admin").checked }) }); const result = await readApiResponse(response); if (!response.ok) throw new Error(result.error); const output = document.getElementById("admin-generated-key"); const copyButton = document.getElementById("copy-generated-key"); output.textContent = result.value; output.classList.remove("hidden"); copyButton.dataset.copyKey = result.value; copyButton.classList.remove("hidden"); refresh(); } catch (error) { toast(`${t("admin_key_create_failed")}: ${error.message}`, "error"); } });
  document.getElementById("copy-generated-key")?.addEventListener("click", async event => { if (await copyText(event.currentTarget.dataset.copyKey)) { event.currentTarget.textContent = t("admin_copied"); setTimeout(() => { event.currentTarget.textContent = t("admin_copy"); }, 1600); } });
  document.getElementById("admin-key-list")?.addEventListener("click", async event => {
    const timeButton = event.target.closest("[data-key-time]");
    if (timeButton) {
      timeButton.disabled = true;
      try {
        const response = await fetch(`/api/admin/keys/${encodeURIComponent(timeButton.dataset.keyId)}/time`, { method: "POST", headers: adminHeaders(), body: JSON.stringify({ deltaHours: Number(timeButton.dataset.keyTime) }) });
        const result = await readApiResponse(response);
        if (!response.ok) throw new Error(result.error === "KEY_EXTENSION_WINDOW_EXPIRED" ? t("admin_key_expired_7d") : result.error === "MINIMUM_KEY_DURATION" ? t("admin_key_minimum_time") : t("admin_key_time_failed"));
        await refresh();
      } catch (error) { toast(error.message, "error"); timeButton.disabled = false; }
      return;
    }
    const button = event.target.closest("[data-copy-key]");
    if (!button) return;
    if (await copyText(button.dataset.copyKey)) { button.textContent = t("admin_copied"); setTimeout(() => { button.textContent = t("admin_copy"); }, 1600); }
  });
  document.getElementById("admin-inbox-list")?.addEventListener("click", event => {
    const button = event.target.closest("[data-delete-inbox-message]");
    if (!button || !["suggestion", "request"].includes(button.dataset.deleteInboxMessage)) return;
    const type = button.dataset.deleteInboxMessage;
    const request = type === "request";
    const route = request ? "requests" : "suggestions";
    confirmDialog(t(request ? "admin_request_delete_confirm" : "admin_suggestion_delete_confirm"), async () => {
      button.disabled = true;
      try {
        const response = await fetch(`/api/admin/${route}/${encodeURIComponent(button.dataset.messageId)}`, { method: "DELETE", headers: adminHeaders() });
        const result = await readApiResponse(response);
        if (!response.ok) throw new Error(result.error || "INBOX_MESSAGE_DELETE_FAILED");
        if (request) adminRequestsCache = adminRequestsCache.filter(item => item.id !== button.dataset.messageId);
        else adminSuggestions = adminSuggestions.filter(item => item.id !== button.dataset.messageId);
        renderAdminInbox();
      } catch (error) {
        console.error("Could not delete Admin inbox message:", error);
        toast(t(request ? "admin_request_delete_failed" : "admin_suggestion_delete_failed"), "error");
        button.disabled = false;
      }
    });
  });
  document.getElementById("admin-export-json")?.addEventListener("click", async () => { const result = await loadAdminKeys(); downloadKeyReport(result.keys); });
  document.getElementById("admin-export-pdf")?.addEventListener("click", async () => { const result = await loadAdminKeys(); printKeyReport(result.keys); });
  document.getElementById("admin-logout-btn")?.addEventListener("click", async () => { await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => {}); localStorage.removeItem(AUTH_TOKEN_KEY); localStorage.removeItem(AUTH_KEY_KEY); localStorage.removeItem("igh_kinglegacy_is_admin"); localStorage.removeItem("igh_kinglegacy_owner_id"); localStorage.removeItem("igh_kinglegacy_auth_method"); location.reload(); });
  if (isAdmin) refresh();
});
