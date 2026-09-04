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
function showAccountView(registered) {
  document.getElementById("auth-key-step").classList.add("hidden");
  document.getElementById("auth-account-step").classList.remove("hidden");
  document.getElementById("auth-signup-view").classList.toggle("hidden", registered);
  document.getElementById("auth-login-view").classList.toggle("hidden", !registered);
  document.getElementById("login-key").value = pendingAuthKey;
}
function openApp(result) {
  localStorage.setItem(AUTH_TOKEN_KEY, result.token || "demo");
  localStorage.setItem(AUTH_KEY_KEY, pendingAuthKey);
  localStorage.setItem("igh_kinglegacy_is_admin", result.admin ? "1" : "0");
  if (result.expiresAt) localStorage.setItem("igh_kinglegacy_expires_at", String(result.expiresAt));
  if (result.admin) window.enableAdminUi?.();
  document.getElementById("auth-gate").classList.add("auth-complete");
  setTimeout(() => document.getElementById("auth-gate")?.remove(), 350);
  startKeyStatus(result.expiresAt);
}
function startKeyStatus(expiresAt) {
  const expiry = Number(expiresAt || localStorage.getItem("igh_kinglegacy_expires_at"));
  if (!expiry) return;
  let timer;
  const update = () => {
    const remaining = Math.max(0, expiry - Date.now());
    const seconds = Math.floor(remaining / 1000);
    const label = seconds >= 3600 ? `${Math.floor(seconds / 3600)} ชั่วโมง ${Math.floor(seconds % 3600 / 60)} นาที` : `${Math.floor(seconds / 60)} นาที ${seconds % 60} วินาที`;
    document.querySelectorAll(".key-status").forEach(el => { el.textContent = remaining ? `คีย์เหลือ ${label}` : "คีย์หมดอายุ"; el.classList.remove("hidden"); });
    if (!remaining) clearInterval(timer);
  };
  update();
  timer = setInterval(update, 1000);
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
      if (result.registered) { const login = await postAuth("/api/auth/login", { key: pendingAuthKey }); const loginResult = await readApiResponse(login); if (!login.ok) throw new Error("ไม่สามารถเข้าสู่ระบบได้"); openApp(loginResult); return; }
      showAccountView(false);
    } catch (error) { authMessage(error.message); }
  });
  document.getElementById("auth-back-btn").addEventListener("click", () => { document.getElementById("auth-account-step").classList.add("hidden"); document.getElementById("auth-key-step").classList.remove("hidden"); authMessage(""); });
  document.querySelectorAll("#logout-btn, #mobile-logout-btn").forEach(button => button.addEventListener("click", () => { localStorage.removeItem(AUTH_TOKEN_KEY); localStorage.removeItem(AUTH_KEY_KEY); localStorage.removeItem("igh_kinglegacy_is_admin"); localStorage.removeItem("igh_kinglegacy_expires_at"); location.reload(); }));
  document.getElementById("auth-login-switch").addEventListener("click", () => { document.getElementById("auth-signup-view").classList.add("hidden"); document.getElementById("auth-login-view").classList.remove("hidden"); });
  document.getElementById("auth-signup-form").addEventListener("submit", async event => {
    event.preventDefault();
    const body = { key: pendingAuthKey, name: document.getElementById("signup-name").value, email: document.getElementById("signup-email").value };
    body.password = document.getElementById("signup-password").value;
    const fields = [["signup-name", body.name.trim().length > 0], ["signup-email", /^\S+@\S+\.\S+$/.test(body.email)], ["signup-password", /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{9,}$/.test(body.password)]];
    fields.forEach(([id, valid]) => { const input = document.getElementById(id); const error = document.getElementById(`${id}-error`); input.setAttribute("aria-invalid", String(!valid)); error.textContent = valid ? "" : id === "signup-password" ? "รหัสผ่านไม่ตรงเงื่อนไข" : "กรุณากรอกข้อมูลให้ถูกต้อง"; });
    if (fields.some(([, valid]) => !valid)) return;
    try { const response = await postAuth("/api/auth/signup", body); const result = await readApiResponse(response); if (!response.ok) throw new Error(result.error === "INVALID_FIELDS" ? "กรุณากรอกชื่อและอีเมลให้ถูกต้อง" : "คีย์ถูกใช้แล้วหรือหมดอายุ"); const login = await postAuth("/api/auth/login", { key: pendingAuthKey }); const loginResult = await readApiResponse(login); if (!login.ok) throw new Error("สมัครสำเร็จแต่เข้าสู่ระบบไม่สำเร็จ"); openApp({ ...loginResult, expiresAt: result.expiresAt }); } catch (error) { authMessage(error.message); }
  });
  document.getElementById("auth-login-form").addEventListener("submit", async event => {
    event.preventDefault(); pendingAuthKey = document.getElementById("login-key").value.trim();
    try { const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: pendingAuthKey }) }); const result = await readApiResponse(response); if (!response.ok) throw new Error("ไม่พบบัญชีหรือบัญชีหมดอายุแล้ว"); openApp(result); } catch (error) { authMessage(error.message); }
  });
  if (localStorage.getItem(AUTH_TOKEN_KEY) && localStorage.getItem(AUTH_KEY_KEY)) { pendingAuthKey = localStorage.getItem(AUTH_KEY_KEY); fetch("/api/auth/key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: pendingAuthKey }) }).then(async response => { if (response.ok) { openApp({ token: localStorage.getItem(AUTH_TOKEN_KEY), expiresAt: (await readApiResponse(response)).expiresAt, admin: localStorage.getItem("igh_kinglegacy_is_admin") === "1" }); } else { localStorage.removeItem(AUTH_TOKEN_KEY); localStorage.removeItem(AUTH_KEY_KEY); localStorage.removeItem("igh_kinglegacy_is_admin"); localStorage.removeItem("igh_kinglegacy_expires_at"); } }); }
});
