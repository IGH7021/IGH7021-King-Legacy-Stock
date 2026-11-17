let productFilters = { search: "", status: "all", category: "all", rarity: "all" };
let editingProductId = null;
let restockProductId = null;
let selectMode = false;
let selectedIds = new Set();

function addProductActivity(action, product, sub = "") {
  if (!Array.isArray(state.activityLog)) state.activityLog = [];
  state.activityLog.unshift({
    id: genId("activity"),
    type: "product",
    action,
    text: t(`activity_product_${action}`, { name: product.name }),
    sub,
    ts: Date.now(),
  });
  state.activityLog = state.activityLog.slice(0, 100);
}

function summarizeProductChanges(previous, product) {
  const changes = [];
  if (previous.name !== product.name) changes.push(`Name: ${previous.name} -> ${product.name}`);
  if (previous.category !== product.category) changes.push(`Category: ${previous.category} -> ${product.category}`);
  if (previous.tradeability !== product.tradeability) changes.push(`Tradeability: ${previous.tradeability} -> ${product.tradeability}`);
  if (previous.stock !== product.stock) changes.push(`Stock: ${fmtNum(previous.stock)} -> ${fmtNum(product.stock)}`);
  if (previous.unitsPerBaht !== product.unitsPerBaht) changes.push("Price rate changed");
  ["gift", "trade"].forEach(method => {
    const before = previous.gamePass?.[method];
    const after = product.gamePass?.[method];
    if (!before && !after) return;
    if (before?.price !== after?.price) changes.push(`${method} price changed`);
    if (before?.stock !== after?.stock) changes.push(`${method} stock changed`);
  });
  return changes.join(" · ") || t("activity_product_details_updated");
}

function isGamePassProduct(product) { return product?.category === "Game Pass"; }
function gamePassRemaining(product, method) { return GAME_PASS.remaining(product, method); }
function gamePassRemainingLabel(product, method) {
  const value = gamePassRemaining(product, method);
  return value === Infinity ? t("gamepass_unlimited") : fmtNum(value);
}
function remaining(p) {
  if (isGamePassProduct(p)) {
    return ["gift", "trade"].reduce((total, method) => {
      const available = gamePassRemaining(p, method);
      return total + (Number.isFinite(available) ? available : 0);
    }, 0);
  }
  return Math.max(0, p.stock - p.sold);
}
function stockStatus(p) {
  if (isGamePassProduct(p)) {
    const available = ["gift", "trade"].map(method => gamePassRemaining(p, method));
    if (available.some(value => value === Infinity || value > state.settings.stockAlert)) return "instock";
    if (available.some(value => value > 0)) return "low";
    return "out";
  }
  const r = remaining(p);
  if (r <= 0) return "out";
  if (r <= state.settings.stockAlert) return "low";
  return "instock";
}
function stockStatusLabel(s) {
  if (s === "out") return t("status_out");
  if (s === "low") return t("status_low");
  return t("status_instock");
}
function statusBadgeClass(s) {
  if (s === "out") return "bg-rose-500/15 text-rose-300 border-rose-500/30";
  if (s === "low") return "bg-amber-500/15 text-amber-300 border-amber-500/30";
  return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
}
function rarityLabel(r) { return t("rarity_" + (r || "none")); }
function rarityBadgeClass(r) { return RARITY_COLORS[r] || RARITY_COLORS.none; }
function tradeabilityLabel(value) {
  const key = value === "craft-only" ? "tradeability_badge_craft" : value === "independent" ? "tradeability_badge_independent" : "tradeability_badge_tradable";
  return t(key);
}

function productImg(p) {
  if (p.image) return `<img src="${escapeHtml(p.image)}" loading="lazy" decoding="async" class="w-full h-full object-cover" alt="${escapeHtml(p.name)}">`;
  const icon = CATEGORY_ICONS[p.category] || "📦";
  return `<div class="w-full h-full flex items-center justify-center text-4xl">${icon}</div>`;
}

function rateLabel(p) {
  const r = p.unitsPerBaht || 1;
  if (r >= 1) return t("rate_pieces_per_baht", { n: fmtNum(Math.round(r)) });
  return t("rate_baht_per_piece", { n: fmtNum(Math.round(1/r)) });
}

function productCard(p) {
  const rem = remaining(p);
  const isGamePass = isGamePassProduct(p);
  const pct = p.stock > 0 ? Math.min(100, Math.round((p.sold / p.stock) * 100)) : 0;
  const status = stockStatus(p);
  const isSelected = selectedIds.has(p.id);
  const rarity = p.rarity || "none";
  return `
  <div class="glass-card rounded-2xl overflow-hidden flex flex-col ${isSelected ? "ring-2 ring-indigo-500" : ""}" data-id="${escapeHtml(p.id)}">
    <div class="h-32 bg-slate-800/60 relative ${selectMode ? "cursor-pointer" : ""}" ${selectMode ? 'data-action="toggle-select"' : ""}>
      ${productImg(p)}
      ${selectMode
        ? `<span class="absolute top-2 left-2 w-6 h-6 rounded-md flex items-center justify-center text-sm border-2 ${isSelected ? "bg-indigo-500 border-indigo-500" : "bg-slate-900/60 border-slate-400"}">${isSelected ? "✓" : ""}</span>`
        : ""}
      <span class="absolute top-2 right-2 text-[11px] px-2 py-0.5 rounded-full border ${statusBadgeClass(status)}">${stockStatusLabel(status)}</span>
      ${rarity !== "none" ? `<span class="absolute bottom-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${rarityBadgeClass(rarity)}">${rarityLabel(rarity)}</span>` : ""}
    </div>
    <div class="p-3 flex-1 flex flex-col gap-1.5">
      <div class="flex items-center justify-between gap-2">
        <h4 class="font-semibold text-sm truncate">${escapeHtml(p.name)}</h4>
      </div>
      <span class="text-[11px] w-fit px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">${escapeHtml(p.category)}</span>
      ${!isGamePass ? `<span class="text-[10px] w-fit px-2 py-0.5 rounded-full border ${p.tradeability === "craft-only" ? "border-amber-500/30 bg-amber-500/10 text-amber-300" : p.tradeability === "independent" ? "border-slate-500/40 bg-slate-500/10 text-slate-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"}">${tradeabilityLabel(p.tradeability)}</span>` : ""}
      ${isGamePass ? `
        <div class="grid grid-cols-2 gap-2 mt-1 text-[11px]">
          ${["gift", "trade"].map(method => `<div class="rounded-lg bg-slate-800/40 px-2 py-1.5"><div class="flex justify-between gap-1"><span class="font-semibold ${method === "gift" ? "text-amber-200" : "text-sky-200"}">${t(`gamepass_${method}`)}</span><span class="text-slate-200">${fmtBaht(p.gamePass?.[method]?.price || 0)}</span></div><p class="text-slate-400 mt-0.5">${t("label_remaining_short")} ${gamePassRemainingLabel(p, method)}</p></div>`).join("")}
        </div>
        <div class="text-[11px] text-slate-400">${t("sold_label")} ${fmtNum(p.sold || 0)}</div>
      ` : `
        <div class="text-xs text-slate-400 mt-1">${t("remaining_label")} <b class="text-slate-200">${fmtNum(rem)}</b> ${t("pieces_unit")} • ${t("sold_label")} ${fmtNum(p.sold)}</div>
        <div class="text-xs text-slate-400">${rateLabel(p)}</div>
        <div class="w-full h-1.5 bg-slate-700/50 rounded-full overflow-hidden mt-1">
          <div class="h-full bg-gradient-to-r from-indigo-500 to-pink-500" style="width:${pct}%"></div>
        </div>
      `}
      ${selectMode ? `
      <button data-action="toggle-select" class="mt-2 text-xs font-medium py-1.5 rounded-lg ${isSelected ? "bg-indigo-600" : "bg-slate-700/60 hover:bg-slate-700"}">${isSelected ? t("select_btn_selected") : t("select_btn_default")}</button>
      ` : `
      <div class="flex gap-1.5 mt-2">
        <button data-action="sell" class="flex-1 text-xs font-medium py-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-90">${t("btn_sell")}</button>
        ${isGamePass
          ? `<button data-action="gamepass-cart" data-method="gift" class="text-xs px-2 py-1.5 rounded-lg bg-amber-500/15 text-amber-200 hover:bg-amber-500/25" aria-label="${escapeHtml(t("gamepass_add_gift", { name: p.name }))}" title="${escapeHtml(t("gamepass_add_gift", { name: p.name }))}">🎁+</button><button data-action="gamepass-cart" data-method="trade" class="text-xs px-2 py-1.5 rounded-lg bg-sky-500/15 text-sky-200 hover:bg-sky-500/25" aria-label="${escapeHtml(t("gamepass_add_trade", { name: p.name }))}" title="${escapeHtml(t("gamepass_add_trade", { name: p.name }))}">🔁+</button>`
          : `<button data-action="cart" class="text-xs px-2 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25" aria-label="Add ${escapeHtml(p.name)} to cart" title="Add to cart">🛒+</button><button data-action="restock" class="text-xs px-2 py-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700" aria-label="${t('aria_restock')}">📦</button>`}
        <button data-action="edit" class="text-xs px-2 py-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700" aria-label="${t('aria_edit')}">✏️</button>
        <button data-action="delete" class="text-xs px-2 py-1.5 rounded-lg bg-slate-700/60 hover:bg-rose-600/70" aria-label="${t('aria_delete')}">🗑️</button>
      </div>
      `}
    </div>
  </div>`;
}

function getFilteredProducts() {
  const q = productFilters.search.trim().toLowerCase();
  const filtered = state.products.filter(p => {
    if (q && !(p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))) return false;
    if (productFilters.category !== "all" && p.category !== productFilters.category) return false;
    if (productFilters.status !== "all" && stockStatus(p) !== productFilters.status) return false;
    if (productFilters.rarity !== "all" && (p.rarity || "none") !== productFilters.rarity) return false;
    return true;
  });

  // Keep product groups consistent with the crafting and farming pages.
  filtered.sort((a, b) => {
    const categoryDifference = categorySortIndex(a.category) - categorySortIndex(b.category);
    if (categoryDifference !== 0) return categoryDifference;
    const ra = RARITY_ORDER.indexOf(a.rarity || "none");
    const rb = RARITY_ORDER.indexOf(b.rarity || "none");
    if (ra !== rb) return ra - rb;
    const stockDifference = remaining(b) - remaining(a);
    if (stockDifference !== 0) return stockDifference;
    return (a.name || "").localeCompare(b.name || "");
  });

  return filtered;
}

function renderProducts() {
  const grid = document.getElementById("products-grid");
  updateStatusFilterButtons();
  const list = getFilteredProducts();
  if (list.length === 0) {
    grid.innerHTML = `<div class="col-span-full flex flex-col items-center justify-center py-16 text-slate-400">
      <div class="text-5xl mb-3">📦</div>
      <p class="mb-3">${state.products.length === 0 ? t("empty_no_products") : t("empty_no_search_result")}</p>
      ${state.products.length === 0 ? `<button onclick="openAddProductModal()" class="btn-primary px-4 py-2 rounded-xl text-sm">${t("empty_add_first")}</button>` : ""}
    </div>`;
    return;
  }
  grid.innerHTML = list.map(productCard).join("");
  renderCategoryOptions();
}

function updateStatusFilterButtons() {
  document.querySelectorAll("[data-status-filter]").forEach(button => {
    button.classList.toggle("status-chip-active", button.dataset.statusFilter === productFilters.status);
  });
}

function renderCategoryOptions() {
  const cats = state.settings.categories;
  document.querySelectorAll(".category-filter-select").forEach(sel => {
    const cur = sel.value;
    sel.innerHTML = `<option value="all">${t("filter_all_category")}</option>` + cats.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
    if (cats.includes(cur)) sel.value = cur;
  });
  document.querySelectorAll(".product-category-select").forEach(pc => {
    pc.innerHTML = cats.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  });
  document.querySelectorAll(".rarity-select-input").forEach(sel => {
    const cur = sel.value;
    sel.innerHTML = RARITY_ORDER.map(r => `<option value="${r}">${rarityLabel(r)}</option>`).join("");
    if (cur) sel.value = cur;
  });
  const rf = document.getElementById("rarity-filter");
  if (rf) {
    const cur = rf.value;
    rf.innerHTML = `<option value="all">${t("filter_all_rarity")}</option>` + RARITY_ORDER.map(r => `<option value="${r}">${rarityLabel(r)}</option>`).join("");
    rf.value = cur || "all";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  enhanceCustomSelects();
  document.getElementById("products-grid").addEventListener("click", (e) => {
    const card = e.target.closest("[data-id]");
    if (!card) return;
    const id = card.dataset.id;
    const action = e.target.closest("[data-action]")?.dataset.action;
    const p = state.products.find(x => x.id === id);
    if (!p) return;
    if (action === "sell") openSaleModal(p.id);
    else if (action === "cart") addToCart("product", p.id);
    else if (action === "gamepass-cart") addToCart("gamepass", p.id, 1, null, e.target.closest("[data-action]")?.dataset.method);
    else if (action === "edit") openEditProductModal(p.id);
    else if (action === "delete") deleteProduct(p.id);
    else if (action === "restock") openRestockModal(p.id);
    else if (action === "toggle-select") toggleSelectItem(p.id);
  });

  document.getElementById("toggle-select-mode-btn").addEventListener("click", toggleSelectMode);
  document.getElementById("bulk-select-all-btn").addEventListener("click", selectAllVisible);
  document.getElementById("bulk-clear-btn").addEventListener("click", clearSelection);
  document.getElementById("bulk-delete-btn").addEventListener("click", deleteSelectedProducts);
  document.getElementById("bulk-edit-btn").addEventListener("click", openBulkEditModal);

  const searchInput = document.getElementById("product-search");
  searchInput.addEventListener("input", debounce((e) => {
    productFilters.search = e.target.value;
    renderProducts();
  }, 150));

  document.querySelectorAll("[data-status-filter]").forEach(button => button.addEventListener("click", () => {
    productFilters.status = button.dataset.statusFilter;
    renderProducts();
  }));
  document.getElementById("rarity-filter").addEventListener("change", (e) => {
    productFilters.rarity = e.target.value; renderProducts();
  });
  document.querySelectorAll(".category-filter-select").forEach(sel => {
    sel.addEventListener("change", (e) => { productFilters.category = e.target.value; renderProducts(); });
  });

  document.getElementById("add-entry-btn").addEventListener("click", () => document.getElementById("add-entry-menu").classList.toggle("hidden"));
  document.getElementById("add-product-menu-btn").addEventListener("click", () => { document.getElementById("add-entry-menu").classList.add("hidden"); openAddProductModal(); });
  document.getElementById("add-farm-menu-btn").addEventListener("click", () => { document.getElementById("add-entry-menu").classList.add("hidden"); openFarmServiceModal(); });
  document.getElementById("product-form").addEventListener("submit", handleProductFormSubmit);
  document.getElementById("product-category").addEventListener("change", syncProductCategoryFields);
  document.getElementById("product-image-input").addEventListener("change", (e) => {
    const f = e.target.files[0];
    if (f) applyImageToForm(f);
  });
  document.getElementById("restock-form").addEventListener("submit", handleRestockSubmit);
  document.getElementById("bulk-edit-form").addEventListener("submit", handleBulkEditSubmit);

  bindImageDropzone();
});

/* ---------- Drag & Drop Image Upload ---------- */
function applyImageToForm(file) {
  handleImageFile(file, (dataUrl) => {
    document.getElementById("product-image-preview").src = dataUrl;
    document.getElementById("product-image-preview-wrap").classList.remove("hidden");
    document.getElementById("product-dropzone-placeholder").classList.add("hidden");
    document.getElementById("product-form").dataset.image = dataUrl;
  });
}

function bindImageDropzone() {
  const zone = document.getElementById("product-image-dropzone");
  const input = document.getElementById("product-image-input");
  let dragCounter = 0;

  zone.addEventListener("click", () => input.click());

  ["dragenter", "dragover"].forEach(evt => {
    zone.addEventListener(evt, (e) => {
      e.preventDefault(); e.stopPropagation();
      dragCounter++;
      zone.classList.add("dropzone-active");
    });
  });
  ["dragleave", "dragend"].forEach(evt => {
    zone.addEventListener(evt, (e) => {
      e.preventDefault(); e.stopPropagation();
      dragCounter = Math.max(0, dragCounter - 1);
      if (dragCounter === 0) zone.classList.remove("dropzone-active");
    });
  });
  zone.addEventListener("drop", (e) => {
    e.preventDefault(); e.stopPropagation();
    dragCounter = 0;
    zone.classList.remove("dropzone-active");
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) applyImageToForm(file);
  });

  const modal = document.getElementById("product-modal");
  ["dragover", "drop"].forEach(evt => {
    modal.addEventListener(evt, (e) => { e.preventDefault(); });
  });
  modal.addEventListener("drop", (e) => {
    if (e.target.closest("#product-image-dropzone")) return;
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) applyImageToForm(file);
  });
}

/* ---------- Bulk select / delete / edit ---------- */
function toggleSelectMode() {
  selectMode = !selectMode;
  selectedIds.clear();
  document.getElementById("bulk-toolbar").classList.toggle("hidden", !selectMode);
  document.getElementById("toggle-select-mode-btn").textContent = selectMode ? t("select_mode_btn_off") : t("select_mode_btn_on");
  document.getElementById("add-entry-btn").classList.toggle("hidden", selectMode);
  updateBulkCount();
  renderProducts();
}

function toggleSelectItem(id) {
  if (selectedIds.has(id)) selectedIds.delete(id); else selectedIds.add(id);
  updateBulkCount();
  renderProducts();
}

function selectAllVisible() {
  getFilteredProducts().forEach(p => selectedIds.add(p.id));
  updateBulkCount();
  renderProducts();
}

function clearSelection() {
  selectedIds.clear();
  updateBulkCount();
  renderProducts();
}

function updateBulkCount() {
  const n = selectedIds.size;
  document.getElementById("bulk-selected-count").textContent = n;
  document.getElementById("bulk-edit-btn").disabled = n === 0;
  document.getElementById("bulk-delete-btn").disabled = n === 0;
}

function deleteSelectedProducts() {
  if (selectedIds.size === 0) { toast(t("toast_nothing_selected"), "error"); return; }
  const count = selectedIds.size;
  confirmDialog(t("confirm_delete_bulk", { count }), () => {
    state.products = state.products.filter(p => !selectedIds.has(p.id));
    selectedIds.clear();
    saveState();
    toggleSelectMode();
    renderDashboard();
    toast(t("toast_bulk_deleted", { count }));
  });
}

function openBulkEditModal() {
  if (selectedIds.size === 0) { toast(t("toast_nothing_selected"), "error"); return; }
  if (state.products.some(product => selectedIds.has(product.id) && isGamePassProduct(product))) {
    toast(t("bulk_edit_gamepass_unavailable"), "error");
    return;
  }
  document.getElementById("bulk-edit-form").reset();
  renderCategoryOptions();
  document.getElementById("bulk-edit-desc").textContent = t("bulk_edit_desc", { count: selectedIds.size });
  ["rate","stock","category","rarity"].forEach(f => {
    document.getElementById("bulk-fields-" + f).classList.add("hidden");
  });
  openModal("bulk-edit-modal");
}

document.addEventListener("DOMContentLoaded", () => {
  ["rate","stock","category","rarity"].forEach(f => {
    const cb = document.getElementById("bulk-toggle-" + f);
    if (cb) cb.addEventListener("change", () => {
      document.getElementById("bulk-fields-" + f).classList.toggle("hidden", !cb.checked);
    });
  });
});

function handleBulkEditSubmit(e) {
  e.preventDefault();
  const f = e.target;
  const applyRate = document.getElementById("bulk-toggle-rate").checked;
  const applyStock = document.getElementById("bulk-toggle-stock").checked;
  const applyCategory = document.getElementById("bulk-toggle-category").checked;
  const applyRarity = document.getElementById("bulk-toggle-rarity").checked;

  if (!applyRate && !applyStock && !applyCategory && !applyRarity) {
    toast(t("toast_bulk_no_fields"), "error");
    return;
  }

  let rate = null;
  if (applyRate) {
    const qty = Math.max(0.0001, parseFloat(f.bulkRateQty.value) || 1);
    const price = Math.max(0.0001, parseFloat(f.bulkRatePrice.value) || 1);
    rate = qty / price;
  }
  const stockMode = f.bulkStockMode.value;
  const stockValue = Math.max(0, parseInt(f.bulkStockValue.value) || 0);
  const category = applyCategory ? f.bulkCategory.value : null;
  const rarity = applyRarity ? f.bulkRarity.value : null;

  const btn = f.querySelector("button[type=submit]");
  const original = btn.innerHTML;
  btn.disabled = true; btn.innerHTML = `<span class="inline-flex items-center gap-2" role="status"><span class="spinner" aria-hidden="true"></span><span class="sr-only">${t("loading")}</span></span>`;

  setTimeout(() => {
    let count = 0;
    state.products.forEach(p => {
      if (!selectedIds.has(p.id)) return;
      if (applyRate) p.unitsPerBaht = rate;
      if (applyStock) {
        p.stock = stockMode === "add" ? p.stock + stockValue : stockValue;
      }
      if (applyCategory) p.category = category;
      if (applyRarity) p.rarity = rarity;
      count++;
    });
    if (count) {
      if (!Array.isArray(state.activityLog)) state.activityLog = [];
      const changes = [];
      if (applyRate) changes.push("price rate");
      if (applyStock) changes.push(stockMode === "add" ? `stock +${fmtNum(stockValue)}` : `stock set to ${fmtNum(stockValue)}`);
      if (applyCategory) changes.push("category");
      if (applyRarity) changes.push("rarity");
      state.activityLog.unshift({
        id: genId("activity"),
        type: "product",
        action: "bulk_updated",
        text: t("activity_products_bulk_updated", { count }),
        sub: changes.join(" · "),
        ts: Date.now(),
      });
      state.activityLog = state.activityLog.slice(0, 100);
    }
    saveState();
    selectedIds.clear();
    toggleSelectMode();
    renderDashboard();
    toast(t("toast_bulk_updated", { count }));
    btn.disabled = false; btn.innerHTML = original;
    closeModal("bulk-edit-modal");
  }, 250);
}

function openAddProductModal() {
  editingProductId = null;
  document.getElementById("product-modal-title").textContent = t("modal_add_product_title");
  document.getElementById("product-form").reset();
  document.getElementById("product-form").dataset.image = "";
  document.getElementById("product-form").dataset.gamePassInitialized = "";
  document.getElementById("product-image-preview-wrap").classList.add("hidden");
  document.getElementById("product-dropzone-placeholder").classList.remove("hidden");
  renderCategoryOptions();
  document.getElementById("product-form").rarity.value = "none";
  document.getElementById("product-form").tradeability.value = "tradable";
  syncCustomSelect(document.getElementById("product-form").tradeability);
  syncProductCategoryFields();
  openModal("product-modal");
}

function writeGamePassFormValues(form, variants) {
  form.giftPrice.value = variants.gift.price;
  form.giftStock.value = variants.gift.stock === null ? "" : variants.gift.stock;
  form.tradePrice.value = variants.trade.price;
  form.tradeStock.value = variants.trade.stock === null ? "" : variants.trade.stock;
}

function syncProductCategoryFields() {
  const form = document.getElementById("product-form");
  if (!form) return;
  const gamePassMode = form.category.value === "Game Pass";
  document.getElementById("product-standard-stock-fields").classList.toggle("hidden", gamePassMode);
  document.getElementById("product-game-pass-fields").classList.toggle("hidden", !gamePassMode);
  document.getElementById("product-tradeability-field").classList.toggle("hidden", gamePassMode);
  form.stock.required = !gamePassMode;
  form.giftPrice.required = gamePassMode;
  form.tradePrice.required = gamePassMode;
  if (gamePassMode) {
    form.tradeability.value = "tradable";
    if (!form.dataset.gamePassInitialized) {
      const currentProduct = editingProductId ? state.products.find(product => product.id === editingProductId) : null;
      if (currentProduct) writeGamePassFormValues(form, currentProduct.gamePass || GAME_PASS.migrateLegacyProduct(currentProduct));
      form.dataset.gamePassInitialized = "true";
    }
  }
}

function openEditProductModal(id) {
  const p = state.products.find(x => x.id === id);
  if (!p) return;
  editingProductId = id;
  document.getElementById("product-modal-title").textContent = t("modal_edit_product_title");
  const f = document.getElementById("product-form");
  f.name.value = p.name;
  renderCategoryOptions();
  f.category.value = p.category;
  f.rarity.value = p.rarity || "none";
  f.tradeability.value = p.tradeability || "tradable";
  syncCustomSelect(f.tradeability);
  f.stock.value = p.stock;
  f.rateQty.value = p.unitsPerBaht >= 1 ? Math.round(p.unitsPerBaht) : 1;
  f.ratePrice.value = p.unitsPerBaht >= 1 ? 1 : Math.round(1/p.unitsPerBaht);
  f.description.value = p.description || "";
  f.dataset.gamePassInitialized = "";
  if (isGamePassProduct(p)) {
    writeGamePassFormValues(f, p.gamePass || GAME_PASS.migrateLegacyProduct(p));
    f.dataset.gamePassInitialized = "true";
  }
  f.dataset.image = p.image || "";
  if (p.image) {
    document.getElementById("product-image-preview").src = p.image;
    document.getElementById("product-image-preview-wrap").classList.remove("hidden");
    document.getElementById("product-dropzone-placeholder").classList.add("hidden");
  } else {
    document.getElementById("product-image-preview-wrap").classList.add("hidden");
    document.getElementById("product-dropzone-placeholder").classList.remove("hidden");
  }
  syncProductCategoryFields();
  openModal("product-modal");
}

function handleProductFormSubmit(e) {
  e.preventDefault();
  const f = e.target;
  const submitBtn = f.querySelector("button[type=submit]");
  const originalLabel = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="inline-flex items-center gap-2" role="status"><span class="spinner" aria-hidden="true"></span><span class="sr-only">${t("loading")}</span></span>`;

  setTimeout(() => {
    const name = f.name.value.trim();
    const category = f.category.value;
    const rarity = f.rarity.value;
    const tradeability = f.tradeability.value;
    const stock = Math.max(0, parseInt(f.stock.value) || 0);
    const qty = Math.max(0.0001, parseFloat(f.rateQty.value) || 1);
    const price = Math.max(0.0001, parseFloat(f.ratePrice.value) || 1);
    const rate = qty / price;
    const description = f.description.value.trim();
    const image = f.dataset.image || null;

    if (!name) { toast(t("toast_name_required"), "error"); submitBtn.disabled=false; submitBtn.innerHTML=originalLabel; return; }
    let gamePass = null;
    if (category === "Game Pass") {
      const parseStock = input => input.value.trim() === "" ? null : Number(input.value);
      const giftStock = parseStock(f.giftStock);
      const tradeStock = parseStock(f.tradeStock);
      const giftPrice = Number(f.giftPrice.value);
      const tradePrice = Number(f.tradePrice.value);
      if ([f.giftPrice.value, f.tradePrice.value].some(value => value.trim() === "")
        || ![giftPrice, tradePrice].every(value => Number.isFinite(value) && value >= 0)
        || [giftStock, tradeStock].some(value => value !== null && (!Number.isSafeInteger(value) || value < 0))) {
        toast(t("gamepass_invalid_values"), "error");
        submitBtn.disabled = false; submitBtn.innerHTML = originalLabel; return;
      }
      const currentProduct = editingProductId ? state.products.find(product => product.id === editingProductId) : null;
      const oldPass = currentProduct ? (currentProduct.gamePass || GAME_PASS.migrateLegacyProduct(currentProduct)) : null;
      gamePass = {
        gift: { price: giftPrice, stock: giftStock, sold: oldPass?.gift?.sold || 0 },
        trade: { price: tradePrice, stock: tradeStock, sold: oldPass?.trade?.sold || 0 },
      };
    }

    if (editingProductId) {
      const p = state.products.find(x => x.id === editingProductId);
      const previous = {
        name: p.name, category: p.category, tradeability: p.tradeability,
        stock: p.stock, unitsPerBaht: p.unitsPerBaht, gamePass: p.gamePass,
      };
      Object.assign(p, { name, category, rarity, tradeability: category === "Game Pass" ? "tradable" : tradeability, unitsPerBaht: rate, stock: category === "Game Pass" ? 0 : stock, description, image });
      if (gamePass) p.gamePass = gamePass;
      includeExistingRecipeForProduct(p);
      addProductActivity("updated", p, summarizeProductChanges(previous, p));
      toast(t("toast_product_updated"));
    } else {
      const product = {
        id: genId("p"), name, category, rarity, tradeability: category === "Game Pass" ? "tradable" : tradeability, source: "custom", image, stock: category === "Game Pass" ? 0 : stock, sold: 0,
        unitsPerBaht: rate, description, createdAt: Date.now(), restockHistory: [], ...(gamePass ? { gamePass } : {}),
      };
      state.products.push(product);
      includeExistingRecipeForProduct(product);
      addProductActivity("created", product);
      toast(t("toast_product_added"));
    }
    saveState();
    renderProducts();
    renderDashboard();
    submitBtn.disabled = false; submitBtn.innerHTML = originalLabel;
    closeModal("product-modal");
  }, 250);
}

function includeExistingRecipeForProduct(product) {
  if (!product || product.tradeability === "tradable") return false;
  const recipe = RECIPES.find(item => item.name.toLowerCase() === product.name.toLowerCase());
  if (!recipe || state.recipes.some(item => item.name.toLowerCase() === recipe.name.toLowerCase())) return false;
  state.recipes.unshift({ ...recipe, ingredients: recipe.ingredients.map(item => [...item]) });
  return true;
}

function deleteProduct(id) {
  const p = state.products.find(x => x.id === id);
  if (!p) return;
  confirmDialog(t("confirm_delete_product", { name: p.name }), () => {
    addProductActivity("deleted", p);
    state.products = state.products.filter(x => x.id !== id);
    saveState();
    renderProducts();
    renderDashboard();
    toast(t("toast_product_deleted"));
  });
}

function openRestockModal(id) {
  restockProductId = id;
  const p = state.products.find(x => x.id === id);
  document.getElementById("restock-product-name").textContent = p.name;
  document.getElementById("restock-current").textContent = fmtNum(p.stock);
  document.getElementById("restock-form").reset();
  openModal("restock-modal");
}

function handleRestockSubmit(e) {
  e.preventDefault();
  const amount = parseInt(e.target.amount.value);
  if (!amount || amount <= 0) { toast(t("toast_restock_invalid"), "error"); return; }
  const p = state.products.find(x => x.id === restockProductId);
  const old = p.stock;
  p.stock += amount;
  p.restockHistory = p.restockHistory || [];
  p.restockHistory.push({ date: Date.now(), amount, from: old, to: p.stock });
  addProductActivity("restocked", p, `${fmtNum(old)} -> ${fmtNum(p.stock)} (+${fmtNum(amount)})`);
  saveState();
  renderProducts();
  renderDashboard();
  toast(t("toast_restocked", { name: p.name, amount: fmtNum(amount) }));
  closeModal("restock-modal");
}
