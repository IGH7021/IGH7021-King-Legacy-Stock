const test = require("node:test");
const assert = require("node:assert/strict");
const GAME_PASS = require("../shared/game-pass");
const { validateAccountState } = require("../shared/state-validation");

test("Game Pass methods keep independent prices, stock, and remaining counts", () => {
  const product = {
    gamePass: {
      gift: { price: 25, stock: 8, sold: 3 },
      trade: { price: 20, stock: null, sold: 11 },
    },
  };

  assert.equal(GAME_PASS.remaining(product, "gift"), 5);
  assert.equal(GAME_PASS.remaining(product, "trade"), Infinity);
  assert.equal(GAME_PASS.isValid(product.gamePass), true);
});

test("legacy shared Game Pass stock migrates to Gift without creating Trade stock", () => {
  const product = { stock: 7, sold: 4, unitsPerBaht: 0.25 };
  const variants = GAME_PASS.migrateLegacyProduct(product);

  assert.deepEqual(variants, {
    gift: { price: 4, stock: 7, sold: 4 },
    trade: { price: 4, stock: 0, sold: 0 },
  });
  assert.equal(GAME_PASS.remaining({ gamePass: variants }, "gift"), 3);
  assert.equal(GAME_PASS.remaining({ gamePass: variants }, "trade"), 0);
});

test("account validation rejects malformed Game Pass variants but accepts legacy rows", () => {
  const base = { products: [], sales: [], settings: { categories: [] } };
  const legacy = { ...base, products: [{ id: "legacy", category: "Game Pass" }] };
  const malformed = {
    ...base,
    products: [{
      id: "invalid",
      category: "Game Pass",
      gamePass: {
        gift: { price: 10, stock: 2.5, sold: 0 },
        trade: { price: 8, stock: null, sold: 0 },
      },
    }],
  };
  const current = {
    ...base,
    products: [{
      id: "valid",
      category: "Game Pass",
      gamePass: {
        gift: { price: 10, stock: 2, sold: 0 },
        trade: { price: 8, stock: null, sold: 1 },
      },
    }],
  };

  assert.equal(validateAccountState(legacy).valid, true);
  assert.equal(validateAccountState(current).valid, true);
  assert.equal(validateAccountState(malformed).valid, false);
});
