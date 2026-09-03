const I18N = {
  th: {
    nav_dashboard: "Dashboard", nav_products: "สินค้า / Stock", nav_sales: "การขาย",
    nav_reports: "สรุปยอดขาย", nav_settings: "ตั้งค่า", theme_toggle: "สลับธีม",

    dashboard_title: "Dashboard", quick_sale_btn: "⚡ Quick Sale",
    quick_sale_banner_title: "Quick Sale",
    quick_sale_banner_desc: "เลือกสินค้าและกรอกจำนวนหรือเงิน ระบบจะคำนวณราคาให้อัตโนมัติ",
    stat_total_sales: "ยอดขายรวม", stat_sold_qty: "ขายไปแล้ว",
    stat_sale_count: "รายการขาย", stat_remaining: "สต็อกคงเหลือ",
    today_stats_title: "สถิติวันนี้", today_sales: "ยอดขายวันนี้", today_qty: "ขายวันนี้", today_orders: "ออเดอร์วันนี้", average_order: "เฉลี่ยต่อออเดอร์",
    chart_title: "ยอดขายย้อนหลัง 7 วัน", best_sellers_title: "สินค้าขายดี",
    timeline_title: "กิจกรรมล่าสุด", chart_dataset_label: "ยอดขาย (บาท)",

    products_title: "สินค้า / Stock",
    select_mode_btn_on: "☑️ เลือกหลายรายการ", select_mode_btn_off: "✕ ยกเลิกการเลือก",
    add_product_btn: "+ เพิ่มสินค้า",
    bulk_selected_label: "รายการที่เลือก", bulk_select_all: "เลือกทั้งหมด",
    bulk_clear: "ยกเลิกเลือก", bulk_delete: "🗑️ ลบที่เลือก", bulk_edit: "✏️ แก้ไขหมู่",
    modal_bulk_edit_title: "แก้ไขสินค้าหลายรายการ",
    bulk_edit_desc: "เลือกไว้ {count} รายการ — ติ๊กช่องที่ต้องการเปลี่ยน รายการที่ไม่ติ๊กจะไม่ถูกแก้ไข",
    bulk_apply_rate: "เปลี่ยนเรทราคา", bulk_apply_stock: "ปรับสต็อก",
    bulk_apply_category: "เปลี่ยนหมวดหมู่", bulk_apply_rarity: "เปลี่ยนระดับ",
    bulk_stock_mode_set: "ตั้งค่าใหม่เป็น", bulk_stock_mode_add: "เพิ่มจากเดิม",
    btn_apply_bulk: "บันทึกการแก้ไข", toast_bulk_updated: "✓ แก้ไขสินค้า {count} รายการแล้ว",
    toast_bulk_no_fields: "✕ กรุณาเลือกอย่างน้อย 1 รายการที่จะแก้ไข",
    search_placeholder: "ค้นหาสินค้า หรือ หมวดหมู่...",
    filter_all_status: "ทุกสถานะ", status_instock: "มีสินค้า",
    status_low: "ใกล้หมด", status_out: "หมด", filter_all_category: "ทุกหมวดหมู่",
    filter_all_rarity: "ทุกระดับ",
    rarity_mythical: "Mythical", rarity_legendary: "Legendary", rarity_epic: "Epic",
    rarity_rare: "Rare", rarity_uncommon: "Uncommon", rarity_common: "Common",
    rarity_limited: "Limited", rarity_none: "ไม่มีระดับ",
    label_rarity: "ระดับ (Rarity)",
    empty_no_products: "ยังไม่มีสินค้า", empty_no_search_result: "ไม่พบสินค้าที่ค้นหา",
    empty_add_first: "+ เพิ่มสินค้าตัวแรก",
    remaining_label: "เหลือ", pieces_unit: "ชิ้น", sold_label: "ขายแล้ว",
    btn_sell: "ขาย", aria_restock: "เพิ่มสต็อก", aria_edit: "แก้ไข", aria_delete: "ลบ",
    select_btn_selected: "✓ เลือกแล้ว", select_btn_default: "เลือก",

    sales_history_title: "ประวัติการขาย", empty_no_sales: "ยังไม่มีรายการขาย",

    reports_title: "สรุปยอดขาย", report_sold_qty_label: "จำนวนที่ขาย",
    report_sale_count_label: "รายการขาย", report_bestseller_title: "อันดับสินค้าขายดี",
    no_sales_data: "ยังไม่มีข้อมูลการขาย",

    settings_title: "ตั้งค่า", update_log_title: "มีอะไรอัปเดต", update_date_prefix: "วันที่",
    settings_language: "ภาษา",
    settings_stock_alert_title: "แจ้งเตือนเมื่อเหลือไม่เกิน",
    settings_category_title: "หมวดหมู่สินค้า", new_category_placeholder: "ชื่อหมวดหมู่ใหม่",
    add_btn: "+ เพิ่ม", backup_section_title: "Backup / Restore / Export",
    export_backup_btn: "⬇️ Export Backup (.json)", restore_backup_btn: "⬆️ Restore Backup",
    export_products_csv_btn: "📄 Export Products CSV", export_sales_csv_btn: "📄 Export Sales CSV",

    modal_add_product_title: "เพิ่มสินค้า", modal_edit_product_title: "แก้ไขสินค้า",
    label_product_image: "รูปสินค้า",
    dropzone_text: "ลากไฟล์รูปมาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์",
    dropzone_hint: "รองรับ PNG, JPG, WEBP",
    label_product_name: "ชื่อสินค้า", label_category: "หมวดหมู่",
    label_stock_initial: "สต็อกเริ่มต้น", label_rate: "เรทสินค้า (ชิ้น / บาท)",
    unit_pieces_slash: "ชิ้น /", unit_baht: "บาท", label_description: "รายละเอียด",
    btn_cancel: "ยกเลิก", btn_save_product: "บันทึกสินค้า",

    modal_restock_title: "เติมสต็อก", restock_current_label: "ปัจจุบัน",
    label_restock_amount: "จำนวนที่เติม", btn_restock: "เติมสต็อก",

    modal_sale_title: "ขายสินค้า", label_rate_short: "เรท:", label_remaining_short: "คงเหลือ:",
    mode_qty: "คิดจากจำนวน", mode_money: "คิดจากเงิน",
    label_qty_pieces: "จำนวนสินค้า (ชิ้น)", label_money_baht: "จำนวนเงิน (บาท)",
    result_customer_gets: "ลูกค้าได้รับ", result_price: "ราคา", result_after: "คงเหลือหลังขาย",
    error_insufficient_stock: "✕ สต็อกไม่เพียงพอ",
    remember_rate_label: "จำเรทนี้ไว้กับสินค้านี้",
    label_date: "วันที่", label_note: "หมายเหตุ", btn_save_sale: "บันทึกการขาย",

    btn_confirm: "ยืนยัน",

    toast_product_added: "✓ เพิ่มสินค้าแล้ว", toast_product_updated: "✓ อัปเดตสินค้าแล้ว",
    toast_name_required: "✕ กรุณากรอกชื่อสินค้า", toast_product_deleted: "✓ ลบสินค้าแล้ว",
    toast_restocked: "✓ เติมสต็อก {name} +{amount} แล้ว",
    toast_restock_invalid: "✕ กรุณากรอกจำนวนให้ถูกต้อง",
    toast_sale_saved: "✓ บันทึกการขายแล้ว", toast_insufficient_stock: "✕ สต็อกไม่เพียงพอ",
    toast_no_products: "✕ ยังไม่มีสินค้า กรุณาเพิ่มสินค้าก่อน",
    toast_backup_exported: "✓ Export Backup แล้ว", toast_restore_success: "✓ Restore ข้อมูลสำเร็จ",
    toast_backup_invalid: "✕ ไฟล์ Backup ไม่ถูกต้อง",
    toast_products_csv_exported: "✓ Export Products CSV แล้ว",
    toast_sales_csv_exported: "✓ Export Sales CSV แล้ว",
    toast_alert_updated: "✓ อัปเดตค่าแจ้งเตือนแล้ว",
    toast_category_exists: "✕ มีหมวดหมู่นี้อยู่แล้ว", toast_category_added: "✓ เพิ่มหมวดหมู่แล้ว",
    toast_category_in_use: "✕ มีสินค้าใช้หมวดหมู่นี้อยู่ ลบไม่ได้",
    toast_unsupported_image: "✕ รองรับเฉพาะไฟล์ PNG/JPG/WEBP",
    toast_image_read_fail: "✕ ไม่สามารถอ่านไฟล์รูปได้", toast_file_read_fail: "✕ อ่านไฟล์ล้มเหลว",
    toast_save_failed: "✕ บันทึกข้อมูลไม่สำเร็จ (พื้นที่เก็บข้อมูลเต็ม?)",
    toast_nothing_selected: "✕ ยังไม่ได้เลือกสินค้า",
    toast_bulk_deleted: "✓ ลบสินค้า {count} รายการแล้ว",
    confirm_delete_product: 'ต้องการลบสินค้า "{name}" จริงหรือไม่?',
    confirm_delete_bulk: "ต้องการลบสินค้าที่เลือกไว้ {count} รายการ จริงหรือไม่?",

    time_just_now: "เมื่อสักครู่", time_minutes_ago: "{n} นาทีที่แล้ว",
    time_hours_ago: "{n} ชั่วโมงที่แล้ว", time_days_ago: "{n} วันที่แล้ว",
    timeline_sold: "ขาย {name} {qty} ชิ้น", timeline_restocked: "เติมสต็อก {name}",
    rate_pieces_per_baht: "{n} ชิ้น = 1 บาท", rate_baht_per_piece: "1 ชิ้น = {n} บาท",
    remaining_suffix: "(เหลือ {n})",
  },
  en: {
    nav_dashboard: "Dashboard", nav_products: "Products / Stock", nav_sales: "Sales",
    nav_reports: "Reports", nav_settings: "Settings", theme_toggle: "Toggle theme",

    dashboard_title: "Dashboard", quick_sale_btn: "⚡ Quick Sale",
    quick_sale_banner_title: "Quick Sale",
    quick_sale_banner_desc: "Pick a product and enter quantity or money — price calculates automatically.",
    stat_total_sales: "Total Sales", stat_sold_qty: "Sold",
    stat_sale_count: "Sale Transactions", stat_remaining: "Remaining Stock",
    today_stats_title: "Today's statistics", today_sales: "Today's sales", today_qty: "Today's quantity", today_orders: "Today's orders", average_order: "Average order",
    chart_title: "Sales — Last 7 Days", best_sellers_title: "Best Sellers",
    timeline_title: "Recent Activity", chart_dataset_label: "Sales (Baht)",

    products_title: "Products / Stock",
    select_mode_btn_on: "☑️ Select Multiple", select_mode_btn_off: "✕ Cancel Selection",
    add_product_btn: "+ Add Product",
    bulk_selected_label: "selected", bulk_select_all: "Select All",
    bulk_clear: "Clear", bulk_delete: "🗑️ Delete Selected", bulk_edit: "✏️ Bulk Edit",
    modal_bulk_edit_title: "Edit Multiple Products",
    bulk_edit_desc: "{count} item(s) selected — check the fields you want to change, others stay untouched",
    bulk_apply_rate: "Change rate", bulk_apply_stock: "Adjust stock",
    bulk_apply_category: "Change category", bulk_apply_rarity: "Change rarity",
    bulk_stock_mode_set: "Set to", bulk_stock_mode_add: "Add to existing",
    btn_apply_bulk: "Apply Changes", toast_bulk_updated: "✓ Updated {count} product(s)",
    toast_bulk_no_fields: "✕ Please select at least one field to change",
    search_placeholder: "Search product or category...",
    filter_all_status: "All Status", status_instock: "In Stock",
    status_low: "Low Stock", status_out: "Out of Stock", filter_all_category: "All Categories",
    filter_all_rarity: "All Rarities",
    rarity_mythical: "Mythical", rarity_legendary: "Legendary", rarity_epic: "Epic",
    rarity_rare: "Rare", rarity_uncommon: "Uncommon", rarity_common: "Common",
    rarity_limited: "Limited", rarity_none: "No Rarity",
    label_rarity: "Rarity",
    empty_no_products: "No products yet", empty_no_search_result: "No matching products found",
    empty_add_first: "+ Add your first product",
    remaining_label: "Left", pieces_unit: "pcs", sold_label: "sold",
    btn_sell: "Sell", aria_restock: "Restock", aria_edit: "Edit", aria_delete: "Delete",
    select_btn_selected: "✓ Selected", select_btn_default: "Select",

    sales_history_title: "Sales History", empty_no_sales: "No sales yet",

    reports_title: "Sales Report", report_sold_qty_label: "Quantity Sold",
    report_sale_count_label: "Sale Transactions", report_bestseller_title: "Best Sellers Ranking",
    no_sales_data: "No sales data yet",

    settings_title: "Settings", update_log_title: "What’s new", update_date_prefix: "Date",
    settings_language: "Language",
    settings_stock_alert_title: "Alert when stock is below",
    settings_category_title: "Product Categories", new_category_placeholder: "New category name",
    add_btn: "+ Add", backup_section_title: "Backup / Restore / Export",
    export_backup_btn: "⬇️ Export Backup (.json)", restore_backup_btn: "⬆️ Restore Backup",
    export_products_csv_btn: "📄 Export Products CSV", export_sales_csv_btn: "📄 Export Sales CSV",

    modal_add_product_title: "Add Product", modal_edit_product_title: "Edit Product",
    label_product_image: "Product Image",
    dropzone_text: "Drag & drop image here, or click to select",
    dropzone_hint: "Supports PNG, JPG, WEBP",
    label_product_name: "Product Name", label_category: "Category",
    label_stock_initial: "Initial Stock", label_rate: "Rate (pieces / baht)",
    unit_pieces_slash: "pcs /", unit_baht: "baht", label_description: "Description",
    btn_cancel: "Cancel", btn_save_product: "Save Product",

    modal_restock_title: "Restock", restock_current_label: "Current",
    label_restock_amount: "Amount to Add", btn_restock: "Restock",

    modal_sale_title: "Sell Product", label_rate_short: "Rate:", label_remaining_short: "Remaining:",
    mode_qty: "By Quantity", mode_money: "By Money",
    label_qty_pieces: "Quantity (pcs)", label_money_baht: "Amount (baht)",
    result_customer_gets: "Customer Gets", result_price: "Price", result_after: "Remaining After",
    error_insufficient_stock: "✕ Insufficient stock",
    remember_rate_label: "Remember this rate for this product",
    label_date: "Date", label_note: "Note", btn_save_sale: "Save Sale",

    btn_confirm: "Confirm",

    toast_product_added: "✓ Product added", toast_product_updated: "✓ Product updated",
    toast_name_required: "✕ Please enter a product name", toast_product_deleted: "✓ Product deleted",
    toast_restocked: "✓ Restocked {name} +{amount}",
    toast_restock_invalid: "✕ Please enter a valid amount",
    toast_sale_saved: "✓ Sale saved", toast_insufficient_stock: "✕ Insufficient stock",
    toast_no_products: "✕ No products yet — please add one first",
    toast_backup_exported: "✓ Backup exported", toast_restore_success: "✓ Data restored successfully",
    toast_backup_invalid: "✕ Invalid backup file",
    toast_products_csv_exported: "✓ Products CSV exported",
    toast_sales_csv_exported: "✓ Sales CSV exported",
    toast_alert_updated: "✓ Alert threshold updated",
    toast_category_exists: "✕ Category already exists", toast_category_added: "✓ Category added",
    toast_category_in_use: "✕ Category is in use, cannot delete",
    toast_unsupported_image: "✕ Only PNG/JPG/WEBP files are supported",
    toast_image_read_fail: "✕ Could not read the image", toast_file_read_fail: "✕ Failed to read file",
    toast_save_failed: "✕ Failed to save data (storage full?)",
    toast_nothing_selected: "✕ No products selected",
    toast_bulk_deleted: "✓ Deleted {count} product(s)",
    confirm_delete_product: 'Delete product "{name}"?',
    confirm_delete_bulk: "Delete {count} selected product(s)?",

    time_just_now: "just now", time_minutes_ago: "{n}m ago",
    time_hours_ago: "{n}h ago", time_days_ago: "{n}d ago",
    timeline_sold: "Sold {name} x{qty}", timeline_restocked: "Restocked {name}",
    rate_pieces_per_baht: "{n} pcs = 1 baht", rate_baht_per_piece: "1 pc = {n} baht",
    remaining_suffix: "(left {n})",
  },
};

let currentLang = localStorage.getItem(LANG_KEY) || "th";

function t(key, vars) {
  let str = (I18N[currentLang] && I18N[currentLang][key]) || I18N.th[key] || key;
  if (vars) Object.keys(vars).forEach(k => { str = str.replace(`{${k}}`, vars[k]); });
  return str;
}

function setLang(lang) {
  currentLang = lang;
  localStorage.setItem(LANG_KEY, lang);
  applyStaticTranslations();
  if (typeof renderProducts === "function") renderProducts();
  if (typeof renderSalesHistory === "function") renderSalesHistory();
  if (typeof renderDashboard === "function") renderDashboard();
  if (typeof renderReports === "function") renderReports();
}

function applyStaticTranslations() {
  document.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  document.querySelectorAll("[data-i18n-aria]").forEach(el => { el.setAttribute("aria-label", t(el.dataset.i18nAria)); });
  document.querySelectorAll(".lang-btn").forEach(b => b.classList.toggle("seg-active", b.dataset.lang === currentLang));
  document.getElementById("toggle-select-mode-btn") &&
    (document.getElementById("toggle-select-mode-btn").textContent = selectMode ? t("select_mode_btn_off") : t("select_mode_btn_on"));
}
