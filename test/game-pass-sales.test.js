const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const GAME_PASS = require("../shared/game-pass");

function createSalesContext() {
  const elements = new Map();
  const createElement = value => ({
    value,
    textContent: "",
    disabled: false,
    dataset: {},
    classList: { add() {}, remove() {}, toggle() {} },
  });
  [
    ["sale-product-select", "pass-1"],
    ["sale-game-pass-method", "gift"],
    ["sale-qty-input", ""],
    ["sale-money-input", "25"],
    ["sale-result-qty", ""],
    ["sale-result-money", ""],
    ["sale-result-after", ""],
    ["sale-error", ""],
    ["confirm-sale-btn", ""],
  ].forEach(([id, value]) => elements.set(id, createElement(value)));
  const context = vm.createContext({
    state: {
      products: [{
        id: "pass-1",
        name: "Fruit Notifier",
        category: "Game Pass",
        gamePass: {
          gift: { price: 12, stock: 2, sold: 0 },
          trade: { price: 9, stock: 1, sold: 0 },
        },
      }],
    },
    document: { addEventListener() {}, getElementById: id => elements.get(id) },
    APP_TIME: {},
    GAME_PASS,
    isGamePassProduct: product => product?.category === "Game Pass",
    gamePassRemaining: (product, method) => GAME_PASS.remaining(product, method),
    remaining: () => 0,
    t: key => key,
    fmtBaht: value => `฿${value}`,
    fmtNum: value => String(value),
    rateLabel: () => "rate",
  });
  vm.runInContext(fs.readFileSync(require.resolve("../js/sales.js"), "utf8"), context);
  return { context, elements };
}

test("Game Pass money-entry sale totals use whole units at the selected method price", () => {
  const { context, elements } = createSalesContext();
  vm.runInContext('saleMode = "money"; updateSaleCalculation();', context);

  assert.equal(elements.get("sale-result-qty").textContent, "2 gamepass_unit");
  assert.equal(elements.get("sale-result-money").textContent, "฿24");
  assert.equal(elements.get("confirm-sale-btn").disabled, false);

  elements.get("sale-money-input").value = "50";
  vm.runInContext("updateSaleCalculation()", context);
  assert.equal(elements.get("confirm-sale-btn").disabled, true);
});
