let selectedRecipeName = null;
let editingRecipeName = null;

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

function recipeStock(name) {
  const product = state.products.find(item => item.name.toLowerCase() === name.toLowerCase());
  return product ? remaining(product) : 0;
}

function productUnitPrice(product) {
  return product && Number(product.unitsPerBaht) > 0 ? 1 / Number(product.unitsPerBaht) : 0;
}

function ingredientUnitPrice(name) {
  return productUnitPrice(ingredientProduct(name));
}

function recipePrice(recipe) {
  return recipe.ingredients.reduce((total, [name, required]) => total + required * ingredientUnitPrice(name), 0);
}

function recipeCraftable(recipe) {
  return Math.min(...recipe.ingredients.map(([name, required]) => Math.floor(recipeStock(name) / required)));
}

function recipeCard(recipe) {
  const craftable = recipeCraftable(recipe);
  const output = recipeProduct(recipe);
  const price = recipePrice(recipe);
  return `<div class="recipe-card glass-card rounded-2xl overflow-hidden text-left ${craftable ? "recipe-ready" : "recipe-locked"}" data-recipe="${recipe.name}">
    <button type="button" class="recipe-card-open w-full text-left"><div class="recipe-card-image relative h-36 bg-slate-800/60"><img src="${recipeOutputImage(recipe)}" loading="lazy" decoding="async" class="w-full h-full object-contain p-3" alt="${recipe.name}"><span class="absolute top-2 right-2 text-[11px] px-2 py-0.5 rounded-full border ${craftable ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" : "bg-slate-900/75 text-slate-400 border-slate-600/50"}">${craftable ? `คราฟได้ ${fmtNum(craftable)}` : "วัตถุดิบไม่ครบ"}</span></div>
    <div class="p-3"><div class="flex items-center justify-between gap-2"><strong class="text-sm truncate">${recipe.name}</strong><span class="text-[10px] px-2 py-0.5 rounded-full border ${rarityBadgeClass(recipe.rarity)}">${rarityLabel(recipe.rarity)}</span></div><p class="text-xs text-slate-400 mt-1">${output ? `มีในคลัง ${fmtNum(remaining(output))} ชิ้น` : "ยังไม่มีในคลังสินค้า"}</p><p class="text-xs text-orange-300 mt-1">ต้นทุนวัตถุดิบ ${fmtBaht(price)}</p></div></button>
    <div class="px-3 pb-3 flex gap-2"><button type="button" data-recipe-action="edit" class="flex-1 text-xs py-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700">✏️ แก้ไขสูตร</button><button type="button" data-recipe-action="delete" class="recipe-delete-btn" aria-label="ลบสูตร" title="ลบสูตร">🗑️</button></div>
  </div>`;
}

function renderCrafting() {
  const grid = document.getElementById("crafting-grid");
  if (!grid) return;
  const recipes = [...getRecipes()].sort((first, second) => {
    const craftableDifference = recipeCraftable(second) - recipeCraftable(first);
    if (craftableDifference !== 0) return craftableDifference;
    const firstRarity = RARITY_ORDER.indexOf(first.rarity);
    const secondRarity = RARITY_ORDER.indexOf(second.rarity);
    if (firstRarity !== secondRarity) return firstRarity - secondRarity;
    return first.name.localeCompare(second.name);
  });
  const ready = recipes.filter(recipe => recipeCraftable(recipe) > 0).length;
  const count = document.getElementById("crafting-ready-count");
  if (count) count.textContent = `พร้อมคราฟ ${ready}/${recipes.length} สูตร`;
  grid.innerHTML = recipes.map(recipeCard).join("");
}

function openCraftingModal(recipeName) {
  selectedRecipeName = recipeName;
  renderCraftingModal();
  openModal("crafting-modal");
}

function renderCraftingModal() {
  const recipe = getRecipes().find(item => item.name === selectedRecipeName);
  const container = document.getElementById("crafting-modal-content");
  if (!recipe || !container) return;
  const craftable = recipeCraftable(recipe);
  const price = recipePrice(recipe);
  const ingredientRows = recipe.ingredients.map(([name, required]) => {
    const available = recipeStock(name);
    const enough = available >= required;
    const product = state.products.find(item => item.name.toLowerCase() === name.toLowerCase());
    const image = product?.image;
    return `<div class="craft-ingredient ${enough ? "craft-ingredient-ok" : "craft-ingredient-missing"}"><div class="craft-ingredient-image">${image ? `<img src="${image}" alt="${name}">` : "🪵"}</div><div class="min-w-0 flex-1"><p class="text-xs font-semibold truncate">${name}</p><p class="text-[11px] ${enough ? "text-emerald-300" : "text-rose-300"}">${fmtNum(available)} / ${fmtNum(required)} ชิ้น${enough ? "" : ` • ขาด ${fmtNum(required - available)}`}</p></div><span class="craft-check">${enough ? "✓" : "!"}</span></div>`;
  }).join("");
  container.innerHTML = `<div class="crafting-header"><div class="crafting-output-image"><img src="${recipeOutputImage(recipe)}" alt="${recipe.name}"></div><div class="min-w-0"><p class="text-xs text-orange-300 mb-1">สูตรคราฟ</p><h2 class="font-bold text-xl truncate">${recipe.name}</h2><p class="text-xs text-slate-400 mt-1">ราคาคำนวณจากเรทวัตถุดิบในหน้าขายไอเทม</p></div><button type="button" id="edit-crafting-btn" class="ml-auto flex-shrink-0 px-3 py-2 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-xs">✏️ แก้ไข</button></div><div class="crafting-recipe-preview"><img src="${recipeImage(recipe)}" alt="สูตร ${recipe.name}"></div><div class="crafting-summary"><div><span>คราฟได้สูงสุด</span><strong class="${craftable ? "text-emerald-300" : "text-rose-300"}">${fmtNum(craftable)} ชิ้น</strong></div><div><span>ต้นทุนต่อชิ้น</span><strong class="text-orange-300">${fmtBaht(price)}</strong></div><div><span>สถานะ</span><strong class="${craftable ? "text-emerald-300" : "text-rose-300"}">${craftable ? "พร้อมคราฟ" : "ของไม่ครบ"}</strong></div></div><div class="flex items-center justify-between mt-5 mb-2"><h3 class="font-semibold text-sm">วัตถุดิบที่ต้องใช้</h3><span class="text-xs text-slate-400">ตรวจจากคงเหลือปัจจุบัน</span></div><div class="craft-ingredients-grid">${ingredientRows}</div><div class="flex gap-2 mt-5"><button type="button" data-close-modal class="flex-1 py-2.5 rounded-xl bg-slate-700/50 hover:bg-slate-700 text-sm">ยกเลิก</button><button type="button" id="confirm-craft-btn" class="flex-1 btn-primary py-2.5 rounded-xl text-sm" ${craftable < 1 ? "disabled" : ""}>คราฟ 1 ชิ้น</button></div>`;
  document.getElementById("edit-crafting-btn")?.addEventListener("click", () => { closeModal("crafting-modal"); openRecipeEditor(recipe.name); });
  document.getElementById("confirm-craft-btn")?.addEventListener("click", () => craftRecipe(recipe));
}

function craftRecipe(recipe) {
  if (recipeCraftable(recipe) < 1) { toast("วัตถุดิบไม่เพียงพอ", "error"); return; }
  recipe.ingredients.forEach(([name, required]) => {
    const product = state.products.find(item => item.name.toLowerCase() === name.toLowerCase());
    product.stock -= required;
  });
  const output = recipeProduct(recipe);
  if (output) {
    output.stock += 1;
    output.crafted = (output.crafted || 0) + 1;
  } else {
    state.products.unshift({ id: genId("p"), name: recipe.name, category: "ของคราฟ", image: recipeOutputImage(recipe), rarity: recipe.rarity, stock: 1, sold: 0, crafted: 1, unitsPerBaht: 1, description: "สินค้าที่คราฟจากสูตร", createdAt: Date.now(), restockHistory: [] });
  }
  if (!Array.isArray(state.activityLog)) state.activityLog = [];
  state.activityLog.unshift({ id: genId("activity"), type: "craft", action: "คราฟสินค้า", text: `คราฟสินค้าเพื่อขาย: ${recipe.name}`, sub: "+1 ชิ้น • พร้อมนำไปขาย", ts: Date.now() });
  state.activityLog = state.activityLog.slice(0, 100);
  saveState();
  renderCrafting();
  renderProducts();
  renderDashboard();
  closeModal("crafting-modal");
  toast(`คราฟ ${recipe.name} สำเร็จ`);
}

function openRecipeEditor(recipeName = null) {
  editingRecipeName = recipeName;
  const form = document.getElementById("crafting-editor-form");
  const recipe = recipeName ? getRecipes().find(item => item.name === recipeName) : null;
  form.reset();
  const outputNames = [...CRAFT_OUTPUT_ITEMS].sort((a, b) => a.localeCompare(b));
  form.name.innerHTML = `<option value="">เลือกไอเทมผลลัพธ์</option>` + outputNames.map(name => `<option value="${name}">${name}</option>`).join("");
  form.rarity.innerHTML = RARITY_ORDER.map(rarity => `<option value="${rarity}">${rarityLabel(rarity)}</option>`).join("");
  form.rarity.value = recipe?.rarity || "none";
  document.getElementById("crafting-editor-title").textContent = recipe ? "แก้ไขสูตรคราฟ" : "เพิ่มสูตรคราฟ";
  renderRecipeIngredientEditor(recipe?.ingredients || [["", 1]]);
  if (recipe) {
    form.name.value = recipe.name;
  }
  updateRecipeImagePreview(form.name.value);
  openModal("crafting-editor-modal");
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
    const options = products.map(product => `<button type="button" class="ingredient-option ${product.name === selectedName ? "is-selected" : ""}" data-ingredient-value="${product.name}" role="option">${product.image ? `<img src="${product.image}" alt="">` : "🪵"}<span>${product.name}</span></button>`).join("");
    return `<div class="recipe-ingredient-editor-row"><div class="ingredient-row-icon">${ingredientImage(selectedName) ? `<img src="${ingredientImage(selectedName)}" alt="${selectedName}">` : "🪵"}</div><div class="ingredient-row-fields"><label>วัตถุดิบ<div class="ingredient-picker" data-ingredient-picker><input type="text" class="ingredient-search-input" data-ingredient-search value="${selectedName}" placeholder="พิมพ์เพื่อค้นหาวัตถุดิบ..." autocomplete="off" aria-label="ค้นหาวัตถุดิบ"><input type="hidden" name="ingredientProduct" value="${selectedName}"><div class="ingredient-picker-menu" data-ingredient-menu role="listbox">${options}</div></div></label><label class="ingredient-amount-field">จำนวน<input name="ingredientAmount" type="number" min="0.0001" step="any" value="${amount || 1}"></label></div><button type="button" data-remove-ingredient class="ingredient-remove-btn" aria-label="ลบวัตถุดิบ">✕</button></div>`;
  }).join("");
}

function collectRecipeIngredients() {
  return Array.from(document.querySelectorAll(".recipe-ingredient-editor-row")).map(row => [row.querySelector("input[name=ingredientProduct]").value, Number(row.querySelector("input[name=ingredientAmount]").value)]).filter(([name, amount]) => name && Number.isFinite(amount) && amount > 0);
}

function handleRecipeEditorSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const ingredients = collectRecipeIngredients();
  if (!form.name.value.trim() || !ingredients.length) {
    toast("กรุณากรอกข้อมูลสูตรและวัตถุดิบให้ครบ", "error");
    return;
  }
  const payload = { name: form.name.value.trim(), rarity: form.rarity.value, ingredients };
  const recipes = getRecipes();
  if (editingRecipeName) {
    const index = recipes.findIndex(recipe => recipe.name === editingRecipeName);
    if (index >= 0) recipes[index] = payload;
  } else {
    if (recipes.some(recipe => recipe.name.toLowerCase() === payload.name.toLowerCase())) { toast("มีสูตรชื่อนี้แล้ว", "error"); return; }
    recipes.unshift(payload);
  }
  state.recipes = recipes;
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
    saveState();
    renderCrafting();
    toast(`ลบสูตร ${recipe.name} แล้ว`);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("crafting-grid")?.addEventListener("click", event => {
    const card = event.target.closest("[data-recipe]");
    if (!card) return;
    if (event.target.closest("[data-recipe-action=edit]")) openRecipeEditor(card.dataset.recipe);
    else if (event.target.closest("[data-recipe-action=delete]")) deleteRecipe(card.dataset.recipe);
    else if (event.target.closest(".recipe-card-open")) openCraftingModal(card.dataset.recipe);
  });
  document.getElementById("add-recipe-menu-btn")?.addEventListener("click", () => { document.getElementById("add-entry-menu").classList.add("hidden"); openRecipeEditor(); });
  document.getElementById("crafting-editor-form")?.addEventListener("submit", handleRecipeEditorSubmit);
  document.getElementById("crafting-editor-form")?.elements.name.addEventListener("change", event => updateRecipeImagePreview(event.target.value));
  document.getElementById("add-ingredient-row-btn")?.addEventListener("click", () => {
    const rows = Array.from(document.querySelectorAll(".recipe-ingredient-editor-row")).map(row => [row.querySelector("input[name=ingredientProduct]").value, Number(row.querySelector("input[name=ingredientAmount]").value) || 1]);
    rows.push(["", 1]);
    renderRecipeIngredientEditor(rows);
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
      row.querySelector(".ingredient-row-icon").innerHTML = ingredientImage(value) ? `<img src="${ingredientImage(value)}" alt="${value}">` : "🪵";
      picker.querySelectorAll("[data-ingredient-value]").forEach(item => item.classList.toggle("is-selected", item === option));
      return;
    }
    const removeButton = event.target.closest("[data-remove-ingredient]");
    if (!removeButton) return;
    const rows = Array.from(document.querySelectorAll(".recipe-ingredient-editor-row")).map(row => [row.querySelector("input[name=ingredientProduct]").value, Number(row.querySelector("input[name=ingredientAmount]").value) || 1]);
    if (rows.length <= 1) return;
    rows.splice(Array.from(document.querySelectorAll(".recipe-ingredient-editor-row")).indexOf(removeButton.closest(".recipe-ingredient-editor-row")), 1);
    renderRecipeIngredientEditor(rows);
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
