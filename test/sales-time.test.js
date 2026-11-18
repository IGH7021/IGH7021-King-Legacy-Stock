const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const time = require("../shared/time");

function createSalesContext(dateValue) {
  const product = { id: "p1", name: "Test item", category: "ดาบ", stock: 10, sold: 0, unitsPerBaht: 1 };
  const state = { products: [product], sales: [] };
  const messages = [];
  const elements = {
    "confirm-sale-btn": { dataset: { qty: "1", money: "5" }, innerHTML: "Save", disabled: false },
    "sale-product-select": { value: "p1" },
    "sale-game-pass-method": { value: "gift" },
    "sale-date": { value: dateValue },
    "remember-rate-checkbox": { checked: false },
    "sale-note": { value: "" },
  };
  const context = vm.createContext({
    state,
    APP_TIME: time,
    document: {
      addEventListener() {},
      getElementById: id => elements[id] || null,
    },
    t: key => key,
    toast: message => messages.push(message),
    isGamePassProduct: () => false,
    remaining: item => item.stock - item.sold,
    genId: () => "sale-1",
    saveState() {},
    renderProducts() {},
    renderSalesHistory() {},
    renderDashboard() {},
    renderReports() {},
    closeModal() {},
    setTimeout: callback => callback(),
  });
  vm.runInContext(fs.readFileSync(require.resolve("../js/sales.js"), "utf8"), context);
  return { context, state, messages };
}

test("sales store Bangkok-local datetime input as an absolute timestamp", () => {
  const { context, state } = createSalesContext("2026-11-18T10:45");
  context.handleSaleSubmit({ preventDefault() {} });

  assert.equal(state.sales[0].date, Date.parse("2026-11-18T03:45:00Z"));
});

test("sales reject invalid local dates instead of saving NaN timestamps", () => {
  const { context, state, messages } = createSalesContext("2026-02-31T10:45");
  context.handleSaleSubmit({ preventDefault() {} });

  assert.equal(state.sales.length, 0);
  assert.equal(state.products[0].sold, 0);
  assert.deepEqual(messages, ["error_invalid_datetime"]);
});

test("sales history summarizes only transactions inside the selected local date range", () => {
  const elements = {
    "sales-history-list": { innerHTML: "" },
    "sales-range-total": { textContent: "" },
    "sales-range-count": { textContent: "" },
    "sales-range-daily-average": { textContent: "" },
  };
  const dayStart = time.startOfDateKey("2026-11-18");
  const previousDayStart = time.startOfDateKey("2026-11-17");
  const state = {
    products: [],
    sales: [
      { date: dayStart + 1000, money: 12.5, quantity: 1, productName: "A" },
      { date: dayStart + 2000, money: 7.5, quantity: 2, productName: "B" },
      { date: previousDayStart + 1000, money: 10, quantity: 1, productName: "C" },
      { date: previousDayStart - 1000, money: 100, quantity: 1, productName: "D" },
    ],
  };
  const context = vm.createContext({
    state,
    APP_TIME: time,
    document: { addEventListener() {}, getElementById: id => elements[id] || null },
    t: key => key,
    fmtBaht: amount => `฿${amount.toFixed(2)}`,
    fmtNum: String,
    fmtDate: String,
    escapeHtml: String,
    productImg: () => "",
  });
  vm.runInContext(fs.readFileSync(require.resolve("../js/sales.js"), "utf8"), context);
  vm.runInContext('salesDateRange = { from: "2026-11-17", to: "2026-11-19" };', context);
  context.renderSalesHistory();

  assert.equal(elements["sales-range-total"].textContent, "฿30.00");
  assert.equal(elements["sales-range-count"].textContent, "3");
  assert.equal(elements["sales-range-daily-average"].textContent, "฿10.00");
});
