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
  if (pendingAuthKey) localStorage.setItem(AUTH_KEY_KEY, pendingAuthKey);
  else localStorage.removeItem(AUTH_KEY_KEY);
  if (result.ownerId) localStorage.setItem("igh_kinglegacy_owner_id", result.ownerId);
  localStorage.setItem("igh_kinglegacy_auth_method", result.githubLogin ? "github" : "key");
  localStorage.setItem("igh_kinglegacy_is_admin", result.admin ? "1" : "0");
  if (result.expiresAt) localStorage.setItem("igh_kinglegacy_expires_at", String(result.expiresAt));
  else localStorage.removeItem("igh_kinglegacy_expires_at");
  if (result.admin) window.enableAdminUi?.();
  document.getElementById("auth-gate").classList.add("auth-complete");
  setTimeout(() => document.getElementById("auth-gate")?.remove(), 350);
  startKeyStatus(result.expiresAt);
  window.updateKeySettings?.(result);
  window.refreshIdentitySettings?.();
  window.activateUserState?.(result.ownerId || result.user?.id || result.keyId || "guest");
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
async function refreshIdentitySettings() {
  const panel = document.getElementById("identity-verification-settings");
  if (!panel) return;
  const hasKey = Boolean(localStorage.getItem(AUTH_KEY_KEY));
  const isAdmin = localStorage.getItem("igh_kinglegacy_is_admin") === "1";
  panel.classList.toggle("hidden", !hasKey || isAdmin);
  if (!hasKey || isAdmin) return;
  let config;
  let identities;
  try {
    const configResponse = await fetch("/api/config");
    if (!configResponse.ok) throw new Error("โหลดการตั้งค่าผู้ให้บริการยืนยันตัวตนไม่สำเร็จ");
    config = await configResponse.json();
    const response = await fetch("/api/auth/identities", { headers: { Authorization: `Bearer ${localStorage.getItem(AUTH_TOKEN_KEY) || ""}` } });
    if (!response.ok) throw new Error("โหลดข้อมูลการยืนยันตัวตนไม่สำเร็จ");
    identities = await response.json();
  } catch (error) {
    console.error("Could not refresh identity verification settings:", error);
    ["google", "discord"].forEach(provider => {
      const status = document.getElementById(`${provider}-identity-status`);
      if (status) status.textContent = "โหลดสถานะไม่สำเร็จ กรุณาลองใหม่";
    });
    return;
  }
  ["google", "discord"].forEach(provider => {
    const linked = identities.find(identity => identity.provider === provider);
    const status = document.getElementById(`${provider}-identity-status`);
    const verifyButton = document.querySelector(`[data-identity-verify="${provider}"]`);
    const unlinkButton = document.querySelector(`[data-identity-unlink="${provider}"]`);
    const configured = Boolean(config[`${provider}Configured`]);
    if (status) status.textContent = linked ? `ยืนยันแล้ว: ${linked.displayName}` : configured ? "ยังไม่ได้ยืนยัน" : "ยังไม่ได้ตั้งค่า OAuth ของผู้ให้บริการนี้";
    if (verifyButton) {
      verifyButton.disabled = !configured || Boolean(linked);
      verifyButton.title = configured ? "" : "ผู้ดูแลระบบต้องตั้งค่า OAuth credentials ก่อน";
    }
    unlinkButton?.classList.toggle("hidden", !linked);
  });
}
window.refreshIdentitySettings = refreshIdentitySettings;
function showAdminView() {
}

document.addEventListener("DOMContentLoaded", () => {
  const gate = document.getElementById("auth-gate");
  const githubButton = document.getElementById("github-admin-login");
  fetch("/api/config").then(response => response.json()).then(config => githubButton?.classList.toggle("hidden", !config.githubConfigured)).catch(() => {});
  const identityResult = new URLSearchParams(location.search).get("identity");
  if (identityResult) {
    const messages = { verified: "ยืนยันตัวตนสำเร็จ", failed: "ยืนยันตัวตนไม่สำเร็จ กรุณาลองใหม่", conflict: "บัญชีนี้หรือคีย์นี้ผูกกับผู้ให้บริการอื่นแล้ว", "key-expired": "คีย์หมดอายุแล้ว ไม่สามารถยืนยันตัวตนได้" };
    const notice = document.getElementById("identity-verification-result");
    if (notice) {
      notice.textContent = messages[identityResult] || "ยืนยันตัวตนไม่สำเร็จ กรุณาลองใหม่";
      notice.classList.remove("hidden");
      notice.classList.toggle("text-rose-300", identityResult !== "verified");
      notice.classList.toggle("text-emerald-300", identityResult === "verified");
    } else {
      authMessage(messages[identityResult] || "ยืนยันตัวตนไม่สำเร็จ กรุณาลองใหม่", identityResult !== "verified");
    }
    history.replaceState({}, "", location.pathname);
  }
  document.querySelectorAll("[data-identity-verify]").forEach(button => button.addEventListener("click", async () => {
    const provider = button.dataset.identityVerify;
    button.disabled = true;
    try {
      const response = await fetch(`/api/auth/${provider}/verify`, { method: "POST", headers: { Authorization: `Bearer ${localStorage.getItem(AUTH_TOKEN_KEY) || ""}` } });
      const result = await readApiResponse(response);
      if (!response.ok) throw new Error(result.error === "IDENTITY_PROVIDER_NOT_CONFIGURED" ? "ผู้ให้บริการนี้ยังตั้งค่าไม่ครบ" : "ไม่สามารถเริ่มยืนยันตัวตนได้");
      location.href = result.url;
    } catch (error) { authMessage(error.message); button.disabled = false; }
  }));
  document.querySelectorAll("[data-identity-unlink]").forEach(button => button.addEventListener("click", async () => {
    const provider = button.dataset.identityUnlink;
    try {
      const response = await fetch(`/api/auth/${provider}/verify`, { method: "DELETE", headers: { Authorization: `Bearer ${localStorage.getItem(AUTH_TOKEN_KEY) || ""}` } });
      if (!response.ok) throw new Error("ยกเลิกการยืนยันตัวตนไม่สำเร็จ");
      await refreshIdentitySettings();
    } catch (error) { toast(error.message, "error"); }
  }));
  githubButton?.addEventListener("click", () => { location.href = "/api/auth/github"; });
  if (new URLSearchParams(location.search).get("github") === "success") {
    fetch("/api/auth/session", { credentials: "same-origin" }).then(async response => {
      const result = await readApiResponse(response);
      if (!response.ok || !result.admin) throw new Error("ไม่สามารถยืนยันบัญชีผู้ดูแล GitHub ได้");
      pendingAuthKey = ""; openApp(result); history.replaceState({}, "", location.pathname);
    }).catch(error => authMessage(error.message));
  }
  if (new URLSearchParams(location.search).get("github") === "failed") authMessage("เข้าสู่ระบบ GitHub ไม่สำเร็จ หรือบัญชีนี้ไม่ได้รับอนุญาต");
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
  document.querySelectorAll("#logout-btn, #mobile-logout-btn").forEach(button => button.addEventListener("click", async () => { await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => {}); localStorage.removeItem(AUTH_TOKEN_KEY); localStorage.removeItem(AUTH_KEY_KEY); localStorage.removeItem("igh_kinglegacy_is_admin"); localStorage.removeItem("igh_kinglegacy_expires_at"); localStorage.removeItem("igh_kinglegacy_owner_id"); localStorage.removeItem("igh_kinglegacy_auth_method"); location.reload(); }));
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
  } else if (localStorage.getItem("igh_kinglegacy_auth_method") === "github") {
    fetch("/api/auth/session", { credentials: "same-origin" }).then(async response => { const result = await readApiResponse(response); if (!response.ok) throw new Error("session expired"); pendingAuthKey = ""; openApp(result); }).catch(() => {
      localStorage.removeItem(AUTH_TOKEN_KEY); localStorage.removeItem("igh_kinglegacy_is_admin"); localStorage.removeItem("igh_kinglegacy_owner_id"); localStorage.removeItem("igh_kinglegacy_auth_method");
    });
  }
});
