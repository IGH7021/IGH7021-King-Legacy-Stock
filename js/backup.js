function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function normalizeBackupIdentities(identities) {
  if (!Array.isArray(identities)) return [];
  return identities.filter(identity =>
    identity && ["google", "discord"].includes(identity.provider) &&
    typeof identity.displayName === "string" && identity.displayName.trim()
  ).map(identity => ({
    provider: identity.provider,
    displayName: identity.displayName.trim(),
    email: typeof identity.email === "string" ? identity.email : null,
    linkedAt: typeof identity.linkedAt === "string" ? identity.linkedAt : null,
  }));
}

async function exportBackup() {
  try {
    let linkedIdentities = [];
    if (localStorage.getItem(AUTH_KEY_KEY)) {
      const response = await fetch("/api/auth/identities", {
        headers: { Authorization: `Bearer ${localStorage.getItem(AUTH_TOKEN_KEY) || ""}` },
      });
      if (!response.ok) throw new Error("Could not load verified account details");
      linkedIdentities = normalizeBackupIdentities(await response.json());
    }
    const previousIdentities = normalizeBackupIdentities(state.portableAccount?.identityProfiles);
    const identityProfiles = [...previousIdentities];
    linkedIdentities.forEach(identity => {
      if (!identityProfiles.some(existing =>
        existing.provider === identity.provider && existing.displayName === identity.displayName && existing.email === identity.email
      )) identityProfiles.push(identity);
    });
    const backup = {
      format: "igh7021-kinglegacy-backup",
      backupVersion: 3,
      exportedAt: new Date().toISOString(),
      state: { ...state },
      preferences: {
        theme: localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark",
        language: localStorage.getItem(LANG_KEY) === "en" ? "en" : "th",
      },
      account: {
        identityProfiles,
        requiresReverification: identityProfiles.length > 0,
      },
    };
    downloadFile("IGH7021_KingLegacy_Backup.json", JSON.stringify(backup, null, 2), "application/json");
    toast(t("toast_backup_exported"));
  } catch (error) {
    console.error("exportBackup error:", error);
    toast(t("toast_backup_export_failed"), "error");
  }
}

function importBackup(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      const source = data.state && typeof data.state === "object" ? data.state : data;
      if (!Array.isArray(source.products) || !Array.isArray(source.sales) || !source.settings || typeof source.settings !== "object") throw new Error("bad structure");
      const { backupVersion, exportedAt, format, preferences, account, ...restoredState } = source;
      state = { ...restoredState, farmServices: Array.isArray(source.farmServices) ? source.farmServices : [], farmOrders: Array.isArray(source.farmOrders) ? source.farmOrders : [], activityLog: Array.isArray(source.activityLog) ? source.activityLog : [] };
      const importedIdentities = normalizeBackupIdentities(data.account?.identityProfiles || data.account?.verifiedIdentities);
      state.portableAccount = {
        identityProfiles: importedIdentities.length ? importedIdentities : normalizeBackupIdentities(source.portableAccount?.identityProfiles),
      };
      if (!Array.isArray(state.settings.categories)) state.settings.categories = Object.keys(CATEGORY_ICONS).filter(c=>c!=="อื่นๆ");
      saveState();
      if (data.preferences?.theme === "light" || data.preferences?.theme === "dark") applyTheme(data.preferences.theme);
      if (data.preferences?.language === "th" || data.preferences?.language === "en") setLang(data.preferences.language);
      renderProducts(); renderFarmServices?.(); renderSalesHistory(); renderDashboard(); renderReports(); renderSettings();
      const needsReverification = state.portableAccount.identityProfiles.length > 0;
      toast(needsReverification ? t("toast_restore_success_reverify") : t("toast_restore_success"));
    } catch (err) {
      console.error("importBackup error:", err);
      toast(t("toast_backup_invalid"), "error");
    }
  };
  reader.onerror = () => toast(t("toast_file_read_fail"), "error");
  reader.readAsText(file);
}

function csvEscape(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
}

function exportProductsCSV() {
  const header = ["id","name","category","stock","sold","remaining","unitsPerBaht","description"];
  const rows = state.products.map(p => [p.id,p.name,p.category,p.stock,p.sold,remaining(p),p.unitsPerBaht,p.description]);
  const csv = [header, ...rows].map(r => r.map(csvEscape).join(",")).join("\n");
  downloadFile("IGH7021_Products.csv", "\uFEFF"+csv, "text/csv;charset=utf-8;");
  toast(t("toast_products_csv_exported"));
}

function exportSalesCSV() {
  const header = ["id","productName","quantity","money","rate","date","note"];
  const rows = state.sales.map(s => [s.id,s.productName,s.quantity,s.money,s.rate,fmtDate(s.date),s.note]);
  const csv = [header, ...rows].map(r => r.map(csvEscape).join(",")).join("\n");
  downloadFile("IGH7021_Sales.csv", "\uFEFF"+csv, "text/csv;charset=utf-8;");
  toast(t("toast_sales_csv_exported"));
}
