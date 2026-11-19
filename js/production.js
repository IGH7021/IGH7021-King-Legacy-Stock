function productionEscape(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[char]));
}

function productionUnitPrice(product) {
  const rate = Number(product?.unitsPerBaht);
  return rate > 0 ? 1 / rate : 0;
}

function productionCartSubtotal(quantity, unitPrice) {
  const subtotal = Number(quantity) * Number(unitPrice);
  return Number.isFinite(subtotal) ? Math.round(subtotal * 100) / 100 : 0;
}

function productionCartQuantityForAmount(amount, unitPrice) {
  const requestedAmount = Number(amount);
  const price = Number(unitPrice);
  if (!Number.isFinite(requestedAmount) || requestedAmount <= 0 || !Number.isFinite(price) || price <= 0) return 0;
  const quotient = requestedAmount / price;
  const quantity = Math.floor(quotient + Number.EPSILON * Math.max(1, quotient));
  return Number.isSafeInteger(quantity) ? quantity : 0;
}

function productionCartRate(quantity, subtotal) {
  return subtotal > 0 ? quantity / subtotal : 0;
}

let productionCartAddContext = null;
let productionCartAddMode = "quantity";

function productionCartItem(type, referenceId, quantity = 1, unitPrice = null, deliveryMethod = null, upgradeLevel = 0) {
  if (type === "product") {
    const product = state.products.find(item => item.id === referenceId);
    if (!product || isGamePassProduct(product)) return null;
    return { type, refId: product.id, name: product.name, quantity, unitPrice: productionUnitPrice(product) };
  }
  if (type === "gamepass") {
    const product = state.products.find(item => item.id === referenceId);
    const variant = product?.gamePass?.[deliveryMethod];
    if (!isGamePassProduct(product) || !variant || !["gift", "trade"].includes(deliveryMethod)) return null;
    return {
      type, refId: product.id, name: `${product.name} (${t(`gamepass_${deliveryMethod}`)})`,
      productName: product.name, deliveryMethod, quantity,
      unitPrice: variant.price,
    };
  }
  if (type === "farm") {
    const service = state.farmServices.find(item => item.id === referenceId);
    if (!service) return null;
    const price = service.pricingMode === "hour"
      ? Number(service.hourPrice || service.ratePrice) || 0
      : (Number(service.ratePrice) || 0) / (Number(service.rateQty || service.unitsPerBaht) || 1);
    return { type, refId: service.id, name: service.name, quantity, unitPrice: price, pricingMode: service.pricingMode || "unit" };
  }
  if (type === "craft") {
    const { recipe, variantIndex } = recipeFromReference(referenceId);
    if (!recipe || !recipeProduct(recipe)) return null;
    return { type, refId: referenceId, name: `${recipe.name}${variantIndex ? ` · สูตร ${variantIndex + 1}` : ""}`, quantity, unitPrice: recipeSalePrice(recipe) };
  }
  if (type === "upgrade") {
    const product = state.products.find(item => item.id === referenceId);
    if (!product || !["ดาบ", "ของแต่ง"].includes(product.category)) return null;
    const level = Number(upgradeLevel);
    if (!Number.isSafeInteger(level) || level < 0 || level > (product.upgradeSteps?.length || 0)) return null;
    return { type, refId: product.id, name: `${product.name} upgrade${level ? ` · ขั้น ${level}` : ""}`, productName: product.name, upgradeLevel: level, quantity, unitPrice: unitPrice ?? 0 };
  }
  return null;
}

function setProductionCartAddMode(mode) {
  productionCartAddMode = mode === "amount" ? "amount" : "quantity";
  document.querySelectorAll("[data-cart-add-mode]").forEach(tab => {
    const selected = tab.dataset.cartAddMode === productionCartAddMode;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    tab.classList.toggle("is-active", selected);
  });
  document.getElementById("production-cart-add-quantity-panel").hidden = productionCartAddMode !== "quantity";
  document.getElementById("production-cart-add-amount-panel").hidden = productionCartAddMode !== "amount";
  updateProductionCartAddPreview();
}

function updateProductionCartAddPreview() {
  const product = state.products.find(item => item.id === productionCartAddContext?.refId);
  if (!product) return;
  const unitPrice = productionUnitPrice(product);
  const preview = document.getElementById("production-cart-add-preview");
  const submit = document.getElementById("production-cart-add-submit");
  const quantityInput = document.getElementById("production-cart-add-quantity");
  const amountInput = document.getElementById("production-cart-add-amount");
  let quantity = 0;
  let subtotal = 0;
  let message = "";

  if (productionCartAddMode === "amount") {
    const amount = Number(amountInput.value);
    if (!Number.isFinite(amount) || amount <= 0) {
      message = t("production_cart_add_invalid_amount");
    } else if (unitPrice <= 0) {
      message = t("production_cart_add_price_missing");
    } else {
      quantity = productionCartQuantityForAmount(amount, unitPrice);
      if (quantity < 1) {
        message = t("production_cart_add_invalid_amount");
      } else {
        subtotal = productionCartSubtotal(quantity, unitPrice);
        const remainder = Math.max(0, Math.round((amount - subtotal) * 100) / 100);
        const remainderText = remainder > 0
          ? t("production_cart_add_preview_remainder", { amount: fmtBaht(remainder) })
          : "";
        message = t("production_cart_add_preview_amount", {
          quantity: fmtNum(quantity), total: fmtBaht(subtotal), remainder: remainderText,
        });
      }
    }
  } else {
    quantity = Number(quantityInput.value);
    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      quantity = 0;
      message = t("production_cart_add_invalid_quantity");
    } else {
      subtotal = productionCartSubtotal(quantity, unitPrice);
      message = t("production_cart_add_preview_quantity", {
        quantity: fmtNum(quantity), total: fmtBaht(subtotal),
      });
    }
  }

  preview.textContent = message;
  submit.disabled = quantity < 1;
  submit.textContent = quantity > 0
    ? t("production_cart_add_submit", { quantity: fmtNum(quantity), total: fmtBaht(subtotal) })
    : t("production_cart_add_submit_default");
}

function openProductionCartAddDialog(referenceId) {
  const product = state.products.find(item => item.id === referenceId);
  const dialog = document.getElementById("production-cart-add-dialog");
  if (!product || isGamePassProduct(product) || !dialog || typeof dialog.showModal !== "function") {
    toast(t("production_cart_add_unavailable"), "error");
    return false;
  }

  productionCartAddContext = { refId: product.id };
  productionCartAddMode = "quantity";
  document.getElementById("production-cart-add-name").textContent = product.name;
  const image = document.getElementById("production-cart-add-image");
  image.hidden = !product.image;
  image.src = product.image || "";
  image.alt = "";
  const rate = Number(product.unitsPerBaht) || 1;
  document.getElementById("production-cart-add-rate").textContent = rate >= 1
    ? t("production_cart_add_rate_pieces", { quantity: fmtNum(rate) })
    : t("production_cart_add_rate_price", { price: fmtBaht(1 / rate) });
  document.getElementById("production-cart-add-remaining").textContent = t("production_cart_add_remaining", {
    quantity: fmtNum(remaining(product)),
  });
  document.getElementById("production-cart-add-quantity").value = "1";
  document.getElementById("production-cart-add-amount").value = Math.max(0.01, Math.ceil(productionUnitPrice(product) * 100) / 100).toFixed(2);
  setProductionCartAddMode("quantity");
  dialog.showModal();
  document.getElementById("production-cart-add-quantity").focus();
  return true;
}

function synchronizeCartConfiguredPrices() {
  for (const item of state.cart) {
    if (!["product", "gamepass", "farm", "craft"].includes(item.type)) continue;
    const configured = productionCartItem(item.type, item.refId, item.quantity, null, item.deliveryMethod, item.upgradeLevel);
    if (!configured) continue;
    item.unitPrice = configured.unitPrice;
    item.name = configured.name;
    if (item.type === "farm") item.pricingMode = configured.pricingMode;
  }
}

function addToCart(type, referenceId, quantity = 1, unitPrice = null, deliveryMethod = null, upgradeLevel = 0) {
  const item = productionCartItem(type, referenceId, quantity, unitPrice, deliveryMethod, upgradeLevel);
  if (!item) {
    toast(t("production_cart_error_unsupported"), "error");
    return false;
  }
  if (item.type === "gamepass" && gamePassRemaining(state.products.find(product => product.id === item.refId), item.deliveryMethod) <= 0) {
    toast(t("toast_insufficient_stock"), "error");
    return false;
  }
  state.cart ||= [];
  synchronizeCartConfiguredPrices();
  const existing = state.cart.find(line => line.type === item.type && line.refId === item.refId
    && line.deliveryMethod === item.deliveryMethod && line.upgradeLevel === item.upgradeLevel
    && Number(line.unitPrice) === Number(item.unitPrice));
  if (existing) existing.quantity = Number(existing.quantity) + Number(item.quantity);
  else state.cart.push({ id: genId("cart"), ...item });
  saveState();
  renderProductionCart();
  toast(t("production_cart_added"));
  return true;
}

function cartItemLabel(item) {
  if (item.type === "gamepass") return `${t("gamepass_delivery_method")} · ${t(`gamepass_${item.deliveryMethod}`)}`;
  if (item.type === "farm") return t(item.pricingMode === "hour" ? "production_cart_farm_hour" : "production_cart_farm");
  if (item.type === "craft") return t("production_cart_craft");
  if (item.type === "upgrade") return t("production_cart_upgrade");
  return t("production_cart_product");
}

function cartItemImage(item) {
  if (item.type === "farm") {
    const service = state.farmServices.find(entry => entry.id === item.refId);
    return { src: service?.image || "", alt: service?.name || item.name, fallback: "🌾" };
  }
  const product = state.products.find(entry => entry.id === item.refId);
  if (item.type === "craft") {
    const { recipe } = recipeFromReference(item.refId);
    return { src: product?.image || (recipe ? recipeOutputImage(recipe) : ""), alt: recipe?.name || item.name, fallback: "🛠️" };
  }
  return { src: product?.image || "", alt: product?.name || item.name, fallback: item.type === "upgrade" ? "⬆️" : "📦" };
}

function cartCraftMaterials(item) {
  const { recipe } = recipeFromReference(item.refId);
  if (!recipe) return [];
  return recipeMaterialRequirements(recipe, Number(item.quantity) || 0);
}

function upgradeStepRequirements(product, level, quantity = 1) {
  if (!Number.isSafeInteger(Number(level)) || Number(level) < 1 || Number(level) > (product?.upgradeSteps?.length || 0)) return [];
  const ingredients = product.upgradeSteps.slice(0, Number(level)).flatMap(step => step.ingredients || []);
  return recipeMaterialRequirements({ ingredients }, Number(quantity) || 0);
}

function cartUpgradeMaterials(item) {
  const product = state.products.find(entry => entry.id === item.refId);
  return item.upgradeLevel ? upgradeStepRequirements(product, item.upgradeLevel, Number(item.quantity) || 0) : [];
}

function renderProductionCart() {
  const panel = document.getElementById("production-cart-panel");
  const lines = document.getElementById("production-cart-lines");
  if (!panel || !lines) return;
  const saleDatetime = document.getElementById("production-cart-datetime");
  if (saleDatetime && !saleDatetime.value) saleDatetime.value = APP_TIME.dateTimeInput();
  state.cart = Array.isArray(state.cart) ? state.cart : [];
  synchronizeCartConfiguredPrices();
  document.getElementById("production-cart-count").textContent = String(state.cart.length);
  const cartLabel = t("production_cart_toggle_aria", { count: state.cart.length });
  document.getElementById("production-cart-toggle").setAttribute("aria-label", cartLabel);
  document.getElementById("production-cart-status").textContent = cartLabel;
  document.getElementById("production-cart-empty").classList.toggle("hidden", state.cart.length > 0);
  document.getElementById("production-cart-checkout").disabled = state.cart.length === 0;
  lines.innerHTML = state.cart.map(item => {
    const materialRequirements = item.type === "craft" ? cartCraftMaterials(item) : item.type === "upgrade" ? cartUpgradeMaterials(item) : [];
    const image = cartItemImage(item);
    const imageContent = image.src
      ? `<img src="${productionEscape(image.src)}" alt="${productionEscape(image.alt)}" loading="lazy" decoding="async">`
      : `<span aria-hidden="true">${image.fallback}</span>`;
    const materials = materialRequirements.length
      ? `<p class="mt-1 text-[11px] ${materialRequirements.some(material => material.required > material.available) ? "text-rose-300" : "text-slate-400"}">${materialRequirements.map(material => `${productionEscape(material.name)} −${fmtNum(material.required)} (มี ${fmtNum(material.available)})`).join(" · ")}</p>`
      : "";
    return `<article class="rounded-xl border border-slate-700/60 bg-slate-800/35 p-3" data-cart-line="${productionEscape(item.id)}">
      <div class="grid md:grid-cols-[minmax(0,1fr)_10rem_auto] gap-3 items-center">
        <div class="min-w-0 flex items-center gap-2"><div class="production-cart-image">${imageContent}</div><div class="min-w-0"><span class="text-[10px] uppercase tracking-wide text-slate-400">${cartItemLabel(item)}</span><p class="text-sm font-medium break-words">${productionEscape(item.name)}</p></div></div>
        <label class="production-cart-quantity text-[11px] text-slate-400">${t("production_cart_quantity")}<input data-cart-quantity type="number" min="${["product", "gamepass", "craft", "upgrade"].includes(item.type) ? "1" : "0.01"}" step="${["product", "gamepass", "craft", "upgrade"].includes(item.type) ? "1" : "any"}" value="${Number(item.quantity)}" class="mt-1 rounded-lg bg-slate-900/70 border border-slate-700 px-2 py-1.5 text-sm"></label>
        <div class="flex items-center justify-between md:justify-end gap-3 min-w-0"><strong data-cart-subtotal class="text-sm text-emerald-300 whitespace-nowrap">${fmtBaht(productionCartSubtotal(item.quantity, item.unitPrice))}</strong><button type="button" data-cart-remove class="min-w-11 min-h-11 text-slate-400 hover:text-rose-300 px-2 py-1" aria-label="${t("production_cart_remove")}" title="${t("production_cart_remove")}">×</button></div>
      </div>${materials}
    </article>`;
  }).join("");
  refreshCartTotals();
  updateProductionCartFeedback();
}

function setProductionCartDialogOpen(open) {
  const panel = document.getElementById("production-cart-panel");
  const toggle = document.getElementById("production-cart-toggle");
  if (!panel || !toggle) return;
  if (open) {
    if (document.getElementById("page-products")?.classList.contains("hidden")) showPage("products");
    if (!panel.open) panel.showModal();
    toggle.setAttribute("aria-expanded", "true");
    renderProductionCart();
  } else {
    if (panel.open) panel.close();
    toggle.setAttribute("aria-expanded", "false");
  }
}

function refreshCartTotals() {
  const total = state.cart.reduce((sum, item) => {
    const subtotal = productionCartSubtotal(item.quantity, item.unitPrice);
    const lineElement = [...document.querySelectorAll("[data-cart-line]")].find(element => element.dataset.cartLine === item.id);
    const subtotalElement = lineElement?.querySelector("[data-cart-subtotal]");
    if (subtotalElement) subtotalElement.textContent = fmtBaht(subtotal);
    return sum + subtotal;
  }, 0);
  document.getElementById("production-cart-total").textContent = fmtBaht(Math.round(total * 100) / 100);
}

function updateProductionCartFeedback() {
  const button = document.getElementById("production-cart-checkout");
  const feedback = document.getElementById("production-cart-validation");
  if (!button || !feedback) return;
  const error = state.cart.length ? validateProductionCart() : "";
  feedback.textContent = error;
  feedback.classList.toggle("hidden", !error);
  button.disabled = state.cart.length === 0 || Boolean(error);
  return error;
}

function validateProductionCart() {
  if (!state.cart.length) return t("production_cart_error_empty");
  const saleDatetime = document.getElementById("production-cart-datetime")?.value;
  if (!Number.isFinite(APP_TIME.parseDateTimeInput(saleDatetime))) return t("production_cart_error_datetime");
  synchronizeCartConfiguredPrices();
  const stockDeductions = new Map();
  const gamePassDeductions = new Map();
  const addDeduction = (product, quantity) => {
    if (product) stockDeductions.set(product.id, (stockDeductions.get(product.id) || 0) + quantity);
  };
  for (const item of state.cart) {
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) return t("production_cart_error_values");
    if (item.type === "product") {
      const product = state.products.find(entry => entry.id === item.refId);
      if (!Number.isInteger(quantity) || !product || isGamePassProduct(product)) return t("production_cart_error_product", { name: item.name });
      addDeduction(product, quantity);
    } else if (item.type === "gamepass") {
      const product = state.products.find(entry => entry.id === item.refId);
      if (!Number.isInteger(quantity) || !isGamePassProduct(product) || !["gift", "trade"].includes(item.deliveryMethod)
        || !product.gamePass?.[item.deliveryMethod]) return t("production_cart_error_gamepass", { name: item.name });
      const key = JSON.stringify([product.id, item.deliveryMethod]);
      gamePassDeductions.set(key, (gamePassDeductions.get(key) || 0) + quantity);
    } else if (item.type === "farm") {
      if (!state.farmServices.some(service => service.id === item.refId)) return t("production_cart_error_farm", { name: item.name });
    } else if (item.type === "craft") {
      const { recipe } = recipeFromReference(item.refId);
      if (!Number.isInteger(quantity) || !recipe || !recipeProduct(recipe)) return t("production_cart_error_recipe", { name: item.name });
      for (const material of recipeMaterialRequirements(recipe, quantity)) {
        const product = ingredientProduct(material.name);
        if (!product) return t("production_cart_error_material", { name: material.name });
        addDeduction(product, material.required);
      }
    } else if (item.type === "upgrade") {
      const product = state.products.find(entry => entry.id === item.refId);
      if (!Number.isInteger(quantity) || !product || !["ดาบ", "ของแต่ง"].includes(product.category)
        || !Number.isSafeInteger(Number(item.upgradeLevel || 0)) || Number(item.upgradeLevel || 0) < 0
        || Number(item.upgradeLevel || 0) > (product.upgradeSteps?.length || 0)) return t("production_cart_error_upgrade", { name: item.name });
      for (const material of cartUpgradeMaterials(item)) {
        const materialProduct = ingredientProduct(material.name);
        if (!materialProduct) return t("production_cart_error_material", { name: material.name });
        addDeduction(materialProduct, material.required);
      }
    } else return t("production_cart_error_type");
  }
  for (const product of state.products) {
    if ((stockDeductions.get(product.id) || 0) > remaining(product)) return t("production_cart_error_stock", { name: product.name });
  }
  for (const [key, quantity] of gamePassDeductions) {
    const [productId, method] = JSON.parse(key);
    const product = state.products.find(entry => entry.id === productId);
    if (quantity > gamePassRemaining(product, method)) return t("production_cart_error_gamepass_stock", { name: product.name, method: t(`gamepass_${method}`) });
  }
  return "";
}

function addProductionActivity(type, text, sub, timestamp) {
  state.activityLog ||= [];
  state.activityLog.unshift({ id: genId("activity"), type, action: text, text, sub, ts: timestamp });
  state.activityLog = state.activityLog.slice(0, 100);
}

function checkoutProductionCart() {
  const validationError = validateProductionCart();
  if (validationError) {
    toast(validationError, "error");
    return;
  }
  const timestamp = APP_TIME.parseDateTimeInput(document.getElementById("production-cart-datetime").value);
  const orderId = genId("order");
  const customer = document.getElementById("production-cart-customer").value.trim();
  const note = document.getElementById("production-cart-note").value.trim();
  const orderLines = state.cart.map(item => ({
    type: item.type,
    referenceId: item.refId,
    name: item.name,
    ...(item.type === "gamepass" ? { deliveryMethod: item.deliveryMethod } : {}),
    ...(item.type === "upgrade" ? { upgradeLevel: Number(item.upgradeLevel) || 0 } : {}),
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice),
    subtotal: productionCartSubtotal(item.quantity, item.unitPrice),
  }));
  const total = Math.round(orderLines.reduce((sum, line) => sum + line.subtotal, 0) * 100) / 100;

  state.cart.forEach((item, index) => {
    const line = orderLines[index];
    if (item.type === "product") {
      const product = state.products.find(entry => entry.id === item.refId);
      product.sold = Number(product.sold || 0) + line.quantity;
      state.sales.unshift({ id: genId("s"), productId: product.id, productName: product.name, quantity: line.quantity, money: line.subtotal, rate: productionCartRate(line.quantity, line.subtotal), date: timestamp, note, source: "order", orderId });
    } else if (item.type === "gamepass") {
      const product = state.products.find(entry => entry.id === item.refId);
      product.gamePass[item.deliveryMethod].sold += line.quantity;
      product.sold = Number(product.sold || 0) + line.quantity;
      state.sales.unshift({
        id: genId("s"), productId: product.id, productName: product.name, deliveryMethod: item.deliveryMethod,
        quantity: line.quantity, money: line.subtotal, rate: productionCartRate(line.quantity, line.subtotal),
        date: timestamp, note, source: "order", orderId,
      });
    } else if (item.type === "farm") {
      const service = state.farmServices.find(entry => entry.id === item.refId);
      const hourly = service.pricingMode === "hour";
      state.farmOrders.unshift({ id: genId("fo"), orderId, serviceId: service.id, serviceName: service.name, pricingMode: service.pricingMode || "unit", quantity: hourly ? 0 : line.quantity, hours: hourly ? line.quantity : 0, money: line.subtotal, customer, note, date: timestamp });
    } else if (item.type === "craft") {
      const { recipe } = recipeFromReference(item.refId);
      const materials = recipeMaterialRequirements(recipe, line.quantity);
      materials.forEach(material => { ingredientProduct(material.name).stock -= material.required; });
      const output = recipeProduct(recipe);
      output.sold = Number(output.sold || 0) + line.quantity;
      output.crafted = Number(output.crafted || 0) + line.quantity;
      const materialNote = materials.map(material => `${material.name} -${fmtNum(material.required)}`).join(", ");
      state.sales.unshift({ id: genId("s"), productId: output.id, productName: output.name, quantity: line.quantity, money: line.subtotal, rate: productionCartRate(line.quantity, line.subtotal), date: timestamp, note: `คราฟ ${fmtNum(line.quantity)} ชุด • หักวัตถุดิบ: ${materialNote}${note ? ` • ${note}` : ""}`, source: "craft", orderId });
    } else {
      const product = state.products.find(entry => entry.id === item.refId);
      const materials = cartUpgradeMaterials(item);
      materials.forEach(material => { ingredientProduct(material.name).stock -= material.required; });
      state.upgradeOrders.unshift({
        id: genId("upgrade"), orderId, productId: product.id, productName: product.name,
        upgradeLevel: Number(item.upgradeLevel) || 0, quantity: line.quantity, unitPrice: line.unitPrice,
        money: line.subtotal, customer, note, date: timestamp,
        materials: materials.map(material => ({ name: material.name, quantity: material.required })),
      });
    }
  });
  state.orders.unshift({ id: orderId, date: timestamp, customer, note, total, status: "completed", lines: orderLines });
  const orderSummary = orderLines.map(line => `${line.name} × ${fmtNum(line.quantity)}`).join(" • ");
  addProductionActivity("order", `บันทึกออเดอร์ ${orderId}`, `${orderSummary} • ${fmtBaht(total)}`, timestamp);
  state.cart = [];
  document.getElementById("production-cart-datetime").value = APP_TIME.dateTimeInput();
  saveState();
  renderProductionCart();
  renderProducts();
  renderFarmServices();
  renderCrafting();
  renderUpgradeOrders();
  renderSalesHistory();
  renderDashboard();
  renderReports();
  setProductionCartDialogOpen(false);
  toast(t("production_cart_saved"));
}

function renderUpgradeOrders() {
  const box = document.getElementById("upgrade-orders-list");
  if (!box) return;
  const orders = Array.isArray(state.upgradeOrders) ? state.upgradeOrders : [];
  box.innerHTML = orders.length ? orders.map(order => `<div class="glass-card rounded-xl p-3 flex items-center gap-3">
    <div class="w-10 h-10 rounded-lg bg-indigo-500/15 flex items-center justify-center">⬆️</div>
    <div class="flex-1 min-w-0"><div class="flex justify-between gap-2"><span class="font-medium text-sm truncate">${productionEscape(order.productName)} upgrade${Number(order.upgradeLevel) ? ` · ขั้น ${fmtNum(order.upgradeLevel)}` : ""}</span><span class="font-semibold text-sm text-emerald-300">${fmtBaht(order.money)}</span></div>
    <p class="text-xs text-slate-400">${fmtNum(order.quantity)} งาน • ${fmtDate(order.date)}${order.customer ? ` • ${productionEscape(order.customer)}` : ""}${Array.isArray(order.materials) && order.materials.length ? ` • ใช้ ${order.materials.map(item => `${productionEscape(item.name)} ${fmtNum(item.quantity)}`).join(", ")}` : ""}${order.note ? ` • ${productionEscape(order.note)}` : ""}</p></div></div>`).join("") : `<p class="text-xs text-slate-400 py-4 text-center">ยังไม่มีประวัติงานอัปเกรด</p>`;
}

function renderUpgradeProductOptions() {
  const select = document.getElementById("upgrade-product-select");
  const levelSelect = document.getElementById("upgrade-level-select");
  const empty = document.getElementById("upgrade-product-empty");
  const form = document.getElementById("upgrade-cart-form");
  const grid = document.getElementById("upgrade-services-grid");
  if (!select || !levelSelect || !empty || !form || !grid) return;
  const selectedProductId = select.value;
  const products = state.products.filter(product => ["ดาบ", "ของแต่ง"].includes(product.category)).sort((first, second) => {
    const categoryDifference = categorySortIndex(first.category) - categorySortIndex(second.category);
    if (categoryDifference) return categoryDifference;
    const firstRarity = RARITY_ORDER.indexOf(first.rarity || "none");
    const secondRarity = RARITY_ORDER.indexOf(second.rarity || "none");
    const rarityDifference = (firstRarity < 0 ? RARITY_ORDER.length : firstRarity)
      - (secondRarity < 0 ? RARITY_ORDER.length : secondRarity);
    return rarityDifference || first.name.localeCompare(second.name);
  });
  select.innerHTML = products.map(product => `<option value="${productionEscape(product.id)}">${productionEscape(product.name)} · ${productionEscape(product.category)}</option>`).join("");
  empty.classList.toggle("hidden", products.length > 0);
  form.classList.toggle("hidden", products.length === 0);
  const selectedIdsForUpgrade = typeof selectedIds === "undefined" ? new Set() : selectedIds;
  const selecting = typeof selectMode !== "undefined" && selectMode;
  grid.innerHTML = products.map(product => {
    const steps = Array.isArray(product.upgradeSteps) ? product.upgradeSteps : [];
    return `<article class="glass-card rounded-2xl p-3 flex flex-col gap-2 ${selectedIdsForUpgrade.has(product.id) ? "ring-2 ring-indigo-500" : ""}" data-upgrade-product="${productionEscape(product.id)}">
      <div class="flex items-start gap-3"><div class="w-12 h-12 rounded-lg overflow-hidden bg-slate-800/60 shrink-0">${product.image ? `<img src="${productionEscape(product.image)}" alt="" class="w-full h-full object-cover">` : "⬆️"}</div><div class="min-w-0 flex-1"><strong class="block text-sm truncate">${productionEscape(product.name)}</strong><p class="text-xs text-slate-400">${steps.length ? `${fmtNum(steps.length)} ขั้นอัปเกรด` : "ยังไม่ได้กำหนดสูตรอัปเกรด"}</p></div></div>
      ${steps.map((step, index) => `<p class="text-[11px] text-slate-400">ขั้น ${index + 1}: ${(step.ingredients || []).map(([name, amount]) => `${productionEscape(name)} × ${fmtNum(amount)}`).join(" · ")}</p>`).join("")}
      ${selecting ? `<button type="button" data-upgrade-select ${steps.length ? "" : "disabled"} class="mt-auto rounded-lg px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50 ${selectedIdsForUpgrade.has(product.id) ? "bg-indigo-600" : "bg-slate-700/60"}">${selectedIdsForUpgrade.has(product.id) ? "✓ เลือกแล้ว" : steps.length ? "เลือกอัปเกรด" : "ยังไม่มีสูตรอัปเกรด"}</button>` : `<div class="mt-auto flex items-end gap-2"><label class="min-w-0 flex-1 text-[11px] text-slate-400">ขั้นเป้าหมาย<select data-upgrade-card-level class="w-full mt-1 rounded-lg bg-slate-900/70 border border-slate-700 px-2 py-2 text-xs"><option value="0">งานทั่วไป</option>${steps.map((_, index) => `<option value="${index + 1}">ขั้น ${index + 1}</option>`).join("")}</select></label><button type="button" data-upgrade-add class="min-h-10 rounded-lg bg-emerald-500/15 px-3 text-xs text-emerald-300 hover:bg-emerald-500/25" aria-label="เพิ่ม ${productionEscape(product.name)} ลงตะกร้า">🛒+</button><button type="button" data-upgrade-edit class="min-h-10 rounded-lg bg-slate-700/60 px-3 text-xs hover:bg-slate-700">✏️</button></div>`}
    </article>`;
  }).join("");
  if (products.length) {
    const selected = products.find(product => product.id === selectedProductId) || products[0];
    select.value = selected.id;
    document.getElementById("upgrade-unit-price").value = productionUnitPrice(selected).toFixed(2);
    const selectedLevel = Number(levelSelect.value);
    levelSelect.innerHTML = `<option value="0">งานอัปเกรดทั่วไป</option>${(selected.upgradeSteps || []).map((step, index) => `<option value="${index + 1}">อัปเกรดถึงขั้น ${index + 1}</option>`).join("")}`;
    levelSelect.value = selectedLevel > 0 && selectedLevel <= (selected.upgradeSteps || []).length ? String(selectedLevel) : (selected.upgradeSteps?.length ? "1" : "0");
  }
  renderUpgradeMaterialPreview();
}

function renderUpgradeMaterialPreview() {
  const preview = document.getElementById("upgrade-material-preview");
  const product = state.products.find(item => item.id === document.getElementById("upgrade-product-select")?.value);
  const level = Number(document.getElementById("upgrade-level-select")?.value) || 0;
  const quantity = Math.max(1, Math.floor(Number(document.getElementById("upgrade-quantity")?.value) || 1));
  if (!preview) return;
  const requirements = level && product ? upgradeStepRequirements(product, level, quantity) : [];
  preview.textContent = requirements.length
    ? `วัตถุดิบสำหรับ ${quantity} งาน: ${requirements.map(item => `${item.name} ${fmtNum(item.required)} (มี ${fmtNum(item.available)})`).join(" · ")}`
    : level ? "สูตรขั้นนี้ยังไม่มีวัตถุดิบที่กำหนด" : "งานทั่วไปไม่หักวัตถุดิบ";
}

document.addEventListener("DOMContentLoaded", () => {
  const addDialog = document.getElementById("production-cart-add-dialog");
  addDialog?.addEventListener("click", event => {
    const tab = event.target.closest("[data-cart-add-mode]");
    if (tab) setProductionCartAddMode(tab.dataset.cartAddMode);
    if (event.target === addDialog) addDialog.close();
    if (event.target.closest("[data-cart-add-close]")) addDialog.close();
  });
  addDialog?.querySelector("[role='tablist']")?.addEventListener("keydown", event => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const tabs = [...addDialog.querySelectorAll("[data-cart-add-mode]")];
    const currentIndex = tabs.indexOf(document.activeElement);
    const nextIndex = event.key === "Home" ? 0
      : event.key === "End" ? tabs.length - 1
        : (currentIndex + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length;
    tabs[nextIndex].focus();
    setProductionCartAddMode(tabs[nextIndex].dataset.cartAddMode);
  });
  addDialog?.addEventListener("input", updateProductionCartAddPreview);
  addDialog?.addEventListener("submit", event => {
    event.preventDefault();
    const product = state.products.find(item => item.id === productionCartAddContext?.refId);
    if (!product) {
      toast(t("production_cart_add_unavailable"), "error");
      return;
    }
    const quantity = productionCartAddMode === "amount"
      ? productionCartQuantityForAmount(document.getElementById("production-cart-add-amount").value, productionUnitPrice(product))
      : Number(document.getElementById("production-cart-add-quantity").value);
    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      updateProductionCartAddPreview();
      return;
    }
    if (addToCart("product", product.id, quantity)) addDialog.close();
  });
  addDialog?.addEventListener("close", () => { productionCartAddContext = null; });
  const cartToggle = document.getElementById("production-cart-toggle");
  const cartDialog = document.getElementById("production-cart-panel");
  cartToggle?.addEventListener("click", () => setProductionCartDialogOpen(cartToggle.getAttribute("aria-expanded") !== "true"));
  document.getElementById("production-cart-close")?.addEventListener("click", () => cartDialog?.close());
  cartDialog?.addEventListener("click", event => {
    if (event.target === cartDialog) cartDialog.close();
  });
  cartDialog?.addEventListener("close", () => {
    cartToggle?.setAttribute("aria-expanded", "false");
    cartToggle?.focus();
  });
  document.getElementById("production-cart-lines")?.addEventListener("input", event => {
    const article = event.target.closest("[data-cart-line]");
    const item = state.cart.find(line => line.id === article?.dataset.cartLine);
    if (!item) return;
    if (event.target.matches("[data-cart-quantity]")) item.quantity = Number(event.target.value);
    const subtotal = productionCartSubtotal(item.quantity, item.unitPrice);
    article.querySelector("[data-cart-subtotal]").textContent = fmtBaht(subtotal);
    if (item.type === "craft" || item.type === "upgrade") {
      const requirements = item.type === "craft" ? cartCraftMaterials(item) : cartUpgradeMaterials(item);
      const materialsText = requirements.map(material => `${productionEscape(material.name)} −${fmtNum(material.required)} (มี ${fmtNum(material.available)})`).join(" · ");
      const materialsLine = article.querySelector("p.mt-1");
      if (materialsLine) materialsLine.textContent = materialsText;
    }
    refreshCartTotals();
    updateProductionCartFeedback();
    saveState();
  });
  document.getElementById("production-cart-lines")?.addEventListener("click", event => {
    const button = event.target.closest("[data-cart-remove]");
    if (!button) return;
    const article = button.closest("[data-cart-line]");
    state.cart = state.cart.filter(item => item.id !== article.dataset.cartLine);
    saveState();
    renderProductionCart();
  });
  document.getElementById("production-cart-checkout")?.addEventListener("click", checkoutProductionCart);
  const cartDatetime = document.getElementById("production-cart-datetime");
  cartDatetime?.addEventListener("input", updateProductionCartFeedback);
  document.getElementById("production-cart-datetime-now")?.addEventListener("click", () => {
    if (!cartDatetime) return;
    cartDatetime.value = APP_TIME.dateTimeInput();
    cartDatetime.dispatchEvent(new Event("input", { bubbles: true }));
  });
  document.getElementById("upgrade-product-select")?.addEventListener("change", renderUpgradeProductOptions);
  document.getElementById("upgrade-level-select")?.addEventListener("change", renderUpgradeMaterialPreview);
  document.getElementById("upgrade-quantity")?.addEventListener("input", renderUpgradeMaterialPreview);
  document.getElementById("upgrade-services-grid")?.addEventListener("click", event => {
    const card = event.target.closest("[data-upgrade-product]");
    if (!card) return;
    const productId = card.dataset.upgradeProduct;
    if (event.target.closest("[data-upgrade-select]")) {
      if (typeof toggleSelectItem === "function") toggleSelectItem(productId);
      renderUpgradeProductOptions();
    } else if (event.target.closest("[data-upgrade-add]")) {
      const product = state.products.find(entry => entry.id === productId);
      if (!product) return;
      const quantityInput = document.getElementById("upgrade-quantity");
      const priceInput = document.getElementById("upgrade-unit-price");
      const sameFormProduct = document.getElementById("upgrade-product-select").value === product.id;
      const quantity = sameFormProduct ? Number(quantityInput.value) : 1;
      const unitPrice = sameFormProduct ? Number(priceInput.value) : productionUnitPrice(product);
      const level = Number(card.querySelector("[data-upgrade-card-level]")?.value) || 0;
      addToCart("upgrade", product.id, quantity, unitPrice, null, level);
    } else if (event.target.closest("[data-upgrade-edit]")) {
      if (typeof openEditProductModal === "function") openEditProductModal(productId);
    }
  });
  document.getElementById("upgrade-cart-form")?.addEventListener("submit", event => {
    event.preventDefault();
    const quantity = Math.floor(Number(document.getElementById("upgrade-quantity").value));
    const price = Number(document.getElementById("upgrade-unit-price").value);
    const level = Number(document.getElementById("upgrade-level-select").value);
    if (!Number.isFinite(quantity) || quantity < 1 || !Number.isFinite(price) || price < 0) {
      toast("ตรวจสอบจำนวนและราคาอัปเกรด", "error");
      return;
    }
    addToCart("upgrade", document.getElementById("upgrade-product-select").value, quantity, price, null, level);
  });
});
