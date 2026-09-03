let productFilters = { search: "", status: "all", category: "all", rarity: "all" };
let editingProductId = null;
let restockProductId = null;
let selectMode = false;
let selectedIds = new Set();

function remaining(p) { return Math.max(0, p.stock - p.sold); }
function stockStatus(p) {
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

function productImg(p) {
  if (p.image) return `<img src="${p.image}" loading="lazy" decoding="async" class="w-full h-full object-cover" alt="${p.name}">`;
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
  const pct = p.stock > 0 ? Math.min(100, Math.round((p.sold / p.stock) * 100)) : 0;
  const status = stockStatus(p);
  const isSelected = selectedIds.has(p.id);
  const rarity = p.rarity || "none";
  return `
  <div class="glass-card rounded-2xl overflow-hidden flex flex-col ${isSelected ? "ring-2 ring-indigo-500" : ""}" data-id="${p.id}">
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
        <h4 class="font-semibold text-sm truncate">${p.name}</h4>
      </div>
      <span class="text-[11px] w-fit px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">${p.category}</span>
      <div class="text-xs text-slate-400 mt-1">${t("remaining_label")} <b class="text-slate-200">${fmtNum(rem)}</b> ${t("pieces_unit")} • ${t("sold_label")} ${fmtNum(p.sold)}</div>
      <div class="text-xs text-slate-400">${rateLabel(p)}</div>
      <div class="w-full h-1.5 bg-slate-700/50 rounded-full overflow-hidden mt-1">
        <div class="h-full bg-gradient-to-r from-indigo-500 to-pink-500" style="width:${pct}%"></div>
      </div>
      ${selectMode ? `
      <button data-action="toggle-select" class="mt-2 text-xs font-medium py-1.5 rounded-lg ${isSelected ? "bg-indigo-600" : "bg-slate-700/60 hover:bg-slate-700"}">${isSelected ? t("select_btn_selected") : t("select_btn_default")}</button>
      ` : `
      <div class="flex gap-1.5 mt-2">
        <button data-action="sell" class="flex-1 text-xs font-medium py-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-90">${t("btn_sell")}</button>
        <button data-action="restock" class="text-xs px-2 py-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700" aria-label="${t('aria_restock')}">📦</button>
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

  // Keep categories together, then sort by rarity before remaining stock.
  filtered.sort((a, b) => {
    const categoryOrder = state.settings.categories || [];
    const categoryA = categoryOrder.indexOf(a.category);
    const categoryB = categoryOrder.indexOf(b.category);
    const safeCategoryA = categoryA === -1 ? Number.MAX_SAFE_INTEGER : categoryA;
    const safeCategoryB = categoryB === -1 ? Number.MAX_SAFE_INTEGER : categoryB;
    if (safeCategoryA !== safeCategoryB) return safeCategoryA - safeCategoryB;
    const rarityA = RARITY_ORDER.indexOf(a.rarity || "none");
    const rarityB = RARITY_ORDER.indexOf(b.rarity || "none");
    if (rarityA !== rarityB) return rarityA - rarityB;
    const remainingDifference = remaining(b) - remaining(a);
    if (remainingDifference !== 0) return remainingDifference;
    return (a.name || "").localeCompare(b.name || "");
  });

  return filtered;
}

function renderProducts() {
  const grid = document.getElementById("products-grid");
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

function renderCategoryOptions() {
  const cats = state.settings.categories;
  document.querySelectorAll(".category-filter-select").forEach(sel => {
    const cur = sel.value;
    sel.innerHTML = `<option value="all">${t("filter_all_category")}</option>` + cats.map(c=>`<option value="${c}">${c}</option>`).join("");
    if (cats.includes(cur)) sel.value = cur;
  });
  document.querySelectorAll(".product-category-select").forEach(pc => {
    pc.innerHTML = cats.map(c=>`<option value="${c}">${c}</option>`).join("");
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
  document.getElementById("products-grid").addEventListener("click", (e) => {
    const card = e.target.closest("[data-id]");
    if (!card) return;
    const id = card.dataset.id;
    const action = e.target.closest("[data-action]")?.dataset.action;
    const p = state.products.find(x => x.id === id);
    if (!p) return;
    if (action === "sell") openSaleModal(p.id);
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

  document.getElementById("status-filter").addEventListener("change", (e) => {
    productFilters.status = e.target.value; renderProducts();
  });
  document.getElementById("rarity-filter").addEventListener("change", (e) => {
    productFilters.rarity = e.target.value; renderProducts();
  });
  document.querySelectorAll(".category-filter-select").forEach(sel => {
    sel.addEventListener("change", (e) => { productFilters.category = e.target.value; renderProducts(); });
  });

  document.getElementById("add-product-btn").addEventListener("click", openAddProductModal);
  document.getElementById("product-form").addEventListener("submit", handleProductFormSubmit);
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
  document.getElementById("add-product-btn").classList.toggle("hidden", selectMode);
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
  btn.disabled = true; btn.innerHTML = `<span class="spinner"></span> ...`;

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
  document.getElementById("product-image-preview-wrap").classList.add("hidden");
  document.getElementById("product-dropzone-placeholder").classList.remove("hidden");
  renderCategoryOptions();
  document.getElementById("product-form").rarity.value = "none";
  openModal("product-modal");
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
  f.stock.value = p.stock;
  f.rateQty.value = p.unitsPerBaht >= 1 ? Math.round(p.unitsPerBaht) : 1;
  f.ratePrice.value = p.unitsPerBaht >= 1 ? 1 : Math.round(1/p.unitsPerBaht);
  f.description.value = p.description || "";
  f.dataset.image = p.image || "";
  if (p.image) {
    document.getElementById("product-image-preview").src = p.image;
    document.getElementById("product-image-preview-wrap").classList.remove("hidden");
    document.getElementById("product-dropzone-placeholder").classList.add("hidden");
  } else {
    document.getElementById("product-image-preview-wrap").classList.add("hidden");
    document.getElementById("product-dropzone-placeholder").classList.remove("hidden");
  }
  openModal("product-modal");
}

function handleProductFormSubmit(e) {
  e.preventDefault();
  const f = e.target;
  const submitBtn = f.querySelector("button[type=submit]");
  const originalLabel = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="spinner"></span> ...`;

  setTimeout(() => {
    const name = f.name.value.trim();
    const category = f.category.value;
    const rarity = f.rarity.value;
    const stock = Math.max(0, parseInt(f.stock.value) || 0);
    const qty = Math.max(0.0001, parseFloat(f.rateQty.value) || 1);
    const price = Math.max(0.0001, parseFloat(f.ratePrice.value) || 1);
    const rate = qty / price;
    const description = f.description.value.trim();
    const image = f.dataset.image || null;

    if (!name) { toast(t("toast_name_required"), "error"); submitBtn.disabled=false; submitBtn.innerHTML=originalLabel; return; }

    if (editingProductId) {
      const p = state.products.find(x => x.id === editingProductId);
      Object.assign(p, { name, category, rarity, unitsPerBaht: rate, stock, description, image });
      toast(t("toast_product_updated"));
    } else {
      state.products.push({
        id: genId("p"), name, category, rarity, image, stock, sold: 0,
        unitsPerBaht: rate, description, createdAt: Date.now(), restockHistory: [],
      });
      toast(t("toast_product_added"));
    }
    saveState();
    renderProducts();
    renderDashboard();
    submitBtn.disabled = false; submitBtn.innerHTML = originalLabel;
    closeModal("product-modal");
  }, 250);
}

function deleteProduct(id) {
  const p = state.products.find(x => x.id === id);
  if (!p) return;
  confirmDialog(t("confirm_delete_product", { name: p.name }), () => {
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
  saveState();
  renderProducts();
  renderDashboard();
  toast(t("toast_restocked", { name: p.name, amount: fmtNum(amount) }));
  closeModal("restock-modal");
}
