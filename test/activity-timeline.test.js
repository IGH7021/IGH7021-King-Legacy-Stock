const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const time = require("../shared/time");

test("activity timeline filters and groups work history by Bangkok date", () => {
  const today = time.dateKey();
  const recentTimestamp = time.startOfDateKey(today) + 60_000;
  const oldTimestamp = time.startOfDateKey(time.addDays(today, -10)) + 60_000;
  const box = { innerHTML: "" };
  const state = {
    activityLog: [
      { type: "recipe", text: "เพิ่มสูตรคราฟ: Chronicles Lore", sub: "2 วัตถุดิบ", ts: recentTimestamp },
      { type: "product", text: "แก้ไขสินค้า: Old Item", sub: "ปรับราคา", ts: oldTimestamp },
    ],
    sales: [],
    farmOrders: [],
    upgradeOrders: [],
    products: [],
  };
  const context = vm.createContext({
    state,
    APP_TIME: time,
    currentLang: "th",
    document: { addEventListener() {}, getElementById: id => id === "activity-timeline" ? box : null },
    escapeHtml: String,
    t: key => key,
    fmtNum: String,
    fmtBaht: amount => `฿${amount}`,
    timeAgo: () => "เมื่อสักครู่",
  });
  vm.runInContext(fs.readFileSync(require.resolve("../js/dashboard.js"), "utf8"), context);

  vm.runInContext('activityRange = "7d"; renderTimeline();', context);
  assert.match(box.innerHTML, /Chronicles Lore/);
  assert.doesNotMatch(box.innerHTML, /Old Item/);
  assert.match(box.innerHTML, /activity-day-group/);

  vm.runInContext('activityRange = "all"; renderTimeline();', context);
  assert.match(box.innerHTML, /Old Item/);
});
