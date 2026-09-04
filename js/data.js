const STORAGE_KEY = "igh_kinglegacy_state";
const THEME_KEY = "igh_theme";
const LANG_KEY = "igh_lang";
const APP_VERSION = "V.1.4";
const APP_CHANGELOG = [
  { version: "V.1.4", date: "2026-09-04", changes: [
    "เพิ่มฟอนต์ Itim และปรับหน้า Admin ให้เห็นส่วนควบคุมชัดเจนขึ้น"
  ] },
  { version: "V.1.3", date: "2026-09-04", changes: [
    "ปรับรายงาน PDF/JSON ให้รวมคีย์ทุกสถานะและข้อมูลเจ้าของคีย์",
    "เพิ่ม Password toggle, Form validation, 404 และ Cookie consent"
  ] },
  { version: "V.1.2", date: "2026-09-04", changes: [
    "เพิ่มหน้า Admin Key Manager พร้อมดูผู้ใช้และเวลาคงเหลือ",
    "เพิ่มปุ่มออกจากบัญชีและแสดงเวลาคีย์ใต้ชื่อเว็บไซต์"
  ] },
  { version: "V.1.1", date: "2026-09-04", changes: [
    "แก้การตรวจคีย์ให้แจ้งเมื่อไม่ได้เปิด Node.js Server",
    "ปรับช่อง Key ให้ตัวอักษรสีขาวคมชัดและกู้คืนไฟล์ Admin key"
  ] },
  { version: "V.1.0", date: "2026-09-04", changes: [
    "แก้การตอบกลับ API เมื่อ Server ไม่พร้อมใช้งาน",
    "สร้างไฟล์คีย์แยกอัตโนมัติทุกครั้งที่ Admin สร้างคีย์"
  ] },
  { version: "V.0.9", date: "2026-09-04", changes: [
    "ซ่อน Admin access จากหน้าสาธารณะและให้ Admin เข้าโดยใช้คีย์เดียวกัน",
    "เพิ่มคีย์ Admin ถาวรและคีย์ผู้ใช้แบบทดลองอายุ 2 ชั่วโมง"
  ] },
  { version: "V.0.8", date: "2026-09-04", changes: [
    "เพิ่ม Key Gate, Sign Up, Login และหน้า Admin สร้างคีย์",
    "เพิ่ม Cube Loader สำหรับหน้า Auth และตรวจอายุคีย์อัตโนมัติ"
  ] },
  { version: "V.0.7", date: "2026-09-04", changes: [
    "ปรับช่องทางติดต่อให้แสดงเป็นโลโก้เท่านั้น",
    "เพิ่ม Date Range Picker, Mobile Nav Drawer, Parallax Changelog และ Easing สีส้ม"
  ] },
  { version: "V.0.6", date: "2026-09-04", changes: [
    "เปลี่ยนช่องทางติดต่อเป็นโลโก้ SVG ของแต่ละแพลตฟอร์ม",
    "เพิ่มปุ่ม Back to Top ในหน้า Stock และปรับปุ่มสลับธีมใหม่"
  ] },
  { version: "V.0.5", date: "2026-09-04", changes: [
    "เพิ่ม Node.js Server และ API สำหรับรีวิวกับสถานะผู้ใช้งาน",
    "เปลี่ยนระบบให้คะแนนเป็นดาว SVG แบบโต้ตอบ"
  ] },
  { version: "V.0.4", date: "2026-09-03", changes: [
    "เพิ่ม Feature Section สถานะผู้ใช้งานและระบบ Rating / Review แบบ Demo",
    "เพิ่มเครดิตลิงก์เจ้าของเว็บไซต์และ Skeleton สำหรับส่วนโหลดหลัก"
  ] },
  { version: "V.0.3", date: "2026-09-03", changes: [
    "แก้ Grid ให้ปรับจำนวนคอลัมน์ตามพื้นที่จริงและการซูมหน้าจอ"
  ] },
  { version: "V.0.2", date: "2026-09-03", changes: [
    "จัดลำดับสินค้าตามหมวดหมู่ ระดับความหายาก และจำนวนคงเหลือ",
    "เพิ่ม Stat Card สรุปยอดขายรายวัน"
  ] },
  { version: "V.0.1", date: "2026-09-03", changes: [
    "จัดกลุ่มสินค้าแยกตามหมวดหมู่",
    "เรียงสินค้าตามจำนวนคงเหลือจากมากไปน้อย",
    "ปรับ Grid สินค้าให้เหมาะกับทุกขนาดหน้าจอ"
  ] }
];

const CATEGORY_ICONS = {
  "ดาบ": "🗡️",
  "ผลปีศาจ": "🍇",
  "ของวัตถุดิบ": "🪵",
  "ของแต่ง": "🎩",
  "อื่นๆ": "📦",
};

const RARITY_ORDER = ["mythical","legendary","epic","rare","uncommon","common","limited","none"];
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
      stock, sold: 0,
      unitsPerBaht: rate,
      description: "",
      createdAt: Date.now() - (RAW_CATALOG.length - i) * 1000,
      restockHistory: [],
    };
  });
}

function defaultState() {
  return {
    products: buildDefaultProducts(),
    sales: [],
    settings: { stockAlert: 5, categories: Object.keys(CATEGORY_ICONS).filter(c=>c!=="อื่นๆ") },
  };
}

