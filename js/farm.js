let editingFarmServiceId = null;
let selectedFarmServiceId = null;

function farmRateLabel(service) {
  if (service.pricingMode === "hour") return `฿${fmtNum(service.hourPrice || service.ratePrice)} / ชั่วโมง`;
  return `${fmtNum(service.rateQty || service.unitsPerBaht)} ชิ้น / ฿${fmtNum(service.ratePrice || 1)}`;
}

function farmCategoryLabel(category) {
  const icons = { "ของคราฟ": "🛠️", "ของแต่ง": "🎩", "ดาบ": "🗡️", "ผลปีศาจ": "🍇", "ของวัตถุดิบ": "🪵", "อื่นๆ": "📦" };
  return `${icons[category] || "📦"} ${category}`;
}

function addFarmActivity(action, text, sub = "") {
  if (!Array.isArray(state.activityLog)) state.activityLog = [];
  state.activityLog.unshift({ id: genId("activity"), type: "farm", action, text, sub, ts: Date.now() });
  state.activityLog = state.activityLog.slice(0, 100);
}

function farmServiceCard(service) {
  const rarity = service.rarity || "none";
  return `<div class="glass-card rounded-2xl overflow-hidden flex flex-col" data-farm-id="${service.id}">
    <div class="h-32 bg-emerald-900/20 flex items-center justify-center text-4xl">${service.image ? `<img src="${service.image}" loading="lazy" decoding="async" class="w-full h-full object-cover" alt="${service.name}">` : "🌾"}</div>
    <div class="p-3 flex-1 flex flex-col gap-1.5">
      <div class="flex items-center justify-between gap-2"><h4 class="font-semibold text-sm truncate">${service.name}</h4><span class="text-[10px] px-2 py-0.5 rounded-full border ${rarityBadgeClass(rarity)}">${rarityLabel(rarity)}</span></div>
      <span class="text-[11px] w-fit px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">${farmCategoryLabel(service.category)}</span>
      <div class="text-xs text-slate-300 mt-1">💰 เรท ${farmRateLabel(service)}</div>
      <div class="text-xs text-slate-400">${service.description || "ไม่มีรายละเอียด"}</div>
      <div class="flex gap-1.5 mt-auto pt-2"><button data-farm-action="order" class="flex-1 text-xs font-medium py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500">รับงาน</button><button data-farm-action="edit" class="text-xs px-2 py-1.5 rounded-lg bg-slate-700/60">✏️</button><button data-farm-action="delete" class="text-xs px-2 py-1.5 rounded-lg bg-slate-700/60 hover:bg-rose-600/70">🗑️</button></div>
    </div>
  </div>`;
}

function renderFarmServices() {
  const grid = document.getElementById("farm-services-grid");
  if (!grid) return;
  const services = state.farmServices || [];
  grid.innerHTML = services.length ? services.map(farmServiceCard).join("") : `<div class="col-span-full text-center py-12 text-slate-400"><div class="text-4xl mb-2">🌾</div><p>ยังไม่มีรายการรับฟาร์ม</p></div>`;
  renderFarmOrders();
  document.querySelectorAll(".rarity-select-input").forEach(select => {
    if (!select.options.length) select.innerHTML = RARITY_ORDER.map(r => `<option value="${r}">${rarityLabel(r)}</option>`).join("");
  });
}

function renderFarmOrders() {
  const box = document.getElementById("farm-orders-list");
  if (!box) return;
  const orders = state.farmOrders || [];
  if (!orders.length) { box.innerHTML = `<div class="text-xs text-slate-400 py-4">ยังไม่มีประวัติงานฟาร์ม</div>`; return; }
  box.innerHTML = orders.map(order => `<div class="glass-card rounded-xl p-3 flex items-center gap-3">
    <div class="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center">🌾</div><div class="flex-1 min-w-0"><div class="flex justify-between gap-2"><span class="font-medium text-sm truncate">${order.serviceName}</span><span class="font-semibold text-sm text-emerald-400">${fmtBaht(order.money)}</span></div><div class="text-xs text-slate-400">${order.pricingMode === "hour" ? `⏱️ ${fmtNum(order.hours || order.quantity)} ชั่วโมง` : `📦 ${fmtNum(order.quantity)} ชิ้น`} • ${fmtDate(order.date)}${order.customer ? ` • ${order.customer}` : ""}${order.note ? ` • ${order.note}` : ""}</div></div><button data-farm-order-delete="${order.id}" class="text-xs px-2 py-1.5 rounded-lg bg-slate-700/60 hover:bg-rose-600/70" aria-label="ลบงาน">🗑️</button>
  </div>`).join("");
}

function openFarmServiceModal(id = null) {
  editingFarmServiceId = id;
  const form = document.getElementById("farm-service-form");
  form.reset();
  form.rarity.innerHTML = RARITY_ORDER.map(r => `<option value="${r}">${rarityLabel(r)}</option>`).join("");
  form.rarity.value = "none";
  form.pricingMode.value = "unit";
  form.dataset.image = "";
  document.getElementById("farm-image-preview-wrap").classList.add("hidden");
  document.getElementById("farm-image-placeholder").classList.remove("hidden");
  document.getElementById("farm-service-modal-title").textContent = id ? "แก้ไขงานรับฟาร์ม" : "เพิ่มงานรับฟาร์ม";
  const service = (state.farmServices || []).find(item => item.id === id);
  if (service) { form.name.value = service.name; form.category.value = service.category; form.rarity.value = service.rarity || "none"; form.pricingMode.value = service.pricingMode || "unit"; form.rateQty.value = service.rateQty || service.unitsPerBaht || 1; form.ratePrice.value = service.ratePrice || 1; form.rateHours.value = service.rateHours || 1; form.hourPrice.value = service.hourPrice || service.ratePrice || 1; form.description.value = service.description || ""; form.dataset.image = service.image || ""; if (service.image) { document.getElementById("farm-image-preview").src = service.image; document.getElementById("farm-image-preview-wrap").classList.remove("hidden"); document.getElementById("farm-image-placeholder").classList.add("hidden"); } }
  updateFarmServiceRateFields();
  openModal("farm-service-modal");
}

function openFarmOrderModal(id) {
  const services = state.farmServices || [];
  if (!services.length) { toast("กรุณาเพิ่มงานฟาร์มก่อน", "error"); return; }
  selectedFarmServiceId = id || services[0].id;
  const form = document.getElementById("farm-order-form");
  form.reset();
  document.getElementById("farm-order-service").innerHTML = services.map(service => `<option value="${service.id}" ${service.id === selectedFarmServiceId ? "selected" : ""}>${service.name}</option>`).join("");
  updateFarmOrderMoney();
  openModal("farm-order-modal");
}

function updateFarmOrderMoney() {
  const form = document.getElementById("farm-order-form");
  const service = (state.farmServices || []).find(item => item.id === form.service.value);
  if (!service) return;
  const isHourly = service.pricingMode === "hour";
  document.getElementById("farm-order-unit-fields").classList.toggle("hidden", isHourly);
  document.getElementById("farm-order-hour-fields").classList.toggle("hidden", !isHourly);
  const quantity = Number(isHourly ? form.hours.value : form.quantity.value) || 0;
  const money = isHourly ? quantity * (Number(service.hourPrice || service.ratePrice) || 0) : quantity * (Number(service.ratePrice) || 0) / (Number(service.rateQty || service.unitsPerBaht) || 1);
  document.getElementById("farm-order-money").value = money ? money.toFixed(2) : "";
}

function updateFarmServiceRateFields() {
  const form = document.getElementById("farm-service-form");
  const isHourly = form.pricingMode.value === "hour";
  document.getElementById("farm-unit-rate-fields").classList.toggle("hidden", isHourly);
  document.getElementById("farm-hour-rate-fields").classList.toggle("hidden", !isHourly);
  form.rateQty.required = !isHourly;
  form.ratePrice.required = !isHourly;
  form.rateHours.required = isHourly;
  form.hourPrice.required = isHourly;
}

function handleFarmServiceSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const isHourly = form.pricingMode.value === "hour";
  const quantity = Math.max(0.0001, Number(form.rateQty.value) || 0);
  const price = Math.max(0.0001, Number(form.ratePrice.value) || 0);
  const hours = Math.max(0.01, Number(form.rateHours.value) || 0);
  const hourPrice = Math.max(0.01, Number(form.hourPrice.value) || 0);
  if (!form.name.value.trim() || !form.category.value.trim()) { toast("กรุณากรอกชื่อและหมวดหมู่", "error"); return; }
  const payload = { name: form.name.value.trim(), category: form.category.value, rarity: form.rarity.value, pricingMode: form.pricingMode.value, rateQty: quantity, ratePrice: price, rateHours: hours, hourPrice, unitsPerBaht: isHourly ? 0 : quantity / price, description: form.description.value.trim(), image: form.dataset.image || null, updatedAt: Date.now() };
  const action = editingFarmServiceId ? "แก้ไขรายการฟาร์ม" : "เพิ่มรายการฟาร์ม";
  if (editingFarmServiceId) Object.assign(state.farmServices.find(item => item.id === editingFarmServiceId), payload);
  else state.farmServices.unshift({ id: genId("farm"), ...payload, createdAt: Date.now() });
  addFarmActivity(action, `${action}: ${payload.name}`, `หมวดหมู่ ${payload.category} • ${farmRateLabel(payload)}`);
  saveState(); renderFarmServices(); renderDashboard(); closeModal("farm-service-modal"); toast("บันทึกงานฟาร์มแล้ว");
}

function handleFarmOrderSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const service = (state.farmServices || []).find(item => item.id === form.service.value);
  const isHourly = service?.pricingMode === "hour";
  const quantity = Number(form.quantity.value) || 0;
  const hours = Number(form.hours.value) || 0;
  const money = Number(form.money.value) || 0;
  if (!service || (isHourly ? hours <= 0 : quantity <= 0) || money <= 0) { toast("กรุณากรอกจำนวนและราคาให้ถูกต้อง", "error"); return; }
  state.farmOrders.unshift({ id: genId("fo"), serviceId: service.id, serviceName: service.name, pricingMode: service.pricingMode || "unit", quantity, hours, money: Math.round(money * 100) / 100, customer: form.customer.value.trim(), note: form.note.value.trim(), date: Date.now() });
  addFarmActivity("รับงานฟาร์ม", `รับงานฟาร์ม: ${service.name}`, `${isHourly ? `${fmtNum(hours)} ชั่วโมง` : `${fmtNum(quantity)} ชิ้น`} • ${fmtBaht(money)}`);
  saveState(); renderFarmOrders(); renderDashboard(); closeModal("farm-order-modal"); toast("บันทึกงานฟาร์มแล้ว");
}

document.addEventListener("DOMContentLoaded", () => {
  const productTab = document.getElementById("stock-tab-products");
  const farmTab = document.getElementById("stock-tab-farming");
  const craftingTab = document.getElementById("stock-tab-crafting");
  const productToolbar = document.getElementById("products-toolbar");
  const bulkToolbar = document.getElementById("bulk-toolbar");
  const productGrid = document.getElementById("products-grid");
  const farmPanel = document.getElementById("farming-panel");
  const craftingPanel = document.getElementById("crafting-panel");
  const setStockTab = tab => {
    const farming = tab === "farming";
    const crafting = tab === "crafting";
    productTab.classList.toggle("seg-active", !farming && !crafting);
    farmTab.classList.toggle("seg-active", farming);
    craftingTab.classList.toggle("seg-active", crafting);
    productToolbar.classList.toggle("hidden", farming || crafting);
    bulkToolbar.classList.toggle("hidden", farming || crafting || !selectMode);
    productGrid.classList.toggle("hidden", farming || crafting);
    farmPanel.classList.toggle("hidden", !farming);
    craftingPanel.classList.toggle("hidden", !crafting);
    if (farming) renderFarmServices();
    if (crafting) renderCrafting();
  };
  productTab.addEventListener("click", () => setStockTab("products"));
  farmTab.addEventListener("click", () => setStockTab("farming"));
  craftingTab.addEventListener("click", () => setStockTab("crafting"));
  document.getElementById("add-farm-service-btn").addEventListener("click", () => openFarmServiceModal());
  document.getElementById("farm-service-form").addEventListener("submit", handleFarmServiceSubmit);
  document.getElementById("farm-pricing-mode").addEventListener("change", updateFarmServiceRateFields);
  const farmImageInput = document.getElementById("farm-image-input");
  const farmImageDropzone = document.getElementById("farm-image-dropzone");
  const applyFarmImage = file => handleImageFile(file, dataUrl => { document.getElementById("farm-image-preview").src = dataUrl; document.getElementById("farm-image-preview-wrap").classList.remove("hidden"); document.getElementById("farm-image-placeholder").classList.add("hidden"); document.getElementById("farm-service-form").dataset.image = dataUrl; });
  farmImageDropzone.addEventListener("click", () => farmImageInput.click());
  farmImageInput.addEventListener("change", event => { if (event.target.files[0]) applyFarmImage(event.target.files[0]); });
  farmImageDropzone.addEventListener("dragover", event => { event.preventDefault(); farmImageDropzone.classList.add("dropzone-active"); });
  farmImageDropzone.addEventListener("dragleave", () => farmImageDropzone.classList.remove("dropzone-active"));
  farmImageDropzone.addEventListener("drop", event => { event.preventDefault(); farmImageDropzone.classList.remove("dropzone-active"); if (event.dataTransfer.files[0]) applyFarmImage(event.dataTransfer.files[0]); });
  document.getElementById("farm-order-form").addEventListener("submit", handleFarmOrderSubmit);
  document.getElementById("farm-order-form").quantity.addEventListener("input", updateFarmOrderMoney);
  document.getElementById("farm-order-form").hours.addEventListener("input", updateFarmOrderMoney);
  document.getElementById("farm-order-form").service.addEventListener("change", updateFarmOrderMoney);
  document.getElementById("farm-services-grid").addEventListener("click", event => { const card = event.target.closest("[data-farm-id]"); const action = event.target.closest("[data-farm-action]")?.dataset.farmAction; if (!card || !action) return; const id = card.dataset.farmId; const service = state.farmServices.find(item => item.id === id); if (action === "order") openFarmOrderModal(id); else if (action === "edit") openFarmServiceModal(id); else if (action === "delete") { state.farmServices = state.farmServices.filter(item => item.id !== id); addFarmActivity("ลบรายการฟาร์ม", `ลบรายการฟาร์ม: ${service?.name || "ไม่ทราบชื่อ"}`); saveState(); renderFarmServices(); renderDashboard(); toast("ลบงานฟาร์มแล้ว"); } });
  document.getElementById("farm-orders-list").addEventListener("click", event => { const button = event.target.closest("[data-farm-order-delete]"); if (!button) return; const order = state.farmOrders.find(item => item.id === button.dataset.farmOrderDelete); state.farmOrders = state.farmOrders.filter(order => order.id !== button.dataset.farmOrderDelete); addFarmActivity("ลบงานฟาร์ม", `ลบประวัติงานฟาร์ม: ${order?.serviceName || "ไม่ทราบชื่อ"}`); saveState(); renderFarmOrders(); renderDashboard(); toast("ลบประวัติงานแล้ว"); });
});
