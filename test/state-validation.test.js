const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { quarantineLocalState, validateAccountState } = require("../shared/state-validation");

test("accepts legacy states with optional newer fields absent", () => {
  assert.deepEqual(validateAccountState({
    products: [{ id: "p1", name: "Dragon" }],
    sales: [],
    settings: { categories: ["ผลปีศาจ"] },
  }), { valid: true, error: null });
});

test("accepts current account-owned production records", () => {
  assert.deepEqual(validateAccountState({
    schemaVersion: 3,
    products: [{ id: "custom-1", name: "Custom product" }],
    sales: [],
    settings: { categories: ["ดาบ"] },
    recipes: [],
    farmServices: [],
    farmOrders: [],
    orders: [{ id: "order-1", lines: [] }],
    upgradeOrders: [],
    cart: [],
    dailyChecklist: {},
    activityLog: [],
  }), { valid: true, error: null });
});

test("accepts the actual first-time workspace state", () => {
  const dataSource = fs.readFileSync(require.resolve("../js/data.js"), "utf8");
  const defaultState = vm.runInNewContext(`${dataSource}\ndefaultState();`);

  assert.deepEqual(validateAccountState(defaultState), { valid: true, error: null });
});

test("validates linked craft-only component recipe materials", () => {
  const state = {
    products: [],
    sales: [],
    settings: {},
    recipes: [{
      name: "Chronicles Lore",
      ingredients: [["Fortune Tales", 1]],
      componentRecipes: [{ ingredientName: "Fortune Tales", ingredients: [["Seas Wraith", 1]] }],
      alternatives: [{
        ingredients: [["Heart of Sea", 1]],
        componentRecipes: [{ ingredientName: "Heart of Sea", ingredients: [["Krakens Ink", 2]] }],
      }],
    }],
  };
  assert.equal(validateAccountState(state).valid, true);

  state.recipes[0].componentRecipes[0].ingredients[0][1] = 0;
  assert.equal(validateAccountState(state).valid, false);
});

test("rejects malformed state shapes before persistence", () => {
  assert.equal(validateAccountState({ products: {}, sales: [], settings: {} }).valid, false);
  assert.equal(validateAccountState({ products: [null], sales: [], settings: {} }).valid, false);
  assert.equal(validateAccountState({ products: [], sales: [], settings: [], cart: [] }).valid, false);
  assert.equal(validateAccountState({ products: [], sales: [], settings: {}, cart: {} }).valid, false);
  assert.equal(validateAccountState({ products: [], sales: [], settings: {}, dailyChecklist: [] }).valid, false);
});

test("quarantines invalid local data before removing its active key", () => {
  const values = new Map([["account", "{broken"]]);
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
  const recoveryKey = quarantineLocalState(storage, "account", storage.getItem("account"), "test");

  assert.equal(storage.getItem("account"), null);
  assert.equal(storage.getItem(recoveryKey), "{broken");
});

test("keeps the active value if recovery storage cannot be written", () => {
  const storage = {
    setItem: () => { throw new Error("quota exceeded"); },
    removeItem: () => assert.fail("active data must not be removed"),
  };

  assert.throws(() => quarantineLocalState(storage, "account", "{broken", "test"), /quota exceeded/);
});
