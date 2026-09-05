function adminHeaders() { return { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem(AUTH_TOKEN_KEY)}` }; }
function enableAdminUi() {
  document.querySelectorAll(".admin-only").forEach(el => el.classList.remove("hidden"));
  bindAdminKeyFilters();
  loadAdminKeys().catch(error => { if (error.message === "ไม่มีสิทธิ์ Admin") { document.querySelectorAll(".admin-only").forEach(el => el.classList.add("hidden")); } else toast(error.message, "error"); });
}
function formatRemaining(ms) { if (ms === null) return "ถาวร"; if (ms <= 0) return "หมดอายุ"; const minutes = Math.floor(ms / 60000); return minutes < 60 ? `${minutes} นาที` : `${Math.floor(minutes / 60)} ชม. ${minutes % 60} นาที`; }
function keyTypeLabel(key) { if (key.admin) return "Admin"; if (key.permanent) return "อันลิมิต"; return "จำกัดเวลา"; }
function keyTypeClass(key) { if (key.admin) return "bg-orange-500/15 text-orange-300"; if (key.permanent) return "bg-slate-700/60 text-slate-300"; return "bg-amber-500/15 text-amber-300"; }
let adminKeyFilter = "all";
let adminKeysCache = [];
let adminFiltersBound = false;
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
  const matchesFilter = key => adminKeyFilter === "all" || (adminKeyFilter === "expired" ? (!key.permanent && key.remainingMs <= 0) : adminKeyFilter === "admin" ? key.admin : adminKeyFilter === "unlimited" ? (!key.admin && key.permanent) : adminKeyFilter === "limited" ? (!key.permanent && key.remainingMs > 0) : (key.admin || key.permanent || key.remainingMs > 0));
  const sortedKeys = keys.filter(matchesFilter).sort((a, b) => {
    const aExpired = !a.permanent && a.remainingMs <= 0;
    const bExpired = !b.permanent && b.remainingMs <= 0;
    if (aExpired !== bExpired) return aExpired ? 1 : -1;
    if (a.admin !== b.admin) return a.admin ? -1 : 1;
    if (a.permanent !== b.permanent) return a.permanent ? -1 : 1;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
  document.getElementById("admin-key-list").innerHTML = sortedKeys.map(key => { const expired = !key.permanent && key.remainingMs <= 0; return `<div class="glass-card rounded-xl p-3 flex flex-wrap items-center gap-3 ${expired ? "opacity-70" : ""}"><code class="flex-1 text-xs break-all">${key.value}</code><button data-copy-key="${key.value}" type="button" class="px-3 py-1.5 rounded-lg bg-slate-700/60 text-xs">คัดลอก</button><span class="px-2 py-1 rounded-full text-[11px] ${keyTypeClass(key)}">${keyTypeLabel(key)}</span><span class="text-xs ${expired ? "text-rose-300" : "text-emerald-300"}">${key.user || "ยังไม่มีเจ้าของ"} · ${expired ? "หมดอายุ" : formatRemaining(key.remainingMs)}</span></div>`; }).join("") || `<p class="text-sm text-slate-400 text-center py-6">ไม่พบคีย์ในกลุ่มนี้</p>`;
}
async function loadAdminKeys() {
  const response = await fetch("/api/admin/keys", { headers: adminHeaders() });
  const keys = await readApiResponse(response);
  if (!response.ok) throw new Error("ไม่มีสิทธิ์ Admin");
  const active = keys.filter(key => key.permanent || key.remainingMs > 0).length;
  const expired = keys.filter(key => !key.permanent && key.remainingMs <= 0);
  document.getElementById("admin-key-stats").innerHTML = `<div class="glass-card rounded-xl p-3"><small>คีย์ทั้งหมด</small><strong>${keys.length}</strong></div><div class="glass-card rounded-xl p-3"><small>มีผู้ใช้แล้ว</small><strong>${keys.filter(key => key.user).length}</strong></div><div class="glass-card rounded-xl p-3"><small>คีย์ใช้งานได้</small><strong>${active}</strong></div><div class="glass-card rounded-xl p-3"><small>หมดอายุ</small><strong>${expired.length}</strong></div>`;
  adminKeysCache = keys;
  renderAdminKeyList(adminKeysCache);
  return { keys, expired };
}
function downloadKeyReport(keys) {
  const report = { exportedAt: new Date().toISOString(), totalKeys: keys.length, expiredKeys: keys.filter(key => !key.permanent && key.remainingMs <= 0).length, keys };
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
  const rows = keys.map((key, index) => `<tr><td>${index + 1}</td><td><code>${escapeReportText(key.value)}</code></td><td>${escapeReportText(key.user || "ยังไม่มีเจ้าของ")}</td><td>${key.permanent ? "ถาวร" : key.remainingMs <= 0 ? "หมดอายุ" : "ใช้งานได้"}</td><td>${key.expiresAt ? new Date(key.expiresAt).toLocaleString("th-TH") : "-"}</td><td>${formatRemaining(key.remainingMs)}</td></tr>`).join("");
  popup.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>IGH7021 Key Report</title><style>body{font-family:Arial,sans-serif;color:#20232a;padding:32px}h1{margin:0 0 6px;color:#c2410c}p{color:#64748b}table{width:100%;border-collapse:collapse;margin-top:24px;font-size:12px}th{background:#ea580c;color:#fff;text-align:left}th,td{border:1px solid #fed7aa;padding:9px;vertical-align:top}tr:nth-child(even){background:#fff7ed}code{word-break:break-all}@media print{body{padding:10px}h1{font-size:20px}}</style></head><body><h1>IGH7021 Key Report</h1><p>รายงานคีย์ทั้งหมดและเจ้าของคีย์<br>สร้างเมื่อ ${escapeReportText(new Date().toLocaleString("th-TH"))} · ทั้งหมด ${keys.length} คีย์</p><table><thead><tr><th>#</th><th>Key</th><th>ผู้ใช้</th><th>สถานะ</th><th>หมดอายุ</th><th>เวลาคงเหลือ</th></tr></thead><tbody>${rows || "<tr><td colspan=6>ไม่มีข้อมูล</td></tr>"}</tbody></table></body></html>`);
  popup.document.close(); popup.focus(); popup.print();
}
document.addEventListener("DOMContentLoaded", () => {
  if (localStorage.getItem("igh_kinglegacy_is_admin") !== "1") return;
  enableAdminUi();
  const refresh = () => loadAdminKeys().catch(error => toast(error.message, "error"));
  document.getElementById("admin-key-form")?.addEventListener("submit", async event => { event.preventDefault(); try { const response = await fetch("/api/admin/keys", { method: "POST", headers: adminHeaders(), body: JSON.stringify({ hours: Number(document.getElementById("admin-hours").value), permanent: document.getElementById("admin-permanent").checked, admin: document.getElementById("admin-key-is-admin").checked }) }); const result = await readApiResponse(response); if (!response.ok) throw new Error(result.error); const output = document.getElementById("admin-generated-key"); const copyButton = document.getElementById("copy-generated-key"); output.textContent = result.value; output.classList.remove("hidden"); copyButton.dataset.copyKey = result.value; copyButton.classList.remove("hidden"); refresh(); } catch (error) { toast("สร้างคีย์ไม่สำเร็จ: " + error.message, "error"); } });
  document.getElementById("copy-generated-key")?.addEventListener("click", async event => { if (await copyText(event.currentTarget.dataset.copyKey)) { event.currentTarget.textContent = "คัดลอกแล้ว"; setTimeout(() => { event.currentTarget.textContent = "คัดลอก"; }, 1600); } });
  document.getElementById("admin-key-list")?.addEventListener("click", async event => { const button = event.target.closest("[data-copy-key]"); if (!button) return; if (await copyText(button.dataset.copyKey)) { button.textContent = "คัดลอกแล้ว"; setTimeout(() => { button.textContent = "คัดลอก"; }, 1600); } });
  document.getElementById("admin-export-json")?.addEventListener("click", async () => { const result = await loadAdminKeys(); downloadKeyReport(result.keys); });
  document.getElementById("admin-export-pdf")?.addEventListener("click", async () => { const result = await loadAdminKeys(); printKeyReport(result.keys); });
  document.getElementById("admin-logout-btn")?.addEventListener("click", () => { localStorage.removeItem(AUTH_TOKEN_KEY); localStorage.removeItem(AUTH_KEY_KEY); localStorage.removeItem("igh_kinglegacy_is_admin"); location.reload(); });
  refresh();
});
