let currentSaleProductId = null;
let saleMode = "qty"; // qty | money
let salesDateRange = { from: "", to: "" };

function openSaleModal(productId) {
  currentSaleProductId = productId;
  const p = state.products.find(x => x.id === productId);
  if (!p) return;
  const sel = document.getElementById("sale-product-select");
  sel.innerHTML = state.products.map(x => `<option value="${x.id}" ${x.id===productId?"selected":""}>${x.name} ${t("remaining_suffix", { n: fmtNum(remaining(x)) })}</option>`).join("");
  document.getElementById("sale-date").value = new Date().toISOString().slice(0,16);
  document.getElementById("sale-note").value = "";
  document.getElementById("sale-qty-input").value = "";
  document.getElementById("sale-money-input").value = "";
  document.getElementById("remember-rate-checkbox").checked = false;
  setSaleMode("qty");
  updateSaleModalInfo();
  openModal("sale-modal");
}

function setSaleMode(mode) {
  saleMode = mode;
  document.getElementById("mode-qty-btn").classList.toggle("seg-active", mode === "qty");
  document.getElementById("mode-money-btn").classList.toggle("seg-active", mode === "money");
  document.getElementById("sale-qty-wrap").classList.toggle("hidden", mode !== "qty");
  document.getElementById("sale-money-wrap").classList.toggle("hidden", mode !== "money");
  updateSaleCalculation();
}

function updateSaleModalInfo() {
  const p = state.products.find(x => x.id === document.getElementById("sale-product-select").value);
  if (!p) return;
  document.getElementById("sale-product-img").innerHTML = productImg(p);
  document.getElementById("sale-product-rate").textContent = rateLabel(p);
  document.getElementById("sale-product-remaining").textContent = fmtNum(remaining(p));
  updateSaleCalculation();
}

function updateSaleCalculation() {
  const p = state.products.find(x => x.id === document.getElementById("sale-product-select").value);
  if (!p) return;
  const rate = p.unitsPerBaht || 1;
  let qty = 0, money = 0;
  if (saleMode === "qty") {
    qty = parseFloat(document.getElementById("sale-qty-input").value) || 0;
    money = qty > 0 ? qty / rate : 0;
  } else {
    money = parseFloat(document.getElementById("sale-money-input").value) || 0;
    qty = money > 0 ? Math.floor(money * rate) : 0;
  }
  if (!isFinite(qty) || qty < 0) qty = 0;
  if (!isFinite(money) || money < 0) money = 0;

  const rem = remaining(p);
  const after = rem - qty;
  document.getElementById("sale-result-qty").textContent = fmtNum(qty) + " " + t("pieces_unit");
  document.getElementById("sale-result-money").textContent = fmtBaht(Math.round(money*100)/100);
  document.getElementById("sale-result-after").textContent = fmtNum(Math.max(0, after));

  const errBox = document.getElementById("sale-error");
  const confirmBtn = document.getElementById("confirm-sale-btn");
  if (qty > rem) {
    errBox.textContent = t("error_insufficient_stock");
    errBox.classList.remove("hidden");
    confirmBtn.disabled = true;
  } else if (qty <= 0) {
    errBox.classList.add("hidden");
    confirmBtn.disabled = true;
  } else {
    errBox.classList.add("hidden");
    confirmBtn.disabled = false;
  }
  confirmBtn.dataset.qty = qty;
  confirmBtn.dataset.money = money;
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("sale-product-select").addEventListener("change", updateSaleModalInfo);
  document.getElementById("mode-qty-btn").addEventListener("click", () => setSaleMode("qty"));
  document.getElementById("mode-money-btn").addEventListener("click", () => setSaleMode("money"));
  document.getElementById("sale-qty-input").addEventListener("input", updateSaleCalculation);
  document.getElementById("sale-money-input").addEventListener("input", updateSaleCalculation);
  document.getElementById("quick-sale-btn").addEventListener("click", () => {
    if (state.products.length === 0) { toast(t("toast_no_products"), "error"); return; }
    openSaleModal(state.products[0].id);
  });
  document.getElementById("sale-form").addEventListener("submit", handleSaleSubmit);
  document.getElementById("sales-date-from").addEventListener("change", event => { salesDateRange.from = event.target.value; renderSalesHistory(); });
  document.getElementById("sales-date-to").addEventListener("change", event => { salesDateRange.to = event.target.value; renderSalesHistory(); });
  document.getElementById("sales-clear-date").addEventListener("click", () => {
    salesDateRange = { from: "", to: "" };
    document.getElementById("sales-date-from").value = "";
    document.getElementById("sales-date-to").value = "";
    renderSalesHistory();
  });
  document.getElementById("sales-prev-month").addEventListener("click", () => shiftSalesMonth(-1));
  document.getElementById("sales-next-month").addEventListener("click", () => shiftSalesMonth(1));
});

function shiftSalesMonth(offset) {
  const base = salesDateRange.from ? new Date(`${salesDateRange.from}T00:00:00`) : new Date();
  base.setDate(1); base.setMonth(base.getMonth() + offset);
  const year = base.getFullYear();
  const month = String(base.getMonth() + 1).padStart(2, "0");
  const lastDay = new Date(year, base.getMonth() + 1, 0).getDate();
  salesDateRange = { from: `${year}-${month}-01`, to: `${year}-${month}-${String(lastDay).padStart(2, "0")}` };
  document.getElementById("sales-date-from").value = salesDateRange.from;
  document.getElementById("sales-date-to").value = salesDateRange.to;
  renderSalesHistory();
}

function handleSaleSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById("confirm-sale-btn");
  const qty = parseFloat(btn.dataset.qty) || 0;
  const money = parseFloat(btn.dataset.money) || 0;
  const p = state.products.find(x => x.id === document.getElementById("sale-product-select").value);
  if (!p || qty <= 0 || qty > remaining(p)) { toast(t("toast_insufficient_stock"), "error"); return; }

  const original = btn.innerHTML;
  btn.disabled = true; btn.innerHTML = `<span class="spinner"></span> ...`;

  setTimeout(() => {
    const rememberRate = document.getElementById("remember-rate-checkbox").checked;
    const dateVal = document.getElementById("sale-date").value;
    const note = document.getElementById("sale-note").value.trim();

    p.sold += qty;
    if (rememberRate) { /* rate already used from product, nothing else to change */ }

    state.sales.unshift({
      id: genId("s"), productId: p.id, productName: p.name,
      quantity: qty, money: Math.round(money*100)/100,
      rate: p.unitsPerBaht, date: dateVal ? new Date(dateVal).getTime() : Date.now(),
      note,
    });
    saveState();
    renderProducts();
    renderSalesHistory();
    renderDashboard();
    renderReports();
    toast(t("toast_sale_saved"));
    btn.disabled = false; btn.innerHTML = original;
    closeModal("sale-modal");
  }, 250);
}

function renderSalesHistory() {
  const box = document.getElementById("sales-history-list");
  if (!box) return;
  const from = salesDateRange.from ? new Date(`${salesDateRange.from}T00:00:00`).getTime() : -Infinity;
  const to = salesDateRange.to ? new Date(`${salesDateRange.to}T23:59:59.999`).getTime() : Infinity;
  const visibleSales = state.sales.filter(s => s.date >= from && s.date <= to);
  if (visibleSales.length === 0) {
    box.innerHTML = `<div class="flex flex-col items-center justify-center py-16 text-slate-400">
      <div class="text-5xl mb-3">🧾</div><p>${state.sales.length ? t("no_sales_in_range") : t("empty_no_sales")}</p></div>`;
    return;
  }
  box.innerHTML = visibleSales.map(s => {
    const p = state.products.find(x => x.id === s.productId);
    return `<div class="glass-card rounded-xl p-3 flex items-center gap-3">
      <div class="w-12 h-12 rounded-lg overflow-hidden bg-slate-800/60 flex-shrink-0">${p ? productImg(p) : '<div class="w-full h-full flex items-center justify-center text-xl">📦</div>'}</div>
      <div class="flex-1 min-w-0">
        <div class="flex justify-between gap-2">
          <span class="font-medium text-sm truncate">${s.productName}</span>
          <span class="font-semibold text-sm text-emerald-400 whitespace-nowrap">${fmtBaht(s.money)}</span>
        </div>
        <div class="text-xs text-slate-400 flex flex-wrap gap-x-2">
          <span>${fmtNum(s.quantity)} ${t("pieces_unit")}</span><span>•</span>
          <span>${fmtDate(s.date)}</span>
          ${s.note ? `<span>• ${s.note}</span>` : ""}
        </div>
      </div>
    </div>`;
  }).join("");
}
