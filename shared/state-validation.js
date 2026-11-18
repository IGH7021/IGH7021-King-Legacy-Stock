(function (root, factory) {
  const gamePass = typeof module === "object" && module.exports ? require("./game-pass") : root.GAME_PASS;
  const api = factory(gamePass);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ACCOUNT_STATE = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (gamePass) {
  function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function isValidComponentRecipes(value) {
    return value === undefined || (Array.isArray(value) && value.every(component =>
      isRecord(component)
      && typeof component.ingredientName === "string"
      && component.ingredientName.trim() !== ""
      && Array.isArray(component.ingredients)
      && component.ingredients.every(ingredient =>
        Array.isArray(ingredient) && ingredient.length === 2
        && typeof ingredient[0] === "string" && ingredient[0].trim() !== ""
        && Number.isFinite(ingredient[1]) && ingredient[1] > 0),
    ));
  }

  function validateAccountState(value) {
    if (!isRecord(value)) return { valid: false, error: "state must be an object" };
    if (!Array.isArray(value.products) || !value.products.every(isRecord)) {
      return { valid: false, error: "products must be an array of objects" };
    }
    if (value.products.some(product => product.category === "Game Pass"
      && product.gamePass !== undefined && !gamePass.isValid(product.gamePass))) {
      return { valid: false, error: "Game Pass products must have valid Gift and Trade variants" };
    }
    if (!Array.isArray(value.sales) || !value.sales.every(isRecord)) {
      return { valid: false, error: "sales must be an array of objects" };
    }
    if (!isRecord(value.settings)) return { valid: false, error: "settings must be an object" };
    if (value.settings.categories !== undefined
      && (!Array.isArray(value.settings.categories) || !value.settings.categories.every(item => typeof item === "string"))) {
      return { valid: false, error: "settings.categories must be an array of strings" };
    }
    const arrayFields = ["recipes", "farmServices", "farmOrders", "orders", "upgradeOrders", "cart", "activityLog"];
    for (const field of arrayFields) {
      if (value[field] !== undefined && (!Array.isArray(value[field]) || !value[field].every(isRecord))) {
        return { valid: false, error: `${field} must be an array of objects` };
      }
    }
    if (Array.isArray(value.recipes) && value.recipes.some(recipe =>
      !isValidComponentRecipes(recipe.componentRecipes)
      || (Array.isArray(recipe.alternatives) && recipe.alternatives.some(variant =>
        !isRecord(variant) || !isValidComponentRecipes(variant.componentRecipes))),
    )) {
      return { valid: false, error: "recipe component recipes must contain valid ingredient names and amounts" };
    }
    if (value.dailyChecklist !== undefined && !isRecord(value.dailyChecklist)) {
      return { valid: false, error: "dailyChecklist must be an object" };
    }
    if (value.schemaVersion !== undefined
      && (!Number.isSafeInteger(value.schemaVersion) || value.schemaVersion < 1)) {
      return { valid: false, error: "schemaVersion must be a positive integer" };
    }
    return { valid: true, error: null };
  }

  function quarantineLocalState(storage, key, raw, suffix) {
    const recoveryKey = `${key}__recovery_${suffix}`;
    storage.setItem(recoveryKey, raw);
    storage.removeItem(key);
    return recoveryKey;
  }

  return { validateAccountState, quarantineLocalState };
});
