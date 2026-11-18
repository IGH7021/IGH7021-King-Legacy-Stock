let selectedRecipeName = null;
let selectedRecipeVariantIndex = 0;
let editingRecipeName = null;
let editingRecipeVariants = [];

function getRecipes() {
  return Array.isArray(state?.recipes) ? state.recipes : RECIPES;
}

function recipeAssetKey(name) {
  return name.trim().replace(/\s+/g, "_");
}

function recipeOutputImage(recipe) {
  return `assets/products/icons/${recipeAssetKey(recipe.name)}.png`;
}

function recipeImage(recipe) {
  return `assets/products/recipes/${recipeAssetKey(recipe.name)}_recipe.png`;
}

function ingredientProduct(name) {
  return state.products.find(product => product.name.toLowerCase() === String(name || "").toLowerCase());
}

function ingredientImage(name) {
  return ingredientProduct(name)?.image || "";
}

function recipeProduct(recipe) {
  return state.products.find(product => product.name.toLowerCase() === recipe.name.toLowerCase());
}

function recipeVariant(recipe, index = 0) {
  if (!recipe) return null;
  const variant = Number(index) === 0 ? recipe : recipe.alternatives?.[Number(index) - 1];
  return variant ? {
    ...recipe,
    ingredients: variant.ingredients,
    componentRecipes: Array.isArray(variant.componentRecipes) ? variant.componentRecipes : [],
  } : null;
}

function recipeReference(name, index = 0) {
  return Number(index) === 0 ? name : `${name}::recipe:${Number(index)}`;
}

function recipeFromReference(reference) {
  const match = String(reference).match(/^(.*)::recipe:(\d+)$/);
  const recipe = getRecipes().find(item => item.name === (match ? match[1] : reference));
  const variantIndex = match ? Number(match[2]) : 0;
  return { recipe: recipeVariant(recipe, variantIndex), variantIndex };
}

function recipeStock(name) {
  const product = state.products.find(item => item.name.toLowerCase() === name.toLowerCase());
  return product ? remaining(product) : 0;
}

function craftingEscape(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[char]));
}

function recipeMaterialRequirements(recipe, quantity = 1) {
  const amounts = new Map();
  const ingredients = expandRecipeIngredients(recipe, recipe.ingredients, new Set([String(recipe.name).toLowerCase()]));
  ingredients.forEach(([name, required]) => {
    const product = ingredientProduct(name);
    const key = product ? `product:${product.id}` : `name:${String(name).toLowerCase()}`;
    const material = amounts.get(key) || { name: product?.name || name, required: 0 };
    material.required += Number(required) * quantity;
    amounts.set(key, material);
  });
  return [...amounts.values()].map(({ name, required }) => ({ name, required, available: recipeStock(name) }));
}

function expandRecipeIngredients(recipe, ingredients, seen = new Set()) {
  return ingredients.flatMap(([name, amount]) => {
    const product = ingredientProduct(name);
    const normalizedName = String(name).toLowerCase();
    const componentRecipe = (Array.isArray(recipe.componentRecipes) ? recipe.componentRecipes : []).find(entry =>
      entry && typeof entry === "object"
      && String(entry.ingredientName || "").toLowerCase() === normalizedName
      && Array.isArray(entry.ingredients) && entry.ingredients.length,
    );
    const storedRecipe = getRecipes().find(entry => entry.name.toLowerCase() === normalizedName);
    const nestedRecipe = componentRecipe
      ? { name, ingredients: componentRecipe.ingredients, componentRecipes: componentRecipe.componentRecipes || [] }
      : storedRecipe;
    if (!product || product.tradeability !== "craft-only" || !nestedRecipe || seen.has(normalizedName)) {
      return [[name, amount]];
    }
    const nextSeen = new Set(seen);
    nextSeen.add(normalizedName);
    return expandRecipeIngredients(nestedRecipe, nestedRecipe.ingredients, nextSeen)
      .map(([nestedName, nestedAmount]) => [nestedName, Number(nestedAmount) * Number(amount)]);
  });
}

function expandCraftOnlyIngredients(ingredients, seen = new Set()) {
  return expandRecipeIngredients({ name: "", ingredients }, ingredients, seen);
}

function hasExpandableCraftOnlyIngredients(ingredients) {
  return ingredients.some(([name]) => {
    const product = ingredientProduct(name);
    return product?.tradeability === "craft-only"
      && getRecipes().some(recipe => recipe.name.toLowerCase() === String(name).toLowerCase());
  });
}

function craftingQuantityPreview(recipe, inputValue, craftable) {
  const rawValue = String(inputValue ?? "").trim();
  const numericInput = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(rawValue);
  const requestedQuantity = numericInput ? Number(rawValue) : 0;
  const isFiniteQuantity = Number.isFinite(requestedQuantity);
  const isWholeQuantity = isFiniteQuantity && Number.isSafeInteger(requestedQuantity);
  const quantity = isWholeQuantity && requestedQuantity > 0 ? requestedQuantity : 0;
  return {
    requestedQuantity: isFiniteQuantity ? requestedQuantity : 0,
    quantity,
    valid: isWholeQuantity && quantity >= 1 && quantity <= craftable,
    requirements: recipeMaterialRequirements(recipe, quantity),
    materialCost: recipePrice(recipe) * quantity,
    saleTotal: recipeSalePrice(recipe) * quantity,
  };
}

function productUnitPrice(product) {
  return product && Number(product.unitsPerBaht) > 0 ? 1 / Number(product.unitsPerBaht) : 0;
}

function ingredientUnitPrice(name) {
  return productUnitPrice(ingredientProduct(name));
}

function recipePrice(recipe) {
  return recipeMaterialRequirements(recipe).reduce((total, material) => total + material.required * ingredientUnitPrice(material.name), 0);
}

function recipeSalePrice(recipe) {
  if (Number(recipe.salePrice) > 0) return Number(recipe.salePrice);
  const output = recipeProduct(recipe);
  return output ? productUnitPrice(output) : recipePrice(recipe);
}

function saveRecipeSalePrice(recipe) {
  const input = document.getElementById("craft-sale-price-input");
  const salePrice = Number(input?.value);
  if (!Number.isFinite(salePrice) || salePrice <= 0) { toast("กรุณากรอกราคาขายให้ถูกต้อง", "error"); return; }
  recipe.salePrice = Math.round(salePrice * 100) / 100;
  const output = recipeProduct(recipe);
  if (output) output.unitsPerBaht = 1 / recipe.salePrice;
  state.recipes = getRecipes();
  saveState();
  renderCrafting();
  renderProducts();
  renderDashboard();
  renderCraftingModal();
  toast("บันทึกราคาขายแล้ว");
}

function recipeCraftable(recipe) {
  const requirements = recipeMaterialRequirements(recipe);
  return requirements.length ? Math.min(...requirements.map(item => Math.floor(item.available / item.required))) : 0;
}

function recipeCategory(recipe) {
  return recipe.category || recipeProduct(recipe)?.category || "อื่นๆ";
}

function recipeCard(recipe) {
  const variants = [recipe, ...(recipe.alternatives || []).map((_, index) => recipeVariant(recipe, index + 1))];
  const craftable = Math.max(0, ...variants.map(recipeCraftable));
  const output = recipeProduct(recipe);
  const category = recipeCategory(recipe);
  const price = recipePrice(recipe);
  return `<div class="recipe-card glass-card rounded-2xl overflow-hidden text-left ${craftable ? "recipe-ready" : "recipe-locked"}" data-recipe="${craftingEscape(recipe.name)}">
    <button type="button" class="recipe-card-open w-full text-left"><div class="recipe-card-image relative h-36 bg-slate-800/60"><img src="${craftingEscape(recipeOutputImage(recipe))}" loading="lazy" decoding="async" class="w-full h-full object-contain p-3" alt="${craftingEscape(recipe.name)}"><span class="absolute top-2 right-2 text-[11px] px-2 py-0.5 rounded-full border ${craftable ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" : "bg-slate-900/75 text-slate-400 border-slate-600/50"}">${craftable ? `คราฟได้ ${fmtNum(craftable)}` : "วัตถุดิบไม่ครบ"}</span></div>
    <div class="p-3"><div class="flex items-center justify-between gap-2"><strong class="text-sm truncate">${craftingEscape(recipe.name)}</strong><div class="flex items-center gap-1"><span class="text-[10px] px-2 py-0.5 rounded-full border border-slate-600/50 text-slate-400">${craftingEscape(category)}</span><span class="text-[10px] px-2 py-0.5 rounded-full border ${rarityBadgeClass(recipe.rarity)}">${rarityLabel(recipe.rarity)}</span></div></div><p class="text-xs text-slate-400 mt-1">${output ? `มีในคลัง ${fmtNum(remaining(output))} ชิ้น` : "ยังไม่มีในคลังสินค้า"}${variants.length > 1 ? ` • ${variants.length} สูตร` : ""}</p><p class="text-xs text-orange-300 mt-1">ต้นทุนวัตถุดิบ ${fmtBaht(price)} • ราคาขาย ${fmtBaht(recipeSalePrice(recipe))}</p></div></button>
    <div class="px-3 pb-3 flex gap-2"><button type="button" data-recipe-action="cart" class="rounded-lg bg-emerald-500/15 px-2.5 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/25" aria-label="เพิ่ม ${craftingEscape(recipe.name)} ลงตะกร้า" title="เพิ่มลงตะกร้า">🛒+</button><button type="button" data-recipe-action="edit" class="flex-1 text-xs py-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700">✏️ แก้ไขสูตร</button><button type="button" data-recipe-action="delete" class="recipe-delete-btn" aria-label="ลบสูตร" title="ลบสูตร">🗑️</button></div>
  </div>`;
}

function renderCrafting() {
  const grid = document.getElementById("crafting-grid");
  if (!grid) return;
  const recipes = [...getRecipes()].filter(recipe => recipeProduct(recipe)).sort((first, second) => {
    const firstCategory = categorySortIndex(recipeCategory(first));
    const secondCategory = categorySortIndex(recipeCategory(second));
    if (firstCategory !== secondCategory) return firstCategory - secondCategory;
    const firstRarity = RARITY_ORDER.indexOf(first.rarity);
    const secondRarity = RARITY_ORDER.indexOf(second.rarity);
    if (firstRarity !== secondRarity) return firstRarity - secondRarity;
    const craftableDifference = recipeCraftable(second) - recipeCraftable(first);
    if (craftableDifference !== 0) return craftableDifference;
    return first.name.localeCompare(second.name);
  });
  const ready = recipes.filter(recipe => recipeCraftable(recipe) > 0).length;
  const count = document.getElementById("crafting-ready-count");
  if (count) count.textContent = `พร้อมคราฟ ${ready}/${recipes.length} สูตร`;
  grid.innerHTML = recipes.map(recipeCard).join("");
}

function openCraftingModal(recipeName) {
  selectedRecipeName = recipeName;
  selectedRecipeVariantIndex = 0;
  renderCraftingModal();
  openModal("crafting-modal");
}

function renderCraftingModal() {
  const rootRecipe = getRecipes().find(item => item.name === selectedRecipeName);
  const recipe = recipeVariant(rootRecipe, selectedRecipeVariantIndex);
  const container = document.getElementById("crafting-modal-content");
  if (!recipe || !container) return;
  const craftable = recipeCraftable(recipe);
  const price = recipePrice(recipe);
  const salePrice = recipeSalePrice(recipe);
  const ingredientRows = recipeMaterialRequirements(recipe).map(({ name, required, available }) => {
    const enough = available >= required;
    const product = ingredientProduct(name);
    const image = product?.image;
    return `<div class="craft-ingredient ${enough ? "craft-ingredient-ok" : "craft-ingredient-missing"}" data-craft-material="${craftingEscape(name)}"><div class="craft-ingredient-image">${image ? `<img src="${craftingEscape(image)}" alt="${craftingEscape(name)}">` : "🪵"}</div><div class="min-w-0 flex-1"><p class="text-xs font-semibold truncate">${craftingEscape(name)}</p><p class="text-[11px] craft-material-count ${enough ? "text-emerald-300" : "text-rose-300"}" data-per-item="${required}" data-available="${available}">${t("craft_material_count", { required: fmtNum(required), available: fmtNum(available) })}</p></div><span class="craft-check">${enough ? "✓" : "!"}</span></div>`;
  }).join("");
  const variants = [rootRecipe, ...(rootRecipe.alternatives || []).map((_, index) => recipeVariant(rootRecipe, index + 1))];
  const variantPicker = variants.length > 1 ? `<label class="block text-xs text-slate-400 mb-3">สูตรที่ใช้<select id="crafting-variant-select" class="w-full mt-1 rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-sm">${variants.map((_, index) => `<option value="${index}" ${index === selectedRecipeVariantIndex ? "selected" : ""}>สูตร ${index + 1}</option>`).join("")}</select></label>` : "";
  container.innerHTML = `<div class="crafting-header"><div class="crafting-output-image"><img src="${craftingEscape(recipeOutputImage(recipe))}" alt="${craftingEscape(recipe.name)}"></div><div class="min-w-0"><p class="text-xs text-orange-300 mb-1">สูตรคราฟ</p><h2 class="font-bold text-xl truncate">${craftingEscape(recipe.name)}</h2><p class="text-xs text-slate-400 mt-1">ต้นทุนจากวัตถุดิบ • ราคาขายอิงเรทสินค้า</p></div><button type="button" id="edit-crafting-btn" class="ml-auto flex-shrink-0 px-3 py-2 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-xs">✏️ แก้ไข</button></div>${variantPicker}<div class="crafting-recipe-preview"><img src="${craftingEscape(recipeImage(recipe))}" alt="สูตร ${craftingEscape(recipe.name)}"></div><div class="crafting-summary"><div><span>คราฟได้สูงสุด</span><strong class="${craftable ? "text-emerald-300" : "text-rose-300"}">${fmtNum(craftable)} ชิ้น</strong></div><div><span>ต้นทุนต่อชิ้น</span><strong class="text-orange-300">${fmtBaht(price)}</strong></div><div><span>ราคาขายต่อชิ้น</span><strong class="text-cyan-300">${fmtBaht(salePrice)}</strong></div></div><div class="flex items-end gap-2 mt-5"><label class="flex-1 text-xs text-slate-400">ราคาขายต่อชิ้น<input id="craft-sale-price-input" type="number" min="0.01" step="0.01" value="${salePrice.toFixed(2)}" class="w-full mt-1 rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-sm text-slate-100"></label><button type="button" id="save-craft-price-btn" class="px-3 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-sm">บันทึกราคา</button></div><div class="craft-quantity-row mt-5 mb-2"><h3 class="font-semibold text-sm">จำนวนที่คราฟ</h3><input id="craft-quantity-input" type="number" min="1" max="${Math.max(1, craftable)}" step="1" value="${craftable ? 1 : 0}" class="craft-quantity-input w-24 rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-sm" ${craftable < 1 ? "disabled" : ""}><span class="text-xs text-slate-400">วัตถุดิบจะถูกหักตามจำนวนนี้</span></div><p id="craft-quantity-feedback" class="min-h-4 text-xs text-rose-300" aria-live="polite"></p><div id="craft-cost-preview" class="rounded-xl border border-orange-400/20 bg-orange-400/5 px-3 py-2 text-sm" aria-live="polite"></div><div class="flex items-center justify-between mt-5 mb-2"><h3 class="font-semibold text-sm">วัตถุดิบที่ต้องใช้</h3><span class="text-xs text-slate-400">จำนวนรวมสำหรับงานนี้</span></div><div class="craft-ingredients-grid">${ingredientRows}</div><div class="flex gap-2 mt-5"><button type="button" data-close-modal class="flex-1 py-2.5 rounded-xl bg-slate-700/50 hover:bg-slate-700 text-sm">ยกเลิก</button><button type="button" id="confirm-craft-btn" class="flex-1 btn-primary py-2.5 rounded-xl text-sm" ${craftable < 1 ? "disabled" : ""}>คราฟ 1 ชิ้น</button></div>`;
  document.getElementById("crafting-variant-select")?.addEventListener("change", event => {
    selectedRecipeVariantIndex = Number(event.target.value) || 0;
    renderCraftingModal();
  });
  document.getElementById("edit-crafting-btn")?.addEventListener("click", () => { closeModal("crafting-modal"); openRecipeEditor(recipe.name); });
  document.getElementById("save-craft-price-btn")?.addEventListener("click", () => saveRecipeSalePrice(recipe));
  const craftQuantityInput = document.getElementById("craft-quantity-input");
  const updatePreview = () => {
    const preview = craftingQuantityPreview(recipe, craftQuantityInput.value, craftable);
    document.getElementById("confirm-craft-btn").textContent = preview.requestedQuantity > 0
      ? t("craft_confirm_quantity", { quantity: fmtNum(preview.requestedQuantity) })
      : t("craft_confirm");
    document.getElementById("confirm-craft-btn").disabled = !preview.valid;
    document.getElementById("craft-quantity-feedback").textContent = preview.valid || !craftable
      ? ""
      : t("craft_quantity_invalid", { max: fmtNum(craftable) });
    document.getElementById("craft-cost-preview").textContent = `${t("craft_material_cost_total", { cost: fmtBaht(preview.materialCost) })} • ${t("craft_sale_total", { price: fmtBaht(preview.saleTotal) })}`;
    container.querySelectorAll(".craft-material-count").forEach((count, index) => {
      const required = preview.requirements[index]?.required || 0;
      const available = Number(count.dataset.available);
      count.textContent = required > available
        ? t("craft_material_count_short", { required: fmtNum(required), available: fmtNum(available), shortage: fmtNum(required - available) })
        : t("craft_material_count", { required: fmtNum(required), available: fmtNum(available) });
      count.classList.toggle("text-emerald-300", required <= available);
      count.classList.toggle("text-rose-300", required > available);
      const card = count.closest(".craft-ingredient");
      card?.classList.toggle("craft-ingredient-ok", required <= available);
      card?.classList.toggle("craft-ingredient-missing", required > available);
      const icon = card?.querySelector(".craft-check");
      if (icon) icon.textContent = required <= available ? "✓" : "!";
    });
  };
  craftQuantityInput?.addEventListener("input", updatePreview);
  updatePreview();
  const addToCartButton = document.createElement("button");
  addToCartButton.type = "button";
  addToCartButton.className = "flex-1 py-2.5 rounded-xl bg-emerald-600/80 hover:bg-emerald-500 text-sm";
  addToCartButton.textContent = "เพิ่มลงตะกร้า";
  addToCartButton.addEventListener("click", () => {
    const preview = craftingQuantityPreview(recipe, craftQuantityInput?.value, craftable);
    if (!preview.valid) { toast("วัตถุดิบไม่เพียงพอ", "error"); return; }
    addToCart("craft", recipeReference(recipe.name, selectedRecipeVariantIndex), preview.quantity);
  });
  document.getElementById("confirm-craft-btn")?.parentElement?.insertBefore(addToCartButton, document.getElementById("confirm-craft-btn"));
  document.getElementById("confirm-craft-btn")?.addEventListener("click", () => craftRecipe(recipe, Number(craftQuantityInput?.value) || 1));
}

function craftRecipe(recipe, quantity = 1) {
  const craftable = recipeCraftable(recipe);
  quantity = Number(quantity);
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > craftable) { toast("วัตถุดิบไม่เพียงพอ", "error"); return; }
  const requirements = recipeMaterialRequirements(recipe, quantity);
  if (requirements.some(item => item.required > item.available || !ingredientProduct(item.name))) {
    toast("วัตถุดิบไม่เพียงพอ", "error");
    renderCraftingModal();
    return;
  }
  const salePrice = recipeSalePrice(recipe);
  const craftedAt = Date.now();
  const deductedIngredients = requirements.map(({ name, required }) => `${name} -${fmtNum(required)}`).join(", ");
  requirements.forEach(({ name, required }) => {
    const product = ingredientProduct(name);
    product.stock -= required;
  });
  const output = recipeProduct(recipe);
  if (output) {
    if (salePrice > 0) output.unitsPerBaht = 1 / salePrice;
    output.sold = (output.sold || 0) + quantity;
    output.crafted = (output.crafted || 0) + quantity;
  } else {
    state.products.unshift({ id: genId("p"), name: recipe.name, category: "ของวัตถุดิบ", source: "custom", tradeability: "craft-only", image: recipeOutputImage(recipe), rarity: recipe.rarity, stock: 0, sold: quantity, crafted: quantity, unitsPerBaht: salePrice ? 1 / salePrice : 1, description: "สินค้าที่คราฟและขายจากสูตร", createdAt: craftedAt, restockHistory: [] });
  }
  const outputProduct = recipeProduct(recipe) || state.products[0];
  state.sales.unshift({
    id: genId("s"), productId: outputProduct.id, productName: recipe.name,
    quantity, money: Math.round(salePrice * quantity * 100) / 100,
    rate: outputProduct.unitsPerBaht, date: craftedAt,
    note: `คราฟ ${fmtNum(quantity)} ชุด • หักวัตถุดิบ: ${deductedIngredients}`,
    source: "craft",
  });
  if (!Array.isArray(state.activityLog)) state.activityLog = [];
  state.activityLog.unshift({ id: genId("activity"), type: "craft", action: "คราฟและขายสินค้า", text: `คราฟและขาย: ${recipe.name}`, sub: `${fmtNum(quantity)} ชุด • ${fmtBaht(salePrice * quantity)} • หัก: ${deductedIngredients}`, ts: craftedAt });
  state.activityLog = state.activityLog.slice(0, 100);
  saveState();
  renderCrafting();
  renderProducts();
  renderSalesHistory();
  renderDashboard();
  renderReports();
  closeModal("crafting-modal");
  toast(`คราฟและขาย ${recipe.name} สำเร็จ`);
}

function openRecipeEditor(recipeName = null) {
  editingRecipeName = recipeName;
  selectedRecipeVariantIndex = 0;
  const form = document.getElementById("crafting-editor-form");
  const recipe = recipeName ? getRecipes().find(item => item.name === recipeName) : null;
  form.reset();
  const outputNames = [...new Set(state.products.map(product => product.name))].sort((a, b) => a.localeCompare(b));
  form.name.innerHTML = `<option value="">เลือกไอเทมผลลัพธ์</option>` + outputNames.map(name => `<option value="${craftingEscape(name)}">${craftingEscape(name)}</option>`).join("");
  form.rarity.innerHTML = RARITY_ORDER.map(rarity => `<option value="${rarity}">${rarityLabel(rarity)}</option>`).join("");
  const recipeCategories = [...new Set([...(state.settings.categories || CATEGORY_ORDER), "อื่นๆ", recipe?.category].filter(Boolean))];
  form.category.innerHTML = recipeCategories.map(category => `<option value="${craftingEscape(category)}">${craftingEscape(category)}</option>`).join("");
  form.rarity.value = recipe?.rarity || "none";
  form.category.value = recipe?.category || recipeProduct(recipe || {})?.category || "ของวัตถุดิบ";
  document.getElementById("crafting-editor-title").textContent = recipe ? "แก้ไขสูตรคราฟ" : "เพิ่มสูตรคราฟ";
  editingRecipeVariants = recipe
    ? [{
      ingredients: recipe.ingredients.map(item => [...item]),
      componentRecipes: (Array.isArray(recipe.componentRecipes) ? recipe.componentRecipes : []).filter(Boolean).map(component => ({
        ingredientName: component.ingredientName,
        ingredients: (Array.isArray(component.ingredients) ? component.ingredients : []).map(item => [...item]),
      })),
    }, ...(recipe.alternatives || []).map(variant => ({
      ingredients: (variant.ingredients || []).map(item => [...item]),
      componentRecipes: (Array.isArray(variant.componentRecipes) ? variant.componentRecipes : []).filter(Boolean).map(component => ({
        ingredientName: component.ingredientName,
        ingredients: (Array.isArray(component.ingredients) ? component.ingredients : []).map(item => [...item]),
      })),
    }))]
    : [{ ingredients: [["", 1]], componentRecipes: [] }];
  renderRecipeVariantEditor();
  if (recipe) {
    form.name.value = recipe.name;
  }
  updateRecipeImagePreview(form.name.value);
  openModal("crafting-editor-modal");
}

function saveRecipeEditorVariant() {
  if (!editingRecipeVariants[selectedRecipeVariantIndex]) return;
  editingRecipeVariants[selectedRecipeVariantIndex].ingredients = collectRecipeIngredients();
  editingRecipeVariants[selectedRecipeVariantIndex].componentRecipes = Array.from(
    document.querySelectorAll("[data-component-recipe]"),
    component => ({
      ingredientName: component.querySelector("[data-component-target]").value,
      ingredients: Array.from(component.querySelectorAll("[data-component-material-row]"), row => [
        row.querySelector("[data-component-material]").value,
        Number(row.querySelector("[data-component-amount]").value),
      ]),
    }),
  );
}

function recipeCraftOnlyIngredientNames(ingredients) {
  return [...new Set(ingredients.map(([name]) => String(name || "")).filter(name =>
    ingredientProduct(name)?.tradeability === "craft-only",
  ))];
}

function renderRecipeComponentEditor(componentRecipes, ingredients) {
  const container = document.getElementById("recipe-component-recipes-editor");
  if (!container) return;
  const materials = state.products.filter(product => product.category === "ของวัตถุดิบ")
    .sort((a, b) => a.name.localeCompare(b.name));
  const eligible = recipeCraftOnlyIngredientNames(ingredients);
  const materialOptions = selectedName => `<option value="">เลือกวัตถุดิบ</option>${materials.map(product =>
    `<option value="${craftingEscape(product.name)}" ${product.name === selectedName ? "selected" : ""}>${craftingEscape(product.name)}</option>`,
  ).join("")}`;
  container.innerHTML = (Array.isArray(componentRecipes) ? componentRecipes : []).map(component => {
    const targets = [...new Set([...eligible, component.ingredientName].filter(Boolean))];
    const targetOptions = targets.map(name =>
      `<option value="${craftingEscape(name)}" ${name === component.ingredientName ? "selected" : ""}>${craftingEscape(name)}</option>`,
    ).join("");
    const rows = component.ingredients.map(([name, amount]) => `<div data-component-material-row class="upgrade-material-row">
      <select data-component-material aria-label="วัตถุดิบในสูตรย่อย" class="min-w-0 flex-1 rounded-lg bg-slate-900/70 border border-slate-700 px-2 py-2 text-xs">${materialOptions(name)}</select>
      <input data-component-amount type="number" min="0.0001" step="any" value="${craftingEscape(amount)}" aria-label="จำนวนวัตถุดิบ" class="w-24 rounded-lg bg-slate-900/70 border border-slate-700 px-2 py-2 text-xs">
      <button type="button" data-remove-component-material class="ingredient-remove-btn" aria-label="ลบวัตถุดิบ">×</button>
    </div>`).join("");
    return `<section class="recipe-component-editor" data-component-recipe>
      <div class="flex items-center justify-between gap-2"><strong class="text-xs">สูตรของวัตถุดิบคราฟ</strong><button type="button" data-remove-component-recipe class="text-xs text-rose-300">ลบสูตร</button></div>
      <label class="block text-xs text-slate-400 mt-2">ใช้สูตรสำหรับ<select data-component-target aria-label="สูตรวัตถุดิบคราฟของไอเทม" class="w-full mt-1 rounded-lg bg-slate-900/70 border border-slate-700 px-2 py-2 text-xs">${targetOptions}</select></label>
      <div class="flex flex-col gap-2 mt-2">${rows}</div>
      <button type="button" data-add-component-material class="mt-2 text-xs text-indigo-200">+ เพิ่มวัตถุดิบ</button>
    </section>`;
  }).join("");
}

function syncRecipeVariantControls() {
  const selector = document.getElementById("recipe-variant-select");
  const addButton = document.getElementById("add-recipe-variant-btn");
  const removeButton = document.getElementById("remove-recipe-variant-btn");
  const addComponentButton = document.getElementById("add-component-recipe-btn");
  if (!selector || !addButton || !removeButton || !addComponentButton) return;
  const ingredients = collectRecipeIngredients();
  const existingComponents = new Set((editingRecipeVariants[selectedRecipeVariantIndex]?.componentRecipes || [])
    .map(component => String(component.ingredientName || "").toLowerCase()));
  const canAddComponent = recipeCraftOnlyIngredientNames(ingredients)
    .some(name => !existingComponents.has(name.toLowerCase()));
  selector.innerHTML = editingRecipeVariants.map((_, index) => `<option value="${index}">สูตร ${index + 1}</option>`).join("");
  selector.value = String(selectedRecipeVariantIndex);
  selector.closest("label")?.classList.toggle("hidden", editingRecipeVariants.length < 2);
  addButton.classList.remove("hidden");
  removeButton.classList.toggle("hidden", selectedRecipeVariantIndex === 0);
  addComponentButton.classList.toggle("hidden", !canAddComponent);
}

function renderRecipeVariantEditor() {
  selectedRecipeVariantIndex = Math.min(selectedRecipeVariantIndex, editingRecipeVariants.length - 1);
  const variant = editingRecipeVariants[selectedRecipeVariantIndex] || { ingredients: [["", 1]], componentRecipes: [] };
  renderRecipeIngredientEditor(variant.ingredients);
  renderRecipeComponentEditor(variant.componentRecipes || [], variant.ingredients);
  syncRecipeVariantControls();
}

function updateRecipeImagePreview(name) {
  const key = recipeAssetKey(name || "Abyss Stone");
  const preview = document.getElementById("recipe-image-preview");
  if (!preview) return;
  preview.querySelector("[data-preview-product]").src = `assets/products/icons/${key}.png`;
  preview.querySelector("[data-preview-recipe]").src = `assets/products/recipes/${key}_recipe.png`;
}

function renderRecipeIngredientEditor(ingredients) {
  const container = document.getElementById("recipe-ingredients-editor");
  if (!container) return;
  const products = state.products.filter(product => product.category === "ของวัตถุดิบ").sort((a, b) => a.name.localeCompare(b.name));
  container.innerHTML = ingredients.map(([name, amount]) => {
    const selected = products.find(product => product.name.toLowerCase() === String(name || "").toLowerCase());
    const selectedName = selected?.name || "";
    const options = products.map(product => `<button type="button" class="ingredient-option ${product.name === selectedName ? "is-selected" : ""}" data-ingredient-value="${craftingEscape(product.name)}" role="option">${product.image ? `<img src="${craftingEscape(product.image)}" alt="">` : "🪵"}<span>${craftingEscape(product.name)}</span></button>`).join("");
    return `<div class="recipe-ingredient-editor-row"><div class="ingredient-row-icon">${ingredientImage(selectedName) ? `<img src="${craftingEscape(ingredientImage(selectedName))}" alt="${craftingEscape(selectedName)}">` : "🪵"}</div><div class="ingredient-row-fields"><label>วัตถุดิบ<div class="ingredient-picker" data-ingredient-picker><input type="text" class="ingredient-search-input" data-ingredient-search value="${craftingEscape(selectedName)}" placeholder="พิมพ์เพื่อค้นหาวัตถุดิบ..." autocomplete="off" aria-label="ค้นหาวัตถุดิบ"><input type="hidden" name="ingredientProduct" value="${craftingEscape(selectedName)}"><div class="ingredient-picker-menu" data-ingredient-menu role="listbox">${options}</div></div></label><label class="ingredient-amount-field">จำนวน<input name="ingredientAmount" type="number" min="0.0001" step="any" value="${craftingEscape(amount || 1)}"></label></div><button type="button" data-remove-ingredient class="ingredient-remove-btn" aria-label="ลบวัตถุดิบ">✕</button></div>`;
  }).join("");
}

function collectRecipeIngredients() {
  return Array.from(document.querySelectorAll(".recipe-ingredient-editor-row")).map(row => [row.querySelector("input[name=ingredientProduct]").value, Number(row.querySelector("input[name=ingredientAmount]").value)]).filter(([name, amount]) => name && Number.isFinite(amount) && amount > 0);
}

function handleRecipeEditorSubmit(event) {
  event.preventDefault();
  const form = event.target;
  saveRecipeEditorVariant();
  const invalidComponentRecipe = editingRecipeVariants.some(variant => {
    const targets = new Set();
    return (variant.componentRecipes || []).some(component => {
      if (!component) return true;
      const targetName = String(component.ingredientName || "").toLowerCase();
      const duplicateTarget = targets.has(targetName);
      targets.add(targetName);
      const targetIsIngredient = variant.ingredients.some(([name]) => String(name).toLowerCase() === targetName);
      return !targetName
        || duplicateTarget
        || !targetIsIngredient
        || ingredientProduct(component.ingredientName)?.tradeability !== "craft-only"
        || !component.ingredients.length
        || component.ingredients.some(([name, amount]) => !name || !Number.isFinite(amount) || amount <= 0);
    });
  });
  if (!form.name.value.trim() || editingRecipeVariants.some(variant => !variant.ingredients.length) || invalidComponentRecipe) {
    toast("กรุณากรอกข้อมูลสูตรและวัตถุดิบให้ครบ", "error");
    return;
  }
  const recipes = getRecipes();
  const existingRecipe = editingRecipeName ? recipes.find(recipe => recipe.name === editingRecipeName) : null;
  const recipeVariants = editingRecipeVariants.map(variant => ({
    ingredients: variant.ingredients.map(item => [...item]),
    componentRecipes: (variant.componentRecipes || []).map(component => ({
      ingredientName: component.ingredientName,
      ingredients: component.ingredients.map(item => [...item]),
    })),
  }));
  const payload = {
    name: form.name.value.trim(), category: form.category.value, rarity: form.rarity.value,
    ingredients: recipeVariants[0].ingredients,
    ...(recipeVariants[0].componentRecipes.length ? { componentRecipes: recipeVariants[0].componentRecipes } : {}),
    ...(recipeVariants.length > 1 ? { alternatives: recipeVariants.slice(1).map(variant => ({
      ingredients: variant.ingredients,
      ...(variant.componentRecipes.length ? { componentRecipes: variant.componentRecipes } : {}),
    })) } : {}),
    ...(existingRecipe?.salePrice ? { salePrice: existingRecipe.salePrice } : {}),
  };
  if (editingRecipeName) {
    const index = recipes.findIndex(recipe => recipe.name === editingRecipeName);
    if (index >= 0) recipes[index] = payload;
  } else {
    if (recipes.some(recipe => recipe.name.toLowerCase() === payload.name.toLowerCase())) { toast("มีสูตรชื่อนี้แล้ว", "error"); return; }
    recipes.unshift(payload);
  }
  state.recipes = recipes;
  addRecipeActivity(editingRecipeName ? "แก้ไขสูตรคราฟ" : "เพิ่มสูตรคราฟ", payload.name, `${payload.ingredients.length} วัตถุดิบหลัก • ${recipeVariants.reduce((count, variant) => count + variant.componentRecipes.length, 0)} สูตรวัตถุดิบคราฟ`);
  saveState();
  renderCrafting();
  renderProducts();
  closeModal("crafting-editor-modal");
  toast(editingRecipeName ? "แก้ไขสูตรแล้ว" : "เพิ่มสูตรแล้ว");
}

function deleteRecipe(recipeName) {
  const recipe = getRecipes().find(item => item.name === recipeName);
  if (!recipe) return;
  confirmDialog(`ต้องการลบสูตร ${recipe.name} ใช่หรือไม่? สินค้าและสต็อกจะไม่ถูกลบ`, () => {
    state.recipes = getRecipes().filter(item => item.name !== recipeName);
    addRecipeActivity("ลบสูตรคราฟ", recipe.name);
    saveState();
    renderCrafting();
    toast(`ลบสูตร ${recipe.name} แล้ว`);
  });
}

function addRecipeActivity(action, recipeName, sub = "") {
  if (!Array.isArray(state.activityLog)) state.activityLog = [];
  const timestamp = Date.now();
  state.activityLog.unshift({
    id: genId("activity"),
    type: "recipe",
    action,
    text: `${action}: ${recipeName}`,
    sub,
    ts: timestamp,
  });
  state.activityLog = state.activityLog.slice(0, 100);
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("crafting-grid")?.addEventListener("click", event => {
    const card = event.target.closest("[data-recipe]");
    if (!card) return;
    if (event.target.closest("[data-recipe-action=cart]")) addToCart("craft", card.dataset.recipe);
    else if (event.target.closest("[data-recipe-action=edit]")) openRecipeEditor(card.dataset.recipe);
    else if (event.target.closest("[data-recipe-action=delete]")) deleteRecipe(card.dataset.recipe);
    else if (event.target.closest(".recipe-card-open")) openCraftingModal(card.dataset.recipe);
  });
  document.getElementById("add-recipe-menu-btn")?.addEventListener("click", () => { document.getElementById("add-entry-menu").classList.add("hidden"); document.getElementById("add-entry-btn")?.setAttribute("aria-expanded", "false"); openRecipeEditor(); });
  document.getElementById("crafting-editor-form")?.addEventListener("submit", handleRecipeEditorSubmit);
  document.getElementById("crafting-editor-form")?.elements.name.addEventListener("change", event => updateRecipeImagePreview(event.target.value));
  document.getElementById("recipe-variant-select")?.addEventListener("change", event => {
    saveRecipeEditorVariant();
    selectedRecipeVariantIndex = Number(event.target.value) || 0;
    renderRecipeVariantEditor();
  });
  document.getElementById("add-recipe-variant-btn")?.addEventListener("click", () => {
    saveRecipeEditorVariant();
    editingRecipeVariants.push({ ingredients: [["", 1]], componentRecipes: [] });
    selectedRecipeVariantIndex = editingRecipeVariants.length - 1;
    renderRecipeVariantEditor();
  });
  document.getElementById("add-component-recipe-btn")?.addEventListener("click", () => {
    saveRecipeEditorVariant();
    const variant = editingRecipeVariants[selectedRecipeVariantIndex];
    const existing = new Set((variant.componentRecipes || []).map(component => String(component.ingredientName).toLowerCase()));
    const target = recipeCraftOnlyIngredientNames(variant.ingredients).find(name => !existing.has(name.toLowerCase()));
    if (!target) { toast("เพิ่มวัตถุดิบคราฟที่แลกเปลี่ยนไม่ได้ในสูตรหลักก่อน", "error"); return; }
    const nestedRecipe = getRecipes().find(item => item.name.toLowerCase() === target.toLowerCase());
    variant.componentRecipes ||= [];
    variant.componentRecipes.push({
      ingredientName: target,
      ingredients: (nestedRecipe?.ingredients || [["", 1]]).map(item => [...item]),
    });
    renderRecipeVariantEditor();
  });
  document.getElementById("remove-recipe-variant-btn")?.addEventListener("click", () => {
    if (selectedRecipeVariantIndex === 0) return;
    editingRecipeVariants.splice(selectedRecipeVariantIndex, 1);
    selectedRecipeVariantIndex = 0;
    renderRecipeVariantEditor();
  });
  document.getElementById("add-ingredient-row-btn")?.addEventListener("click", () => {
    const rows = Array.from(document.querySelectorAll(".recipe-ingredient-editor-row")).map(row => [row.querySelector("input[name=ingredientProduct]").value, Number(row.querySelector("input[name=ingredientAmount]").value) || 1]);
    rows.push(["", 1]);
    renderRecipeIngredientEditor(rows);
    syncRecipeVariantControls();
  });
  document.getElementById("recipe-component-recipes-editor")?.addEventListener("click", event => {
    const section = event.target.closest("[data-component-recipe]");
    if (!section) return;
    saveRecipeEditorVariant();
    const componentIndex = Array.from(section.parentElement.querySelectorAll("[data-component-recipe]")).indexOf(section);
    const component = editingRecipeVariants[selectedRecipeVariantIndex]?.componentRecipes?.[componentIndex];
    if (!component) return;
    if (event.target.closest("[data-add-component-material]")) component.ingredients.push(["", 1]);
    else if (event.target.closest("[data-remove-component-material]")) {
      const row = event.target.closest("[data-component-material-row]");
      if (component.ingredients.length > 1) {
        component.ingredients.splice(Array.from(section.querySelectorAll("[data-component-material-row]")).indexOf(row), 1);
      }
    } else if (event.target.closest("[data-remove-component-recipe]")) {
      editingRecipeVariants[selectedRecipeVariantIndex].componentRecipes.splice(componentIndex, 1);
    } else return;
    renderRecipeVariantEditor();
  });
  document.getElementById("recipe-ingredients-editor")?.addEventListener("click", event => {
    const option = event.target.closest("[data-ingredient-value]");
    if (option) {
      const picker = option.closest("[data-ingredient-picker]");
      const row = option.closest(".recipe-ingredient-editor-row");
      const value = option.dataset.ingredientValue;
      picker.querySelector("[data-ingredient-search]").value = value;
      picker.querySelector("input[name=ingredientProduct]").value = value;
      picker.querySelector("[data-ingredient-menu]").classList.remove("is-open");
      row.querySelector(".ingredient-row-icon").innerHTML = ingredientImage(value) ? `<img src="${craftingEscape(ingredientImage(value))}" alt="${craftingEscape(value)}">` : "🪵";
      picker.querySelectorAll("[data-ingredient-value]").forEach(item => item.classList.toggle("is-selected", item === option));
      syncRecipeVariantControls();
      return;
    }
    const removeButton = event.target.closest("[data-remove-ingredient]");
    if (!removeButton) return;
    const rows = Array.from(document.querySelectorAll(".recipe-ingredient-editor-row")).map(row => [row.querySelector("input[name=ingredientProduct]").value, Number(row.querySelector("input[name=ingredientAmount]").value) || 1]);
    if (rows.length <= 1) return;
    rows.splice(Array.from(document.querySelectorAll(".recipe-ingredient-editor-row")).indexOf(removeButton.closest(".recipe-ingredient-editor-row")), 1);
    renderRecipeIngredientEditor(rows);
    syncRecipeVariantControls();
  });
  document.getElementById("recipe-ingredients-editor")?.addEventListener("focusin", event => {
    const input = event.target.closest("[data-ingredient-search]");
    if (input) input.closest("[data-ingredient-picker]").querySelector("[data-ingredient-menu]").classList.add("is-open");
  });
  document.getElementById("recipe-ingredients-editor")?.addEventListener("input", event => {
    const input = event.target.closest("[data-ingredient-search]");
    if (!input) return;
    const picker = input.closest("[data-ingredient-picker]");
    const menu = picker.querySelector("[data-ingredient-menu]");
    const query = input.value.trim().toLowerCase();
    menu.classList.add("is-open");
    menu.querySelectorAll("[data-ingredient-value]").forEach(option => option.classList.toggle("hidden", !option.dataset.ingredientValue.toLowerCase().includes(query)));
    picker.querySelector("input[name=ingredientProduct]").value = "";
  });
  document.addEventListener("click", event => { if (!event.target.closest("[data-ingredient-picker]")) document.querySelectorAll("[data-ingredient-menu].is-open").forEach(menu => menu.classList.remove("is-open")); });
});
