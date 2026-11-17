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

function productionCartRate(quantity, subtotal) {
  return subtotal > 0 ? quantity / subtotal : 0;
}

function productionCartItem(type, referenceId, quantity = 1, unitPrice = null, deliveryMethod = null) {
  if (type === "product") {
    const product = state.products.find(item => item.id === referenceId);
    if (!product || isGamePassProduct(product)) return null;
    return { type, refId: product.id, name: product.name, quantity, unitPrice: unitPrice ?? productionUnitPrice(product) };
  }
  if (type === "gamepass") {
    const product = state.products.find(item => item.id === referenceId);
    const variant = product?.gamePass?.[deliveryMethod];
    if (!isGamePassProduct(product) || !variant || !["gift", "trade"].includes(deliveryMethod)) return null;
    return {
      type, refId: product.id, name: `${product.name} (${t(`gamepass_${deliveryMethod}`)})`,
      productName: product.name, deliveryMethod, quantity,
      unitPrice: unitPrice ?? variant.price,
    };
  }
  if (type === "farm") {
    const service = state.farmServices.find(item => item.id === referenceId);
    if (!service) return null;
    const price = service.pricingMode === "hour"
      ? Number(service.hourPrice || service.ratePrice) || 0
      : (Number(service.ratePrice) || 0) / (Number(service.rateQty || service.unitsPerBaht) || 1);
    return { type, refId: service.id, name: service.name, quantity, unitPrice: unitPrice ?? price, pricingMode: service.pricingMode || "unit" };
  }
  if (type === "craft") {
    const recipe = state.recipes.find(item => item.name === referenceId);
    if (!recipe || !recipeProduct(recipe)) return null;
    return { type, refId: recipe.name, name: recipe.name, quantity, unitPrice: unitPrice ?? recipeSalePrice(recipe) };
  }
  if (type === "upgrade") {
    const product = state.products.find(item => item.id === referenceId);
    if (!product || !["ดาบ", "ของแต่ง"].includes(product.category)) return null;
    return { type, refId: product.id, name: `${product.name} upgrade`, productName: product.name, quantity, unitPrice: unitPrice ?? 0 };
  }
  return null;
}

function addToCart(type, referenceId, quantity = 1, unitPrice = null, deliveryMethod = null) {
  const item = productionCartItem(type, referenceId, quantity, unitPrice, deliveryMethod);
  if (!item) {
    toast(t("production_cart_error_unsupported"), "error");
    return false;
  }
  if (item.type === "gamepass" && gamePassRemaining(state.products.find(product => product.id === item.refId), item.deliveryMethod) <= 0) {
    toast(t("toast_insufficient_stock"), "error");
    return false;
  }
  state.cart ||= [];
  const existing = state.cart.find(line => line.type === item.type && line.refId === item.refId
    && line.deliveryMethod === item.deliveryMethod && Number(line.unitPrice) === Number(item.unitPrice));
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

function cartCraftMaterials(item) {
  const recipe = state.recipes.find(entry => entry.name === item.refId);
  if (!recipe) return [];
  return recipeMaterialRequirements(recipe, Number(item.quantity) || 0);
}

function renderProductionCart() {
  const panel = document.getElementById("production-cart-panel");
  const lines = document.getElementById("production-cart-lines");
  if (!panel || !lines) return;
  state.cart = Array.isArray(state.cart) ? state.cart : [];
  document.getElementById("production-cart-count").textContent = String(state.cart.length);
  document.getElementById("production-cart-toggle").setAttribute("aria-label", t("production_cart_toggle_aria", { count: state.cart.length }));
  document.getElementById("production-cart-empty").classList.toggle("hidden", state.cart.length > 0);
  document.getElementById("production-cart-checkout").disabled = state.cart.length === 0;
  lines.innerHTML = state.cart.map(item => {
    const materials = item.type === "craft"
      ? `<p class="mt-1 text-[11px] ${cartCraftMaterials(item).some(material => material.required > material.available) ? "text-rose-300" : "text-slate-400"}">${cartCraftMaterials(item).map(material => `${productionEscape(material.name)} −${fmtNum(material.required)} (มี ${fmtNum(material.available)})`).join(" · ")}</p>`
      : "";
    return `<article class="rounded-xl border border-slate-700/60 bg-slate-800/35 p-3" data-cart-line="${productionEscape(item.id)}">
      <div class="grid md:grid-cols-[minmax(0,1fr)_120px_140px_auto] gap-2 items-center">
        <div class="min-w-0"><span class="text-[10px] uppercase tracking-wide text-slate-400">${cartItemLabel(item)}</span><p class="text-sm font-medium truncate">${productionEscape(item.name)}</p></div>
        <label class="text-[11px] text-slate-400">${t("production_cart_quantity")}<input data-cart-quantity type="number" min="${["product", "gamepass", "craft", "upgrade"].includes(item.type) ? "1" : "0.01"}" step="${["product", "gamepass", "craft", "upgrade"].includes(item.type) ? "1" : "any"}" value="${Number(item.quantity)}" class="w-full mt-1 rounded-lg bg-slate-900/70 border border-slate-700 px-2 py-1.5 text-sm"></label>
        <label class="text-[11px] text-slate-400">${t("production_cart_unit_price")}<input data-cart-price type="number" min="0" step="any" value="${String(Number(item.unitPrice))}" class="w-full mt-1 rounded-lg bg-slate-900/70 border border-slate-700 px-2 py-1.5 text-sm"></label>
        <div class="flex items-center justify-between gap-2"><strong data-cart-subtotal class="text-sm text-emerald-300">${fmtBaht(productionCartSubtotal(item.quantity, item.unitPrice))}</strong><button type="button" data-cart-remove class="text-slate-400 hover:text-rose-300 px-2 py-1" aria-label="${t("production_cart_remove")}" title="${t("production_cart_remove")}">×</button></div>
      </div>${materials}
    </article>`;
  }).join("");
  refreshCartTotals();
  updateProductionCartFeedback();
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
      const recipe = state.recipes.find(entry => entry.name === item.refId);
      if (!Number.isInteger(quantity) || !recipe || !recipeProduct(recipe)) return t("production_cart_error_recipe", { name: item.name });
      for (const material of recipeMaterialRequirements(recipe, quantity)) {
        const product = ingredientProduct(material.name);
        if (!product) return t("production_cart_error_material", { name: material.name });
        addDeduction(product, material.required);
      }
    } else if (item.type === "upgrade") {
      const product = state.products.find(entry => entry.id === item.refId);
      if (!Number.isInteger(quantity) || !product || !["ดาบ", "ของแต่ง"].includes(product.category)) return t("production_cart_error_upgrade", { name: item.name });
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
  const timestamp = Date.now();
  const orderId = genId("order");
  const customer = document.getElementById("production-cart-customer").value.trim();
  const note = document.getElementById("production-cart-note").value.trim();
  const orderLines = state.cart.map(item => ({
    type: item.type,
    referenceId: item.refId,
    name: item.name,
    ...(item.type === "gamepass" ? { deliveryMethod: item.deliveryMethod } : {}),
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
      const recipe = state.recipes.find(entry => entry.name === item.refId);
      const materials = recipeMaterialRequirements(recipe, line.quantity);
      materials.forEach(material => { ingredientProduct(material.name).stock -= material.required; });
      const output = recipeProduct(recipe);
      output.sold = Number(output.sold || 0) + line.quantity;
      output.crafted = Number(output.crafted || 0) + line.quantity;
      const materialNote = materials.map(material => `${material.name} -${fmtNum(material.required)}`).join(", ");
      state.sales.unshift({ id: genId("s"), productId: output.id, productName: output.name, quantity: line.quantity, money: line.subtotal, rate: productionCartRate(line.quantity, line.subtotal), date: timestamp, note: `คราฟ ${fmtNum(line.quantity)} ชุด • หักวัตถุดิบ: ${materialNote}${note ? ` • ${note}` : ""}`, source: "craft", orderId });
    } else {
      const product = state.products.find(entry => entry.id === item.refId);
      state.upgradeOrders.unshift({ id: genId("upgrade"), orderId, productId: product.id, productName: product.name, quantity: line.quantity, unitPrice: line.unitPrice, money: line.subtotal, customer, note, date: timestamp });
    }
  });
  state.orders.unshift({ id: orderId, date: timestamp, customer, note, total, status: "completed", lines: orderLines });
  addProductionActivity("order", `บันทึกออเดอร์ ${orderId}`, `${orderLines.length} รายการ • ${fmtBaht(total)}`, timestamp);
  state.cart = [];
  saveState();
  renderProductionCart();
  renderProducts();
  renderFarmServices();
  renderCrafting();
  renderUpgradeOrders();
  renderSalesHistory();
  renderDashboard();
  renderReports();
  toast(t("production_cart_saved"));
}

function renderUpgradeOrders() {
  const box = document.getElementById("upgrade-orders-list");
  if (!box) return;
  const orders = Array.isArray(state.upgradeOrders) ? state.upgradeOrders : [];
  box.innerHTML = orders.length ? orders.map(order => `<div class="glass-card rounded-xl p-3 flex items-center gap-3">
    <div class="w-10 h-10 rounded-lg bg-indigo-500/15 flex items-center justify-center">⬆️</div>
    <div class="flex-1 min-w-0"><div class="flex justify-between gap-2"><span class="font-medium text-sm truncate">${productionEscape(order.productName)} upgrade</span><span class="font-semibold text-sm text-emerald-300">${fmtBaht(order.money)}</span></div>
    <p class="text-xs text-slate-400">${fmtNum(order.quantity)} งาน • ${fmtDate(order.date)}${order.customer ? ` • ${productionEscape(order.customer)}` : ""}${order.note ? ` • ${productionEscape(order.note)}` : ""}</p></div></div>`).join("") : `<p class="text-xs text-slate-400 py-4 text-center">ยังไม่มีประวัติงานอัปเกรด</p>`;
}

function renderUpgradeProductOptions() {
  const select = document.getElementById("upgrade-product-select");
  const empty = document.getElementById("upgrade-product-empty");
  const form = document.getElementById("upgrade-cart-form");
  if (!select || !empty || !form) return;
  const products = state.products.filter(product => ["ดาบ", "ของแต่ง"].includes(product.category));
  select.innerHTML = products.map(product => `<option value="${productionEscape(product.id)}">${productionEscape(product.name)} · ${productionEscape(product.category)}</option>`).join("");
  empty.classList.toggle("hidden", products.length > 0);
  form.classList.toggle("hidden", products.length === 0);
  if (products.length) {
    const selected = products.find(product => product.id === select.value) || products[0];
    select.value = selected.id;
    document.getElementById("upgrade-unit-price").value = productionUnitPrice(selected).toFixed(2);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("production-cart-toggle")?.addEventListener("click", event => {
    const panel = document.getElementById("production-cart-panel");
    const expanded = event.currentTarget.getAttribute("aria-expanded") === "true";
    event.currentTarget.setAttribute("aria-expanded", String(!expanded));
    panel.classList.toggle("hidden", expanded);
    if (!expanded) renderProductionCart();
  });
  document.getElementById("production-cart-lines")?.addEventListener("input", event => {
    const article = event.target.closest("[data-cart-line]");
    const item = state.cart.find(line => line.id === article?.dataset.cartLine);
    if (!item) return;
    if (event.target.matches("[data-cart-quantity]")) item.quantity = Number(event.target.value);
    if (event.target.matches("[data-cart-price]")) item.unitPrice = Number(event.target.value);
    const subtotal = productionCartSubtotal(item.quantity, item.unitPrice);
    article.querySelector("[data-cart-subtotal]").textContent = fmtBaht(subtotal);
    if (item.type === "craft") {
      const materialsText = cartCraftMaterials(item).map(material => `${productionEscape(material.name)} −${fmtNum(material.required)} (มี ${fmtNum(material.available)})`).join(" · ");
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
  document.getElementById("upgrade-product-select")?.addEventListener("change", renderUpgradeProductOptions);
  document.getElementById("upgrade-cart-form")?.addEventListener("submit", event => {
    event.preventDefault();
    const quantity = Math.floor(Number(document.getElementById("upgrade-quantity").value));
    const price = Number(document.getElementById("upgrade-unit-price").value);
    if (!Number.isFinite(quantity) || quantity < 1 || !Number.isFinite(price) || price < 0) {
      toast("ตรวจสอบจำนวนและราคาอัปเกรด", "error");
      return;
    }
    addToCart("upgrade", document.getElementById("upgrade-product-select").value, quantity, price);
  });
});
