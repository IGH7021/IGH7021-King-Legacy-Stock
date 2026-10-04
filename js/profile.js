let profileState = { verified: false, provider: null, displayName: "", avatarData: "", avatarUrl: "", presenceStatus: "online" };
let profileReady = false;

function profileHeaders() {
  return { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem(AUTH_TOKEN_KEY) || ""}` };
}

function renderProfile() {
  const section = document.getElementById("user-profile-section");
  const suggestionSection = document.getElementById("site-suggestion-section");
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const isAdmin = localStorage.getItem("igh_kinglegacy_is_admin") === "1";
  if (!section || !suggestionSection) return;
  section.classList.toggle("hidden", !token || token === "demo" || isAdmin);
  suggestionSection.classList.toggle("hidden", !token || token === "demo" || isAdmin);
  if (!token || token === "demo" || isAdmin) return;

  const name = document.getElementById("user-profile-name");
  const provider = document.getElementById("user-profile-provider");
  const image = document.getElementById("user-profile-avatar");
  const fallback = document.getElementById("user-profile-avatar-fallback");
  const presence = document.getElementById("user-profile-presence");
  const statusSelect = document.getElementById("profile-presence-select");
  const suggestionStatus = document.getElementById("suggestion-identity-status");
  const suggestionButton = document.getElementById("open-suggestion-dialog");

  if (name) name.textContent = profileState.displayName || t("profile_not_verified");
  if (provider) provider.textContent = profileState.provider ? t(`identity_provider_${profileState.provider}`) : t("profile_identity_required");
  if (image && fallback) {
    const avatar = profileState.avatarData || profileState.avatarUrl;
    image.hidden = !avatar;
    if (avatar) image.src = avatar;
    else image.removeAttribute("src");
    fallback.hidden = Boolean(avatar);
    fallback.textContent = profileState.displayName?.trim().slice(0, 1).toUpperCase() || "👤";
  }
  if (presence) {
    const online = profileState.presenceStatus === "online";
    presence.classList.toggle("is-online", online);
    presence.classList.toggle("is-offline", !online);
    presence.dataset.status = online ? "online" : "offline";
    presence.setAttribute("aria-label", t(online ? "presence_online" : "presence_offline"));
  }
  if (statusSelect) statusSelect.value = profileState.presenceStatus;
  if (suggestionStatus) suggestionStatus.textContent = profileState.verified
    ? t("suggestion_verified_as", { name: profileState.displayName, provider: t(`identity_provider_${profileState.provider}`) })
    : t("suggestion_verify_first");
  if (suggestionButton) suggestionButton.disabled = !profileState.verified;
}

async function refreshUserProfile() {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token || token === "demo" || localStorage.getItem("igh_kinglegacy_is_admin") === "1") {
    profileReady = false;
    renderProfile();
    return;
  }
  try {
    const response = await fetch("/api/profile", { headers: profileHeaders() });
    const result = await readApiResponse(response);
    if (!response.ok) throw new Error(result.error || "PROFILE_LOAD_FAILED");
    profileState = {
      verified: Boolean(result.verified),
      provider: result.provider || null,
      displayName: result.displayName || "",
      avatarData: result.avatarData || "",
      avatarUrl: result.avatarUrl || "",
      presenceStatus: result.presenceStatus === "offline" ? "offline" : "online",
    };
    profileReady = true;
    renderProfile();
  } catch (error) {
    profileReady = false;
    console.error("Could not load profile:", error);
    const status = document.getElementById("profile-save-status");
    if (status) status.textContent = t("profile_load_failed");
    const suggestionStatus = document.getElementById("suggestion-identity-status");
    if (suggestionStatus) suggestionStatus.textContent = t("profile_load_failed");
    const button = document.getElementById("open-suggestion-dialog");
    if (button) button.disabled = true;
  }
}
window.refreshUserProfile = refreshUserProfile;
window.refreshProfileTranslations = renderProfile;

async function profileImageData(file) {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) throw new Error("INVALID_PROFILE_IMAGE");
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error("INVALID_PROFILE_IMAGE"));
    });
    if (!image.naturalWidth || !image.naturalHeight) throw new Error("INVALID_PROFILE_IMAGE");
    const scale = Math.min(1, 150 / image.naturalWidth, 150 / image.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("INVALID_PROFILE_IMAGE");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function saveProfile() {
  const status = document.getElementById("profile-save-status");
  if (status) status.textContent = t("profile_saving");
  try {
    const response = await fetch("/api/profile", {
      method: "PUT",
      headers: profileHeaders(),
      body: JSON.stringify({ avatarData: profileState.avatarData, presenceStatus: profileState.presenceStatus }),
    });
    const result = await readApiResponse(response);
    if (!response.ok) throw new Error(result.error || "PROFILE_SAVE_FAILED");
    profileReady = true;
    renderProfile();
    const status = document.getElementById("profile-save-status");
    if (status) status.textContent = t("profile_saved");
    return true;
  } catch (error) {
    console.error("Could not save profile:", error);
    if (status) status.textContent = t(error.message === "INVALID_PROFILE_IMAGE" ? "profile_image_invalid" : "profile_save_failed");
    return false;
  }
}

function closeSuggestionDialog() {
  const dialog = document.getElementById("site-suggestion-dialog");
  if (dialog?.open) dialog.close();
}

document.addEventListener("DOMContentLoaded", () => {
  const avatarInput = document.getElementById("profile-avatar-input");
  const presenceSelect = document.getElementById("profile-presence-select");
  const avatarClear = document.getElementById("profile-avatar-clear");
  const dialog = document.getElementById("site-suggestion-dialog");
  const openDialogButton = document.getElementById("open-suggestion-dialog");
  const messageInput = document.getElementById("site-suggestion-message");
  const suggestionForm = document.getElementById("site-suggestion-form");
  const submitButton = document.getElementById("submit-site-suggestion");
  document.getElementById("user-profile-avatar")?.addEventListener("error", () => {
    const image = document.getElementById("user-profile-avatar");
    const fallback = document.getElementById("user-profile-avatar-fallback");
    if (image) image.hidden = true;
    if (fallback) fallback.hidden = false;
  });

  avatarInput?.addEventListener("change", async () => {
    const file = avatarInput.files?.[0];
    if (!file) return;
    try {
      const previous = profileState.avatarData;
      profileState.avatarData = await profileImageData(file);
      renderProfile();
      if (!await saveProfile()) {
        profileState.avatarData = previous;
        renderProfile();
      }
    } catch (error) {
      console.error("Could not process profile image:", error);
      const status = document.getElementById("profile-save-status");
      if (status) status.textContent = t("profile_image_invalid");
    } finally {
      avatarInput.value = "";
    }
  });
  presenceSelect?.addEventListener("change", async () => {
    const previous = profileState.presenceStatus;
    profileState.presenceStatus = presenceSelect.value === "offline" ? "offline" : "online";
    if (!await saveProfile()) {
      profileState.presenceStatus = previous;
      renderProfile();
    }
  });
  avatarClear?.addEventListener("click", async () => {
    const previous = profileState.avatarData;
    profileState.avatarData = "";
    renderProfile();
    if (!await saveProfile()) {
      profileState.avatarData = previous;
      renderProfile();
    }
  });
  openDialogButton?.addEventListener("click", () => {
    if (!profileState.verified || !dialog?.showModal) return;
    dialog.showModal();
    document.body.classList.add("dialog-scroll-locked");
    setTimeout(() => messageInput?.focus(), 0);
  });
  document.getElementById("close-suggestion-dialog")?.addEventListener("click", closeSuggestionDialog);
  document.getElementById("cancel-suggestion-dialog")?.addEventListener("click", closeSuggestionDialog);
  dialog?.addEventListener("click", event => {
    if (event.target === dialog) closeSuggestionDialog();
  });
  dialog?.addEventListener("close", () => {
    document.body.classList.remove("dialog-scroll-locked");
    openDialogButton?.focus();
  });
  suggestionForm?.addEventListener("submit", async event => {
    event.preventDefault();
    if (!profileState.verified || !messageInput || messageInput.value.trim().length < 3 || messageInput.value.trim().length > 2000) return;
    submitButton.disabled = true;
    document.getElementById("suggestion-submit-status").textContent = t("suggestion_sending");
    try {
      const response = await fetch("/api/suggestions", {
        method: "POST",
        headers: profileHeaders(),
        body: JSON.stringify({ message: messageInput.value.trim() }),
      });
      const result = await readApiResponse(response);
      if (!response.ok) throw new Error(result.error || "SUGGESTION_SUBMIT_FAILED");
      suggestionForm.reset();
      document.getElementById("suggestion-submit-status").textContent = t("suggestion_sent");
      setTimeout(closeSuggestionDialog, 700);
    } catch (error) {
      console.error("Could not submit site suggestion:", error);
      const errorKey = error.message === "VERIFIED_IDENTITY_REQUIRED" ? "suggestion_verify_first" : error.message === "INVALID_SUGGESTION" ? "suggestion_invalid" : "suggestion_submit_failed";
      document.getElementById("suggestion-submit-status").textContent = t(errorKey);
    } finally {
      submitButton.disabled = false;
    }
  });
});
