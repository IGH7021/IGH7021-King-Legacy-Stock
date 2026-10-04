let supportRequestSubmitted = null;
let supportRequestLoading = false;
let supportRequestStatusKey = "request_available";
let supportRequestVerified = false;
let supportRequestCountdownTimer = null;

function millisecondsUntilBangkokMidnight(now = Date.now()) {
  const bangkokNow = new Date(now + 7 * 60 * 60 * 1000);
  const nextMidnightUtc = Date.UTC(
    bangkokNow.getUTCFullYear(),
    bangkokNow.getUTCMonth(),
    bangkokNow.getUTCDate() + 1,
  ) - 7 * 60 * 60 * 1000;
  return Math.max(0, nextMidnightUtc - now);
}

function stopSupportRequestCountdown() {
  if (supportRequestCountdownTimer) clearInterval(supportRequestCountdownTimer);
  supportRequestCountdownTimer = null;
}

function updateSupportRequestCountdown() {
  const countdown = document.getElementById("support-request-countdown");
  if (!countdown || !supportRequestVerified || supportRequestSubmitted !== true) {
    stopSupportRequestCountdown();
    if (countdown) countdown.classList.add("hidden");
    return;
  }
  const remainingSeconds = Math.ceil(millisecondsUntilBangkokMidnight() / 1000);
  if (remainingSeconds <= 0) {
    stopSupportRequestCountdown();
    refreshSupportRequestStatus();
    return;
  }
  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;
  countdown.textContent = t("request_cooldown_remaining", { hours, minutes, seconds });
  countdown.classList.remove("hidden");
}

function startSupportRequestCountdown() {
  if (supportRequestCountdownTimer) return;
  updateSupportRequestCountdown();
  if (supportRequestSubmitted === true && supportRequestVerified) {
    supportRequestCountdownTimer = setInterval(updateSupportRequestCountdown, 1000);
  }
}

function renderSupportRequestStatus(messageKey = null) {
  const status = document.getElementById("support-request-status");
  const form = document.getElementById("support-request-form");
  const submit = document.getElementById("support-request-submit");
  if (messageKey) supportRequestStatusKey = messageKey;
  else if (supportRequestSubmitted !== null) supportRequestStatusKey = supportRequestSubmitted ? "request_submitted_today" : "request_available";
  if (status) status.textContent = t(supportRequestStatusKey);
  if (form) form.classList.toggle("hidden", !supportRequestVerified || supportRequestSubmitted === true);
  if (submit) submit.disabled = !supportRequestVerified || supportRequestLoading || supportRequestSubmitted === true;
  if (supportRequestVerified && supportRequestSubmitted === true) startSupportRequestCountdown();
  else {
    stopSupportRequestCountdown();
    document.getElementById("support-request-countdown")?.classList.add("hidden");
  }
}

async function refreshSupportRequestStatus() {
  const section = document.getElementById("support-request-section");
  const isAdmin = localStorage.getItem("igh_kinglegacy_is_admin") === "1";
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const hasKey = Boolean(localStorage.getItem(AUTH_KEY_KEY));
  if (!section) return;
  section.classList.toggle("hidden", !token || token === "demo" || !hasKey || isAdmin);
  if (!token || token === "demo" || !hasKey || isAdmin) return;
  supportRequestVerified = false;
  supportRequestSubmitted = null;
  renderSupportRequestStatus("request_verify_first");
  try {
    const profileResponse = await fetch("/api/profile", { headers: { Authorization: `Bearer ${token}` } });
    const profile = await readApiResponse(profileResponse);
    if (!profileResponse.ok) throw new Error(profile.error || "PROFILE_LOAD_FAILED");
    if (!profile.verified) return;
    supportRequestVerified = true;
    const response = await fetch("/api/requests", { headers: { Authorization: `Bearer ${token}` } });
    const result = await readApiResponse(response);
    if (!response.ok) throw new Error(result.error || "REQUEST_STORAGE_UNAVAILABLE");
    supportRequestSubmitted = Boolean(result.submitted);
    renderSupportRequestStatus();
  } catch (error) {
    console.error("Could not load daily request status:", error);
    if (error.message === "VERIFIED_IDENTITY_REQUIRED") supportRequestVerified = false;
    renderSupportRequestStatus(error.message === "VERIFIED_IDENTITY_REQUIRED" ? "request_verify_first" : error.message === "ACTIVE_KEY_LOGIN_REQUIRED" ? "request_login_required" : "request_status_failed");
  }
}
window.refreshSupportRequestStatus = refreshSupportRequestStatus;
window.refreshSupportRequestUi = renderSupportRequestStatus;

function renderSupportRequestCount() {
  const input = document.getElementById("support-request-message");
  const count = document.getElementById("support-request-count");
  if (input && count) count.textContent = t("request_char_count", { count: input.value.length });
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("support-request-form");
  const input = document.getElementById("support-request-message");
  input?.addEventListener("input", renderSupportRequestCount);
  form?.addEventListener("submit", async event => {
    event.preventDefault();
    if (!supportRequestVerified) {
      renderSupportRequestStatus("request_verify_first");
      return;
    }
    if (!input || input.value.trim().length < 3 || input.value.trim().length > 1000) {
      renderSupportRequestStatus("request_invalid");
      return;
    }
    const button = document.getElementById("support-request-submit");
    supportRequestLoading = true;
    if (button) button.disabled = true;
    renderSupportRequestStatus("request_sending");
    try {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem(AUTH_TOKEN_KEY) || ""}` },
        body: JSON.stringify({ message: input.value.trim() }),
      });
      const result = await readApiResponse(response);
      if (!response.ok) {
        if (response.status === 429 || result.error === "REQUEST_DAILY_LIMIT") {
          supportRequestSubmitted = true;
          renderSupportRequestStatus();
          return;
        }
        throw new Error(result.error || "REQUEST_STORAGE_UNAVAILABLE");
      }
      supportRequestSubmitted = true;
      input.value = "";
      renderSupportRequestCount();
      renderSupportRequestStatus();
      toast(t("request_sent"));
    } catch (error) {
      console.error("Could not submit support request:", error);
      if (error.message === "VERIFIED_IDENTITY_REQUIRED") supportRequestVerified = false;
      const message = error.message === "INVALID_REQUEST_MESSAGE" ? "request_invalid" : error.message === "VERIFIED_IDENTITY_REQUIRED" ? "request_verify_first" : error.message === "ACTIVE_KEY_LOGIN_REQUIRED" ? "request_login_required" : "request_submit_failed";
      renderSupportRequestStatus(message);
    } finally {
      supportRequestLoading = false;
      if (button) button.disabled = !supportRequestVerified || supportRequestSubmitted === true;
    }
  });
  renderSupportRequestCount();
});
