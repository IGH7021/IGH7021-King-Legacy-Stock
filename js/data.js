const STORAGE_KEY = "igh_kinglegacy_state";
const THEME_KEY = "igh_theme";
const LANG_KEY = "igh_lang";
const APP_VERSION = "V.4.41";
const APP_CHANGELOG = [
  { version: "V.4.41", updatedAt: "2026-10-04T20:21:41.870Z", changes: [
    "ปรับขนาดปุ่มโปรไฟล์มุมขวาบนให้กะทัดรัดและเหมาะกับหน้าจอมือถือ"
  ], changesEn: [
    "Refined the upper-right profile shortcut sizing for compact mobile layouts"
  ] },
  { version: "V.4.40", updatedAt: "2026-10-04T20:14:41.892Z", changes: [
    "เพิ่มตัวนับเวลารอก่อนส่งคำขอถึงแอดมินได้อีกครั้ง และย้ายทางลัดโปรไฟล์ไว้ด้านขวาบนพร้อมย้ายตัวเลือกภาษาและธีมเข้าเมนูตั้งค่า"
  ], changesEn: [
    "Added a live countdown until the next admin request is allowed, moved the profile shortcut to the upper-right header, and placed language and theme controls in Settings"
  ] },
  { version: "V.4.39", updatedAt: "2026-10-04T19:59:58.873Z", changes: [
    "เพิ่มปุ่มลบพร้อมยืนยันสำหรับคำขอลูกค้าในกล่องข้อความ Admin ที่รวมกับข้อเสนอแนะ"
  ], changesEn: [
    "Added confirmed deletion of customer requests from the unified Admin inbox"
  ] },
  { version: "V.4.38", updatedAt: "2026-10-04T19:56:39.258Z", changes: [
    "เปิดให้บัญชี Admin ดูและแก้ไขรูปโปรไฟล์กับสถานะออนไลน์/ออฟไลน์ของตนเองได้ โดยยังจำกัดข้อเสนอแนะและคำขอไว้สำหรับผู้ใช้ทั่วไป"
  ], changesEn: [
    "Enabled administrators to view and edit their own profile image and online/offline status while keeping suggestions and customer requests for regular users"
  ] },
  { version: "V.4.37", updatedAt: "2026-10-04T19:12:56.175Z", changes: [
    "เปลี่ยนแท็บตั้งค่าเป็นโปรไฟล์ กำหนดให้ยืนยัน Google/Discord ก่อนส่งคำขอและอัปเดตสิทธิ์เมื่อยกเลิกการยืนยัน รวมกล่องข้อความ Admin และปรับปุ่มเลือกไฟล์ให้เข้ากับธีม"
  ], changesEn: [
    "Renamed the Settings tab to Profile, require Google/Discord verification before sending requests and refresh eligibility when unlinked, unified the Admin inbox, and themed the file picker"
  ] },
  { version: "V.4.36", updatedAt: "2026-10-04T19:01:10.202Z", changes: [
    "ย่อชื่อแท็บข้อเสนอแนะในหน้าตั้งค่า เพิ่มปุ่มโลโก้กลับ Dashboard และย้ายคำขอลูกค้าไปไว้ในแท็บข้อเสนอแนะของ Admin"
  ], changesEn: [
    "Shortened the Settings feedback tab label, made the header logo return to Dashboard, and moved customer requests into the Admin feedback tab"
  ] },
  { version: "V.4.35", updatedAt: "2026-10-04T18:42:09.000Z", changes: [
    "แก้ไขหน้าต่างข้อเสนอแนะที่ปิดแล้วให้ไม่แสดงหรือบังการใช้งานหน้าเว็บ พร้อมคงฉากหลังและการปิดหน้าต่างตามปกติ"
  ], changesEn: [
    "Fixed closed suggestion dialogs remaining visible or blocking the page while preserving normal backdrop and dismissal behavior"
  ] },
  { version: "V.4.34", updatedAt: "2026-10-04T10:27:59.240Z", changes: [
    "เพิ่มเมนูนำทางแบบ Drawer ที่ใช้ได้ทุกขนาดหน้าจอ พร้อมปิดด้วยปุ่ม ฉากหลัง หรือ Escape และคืนโฟกัสอย่างถูกต้อง",
    "จัดสถิติ Dashboard เป็น Bento Grid และเพิ่มหน้าโปรไฟล์พร้อมรูปสถานะออนไลน์/ออฟไลน์",
    "เพิ่มแท็บข้อเสนอแนะสำหรับผู้ใช้ที่ยืนยันตัวตน และกล่องรับ/ลบข้อเสนอแนะสำหรับ Admin"
  ], changesEn: [
    "Added a responsive navigation drawer that closes with its button, backdrop, or Escape and restores focus correctly",
    "Arranged Dashboard statistics in a Bento Grid and added profiles with online/offline status",
    "Added verified-user suggestions and an Admin inbox for viewing and deleting them"
  ] },
  { version: "V.4.33", updatedAt: "2026-10-04T09:31:45.013Z", changes: [
    "ปรับแถบแจ้งเตือนสต็อกให้แสดงสีและรูปแบบสม่ำเสมอขึ้นใน Chrome, Brave, Opera และ Firefox พร้อมรองรับการใช้งานด้วยคีย์บอร์ด",
    "ปรับข้อความหน้าอัปเดตให้แสดงเฉพาะข้อมูลที่เหมาะสำหรับผู้ใช้ โดยไม่เปิดเผยรายละเอียดการตั้งค่าภายใน"
  ], changesEn: [
    "Made the stock alert slider more consistent across Chrome, Brave, Opera, and Firefox, with keyboard accessibility",
    "Updated release notes to show user-facing information without exposing internal configuration details"
  ] },
  { version: "V.4.32", updatedAt: "2026-10-04T09:04:36.520Z", changes: [
    "ปรับ breakpoint ของ Dashboard ให้พิจารณาความกว้างพื้นที่เนื้อหาจริงแทนความกว้างหน้าต่าง เพื่อจัดเลย์เอาต์ให้พอดีเมื่อปรับ browser zoom หรือมี sidebar"
  ], changesEn: [
    "Based Dashboard breakpoints on actual content width instead of viewport width so layouts fit correctly when browser zoom or the sidebar changes available space"
  ] },
  { version: "V.4.31", updatedAt: "2026-10-04T08:54:28.138Z", changes: [
    "จัดส่วนสถิติชุมชนและ Rating / Review ให้อยู่ในแถวเดียวกันบนหน้าจอกว้าง พร้อมปรับความกว้างคอลัมน์ให้สมดุล คงการเรียงแนวตั้งบนมือถือ และป้องกันกราฟทำให้หน้าจอเลื่อนแนวนอน"
  ], changesEn: [
    "Balanced community stats and Rating / Review side by side on wide screens, retained a stacked mobile layout, and prevented charts from causing horizontal overflow"
  ] },
  { version: "V.4.30", updatedAt: "2026-10-04T08:45:48.155Z", changes: [
    "จำกัดพื้นที่รายการรีวิวให้สูง 320–420 พิกเซล และจำกัดข้อความแต่ละรีวิวไว้ 40–98 พิกเซลพร้อมเลื่อนดูข้อความที่ยาว พร้อมแปลข้อความและป้ายคะแนน TH/EN",
    "ปรับ skeleton สำหรับรีวิวและข้อมูล Admin ให้ตรงกับรูปแบบเนื้อหา หน่วงการแสดง 200 มิลลิวินาที และระบุ aria-busy ระหว่างโหลด",
    "ยกเลิกการหน่วงเปิดแอป 350 มิลลิวินาทีที่ไม่จำเป็น และเพิ่มสถานะ spinner ที่โปรแกรมอ่านหน้าจอเข้าถึงได้"
  ], changesEn: [
    "Limited the review list to 320–420 px high and each review message to 40–98 px with scrolling for longer text, with localized text and rating labels",
    "Added layout-matched review and Admin skeletons with a 200 ms display delay and aria-busy loading states",
    "Removed the unnecessary 350 ms application startup delay and made spinner states accessible to screen readers"
  ] },
  { version: "V.4.29", updatedAt: "2026-10-04T08:27:33.000Z", changes: [
    "ปรับปรุงการยืนยัน Discord และเพิ่มระบบส่งคำขอถึงแอดมินได้วันละ 1 ครั้ง พร้อมกล่องรับคำขอสำหรับ Admin",
    "เพิ่มการซิงก์ workspace อัตโนมัติระหว่างอุปกรณ์ พร้อมป้องกันการรีเฟรชทับข้อมูลที่กำลังบันทึก",
    "ปรับการสลับภาษาให้รีเฟรช changelog และเพิ่มคำแปลภาษาอังกฤษของรายการอัปเดตย้อนหลัง"
  ], changesEn: [
    "Improved Discord verification and added one daily request to Admin with a request inbox",
    "Added automatic workspace sync across devices and protected pending local edits from being overwritten",
    "Refresh the changelog when switching languages and add English translations for historical release notes"
  ] },
  { version: "V.4.28", updatedAt: "2026-10-04T07:48:00.000Z", changes: [
    "บัญชีที่เริ่มใช้คีย์ใหม่เริ่มต้นโดยไม่มีสินค้า และเพิ่มปุ่มล้างข้อมูลบัญชีพร้อมคืนค่าตั้งต้น"
  ], changesEn: [
    "New key accounts start with an empty workspace; added an account-data reset that restores the defaults"
  ] },
  { version: "V.4.27", updatedAt: "2026-10-04T07:09:00.000Z", changes: [
    "รองรับพิมพ์จำนวนย่อ K, M, B และ T ในช่องตัวเลข พร้อมคำแนะนำและตรวจสอบค่าตามภาษาไทย/อังกฤษ"
  ], changesEn: [
    "Added K, M, B, and T number abbreviations with localized guidance and validation"
  ] },
  { version: "V.4.26", updatedAt: "2026-10-04T06:57:00.000Z", changes: [
    "จัดระยะช่องกรอกจำนวนและปุ่มเพิ่ม/ลดใหม่ ป้องกันปุ่มเบียดช่องกรอกบนมือถือและหน้าจอแคบ"
  ], changesEn: [
    "Adjusted quantity inputs and steppers to prevent overlap on mobile and narrow screens"
  ] },
  { version: "V.4.25", updatedAt: "2026-10-04T06:48:00.000Z", changes: [
    "เพิ่มการตั้งค่าที่เลือกไว้ในไฟล์ Backup พร้อมปรับขั้นตอนยืนยันบัญชีหลัง Restore"
  ], changesEn: [
    "Added selected preferences to backups and improved account verification after restoring"
  ] },
  { version: "V.4.24", updatedAt: "2026-10-04T02:51:00.000Z", changes: [
    "ปรับปรุงความปลอดภัยของการตั้งค่าระบบสำหรับการใช้งานจริง"
  ], changesEn: [
    "Improved the security of production configuration"
  ] },
  { version: "V.4.23", updatedAt: "2026-10-03T18:39:00.000Z", changes: [
    "ปรับปรุงการยืนยันบัญชี Discord ให้พร้อมใช้งานเมื่อกำหนดค่าบัญชีครบถ้วน"
  ], changesEn: [
    "Improved Discord account verification when the required account settings are provided"
  ] },
  { version: "V.4.22", updatedAt: "2026-10-03T18:16:00.000Z", changes: [
    "เพิ่มหน้านโยบายความเป็นส่วนตัวสำหรับการยืนยันตัวตน Google/Discord"
  ], changesEn: [
    "Added a privacy policy for Google/Discord verification"
  ] },
  { version: "V.4.21", updatedAt: "2026-10-03T17:48:00.000Z", changes: [
    "เพิ่มการยืนยันบัญชี Google และแสดงชื่อบัญชีที่ยืนยันแล้ว"
  ], changesEn: [
    "Added Google account verification and display of the verified account name"
  ] },
  { version: "V.4.20", updatedAt: "2026-10-03T17:35:00.000Z", changes: [
    "เพิ่มปุ่มยืนยัน Google/Discord พร้อมแจ้งสถานะและแสดงชื่อบัญชีที่ยืนยันแล้ว"
  ], changesEn: [
    "Added Google/Discord verification buttons, status messages, and display of verified account names"
  ] },
  { version: "V.4.19", updatedAt: "2026-10-03T17:00:00.000Z", changes: [
    "ปรับปรุงตัวเลือกการจัดการข้อมูลและความเสถียรสำหรับการทดสอบ"
  ], changesEn: [
    "Improved data management options and testing stability"
  ] },
  { version: "V.4.18", updatedAt: "2026-10-03T16:56:00.000Z", changes: [
    "แก้การเพิ่ม/ลดเวลาคีย์ให้ปรับวันหมดอายุจริง รวมถึงคีย์ที่หมดอายุแล้ว",
    "แสดงผลการยืนยัน Google/Discord ในหน้าตั้งค่าและแสดงชื่อบัญชีที่ยืนยันในหน้า Admin ให้ครบถ้วน"
  ], changesEn: [
    "Fixed key time adjustments to update actual expiration, including for expired keys",
    "Showed Google/Discord verification status in Settings and verified account names in Admin"
  ] },
  { version: "V.4.16", updatedAt: "2026-10-03T16:31:18.220Z", changes: [
    "เพิ่มปุ่มปรับเวลา key ทีละ 1 ชั่วโมง และเก็บคีย์ที่หมดอายุเกิน 7 วันไว้ในประวัติโดยไม่ให้กลับมาใช้งาน"
  ], changesEn: [
    "Added one-hour key time controls and archive expired keys after seven days so they cannot be reactivated"
  ] },
  { version: "V.4.15", updatedAt: "2026-10-03T15:53:53.989Z", changes: [
    "เริ่มนับอายุคีย์จำกัดเวลาหลังการใช้งานครั้งแรก และแสดงสถานะคีย์ที่ยังไม่เริ่มนับในหน้า Admin"
  ], changesEn: [
    "Start timed-key expiry on first use and show keys that have not started counting down in Admin"
  ] },
  { version: "V.4.14", updatedAt: "2026-10-03T15:47:39.766Z", changes: [
    "จัดแถบสร้างคีย์หน้า Admin ใหม่ให้ช่องกรอก ตัวเลือก และปุ่มไม่เบียดกันบนจอมือถือ"
  ], changesEn: [
    "Reworked the Admin key-creation form to prevent fields and buttons from overlapping on mobile"
  ] },
  { version: "V.4.13", updatedAt: "2026-10-03T15:19:55.379Z", changes: [
    "ปรับปรุงการจัดการข้อมูลเดิมให้รองรับการใช้งานระบบเวอร์ชันใหม่"
  ], changesEn: [
    "Improved existing data management for compatibility with the updated system"
  ] },
  { version: "V.4.12", updatedAt: "2026-10-03T14:29:09.980Z", changes: [
    "เตรียมระบบสำหรับเผยแพร่เว็บอย่างปลอดภัยและรองรับการยืนยันบัญชี"
  ], changesEn: [
    "Prepared the website for secure deployment and account verification"
  ] },
  { version: "V.4.11", updatedAt: "2026-10-03T13:17:37.917Z", changes: [
    "ปรับปรุงการจัดการบัญชีและข้อมูลผู้ใช้ พร้อมนำเข้าข้อมูลเดิม",
    "เพิ่มการเข้าสู่ระบบผู้ดูแลและปรับเวลาอัปเดตให้แสดงตามเวลาไทย"
  ], changesEn: [
    "Improved account and user-data management and migrated existing data",
    "Added administrator sign-in and standardized update timestamps for the Bangkok time zone"
  ] },
  { version: "V.4.10", updatedAt: "2026-10-03T13:01:23.361Z", changes: [
    "แก้การแสดงวันที่และเวลาอัปเดต โดยบันทึกเวลาแบบมาตรฐานและแสดงตามเวลาไทย"
  ], changesEn: [
    "Standardized update timestamps and displayed them in the Bangkok time zone"
  ] },
  { version: "V.4.9", date: "2026-10-03", time: "12:50", changes: [
    "ปรับปุ่มเพิ่ม/ลดจำนวนเป็นคู่ปุ่มรองสีเข้มและปุ่มหลักสีส้ม พร้อมจัดระยะและมุมโค้งตามหน้าตาระบบ"
  ], changesEn: [
    "Restyled quantity controls with dark secondary and orange primary buttons, with improved spacing and rounded corners"
  ] },
  { version: "V.4.8", date: "2026-10-03", time: "12:45", changes: [
    "ปรับปุ่มเพิ่ม/ลดจำนวนให้เข้ากับพื้นเข้มและโทนส้มของระบบ พร้อมเพิ่มสถานะ hover/focus ที่ชัดเจน"
  ], changesEn: [
    "Matched quantity steppers to the dark and orange theme and improved hover/focus states"
  ] },
  { version: "V.4.7", date: "2026-10-03", time: "00:00", changes: [
    "เพิ่มปุ่มเพิ่ม/ลดทีละ 1 ให้ช่องตัวเลขที่แก้ไขได้ พร้อมรองรับช่องที่เพิ่มภายหลัง"
  ], changesEn: [
    "Added +/- one controls to editable number inputs, including inputs added dynamically"
  ] },
  { version: "V.4.6", date: "2026-09-13", time: "14:52", changes: [
    "ปรับการคราฟให้เป็นการขาย 1 ชุดต่อ 1 ครั้ง โดยอิงราคาขายที่บันทึกไว้จริง",
    "บันทึกยอดคราฟในประวัติการขาย Dashboard กราฟ 7 วัน ยอดขายวันนี้ และสินค้าขายดี",
    "หักวัตถุดิบตามจำนวนที่คราฟจริง และแสดงรายการวัตถุดิบที่ถูกหักในกิจกรรมล่าสุดและหมายเหตุการขาย"
  ], changesEn: [
    "Treat each crafted batch as a sale using the saved selling price",
    "Include crafted quantities in sales history, dashboard charts, today's totals, and best sellers",
    "Deduct the exact ingredients used and list them in recent activity and sale notes"
  ] },
  { version: "V.4.5", date: "2026-09-11", time: "15:45", changes: [
    "เพิ่มช่องแก้ไขและบันทึกราคาขายต่อชิ้นในรายละเอียดสูตรคราฟ",
    "ซิงก์ราคาที่แก้ไขไปยังสินค้าผลลัพธ์และใช้ราคานี้เมื่อสร้างสินค้าจากการคราฟ"
  ], changesEn: [
    "Added an editable per-item selling price to craft recipes",
    "Sync the price to the result product and use it when crafting"
  ] },
  { version: "V.4.4", date: "2026-09-11", time: "14:54", changes: [
    "รวมยอดงานฟาร์มใน Dashboard กราฟ และรายงานให้แสดงออเดอร์ จำนวน และรายได้จริงครบถ้วน",
    "เพิ่มการแสดงราคาขายของผลลัพธ์คราฟ และเลือกจำนวนคราฟได้ โดยหักวัตถุดิบตามจำนวนที่เลือก"
  ], changesEn: [
    "Included farm orders, quantities, and actual revenue in dashboard charts and reports",
    "Showed craft-result selling prices and allowed choosing the craft quantity with matching ingredient deductions"
  ] },
  { version: "V.4.3", date: "2026-09-10", time: "07:01", changes: [
    "ลดอาการกระตุกด้วยการป้องกันการวาดหน้าเดิมและกราฟซ้ำโดยไม่จำเป็น",
    "ปรับปรุงความเร็วในการแสดงผลหน้าเว็บ"
  ], changesEn: [
    "Reduced UI lag by avoiding unnecessary page and chart redraws",
    "Improved page loading performance"
  ] },
  { version: "V.4.2", date: "2026-09-10", time: "06:50", changes: [
    "เพิ่มช่องเลือกหมวดหมู่ในฟอร์มเพิ่มและแก้ไขสูตรคราฟ",
    "ปรับการเรียงหน้าไอเทมและรายการฟาร์มให้แยกตามหมวด ระดับ และจำนวนให้เหมือนหน้าคราฟ"
  ], changesEn: [
    "Added category selection to craft-recipe creation and editing",
    "Grouped products and farm listings by category, rarity, and quantity to match crafting"
  ] },
  { version: "V.4.1", date: "2026-09-10", time: "06:42", changes: [
    "แยกกลุ่มสูตรคราฟตามหมวดดาบ ผลปีศาจ วัตถุดิบ ของแต่ง และอื่นๆ",
    "เรียงระดับความหายากจากสูงไปต่ำ แล้วเรียงจำนวนที่คราฟได้ภายในระดับเดียวกัน"
  ], changesEn: [
    "Grouped craft recipes into swords, fruits, materials, accessories, and other categories",
    "Sorted by rarity from highest to lowest, then by craftable quantity"
  ] },
  { version: "V.4.0", date: "2026-09-10", time: "06:31", changes: [
    "ปรับการเรียงสูตรคราฟให้จำนวนที่คราฟได้มากสุดอยู่ด้านบน",
    "เมื่อจำนวนเท่ากันจะแสดงสูตรตามระดับความหายากจากสูงไปต่ำ และดันสูตรที่วัตถุดิบไม่ครบไว้ท้ายรายการ"
  ], changesEn: [
    "Sorted craft recipes with the highest craftable quantity first",
    "Broke ties by rarity and moved recipes with missing ingredients to the bottom"
  ] },
  { version: "V.3.9", date: "2026-09-10", time: "06:29", changes: [
    "ปรับเมนูเลือกวัตถุดิบในสูตรคราฟให้ค้นหาด้วยการพิมพ์ชื่อได้",
    "เพิ่มรายการตัวเลือกแบบค้นหาได้ในแต่ละแถว พร้อมแสดงภาพวัตถุดิบที่เลือก"
  ], changesEn: [
    "Added searchable ingredient selection to craft recipes",
    "Added searchable options to each row and previews of selected ingredients"
  ] },
  { version: "V.3.8", date: "2026-09-10", time: "06:16", changes: [
    "เพิ่ม Noir Pearl เข้าในคลังอัตโนมัติสำหรับข้อมูลเดิมที่ยังไม่มีรายการนี้"
  ], changesEn: [
    "Automatically added Noir Pearl to existing inventories that did not already contain it"
  ] },
  { version: "V.3.7", date: "2026-09-10", time: "05:04", changes: [
    "เพิ่มสูตรคราฟ Chronicles Lore, Essence Book, Fate Book และ Fortune Tales",
    "เพิ่มภาพไอคอนและภาพสูตรของไอเทมใหม่ให้เลือกและแสดงผลในหน้าคราฟ"
  ], changesEn: [
    "Added crafting recipes for Chronicles Lore, Essence Book, Fate Book, and Fortune Tales",
    "Added selectable icons and recipe images for the new items"
  ] },
  { version: "V.3.6", date: "2026-09-09", time: "19:05", changes: [
    "เพิ่มเวลาอัปเดตในหน้าอัปเดต เพื่อให้ตรวจสอบได้ว่าแต่ละเวอร์ชันอัปเดตเมื่อเวลาใด"
  ], changesEn: [
    "Added update times to the changelog for each version"
  ] },
  { version: "V.3.5", date: "2026-09-09", changes: [
    "แก้ต้นทุนคราฟให้คำนวณจากราคาขายปัจจุบันของวัตถุดิบแต่ละชิ้นในหน้าขายไอเทม",
    "ไม่ให้การคราฟเขียนทับราคาขายของสินค้าผลลัพธ์ เพื่อป้องกันราคาเพี้ยนเมื่อถูกใช้เป็นวัตถุดิบต่อ"
  ], changesEn: [
    "Calculate crafting costs from each ingredient's current selling price",
    "Keep crafting from overwriting the result item's selling price when it is later used as an ingredient"
  ] },
  { version: "V.3.4", date: "2026-09-08", changes: [
    "เพิ่มการคำนวณต้นทุนของคราฟจากเรทราคาวัตถุดิบในหน้าขายไอเทม",
    "รวมราคาวัตถุดิบตามจำนวนที่ใช้และแสดงต้นทุนต่อชิ้นในสูตรคราฟ",
    "เมนูวัตถุดิบดึงเฉพาะสินค้าในหมวดของวัตถุดิบจากคลังขายแบบอัตโนมัติ เมื่อเพิ่มสินค้าใหม่จะเลือกได้ทันที"
  ], changesEn: [
    "Calculate crafting costs using ingredient prices from the sales inventory",
    "Total ingredient costs by required quantity and show the per-item cost in each recipe",
    "Automatically populate ingredient choices from material-category inventory, including newly added items"
  ] },
  { version: "V.3.2", date: "2026-09-08", changes: [
    "เพิ่มปุ่มถังขยะสำหรับลบสูตรคราฟที่ไม่ต้องการ",
    "เพิ่มหน้าต่างยืนยันก่อนลบ เพื่อป้องกันการกดผิด",
    "การลบสูตรจะลบเฉพาะสูตรคราฟ ไม่กระทบสินค้าและสต็อกในคลัง"
  ], changesEn: [
    "Added a delete button for unwanted crafting recipes",
    "Added a confirmation dialog to prevent accidental deletion",
    "Deleting a recipe leaves inventory items and stock unchanged"
  ] },
  { version: "V.3.1", date: "2026-09-08", changes: [
    "เพิ่มกิจกรรมล่าสุดเมื่อคราฟสินค้า โดยระบุว่าเป็นสินค้าที่คราฟเพื่อเตรียมนำไปขาย",
    "เพิ่มจำนวนสินค้าที่คราฟเข้าอันดับสินค้าขายดีโดยไม่ปนกับยอดขายและรายได้จริง",
    "แยกประเภทกิจกรรมคราฟด้วยไอคอนและสีให้เห็นชัดใน Dashboard"
  ], changesEn: [
    "Logged crafting in recent activity as stock prepared for sale",
    "Included crafted quantities in best-seller rankings without counting them as actual sales or revenue",
    "Distinguished crafting activity on the dashboard with its own icon and color"
  ] },
  { version: "V.3.0", date: "2026-09-08", changes: [
    "ตกแต่งรายการวัตถุดิบในหน้าสูตรคราฟใหม่ให้อ่านง่ายและเป็นระเบียบขึ้น",
    "เพิ่มรูปภาพวัตถุดิบในแต่ละแถว และเปลี่ยนรูปทันทีเมื่อเลือกจากเมนู",
    "ปรับช่องเลือกวัตถุดิบและจำนวนให้แยกชัดเจน พร้อมปุ่มลบที่ใช้งานง่าย"
  ], changesEn: [
    "Improved the layout and readability of ingredients in crafting recipes",
    "Added an image to each ingredient row and update it when a different ingredient is selected",
    "Separated ingredient and quantity controls and made row removal easier"
  ] },
  { version: "V.2.9", date: "2026-09-08", changes: [
    "ปรับหน้าต่างเพิ่มและแก้ไขสูตรคราฟให้สวยงามและใช้งานง่ายขึ้น",
    "รวมการเลือกไอเทม รูปไอเทม และภาพสูตรไว้ในเมนูเดียวโดยอิงจากชื่อสินค้า",
    "เพิ่มตัวอย่างภาพไอเทมและภาพสูตรอัตโนมัติก่อนบันทึกสูตร",
    "ลดข้อมูลซ้ำซ้อนและปรับสูตรเดิมให้ใช้รูปแบบชื่อไอเทมเดียวกันทั้งหมด"
  ], changesEn: [
    "Redesigned the add/edit recipe dialog for easier use",
    "Unified item, item-image, and recipe-image selection based on the product name",
    "Added automatic item and recipe image previews before saving",
    "Reduced duplicate data and standardized item names across existing recipes"
  ] },
  { version: "V.2.8", date: "2026-09-08", changes: [
    "ปรับการแก้ไขสูตรคราฟให้เลือกวัตถุดิบจากเมนูสินค้าในคลัง ไม่ต้องพิมพ์ชื่อเอง",
    "เพิ่มปุ่มเพิ่มและลบแถววัตถุดิบ พร้อมระบุจำนวนที่ใช้ต่อการคราฟ 1 ชิ้น",
    "เพิ่มภาพไอเทมสำหรับการ์ดสูตร และแสดงภาพสูตรคราฟในรายละเอียด",
    "เพิ่มเมนูเพิ่มสูตรคราฟและปุ่มแก้ไขสูตรในหน้า สินค้า / Stock",
    "เพิ่มการตรวจวัตถุดิบ คำนวณจำนวนที่คราฟได้ และบันทึกผลลัพธ์ลงคลัง"
  ], changesEn: [
    "Select crafting ingredients from inventory instead of entering names manually",
    "Added controls to add or remove ingredient rows and set the amount needed per crafted item",
    "Added item images to recipe cards and recipe images to details",
    "Added recipe creation and editing controls to the Products / Stock page",
    "Check ingredient availability, calculate craftable quantity, and add crafted results to inventory"
  ] },
  { version: "V.2.6", date: "2026-09-06", changes: [
    "ปรับหน้า Dashboard ให้ใกล้เคียงดีไซน์จาก Figma พร้อมกราฟเส้นและแผงสรุปแบบใหม่",
    "เพิ่มเอฟเฟกต์สินค้าลอยตามเมาส์และปรับหน้า 404 ให้สวยขึ้น พร้อมใช้ฟอนต์ Itim",
    "ปรับปรุงการตั้งค่าการแสดงผลและการเตรียมระบบสำหรับใช้งานบนเว็บ"
  ], changesEn: [
    "Updated the dashboard to match the Figma design with new line charts and summary panels",
    "Added mouse-follow product effects, improved the 404 page, and adopted the Itim font",
    "Improved display settings and prepared the system for web use"
  ] },
  { version: "V.2.5", date: "2026-09-06", changes: [
    "ปรับรายการรับฟาร์มให้เลือกหมวดหมู่และตั้งราคาได้ทั้งต่อจำนวนหรือรายชั่วโมง พร้อมคำนวณราคาอัตโนมัติเมื่อรับงาน",
    "เพิ่มกิจกรรมของการสร้าง แก้ไข ลบ และรับงานฟาร์มในกิจกรรมล่าสุด",
    "เพิ่มอิโมจิให้แท็บรับฟาร์ม ปุ่มปฏิทิน และเมนูที่เกี่ยวข้อง"
  ], changesEn: [
    "Added farm-service categories and per-quantity or hourly pricing with automatic order totals",
    "Recorded farm-service creation, edits, deletions, and orders in recent activity",
    "Added icons to the farm tab, calendar button, and related menus"
  ] },
  { version: "V.2.4", date: "2026-09-05", changes: [
    "ปรับธีมเว็บใหม่ เพิ่มพื้นหลังมีมิติ animation และลูกเล่น hover ให้ใช้งานสนุกขึ้น"
  ], changesEn: [
    "Refreshed the web theme with a dimensional background, animations, and hover effects"
  ] },
  { version: "V.2.3", date: "2026-09-05", changes: [
    "ปรับปรุงการเข้าใช้งาน Admin ให้กลับมาใช้งานได้ต่อเนื่อง"
  ], changesEn: [
    "Improved Admin sign-in continuity"
  ] },
  { version: "V.2.2", date: "2026-09-05", changes: [
    "ปรับปรุงการจัดเก็บคีย์ โดยซ่อนรายละเอียดภายในเป็น **** และจัดการข้อมูลให้อัตโนมัติ"
  ], changesEn: [
    "Improved key storage; internal details are hidden as **** and handled automatically"
  ] },
  { version: "V.2.1", date: "2026-09-05", changes: [
    "จำกัดการเข้าหน้า Admin ให้เฉพาะคีย์ที่มีสิทธิ์ Admin เท่านั้น"
  ], changesEn: [
    "Restricted the Admin page to keys with administrator privileges"
  ] },
  { version: "V.2.0", date: "2026-09-05", changes: [
    "เพิ่ม URL แยกสำหรับทุกหน้า พร้อมรองรับปุ่ม Back/Forward โดยไม่ต้องโหลดหน้าใหม่"
  ], changesEn: [
    "Added distinct URLs for each page and support for browser Back/Forward navigation without reloading"
  ] },
  { version: "V.1.9", date: "2026-09-05", changes: [
    "ปรับปฏิทินประวัติการขายเป็นปฏิทินแบบ Custom ที่เลือกวันและเปลี่ยนเดือนได้",
    "เพิ่มตัวกรองคีย์ Admin แบบกดเลือก และรวมงานฟาร์มในกิจกรรมล่าสุดกับอันดับรายการ"
  ], changesEn: [
    "Replaced the sales-history date selector with a custom calendar for choosing days and months",
    "Added selectable admin-key filters and included farm jobs in recent activity and item rankings"
  ] },
  { version: "V.1.8", date: "2026-09-05", changes: [
    "เพิ่มปุ่มเพิ่มรายการเพิ่มเติมสำหรับสินค้าและรายการฟาร์ม",
    "จัดกลุ่มคีย์ Admin ตามสถานะและประเภท พร้อมนำหน้าอัปเดตกลับมา"
  ], changesEn: [
    "Added controls to create additional product and farm-service entries",
    "Grouped admin keys by status and type and restored the Updates page"
  ] },
  { version: "V.1.7", date: "2026-09-05", changes: [
    "เพิ่มปุ่มคัดลอกคีย์ในหน้า Settings และหน้า Admin"
  ], changesEn: [
    "Added key-copy buttons to Settings and Admin"
  ] },
  { version: "V.1.6", date: "2026-09-05", changes: [
    "เพิ่มรูปภาพให้รายการรับฟาร์มเหมือนรายการสินค้า",
    "ยกเลิกหน้า Sign Up และให้คีย์ที่ใช้งานได้เข้าสู่ระบบทันที",
    "เพิ่มการดูคีย์และเวลาคงเหลือใน Settings พร้อมปรับปรุงการแสดงผล Admin"
  ], changesEn: [
    "Added images to farm-service entries, matching product listings",
    "Removed the sign-up page so valid keys can log in directly",
    "Added key and remaining-time details to Settings and improved the Admin display"
  ] },
  { version: "V.1.5", date: "2026-09-05", changes: [
    "เพิ่มแถบรับฟาร์มในหน้า Stock พร้อมตั้งเรท บันทึกงาน และประวัติรายการ",
    "เพิ่ม Backup/Restore ข้อมูลรับฟาร์ม และสร้างคีย์ Admin จากหน้า Admin ได้"
  ], changesEn: [
    "Added a farm-services section to Stock with pricing, order entry, and order history",
    "Added farm-service data to Backup/Restore and enabled creating admin keys from the Admin page"
  ] },
  { version: "V.1.4", date: "2026-09-04", changes: [
    "เพิ่มฟอนต์ Itim และปรับหน้า Admin ให้เห็นส่วนควบคุมชัดเจนขึ้น"
  ], changesEn: [
    "Added the Itim font and improved the visibility of Admin controls"
  ] },
  { version: "V.1.3", date: "2026-09-04", changes: [
    "ปรับรายงาน PDF/JSON ให้รวมคีย์ทุกสถานะและข้อมูลเจ้าของคีย์",
    "เพิ่ม Password toggle, Form validation, 404 และ Cookie consent"
  ], changesEn: [
    "Updated PDF/JSON reports to include keys of every status and their owners",
    "Added password visibility toggle, form validation, a 404 page, and cookie consent"
  ] },
  { version: "V.1.2", date: "2026-09-04", changes: [
    "เพิ่มหน้า Admin Key Manager พร้อมดูผู้ใช้และเวลาคงเหลือ",
    "เพิ่มปุ่มออกจากบัญชีและแสดงเวลาคีย์ใต้ชื่อเว็บไซต์"
  ], changesEn: [
    "Added an Admin Key Manager with user and remaining-time details",
    "Added a sign-out button and displayed key time remaining below the site name"
  ] },
  { version: "V.1.1", date: "2026-09-04", changes: [
    "ปรับปรุงการแจ้งเตือนเมื่อตรวจสอบคีย์ไม่สำเร็จ",
    "ปรับช่องกรอกคีย์ให้อ่านง่ายและปรับปรุงการจัดการสิทธิ์ Admin"
  ], changesEn: [
    "Improved feedback when key validation fails",
    "Improved key-field readability and Admin access management"
  ] },
  { version: "V.1.0", date: "2026-09-04", changes: [
    "ปรับปรุงการตอบกลับเมื่อระบบไม่พร้อมใช้งาน",
    "ปรับการจัดการคีย์ให้เป็นอัตโนมัติเมื่อ Admin สร้างคีย์"
  ], changesEn: [
    "Improved feedback when the system is unavailable",
    "Automated key management when an Admin creates a key"
  ] },
  { version: "V.0.9", date: "2026-09-04", changes: [
    "ซ่อน Admin access จากหน้าสาธารณะและให้ Admin เข้าโดยใช้คีย์เดียวกัน",
    "เพิ่มคีย์ Admin ถาวรและคีย์ผู้ใช้แบบทดลองอายุ 2 ชั่วโมง"
  ], changesEn: [
    "Removed public Admin access and required Admins to use their key",
    "Added permanent admin keys and two-hour trial user keys"
  ] },
  { version: "V.0.8", date: "2026-09-04", changes: [
    "เพิ่ม Key Gate, Sign Up, Login และหน้า Admin สร้างคีย์",
    "เพิ่ม Cube Loader สำหรับหน้า Auth และตรวจอายุคีย์อัตโนมัติ"
  ], changesEn: [
    "Added the key gate, sign-up and login flows, and an Admin key-creation page",
    "Added a cube loader to authentication and automatic key-expiry checks"
  ] },
  { version: "V.0.7", date: "2026-09-04", changes: [
    "ปรับช่องทางติดต่อให้แสดงเป็นโลโก้เท่านั้น",
    "เพิ่ม Date Range Picker, Mobile Nav Drawer, Parallax Changelog และ Easing สีส้ม"
  ], changesEn: [
    "Changed contact links to display as logos only",
    "Added a date-range picker, mobile navigation drawer, parallax changelog, and orange easing effects"
  ] },
  { version: "V.0.6", date: "2026-09-04", changes: [
    "เปลี่ยนช่องทางติดต่อเป็นโลโก้ SVG ของแต่ละแพลตฟอร์ม",
    "เพิ่มปุ่ม Back to Top ในหน้า Stock และปรับปุ่มสลับธีมใหม่"
  ], changesEn: [
    "Replaced contact icons with platform-specific SVG logos",
    "Added a Back to Top button on Stock and refreshed the theme toggle"
  ] },
  { version: "V.0.5", date: "2026-09-04", changes: [
    "เพิ่มระบบรีวิวและแสดงสถานะผู้ใช้งาน",
    "เปลี่ยนระบบให้คะแนนเป็นดาว SVG แบบโต้ตอบ"
  ], changesEn: [
    "Added reviews and user-status features",
    "Replaced the rating control with interactive SVG stars"
  ] },
  { version: "V.0.4", date: "2026-09-03", changes: [
    "เพิ่ม Feature Section สถานะผู้ใช้งานและระบบ Rating / Review แบบ Demo",
    "เพิ่มเครดิตลิงก์เจ้าของเว็บไซต์และ Skeleton สำหรับส่วนโหลดหลัก"
  ], changesEn: [
    "Added a feature section for user status and a demo rating/review system",
    "Added owner-credit links and loading skeletons for primary content"
  ] },
  { version: "V.0.3", date: "2026-09-03", changes: [
    "แก้ Grid ให้ปรับจำนวนคอลัมน์ตามพื้นที่จริงและการซูมหน้าจอ"
  ], changesEn: [
    "Adjusted the grid column count to respond to available space and browser zoom"
  ] },
  { version: "V.0.2", date: "2026-09-03", changes: [
    "จัดลำดับสินค้าตามหมวดหมู่ ระดับความหายาก และจำนวนคงเหลือ",
    "เพิ่ม Stat Card สรุปยอดขายรายวัน"
  ], changesEn: [
    "Sorted products by category, rarity, and remaining stock",
    "Added a stat card summarizing daily sales"
  ] },
  { version: "V.0.1", date: "2026-09-03", changes: [
    "จัดกลุ่มสินค้าแยกตามหมวดหมู่",
    "เรียงสินค้าตามจำนวนคงเหลือจากมากไปน้อย",
    "ปรับ Grid สินค้าให้เหมาะกับทุกขนาดหน้าจอ"
  ], changesEn: [
    "Grouped products by category",
    "Sorted products by remaining stock from highest to lowest",
    "Made the product grid responsive to different screen sizes"
  ] }
];

const CATEGORY_ICONS = {
  "ดาบ": "🗡️",
  "ผลปีศาจ": "🍇",
  "ของวัตถุดิบ": "🪵",
  "ของแต่ง": "🎩",
  "อื่นๆ": "📦",
};

const CATEGORY_ORDER = ["ดาบ", "ผลปีศาจ", "ของวัตถุดิบ", "ของแต่ง", "อื่นๆ"];

const RARITY_ORDER = ["limited","mythical","legendary","epic","rare","uncommon","common","none"];
const RARITY_COLORS = {
  limited:   "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  mythical:  "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30",
  legendary: "bg-red-500/15 text-red-300 border-red-500/30",
  epic:      "bg-purple-500/15 text-purple-300 border-purple-500/30",
  rare:      "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  uncommon:  "bg-green-500/15 text-green-300 border-green-500/30",
  common:    "bg-slate-300/15 text-slate-200 border-slate-300/30",
  none:      "bg-slate-600/15 text-slate-400 border-slate-600/30",
};

const CRAFT_OUTPUT_ITEMS = [
  "Abyss Stone", "Acrospear", "Aqua Gem", "Blaze Stone", "Bloodthirsty Stone",
  "Charm Stone", "Dark Stone", "Disillusion Stone", "Eye of Acro", "Gale Stone",
  "Glacier Stone", "Heart of Sea", "Life Stone", "Light Stone", "Poison Stone",
  "Spark Stone", "Tempestas Stone", "Chronicles Lore", "Essence Book", "Fate Book", "Fortune Tales",
];

const RECIPES = [
  { name: "Abyss Stone", rarity: "mythical", ingredients: [["Twilights Orb", 5], ["Dark Beards Totem", 4], ["Seas Wraith", 3], ["Dragon Scale", 35], ["Pile of Bones", 250]] },
  { name: "Acrospear", rarity: "legendary", ingredients: [["Eye of Acro", 5], ["Dragon Fang", 25], ["Iron Ingot", 10]] },
  { name: "Aqua Gem", rarity: "rare", ingredients: [["Coral", 10], ["Pearl", 5], ["Sea Artifact", 2]] },
  { name: "Blaze Stone", rarity: "mythical", ingredients: [["Essence of Fire", 5], ["Magma Crystal", 10], ["Obsidian", 20]] },
  { name: "Bloodthirsty Stone", rarity: "mythical", ingredients: [["Sea Kings Blood", 5], ["Sharks Canine", 25], ["Leather", 10]] },
  { name: "Charm Stone", rarity: "legendary", ingredients: [["Lost Ruby", 5], ["Fortune Tales", 10], ["Pearl", 10]] },
  { name: "Dark Stone", rarity: "legendary", ingredients: [["Noir Pearl", 5], ["Undeads Ooze", 20], ["Void Core", 5]] },
  { name: "Disillusion Stone", rarity: "legendary", ingredients: [["Luciduss Totem", 5], ["Trickshard", 10], ["Ice Crystal", 10]] },
  { name: "Eye of Acro", rarity: "epic", ingredients: [["Eye of Acro", 3], ["Fresh Fish", 10], ["Crab Meat", 10]] },
  { name: "Gale Stone", rarity: "legendary", ingredients: [["Sea Kings Fin", 15], ["Angelics Feather", 10], ["Voltix", 5]] },
  { name: "Glacier Stone", rarity: "legendary", ingredients: [["Ice Crystal", 20], ["Hydras Tail", 10], ["Essence Book", 5]] },
  { name: "Heart of Sea", rarity: "epic", ingredients: [["Heart of Sea", 3], ["Krakens Ink", 10], ["Sea Artifact", 5]] },
  { name: "Life Stone", rarity: "legendary", ingredients: [["Phoenixs Tear", 10], ["Fresh Fish", 20], ["Angelics Feather", 5]] },
  { name: "Light Stone", rarity: "legendary", ingredients: [["Light", 5], ["Aqua Gem", 10], ["Essence Book", 5]] },
  { name: "Poison Stone", rarity: "legendary", ingredients: [["Undeads Ooze", 15], ["Serpent Fin", 10], ["Krakens Ink", 5]] },
  { name: "Spark Stone", rarity: "legendary", ingredients: [["Voltix", 15], ["Copper Key", 5], ["Gunpowder", 10]] },
  { name: "Tempestas Stone", rarity: "mythical", ingredients: [["Voltix", 20], ["Sea Kings Fin", 15], ["Heart of Sea", 5]] },
  { name: "Chronicles Lore", rarity: "legendary", ingredients: [["Fortune Tales", 1], ["Hydras Tail", 1], ["Heart of Sea", 1], ["Aqua Gem", 1], ["Sea Artifact", 10]] },
  { name: "Essence Book", rarity: "mythical", ingredients: [["Sharks Canine", 1], ["Fate Book", 1], ["Gunpowder", 2], ["Fresh Fish", 10], ["Leather", 15]] },
  { name: "Fate Book", rarity: "rare", ingredients: [["Gunpowder", 1], ["Log", 15], ["Angelics Feather", 10]] },
  { name: "Fortune Tales", rarity: "legendary", ingredients: [["Seas Wraith", 1], ["Essence Book", 1], ["Dragon Scale", 1], ["Fresh Fish", 10], ["Carrot", 15]] },
];

const RAW_CATALOG = [
  ["Angelics Feather","ของวัตถุดิบ",300.0,"assets/products/material/Angelics_Feather.png","none"],
  ["Aqua Gem","ของวัตถุดิบ",2.0,"assets/products/material/Aqua_Gem.png","none"],
  ["Bread Crumbs","ของวัตถุดิบ",5,"assets/products/material/Bread_Crumbs.png","none"],
  ["Carrot","ของวัตถุดิบ",1000.0,"assets/products/material/Carrot.png","none"],
  ["Chronicles Lore","ของวัตถุดิบ",5,"assets/products/material/Chronicles_Lore.png","none"],
  ["Copper Key","ของวัตถุดิบ",5,"assets/products/material/Copper_Key.png","none"],
  ["Coral","ของวัตถุดิบ",30.0,"assets/products/material/Coral.png","none"],
  ["Crab Meat","ของวัตถุดิบ",0.2,"assets/products/material/Crab_Meat.png","none"],
  ["Crustar","ของวัตถุดิบ",5,"assets/products/material/Crustar.png","none"],
  ["Dark Beards Totem","ของวัตถุดิบ",15.0,"assets/products/material/Dark_Beards_Totem.png","none"],
  ["Dragon Fang","ของวัตถุดิบ",0.04,"assets/products/material/Dragon_Fang.png","none"],
  ["Dragon Scale","ของวัตถุดิบ",3.0,"assets/products/material/Dragon_Scale.png","none"],
  ["Dragons Orb","ของวัตถุดิบ",3.0,"assets/products/material/Dragons_Orb.png","none"],
  ["Essence Book","ของวัตถุดิบ",5,"assets/products/material/Essence_Book.png","none"],
  ["Essence of Fire","ของวัตถุดิบ",3.0,"assets/products/material/Essence_of_Fire.png","none"],
  ["Eye of Acro","ของวัตถุดิบ",5,"assets/products/material/Eye_of_Acro.png","none"],
  ["Fate Book","ของวัตถุดิบ",5,"assets/products/material/Fate_Book.png","none"],
  ["Fortune Tales","ของวัตถุดิบ",5,"assets/products/material/Fortune_Tales.png","none"],
  ["Fragment","ของวัตถุดิบ",5,"assets/products/material/Fragment.png","none"],
  ["Fresh Fish","ของวัตถุดิบ",300.0,"assets/products/material/Fresh_Fish.png","none"],
  ["Gunpowder","ของวัตถุดิบ",150.0,"assets/products/material/Gunpowder.png","none"],
  ["Heart of Sea","ของวัตถุดิบ",5,"assets/products/material/Heart_of_Sea.png","none"],
  ["Hydras Tail","ของวัตถุดิบ",0.1,"assets/products/material/Hydras_Tail.png","none"],
  ["Ice Crystal","ของวัตถุดิบ",10.0,"assets/products/material/Ice_Crystal.png","none"],
  ["Iridium Key","ของวัตถุดิบ",5,"assets/products/material/Iridium_Key.png","none"],
  ["Iron Ingot","ของวัตถุดิบ",1000.0,"assets/products/material/Iron_Ingot.png","none"],
  ["Krakens Ink","ของวัตถุดิบ",0.2,"assets/products/material/Krakens_Ink.png","none"],
  ["Leather","ของวัตถุดิบ",300.0,"assets/products/material/Leather.png","none"],
  ["Log","ของวัตถุดิบ",100.0,"assets/products/material/Log.png","none"],
  ["Lost Ruby","ของวัตถุดิบ",3.0,"assets/products/material/Lost_Ruby.png","none"],
  ["Luciduss Totem","ของวัตถุดิบ",15.0,"assets/products/material/Luciduss_Totem.png","none"],
  ["Magma Crystal","ของวัตถุดิบ",10.0,"assets/products/material/Magma_Crystal.png","none"],
  ["Noir Pearl","ของวัตถุดิบ",5,"assets/products/material/Noir_Pearl.png","none"],
  ["Obsidian","ของวัตถุดิบ",5,"assets/products/material/Obsidian.png","none"],
  ["Pearl","ของวัตถุดิบ",5.0,"assets/products/material/Pearl.png","none"],
  ["Phoenixs Tear","ของวัตถุดิบ",0.1,"assets/products/material/Phoenixs_Tear.png","none"],
  ["Pile of Bones","ของวัตถุดิบ",1000.0,"assets/products/material/Pile_of_Bones.png","none"],
  ["Platinum Key","ของวัตถุดิบ",5,"assets/products/material/Platinum_Key.png","none"],
  ["Rusted Scrap","ของวัตถุดิบ",1000.0,"assets/products/material/Rusted_Scrap.png","none"],
  ["Samurais Bandage","ของวัตถุดิบ",3.0,"assets/products/material/Samurais_Bandage.png","none"],
  ["Sea Artifact","ของวัตถุดิบ",500.0,"assets/products/material/Sea_Artifact.png","none"],
  ["Sea Kings Blood","ของวัตถุดิบ",3.0,"assets/products/material/Sea_Kings_Blood.png","none"],
  ["Sea Kings Fin","ของวัตถุดิบ",0.3333333333333333,"assets/products/material/Sea_Kings_Fin.png","none"],
  ["Seas Wraith","ของวัตถุดิบ",3.0,"assets/products/material/Seas_Wraith.png","none"],
  ["Serpent Fin","ของวัตถุดิบ",0.2,"assets/products/material/Serpent_Fin.png","none"],
  ["Severed Kraken","ของวัตถุดิบ",0.2,"assets/products/material/Severed_Kraken.png","none"],
  ["Sharks Canine","ของวัตถุดิบ",3.0,"assets/products/material/Sharks_Canine.png","none"],
  ["Sharks Fin","ของวัตถุดิบ",30.0,"assets/products/material/Sharks_Fin.png","none"],
  ["Thiefs rag","ของวัตถุดิบ",300.0,"assets/products/material/Thiefs_rag.png","none"],
  ["Trickshard","ของวัตถุดิบ",5,"assets/products/material/Trickshard.png","none"],
  ["Twilights Orb","ของวัตถุดิบ",2.0,"assets/products/material/Twilights_Orb.png","none"],
  ["Undeads Ooze","ของวัตถุดิบ",300.0,"assets/products/material/Undeads_Ooze.png","none"],
  ["Vampires Vital fluid","ของวัตถุดิบ",3.0,"assets/products/material/Vampires_Vital_fluid.png","none"],
  ["Void Core","ของวัตถุดิบ",5,"assets/products/material/Void_Core.png","none"],
  ["Voltix","ของวัตถุดิบ",5,"assets/products/material/Voltix.png","none"],
  ["Abyss Sentinel Armor","ของแต่ง",0.06666666666666667,"assets/products/accessory/Abyss_Sentinel_Armor.png","epic"],
  ["Blue Admiral Coat","ของแต่ง",0.06666666666666667,"assets/products/accessory/Blue_Admiral_Coat.png","epic"],
  ["Blue Scarf","ของแต่ง",0.06666666666666667,"assets/products/accessory/Blue_Scarf.png","epic"],
  ["Dragon Necklace","ของแต่ง",0.06666666666666667,"assets/products/accessory/Dragon_Necklace.png","legendary"],
  ["Flame Hair","ของแต่ง",0.06666666666666667,"assets/products/accessory/Flame_Hair.png","epic"],
  ["Floffy Glasses","ของแต่ง",0.06666666666666667,"assets/products/accessory/Floffy_Glasses.png","legendary"],
  ["Hefty Coat","ของแต่ง",0.06666666666666667,"assets/products/accessory/Hefty_Coat.png","epic"],
  ["Inferno Cloak","ของแต่ง",0.06666666666666667,"assets/products/accessory/Inferno_Cloak.png","legendary"],
  ["Lucidus Coat","ของแต่ง",0.06666666666666667,"assets/products/accessory/Lucidus_Coat.png","epic"],
  ["Oceanic Tanto","ของแต่ง",0.06666666666666667,"assets/products/accessory/Oceanic_Tanto.png","legendary"],
  ["Oceanic Tentacle","ของแต่ง",0.06666666666666667,"assets/products/accessory/Oceanic_Tentacle.png","epic"],
  ["Pondere Coat","ของแต่ง",0.06666666666666667,"assets/products/accessory/Pondere_Coat.png","rare"],
  ["Sally Crown","ของแต่ง",0.05,"assets/products/accessory/Sally_Crown.png","epic"],
  ["Sea King Jaw","ของแต่ง",0.06666666666666667,"assets/products/accessory/Sea_King_Jaw.png","epic"],
  ["Tengu Mask","ของแต่ง",0.1,"assets/products/accessory/Tengu_Mask.png","epic"],
  ["Tomoe Taiko","ของแต่ง",0.06666666666666667,"assets/products/accessory/Tomoe_Taiko.png","epic"],
  ["Water Hydra Mask","ของแต่ง",0.06666666666666667,"assets/products/accessory/Water_Hydra_Mask.png","epic"],
  ["Water Kimono","ของแต่ง",0.025,"assets/products/accessory/Water_Kimono.png","epic"],
  ["Acroscyth","ดาบ",0.04,"assets/products/sword/Acroscyth.png","legendary"],
  ["Adventure Knife","ดาบ",0.2,"assets/products/sword/Adventure_Knife.png","rare"],
  ["Anubis Axe","ดาบ",0.2,"assets/products/sword/Anubis_Axe.png","uncommon"],
  ["Apollos","ดาบ",0.1,"assets/products/sword/Apollos.png","epic"],
  ["Aquatic Anchor","ดาบ",0.06666666666666667,"assets/products/sword/Aquatic_Anchor.png","epic"],
  ["Authentic Mace","ดาบ",0.1,"assets/products/sword/Authentic_Mace.png","epic"],
  ["Authentic Triple Katana","ดาบ",0.06666666666666667,"assets/products/sword/Authentic_Triple_Katana.png","legendary"],
  ["Avalon","ดาบ",0.06666666666666667,"assets/products/sword/Avalon.png","legendary"],
  ["Bone Scythe","ดาบ",0.06666666666666667,"assets/products/sword/Bone_Scythe.png","limited"],
  ["Cookie Sword","ดาบ",0.06666666666666667,"assets/products/sword/Cookie_Sword.png","epic"],
  ["Crimson Scarf","ดาบ",0.06666666666666667,"assets/products/sword/Crimson_Scarf.png","epic"],
  ["Dark Beard Hat","ดาบ",0.06666666666666667,"assets/products/sword/Dark_Beard_Hat.png","legendary"],
  ["Dawnbreaker","ดาบ",0.06666666666666667,"assets/products/sword/Dawnbreaker.png","legendary"],
  ["Daybreak Cleaver","ดาบ",0.06666666666666667,"assets/products/sword/Daybreak_Cleaver.png","epic"],
  ["Dragons Standard","ดาบ",0.1,"assets/products/sword/Dragons_Standard.png","epic"],
  ["Ethereal","ดาบ",0.04,"assets/products/sword/Ethereal.png","legendary"],
  ["Hell Sword","ดาบ",0.1,"assets/products/sword/Hell_Sword.png","epic"],
  ["Kioru V2","ดาบ",0.06666666666666667,"assets/products/sword/Kioru_V2.png","legendary"],
  ["Longaevus","ดาบ",0.06666666666666667,"assets/products/sword/Longaevus.png","legendary"],
  ["Metal Trident","ดาบ",0.06666666666666667,"assets/products/sword/Metal_Trident.png","epic"],
  ["Muramasa","ดาบ",0.06666666666666667,"assets/products/sword/Muramasa.png","legendary"],
  ["Phoenix Blade","ดาบ",0.06666666666666667,"assets/products/sword/Phoenix_Blade.png","epic"],
  ["Pumpkin Smasher","ดาบ",0.06666666666666667,"assets/products/sword/Pumpkin_Smasher.png","limited"],
  ["Quake Spear","ดาบ",0.06666666666666667,"assets/products/sword/Quake_Spear.png","epic"],
  ["Riptide Slayer","ดาบ",0.06666666666666667,"assets/products/sword/Riptide_Slayer.png","legendary"],
  ["Saber","ดาบ",0.06666666666666667,"assets/products/sword/Saber.png","legendary"],
  ["Scepters of Flame","ดาบ",0.06666666666666667,"assets/products/sword/Scepters_of_Flame.png","epic"],
  ["Soul Cane","ดาบ",0.1,"assets/products/sword/Soul_Cane.png","epic"],
  ["Allo","ผลปีศาจ",0.06666666666666667,"assets/products/fruit/Allo.png","rare"],
  ["Brachio","ผลปีศาจ",0.06666666666666667,"assets/products/fruit/Brachio.png","rare"],
  ["Buddha","ผลปีศาจ",0.14285714285714285,"assets/products/fruit/Buddha.png","rare"],
  ["Control","ผลปีศาจ",0.14285714285714285,"assets/products/fruit/Control.png","rare"],
  ["Dough","ผลปีศาจ",0.06666666666666667,"assets/products/fruit/Dough.png","legendary"],
  ["Dragon","ผลปีศาจ",0.05,"assets/products/fruit/Dragon.png","legendary"],
  ["Flame","ผลปีศาจ",0.1,"assets/products/fruit/Flame.png","epic"],
  ["Gas","ผลปีศาจ",0.1,"assets/products/fruit/Gas.png","epic"],
  ["Gate","ผลปีศาจ",0.06666666666666667,"assets/products/fruit/Gate.png","legendary"],
  ["Gold","ผลปีศาจ",0.1,"assets/products/fruit/Gold.png","epic"],
  ["Gravity","ผลปีศาจ",0.14285714285714285,"assets/products/fruit/Gravity.png","rare"],
  ["Ice","ผลปีศาจ",0.1,"assets/products/fruit/Ice.png","epic"],
  ["Light","ผลปีศาจ",0.1,"assets/products/fruit/Light.png","epic"],
  ["Love","ผลปีศาจ",0.2,"assets/products/fruit/Love.png","uncommon"],
  ["Magma","ผลปีศาจ",0.1,"assets/products/fruit/Magma.png","epic"],
  ["Magnet","ผลปีศาจ",0.1,"assets/products/fruit/Magnet.png","epic"],
  ["Mammoth","ผลปีศาจ",0.06666666666666667,"assets/products/fruit/Mammoth.png","rare"],
  ["Phoenix","ผลปีศาจ",0.06666666666666667,"assets/products/fruit/Phoenix.png","legendary"],
  ["Pter","ผลปีศาจ",0.04,"assets/products/fruit/Pter.png","mythical"],
  ["Quake","ผลปีศาจ",0.1,"assets/products/fruit/Quake.png","epic"],
  ["Rubber","ผลปีศาจ",0.14285714285714285,"assets/products/fruit/Rubber.png","rare"],
  ["Rumble","ผลปีศาจ",0.1,"assets/products/fruit/Rumble.png","epic"],
  ["Snow","ผลปีศาจ",0.1,"assets/products/fruit/Snow.png","epic"],
  ["Spino","ผลปีศาจ",0.06666666666666667,"assets/products/fruit/Spino.png","rare"],
  ["Spirit","ผลปีศาจ",0.1,"assets/products/fruit/Spirit.png","epic"],
  ["Toy","ผลปีศาจ",0.06666666666666667,"assets/products/fruit/Toy.png","legendary"],
  ["Venom","ผลปีศาจ",0.06666666666666667,"assets/products/fruit/Venom.png","rare"],
];

function buildDefaultProducts() {
  return RAW_CATALOG.map(([name, category, rate, image, rarity], i) => {
    const stock = Math.max(3, Math.min(300, Math.round(rate * 15) + 5));
    return {
      id: "p_" + Date.now().toString(36) + "_" + i,
      name, category,
      image: image || null,
      rarity: rarity || "none",
      stock, sold: 0, crafted: 0,
      unitsPerBaht: rate,
      description: "",
      createdAt: Date.now() - (RAW_CATALOG.length - i) * 1000,
      restockHistory: [],
    };
  });
}

function defaultState({ emptyWorkspace = false } = {}) {
  return {
    products: emptyWorkspace ? [] : buildDefaultProducts(),
    farmServices: [],
    farmOrders: [],
    activityLog: [],
    sales: [],
    settings: { stockAlert: 5, categories: Object.keys(CATEGORY_ICONS).filter(c=>c!=="อื่นๆ") },
    ...(emptyWorkspace ? { recipes: RECIPES.map(recipe => ({ ...recipe, ingredients: recipe.ingredients.map(item => [...item]) })) } : {}),
  };
}
