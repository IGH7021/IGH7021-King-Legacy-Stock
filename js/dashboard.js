let salesChart = null;

function totalSales() { return state.sales.reduce((a,s) => a + s.money, 0); }
function totalSoldQty() { return state.sales.reduce((a,s) => a + s.quantity, 0); }
function totalRemainingStock() { return state.products.reduce((a,p) => a + remaining(p), 0); }
function todaySales() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return state.sales.filter(s => s.date >= start.getTime());
}

function renderDashboard() {
  document.getElementById("stat-total-sales").textContent = fmtBaht(Math.round(totalSales()*100)/100);
  document.getElementById("stat-sold-qty").textContent = fmtNum(totalSoldQty()) + " " + t("pieces_unit");
  document.getElementById("stat-sale-count").textContent = fmtNum(state.sales.length);
  document.getElementById("stat-remaining").textContent = fmtNum(totalRemainingStock()) + " " + t("pieces_unit");
  const salesToday = todaySales();
  const todayMoney = salesToday.reduce((sum, sale) => sum + sale.money, 0);
  document.getElementById("stat-today-sales").textContent = fmtBaht(Math.round(todayMoney * 100) / 100);
  document.getElementById("stat-today-qty").textContent = fmtNum(salesToday.reduce((sum, sale) => sum + sale.quantity, 0));
  document.getElementById("stat-today-orders").textContent = fmtNum(salesToday.length);
  document.getElementById("stat-average-order").textContent = fmtBaht(salesToday.length ? Math.round(todayMoney / salesToday.length * 100) / 100 : 0);
  renderSalesChart();
  renderTimeline();
  renderBestSellers("dashboard-best-sellers", 5);
}

function renderSalesChart() {
  const ctx = document.getElementById("sales-chart");
  if (!ctx) return;
  const days = [];
  const labels = [];
  const dayNames = ["อา","จ","อ","พ","พฤ","ศ","ส"];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0,0,0,0);
    days.push(d.getTime());
    labels.push(dayNames[d.getDay()]);
  }
  const totals = days.map(dayStart => {
    const dayEnd = dayStart + 86400000;
    return state.sales.filter(s => s.date >= dayStart && s.date < dayEnd).reduce((a,s) => a+s.money, 0);
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

function renderTimeline() {
  const box = document.getElementById("activity-timeline");
  if (!box) return;
  const events = [];
  (state.activityLog || []).forEach(activity => events.push({ ts: activity.ts, text: `${activity.type === "craft" ? "🛠️" : "🧾"} ${activity.text}`, sub: activity.sub || "รายการฟาร์ม", color: activity.type === "craft" ? "bg-amber-400" : "bg-orange-400" }));
  state.sales.slice(0, 8).forEach(s => events.push({ ts: s.date, text: t("timeline_sold", { name: s.productName, qty: fmtNum(s.quantity) }), sub: fmtBaht(s.money), color: "bg-emerald-400" }));
  (state.farmOrders || []).slice(0, 8).forEach(order => { if (!(state.activityLog || []).some(activity => activity.ts === order.date && activity.text.includes(order.serviceName))) events.push({ ts: order.date, text: `🌾 รับฟาร์ม ${order.serviceName} ${order.pricingMode === "hour" ? `${fmtNum(order.hours || order.quantity)} ชั่วโมง` : `${fmtNum(order.quantity)} ${t("pieces_unit")}`}`, sub: fmtBaht(order.money), color: "bg-orange-400" }); });
  state.products.forEach(p => (p.restockHistory||[]).forEach(r => events.push({ ts: r.date, text: t("timeline_restocked", { name: p.name }), sub: `+${fmtNum(r.amount)} ${t("pieces_unit")}`, color: "bg-indigo-400" })));
  events.sort((a,b) => b.ts - a.ts);
  const top = events.slice(0, 8);
  if (top.length === 0) {
    box.innerHTML = `<p class="text-sm text-slate-400 text-center py-6">${t("no_sales_data")}</p>`;
    return;
  }
  box.innerHTML = top.map(ev => `
    <div class="flex gap-3 items-start">
      <span class="w-2 h-2 rounded-full ${ev.color} mt-1.5 flex-shrink-0"></span>
      <div class="flex-1 min-w-0">
        <p class="text-sm truncate">${ev.text}</p>
        <p class="text-xs text-slate-400">${ev.sub} • ${timeAgo(ev.ts)}</p>
      </div>
    </div>`).join("");
}

function getBestSellers() {
  const products = state.products.filter(p => (p.sold || 0) > 0 || (p.crafted || 0) > 0).map(product => ({ ...product, itemType: "product", totalQuantity: (product.sold || 0) + (product.crafted || 0) }));
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
      <div class="w-8 h-8 rounded-lg overflow-hidden bg-slate-800/60 flex-shrink-0">${p.itemType === "farm" ? (p.image ? `<img src="${p.image}" class="w-full h-full object-cover" alt="${p.name}">` : "🌾") : productImg(p)}</div>
      <span class="flex-1 text-sm truncate">${p.itemType === "farm" ? "ฟาร์ม: " : ""}${p.name}</span>
      <span class="text-sm font-semibold text-indigo-300">${fmtNum(p.totalQuantity)} ${t("pieces_unit")}</span>
    </div>`).join("");
}

function renderReports() {
  const el = document.getElementById("report-total-sales");
  if (!el) return;
  document.getElementById("report-total-sales").textContent = fmtBaht(Math.round(totalSales()*100)/100);
  document.getElementById("report-sold-qty").textContent = fmtNum(totalSoldQty());
  document.getElementById("report-sale-count").textContent = fmtNum(state.sales.length);
  renderBestSellers("report-best-sellers", 10);
}
