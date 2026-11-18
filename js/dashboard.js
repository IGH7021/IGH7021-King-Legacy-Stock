let salesChart = null;
let lastChecklistToday = APP_TIME.dateKey();
let activityRange = "7d";

function totalSales() { return state.sales.reduce((a,s) => a + Number(s.money || 0), 0) + (state.farmOrders || []).reduce((a,o) => a + Number(o.money || 0), 0) + (state.upgradeOrders || []).reduce((a,o) => a + Number(o.money || 0), 0); }
function totalSoldQty() { return state.sales.reduce((a,s) => a + Number(s.quantity || 0), 0) + (state.farmOrders || []).reduce((a,o) => a + Number(o.pricingMode === "hour" ? o.hours || 0 : o.quantity || 0), 0) + (state.upgradeOrders || []).reduce((a,o) => a + Number(o.quantity || 0), 0); }
function totalRemainingStock() { return state.products.reduce((a,p) => a + remaining(p), 0); }
function todaySales() {
  const start = APP_TIME.dayStart();
  return state.sales.filter(s => s.date >= start && s.date < start + 86400000);
}

function todayFarmOrders() {
  const start = APP_TIME.dayStart();
  return (state.farmOrders || []).filter(order => order.date >= start && order.date < start + 86400000);
}

function todayUpgradeOrders() {
  const start = APP_TIME.dayStart();
  return (state.upgradeOrders || []).filter(order => order.date >= start && order.date < start + 86400000);
}

function renderDashboard() {
  document.getElementById("stat-total-sales").textContent = fmtBaht(Math.round(totalSales()*100)/100);
  document.getElementById("stat-sold-qty").textContent = fmtNum(totalSoldQty()) + " " + t("pieces_unit");
  document.getElementById("stat-sale-count").textContent = fmtNum(state.sales.length + (state.farmOrders || []).length + (state.upgradeOrders || []).length);
  document.getElementById("stat-remaining").textContent = fmtNum(totalRemainingStock()) + " " + t("pieces_unit");
  const salesToday = todaySales();
  const farmOrdersToday = todayFarmOrders();
  const upgradeOrdersToday = todayUpgradeOrders();
  const todayMoney = salesToday.reduce((sum, sale) => sum + Number(sale.money || 0), 0) + farmOrdersToday.reduce((sum, order) => sum + Number(order.money || 0), 0) + upgradeOrdersToday.reduce((sum, order) => sum + Number(order.money || 0), 0);
  const todayQty = salesToday.reduce((sum, sale) => sum + Number(sale.quantity || 0), 0) + farmOrdersToday.reduce((sum, order) => sum + Number(order.pricingMode === "hour" ? order.hours || 0 : order.quantity || 0), 0) + upgradeOrdersToday.reduce((sum, order) => sum + Number(order.quantity || 0), 0);
  const todayOrderCount = salesToday.length + farmOrdersToday.length + upgradeOrdersToday.length;
  document.getElementById("stat-today-sales").textContent = fmtBaht(Math.round(todayMoney * 100) / 100);
  document.getElementById("stat-today-qty").textContent = fmtNum(todayQty);
  document.getElementById("stat-today-orders").textContent = fmtNum(todayOrderCount);
  document.getElementById("stat-average-order").textContent = fmtBaht(todayOrderCount ? Math.round(todayMoney / todayOrderCount * 100) / 100 : 0);
  renderSalesChart();
  renderTimeline();
  renderBestSellers("dashboard-best-sellers", 5);
  renderDailyChecklist();
}

function renderSalesChart() {
  const ctx = document.getElementById("sales-chart");
  if (!ctx) return;
  const days = [];
  const labels = [];
  const todayKey = APP_TIME.dateKey();
  for (let i = 6; i >= 0; i--) {
    const key = APP_TIME.addDays(todayKey, -i);
    const dayStart = APP_TIME.startOfDateKey(key);
    days.push(dayStart);
    labels.push(new Date(dayStart).toLocaleDateString(currentLang === "th" ? "th-TH" : "en-US", { timeZone: APP_TIME.TIME_ZONE, weekday: "short" }));
  }
  const totals = days.map(dayStart => {
    const dayEnd = dayStart + 86400000;
    const sales = state.sales.filter(s => s.date >= dayStart && s.date < dayEnd).reduce((a,s) => a + Number(s.money || 0), 0);
    const farms = (state.farmOrders || []).filter(order => order.date >= dayStart && order.date < dayEnd).reduce((a, order) => a + Number(order.money || 0), 0);
    const upgrades = (state.upgradeOrders || []).filter(order => order.date >= dayStart && order.date < dayEnd).reduce((a, order) => a + Number(order.money || 0), 0);
    return sales + farms + upgrades;
  });

  const chartData = {
    labels,
    datasets: [{
      label: t("chart_dataset_label"), data: totals,
      borderColor: "#5bb79d", backgroundColor: "rgba(91,183,157,.14)",
      borderWidth: 2.5, pointRadius: 3, pointBackgroundColor: "#5bb79d",
      pointBorderColor: "#ffffff", pointBorderWidth: 2, tension: .42, fill: true,
    }],
  };
  if (salesChart) {
    salesChart.data = chartData;
    salesChart.update("none");
    return;
  }
  salesChart = new Chart(ctx, {
    type: "line",
    data: chartData,
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: "#64748b" } },
        y: { beginAtZero: true, grid: { color: "rgba(100,116,139,.16)" }, ticks: { color: "#64748b" } },
      },
    },
  });
}

function escapeChecklistText(value) {
  return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[char]));
}

function checklistDayLabel(dateKey) {
  return new Date(APP_TIME.startOfDateKey(dateKey)).toLocaleDateString(currentLang === "th" ? "th-TH" : "en-US", {
    timeZone: APP_TIME.TIME_ZONE, weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function renderDailyChecklist(preserveHistorySelection = false) {
  const list = document.getElementById("daily-checklist-list");
  const dateSelect = document.getElementById("checklist-history-date");
  const dateLabel = document.getElementById("daily-checklist-date");
  if (!list || !dateSelect || !dateLabel) return;
  const today = APP_TIME.dateKey();
  const records = state.dailyChecklist && typeof state.dailyChecklist === "object" && !Array.isArray(state.dailyChecklist)
    ? state.dailyChecklist
    : {};
  const historyDates = Object.keys(records).filter(key =>
    Number.isFinite(APP_TIME.startOfDateKey(key)) && Array.isArray(records[key]));
  const availableDates = [...new Set([today, ...historyDates])].sort().reverse();
  const selectionWasPreviousToday = dateSelect.value === lastChecklistToday && lastChecklistToday !== today;
  const selectedDate = preserveHistorySelection && availableDates.includes(dateSelect.value)
    ? dateSelect.value
    : selectionWasPreviousToday || !availableDates.includes(dateSelect.value) ? today : dateSelect.value;
  lastChecklistToday = today;
  if (dateSelect.value !== selectedDate || dateSelect.options.length !== availableDates.length) {
    dateSelect.innerHTML = availableDates.map(key => `<option value="${key}">${escapeChecklistText(checklistDayLabel(key))}</option>`).join("");
    dateSelect.value = selectedDate;
  }
  dateLabel.textContent = checklistDayLabel(selectedDate);
  const tasks = Array.isArray(records[selectedDate])
    ? records[selectedDate].filter(task => task && typeof task === "object" && !Array.isArray(task)
      && typeof task.id === "string" && typeof task.text === "string")
    : [];
  list.innerHTML = tasks.map(task => `<div class="flex items-center gap-3 rounded-xl border border-slate-700/60 bg-slate-800/35 px-3 py-2">
    <label class="flex min-h-11 min-w-11 shrink-0 items-center justify-center">
      <input type="checkbox" class="daily-checklist-toggle h-5 w-5 accent-emerald-500" data-task-id="${escapeChecklistText(task.id)}" ${task.completed === true ? "checked" : ""} aria-label="${escapeChecklistText(task.text)}">
    </label>
    <span class="min-w-0 flex-1 text-sm break-words ${task.completed === true ? "line-through text-slate-500" : "text-slate-200"}">${escapeChecklistText(task.text)}</span>
    ${selectedDate === today ? `<button type="button" class="daily-checklist-remove text-xs text-slate-400 hover:text-rose-300" data-task-id="${escapeChecklistText(task.id)}" aria-label="${t("checklist_remove")}">×</button>` : ""}
  </div>`).join("");
  document.getElementById("daily-checklist-empty")?.classList.toggle("hidden", tasks.length > 0);
  document.getElementById("daily-checklist-form")?.classList.toggle("hidden", selectedDate !== today);
}

function addChecklistTask(text) {
  const today = APP_TIME.dateKey();
  const taskText = String(text ?? "").trim();
  if (!taskText) return false;
  if (!state.dailyChecklist || typeof state.dailyChecklist !== "object" || Array.isArray(state.dailyChecklist)) {
    toast(t("checklist_invalid_data"), "error");
    return false;
  }
  if (state.dailyChecklist[today] === undefined) state.dailyChecklist[today] = [];
  if (!Array.isArray(state.dailyChecklist[today])) {
    toast(t("checklist_invalid_data"), "error");
    return false;
  }
  if (state.dailyChecklist[today].length >= 100) {
    toast(t("checklist_limit"), "error");
    return false;
  }
  state.dailyChecklist[today].push({ id: genId("task"), text: taskText, completed: false, createdAt: Date.now() });
  saveState();
  renderDailyChecklist();
  return true;
}

function updateChecklistTask(dateKey, taskId, update) {
  const tasks = state.dailyChecklist?.[dateKey];
  if (!Number.isFinite(APP_TIME.startOfDateKey(dateKey)) || typeof taskId !== "string"
    || !update || typeof update !== "object" || typeof update.completed !== "boolean") return;
  const task = Array.isArray(tasks)
    ? tasks.find(item => item && typeof item === "object" && item.id === taskId && typeof item.text === "string")
    : null;
  if (!task) return;
  Object.assign(task, update);
  saveState();
  renderDailyChecklist();
}

function renderTimeline() {
  const box = document.getElementById("activity-timeline");
  if (!box) return;
  const events = [];
  const activityStyles = {
    craft: ["🛠️", "bg-amber-400"],
    recipe: ["📜", "bg-amber-400"],
    product: ["📦", "bg-indigo-400"],
    farm: ["🌾", "bg-orange-400"],
    upgrade: ["⬆️", "bg-indigo-400"],
    order: ["🧾", "bg-orange-400"],
    backup: ["💾", "bg-sky-400"],
  };
  (state.activityLog || []).forEach(activity => {
    const [icon, color] = activityStyles[activity.type] || ["🧾", "bg-orange-400"];
    events.push({ ts: activity.ts, text: `${icon} ${activity.text}`, sub: activity.sub || "", color });
  });
  state.sales.forEach(s => {
    if (s.source === "craft" && (state.activityLog || []).some(activity => activity.type === "craft" && activity.ts === s.date)) return;
    const name = s.deliveryMethod ? `${s.productName} (${t(`gamepass_${s.deliveryMethod}`)})` : s.productName;
    events.push({ ts: s.date, text: t("timeline_sold", { name, qty: fmtNum(s.quantity) }), sub: fmtBaht(s.money), color: "bg-emerald-400" });
  });
  (state.farmOrders || []).forEach(order => {
    if ((state.activityLog || []).some(activity => activity.type === "farm" && activity.text.includes(order.serviceName) && Math.abs(activity.ts - order.date) < 5000)) return;
    events.push({ ts: order.date, text: `🌾 รับฟาร์ม ${order.serviceName} ${order.pricingMode === "hour" ? `${fmtNum(order.hours || order.quantity)} ชั่วโมง` : `${fmtNum(order.quantity)} ${t("pieces_unit")}`}`, sub: fmtBaht(order.money), color: "bg-orange-400" });
  });
  (state.upgradeOrders || []).forEach(order => events.push({ ts: order.date, text: `⬆️ อัปเกรด ${order.productName}${Number(order.upgradeLevel) ? ` · ขั้น ${fmtNum(order.upgradeLevel)}` : ""}`, sub: `${fmtNum(order.quantity)} งาน • ${fmtBaht(order.money)}`, color: "bg-indigo-400" }));
  state.products.forEach(product => (product.restockHistory || []).forEach(restock => {
    if ((state.activityLog || []).some(activity => activity.type === "product" && activity.text.includes(product.name) && activity.action === "restocked" && Math.abs(activity.ts - restock.date) < 5000)) return;
    events.push({ ts: restock.date, text: t("timeline_restocked", { name: product.name }), sub: `+${fmtNum(restock.amount)} ${t("pieces_unit")}`, color: "bg-indigo-400" });
  }));
  events.sort((a,b) => b.ts - a.ts);
  const today = APP_TIME.dateKey();
  const start = activityRange === "today" ? today
    : activityRange === "7d" ? APP_TIME.addDays(today, -6)
      : activityRange === "30d" ? APP_TIME.addDays(today, -29) : "";
  const visibleEvents = events.filter(event => !start || APP_TIME.dateKey(event.ts) >= start).slice(0, 200);
  if (visibleEvents.length === 0) {
    box.innerHTML = `<p class="text-sm text-slate-400 text-center py-6">${t("no_sales_data")}</p>`;
    return;
  }
  const eventsByDay = new Map();
  visibleEvents.forEach(event => {
    const key = APP_TIME.dateKey(event.ts);
    if (!eventsByDay.has(key)) eventsByDay.set(key, []);
    eventsByDay.get(key).push(event);
  });
  box.innerHTML = [...eventsByDay].map(([key, dayEvents]) => {
    const dayLabel = new Date(APP_TIME.startOfDateKey(key)).toLocaleDateString(currentLang === "th" ? "th-TH" : "en-US", {
      timeZone: APP_TIME.TIME_ZONE, weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
    return `<section class="activity-day-group"><h3 class="text-xs font-semibold text-slate-400 mb-2">${escapeHtml(dayLabel)}</h3><div class="flex flex-col gap-3">${dayEvents.map(event => `
      <div class="flex gap-3 items-start">
        <span class="w-2 h-2 rounded-full ${event.color} mt-1.5 flex-shrink-0"></span>
        <div class="flex-1 min-w-0">
          <p class="text-sm break-words">${escapeHtml(event.text)}</p>
          <p class="text-xs text-slate-400">${event.sub ? `${escapeHtml(event.sub)} • ` : ""}${timeAgo(event.ts)}</p>
        </div>
      </div>`).join("")}</div></section>`;
  }).join("");
}

function getBestSellers() {
  const products = state.products.filter(p => (p.sold || 0) > 0 || (p.crafted || 0) > 0).map(product => ({ ...product, itemType: "product", totalQuantity: (product.sold || 0) > 0 ? product.sold : product.crafted }));
  const farms = (state.farmServices || []).map(service => {
    const orders = (state.farmOrders || []).filter(order => order.serviceId === service.id);
    return { ...service, itemType: "farm", totalQuantity: orders.reduce((sum, order) => sum + Number(order.quantity || 0), 0) };
  }).filter(service => service.totalQuantity > 0);
  return [...products, ...farms].sort((a, b) => b.totalQuantity - a.totalQuantity);
}

function renderBestSellers(elId, limit) {
  const box = document.getElementById(elId);
  if (!box) return;
  const list = getBestSellers().slice(0, limit);
  if (list.length === 0) { box.innerHTML = `<p class="text-sm text-slate-400 text-center py-6">${t("no_sales_data")}</p>`; return; }
  const medals = ["🥇","🥈","🥉"];
  box.innerHTML = list.map((p,i) => `
    <div class="flex items-center gap-3 py-1.5">
      <span class="w-6 text-center font-bold text-sm">${medals[i]||(i+1)}</span>
      <div class="w-8 h-8 rounded-lg overflow-hidden bg-slate-800/60 flex-shrink-0">${p.itemType === "farm" ? (p.image ? `<img src="${escapeHtml(p.image)}" class="w-full h-full object-cover" alt="${escapeHtml(p.name)}">` : "🌾") : productImg(p)}</div>
      <span class="flex-1 text-sm truncate">${p.itemType === "farm" ? "ฟาร์ม: " : ""}${escapeHtml(p.name)}</span>
      <span class="text-sm font-semibold text-indigo-300">${fmtNum(p.totalQuantity)} ${t("pieces_unit")}</span>
    </div>`).join("");
}

function renderReports() {
  const el = document.getElementById("report-total-sales");
  if (!el) return;
  document.getElementById("report-total-sales").textContent = fmtBaht(Math.round(totalSales()*100)/100);
  document.getElementById("report-sold-qty").textContent = fmtNum(totalSoldQty());
  document.getElementById("report-sale-count").textContent = fmtNum(state.sales.length + (state.farmOrders || []).length + (state.upgradeOrders || []).length);
  renderBestSellers("report-best-sellers", 10);
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("activity-range-select")?.addEventListener("change", event => {
    activityRange = event.target.value;
    renderTimeline();
  });
  document.getElementById("daily-checklist-form")?.addEventListener("submit", event => {
    event.preventDefault();
    const input = document.getElementById("daily-checklist-input");
    const text = input.value.trim();
    if (!text || !addChecklistTask(text)) return;
    input.value = "";
  });
  document.getElementById("checklist-history-date")?.addEventListener("change", () => renderDailyChecklist(true));
  document.getElementById("daily-checklist-list")?.addEventListener("change", event => {
    const input = event.target.closest(".daily-checklist-toggle");
    if (!input) return;
    updateChecklistTask(document.getElementById("checklist-history-date").value, input.dataset.taskId, {
      completed: input.checked, completedAt: input.checked ? Date.now() : null,
    });
  });
  document.getElementById("daily-checklist-list")?.addEventListener("click", event => {
    const button = event.target.closest(".daily-checklist-remove");
    if (!button) return;
    const today = APP_TIME.dateKey();
    const tasks = state.dailyChecklist?.[today];
    if (!Array.isArray(tasks)) return;
    state.dailyChecklist[today] = tasks.filter(task => !task || task.id !== button.dataset.taskId);
    saveState();
    renderDailyChecklist();
  });
});
