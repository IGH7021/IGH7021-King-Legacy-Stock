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
    farmServices: [],
    upgradeOrders: [],
    recipes: [],
    activityLog: [],
  };
  const elements = {
    "production-cart-panel": { classList: { toggle() {} } },
    "production-cart-lines": { innerHTML: "" },
    "production-cart-count": { textContent: "" },
    "production-cart-toggle": { setAttribute() {} },
    "production-cart-status": { textContent: "" },
    "production-cart-empty": { classList: { toggle() {} } },
    "production-cart-checkout": { disabled: false },
    "production-cart-validation": { textContent: "", classList: { toggle() {} } },
    "production-cart-total": { textContent: "" },
    "production-cart-customer": { value: "Customer" },
    "production-cart-note": { value: "Test order" },
  };
  const context = vm.createContext({
    state,
    GAME_PASS,
    document: {
      addEventListener() {},
      getElementById: id => elements[id] || { textContent: "", disabled: false, classList: { toggle() {} }, setAttribute() {} },
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
    fmtDate: String,
    isGamePassProduct: product => product?.category === "Game Pass",
    gamePassRemaining: (product, method) => GAME_PASS.remaining(product, method),
    remaining: product => Math.max(0, product.stock - product.sold),
    ingredientProduct: name => state.products.find(product => product.name.toLowerCase() === String(name || "").toLowerCase()),
    recipeMaterialRequirements: (recipe, quantity = 1) => {
      const amounts = new Map();
      recipe.ingredients.forEach(([name, amount]) => amounts.set(name, (amounts.get(name) || 0) + amount * quantity));
      return [...amounts].map(([name, required]) => {
        const product = state.products.find(entry => entry.name === name);
        return { name, required, available: Math.max(0, Number(product?.stock || 0) - Number(product?.sold || 0)) };
      });
    },
  });
  const source = fs.readFileSync(require.resolve("../js/production.js"), "utf8");
  vm.runInContext(source, context);
  return { context, state, elements };
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

test("checkout uses the selected delivery method's configured price and stock", () => {
  const { context, state } = createProductionContext([
    { id: "gift-1", type: "gamepass", refId: "pass-1", deliveryMethod: "gift", quantity: 2, unitPrice: 7.5, name: "Fruit Notifier (Gift)" },
  ]);
  context.checkoutProductionCart();

  assert.equal(state.products[0].gamePass.gift.sold, 2);
  assert.equal(state.products[0].gamePass.trade.sold, 0);
  assert.equal(state.products[0].sold, 2);
  assert.equal(state.sales[0].deliveryMethod, "gift");
  assert.equal(state.sales[0].money, 24);
  assert.equal(state.sales[0].rate, 1 / 12);
  assert.equal(state.orders[0].lines[0].deliveryMethod, "gift");
  assert.equal(state.orders[0].lines[0].unitPrice, 12);
});

test("cart item uses the selected method's default price", () => {
  const { context } = createProductionContext([]);
  const trade = context.productionCartItem("gamepass", "pass-1", 1, null, "trade");
  assert.equal(trade.deliveryMethod, "trade");
  assert.equal(trade.unitPrice, 9);
});

test("cart image lookup uses the item's current product image", () => {
  const { context, state } = createProductionContext([]);
  state.products[0].image = "assets/products/pass.png";

  assert.deepEqual(
    JSON.parse(JSON.stringify(context.cartItemImage({ type: "product", refId: "pass-1", name: "Fruit Notifier" }))),
    { src: "assets/products/pass.png", alt: "Fruit Notifier", fallback: "📦" },
  );
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

test("material cart prices follow the product's pieces-per-baht rate", () => {
  const { context, state } = createProductionContext([]);
  state.products.push({
    id: "sharks-canine", name: "Sharks Canine", category: "ของวัตถุดิบ",
    stock: 100, sold: 0, unitsPerBaht: 3,
  });
  const item = context.productionCartItem("product", "sharks-canine", 45);

  assert.equal(item.unitPrice, 1 / 3);
  assert.equal(context.productionCartSubtotal(item.quantity, item.unitPrice), 15);
});

test("budget mode calculates whole items without exceeding the requested amount", () => {
  const { context } = createProductionContext([]);

  assert.equal(context.productionCartQuantityForAmount(20, 1 / 3), 60);
  assert.equal(context.productionCartSubtotal(
    context.productionCartQuantityForAmount(20, 1 / 3),
    1 / 3,
  ), 20);
  assert.equal(context.productionCartQuantityForAmount(20, 15), 1);
  assert.equal(context.productionCartSubtotal(context.productionCartQuantityForAmount(20, 15), 15), 15);
  assert.equal(context.productionCartQuantityForAmount(0.5, 1), 0);
  assert.equal(context.productionCartQuantityForAmount(20, 0), 0);
});

test("cart uses current product rates and removes redundant editable price fields", () => {
  const { context, state, elements } = createProductionContext([]);
  state.products.push(
    { id: "sharks-canine", name: "Sharks Canine", category: "ของวัตถุดิบ", stock: 20, sold: 0, unitsPerBaht: 3 },
    { id: "hydras-tail", name: "Hydras Tail", category: "ของวัตถุดิบ", stock: 5, sold: 0, unitsPerBaht: 1 / 15 },
  );
  state.cart.push(
    { id: "sharks-line", type: "product", refId: "sharks-canine", name: "Sharks Canine", quantity: 6, unitPrice: 1 },
    { id: "hydras-line", type: "product", refId: "hydras-tail", name: "Hydras Tail", quantity: 1, unitPrice: 1 },
  );
  context.renderProductionCart();

  assert.equal(state.cart[0].unitPrice, 1 / 3);
  assert.equal(state.cart[1].unitPrice, 15);
  assert.equal(context.productionCartSubtotal(state.cart[0].quantity, state.cart[0].unitPrice), 2);
  assert.equal(context.productionCartSubtotal(state.cart[1].quantity, state.cart[1].unitPrice), 15);
  assert.equal((elements["production-cart-lines"].innerHTML.match(/data-cart-quantity/g) || []).length, 2);
  assert.doesNotMatch(elements["production-cart-lines"].innerHTML, /data-cart-price|data-cart-sale-amount|production_cart_unit_price/);

  context.checkoutProductionCart();

  assert.equal(state.products.find(product => product.id === "sharks-canine").sold, 6);
  assert.equal(state.products.find(product => product.id === "hydras-tail").sold, 1);
  assert.equal(state.sales.find(sale => sale.productId === "sharks-canine").money, 2);
  assert.equal(state.sales.find(sale => sale.productId === "hydras-tail").money, 15);
});

test("upgrade orders use and deduct materials for all selected upgrade stages", () => {
  const { context, state } = createProductionContext([{
    id: "upgrade-1", type: "upgrade", refId: "sword-1", upgradeLevel: 2,
    quantity: 2, unitPrice: 4, name: "Test Sword upgrade · ขั้น 2",
  }]);
  state.products.push(
    { id: "iron", name: "Iron Ingot", category: "ของวัตถุดิบ", stock: 10, sold: 0 },
    { id: "pearl", name: "Pearl", category: "ของวัตถุดิบ", stock: 10, sold: 0 },
    {
      id: "sword-1", name: "Test Sword", category: "ดาบ", stock: 1, sold: 0,
      upgradeSteps: [
        { ingredients: [["Iron Ingot", 2]] },
        { ingredients: [["Iron Ingot", 1], ["Pearl", 3]] },
      ],
    },
  );
  state.cart[0].refId = "sword-1";
  assert.equal(context.validateProductionCart(), "");
  state.products.find(product => product.id === "iron").stock = 5;
  assert.match(context.validateProductionCart(), /production_cart_error_stock/);
  state.products.find(product => product.id === "iron").stock = 10;

  context.checkoutProductionCart();

  assert.equal(state.products.find(product => product.id === "iron").stock, 4);
  assert.equal(state.products.find(product => product.id === "pearl").stock, 4);
  assert.equal(state.upgradeOrders[0].upgradeLevel, 2);
  assert.deepEqual(Array.from(state.upgradeOrders[0].materials, item => ({ name: item.name, quantity: item.quantity })), [
    { name: "Iron Ingot", quantity: 6 },
    { name: "Pearl", quantity: 6 },
  ]);
});
