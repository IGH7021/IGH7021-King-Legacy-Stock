const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT) || 3000;
const ROOT = path.resolve(__dirname, "..");
const DATA_FILE = path.join(__dirname, "data.json");
const KEYS_DIR = path.join(__dirname, "keys");
const ONLINE_WINDOW = 90000;
const presence = new Map();
const sessions = new Map();
const MIME_TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml" };

function readData() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); }
  catch (error) { return { reviews: [], totalUsers: 0, userIds: [] }; }
}
function writeData(data) { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); }
function writeKeyFile(key) { fs.mkdirSync(KEYS_DIR, { recursive: true }); fs.writeFileSync(path.join(KEYS_DIR, `${key.id}.json`), JSON.stringify({ id: key.id, value: key.value, admin: key.admin, permanent: key.permanent, expiresAt: key.expiresAt || null, revoked: key.revoked }, null, 2)); }
function json(response, status, body) { response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" }); response.end(JSON.stringify(body)); }
function requestBody(request) {
  return new Promise((resolve, reject) => { let raw = ""; request.on("data", chunk => { raw += chunk; if (raw.length > 10000) reject(new Error("payload too large")); }); request.on("end", () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch (error) { reject(error); } }); request.on("error", reject); });
}
function communityStats() {
  const now = Date.now();
  for (const [id, lastSeen] of presence) if (now - lastSeen > ONLINE_WINDOW) presence.delete(id);
  return { onlineUsers: presence.size, totalUsers: readData().totalUsers };
}
function authData() { const data = readData(); data.keys = Array.isArray(data.keys) ? data.keys : []; data.users = Array.isArray(data.users) ? data.users : []; let changed = false; data.keys.forEach(key => { if (!key.permanent && !key.expiresAt && key.seedExpiresHours) { key.expiresAt = Date.now() + key.seedExpiresHours * 3600000; delete key.seedExpiresHours; changed = true; } writeKeyFile(key); }); const expired = new Set(data.keys.filter(key => !key.permanent && key.expiresAt && key.expiresAt + 259200000 < Date.now()).map(key => key.id)); const keptUsers = data.users.filter(user => !expired.has(user.keyId)); if (keptUsers.length !== data.users.length) { data.users = keptUsers; changed = true; } if (changed) writeData(data); return data; }
function makeKey(data, permanent, admin = false) {
  const sequence = String(data.keys.length + 1).padStart(6, "0");
  const date = new Date().toISOString().slice(2, 10).replace(/-/g, "").toUpperCase();
  const time = permanent ? "" : new Date().toTimeString().slice(0, 5).replace(":", "");
  const suffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `IGH${sequence}${date}${time}${String(data.keys.length + 1).padStart(2, "0")}${permanent ? "PERM" : "TEMP"}${suffix}7021${admin ? "ADMIN" : "USER"}`;
}
function keyRecord(data, value) { return data.keys.find(key => key.value === value); }
function validKey(key) { return key && !key.revoked && (key.permanent || key.expiresAt > Date.now()); }
function passwordHash(password, salt = crypto.randomBytes(16).toString("hex")) { return { salt, hash: crypto.pbkdf2Sync(password, salt, 120000, 64, "sha512").toString("hex") }; }
function passwordMatches(password, user) { const candidate = passwordHash(password, user.salt).hash; return crypto.timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(user.passwordHash, "hex")); }
function authUser(request) { const token = request.headers.authorization?.replace("Bearer ", ""); return token ? sessions.get(token) : null; }

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  if (request.method === "OPTIONS") { response.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type" }); return response.end(); }
  if (url.pathname === "/api/auth/key" && request.method === "POST") {
    try { const body = await requestBody(request); const value = String(body.key || "").trim(); if (process.env.ADMIN_BOOTSTRAP_KEY && value === process.env.ADMIN_BOOTSTRAP_KEY) return json(response, 200, { valid: true, admin: true, registered: true, permanent: true, expiresAt: null }); const data = authData(); const key = keyRecord(data, value); if (!validKey(key)) return json(response, 401, { error: "KEY_INVALID_OR_EXPIRED" }); return json(response, 200, { valid: true, admin: !!key.admin, registered: key.admin || data.users.some(user => user.keyId === key.id), permanent: key.permanent, expiresAt: key.expiresAt || null }); }
    catch (error) { return json(response, 400, { error: "Invalid JSON" }); }
  }
  if (url.pathname === "/api/auth/signup" && request.method === "POST") {
    try { const body = await requestBody(request); const data = authData(); const key = keyRecord(data, String(body.key || "").trim()); const name = String(body.name || ""); const nickname = String(body.nickname || ""); const email = String(body.email || ""); const password = String(body.password || "");
      if (!validKey(key) || key.admin || data.users.some(user => user.keyId === key.id)) return json(response, 400, { error: "KEY_INVALID_OR_USED" });
      if (name.trim().length < 1 || name.length > 80 || !/^\S+@\S+\.\S+$/.test(email) || !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{9,}$/.test(password)) return json(response, 400, { error: "INVALID_FIELDS" });
      const credential = passwordHash(password); data.users.push({ id: crypto.randomUUID(), name: name.trim(), email, keyId: key.id, passwordHash: credential.hash, salt: credential.salt, createdAt: Date.now() }); writeData(data); return json(response, 201, { registered: true, expiresAt: key.expiresAt || null, permanent: key.permanent });
    } catch (error) { return json(response, 400, { error: "Invalid JSON" }); }
  }
  if (url.pathname === "/api/auth/login" && request.method === "POST") {
    try { const body = await requestBody(request); const value = String(body.key || "").trim(); if (process.env.ADMIN_BOOTSTRAP_KEY && value === process.env.ADMIN_BOOTSTRAP_KEY) { const token = crypto.randomBytes(32).toString("hex"); sessions.set(token, { admin: true }); return json(response, 200, { token, admin: true, permanent: true, expiresAt: null }); } const data = authData(); const key = keyRecord(data, value); const user = data.users.find(item => item.keyId === key?.id); if (!validKey(key)) return json(response, 401, { error: "ACCOUNT_NOT_FOUND_OR_EXPIRED" }); const token = crypto.randomBytes(32).toString("hex"); sessions.set(token, { userId: user?.id, keyId: key.id, admin: !!key.admin }); return json(response, 200, { token, admin: !!key.admin, user: user ? { id: user.id, nickname: user.nickname } : null, expiresAt: key.expiresAt || null }); }
    catch (error) { return json(response, 400, { error: "Invalid JSON" }); }
  }
  if (url.pathname === "/api/admin/keys" && request.method === "POST") {
    const session = authUser(request); if (!session?.admin) return json(response, 403, { error: "ADMIN_ONLY" });
    try { const body = await requestBody(request); const data = authData(); const isAdmin = Boolean(body.admin); const permanent = isAdmin || Boolean(body.permanent); const key = { id: crypto.randomUUID(), value: makeKey(data, permanent, isAdmin), permanent, admin: isAdmin, createdAt: Date.now(), expiresAt: permanent ? null : Date.now() + Math.max(1, Number(body.hours) || 24) * 3600000, revoked: false }; data.keys.push(key); writeData(data); writeKeyFile(key); return json(response, 201, key); } catch (error) { return json(response, 400, { error: "Invalid JSON" }); }
  }
  if (url.pathname === "/api/admin/keys" && request.method === "GET") {
    const session = authUser(request); if (!session?.admin) return json(response, 403, { error: "ADMIN_ONLY" });
    const data = authData();
    return json(response, 200, data.keys.map(key => ({ ...key, user: data.users.find(item => item.keyId === key.id)?.name || null, remainingMs: key.permanent ? null : Math.max(0, key.expiresAt - Date.now()) })));
  }
  if (url.pathname === "/api/reviews" && request.method === "GET") return json(response, 200, readData().reviews);
  if (url.pathname === "/api/reviews" && request.method === "POST") {
    try {
      const body = await requestBody(request);
      const rating = Number(body.rating);
      const text = String(body.text || "").trim();
      if (!Number.isInteger(rating) || rating < 1 || rating > 5 || !text || text.length > 240) return json(response, 400, { error: "Invalid review" });
      const data = readData();
      data.reviews.push({ id: crypto.randomUUID(), rating, text, date: Date.now() });
      writeData(data);
      return json(response, 201, data.reviews);
    } catch (error) { return json(response, 400, { error: "Invalid JSON" }); }
  }
  if (url.pathname === "/api/presence" && request.method === "POST") {
    const clientId = request.headers["x-client-id"] || crypto.randomUUID();
    presence.set(clientId, Date.now());
    const data = readData();
    data.userIds = Array.isArray(data.userIds) ? data.userIds : [];
    if (!data.userIds.includes(clientId)) data.userIds.push(clientId);
    data.totalUsers = data.userIds.length;
    writeData(data);
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*", "X-Client-Id": clientId });
    return response.end(JSON.stringify(communityStats()));
  }
  if (url.pathname === "/api/community" && request.method === "GET") return json(response, 200, communityStats());
  if (request.method !== "GET" && request.method !== "HEAD") return json(response, 405, { error: "Method not allowed" });
  const clientRoutes = new Set(["/dashboard", "/products", "/sales", "/reports", "/settings", "/updates", "/admin"]);
  const requested = decodeURIComponent(url.pathname === "/" || clientRoutes.has(url.pathname.toLowerCase()) ? "/index.html" : url.pathname);
  const filePath = path.resolve(ROOT, `.${requested}`);
  if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    const notFound = path.join(ROOT, "404.html");
    response.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    return fs.createReadStream(notFound).pipe(response);
  }
  response.writeHead(200, { "Content-Type": MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream" });
  if (request.method === "HEAD") return response.end();
  fs.createReadStream(filePath).pipe(response);
});

server.listen(PORT, () => console.log(`King Legacy Stock server: http://localhost:${PORT}`));
