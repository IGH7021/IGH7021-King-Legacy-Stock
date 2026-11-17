const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function createAccountContext(initialStorage = {}) {
  const values = new Map(Object.entries(initialStorage));
  const localStorage = {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  };
  const context = vm.createContext({
    localStorage,
    console,
    document: { addEventListener() {} },
    window: { addEventListener() {} },
    fetch: async () => ({ status: 404, ok: false }),
    setTimeout: () => 1,
    clearTimeout() {},
    setInterval: () => 1,
    clearInterval() {},
  });
  const files = [
    "../js/data.js",
    "../shared/game-pass.js",
    "../shared/state-validation.js",
    "../js/utils.js",
  ];
  for (const file of files) {
    vm.runInContext(fs.readFileSync(require.resolve(file), "utf8"), context);
  }
  vm.runInContext('AUTH_TOKEN_KEY = "auth"; renderAccountState = () => {};', context);
  return { context, localStorage };
}

test("keeps a valid owner-local workspace when no server row exists", async () => {
  const ownerId = "owner-one";
  const personalKey = `igh_kinglegacy_state_${encodeURIComponent(ownerId)}`;
  const accountState = {
    schemaVersion: 2,
    products: [{ id: "p1", name: "Dragon", category: "ผลปีศาจ", stock: 17, sold: 6, unitsPerBaht: 1 }],
    sales: [{ id: "s1", productId: "p1", productName: "Dragon", quantity: 2, money: 2, date: 1 }],
    settings: { categories: ["ผลปีศาจ"] },
  };
  const { context } = createAccountContext({ [personalKey]: JSON.stringify(accountState) });

  await vm.runInContext(`activateUserState("${ownerId}")`, context);

  assert.equal(vm.runInContext("state.products[0].stock", context), 17);
  assert.equal(vm.runInContext("state.products[0].sold", context), 6);
  assert.equal(vm.runInContext("state.sales.length", context), 1);
  assert.equal(vm.runInContext("stateSyncDirty", context), true);
});

test("migrates valid legacy workspace data instead of replacing it with defaults", async () => {
  const ownerId = "legacy-owner";
  const legacyState = {
    products: [{ id: "legacy-product", name: "Old product", category: "อื่นๆ", stock: 9, sold: 1 }],
    sales: [],
    settings: { categories: ["อื่นๆ"] },
  };
  const { context } = createAccountContext({
    igh_kinglegacy_legacy_owner: ownerId,
    igh_kinglegacy_state: JSON.stringify(legacyState),
  });

  await vm.runInContext(`activateUserState("${ownerId}")`, context);

  assert.equal(vm.runInContext("state.products[0].id", context), "legacy-product");
  assert.equal(vm.runInContext("state.products[0].stock", context), 9);
  assert.equal(vm.runInContext("stateSyncDirty", context), true);
});

test("initializes defaults for a genuinely new owner with no local or remote state", async () => {
  const { context } = createAccountContext();

  await vm.runInContext('activateUserState("new-owner")', context);

  assert.ok(vm.runInContext("state.products.length", context) > 0);
  assert.equal(vm.runInContext("state.sales.length", context), 0);
  assert.equal(vm.runInContext("stateSyncDirty", context), true);
});

test("normalizes restored account data without dropping personal production fields", () => {
  const { context } = createAccountContext();
  const backupState = JSON.parse(vm.runInContext("JSON.stringify(defaultState())", context));
  backupState.products.push({ id: "custom-1", name: "Custom product", category: "อื่นๆ", source: "custom", image: "data:image/png;base64,AA==", stock: 8, sold: 1, unitsPerBaht: 2, description: "Personal entry" });
  backupState.sales.push({ id: "sale-1", productId: "custom-1", productName: "Custom product", quantity: 1, money: 2, date: 123 });
  backupState.farmServices.push({ id: "farm-1", name: "Personal service", ratePrice: 3 });
  backupState.farmOrders.push({ id: "farm-order-1", serviceId: "farm-1", money: 3, date: 124 });
  backupState.orders.push({ id: "order-1", total: 5, lines: [{ type: "product", referenceId: "custom-1" }] });
  backupState.upgradeOrders.push({ id: "upgrade-1", productId: "custom-1", money: 4 });
  backupState.cart.push({ id: "cart-1", type: "product", refId: "custom-1", quantity: 2, unitPrice: 2 });
  backupState.dailyChecklist["2026-11-17"] = [{ id: "task-1", text: "Review stock", completed: true }];
  backupState.settings.categories.push("Personal category");

  context.__backupState = backupState;
  const restored = JSON.parse(vm.runInContext("JSON.stringify(normalizeStateData(__backupState).state)", context));

  assert.equal(restored.products.at(-1).description, "Personal entry");
  assert.equal(restored.products.at(-1).image, "data:image/png;base64,AA==");
  assert.deepEqual(restored.sales.at(-1), backupState.sales.at(-1));
  assert.deepEqual(restored.farmOrders.at(-1), backupState.farmOrders.at(-1));
  assert.deepEqual(restored.orders.at(-1), backupState.orders.at(-1));
  assert.deepEqual(restored.upgradeOrders.at(-1), backupState.upgradeOrders.at(-1));
  assert.deepEqual(restored.cart.at(-1), backupState.cart.at(-1));
  assert.deepEqual(restored.dailyChecklist["2026-11-17"], backupState.dailyChecklist["2026-11-17"]);
  assert.ok(restored.settings.categories.includes("Personal category"));
});

test("migrates a legacy Game Pass stock pool without duplicating it", () => {
  const { context } = createAccountContext();
  const legacyState = {
    products: [{ id: "pass-1", name: "Legacy Pass", category: "Game Pass", stock: 7, sold: 2, unitsPerBaht: 0.25 }],
    sales: [],
    cart: [{ id: "cart-legacy", type: "product", refId: "pass-1", name: "Legacy Pass", quantity: 1, unitPrice: 4 }],
    settings: { categories: ["Game Pass"] },
  };
  context.__legacyGamePassState = legacyState;

  const migrated = JSON.parse(vm.runInContext(
    "JSON.stringify(normalizeStateData(__legacyGamePassState))",
    context,
  ));
  const pass = migrated.state.products[0];
  assert.equal(migrated.migrated, true);
  assert.deepEqual(pass.gamePass, {
    gift: { price: 4, stock: 7, sold: 2 },
    trade: { price: 4, stock: 0, sold: 0 },
  });
  assert.equal(migrated.state.cart[0].type, "gamepass");
  assert.equal(migrated.state.cart[0].deliveryMethod, "gift");
});

test("restore normalization preserves both personal Game Pass variants", () => {
  const { context } = createAccountContext();
  const backupState = JSON.parse(vm.runInContext("JSON.stringify(defaultState())", context));
  const variants = {
    gift: { price: 15, stock: null, sold: 2 },
    trade: { price: 12, stock: 8, sold: 1 },
  };
  backupState.products.push({
    id: "custom-pass", name: "Custom Pass", category: "Game Pass", source: "custom",
    stock: 0, sold: 3, unitsPerBaht: 1, gamePass: variants,
  });
  context.__gamePassBackup = backupState;

  const restored = JSON.parse(vm.runInContext(
    "JSON.stringify(normalizeStateData(__gamePassBackup).state.products.at(-1))",
    context,
  ));
  assert.deepEqual(restored.gamePass, variants);
  assert.equal(restored.source, "custom");
});
