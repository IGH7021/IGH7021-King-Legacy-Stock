const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const APP_TIME = require("../shared/time");
const { buildAdminOverview, buildAdminUserDetail, mergePresenceRows } = require("../server/admin-analytics");

function workspace(overrides = {}) {
  return {
    products: [],
    sales: [],
    settings: { stockAlert: 5 },
    farmOrders: [],
    orders: [],
    upgradeOrders: [],
    activityLog: [],
    ...overrides,
  };
}

test("Admin presence queries merge duplicate clients using the newest timestamps", () => {
  const rows = mergePresenceRows(
    [{ client_id: "client-a", owner_id: "owner-a", last_seen: "2025-01-15T10:00:00Z", last_authenticated_at: "2025-01-15T09:00:00Z" }],
    [{ client_id: "client-a", owner_id: "owner-b", last_seen: "2025-01-15T10:02:00Z", last_authenticated_at: "2025-01-15T08:00:00Z" }],
    [{ client_id: "client-a", owner_id: "owner-c", last_seen: "2025-01-15T09:00:00Z", last_authenticated_at: "2025-01-15T09:30:00Z" }],
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0].owner_id, "owner-c");
  assert.equal(rows[0].last_seen, "2025-01-15T10:02:00Z");
  assert.equal(rows[0].last_authenticated_at, "2025-01-15T09:30:00Z");
});

test("admin overview aggregates revenue, activity, presence, products, and stock per account", () => {
  const now = Date.parse("2025-01-15T12:00:00Z");
  const today = APP_TIME.dayStart(now) + 3600000;
  const old = now - 2 * 86400000;
  const result = buildAdminOverview({
    now,
    authData: {
      users: [{ id: "owner-a", name: "Player A" }, { id: "owner-b", name: "Player B" }],
      identities: [],
    },
    presenceRows: [
      { owner_id: "owner-a", last_seen: new Date(now - 10000).toISOString(), last_authenticated_at: new Date(today).toISOString() },
      { owner_id: "owner-b", last_seen: new Date(now - 600000).toISOString(), last_authenticated_at: new Date(today).toISOString() },
    ],
    stateRows: [
      {
        owner_id: "owner-a",
        updated_at: new Date(now).toISOString(),
        state: workspace({
          products: [
            { id: "blade-a", name: "Blade", category: "Sword", stock: 5, sold: 3 },
            { id: "pass-a", name: "Game Pass", category: "Game Pass", gamePass: {
              gift: { price: 10, stock: 10, sold: 6 },
              trade: { price: 12, stock: null, sold: 0 },
            } },
          ],
          sales: [{ id: "sale-a", productId: "blade", productName: "Blade", quantity: 2, money: 20, date: today }],
          farmOrders: [{ id: "farm-a", serviceName: "Leveling", quantity: 1, money: 10, customer: "Alice", date: today }],
          upgradeOrders: [{ id: "upgrade-a", productName: "Sword upgrade", quantity: 1, money: 4, customer: "Alice", date: today }],
          orders: [{ id: "order-a", customer: "Alice", total: 30, status: "completed", date: today, lines: [{ name: "Blade" }] }],
          activityLog: [{ id: "activity-a", type: "backup", text: "Exported backup", ts: today }],
        }),
      },
      {
        owner_id: "owner-b",
        updated_at: new Date(old).toISOString(),
        state: workspace({
          products: [{ id: "blade-b", name: "Blade", category: "Sword", stock: 20, sold: 0 }],
          sales: [{ id: "sale-b", productId: "blade", productName: "Blade", quantity: 1, money: 5, date: old }],
        }),
      },
      { owner_id: "owner-invalid", state: { products: null } },
    ],
  });

  assert.equal(result.summary.totalUsers, 2);
  assert.equal(result.summary.onlineUsers, 1);
  assert.equal(result.summary.accessedToday, 2);
  assert.equal(result.summary.todayRevenue, 34);
  assert.equal(result.summary.totalRevenue, 39);
  assert.equal(result.summary.salesRecordsToday, 1);
  assert.equal(result.summary.totalSalesRecords, 2);
  assert.equal(result.summary.ordersToday, 3);
  assert.equal(result.summary.customersToday, 1);
  assert.equal(result.summary.lowStockCount, 2);
  assert.equal(result.summary.invalidStateCount, 1);
  assert.equal(result.inventory.find(item => item.name === "Blade").trackedAccounts, 2);
  assert.equal(result.inventory.find(item => item.name === "Blade").remainingUnits, 22);
  assert.equal(result.bestSellers[0].quantity, 3);
  assert.equal(result.recentOrders[0].owner, "Player A");
});

test("admin account details omit images, credentials, and free-form order notes", () => {
  const state = workspace({
    products: [{ id: "custom", name: "Private item", category: "Other", image: "data:image/png;base64,private", stock: 4, sold: 1 }],
    sales: [{ id: "sale", productName: "Private item", quantity: 1, money: 3, date: 1000, note: "private sale note" }],
    orders: [{ id: "order", date: 1000, customer: "Customer", note: "private order note", total: 3, lines: [{ name: "Private item", quantity: 1, subtotal: 3 }] }],
  });
  const detail = buildAdminUserDetail({
    ownerId: "owner-a",
    row: { state, updated_at: new Date(2000).toISOString() },
    authData: { users: [{ id: "owner-a", name: "Player A", email: "private@example.test" }], identities: [] },
    presenceRows: [],
    now: 3000,
  });

  assert.equal(detail.user.name, "Player A");
  assert.equal("email" in detail.user, false);
  assert.equal("image" in detail.products[0], false);
  assert.equal("note" in detail.sales[0], false);
  assert.equal("note" in detail.orders[0], false);
  assert.equal("passwordHash" in detail, false);
});

test("admin workspace presence and data are excluded from customer metrics", () => {
  const now = Date.parse("2025-01-15T12:00:00Z");
  const state = workspace({ sales: [{ id: "admin-sale", productName: "Test", quantity: 1, money: 50, date: now }] });
  const result = buildAdminOverview({
    now,
    authData: { users: [{ id: "owner-user", name: "Player" }], identities: [] },
    excludedOwnerIds: ["owner-admin"],
    presenceRows: [{ owner_id: "owner-admin", last_seen: new Date(now).toISOString(), last_authenticated_at: new Date(now).toISOString() }],
    stateRows: [
      { owner_id: "owner-admin", state },
      { owner_id: "owner-user", state: workspace() },
    ],
  });

  assert.equal(result.summary.totalUsers, 1);
  assert.equal(result.summary.onlineUsers, 0);
  assert.equal(result.summary.accessedToday, 0);
  assert.equal(result.summary.totalSalesRecords, 0);
});

test("admin analytics and account details reject unauthenticated requests", async () => {
  const previousDisabled = process.env.SUPABASE_DISABLED;
  process.env.SUPABASE_DISABLED = "true";
  const { server } = require("../server/server");
  try {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, resolve);
    });
    const address = server.address();
    const responses = await Promise.all([
      fetch(`http://127.0.0.1:${address.port}/api/admin/overview`),
      fetch(`http://127.0.0.1:${address.port}/api/admin/users/owner-a`),
    ]);
    assert.deepEqual(responses.map(response => response.status), [403, 403]);
  } finally {
    if (server.listening) await new Promise(resolve => server.close(resolve));
    if (previousDisabled === undefined) delete process.env.SUPABASE_DISABLED;
    else process.env.SUPABASE_DISABLED = previousDisabled;
  }
});

test("product and backup actions are recorded in the account activity log", () => {
  const state = { activityLog: [] };
  let id = 0;
  const context = {
    state,
    genId: () => `activity-${++id}`,
    t: (key, values = {}) => Object.keys(values).reduce((text, name) => text.replace(`{${name}}`, values[name]), key),
    document: { addEventListener() {} },
  };
  vm.runInNewContext(fs.readFileSync(require.resolve("../js/products.js"), "utf8"), context);
  vm.runInNewContext("addProductActivity('created', { name: 'Acrospear' });", context);
  vm.runInNewContext(fs.readFileSync(require.resolve("../js/backup.js"), "utf8"), context);
  vm.runInNewContext("addBackupActivity('restored');", context);

  assert.equal(state.activityLog.length, 2);
  assert.equal(state.activityLog[0].text, "activity_backup_restored");
  assert.equal(state.activityLog[0].type, "backup");
  assert.equal(state.activityLog[1].text, "activity_product_created");
  assert.equal(state.activityLog[1].action, "created");
});
