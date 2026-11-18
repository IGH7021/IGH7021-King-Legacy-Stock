let currentSaleProductId = null;
let saleMode = "qty"; // qty | money
let salesDateRange = { from: "", to: "" };
const datePickerMonths = new Map();

function dateValueLabel(value) {
  if (!value) return "เลือกวันที่";
  return new Date(APP_TIME.startOfDateKey(value)).toLocaleDateString("th-TH", { timeZone: APP_TIME.TIME_ZONE, day: "numeric", month: "short", year: "numeric" });
}

function renderDatePicker(picker) {
  const input = document.getElementById(picker.dataset.datePicker);
  const popover = picker.querySelector(".date-picker-popover");
  const trigger = picker.querySelector(".date-picker-trigger span");
  if (!input || !popover) return;
  const current = datePickerMonths.get(picker) || new Date(`${APP_TIME.dateKey()}T00:00:00Z`);
  const year = current.getUTCFullYear();
  const month = current.getUTCMonth();
  const first = new Date(Date.UTC(year, month, 1));
  const start = new Date(Date.UTC(year, month, 1 - first.getUTCDay()));
  const monthLabel = new Date(Date.UTC(year, month, 1)).toLocaleDateString("th-TH", { timeZone: "UTC", month: "long", year: "numeric" });
  const days = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
  let cells = days.map(day => `<span class="calendar-weekday">${day}</span>`).join("");
  for (let i = 0; i < 42; i++) {
    const day = new Date(start); day.setUTCDate(start.getUTCDate() + i);
    const value = `${day.getUTCFullYear()}-${String(day.getUTCMonth() + 1).padStart(2, "0")}-${String(day.getUTCDate()).padStart(2, "0")}`;
    const muted = day.getUTCMonth() !== month;
    const selected = input.value === value;
    const today = APP_TIME.dateKey() === value;
    cells += `<button type="button" class="calendar-day ${muted ? "is-muted" : ""} ${selected ? "is-selected" : ""} ${today ? "is-today" : ""}" data-date-value="${value}">${day.getUTCDate()}</button>`;
  }
  popover.innerHTML = `<div class="calendar-header"><button type="button" data-calendar-nav="prev" aria-label="เดือนก่อนหน้า">◀️</button><strong>🗓️ ${monthLabel}</strong><button type="button" data-calendar-nav="next" aria-label="เดือนถัดไป">▶️</button></div><div class="calendar-grid">${cells}</div><div class="calendar-footer"><button type="button" data-calendar-clear>🧹 ล้าง</button><button type="button" data-calendar-today>📍 วันนี้</button></div>`;
  trigger.textContent = dateValueLabel(input.value);
}

function syncDatePickers() {
  document.querySelectorAll("[data-date-picker]").forEach(picker => renderDatePicker(picker));
}

function initializeDatePickers() {
  document.querySelectorAll("[data-date-picker]").forEach(picker => {
    const input = document.getElementById(picker.dataset.datePicker);
    datePickerMonths.set(picker, input?.value ? new Date(`${input.value}T00:00:00Z`) : new Date(`${APP_TIME.dateKey()}T00:00:00Z`));
    renderDatePicker(picker);
    picker.querySelector(".date-picker-trigger").addEventListener("click", event => { event.stopPropagation(); document.querySelectorAll(".date-picker.is-open").forEach(item => { if (item !== picker) item.classList.remove("is-open"); }); picker.classList.toggle("is-open"); });
    picker.querySelector(".date-picker-popover").addEventListener("click", event => {
      const nav = event.target.closest("[data-calendar-nav]");
      if (nav) { const month = datePickerMonths.get(picker); month.setUTCMonth(month.getUTCMonth() + (nav.dataset.calendarNav === "next" ? 1 : -1)); renderDatePicker(picker); return; }
      const day = event.target.closest("[data-date-value]");
      if (day) { input.value = day.dataset.dateValue; input.dispatchEvent(new Event("change", { bubbles: true })); picker.classList.remove("is-open"); renderDatePicker(picker); return; }
      if (event.target.closest("[data-calendar-clear]")) { input.value = ""; input.dispatchEvent(new Event("change", { bubbles: true })); renderDatePicker(picker); }
      if (event.target.closest("[data-calendar-today]")) { input.value = APP_TIME.dateKey(); input.dispatchEvent(new Event("change", { bubbles: true })); picker.classList.remove("is-open"); renderDatePicker(picker); }
    });
  });
  document.addEventListener("click", event => { if (!event.target.closest(".date-picker")) document.querySelectorAll(".date-picker.is-open").forEach(picker => picker.classList.remove("is-open")); });
}

function openSaleModal(productId) {
  currentSaleProductId = productId;
  const p = state.products.find(x => x.id === productId);
  if (!p) return;
  const sel = document.getElementById("sale-product-select");
  sel.innerHTML = state.products.map(x => `<option value="${escapeHtml(x.id)}" ${x.id===productId?"selected":""}>${escapeHtml(x.name)} ${escapeHtml(t("remaining_suffix", { n: fmtNum(remaining(x)) }))}</option>`).join("");
  document.getElementById("sale-date").value = APP_TIME.dateTimeInput();
  document.getElementById("sale-note").value = "";
  document.getElementById("sale-qty-input").value = "";
  document.getElementById("sale-money-input").value = "";
  document.getElementById("sale-game-pass-method").value = "gift";
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
  const isGamePass = isGamePassProduct(p);
  const methodWrap = document.getElementById("sale-game-pass-method-wrap");
  methodWrap.classList.toggle("hidden", !isGamePass);
  document.getElementById("remember-rate-wrap").classList.toggle("hidden", isGamePass);
  const method = document.getElementById("sale-game-pass-method").value;
  document.getElementById("sale-product-rate").textContent = isGamePass
    ? `${t(`gamepass_${method}`)} · ${fmtBaht(p.gamePass[method].price)} / ${t("gamepass_unit")}`
    : rateLabel(p);
  document.getElementById("sale-remaining-unit").textContent = t(isGamePass ? "gamepass_unit" : "pieces_unit");
  const available = isGamePass ? gamePassRemaining(p, method) : remaining(p);
  document.getElementById("sale-product-remaining").textContent = isGamePass
    ? (available === Infinity ? t("gamepass_unlimited") : fmtNum(available))
    : fmtNum(available);
  updateSaleCalculation();
}

function updateSaleCalculation() {
  const p = state.products.find(x => x.id === document.getElementById("sale-product-select").value);
  if (!p) return;
  const isGamePass = isGamePassProduct(p);
  const method = document.getElementById("sale-game-pass-method").value;
  const unitPrice = isGamePass ? Number(p.gamePass[method].price) : null;
  const rate = isGamePass ? (unitPrice > 0 ? 1 / unitPrice : 0) : (p.unitsPerBaht || 1);
  let qty = 0, money = 0;
  if (saleMode === "qty") {
    qty = parseFloat(document.getElementById("sale-qty-input").value) || 0;
    money = isGamePass ? qty * unitPrice : (qty > 0 ? qty / rate : 0);
  } else {
    money = parseFloat(document.getElementById("sale-money-input").value) || 0;
    if (isGamePass) {
      qty = unitPrice > 0 && money > 0 ? Math.floor(money / unitPrice) : 0;
      money = qty * unitPrice;
    } else qty = money > 0 ? Math.floor(money * rate) : 0;
  }
  if (!isFinite(qty) || qty < 0) qty = 0;
  if (!isFinite(money) || money < 0) money = 0;

  const rem = isGamePass ? gamePassRemaining(p, method) : remaining(p);
  const after = rem === Infinity ? Infinity : rem - qty;
  document.getElementById("sale-result-qty").textContent = fmtNum(qty) + " " + t(isGamePass ? "gamepass_unit" : "pieces_unit");
  document.getElementById("sale-result-money").textContent = fmtBaht(Math.round(money*100)/100);
  document.getElementById("sale-result-after").textContent = after === Infinity ? t("gamepass_unlimited") : fmtNum(Math.max(0, after));

  const errBox = document.getElementById("sale-error");
  const confirmBtn = document.getElementById("confirm-sale-btn");
  const invalidGamePassQuantity = isGamePass && !Number.isInteger(qty);
  if (invalidGamePassQuantity) {
    errBox.textContent = t("gamepass_quantity_whole");
    errBox.classList.remove("hidden");
    confirmBtn.disabled = true;
  } else if (qty > rem) {
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
  initializeDatePickers();
  document.getElementById("sale-product-select").addEventListener("change", updateSaleModalInfo);
  document.getElementById("sale-game-pass-method").addEventListener("change", updateSaleModalInfo);
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
    syncDatePickers();
    renderSalesHistory();
  });
  document.getElementById("sales-prev-month").addEventListener("click", () => shiftSalesMonth(-1));
  document.getElementById("sales-next-month").addEventListener("click", () => shiftSalesMonth(1));
});

function shiftSalesMonth(offset) {
  const base = salesDateRange.from ? new Date(`${salesDateRange.from}T00:00:00Z`) : new Date(`${APP_TIME.dateKey()}T00:00:00Z`);
  base.setUTCDate(1); base.setUTCMonth(base.getUTCMonth() + offset);
  const year = base.getUTCFullYear();
  const month = String(base.getUTCMonth() + 1).padStart(2, "0");
  const lastDay = new Date(Date.UTC(year, base.getUTCMonth() + 1, 0)).getUTCDate();
  salesDateRange = { from: `${year}-${month}-01`, to: `${year}-${month}-${String(lastDay).padStart(2, "0")}` };
  document.getElementById("sales-date-from").value = salesDateRange.from;
  document.getElementById("sales-date-to").value = salesDateRange.to;
  syncDatePickers();
  renderSalesHistory();
}

function handleSaleSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById("confirm-sale-btn");
  const qty = parseFloat(btn.dataset.qty) || 0;
  const money = parseFloat(btn.dataset.money) || 0;
  const p = state.products.find(x => x.id === document.getElementById("sale-product-select").value);
  const isGamePass = isGamePassProduct(p);
  const method = document.getElementById("sale-game-pass-method").value;
  const available = isGamePass ? gamePassRemaining(p, method) : remaining(p);
  if (!p || qty <= 0 || (isGamePass && !Number.isInteger(qty)) || qty > available) { toast(t("toast_insufficient_stock"), "error"); return; }
  const dateVal = document.getElementById("sale-date").value;
  const saleTimestamp = dateVal ? APP_TIME.parseDateTimeInput(dateVal) : Date.now();
  if (!Number.isFinite(saleTimestamp)) { toast(t("error_invalid_datetime"), "error"); return; }

  const original = btn.innerHTML;
  btn.disabled = true; btn.innerHTML = `<span class="inline-flex items-center gap-2" role="status"><span class="spinner" aria-hidden="true"></span><span class="sr-only">${t("loading")}</span></span>`;

  setTimeout(() => {
    const rememberRate = document.getElementById("remember-rate-checkbox").checked;
    const note = document.getElementById("sale-note").value.trim();

    if (isGamePass) {
      p.gamePass[method].sold += qty;
      p.sold = Number(p.sold || 0) + qty;
    } else p.sold += qty;
    if (rememberRate) { /* rate already used from product, nothing else to change */ }

    state.sales.unshift({
      id: genId("s"), productId: p.id, productName: p.name,
      quantity: qty, money: Math.round(money*100)/100,
      rate: isGamePass ? (p.gamePass[method].price > 0 ? 1 / p.gamePass[method].price : 0) : p.unitsPerBaht,
      ...(isGamePass ? { deliveryMethod: method } : {}),
      date: saleTimestamp,
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

function salesRangeDayCount(visibleSales) {
  const saleDays = visibleSales.map(sale => APP_TIME.dateKey(sale.date)).filter(Boolean).sort();
  const firstDay = salesDateRange.from || saleDays[0] || salesDateRange.to;
  const lastDay = salesDateRange.to || saleDays[saleDays.length - 1] || salesDateRange.from;
  if (!firstDay || !lastDay || firstDay > lastDay) return 0;
  const first = firstDay.split("-").map(Number);
  const last = lastDay.split("-").map(Number);
  return Math.floor((Date.UTC(last[0], last[1] - 1, last[2]) - Date.UTC(first[0], first[1] - 1, first[2])) / 86400000) + 1;
}

function renderSalesHistory() {
  const box = document.getElementById("sales-history-list");
  if (!box) return;
  const from = salesDateRange.from ? APP_TIME.startOfDateKey(salesDateRange.from) : -Infinity;
  const to = salesDateRange.to ? APP_TIME.startOfDateKey(APP_TIME.addDays(salesDateRange.to, 1)) : Infinity;
  const visibleSales = state.sales.filter(s => s.date >= from && s.date < to);
  const rangeTotal = Math.round(visibleSales.reduce((sum, sale) => sum + (Number(sale.money) || 0), 0) * 100) / 100;
  const dayCount = salesRangeDayCount(visibleSales);
  document.getElementById("sales-range-total").textContent = fmtBaht(rangeTotal);
  document.getElementById("sales-range-count").textContent = fmtNum(visibleSales.length);
  document.getElementById("sales-range-daily-average").textContent = fmtBaht(dayCount ? Math.round(rangeTotal / dayCount * 100) / 100 : 0);
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
          <span class="font-medium text-sm truncate">${escapeHtml(s.productName)}${s.deliveryMethod ? ` (${escapeHtml(t(`gamepass_${s.deliveryMethod}`))})` : ""}</span>
          <span class="font-semibold text-sm text-emerald-400 whitespace-nowrap">${fmtBaht(s.money)}</span>
        </div>
        <div class="text-xs text-slate-400 flex flex-wrap gap-x-2">
          <span>${fmtNum(s.quantity)} ${t("pieces_unit")}</span><span>•</span>
          <span>${fmtDate(s.date)}</span>
          ${s.note ? `<span>• ${escapeHtml(s.note)}</span>` : ""}
        </div>
      </div>
    </div>`;
  }).join("");
}
