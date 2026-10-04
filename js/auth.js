const AUTH_TOKEN_KEY = "igh_kinglegacy_auth_token";
const AUTH_KEY_KEY = "igh_kinglegacy_auth_key";
let pendingAuthKey = "";
let keyStatusTimer = null;
const authApi = path => fetch(path, { headers: { "Content-Type": "application/json" } });
async function readApiResponse(response) {
  const text = await response.text();
  try { return text ? JSON.parse(text) : {}; }
  catch (error) { throw new Error(location.protocol === "file:" ? t("auth_local_server_required") : t("auth_server_response_invalid")); }
}
async function postAuth(path, body) {
  try { return await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
  catch (error) { throw new Error(t("auth_server_unavailable")); }
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
  window.refreshUserProfile?.();
  window.refreshSupportRequestStatus?.();
  window.activateUserState?.(result.ownerId || result.user?.id || result.keyId || "guest");
  if (result.admin && sessionStorage.getItem("igh_pending_admin_route") === "1") {
    sessionStorage.removeItem("igh_pending_admin_route");
    setTimeout(() => window.showPage?.("admin"), 400);
  }
}
function startKeyStatus(expiresAt) {
  clearInterval(keyStatusTimer);
  const expiry = Number(expiresAt || localStorage.getItem("igh_kinglegacy_expires_at"));
  const isAdmin = localStorage.getItem("igh_kinglegacy_is_admin") === "1";
  if (!expiry && !isAdmin) return;
  const update = () => {
    const remaining = expiry ? Math.max(0, expiry - Date.now()) : null;
    const seconds = Math.floor(remaining / 1000);
    const label = remaining === null ? t("key_time_unlimited") : seconds >= 3600 ? t("key_time_hours_minutes", { h: Math.floor(seconds / 3600), m: Math.floor(seconds % 3600 / 60) }) : t("key_time_minutes_seconds", { m: Math.floor(seconds / 60), s: seconds % 60 });
    document.querySelectorAll(".key-status").forEach(el => { el.textContent = isAdmin ? t("key_status_admin") : t("key_status_remaining", { time: label }); el.classList.remove("hidden"); });
    if (remaining === 0) clearInterval(keyStatusTimer);
  };
  update();
  if (expiry) keyStatusTimer = setInterval(update, 1000);
}
window.refreshAuthTranslations = () => {
  updateKeySettings({ expiresAt: Number(localStorage.getItem("igh_kinglegacy_expires_at")) || null, admin: localStorage.getItem("igh_kinglegacy_is_admin") === "1" });
  startKeyStatus(Number(localStorage.getItem("igh_kinglegacy_expires_at")) || null);
  refreshIdentitySettings();
};
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
    if (!configResponse.ok) throw new Error(t("auth_identity_load_provider_failed"));
    config = await configResponse.json();
    const response = await fetch("/api/auth/identities", { headers: { Authorization: `Bearer ${localStorage.getItem(AUTH_TOKEN_KEY) || ""}` } });
    if (!response.ok) throw new Error(t("auth_identity_load_failed"));
    identities = await response.json();
  } catch (error) {
    console.error("Could not refresh identity verification settings:", error);
    ["google", "discord"].forEach(provider => {
      const status = document.getElementById(`${provider}-identity-status`);
      if (status) status.textContent = t("identity_check_failed");
    });
    return;
  }
  ["google", "discord"].forEach(provider => {
    const linked = identities.find(identity => identity.provider === provider);
    const status = document.getElementById(`${provider}-identity-status`);
    const verifyButton = document.querySelector(`[data-identity-verify="${provider}"]`);
    const unlinkButton = document.querySelector(`[data-identity-unlink="${provider}"]`);
    const configured = Boolean(config[`${provider}Configured`]);
    if (status) status.textContent = linked ? t("identity_verified_name", { name: linked.displayName }) : configured ? t("identity_not_verified") : t("identity_config_failed");
    if (verifyButton) {
      verifyButton.disabled = !configured || Boolean(linked);
      verifyButton.title = configured ? "" : t("identity_admin_setup");
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
  fetch("/api/config").then(response => response.json()).then(config => githubButton?.classList.toggle("hidden", !config.githubConfigured)).catch(error => console.error("Could not load authentication configuration:", error));
  const identityResult = new URLSearchParams(location.search).get("identity");
  if (identityResult) {
    const messages = { verified: t("identity_result_verified"), failed: t("identity_result_failed"), conflict: t("identity_result_conflict"), "key-expired": t("identity_result_expired") };
    const notice = document.getElementById("identity-verification-result");
    if (notice) {
      notice.textContent = messages[identityResult] || t("identity_result_failed");
      notice.classList.remove("hidden");
      notice.classList.toggle("text-rose-300", identityResult !== "verified");
      notice.classList.toggle("text-emerald-300", identityResult === "verified");
    } else {
      authMessage(messages[identityResult] || t("identity_result_failed"), identityResult !== "verified");
    }
    history.replaceState({}, "", location.pathname);
  }
  document.querySelectorAll("[data-identity-verify]").forEach(button => button.addEventListener("click", async () => {
    const provider = button.dataset.identityVerify;
    button.disabled = true;
    try {
      const response = await fetch(`/api/auth/${provider}/verify`, { method: "POST", headers: { Authorization: `Bearer ${localStorage.getItem(AUTH_TOKEN_KEY) || ""}` } });
      const result = await readApiResponse(response);
      if (!response.ok) throw new Error(result.error === "IDENTITY_PROVIDER_NOT_CONFIGURED" ? t("auth_identity_provider_unconfigured") : t("auth_identity_start_failed"));
      location.href = result.url;
    } catch (error) { authMessage(error.message); button.disabled = false; }
  }));
  document.querySelectorAll("[data-identity-unlink]").forEach(button => button.addEventListener("click", async () => {
    const provider = button.dataset.identityUnlink;
    try {
      const response = await fetch(`/api/auth/${provider}/verify`, { method: "DELETE", headers: { Authorization: `Bearer ${localStorage.getItem(AUTH_TOKEN_KEY) || ""}` } });
      if (!response.ok) throw new Error(t("auth_identity_unlink_failed"));
      await refreshIdentitySettings();
      await window.refreshUserProfile?.();
      await window.refreshSupportRequestStatus?.();
    } catch (error) { toast(error.message, "error"); }
  }));
  githubButton?.addEventListener("click", () => { location.href = "/api/auth/github"; });
  if (new URLSearchParams(location.search).get("github") === "success") {
    fetch("/api/auth/session", { credentials: "same-origin" }).then(async response => {
      const result = await readApiResponse(response);
      if (!response.ok || !result.admin) throw new Error(t("auth_github_confirm_failed"));
      pendingAuthKey = ""; openApp(result); history.replaceState({}, "", location.pathname);
    }).catch(error => authMessage(error.message));
  }
  if (new URLSearchParams(location.search).get("github") === "failed") authMessage(t("auth_github_failed"));
  document.getElementById("signup-password-toggle")?.addEventListener("click", event => {
    const input = document.getElementById("signup-password");
    const visible = input.type === "text";
    input.type = visible ? "password" : "text";
    event.currentTarget.textContent = visible ? t("auth_github_password_show") : t("auth_github_password_hide");
    event.currentTarget.setAttribute("aria-label", visible ? t("auth_github_password_show") : t("auth_github_password_hide"));
  });
  document.getElementById("auth-key-form").addEventListener("submit", async event => {
    event.preventDefault(); pendingAuthKey = document.getElementById("auth-key").value.trim();
    try {
      const response = await postAuth("/api/auth/key", { key: pendingAuthKey });
      const result = await readApiResponse(response);
      if (!response.ok) throw new Error(result.error === "KEY_INVALID_OR_EXPIRED" ? t("auth_key_invalid") : t("auth_key_check_failed"));
      const login = await postAuth("/api/auth/login", { key: pendingAuthKey });
      const loginResult = await readApiResponse(login);
      if (!login.ok) throw new Error(t("auth_login_failed"));
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
