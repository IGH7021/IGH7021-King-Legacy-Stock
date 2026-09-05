function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function exportBackup() {
  const backup = { ...state, backupVersion: 2, exportedAt: new Date().toISOString() };
  downloadFile("IGH7021_KingLegacy_Backup.json", JSON.stringify(backup, null, 2), "application/json");
  toast(t("toast_backup_exported"));
}

function importBackup(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      const source = data.state && typeof data.state === "object" ? data.state : data;
      if (!Array.isArray(source.products) || !Array.isArray(source.sales) || !source.settings || typeof source.settings !== "object") throw new Error("bad structure");
      state = { ...source, farmServices: Array.isArray(source.farmServices) ? source.farmServices : [], farmOrders: Array.isArray(source.farmOrders) ? source.farmOrders : [] };
      if (!Array.isArray(state.settings.categories)) state.settings.categories = Object.keys(CATEGORY_ICONS).filter(c=>c!=="อื่นๆ");
      saveState();
      renderProducts(); renderFarmServices?.(); renderSalesHistory(); renderDashboard(); renderReports(); renderSettings();
      toast(t("toast_restore_success"));
    } catch (err) {
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
