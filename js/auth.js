const AUTH_TOKEN_KEY = "igh_kinglegacy_auth_token";
const AUTH_KEY_KEY = "igh_kinglegacy_auth_key";
let pendingAuthKey = "";
const authApi = path => fetch(path, { headers: { "Content-Type": "application/json" } });
async function readApiResponse(response) {
  const text = await response.text();
  try { return text ? JSON.parse(text) : {}; }
  catch (error) { throw new Error(location.protocol === "file:" ? "กรุณาเปิดเว็บผ่าน Node.js Server ด้วยคำสั่ง npm start" : "Server ตอบกลับไม่ถูกต้อง"); }
}
async function postAuth(path, body) {
  try { return await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
  catch (error) { throw new Error("เชื่อมต่อ Server ไม่ได้ กรุณาเปิดเว็บผ่าน http://localhost:3000"); }
}

function authMessage(message, error = true) {
  const el = document.getElementById("auth-message");
  el.textContent = message || "";
  el.classList.toggle("auth-error", error);
}
function openApp(result) {
  localStorage.setItem(AUTH_TOKEN_KEY, result.token || "demo");
  localStorage.setItem(AUTH_KEY_KEY, pendingAuthKey);
  localStorage.setItem("igh_kinglegacy_is_admin", result.admin ? "1" : "0");
  if (result.expiresAt) localStorage.setItem("igh_kinglegacy_expires_at", String(result.expiresAt));
  else localStorage.removeItem("igh_kinglegacy_expires_at");
  if (result.admin) window.enableAdminUi?.();
  document.getElementById("auth-gate").classList.add("auth-complete");
  setTimeout(() => document.getElementById("auth-gate")?.remove(), 350);
  startKeyStatus(result.expiresAt);
  window.updateKeySettings?.(result);
  if (result.admin && sessionStorage.getItem("igh_pending_admin_route") === "1") {
    sessionStorage.removeItem("igh_pending_admin_route");
    setTimeout(() => window.showPage?.("admin"), 400);
  }
}
function startKeyStatus(expiresAt) {
  const expiry = Number(expiresAt || localStorage.getItem("igh_kinglegacy_expires_at"));
  const isAdmin = localStorage.getItem("igh_kinglegacy_is_admin") === "1";
  if (!expiry && !isAdmin) return;
  let timer;
  const update = () => {
    const remaining = expiry ? Math.max(0, expiry - Date.now()) : null;
    const seconds = Math.floor(remaining / 1000);
    const label = remaining === null ? "อันลิมิต" : seconds >= 3600 ? `${Math.floor(seconds / 3600)} ชั่วโมง ${Math.floor(seconds % 3600 / 60)} นาที` : `${Math.floor(seconds / 60)} นาที ${seconds % 60} วินาที`;
    document.querySelectorAll(".key-status").forEach(el => { el.textContent = isAdmin ? "Admin • อันลิมิต" : `คีย์เหลือ ${label}`; el.classList.remove("hidden"); });
    if (remaining === 0) clearInterval(timer);
  };
  update();
  if (expiry) timer = setInterval(update, 1000);
}
function showAdminView() {
}

document.addEventListener("DOMContentLoaded", () => {
  const gate = document.getElementById("auth-gate");
  document.getElementById("signup-password-toggle")?.addEventListener("click", event => {
    const input = document.getElementById("signup-password");
    const visible = input.type === "text";
    input.type = visible ? "password" : "text";
    event.currentTarget.textContent = visible ? "แสดง" : "ซ่อน";
    event.currentTarget.setAttribute("aria-label", visible ? "Show password" : "Hide password");
  });
  document.getElementById("auth-key-form").addEventListener("submit", async event => {
    event.preventDefault(); pendingAuthKey = document.getElementById("auth-key").value.trim();
    try {
      const response = await postAuth("/api/auth/key", { key: pendingAuthKey });
      const result = await readApiResponse(response);
      if (!response.ok) throw new Error(result.error === "KEY_INVALID_OR_EXPIRED" ? "ไม่พบคีย์หรือคีย์หมดอายุ" : "ตรวจสอบคีย์ไม่สำเร็จ");
      const login = await postAuth("/api/auth/login", { key: pendingAuthKey });
      const loginResult = await readApiResponse(login);
      if (!login.ok) throw new Error("ไม่สามารถเข้าสู่ระบบได้");
      openApp(loginResult);
    } catch (error) { authMessage(error.message); }
  });
  document.querySelectorAll("#logout-btn, #mobile-logout-btn").forEach(button => button.addEventListener("click", () => { localStorage.removeItem(AUTH_TOKEN_KEY); localStorage.removeItem(AUTH_KEY_KEY); localStorage.removeItem("igh_kinglegacy_is_admin"); localStorage.removeItem("igh_kinglegacy_expires_at"); location.reload(); }));
  if (localStorage.getItem(AUTH_TOKEN_KEY) && localStorage.getItem(AUTH_KEY_KEY)) {
    pendingAuthKey = localStorage.getItem(AUTH_KEY_KEY);
    postAuth("/api/auth/key", { key: pendingAuthKey }).then(async response => {
      const keyResult = await readApiResponse(response);
      if (!response.ok) throw new Error("expired");
      const login = await postAuth("/api/auth/login", { key: pendingAuthKey });
      const loginResult = await readApiResponse(login);
      if (!login.ok) throw new Error("login_failed");
      openApp(loginResult);
    }).catch(() => {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_KEY_KEY);
      localStorage.removeItem("igh_kinglegacy_is_admin");
      localStorage.removeItem("igh_kinglegacy_expires_at");
    });
  }
});
