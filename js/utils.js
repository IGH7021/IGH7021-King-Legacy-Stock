let state = null;
let stateOwnerId = null;
let stateSyncReady = false;
let stateSyncTimer = null;
let statePollTimer = null;
let stateSyncEtag = null;
let stateSyncAllowed = false;
let stateSyncInFlight = false;
let stateSyncDirty = false;
let stateLocalRevision = 0;
let stateSyncErrorShown = false;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) { state = defaultState(); saveState(); return state; }
    const parsed = JSON.parse(raw);
    if (!parsed.products || !parsed.sales || !parsed.settings) throw new Error("invalid");
    state = parsed;
    state.products.forEach(product => { if (!Number.isFinite(product.crafted)) product.crafted = 0; });
    const defaultRecipes = RECIPES.map(recipe => ({ ...recipe, ingredients: recipe.ingredients.map(item => [...item]) }));
    if (!Array.isArray(state.recipes)) state.recipes = defaultRecipes;
    else defaultRecipes.forEach(recipe => {
      if (!state.recipes.some(existing => existing.name.toLowerCase() === recipe.name.toLowerCase())) state.recipes.push(recipe);
    });
    if (!Array.isArray(state.farmServices)) state.farmServices = [];
    if (!Array.isArray(state.farmOrders)) state.farmOrders = [];
    if (!Array.isArray(state.activityLog)) state.activityLog = [];
    state.farmServices.forEach(service => {
      if (!service.pricingMode) service.pricingMode = "unit";
      if (!service.rateQty) service.rateQty = service.unitsPerBaht || 1;
      if (!service.ratePrice) service.ratePrice = 1;
      if (!service.hourRate && service.pricingMode === "hour") service.hourRate = service.ratePrice;
    });
    if (!state.settings.categories) state.settings.categories = Object.keys(CATEGORY_ICONS).filter(c=>c!=="อื่นๆ");
    return state;
  } catch (e) {
    console.error("loadState error", e);
    state = defaultState();
    saveState();
    return state;
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (stateOwnerId) localStorage.setItem(`${STORAGE_KEY}_${encodeURIComponent(stateOwnerId)}`, JSON.stringify(state));
    if (stateOwnerId) {
      stateLocalRevision++;
      stateSyncDirty = true;
    }
    if (stateOwnerId && stateSyncReady && stateSyncAllowed) {
      clearTimeout(stateSyncTimer);
      stateSyncTimer = setTimeout(syncAccountState, 350);
    }
    return true;
  } catch (e) {
    console.error("saveState error", e);
    toast(t("toast_save_failed"), "error");
    return false;
  }
}

async function syncAccountState() {
  stateSyncTimer = null;
  if (!stateOwnerId || !stateSyncReady || !stateSyncAllowed || !stateSyncDirty || stateSyncInFlight) return;
  const ownerId = stateOwnerId;
  const revision = stateLocalRevision;
  const snapshot = JSON.stringify(state);
  stateSyncInFlight = true;
  try {
    const response = await fetch("/api/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem(AUTH_TOKEN_KEY) || ""}` },
      body: snapshot,
    });
    if (!response.ok) throw new Error(`Account data sync failed (${response.status})`);
    if (ownerId !== stateOwnerId) return;
    stateSyncEtag = response.headers.get("ETag") || stateSyncEtag;
    stateSyncErrorShown = false;
    if (revision === stateLocalRevision) stateSyncDirty = false;
  } catch (error) {
    console.error("Account state sync failed:", error);
    if (ownerId === stateOwnerId && !stateSyncErrorShown) {
      toast(t("state_sync_failed"), "error");
      stateSyncErrorShown = true;
    }
  } finally {
    if (ownerId === stateOwnerId) {
      stateSyncInFlight = false;
      if (stateSyncDirty) {
        clearTimeout(stateSyncTimer);
        stateSyncTimer = setTimeout(syncAccountState, 3000);
      }
    }
  }
}

function renderAccountState() {
  renderProducts();
  renderCrafting();
  renderSalesHistory();
  renderDashboard();
  renderReports();
  renderSettings();
}

async function pollAccountState() {
  if (!stateOwnerId || !stateSyncReady || !stateSyncAllowed || stateSyncDirty || stateSyncInFlight || stateSyncTimer || document.visibilityState !== "visible") return;
  const revision = stateLocalRevision;
  const ownerId = stateOwnerId;
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token || token === "demo") return;
  try {
    const headers = { Authorization: `Bearer ${token}` };
    if (stateSyncEtag) headers["If-None-Match"] = stateSyncEtag;
    const response = await fetch("/api/state", { headers });
    if (response.status === 304 || response.status === 404) return;
    if (!response.ok) throw new Error(`Account data refresh failed (${response.status})`);
    const remoteState = await response.json();
    if (ownerId !== stateOwnerId || revision !== stateLocalRevision || stateSyncDirty || stateSyncInFlight) return;
    stateSyncEtag = response.headers.get("ETag") || stateSyncEtag;
    if (JSON.stringify(remoteState) === JSON.stringify(state)) return;
    state = remoteState;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    localStorage.setItem(`${STORAGE_KEY}_${encodeURIComponent(ownerId)}`, JSON.stringify(state));
    renderAccountState();
  } catch (error) {
    console.warn("Live account refresh failed:", error);
  }
}

async function activateUserState(ownerId) {
  clearTimeout(stateSyncTimer);
  clearInterval(statePollTimer);
  stateSyncReady = false;
  stateSyncAllowed = false;
  stateSyncEtag = null;
  stateSyncDirty = false;
  stateSyncInFlight = false;
  stateLocalRevision = 0;
  stateSyncErrorShown = false;
  stateOwnerId = ownerId;
  const personalKey = `${STORAGE_KEY}_${encodeURIComponent(ownerId)}`;
  const localState = localStorage.getItem(personalKey);
  if (localState) {
    try { state = JSON.parse(localState); } catch (error) { localStorage.removeItem(personalKey); }
  } else if (localStorage.getItem("igh_kinglegacy_legacy_owner") === ownerId) {
    try { state = JSON.parse(localStorage.getItem(STORAGE_KEY)) || defaultState({ emptyWorkspace: true }); } catch (error) { state = defaultState({ emptyWorkspace: true }); }
  } else {
    state = defaultState({ emptyWorkspace: true });
  }
  renderAccountState();
  const loadRevision = stateLocalRevision;
  try {
    const response = await fetch("/api/state", { headers: { Authorization: `Bearer ${localStorage.getItem(AUTH_TOKEN_KEY) || ""}` } });
    if (response.ok) {
      const remoteState = await response.json();
      stateSyncAllowed = true;
      stateSyncEtag = response.headers.get("ETag");
      if (stateLocalRevision === loadRevision) state = remoteState;
    } else if (response.status === 404) {
      stateSyncAllowed = true;
      if (stateLocalRevision === loadRevision) state = defaultState({ emptyWorkspace: true });
      stateSyncDirty = true;
    } else if (response.status !== 503) throw new Error("Could not load account data");
  } catch (error) { console.warn("Account state sync unavailable; using this browser's local state."); }
  if (!state || !Array.isArray(state.products) || !Array.isArray(state.sales) || !state.settings) state = defaultState({ emptyWorkspace: true });
  if (stateLocalRevision !== loadRevision) stateSyncDirty = true;
  stateSyncReady = true;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  localStorage.setItem(personalKey, JSON.stringify(state));
  if (stateSyncDirty && stateSyncAllowed) stateSyncTimer = setTimeout(syncAccountState, 0);
  renderAccountState();
  if (stateSyncAllowed) {
    pollAccountState();
    statePollTimer = setInterval(pollAccountState, 5000);
  }
}
window.activateUserState = activateUserState;

async function clearAccountData() {
  const previousState = state;
  const emptyState = defaultState({ emptyWorkspace: true });
  const ownerId = stateOwnerId;
  let serverCleared = false;
  clearTimeout(stateSyncTimer);
  stateSyncReady = false;
  try {
    const authToken = localStorage.getItem(AUTH_TOKEN_KEY);
    if (ownerId && authToken && authToken !== "demo") {
      const response = await fetch("/api/state", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem(AUTH_TOKEN_KEY) || ""}` },
        body: JSON.stringify(emptyState),
      });
      if (!response.ok) throw new Error(t("clear_account_server_failed"));
      stateSyncAllowed = true;
      stateSyncEtag = response.headers.get("ETag") || null;
      stateSyncDirty = false;
      serverCleared = true;
    }
    state = emptyState;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (ownerId) localStorage.setItem(`${STORAGE_KEY}_${encodeURIComponent(ownerId)}`, JSON.stringify(state));
    applyTheme("dark");
    setLang("th");
    stateSyncReady = Boolean(ownerId);
    stateLocalRevision++;
    renderAccountState();
    toast(t("clear_account_success"));
    return true;
  } catch (error) {
    if (!serverCleared) state = previousState;
    else {
      state = emptyState;
      try {
        localStorage.removeItem(STORAGE_KEY);
        if (ownerId) localStorage.removeItem(`${STORAGE_KEY}_${encodeURIComponent(ownerId)}`);
      } catch (storageError) { console.error("Could not clear local account state:", storageError); }
      renderProducts(); renderCrafting(); renderSalesHistory(); renderDashboard(); renderReports(); renderSettings();
    }
    stateSyncReady = Boolean(ownerId);
    console.error("clearAccountData error:", error);
    toast(serverCleared ? t("clear_account_local_failed") : error.message || t("clear_account_failed"), "error");
    return false;
  }
}

function categorySortIndex(category) {
  const index = CATEGORY_ORDER.indexOf(category);
  return index < 0 ? CATEGORY_ORDER.length : index;
}

function genId(prefix) { return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

async function copyText(text) {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    const input = document.createElement("textarea");
    input.value = text;
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    input.remove();
  }
  return true;
}

function customSelectLabel(select) {
  return select.options[select.selectedIndex]?.textContent || "เลือกตัวเลือก";
}

function syncCustomSelect(select) {
  const wrapper = select.closest(".custom-select");
  if (!wrapper) return;
  const trigger = wrapper.querySelector(".custom-select-trigger");
  const menu = wrapper.querySelector(".custom-select-menu");
  if (trigger) trigger.querySelector("span").textContent = customSelectLabel(select);
  menu?.querySelectorAll("button").forEach(button => button.classList.toggle("is-selected", button.dataset.value === select.value));
}

function buildCustomSelect(select) {
  if (select.closest(".custom-select")) { syncCustomSelect(select); return; }
  const wrapper = document.createElement("div");
  wrapper.className = "custom-select";
  if (select.classList.contains("w-full")) wrapper.classList.add("w-full");
  if (select.classList.contains("flex-1")) wrapper.classList.add("flex-1");
  if (select.classList.contains("mt-1")) wrapper.classList.add("mt-1");
  select.parentNode.insertBefore(wrapper, select);
  wrapper.appendChild(select);
  select.classList.add("custom-select-native");
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "custom-select-trigger";
  trigger.innerHTML = `<span></span><b aria-hidden="true">⌄</b>`;
  const menu = document.createElement("div");
  menu.className = "custom-select-menu";
  wrapper.append(trigger, menu);
  const rebuild = () => {
    menu.innerHTML = Array.from(select.options).map(option => `<button type="button" data-value="${option.value}">${option.textContent}</button>`).join("");
    syncCustomSelect(select);
  };
  trigger.addEventListener("click", event => {
    event.stopPropagation();
    document.querySelectorAll(".custom-select.is-open").forEach(item => { if (item !== wrapper) item.classList.remove("is-open"); });
    wrapper.classList.toggle("is-open");
  });
  menu.addEventListener("click", event => {
    const option = event.target.closest("button[data-value]");
    if (!option) return;
    select.value = option.dataset.value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    syncCustomSelect(select);
    wrapper.classList.remove("is-open");
  });
  new MutationObserver(rebuild).observe(select, { childList: true });
  rebuild();
}

function enhanceCustomSelects() {
  document.querySelectorAll("select").forEach(buildCustomSelect);
}

function enhanceNumberInput(input) {
  if (!input.parentNode || input.closest(".number-stepper") || input.readOnly) return;
  input.type = "text";
  input.inputMode = input.step === "any" || Number(input.step) < 1 ? "decimal" : "numeric";
  input.dataset.compactNumber = "true";
  input.autocomplete = "off";
  if (!input.placeholder) {
    input.placeholder = t("compact_number_placeholder");
    input.dataset.compactPlaceholder = "true";
  }
  input.title = t("compact_number_hint");
  input.setAttribute("aria-description", t("compact_number_hint"));
  const wrapper = document.createElement("div");
  wrapper.className = "number-stepper";
  if (input.classList.contains("w-full")) wrapper.classList.add("number-stepper-full");
  if (input.classList.contains("flex-1")) wrapper.classList.add("flex-1");
  if (input.classList.contains("craft-quantity-input")) wrapper.classList.add("craft-quantity-stepper");
  if (input.classList.contains("mt-1")) {
    wrapper.classList.add("mt-1");
    input.classList.remove("mt-1");
  }
  input.classList.remove("w-full");
  input.parentNode.insertBefore(wrapper, input);
  wrapper.appendChild(input);
  [
    [-1, "∨", "ลด 1"],
    [1, "∧", "เพิ่ม 1"],
  ].forEach(([delta, symbol, label]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "number-stepper-btn";
    button.dataset.numberStep = delta;
    button.textContent = symbol;
    button.setAttribute("aria-label", label);
    button.title = label;
    wrapper.appendChild(button);
  });
  syncNumberStepper(input);
}

function syncNumberStepper(input) {
  const wrapper = input.closest(".number-stepper");
  if (!wrapper) return;
  const min = input.min === "" ? -Infinity : Number(input.min);
  const max = input.max === "" ? Infinity : Number(input.max);
  const value = input.value === "" ? 0 : Number(input.value);
  wrapper.querySelectorAll("[data-number-step]").forEach(button => {
    const delta = Number(button.dataset.numberStep);
    button.disabled = input.disabled || (delta < 0 ? value <= min : value >= max);
  });
}

function parseCompactNumber(value) {
  const match = String(value).trim().match(/^([+-]?(?:(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*([kmbt])?$/i);
  if (!match) return null;
  const number = Number(match[1].replace(/,/g, ""));
  const multiplier = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 }[match[2]?.toLowerCase()] || 1;
  const result = number * multiplier;
  return Number.isFinite(result) ? result : null;
}

function validateCompactNumberInput(input) {
  const rawValue = input.value.trim();
  if (!rawValue) {
    input.setCustomValidity("");
    return;
  }
  const value = parseCompactNumber(rawValue);
  if (value === null) {
    input.setCustomValidity(t("compact_number_invalid"));
    return;
  }
  const min = input.getAttribute("min") === null ? -Infinity : Number(input.getAttribute("min"));
  const max = input.getAttribute("max") === null ? Infinity : Number(input.getAttribute("max"));
  if (value < min) {
    input.setCustomValidity(t("compact_number_below_min", { min: fmtNum(min) }));
    return;
  }
  if (value > max) {
    input.setCustomValidity(t("compact_number_above_max", { max: fmtNum(max) }));
    return;
  }
  const step = input.getAttribute("step") || "1";
  const base = Number.isFinite(min) ? min : 0;
  if (step !== "any" && Number(step) > 0 && Math.abs((value - base) / Number(step) - Math.round((value - base) / Number(step))) > 1e-9) {
    input.setCustomValidity(t("compact_number_step_invalid", { step }));
    return;
  }
  input.setCustomValidity("");
}

function refreshCompactNumberInputs() {
  document.querySelectorAll("input[data-compact-number]").forEach(input => {
    if (input.dataset.compactPlaceholder === "true") input.placeholder = t("compact_number_placeholder");
    input.title = t("compact_number_hint");
    input.setAttribute("aria-description", t("compact_number_hint"));
    validateCompactNumberInput(input);
  });
}

function enhanceNumberSteppers(root = document) {
  if (root.matches?.('input[type="number"], input[data-compact-number]')) enhanceNumberInput(root);
  root.querySelectorAll?.('input[type="number"], input[data-compact-number]').forEach(enhanceNumberInput);
}

function initializeNumberSteppers() {
  enhanceNumberSteppers();
  new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
    if (node.nodeType === Node.ELEMENT_NODE) enhanceNumberSteppers(node);
  }))).observe(document.body, { childList: true, subtree: true });
  document.addEventListener("input", event => {
    const input = event.target;
    if (!input.matches?.('input[data-compact-number]')) return;
    const compactValue = input.value.trim();
    if (/[kmbt]$/i.test(compactValue)) {
      const parsed = parseCompactNumber(compactValue);
      if (parsed !== null) {
        input.value = String(parsed);
        input.setCustomValidity("");
        input.dispatchEvent(new Event("input", { bubbles: true }));
        return;
      }
    }
    validateCompactNumberInput(input);
    syncNumberStepper(input);
  });

  document.addEventListener("click", event => {
    const button = event.target.closest("[data-number-step]");
    if (!button) return;
    const input = button.closest(".number-stepper")?.querySelector('input[data-compact-number]');
    if (!input || input.disabled || input.readOnly) return;
    const min = input.min === "" ? -Infinity : Number(input.min);
    const max = input.max === "" ? Infinity : Number(input.max);
    const current = input.value === "" ? 0 : Number(input.value);
    const next = Math.min(max, Math.max(min, current + Number(button.dataset.numberStep)));
    input.value = String(Number(next.toFixed(10)));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

document.addEventListener("click", event => {
  if (!event.target.closest(".custom-select")) document.querySelectorAll(".custom-select.is-open").forEach(select => select.classList.remove("is-open"));
});

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function fmtNum(n) {
  if (n === null || n === undefined || isNaN(n)) return "0";
  return Number(n).toLocaleString("th-TH", { maximumFractionDigits: 2 });
}
function fmtBaht(n) { return "฿" + fmtNum(n); }
function fmtDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString("th-TH", { day:"2-digit", month:"short", year:"2-digit" }) + " " +
         d.toLocaleTimeString("th-TH", { hour:"2-digit", minute:"2-digit" });
}
function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return t("time_just_now");
  if (s < 3600) return t("time_minutes_ago", { n: Math.floor(s/60) });
  if (s < 86400) return t("time_hours_ago", { n: Math.floor(s/3600) });
  return t("time_days_ago", { n: Math.floor(s/86400) });
}

/* ---------- Toast ---------- */
function toast(msg, type = "success") {
  let box = document.getElementById("toast-box");
  if (!box) {
    box = document.createElement("div");
    box.id = "toast-box";
    box.className = "fixed z-[9999] bottom-20 md:bottom-6 right-4 flex flex-col gap-2 items-end";
    document.body.appendChild(box);
  }
  const el = document.createElement("div");
  const color = type === "error" ? "border-rose-500/40 text-rose-300" : type === "info" ? "border-sky-500/40 text-sky-300" : "border-emerald-500/40 text-emerald-300";
  el.className = `toast-item px-4 py-2.5 rounded-xl bg-slate-900/95 border ${color} shadow-lg text-sm font-medium backdrop-blur-sm`;
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; el.style.transform="translateX(8px)"; }, 2200);
  setTimeout(() => el.remove(), 2500);
}

/* ---------- Modal (generic) ---------- */
function openModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.remove("hidden");
  requestAnimationFrame(() => m.classList.add("modal-show"));
  document.body.classList.add("overflow-hidden");
}
function closeModal(id) {
  const m = id ? document.getElementById(id) : document.querySelector(".modal-overlay:not(.hidden)");
  if (!m) return;
  m.classList.remove("modal-show");
  setTimeout(() => m.classList.add("hidden"), 120);
  document.body.classList.remove("overflow-hidden");
}
function bindModalDismiss() {
  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("modal-overlay")) closeModal(e.target.id);
    const closeBtn = e.target.closest("[data-close-modal]");
    if (closeBtn) closeModal(closeBtn.closest(".modal-overlay").id);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const open = document.querySelector(".modal-overlay.modal-show");
      if (open) closeModal(open.id);
    }
  });
}

/* ---------- Confirm dialog ---------- */
function confirmDialog(message, onConfirm) {
  const wrap = document.getElementById("confirm-modal");
  document.getElementById("confirm-message").textContent = message;
  openModal("confirm-modal");
  const btn = document.getElementById("confirm-ok-btn");
  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);
  newBtn.addEventListener("click", () => { closeModal("confirm-modal"); onConfirm(); });
}

/* ---------- Image resize/compress ---------- */
function handleImageFile(file, callback) {
  const okTypes = ["image/png","image/jpeg","image/jpg","image/webp"];
  if (!okTypes.includes(file.type)) { toast(t("toast_unsupported_image"), "error"); return; }
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 480;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        const ratio = Math.min(MAX/width, MAX/height);
        width = Math.round(width*ratio); height = Math.round(height*ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
      callback(dataUrl);
    };
    img.onerror = () => toast(t("toast_image_read_fail"), "error");
    img.src = e.target.result;
  };
  reader.onerror = () => toast(t("toast_file_read_fail"), "error");
  reader.readAsDataURL(file);
}

/* ---------- Global error handling ---------- */
window.addEventListener("error", (e) => { console.error(e.error || e.message); });
window.addEventListener("unhandledrejection", (e) => { console.error(e.reason); });
