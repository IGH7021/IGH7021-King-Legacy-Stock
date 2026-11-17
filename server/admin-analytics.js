const APP_TIME = require("../shared/time");
const GAME_PASS = require("../shared/game-pass");
const { validateAccountState } = require("../shared/state-validation");

const ONLINE_WINDOW_MS = 90000;

function timestamp(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function mergePresenceRows(...collections) {
  const rowsByClient = new Map();
  for (const row of collections.flat()) {
    const clientId = row?.client_id;
    if (!clientId) continue;
    const current = rowsByClient.get(clientId);
    if (!current) {
      rowsByClient.set(clientId, { ...row });
      continue;
    }

    const merged = { ...current };
    const incomingSeen = timestamp(row.last_seen);
    const currentSeen = timestamp(current.last_seen);
    const incomingAuthenticated = timestamp(row.last_authenticated_at);
    const currentAuthenticated = timestamp(current.last_authenticated_at);
    if (incomingSeen > currentSeen) merged.last_seen = row.last_seen;
    if (incomingAuthenticated > currentAuthenticated) {
      merged.last_authenticated_at = row.last_authenticated_at;
      merged.owner_id = row.owner_id;
    } else if (!merged.owner_id && row.owner_id) {
      merged.owner_id = row.owner_id;
    }
    rowsByClient.set(clientId, merged);
  }
  return [...rowsByClient.values()];
}

function amount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function recordDate(record) {
  return timestamp(record?.date ?? record?.ts ?? record?.createdAt);
}

function ownerName(ownerId, authData) {
  const user = (authData.users || []).find(item => item.id === ownerId || item.keyId === ownerId);
  const identity = (authData.identities || []).find(item =>
    item.ownerId === ownerId || item.originalKeyId === (user?.keyId || ownerId));
  if (identity?.displayName) return identity.displayName;
  if (user?.name) return user.name;
  return `Account ${String(ownerId).slice(0, 8)}`;
}

function productRemaining(product) {
  if (product.category === "Game Pass" && product.gamePass) {
    return ["gift", "trade"].reduce((total, method) => {
      const available = GAME_PASS.remaining(product, method);
      return total + (Number.isFinite(available) ? available : 0);
    }, 0);
  }
  return Math.max(0, amount(product.stock) - amount(product.sold));
}

function productionRecords(state) {
  return [
    ...(Array.isArray(state.sales) ? state.sales : []),
    ...(Array.isArray(state.farmOrders) ? state.farmOrders : []),
    ...(Array.isArray(state.upgradeOrders) ? state.upgradeOrders : []),
  ];
}

function accountOrders(state) {
  const orders = Array.isArray(state.orders) ? state.orders.slice() : [];
  const orderIds = new Set(orders.map(order => String(order.id || "")));
  const supplemental = [
    ...(Array.isArray(state.farmOrders) ? state.farmOrders.map(record => ({ record, type: "farm", name: record.serviceName })) : []),
    ...(Array.isArray(state.upgradeOrders) ? state.upgradeOrders.map(record => ({ record, type: "upgrade", name: record.productName })) : []),
  ];
  const supplementalByOrderId = new Map();
  supplemental.forEach(({ record, type, name }) => {
    const linkedOrderId = record.orderId ? String(record.orderId) : "";
    if (linkedOrderId && orderIds.has(linkedOrderId)) return;
    const quantity = type === "farm" && record.pricingMode === "hour" ? amount(record.hours) : amount(record.quantity);
    const line = { type, name: name || "", quantity, subtotal: amount(record.money) };
    const existing = linkedOrderId ? supplementalByOrderId.get(linkedOrderId) : null;
    if (existing) {
      existing.total = amount(existing.total) + amount(record.money);
      existing.lines.push(line);
      return;
    }
    const order = {
      id: linkedOrderId || record.id || `${type}-${record.date || ""}`,
      date: record.date,
      customer: record.customer || "",
      total: record.money,
      status: record.status || "completed",
      lines: [line],
    };
    orders.push(order);
    if (linkedOrderId) supplementalByOrderId.set(linkedOrderId, order);
  });
  return orders.sort((left, right) => (recordDate(right) || 0) - (recordDate(left) || 0));
}

function buildAdminOverview({ stateRows, authData, presenceRows, excludedOwnerIds = [], now = Date.now() }) {
  const todayStart = APP_TIME.dayStart(now);
  const todayEnd = APP_TIME.nextDayStart(now);
  const excludedOwners = new Set(excludedOwnerIds);
  const accessedToday = new Set();
  const onlineOwners = new Set();
  const lastSeenByOwner = new Map();
  for (const row of presenceRows || []) {
    if (!row.owner_id || excludedOwners.has(row.owner_id)) continue;
    const lastSeen = timestamp(row.last_seen);
    const authenticatedAt = timestamp(row.last_authenticated_at);
    if (Number.isFinite(lastSeen)) {
      lastSeenByOwner.set(row.owner_id, Math.max(lastSeenByOwner.get(row.owner_id) || 0, lastSeen));
      if (lastSeen >= now - ONLINE_WINDOW_MS) onlineOwners.add(row.owner_id);
    }
    if (Number.isFinite(authenticatedAt) && authenticatedAt >= todayStart && authenticatedAt < todayEnd) {
      accessedToday.add(row.owner_id);
    }
  }

  const statesByOwner = new Map();
  let invalidStateCount = 0;
  for (const row of stateRows || []) {
    if (!row.owner_id) {
      invalidStateCount++;
      continue;
    }
    if (excludedOwners.has(row.owner_id)) continue;
    if (!validateAccountState(row.state).valid) {
      invalidStateCount++;
      continue;
    }
    statesByOwner.set(row.owner_id, row);
  }

  const sellers = new Map();
  const inventory = new Map();
  const lowStock = [];
  const recentOrders = [];
  const customerNames = new Set();
  const dailyRevenue = new Map();
  let totalSalesRecords = 0;
  let salesRecordsToday = 0;
  let totalOrders = 0;
  let ordersToday = 0;
  let totalRevenue = 0;
  let todayRevenue = 0;
  let productRecords = 0;
  let totalRemainingUnits = 0;

  for (const [ownerId, row] of statesByOwner) {
    const state = row.state;
    const name = ownerName(ownerId, authData || {});
    const dailyRecords = productionRecords(state);
    const sales = Array.isArray(state.sales) ? state.sales : [];
    const salesSet = new Set(sales);
    const dailyOrders = accountOrders(state);
    totalSalesRecords += sales.length;
    totalOrders += dailyOrders.length;

    for (const record of dailyRecords) {
      const saleDate = recordDate(record);
      const money = amount(record.money);
      totalRevenue += money;
      if (saleDate >= todayStart && saleDate < todayEnd) {
        todayRevenue += money;
        if (salesSet.has(record)) salesRecordsToday++;
      }
      if (Number.isFinite(saleDate)) {
        const key = APP_TIME.dateKey(saleDate);
        dailyRevenue.set(key, (dailyRevenue.get(key) || 0) + money);
      }
      if (record.productName) {
        const key = String(record.productId || record.productName).toLowerCase();
        const bestSeller = sellers.get(key) || { name: record.productName, quantity: 0, revenue: 0 };
        bestSeller.quantity += amount(record.quantity);
        bestSeller.revenue += money;
        sellers.set(key, bestSeller);
      }
      if (record.customer && saleDate >= todayStart && saleDate < todayEnd) {
        customerNames.add(String(record.customer).trim().toLowerCase());
      }
    }

    for (const order of dailyOrders) {
      const date = recordDate(order);
      if (date >= todayStart && date < todayEnd) {
        ordersToday++;
        if (order.customer) customerNames.add(String(order.customer).trim().toLowerCase());
      }
      recentOrders.push({
        id: String(order.id || ""),
        ownerId,
        owner: name,
        date: Number.isFinite(date) ? date : null,
        customer: typeof order.customer === "string" ? order.customer : "",
        total: amount(order.total),
        status: typeof order.status === "string" ? order.status : "completed",
        lineCount: Array.isArray(order.lines) ? order.lines.length : 0,
      });
    }

    const threshold = Number.isFinite(Number(state.settings?.stockAlert)) ? Number(state.settings.stockAlert) : 5;
    for (const product of state.products) {
      productRecords++;
      const productName = String(product.name || "Unknown item");
      const category = String(product.category || "");
      const remaining = productRemaining(product);
      totalRemainingUnits += remaining;
      const key = `${String(product.catalogId || productName).toLowerCase()}|${category}`;
      const grouped = inventory.get(key) || {
        name: productName, category, trackedAccounts: 0,
        remainingUnits: 0, unlimitedAccounts: 0, lowStockAccounts: 0,
      };
      grouped.trackedAccounts++;
      grouped.remainingUnits += remaining;
      const isGamePass = product.category === "Game Pass" && product.gamePass;
      if (isGamePass) {
        const finiteVariants = ["gift", "trade"].filter(method => product.gamePass[method]?.stock !== null);
        if (finiteVariants.length !== 2) grouped.unlimitedAccounts++;
        const lowMethods = finiteVariants.filter(method => {
          const available = GAME_PASS.remaining(product, method);
          if (available > 0 && available <= threshold) {
            lowStock.push({ ownerId, owner: name, name: productName, category, method, remaining: available });
            return true;
          }
          return false;
        });
        if (lowMethods.length) grouped.lowStockAccounts++;
      } else if (remaining > 0 && remaining <= threshold) {
        grouped.lowStockAccounts++;
        lowStock.push({ ownerId, owner: name, name: productName, category, method: null, remaining });
      }
      inventory.set(key, grouped);
    }
  }

  const registeredUsers = authData?.users || [];
  const lowStockCounts = new Map();
  for (const item of lowStock) lowStockCounts.set(item.ownerId, (lowStockCounts.get(item.ownerId) || 0) + 1);
  const ownerIds = new Set([
    ...statesByOwner.keys(),
    ...registeredUsers.map(user => user.id).filter(ownerId => ownerId && !excludedOwners.has(ownerId)),
  ]);
  const users = [...ownerIds].map(ownerId => {
    const row = statesByOwner.get(ownerId);
    const state = row?.state;
    const records = state ? productionRecords(state) : [];
    return {
      ownerId,
      name: ownerName(ownerId, authData || {}),
      lastSeen: lastSeenByOwner.get(ownerId) || null,
      workspaceUpdatedAt: row?.updated_at || null,
      productCount: state?.products?.length || 0,
      lowStockCount: lowStockCounts.get(ownerId) || 0,
      salesRecordCount: state?.sales?.length || 0,
      revenue: records.reduce((sum, record) => sum + amount(record.money), 0),
      orderCount: state ? accountOrders(state).length : 0,
    };
  }).sort((left, right) => (right.lastSeen || timestamp(right.workspaceUpdatedAt) || 0)
    - (left.lastSeen || timestamp(left.workspaceUpdatedAt) || 0));

  const sevenDays = [];
  const todayKey = APP_TIME.dateKey(now);
  for (let offset = 6; offset >= 0; offset--) {
    const key = APP_TIME.addDays(todayKey, -offset);
    sevenDays.push({ date: key, revenue: dailyRevenue.get(key) || 0 });
  }

  recentOrders.sort((left, right) => (right.date || 0) - (left.date || 0));
  lowStock.sort((left, right) => left.remaining - right.remaining);
  const bestSellers = [...sellers.values()].sort((left, right) => right.quantity - left.quantity).slice(0, 10);
  const groupedInventory = [...inventory.values()].sort((left, right) => left.name.localeCompare(right.name));

  return {
    generatedAt: now,
    summary: {
      totalUsers: ownerIds.size,
      onlineUsers: onlineOwners.size,
      accessedToday: accessedToday.size,
      todayRevenue: Math.round(todayRevenue * 100) / 100,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      salesRecordsToday,
      totalSalesRecords,
      ordersToday,
      totalOrders,
      customersToday: customerNames.size,
      productRecords,
      uniqueProducts: groupedInventory.length,
      totalRemainingUnits,
      lowStockCount: lowStock.length,
      invalidStateCount,
    },
    revenueTrend: sevenDays,
    bestSellers,
    inventory: groupedInventory,
    lowStock,
    recentOrders: recentOrders.slice(0, 100),
    users: users.slice(0, 200),
  };
}

function buildAdminUserDetail({ ownerId, row, authData, presenceRows, now = Date.now() }) {
  if (!row || !validateAccountState(row.state).valid) return null;
  const state = row.state;
  const presence = (presenceRows || []).filter(item => item.owner_id === ownerId)
    .map(item => timestamp(item.last_seen)).filter(Number.isFinite);
  const displayRecord = record => ({
    id: String(record.id || ""),
    productName: String(record.productName || record.serviceName || ""),
    deliveryMethod: record.deliveryMethod || null,
    quantity: amount(record.quantity),
    money: amount(record.money),
    date: Number.isFinite(recordDate(record)) ? recordDate(record) : null,
    source: record.source || null,
    orderId: record.orderId || null,
  });
  const products = state.products.map(product => {
    const result = {
      id: String(product.id || ""),
      name: String(product.name || ""),
      category: String(product.category || ""),
      source: product.source || null,
      tradeability: product.tradeability || "tradable",
      stock: amount(product.stock),
      sold: amount(product.sold),
      remaining: productRemaining(product),
      restockHistory: (Array.isArray(product.restockHistory) ? product.restockHistory : []).filter(item => item && typeof item === "object").slice(-20).map(item => ({
        date: timestamp(item.date), amount: amount(item.amount), from: amount(item.from), to: amount(item.to),
      })),
    };
    if (product.category === "Game Pass" && product.gamePass) {
      result.gamePass = Object.fromEntries(["gift", "trade"].map(method => {
        const variant = product.gamePass[method];
        const remaining = GAME_PASS.remaining(product, method);
        return [method, {
          price: amount(variant.price),
          stock: variant.stock,
          sold: amount(variant.sold),
          remaining: Number.isFinite(remaining) ? remaining : null,
        }];
      }));
    }
    return result;
  });
  const orders = accountOrders(state).slice(0, 100).map(order => ({
    id: String(order.id || ""),
    date: Number.isFinite(recordDate(order)) ? recordDate(order) : null,
    customer: typeof order.customer === "string" ? order.customer : "",
    total: amount(order.total),
    status: order.status || "completed",
    lines: (Array.isArray(order.lines) ? order.lines : []).filter(line => line && typeof line === "object").map(line => ({
      type: line.type || "",
      name: String(line.name || ""),
      deliveryMethod: line.deliveryMethod || null,
      quantity: amount(line.quantity),
      unitPrice: amount(line.unitPrice),
      subtotal: amount(line.subtotal),
    })),
  }));
  const activity = (Array.isArray(state.activityLog) ? state.activityLog : []).slice(0, 100).map(item => ({
    id: String(item.id || ""),
    type: String(item.type || ""),
    action: String(item.action || ""),
    text: String(item.text || ""),
    sub: String(item.sub || ""),
    ts: Number.isFinite(recordDate(item)) ? recordDate(item) : null,
  }));
  return {
    user: {
      ownerId,
      name: ownerName(ownerId, authData || {}),
      lastSeen: presence.length ? Math.max(...presence) : null,
      online: presence.some(value => value >= now - ONLINE_WINDOW_MS),
      workspaceUpdatedAt: row.updated_at || null,
    },
    products,
    sales: (Array.isArray(state.sales) ? state.sales : []).slice(0, 100).map(displayRecord),
    farmOrders: (Array.isArray(state.farmOrders) ? state.farmOrders : []).slice(0, 100).map(displayRecord),
    upgradeOrders: (Array.isArray(state.upgradeOrders) ? state.upgradeOrders : []).slice(0, 100).map(displayRecord),
    orders,
    activity,
    salesRecordCount: Array.isArray(state.sales) ? state.sales.length : 0,
  };
}

module.exports = { buildAdminOverview, buildAdminUserDetail, mergePresenceRows, ONLINE_WINDOW_MS };
