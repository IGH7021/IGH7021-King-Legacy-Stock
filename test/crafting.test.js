const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const GAME_PASS = require("../shared/game-pass");

function createCraftingContext({ recipe, products, cart = [] }) {
  const state = {
    products,
    recipes: [recipe],
    cart,
    sales: [],
    activityLog: [],
    orders: [],
  };
  const messages = [];
  let addToCartButton = null;
  const confirmButton = {
    textContent: "",
    disabled: false,
    parentElement: {
      insertBefore(button) {
        addToCartButton = button;
      },
    },
    addEventListener() {},
  };
  const quantityInput = {
    value: "",
    disabled: false,
    addEventListener() {},
  };
  const container = {
    innerHTML: "",
    querySelectorAll: () => [],
  };
  const elements = {
    "crafting-modal-content": container,
    "craft-quantity-input": quantityInput,
    "confirm-craft-btn": confirmButton,
  };
  const context = vm.createContext({
    state,
    RECIPES: [recipe],
    GAME_PASS,
    document: {
      addEventListener() {},
      getElementById: id => elements[id] || ({
        value: "",
        textContent: "",
        innerHTML: "",
        disabled: false,
        classList: { toggle() {} },
        setAttribute() {},
        addEventListener() {},
      }),
      querySelectorAll: () => [],
      createElement: () => ({
        type: "",
        className: "",
        textContent: "",
        listeners: {},
        addEventListener(type, handler) {
          this.listeners[type] = handler;
        },
        click() {
          this.listeners.click?.();
        },
      }),
    },
    t: key => key,
    remaining: product => Math.max(0, Number(product.stock || 0) - Number(product.sold || 0)),
    fmtNum: value => String(value),
    fmtBaht: value => `฿${value}`,
    rarityBadgeClass: () => "",
    rarityLabel: value => value,
    genId: (() => { let index = 0; return prefix => `${prefix}-${++index}`; })(),
    saveState() {},
    renderCrafting() {},
    renderProducts() {},
    renderSalesHistory() {},
    renderDashboard() {},
    renderReports() {},
    closeModal() {},
    openModal() {},
    toast: message => messages.push(message),
    isGamePassProduct: product => product?.category === "Game Pass",
    gamePassRemaining: (product, method) => GAME_PASS.remaining(product, method),
  });
  vm.runInContext(fs.readFileSync(require.resolve("../js/crafting.js"), "utf8"), context);
  vm.runInContext(fs.readFileSync(require.resolve("../js/production.js"), "utf8"), context);
  return {
    context,
    state,
    messages,
    quantityInput,
    getAddToCartButton: () => addToCartButton,
  };
}

function createRecipeState() {
  const recipe = {
    name: "Acrospear",
    salePrice: 100,
    ingredients: [["Dragon Fang", 25], ["dragon fang", 5], ["Iron Ingot", 10]],
  };
  const products = [
    { id: "output", name: "Acrospear", category: "ดาบ", stock: 0, sold: 0, crafted: 0, unitsPerBaht: 1 / 100 },
    { id: "fang", name: "Dragon Fang", category: "ของวัตถุดิบ", stock: 100, sold: 0, unitsPerBaht: 0.5 },
    { id: "iron", name: "Iron Ingot", category: "ของวัตถุดิบ", stock: 100, sold: 0, unitsPerBaht: 2 },
  ];
  return { recipe, products };
}

test("craft preview scales materials and reports requested quantity and shortage", () => {
  const { recipe, products } = createRecipeState();
  const { context } = createCraftingContext({ recipe, products });
  const preview = context.craftingQuantityPreview(recipe, "5", 3);

  assert.equal(preview.valid, false);
  assert.equal(preview.quantity, 5);
  assert.equal(preview.materialCost, 325);
  assert.equal(preview.saleTotal, 500);
  assert.deepEqual(Array.from(preview.requirements, item => [item.name, item.required, item.available]), [
    ["Dragon Fang", 150, 100],
    ["Iron Ingot", 50, 100],
  ]);
});

test("fractional crafting quantities are rejected instead of rounded down", () => {
  const { recipe, products } = createRecipeState();
  const { context } = createCraftingContext({ recipe, products });
  const preview = context.craftingQuantityPreview(recipe, "1.5", 3);

  assert.equal(preview.valid, false);
  assert.equal(preview.quantity, 0);
  assert.equal(preview.requirements[0].required, 0);
});

test("direct crafting deducts multiplied materials and rejects fractions", () => {
  const { recipe, products } = createRecipeState();
  const { context, state, messages } = createCraftingContext({ recipe, products });
  context.craftRecipe(recipe, 2);

  assert.equal(state.products[1].stock, 40);
  assert.equal(state.products[2].stock, 80);
  assert.equal(state.products[0].crafted, 2);
  assert.equal(state.products[0].sold, 2);
  assert.equal(state.sales[0].quantity, 2);

  context.craftRecipe(recipe, 1.5);
  assert.equal(state.products[1].stock, 40);
  assert.equal(state.products[2].stock, 80);
  assert.equal(state.products[0].crafted, 2);
  assert.equal(messages.length, 2);
});

test("crafting Add to cart only accepts positive safe integer quantities", () => {
  const cases = [
    { input: "1", accepted: true, quantity: 1 },
    { input: "5", accepted: true, quantity: 5 },
    { input: "1.5", accepted: false },
    { input: "2.9", accepted: false },
    { input: "0.5", accepted: false },
    { input: "0", accepted: false },
    { input: "-1", accepted: false },
    { input: "", accepted: false },
    { input: "   ", accepted: false },
    { input: "not-a-number", accepted: false },
  ];

  for (const { input, accepted, quantity } of cases) {
    const recipe = { name: "Acrospear", ingredients: [["Dragon Fang", 10]] };
    const products = [
      { id: "output", name: "Acrospear", category: "ดาบ", stock: 0, sold: 0, unitsPerBaht: 0.01 },
      { id: "fang", name: "Dragon Fang", category: "ของวัตถุดิบ", stock: 100, sold: 0, unitsPerBaht: 0.1 },
    ];
    const cart = [{ id: "existing", type: "craft", refId: "Acrospear", name: "Acrospear", quantity: 3, unitPrice: 100 }];
    const { context, state, quantityInput, getAddToCartButton } = createCraftingContext({ recipe, products, cart });

    context.openCraftingModal(recipe.name);
    quantityInput.value = input;
    getAddToCartButton().click();

    if (accepted) {
      assert.equal(state.cart.length, 1);
      assert.equal(state.cart[0].quantity, 3 + quantity);
      assert.equal(state.products[1].stock, 100);
    } else {
      assert.deepEqual(state.cart.map(item => ({ id: item.id, quantity: item.quantity })), [
        { id: "existing", quantity: 3 },
      ]);
      assert.equal(state.products[1].stock, 100);
    }
  }
});

test("cart crafting validation checks total material needs across requested quantity", () => {
  const recipe = { name: "Acrospear", ingredients: [["Iron Ingot", 10]] };
  const products = [
    { id: "output", name: "Acrospear", category: "ดาบ", stock: 0, sold: 0 },
    { id: "iron", name: "Iron Ingot", category: "ของวัตถุดิบ", stock: 49, sold: 0 },
  ];
  const cart = [{ id: "craft-1", type: "craft", refId: "Acrospear", name: "Acrospear", quantity: 5, unitPrice: 100 }];
  const { context, state } = createCraftingContext({ recipe, products, cart });

  assert.equal(context.validateProductionCart(), "production_cart_error_stock");
  state.products[1].stock = 50;
  assert.equal(context.validateProductionCart(), "");
});

test("non-tradable products only receive an existing default recipe", () => {
  const recipe = { name: "Acrospear", rarity: "legendary", ingredients: [["Iron Ingot", 10]] };
  const state = { recipes: [] };
  const context = vm.createContext({ state, RECIPES: [recipe], document: { addEventListener() {} } });
  vm.runInContext(fs.readFileSync(require.resolve("../js/products.js"), "utf8"), context);

  assert.equal(context.includeExistingRecipeForProduct({ name: "Acrospear", tradeability: "craft-only" }), true);
  assert.equal(state.recipes.length, 1);
  assert.equal(context.includeExistingRecipeForProduct({ name: "Unknown item", tradeability: "craft-only" }), false);
  assert.equal(state.recipes.length, 1);
  assert.equal(context.includeExistingRecipeForProduct({ name: "Acrospear", tradeability: "tradable" }), false);
});

test("recipe alternatives can be referenced independently and expand craft-only ingredient recipes", () => {
    const recipe = {
      name: "Chronicles Lore",
      ingredients: [["Fortune Tales", 1], ["Heart of Sea", 1]],
      alternatives: [{ ingredients: [["Fortune Tales", 2]] }],
    };
    const products = [
      { id: "output", name: "Chronicles Lore", category: "ของวัตถุดิบ", stock: 0, sold: 0 },
      { id: "fortune", name: "Fortune Tales", category: "ของวัตถุดิบ", tradeability: "craft-only", stock: 0, sold: 0 },
      { id: "heart", name: "Heart of Sea", category: "ของวัตถุดิบ", tradeability: "craft-only", stock: 0, sold: 0 },
      { id: "wraith", name: "Seas Wraith", category: "ของวัตถุดิบ", stock: 100, sold: 0 },
      { id: "ink", name: "Krakens Ink", category: "ของวัตถุดิบ", stock: 100, sold: 0 },
    ];
    const { context, state } = createCraftingContext({ recipe, products });
    state.recipes.push(
      { name: "Fortune Tales", ingredients: [["Seas Wraith", 1]] },
      { name: "Heart of Sea", ingredients: [["Heart of Sea", 3], ["Krakens Ink", 10]] },
    );

    const alternativeRef = context.recipeReference(recipe.name, 1);
    assert.equal(context.recipeFromReference(alternativeRef).recipe.ingredients[0][1], 2);
    assert.deepEqual(Array.from(context.expandCraftOnlyIngredients(recipe.ingredients, new Set(["chronicles lore"])), item => Array.from(item)), [
      ["Seas Wraith", 1],
      ["Heart of Sea", 3],
      ["Krakens Ink", 10],
    ]);
});

test("component recipes are bound to their craft-only ingredient and expand by required quantity", () => {
  const recipe = {
    name: "Chronicles Lore",
    ingredients: [["Fortune Tales", 2], ["Heart of Sea", 1]],
    componentRecipes: [
      { ingredientName: "Fortune Tales", ingredients: [["Sharks Canine", 3]] },
      { ingredientName: "Heart of Sea", ingredients: [["Krakens Ink", 4]] },
    ],
  };
  const products = [
    { id: "output", name: "Chronicles Lore", category: "ของวัตถุดิบ", stock: 0, sold: 0 },
    { id: "fortune", name: "Fortune Tales", category: "ของวัตถุดิบ", tradeability: "craft-only", stock: 0, sold: 0 },
    { id: "heart", name: "Heart of Sea", category: "ของวัตถุดิบ", tradeability: "craft-only", stock: 0, sold: 0 },
    { id: "sharks", name: "Sharks Canine", category: "ของวัตถุดิบ", stock: 20, sold: 0 },
    { id: "ink", name: "Krakens Ink", category: "ของวัตถุดิบ", stock: 10, sold: 0 },
  ];
  const { context } = createCraftingContext({ recipe, products });

  assert.deepEqual(
    Array.from(context.recipeMaterialRequirements(recipe, 2), material => ({
      name: material.name,
      required: material.required,
      available: material.available,
    })),
    [
      { name: "Sharks Canine", required: 12, available: 20 },
      { name: "Krakens Ink", required: 8, available: 10 },
    ],
  );
});

test("recipe editor exposes the selected craft-only ingredient on its linked formula", () => {
  const componentEditor = { innerHTML: "" };
  const products = [
    { id: "fortune", name: "Fortune Tales", category: "ของวัตถุดิบ", tradeability: "craft-only" },
    { id: "wraith", name: "Seas Wraith", category: "ของวัตถุดิบ", tradeability: "tradable" },
  ];
  const context = vm.createContext({
    state: { products, recipes: [] },
    RECIPES: [],
    document: { addEventListener() {}, getElementById: id => id === "recipe-component-recipes-editor" ? componentEditor : null },
  });
  vm.runInContext(fs.readFileSync(require.resolve("../js/crafting.js"), "utf8"), context);

  context.renderRecipeComponentEditor(
    [{ ingredientName: "Fortune Tales", ingredients: [["Seas Wraith", 1]] }],
    [["Fortune Tales", 1]],
  );

  assert.match(componentEditor.innerHTML, /data-component-target/);
  assert.match(componentEditor.innerHTML, /Fortune Tales/);
  assert.match(componentEditor.innerHTML, /Seas Wraith/);
});
