let state = null;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) { state = defaultState(); saveState(); return state; }
    const parsed = JSON.parse(raw);
    if (!parsed.products || !parsed.sales || !parsed.settings) throw new Error("invalid");
    state = parsed;
    if (!Array.isArray(state.farmServices)) state.farmServices = [];
    if (!Array.isArray(state.farmOrders)) state.farmOrders = [];
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
    return true;
  } catch (e) {
    console.error("saveState error", e);
    toast(t("toast_save_failed"), "error");
    return false;
  }
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
