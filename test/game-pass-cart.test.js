const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const GAME_PASS = require("../shared/game-pass");

function createProductionContext(cart) {
  const state = {
    products: [{
      id: "pass-1",
      name: "Fruit Notifier",
      category: "Game Pass",
      sold: 0,
      gamePass: {
        gift: { price: 12, stock: 2, sold: 0 },
        trade: { price: 9, stock: 1, sold: 0 },
      },
    }],
    cart,
    sales: [],
    orders: [],
    activityLog: [],
  };
  const elements = {
    "production-cart-customer": { value: "Customer" },
    "production-cart-note": { value: "Test order" },
    "production-cart-total": { textContent: "" },
    "production-cart-checkout": { disabled: false },
    "production-cart-validation": { textContent: "", classList: { toggle() {} } },
    "production-cart-toggle": { setAttribute() {} },
  };
  const context = vm.createContext({
    state,
    GAME_PASS,
    document: {
      addEventListener() {},
      getElementById: id => elements[id] || { textContent: "", disabled: false, classList: { toggle() {} } },
      querySelectorAll: () => [],
    },
    t: key => key,
    genId: (() => { let index = 0; return prefix => `${prefix}-${++index}`; })(),
    saveState() {},
    renderProductionCart() {},
    renderProducts() {},
    renderFarmServices() {},
    renderCrafting() {},
    renderUpgradeOrders() {},
    renderSalesHistory() {},
    renderDashboard() {},
    renderReports() {},
    renderUpgradeOrders() {},
    toast() {},
    fmtBaht: value => `฿${value}`,
    fmtNum: value => String(value),
    isGamePassProduct: product => product?.category === "Game Pass",
    gamePassRemaining: (product, method) => GAME_PASS.remaining(product, method),
    remaining: product => Math.max(0, product.stock - product.sold),
  });
  const source = fs.readFileSync(require.resolve("../js/production.js"), "utf8");
  vm.runInContext(source, context);
  return { context, state };
}

test("cart validation checks stock separately for Gift and Trade", () => {
  const { context } = createProductionContext([
    { id: "gift-1", type: "gamepass", refId: "pass-1", deliveryMethod: "gift", quantity: 2, unitPrice: 12 },
    { id: "trade-1", type: "gamepass", refId: "pass-1", deliveryMethod: "trade", quantity: 1, unitPrice: 9 },
  ]);
  assert.equal(context.validateProductionCart(), "");

  context.state.cart.push({
    id: "gift-2", type: "gamepass", refId: "pass-1", deliveryMethod: "gift", quantity: 1, unitPrice: 12,
  });
  assert.match(context.validateProductionCart(), /production_cart_error_gamepass_stock/);
});

test("checkout stores delivery method and deducts only that variant's stock", () => {
  const { context, state } = createProductionContext([
    { id: "gift-1", type: "gamepass", refId: "pass-1", deliveryMethod: "gift", quantity: 2, unitPrice: 7.5, name: "Fruit Notifier (Gift)" },
  ]);
  context.checkoutProductionCart();

  assert.equal(state.products[0].gamePass.gift.sold, 2);
  assert.equal(state.products[0].gamePass.trade.sold, 0);
  assert.equal(state.products[0].sold, 2);
  assert.equal(state.sales[0].deliveryMethod, "gift");
  assert.equal(state.sales[0].money, 15);
  assert.equal(state.sales[0].rate, 2 / 15);
  assert.equal(state.orders[0].lines[0].deliveryMethod, "gift");
});

test("cart item uses the selected method's default price", () => {
  const { context } = createProductionContext([]);
  const trade = context.productionCartItem("gamepass", "pass-1", 1, null, "trade");
  assert.equal(trade.deliveryMethod, "trade");
  assert.equal(trade.unitPrice, 9);
});

test("unlimited method stock does not block a cart quantity", () => {
  const { context, state } = createProductionContext([
    { id: "gift-1", type: "gamepass", refId: "pass-1", deliveryMethod: "gift", quantity: 100, unitPrice: 12 },
  ]);
  state.products[0].gamePass.gift.stock = null;
  assert.equal(context.validateProductionCart(), "");
});

test("cart feedback blocks fractional Game Pass quantities before checkout", () => {
  const { context, state } = createProductionContext([
    { id: "gift-1", type: "gamepass", refId: "pass-1", deliveryMethod: "gift", quantity: 1.5, unitPrice: 12 },
  ]);
  context.updateProductionCartFeedback();
  assert.equal(context.document.getElementById("production-cart-checkout").disabled, true);
  assert.match(context.document.getElementById("production-cart-validation").textContent, /production_cart_error_gamepass/);
  state.cart[0].quantity = 1;
  assert.equal(context.updateProductionCartFeedback(), "");
  assert.equal(context.document.getElementById("production-cart-checkout").disabled, false);
});

test("cart totals sum per-line cent-rounded subtotals", () => {
  const { context, state } = createProductionContext([
    { id: "gift-1", type: "gamepass", refId: "pass-1", deliveryMethod: "gift", quantity: 1, unitPrice: 0.335 },
    { id: "trade-1", type: "gamepass", refId: "pass-1", deliveryMethod: "trade", quantity: 1, unitPrice: 0.335 },
  ]);
  context.refreshCartTotals();

  assert.equal(context.productionCartSubtotal(1, 0.335), 0.34);
  assert.equal(context.document.getElementById("production-cart-total").textContent, "฿0.68");
});

test("cart preserves sub-satang default prices for high-quantity products", () => {
  const { context, state } = createProductionContext([]);
  state.products.push({
    id: "material-1", name: "Common Material", category: "ของวัตถุดิบ",
    stock: 1000000, sold: 0, unitsPerBaht: 1000000,
  });
  const item = context.productionCartItem("product", "material-1", 1000000);

  assert.equal(item.unitPrice, 0.000001);
  assert.equal(context.productionCartSubtotal(item.quantity, item.unitPrice), 1);
});
