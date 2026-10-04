function adminHeaders() { return { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem(AUTH_TOKEN_KEY)}` }; }
function enableAdminUi() {
  document.querySelectorAll(".admin-only:not(.page)").forEach(el => el.classList.remove("hidden"));
  bindAdminKeyFilters();
  loadAdminKeys().catch(error => { if (error.message === t("admin_access_denied")) { document.querySelectorAll(".admin-only").forEach(el => el.classList.add("hidden")); } else toast(error.message, "error"); });
  if (!adminRequestsTimer) adminRequestsTimer = setInterval(() => {
    if (document.visibilityState !== "visible") return;
    if (!document.getElementById("admin-inbox-panel")?.classList.contains("hidden")) {
      loadAdminInbox().catch(error => console.error("Could not refresh Admin inbox:", error));
    }
  }, 20000);
}
function formatRemaining(ms) {
  if (ms === null) return t("admin_key_time_permanent");
  if (ms <= 0) return t("admin_key_time_expired");
  const minutes = Math.floor(ms / 60000);
  return minutes < 60 ? t("admin_key_time_minutes", { n: minutes }) : t("admin_key_time_hours", { h: Math.floor(minutes / 60), m: minutes % 60 });
}
function keyTimeLabel(key) {
  if (key.archived) return t("admin_key_archived");
  if (key.waitingForFirstUse) return t("admin_key_waiting", { time: formatRemaining(key.durationMs) });
  if (!key.permanent && key.remainingMs <= 0 && key.extensionRemainingMs > 0) return t("admin_key_extension", { time: formatRemaining(key.extensionRemainingMs) });
  return formatRemaining(key.remainingMs);
}
function keyTypeLabel(key) { return t(key.archived ? "admin_key_type_history" : key.admin ? "admin_key_type_admin" : key.permanent ? "admin_key_type_unlimited" : "admin_key_type_timed"); }
function keyTypeClass(key) { if (key.admin) return "bg-orange-500/15 text-orange-300"; if (key.permanent) return "bg-slate-700/60 text-slate-300"; return "bg-amber-500/15 text-amber-300"; }
let adminKeyFilter = "all";
let adminKeysCache = [];
let adminFiltersBound = false;
let adminRequestsTimer = null;
let adminRequestsCache = [];
let adminRequestsLoadError = false;
let adminKeysHasLoaded = false;
let adminKeysLoadError = false;
let adminSuggestions = [];
let adminInboxLoaded = false;
let adminSuggestionsError = false;
function beginAdminSkeleton(element, count, isStats = false) {
  if (!element) return () => {};
  element.setAttribute("aria-busy", "true");
  element.classList.add("skeleton-pending");
  element.innerHTML = Array.from({ length: count }, () => isStats
    ? `<div class="admin-stat-skeleton" aria-hidden="true"><span class="skeleton admin-skeleton-line"></span><span class="skeleton admin-skeleton-line admin-skeleton-line-short"></span></div>`
    : `<article class="admin-skeleton-card" aria-hidden="true"><span class="skeleton admin-skeleton-line"></span><span class="skeleton admin-skeleton-line admin-skeleton-line-short"></span></article>`).join("");
  const timer = setTimeout(() => element.classList.remove("skeleton-pending"), 200);
  return () => {
    clearTimeout(timer);
    element.classList.remove("skeleton-pending");
    element.setAttribute("aria-busy", "false");
  };
}
function escapeAdminRequestText(value) { return String(value ?? "").replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#039;" }[char])); }
function renderAdminInbox() {
  const list = document.getElementById("admin-inbox-list");
  const count = document.getElementById("admin-inbox-count");
  if (!list || !count || list.getAttribute("aria-busy") === "true") return;
  const entries = [
    ...adminSuggestions.map(item => ({ ...item, type: "suggestion", owner: item.displayName, avatar: item.avatarData })),
    ...adminRequestsCache.map(item => ({ ...item, type: "request", owner: item.owner, avatar: item.avatarUrl })),
  ].sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")));
  count.textContent = t("admin_inbox_count", { count: entries.length });
  const errors = [];
  if (adminSuggestionsError) errors.push(`<p class="text-sm text-rose-300">${t("admin_suggestions_load_failed")}</p>`);
  if (adminRequestsLoadError) errors.push(`<p class="text-sm text-rose-300">${t("admin_requests_load_failed")}</p>`);
  const cards = entries.map(item => {
    const online = item.type === "suggestion" && item.presenceStatus === "online";
    const avatar = typeof item.avatar === "string" && (
      /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(item.avatar)
      || /^https:\/\/lh3\.googleusercontent\.com\/[A-Za-z0-9_./=?&%-]+$/.test(item.avatar)
      || /^https:\/\/cdn\.discordapp\.com\/avatars\/\d+\/[A-Za-z0-9_]+\.png\?size=150$/.test(item.avatar)
    ) ? item.avatar : "";
    const createdAt = item.createdAt
      ? new Date(item.createdAt).toLocaleString(currentLang === "th" ? "th-TH" : "en-US", { timeZone: "Asia/Bangkok" })
      : item.requestDate || "";
    const provider = ["google", "discord"].includes(item.provider)
      ? t(`identity_provider_${item.provider}`)
      : "";
    const deleteButton = `<button type="button" class="admin-message-delete px-3 py-1.5 rounded-lg bg-rose-500/15 text-rose-300 text-xs" data-delete-inbox-message="${item.type}" data-message-id="${escapeAdminRequestText(item.id)}">${t("admin_inbox_delete")}</button>`;
    const presence = item.type === "suggestion"
      ? `<span class="presence-dot ${online ? "is-online" : "is-offline"}" role="img" aria-label="${t(online ? "presence_online" : "presence_offline")}"><span class="presence-halo" aria-hidden="true"></span></span>`
      : "";
    return `<article class="glass-card rounded-2xl p-4"><div class="flex items-start gap-3"><div class="profile-avatar-wrap admin-suggestion-avatar-wrap">${avatar ? `<img class="admin-suggestion-avatar" src="${escapeAdminRequestText(avatar)}" alt="">` : `<span class="admin-suggestion-avatar grid place-items-center" aria-hidden="true">👤</span>`}${presence}</div><div class="min-w-0 flex-1"><div class="flex flex-wrap items-center justify-between gap-2"><strong class="text-sm break-words">${escapeAdminRequestText(item.owner)}</strong><time class="text-xs text-slate-400">${escapeAdminRequestText(createdAt)}</time></div><div class="mt-1 flex flex-wrap items-center gap-2"><span class="admin-inbox-type">${t(item.type === "suggestion" ? "admin_inbox_suggestion" : "admin_inbox_request")}</span>${provider ? `<span class="text-xs text-slate-400">${escapeAdminRequestText(provider)}</span>` : ""}${item.type === "suggestion" ? `<span class="text-xs text-slate-400">${t(online ? "presence_online" : "presence_offline")}</span>` : ""}</div><p class="mt-3 text-sm whitespace-pre-wrap break-words">${escapeAdminRequestText(item.message)}</p></div>${deleteButton}</div></article>`;
  });
  if (!entries.length && !errors.length) errors.push(`<p class="text-sm text-slate-400">${t("admin_inbox_empty")}</p>`);
  list.innerHTML = [...errors, ...cards].join("");
}
async function loadAdminInbox() {
  const list = document.getElementById("admin-inbox-list");
  const finishLoading = !adminInboxLoaded ? beginAdminSkeleton(list, 3) : () => {};
  const load = async (path, errorCode) => {
    const response = await fetch(path, { headers: adminHeaders() });
    const result = await readApiResponse(response);
    if (!response.ok) throw new Error(result.error || errorCode);
    return result;
  };
  try {
    const [suggestions, requests] = await Promise.allSettled([
      load("/api/admin/suggestions", "SUGGESTION_STORAGE_UNAVAILABLE"),
      load("/api/admin/requests", "REQUEST_STORAGE_UNAVAILABLE"),
    ]);
    adminSuggestionsError = suggestions.status === "rejected";
    adminRequestsLoadError = requests.status === "rejected";
    if (suggestions.status === "fulfilled") adminSuggestions = suggestions.value;
    if (requests.status === "fulfilled") adminRequestsCache = requests.value;
    if (adminSuggestionsError || adminRequestsLoadError) {
      throw new Error("ADMIN_INBOX_PARTIAL_FAILURE");
    }
  } finally {
    adminInboxLoaded = true;
    finishLoading();
    renderAdminInbox();
  }
}
function bindAdminKeyFilters() {
  if (adminFiltersBound) return;
  adminFiltersBound = true;
  document.addEventListener("click", event => {
    const button = event.target.closest("[data-key-filter]");
    if (!button) return;
    adminKeyFilter = button.dataset.keyFilter;
    document.querySelectorAll("[data-key-filter]").forEach(item => item.classList.toggle("is-selected", item === button));
    renderAdminKeyList(adminKeysCache);
  });
}
function renderAdminKeyList(keys) {
  const list = document.getElementById("admin-key-list");
  if (list?.getAttribute("aria-busy") === "true") return;
  if (adminKeysLoadError) { list.innerHTML = `<p class="text-sm text-rose-300">${t("admin_key_load_failed")}</p>`; return; }
  const matchesFilter = key => adminKeyFilter === "all" || (adminKeyFilter === "archived" ? key.archived : adminKeyFilter === "expired" ? (!key.permanent && (key.archived || (!key.waitingForFirstUse && key.remainingMs <= 0))) : adminKeyFilter === "admin" ? key.admin : adminKeyFilter === "unlimited" ? (!key.admin && key.permanent) : adminKeyFilter === "limited" ? (!key.permanent && !key.archived && (key.waitingForFirstUse || key.remainingMs > 0)) : (key.admin || key.permanent || key.waitingForFirstUse || key.remainingMs > 0));
  const sortedKeys = keys.filter(matchesFilter).sort((a, b) => {
    const aExpired = a.archived || (!a.permanent && !a.waitingForFirstUse && a.remainingMs <= 0);
    const bExpired = b.archived || (!b.permanent && !b.waitingForFirstUse && b.remainingMs <= 0);
    if (aExpired !== bExpired) return aExpired ? 1 : -1;
    if (a.admin !== b.admin) return a.admin ? -1 : 1;
    if (a.permanent !== b.permanent) return a.permanent ? -1 : 1;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
  list.innerHTML = sortedKeys.map(key => {
    const expired = key.archived || (!key.permanent && !key.waitingForFirstUse && key.remainingMs <= 0);
    const stateColor = key.archived || expired ? "text-rose-300" : key.waitingForFirstUse ? "text-cyan-300" : "text-emerald-300";
    const owner = escapeReportText(key.user || t("admin_key_owner_none"));
    const keyValue = escapeReportText(key.value);
    const timeButtons = !key.permanent && !key.archived
      ? `<div class="key-time-controls"><button data-key-time="-1" data-key-id="${escapeReportText(key.id)}" type="button" aria-label="${t("admin_key_remove_hour")}" title="${t("admin_key_remove_hour")}">−1 h</button><button data-key-time="1" data-key-id="${escapeReportText(key.id)}" type="button" aria-label="${t("admin_key_add_hour")}" title="${t("admin_key_add_hour")}">+1 h</button></div>`
      : "";
    return `<div class="glass-card rounded-xl p-3 flex flex-wrap items-center gap-3 ${expired ? "opacity-70" : ""}"><code class="flex-1 text-xs break-all">${keyValue}</code><button data-copy-key="${keyValue}" type="button" class="px-3 py-1.5 rounded-lg bg-slate-700/60 text-xs">${t("admin_copy")}</button><span class="px-2 py-1 rounded-full text-[11px] ${keyTypeClass(key)}">${keyTypeLabel(key)}</span><span class="text-xs ${stateColor}">${owner} · ${keyTimeLabel(key)}</span>${timeButtons}</div>`;
  }).join("") || `<p class="text-sm text-slate-400 text-center py-6">${t("admin_key_empty")}</p>`;
}
function renderAdminKeyStats(keys) {
  const stats = document.getElementById("admin-key-stats");
  if (!stats) return;
  const active = keys.filter(key => key.permanent || key.waitingForFirstUse || key.remainingMs > 0).length;
  const expired = keys.filter(key => !key.permanent && (key.archived || (!key.waitingForFirstUse && key.remainingMs <= 0))).length;
  stats.innerHTML = `<div class="glass-card rounded-xl p-3"><small>${t("admin_stat_total")}</small><strong>${keys.length}</strong></div><div class="glass-card rounded-xl p-3"><small>${t("admin_stat_used")}</small><strong>${keys.filter(key => key.user).length}</strong></div><div class="glass-card rounded-xl p-3"><small>${t("admin_stat_active")}</small><strong>${active}</strong></div><div class="glass-card rounded-xl p-3"><small>${t("admin_stat_expired")}</small><strong>${expired}</strong></div>`;
}
window.refreshAdminKeyTranslations = () => { renderAdminKeyList(adminKeysCache); if (!adminKeysLoadError) renderAdminKeyStats(adminKeysCache); renderAdminInbox(); };
async function loadAdminKeys() {
  const list = document.getElementById("admin-key-list");
  const stats = document.getElementById("admin-key-stats");
  const finishListLoading = !adminKeysHasLoaded ? beginAdminSkeleton(list, 4) : () => {};
  const finishStatsLoading = !adminKeysHasLoaded ? beginAdminSkeleton(stats, 4, true) : () => {};
  try {
    const response = await fetch("/api/admin/keys", { headers: adminHeaders() });
    const keys = await readApiResponse(response);
    if (!response.ok) throw new Error(t("admin_access_denied"));
    adminKeysCache = keys;
    adminKeysLoadError = false;
    finishListLoading();
    finishStatsLoading();
    renderAdminKeyStats(keys);
    renderAdminKeyList(adminKeysCache);
    return { keys, expired: keys.filter(key => !key.permanent && (key.archived || (!key.waitingForFirstUse && key.remainingMs <= 0))) };
  } catch (error) {
    adminKeysLoadError = true;
    if (list) list.innerHTML = `<p class="text-sm text-rose-300">${t("admin_key_load_failed")}</p>`;
    if (stats) stats.replaceChildren();
    throw error;
  } finally {
    adminKeysHasLoaded = true;
    finishListLoading();
    finishStatsLoading();
  }
}
function downloadKeyReport(keys) {
  const report = { exportedAt: new Date().toISOString(), totalKeys: keys.length, expiredKeys: keys.filter(key => !key.permanent && (key.archived || (!key.waitingForFirstUse && key.remainingMs <= 0))).length, keys };
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `igh7021-key-report-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}
function escapeReportText(value) { return String(value ?? "-").replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#039;" }[char])); }
function printKeyReport(keys) {
  const popup = window.open("", "igh7021-key-report");
  if (!popup) return;
  const locale = currentLang === "th" ? "th-TH" : "en-US";
  const rows = keys.map((key, index) => {
    const status = key.archived ? t("admin_key_type_history") : key.waitingForFirstUse ? t("admin_key_waiting", { time: formatRemaining(key.durationMs) }) : key.permanent ? t("admin_key_type_unlimited") : key.remainingMs <= 0 ? t("admin_key_time_expired") : t("admin_key_status_active");
    return `<tr><td>${index + 1}</td><td><code>${escapeReportText(key.value)}</code></td><td>${escapeReportText(key.user || t("admin_key_owner_none"))}</td><td>${escapeReportText(status)}</td><td>${key.expiresAt ? escapeReportText(new Date(key.expiresAt).toLocaleString(locale)) : "-"}</td><td>${escapeReportText(keyTimeLabel(key))}</td></tr>`;
  }).join("");
  popup.document.write(`<!doctype html><html lang="${currentLang}"><head><meta charset="utf-8"><title>${t("admin_pdf_title")}</title><style>body{font-family:Arial,sans-serif;color:#20232a;padding:32px}h1{margin:0 0 6px;color:#c2410c}p{color:#64748b}table{width:100%;border-collapse:collapse;margin-top:24px;font-size:12px}th{background:#ea580c;color:#fff;text-align:left}th,td{border:1px solid #fed7aa;padding:9px;vertical-align:top}tr:nth-child(even){background:#fff7ed}code{word-break:break-all}@media print{body{padding:10px}h1{font-size:20px}}</style></head><body><h1>${t("admin_pdf_title")}</h1><p>${t("admin_pdf_description")}<br>${t("admin_pdf_created")} ${escapeReportText(new Date().toLocaleString(locale))} · ${t("admin_pdf_all_keys", { count: keys.length })}</p><table><thead><tr><th>#</th><th>Key</th><th>${t("admin_pdf_user")}</th><th>${t("admin_pdf_status")}</th><th>${t("admin_pdf_expires")}</th><th>${t("admin_pdf_remaining")}</th></tr></thead><tbody>${rows || `<tr><td colspan="6">${t("admin_pdf_empty")}</td></tr>`}</tbody></table></body></html>`);
  popup.document.close(); popup.focus(); popup.print();
}
document.addEventListener("DOMContentLoaded", () => {
  if (localStorage.getItem("igh_kinglegacy_is_admin") !== "1") return;
  enableAdminUi();
  const refresh = () => loadAdminKeys().catch(error => toast(error.message, "error"));
  document.querySelectorAll("[data-admin-tab]").forEach(button => button.addEventListener("click", () => {
    const inboxSelected = button.dataset.adminTab === "inbox";
    document.getElementById("admin-keys-panel")?.classList.toggle("hidden", inboxSelected);
    document.getElementById("admin-inbox-panel")?.classList.toggle("hidden", !inboxSelected);
    document.querySelectorAll("[data-admin-tab]").forEach(tab => {
      const selected = tab === button;
      tab.classList.toggle("is-active", selected);
      tab.setAttribute("aria-selected", String(selected));
    });
    if (inboxSelected) loadAdminInbox().catch(error => console.error("Could not load Admin inbox:", error));
  }));
  document.getElementById("admin-key-form")?.addEventListener("submit", async event => { event.preventDefault(); try { const response = await fetch("/api/admin/keys", { method: "POST", headers: adminHeaders(), body: JSON.stringify({ hours: Number(document.getElementById("admin-hours").value), permanent: document.getElementById("admin-permanent").checked, admin: document.getElementById("admin-key-is-admin").checked }) }); const result = await readApiResponse(response); if (!response.ok) throw new Error(result.error); const output = document.getElementById("admin-generated-key"); const copyButton = document.getElementById("copy-generated-key"); output.textContent = result.value; output.classList.remove("hidden"); copyButton.dataset.copyKey = result.value; copyButton.classList.remove("hidden"); refresh(); } catch (error) { toast(`${t("admin_key_create_failed")}: ${error.message}`, "error"); } });
  document.getElementById("copy-generated-key")?.addEventListener("click", async event => { if (await copyText(event.currentTarget.dataset.copyKey)) { event.currentTarget.textContent = t("admin_copied"); setTimeout(() => { event.currentTarget.textContent = t("admin_copy"); }, 1600); } });
  document.getElementById("admin-key-list")?.addEventListener("click", async event => {
    const timeButton = event.target.closest("[data-key-time]");
    if (timeButton) {
      timeButton.disabled = true;
      try {
        const response = await fetch(`/api/admin/keys/${encodeURIComponent(timeButton.dataset.keyId)}/time`, { method: "POST", headers: adminHeaders(), body: JSON.stringify({ deltaHours: Number(timeButton.dataset.keyTime) }) });
        const result = await readApiResponse(response);
        if (!response.ok) throw new Error(result.error === "KEY_EXTENSION_WINDOW_EXPIRED" ? t("admin_key_expired_7d") : result.error === "MINIMUM_KEY_DURATION" ? t("admin_key_minimum_time") : t("admin_key_time_failed"));
        await refresh();
      } catch (error) { toast(error.message, "error"); timeButton.disabled = false; }
      return;
    }
    const button = event.target.closest("[data-copy-key]");
    if (!button) return;
    if (await copyText(button.dataset.copyKey)) { button.textContent = t("admin_copied"); setTimeout(() => { button.textContent = t("admin_copy"); }, 1600); }
  });
  document.getElementById("admin-inbox-list")?.addEventListener("click", event => {
    const button = event.target.closest("[data-delete-inbox-message]");
    if (!button || !["suggestion", "request"].includes(button.dataset.deleteInboxMessage)) return;
    const type = button.dataset.deleteInboxMessage;
    const request = type === "request";
    const route = request ? "requests" : "suggestions";
    confirmDialog(t(request ? "admin_request_delete_confirm" : "admin_suggestion_delete_confirm"), async () => {
      button.disabled = true;
      try {
        const response = await fetch(`/api/admin/${route}/${encodeURIComponent(button.dataset.messageId)}`, { method: "DELETE", headers: adminHeaders() });
        const result = await readApiResponse(response);
        if (!response.ok) throw new Error(result.error || "INBOX_MESSAGE_DELETE_FAILED");
        if (request) adminRequestsCache = adminRequestsCache.filter(item => item.id !== button.dataset.messageId);
        else adminSuggestions = adminSuggestions.filter(item => item.id !== button.dataset.messageId);
        renderAdminInbox();
      } catch (error) {
        console.error("Could not delete Admin inbox message:", error);
        toast(t(request ? "admin_request_delete_failed" : "admin_suggestion_delete_failed"), "error");
        button.disabled = false;
      }
    });
  });
  document.getElementById("admin-export-json")?.addEventListener("click", async () => { const result = await loadAdminKeys(); downloadKeyReport(result.keys); });
  document.getElementById("admin-export-pdf")?.addEventListener("click", async () => { const result = await loadAdminKeys(); printKeyReport(result.keys); });
  document.getElementById("admin-logout-btn")?.addEventListener("click", async () => { await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => {}); localStorage.removeItem(AUTH_TOKEN_KEY); localStorage.removeItem(AUTH_KEY_KEY); localStorage.removeItem("igh_kinglegacy_is_admin"); localStorage.removeItem("igh_kinglegacy_owner_id"); localStorage.removeItem("igh_kinglegacy_auth_method"); location.reload(); });
  refresh();
});
