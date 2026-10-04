const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const UPDATE_HISTORY = require("./update-history.json");

const ENV_FILES = [path.resolve(__dirname, "../.env"), process.env.RENDER_ENV_FILE].filter(Boolean);
for (const envFile of ENV_FILES) {
  if (!fs.existsSync(envFile)) continue;
  fs.readFileSync(envFile, "utf8").split(/\r?\n/).forEach(line => {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !Object.hasOwn(process.env, match[1])) process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  });
}

const PORT = Number(process.env.PORT) || 3000;
const ROOT = path.resolve(__dirname, "..");
const DATA_FILE = path.join(__dirname, "data.json");
const KEYS_DIR = path.join(__dirname, "keys");
const KEY_ARCHIVE_DIR = path.join(__dirname, "key-archive");
const KEY_EXPIRY_GRACE_MS = 7 * 24 * 60 * 60 * 1000;
const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, "");
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ENABLED = process.env.SUPABASE_DISABLED !== "true" && Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
const APP_ORIGIN = (process.env.APP_ORIGIN || process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`).replace(/\/+$/, "");
const ONLINE_WINDOW = 90000;
const presence = new Map();
const sessions = new Map();
const revokedSessions = new Set();
const MIME_TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml" };
const SECURITY_HEADERS = { "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "strict-origin-when-cross-origin", "Permissions-Policy": "camera=(), microphone=(), geolocation=()" };

function readData() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); }
  catch (error) { return { reviews: [], totalUsers: 0, userIds: [] }; }
}
function writeData(data) { const { keys, ...nonKeyData } = data; fs.writeFileSync(DATA_FILE, JSON.stringify(nonKeyData, null, 2)); }
function writeKeyFile(key) {
  fs.mkdirSync(KEYS_DIR, { recursive: true });
  const existingFile = fs.readdirSync(KEYS_DIR).find(file => {
    try { return JSON.parse(fs.readFileSync(path.join(KEYS_DIR, file), "utf8")).id === key.id; }
    catch (error) { return false; }
  });
  const filePath = path.join(KEYS_DIR, existingFile || `${key.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify({ id: key.id, value: key.value, admin: key.admin, permanent: key.permanent, expiresAt: key.expiresAt || null, durationMs: key.durationMs || null, activatedAt: key.activatedAt || null, revoked: key.revoked }, null, 2));
}
function readKeyFiles() {
  fs.mkdirSync(KEYS_DIR, { recursive: true });
  return fs.readdirSync(KEYS_DIR).filter(file => file.toLowerCase().endsWith(".json")).map(file => {
    try { return JSON.parse(fs.readFileSync(path.join(KEYS_DIR, file), "utf8")); }
    catch (error) { return null; }
  }).filter(key => key && key.id && key.value);
}
function readArchivedKeyFiles() {
  if (!fs.existsSync(KEY_ARCHIVE_DIR)) return [];
  return fs.readdirSync(KEY_ARCHIVE_DIR).filter(file => file.toLowerCase().endsWith(".json")).map(file => {
    try { return { ...JSON.parse(fs.readFileSync(path.join(KEY_ARCHIVE_DIR, file), "utf8")), archived: true }; }
    catch (error) { return null; }
  }).filter(key => key && key.id && key.value);
}
function archiveLocalExpiredKeys(now = Date.now()) {
  fs.mkdirSync(KEYS_DIR, { recursive: true });
  fs.mkdirSync(KEY_ARCHIVE_DIR, { recursive: true });
  let count = 0;
  fs.readdirSync(KEYS_DIR).filter(file => file.toLowerCase().endsWith(".json")).forEach(file => {
    const filePath = path.join(KEYS_DIR, file);
    try {
      const key = JSON.parse(fs.readFileSync(filePath, "utf8"));
      if (key.permanent || !key.expiresAt || now - Number(key.expiresAt) < KEY_EXPIRY_GRACE_MS) return;
      const archivePath = path.join(KEY_ARCHIVE_DIR, `${path.basename(String(key.id))}.json`);
      fs.writeFileSync(archivePath, JSON.stringify({ ...key, archived: true, archivedAt: now, archiveReason: "expired" }, null, 2));
      fs.unlinkSync(filePath);
      count++;
    } catch (error) { console.error("Could not archive a local key:", error.message); }
  });
  return count;
}
function json(response, status, body, headers = {}) { response.writeHead(status, { ...SECURITY_HEADERS, "Content-Type": "application/json; charset=utf-8", ...headers }); response.end(JSON.stringify(body)); }
function requestBody(request, maxBytes = 10000) {
  return new Promise((resolve, reject) => { let raw = ""; request.on("data", chunk => { raw += chunk; if (raw.length > maxBytes) reject(new Error("payload too large")); }); request.on("end", () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch (error) { reject(error); } }); request.on("error", reject); });
}
function bangkokDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function stateEtag(state, updatedAt) {
  return `"${crypto.createHash("sha256").update(`${updatedAt}:${stableJson(state)}`).digest("hex")}"`;
}
function communityStats() {
  const now = Date.now();
  for (const [id, lastSeen] of presence) if (now - lastSeen > ONLINE_WINDOW) presence.delete(id);
  return { onlineUsers: presence.size, totalUsers: readData().totalUsers };
}
function authData() { const data = readData(); data.keys = readKeyFiles(); data.users = Array.isArray(data.users) ? data.users : []; data.identities = Array.isArray(data.identities) ? data.identities : []; const expired = new Set(data.keys.filter(key => !key.permanent && key.expiresAt && key.expiresAt + KEY_EXPIRY_GRACE_MS < Date.now()).map(key => key.id)); const keptUsers = data.users.filter(user => !expired.has(user.keyId)); if (keptUsers.length !== data.users.length) { data.users = keptUsers; writeData(data); } return data; }
async function supabaseRequest(table, method = "GET", query = "", body = null, prefer = null) {
  if (!SUPABASE_ENABLED) throw new Error("Supabase is not configured");
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query ? `?${query}` : ""}`, {
    method,
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json", Prefer: prefer || (method === "POST" ? "resolution=merge-duplicates,return=representation" : "return=representation") },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase ${table} request failed (${response.status}): ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : [];
}
async function getAuthData() {
  if (!SUPABASE_ENABLED) return authData();
  const [keys, users, identities] = await Promise.all([
    supabaseRequest("access_keys", "GET", "select=*&order=created_at.desc"),
    supabaseRequest("app_users", "GET", "select=*&order=created_at.desc"),
    supabaseRequest("user_identities", "GET", "select=*&order=linked_at.asc"),
  ]);
  return { keys: keys.map(key => ({ ...key, expiresAt: key.expires_at, durationMs: key.duration_ms, activatedAt: key.activated_at, createdAt: key.created_at })), users: users.map(user => ({ ...user, keyId: user.key_id, createdAt: user.created_at })), identities: identities.map(identity => ({ ...identity, keyId: identity.key_id, originalKeyId: identity.original_key_id, ownerId: identity.owner_id, providerUserId: identity.provider_user_id, displayName: identity.display_name, avatarUrl: identity.avatar_url, linkedAt: identity.linked_at })) };
}
async function getArchivedKeys() {
  if (!SUPABASE_ENABLED) return readArchivedKeyFiles();
  const keys = await supabaseRequest("key_archive", "GET", "select=*&order=archived_at.desc");
  return keys.map(key => ({ ...key, archived: true, expiresAt: key.expires_at, durationMs: key.duration_ms, activatedAt: key.activated_at, createdAt: key.created_at, archivedAt: key.archived_at, archiveReason: key.archive_reason }));
}
async function archiveExpiredKeys(now = Date.now()) {
  if (!SUPABASE_ENABLED) return archiveLocalExpiredKeys(now);
  return supabaseRequest("rpc/archive_expired_access_keys", "POST", "", { p_expired_before: now - KEY_EXPIRY_GRACE_MS, p_archived_at: now });
}
async function saveKey(key) {
  if (!SUPABASE_ENABLED) return writeKeyFile(key);
  await supabaseRequest("access_keys", "POST", "on_conflict=id", { id: key.id, value: key.value, admin: key.admin, permanent: key.permanent, expires_at: key.expiresAt, duration_ms: key.durationMs, activated_at: key.activatedAt, created_at: key.createdAt, revoked: key.revoked });
}
async function updateKey(key, previousExpiresAt) {
  if (!SUPABASE_ENABLED) return writeKeyFile(key);
  const expirationFilter = previousExpiresAt === null || previousExpiresAt === undefined ? "expires_at=is.null" : `expires_at=eq.${encodeURIComponent(previousExpiresAt)}`;
  const rows = await supabaseRequest("access_keys", "PATCH", `id=eq.${encodeURIComponent(key.id)}&${expirationFilter}`, { expires_at: key.expiresAt, duration_ms: key.durationMs, activated_at: key.activatedAt });
  if (!rows.length) throw new Error("KEY_NOT_AVAILABLE");
  Object.assign(key, { expiresAt: rows[0].expires_at, durationMs: rows[0].duration_ms, activatedAt: rows[0].activated_at });
  return key;
}
async function saveUser(user) {
  if (!SUPABASE_ENABLED) {
    const data = readData(); data.users = Array.isArray(data.users) ? data.users : []; data.users.push(user); writeData(data); return;
  }
  await supabaseRequest("app_users", "POST", "on_conflict=id", { id: user.id, name: user.name, email: user.email, key_id: user.keyId, password_hash: user.passwordHash, salt: user.salt, created_at: user.createdAt });
}
async function saveIdentity(identity) {
  const data = SUPABASE_ENABLED ? await getAuthData() : authData();
  const providerIdentity = data.identities.find(item => item.provider === identity.provider && item.providerUserId === identity.providerUserId);
  if (providerIdentity && providerIdentity.originalKeyId !== identity.originalKeyId) throw new Error("IDENTITY_ALREADY_LINKED");
  const keyIdentity = data.identities.find(item => item.provider === identity.provider && item.originalKeyId === identity.originalKeyId);
  if (keyIdentity && keyIdentity.providerUserId !== identity.providerUserId) throw new Error("KEY_PROVIDER_ALREADY_LINKED");
  if (!SUPABASE_ENABLED) {
    data.identities = data.identities.filter(item => !(item.provider === identity.provider && item.originalKeyId === identity.originalKeyId));
    data.identities.push(identity); writeData(data); return identity;
  }
  const payload = { id: providerIdentity?.id || crypto.randomUUID(), provider: identity.provider, provider_user_id: identity.providerUserId, key_id: identity.keyId, original_key_id: identity.originalKeyId, owner_id: identity.ownerId, display_name: identity.displayName, email: identity.email || null, avatar_url: identity.avatarUrl || null, linked_at: providerIdentity?.linkedAt || Date.now() };
  if (providerIdentity) {
    const rows = await supabaseRequest("user_identities", "PATCH", `id=eq.${encodeURIComponent(providerIdentity.id)}`, payload);
    if (!rows.length) throw new Error("IDENTITY_UPDATE_FAILED");
    return identity;
  }
  await supabaseRequest("user_identities", "POST", "on_conflict=id", payload);
  return identity;
}
function sessionFromRequest(request) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "") || request.headers.cookie?.split(";").map(value => value.trim()).find(value => value.startsWith("igh_session="))?.slice("igh_session=".length);
  if (!token || revokedSessions.has(token)) return null;
  if (sessions.has(token)) return sessions.get(token);
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !process.env.GITHUB_OAUTH_STATE_SECRET) return null;
  const expected = crypto.createHmac("sha256", process.env.GITHUB_OAUTH_STATE_SECRET).update(payload).digest();
  const received = Buffer.from(signature, "hex");
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) return null;
  try { const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); return session.admin && session.exp > Date.now() ? session : null; }
  catch (error) { return null; }
}
function createSignedAdminSession(profile) {
  const session = { admin: true, ownerId: `github:${profile.id}`, githubLogin: profile.login, exp: Date.now() + 7 * 86400000 };
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  const signature = crypto.createHmac("sha256", process.env.GITHUB_OAUTH_STATE_SECRET).update(payload).digest("hex");
  return `${payload}.${signature}`;
}
function providerSettings(provider) {
  return provider === "google"
    ? { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET, redirectUri: `${APP_ORIGIN}/api/auth/google/callback` }
    : { clientId: process.env.DISCORD_CLIENT_ID, clientSecret: process.env.DISCORD_CLIENT_SECRET, redirectUri: `${APP_ORIGIN}/api/auth/discord/callback` };
}
function providerConfigured(provider) {
  const settings = providerSettings(provider);
  return Boolean(settings.clientId && settings.clientSecret && process.env.GITHUB_OAUTH_STATE_SECRET?.length >= 32);
}
function identityOwnerName(identities, keyId) {
  return identities.filter(identity => identity.originalKeyId === keyId)
    .map(identity => `${identity.provider}: ${identity.displayName}`)
    .join(" · ");
}
function createProviderState(provider, mode, session = null) {
  const payload = Buffer.from(JSON.stringify({ provider, mode, keyId: session?.keyId || null, ownerId: session?.ownerId || null, issuedAt: Date.now(), nonce: crypto.randomBytes(18).toString("hex") })).toString("base64url");
  const signature = crypto.createHmac("sha256", process.env.GITHUB_OAUTH_STATE_SECRET).update(payload).digest("hex");
  return `${payload}.${signature}`;
}
function readProviderState(value, expectedProvider) {
  const [payload, signature] = String(value || "").split(".");
  if (!payload || !signature) return null;
  const expected = crypto.createHmac("sha256", process.env.GITHUB_OAUTH_STATE_SECRET || "").update(payload).digest();
  const received = Buffer.from(signature, "hex");
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) return null;
  try {
    const state = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return state.provider === expectedProvider && Date.now() - state.issuedAt <= 600000 && Date.now() >= state.issuedAt ? state : null;
  } catch (error) { return null; }
}
async function sessionHasActiveKey(session) {
  if (session?.admin) return true;
  if (!session?.keyId) return false;
  const data = await getAuthData();
  return validKey(data.keys.find(key => key.id === session.keyId));
}
async function verifiedIdentityForKey(keyId) {
  const data = await getAuthData();
  return data.identities.find(identity => identity.originalKeyId === keyId && identity.keyId === keyId) || null;
}
function profileAvatar(value) {
  if (value === "") return "";
  const match = typeof value === "string" && value.match(/^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match || value.length > 180000) throw new Error("INVALID_PROFILE_IMAGE");
  const bytes = Buffer.from(match[1], "base64");
  if (bytes.length < 33 || bytes.length > 135000 || bytes.toString("base64") !== match[1]) throw new Error("INVALID_PROFILE_IMAGE");
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!bytes.subarray(0, 8).equals(signature) || bytes.toString("ascii", 12, 16) !== "IHDR") throw new Error("INVALID_PROFILE_IMAGE");
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (!width || !height || width > 150 || height > 150) throw new Error("INVALID_PROFILE_IMAGE");
  return value;
}
function createOAuthState() {
  const timestamp = String(Date.now()); const nonce = crypto.randomBytes(24).toString("hex");
  const message = `${timestamp}.${nonce}`;
  const signature = crypto.createHmac("sha256", process.env.GITHUB_OAUTH_STATE_SECRET).update(message).digest("hex");
  return `${message}.${signature}`;
}
function validOAuthState(value) {
  const [timestamp, nonce, signature] = String(value || "").split(".");
  if (!timestamp || !nonce || !signature || Date.now() - Number(timestamp) > 600000 || Number(timestamp) > Date.now()) return false;
  const expected = crypto.createHmac("sha256", process.env.GITHUB_OAUTH_STATE_SECRET).update(`${timestamp}.${nonce}`).digest();
  const received = Buffer.from(signature, "hex");
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}
function makeKey(data, permanent, admin = false) {
  const sequence = String(data.keys.length + 1).padStart(6, "0");
  const date = new Date().toISOString().slice(2, 10).replace(/-/g, "").toUpperCase();
  const time = permanent ? "" : new Date().toTimeString().slice(0, 5).replace(":", "");
  const suffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `IGH${sequence}${date}${time}${String(data.keys.length + 1).padStart(2, "0")}${permanent ? "PERM" : "TEMP"}${suffix}7021${admin ? "ADMIN" : "USER"}`;
}
function keyRecord(data, value) { return data.keys.find(key => key.value === value); }
function validKey(key) {
  if (!key || key.revoked) return false;
  if (key.permanent) return true;
  if (key.expiresAt !== null && key.expiresAt !== undefined) return Number(key.expiresAt) > Date.now();
  return Number(key.durationMs) > 0;
}
async function activateKey(key) {
  if (key.permanent || key.expiresAt || !Number.isFinite(Number(key.durationMs)) || Number(key.durationMs) <= 0) return key;
  const activatedAt = Date.now();
  const expiresAt = activatedAt + Number(key.durationMs);
  if (SUPABASE_ENABLED) {
    const rows = await supabaseRequest("access_keys", "PATCH", `id=eq.${encodeURIComponent(key.id)}&activated_at=is.null&expires_at=is.null`, { activated_at: activatedAt, expires_at: expiresAt });
    if (rows.length) Object.assign(key, { activatedAt: rows[0].activated_at, expiresAt: rows[0].expires_at });
    else {
      const current = (await getAuthData()).keys.find(item => item.id === key.id);
      if (!current) throw new Error("Key disappeared during activation");
      Object.assign(key, current);
    }
  } else {
    key.activatedAt = activatedAt;
    key.expiresAt = expiresAt;
    writeKeyFile(key);
  }
  return key;
}
async function adjustKeyTime(key, deltaHours, now = Date.now()) {
  if (key.permanent) throw new Error("KEY_IS_PERMANENT");
  const deltaMs = deltaHours * 60 * 60 * 1000;
  const previousExpiresAt = key.expiresAt ?? null;
  if (previousExpiresAt === null && !key.activatedAt) {
    const nextDuration = Number(key.durationMs || 0) + deltaMs;
    if (nextDuration < 60 * 60 * 1000) throw new Error("MINIMUM_KEY_DURATION");
    key.durationMs = nextDuration;
  } else if (previousExpiresAt !== null && previousExpiresAt <= now && deltaHours > 0) {
    key.activatedAt = key.activatedAt || now;
    key.durationMs = Number(key.durationMs || 0) + deltaMs;
    key.expiresAt = now + deltaMs;
  } else {
    key.durationMs = Math.max(0, Number(key.durationMs || 0) + deltaMs);
    key.expiresAt = Number(previousExpiresAt) + deltaMs;
  }
  await updateKey(key, previousExpiresAt);
  return key;
}
function passwordHash(password, salt = crypto.randomBytes(16).toString("hex")) { return { salt, hash: crypto.pbkdf2Sync(password, salt, 120000, 64, "sha512").toString("hex") }; }
function passwordMatches(password, user) { const candidate = passwordHash(password, user.salt).hash; return crypto.timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(user.passwordHash, "hex")); }
const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  if (request.method === "OPTIONS") { response.writeHead(204, { ...SECURITY_HEADERS, Allow: "GET,POST,PUT,DELETE,OPTIONS" }); return response.end(); }
  if (url.pathname === "/api/config" && request.method === "GET") return json(response, 200, { githubConfigured: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET && process.env.GITHUB_ADMIN_USERNAME && process.env.GITHUB_OAUTH_STATE_SECRET?.length >= 32), googleConfigured: providerConfigured("google"), discordConfigured: providerConfigured("discord"), googleRedirectUri: providerConfigured("google") ? providerSettings("google").redirectUri : null, discordRedirectUri: providerConfigured("discord") ? providerSettings("discord").redirectUri : null, supabaseConfigured: SUPABASE_ENABLED });
  if (url.pathname === "/api/auth/logout" && request.method === "POST") {
    const token = request.headers.cookie?.match(/(?:^|;\s*)igh_session=([^;]+)/)?.[1]; if (token) { sessions.delete(token); revokedSessions.add(token); }
    response.writeHead(204, { "Set-Cookie": "igh_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0" }); return response.end();
  }
  const identityVerifyRoute = url.pathname.match(/^\/api\/auth\/(google|discord)\/verify$/);
  if (identityVerifyRoute && request.method === "POST") {
    const provider = identityVerifyRoute[1];
    if (!providerConfigured(provider) || !process.env.GITHUB_OAUTH_STATE_SECRET || process.env.GITHUB_OAUTH_STATE_SECRET.length < 32) return json(response, 503, { error: "IDENTITY_PROVIDER_NOT_CONFIGURED" });
    const session = sessionFromRequest(request);
    if (!session?.keyId || session.admin || !(await sessionHasActiveKey(session))) return json(response, 401, { error: "ACTIVE_KEY_LOGIN_REQUIRED" });
    const settings = providerSettings(provider);
    const destination = provider === "google" ? new URL("https://accounts.google.com/o/oauth2/v2/auth") : new URL("https://discord.com/oauth2/authorize");
    destination.searchParams.set("client_id", settings.clientId);
    destination.searchParams.set("redirect_uri", settings.redirectUri);
    destination.searchParams.set("response_type", "code");
    destination.searchParams.set("scope", provider === "google" ? "openid email profile" : "identify email");
    destination.searchParams.set("state", createProviderState(provider, "verify", session));
    return json(response, 200, { url: destination.toString() });
  }
  const identityCallbackRoute = url.pathname.match(/^\/api\/auth\/(google|discord)\/callback$/);
  if (identityCallbackRoute && request.method === "GET") {
    const provider = identityCallbackRoute[1];
    const state = readProviderState(url.searchParams.get("state"), provider);
    if (!state || state.mode !== "verify" || url.searchParams.has("error")) { response.writeHead(302, { Location: `${APP_ORIGIN}/Settings?identity=failed` }); return response.end(); }
    try {
      const settings = providerSettings(provider);
      const tokenResponse = await fetch(provider === "google" ? "https://oauth2.googleapis.com/token" : "https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: new URLSearchParams({ client_id: settings.clientId, client_secret: settings.clientSecret, code: String(url.searchParams.get("code") || ""), grant_type: "authorization_code", redirect_uri: settings.redirectUri }),
      });
      const tokenBody = await tokenResponse.json();
      if (!tokenResponse.ok || !tokenBody.access_token) throw new Error(`${provider} token exchange failed`);
      const profileResponse = await fetch(provider === "google" ? "https://openidconnect.googleapis.com/v1/userinfo" : "https://discord.com/api/users/@me", { headers: { Authorization: `Bearer ${tokenBody.access_token}`, Accept: "application/json" } });
      const profile = await profileResponse.json();
      if (!profileResponse.ok) throw new Error(`${provider} profile request failed`);
      const providerUserId = String(provider === "google" ? profile.sub || "" : profile.id || "");
      const avatarUrl = provider === "google"
        ? (typeof profile.picture === "string" && /^https:\/\/lh3\.googleusercontent\.com\//.test(profile.picture) ? profile.picture : "")
        : (typeof profile.avatar === "string" && /^[A-Za-z0-9_]+$/.test(profile.avatar) && /^\d+$/.test(providerUserId) ? `https://cdn.discordapp.com/avatars/${providerUserId}/${profile.avatar}.png?size=150` : "");
      const identity = { provider, providerUserId, displayName: String(provider === "google" ? profile.name || profile.email || "Google user" : profile.global_name || profile.username || "Discord user").slice(0, 120), email: profile.email ? String(profile.email).slice(0, 254) : null, avatarUrl };
      if (!identity.providerUserId) throw new Error("Provider profile has no account id");
      const data = await getAuthData();
      const key = data.keys.find(item => item.id === state.keyId);
      if (!key || !validKey(key) || !state.ownerId) { response.writeHead(302, { Location: `${APP_ORIGIN}/Settings?identity=key-expired` }); return response.end(); }
      await saveIdentity({ ...identity, id: crypto.randomUUID(), keyId: key.id, originalKeyId: key.id, ownerId: state.ownerId, linkedAt: Date.now() });
      response.writeHead(302, { Location: `${APP_ORIGIN}/Settings?identity=verified` }); return response.end();
    } catch (error) {
      console.error(`${provider} identity verification failed:`, error.message);
      const code = error.message === "IDENTITY_ALREADY_LINKED" || error.message === "KEY_PROVIDER_ALREADY_LINKED" ? "conflict" : "failed";
      response.writeHead(302, { Location: `${APP_ORIGIN}/Settings?identity=${code}` }); return response.end();
    }
  }
  if (url.pathname === "/api/auth/identities" && request.method === "GET") {
    const session = sessionFromRequest(request); if (!session?.keyId || session.admin || !(await sessionHasActiveKey(session))) return json(response, 401, { error: "ACTIVE_KEY_LOGIN_REQUIRED" });
    try { const data = await getAuthData(); return json(response, 200, data.identities.filter(identity => identity.originalKeyId === session.keyId).map(identity => ({ provider: identity.provider, displayName: identity.displayName, email: identity.email, linkedAt: identity.linkedAt }))); }
    catch (error) { console.error(error.message); return json(response, 503, { error: "IDENTITY_STORAGE_UNAVAILABLE" }); }
  }
  const identityUnlinkRoute = url.pathname.match(/^\/api\/auth\/(google|discord)\/verify$/);
  if (identityUnlinkRoute && request.method === "DELETE") {
    const session = sessionFromRequest(request); if (!session?.keyId || session.admin || !(await sessionHasActiveKey(session))) return json(response, 401, { error: "ACTIVE_KEY_LOGIN_REQUIRED" });
    try {
      if (SUPABASE_ENABLED) await supabaseRequest("user_identities", "DELETE", `original_key_id=eq.${encodeURIComponent(session.keyId)}&provider=eq.${identityUnlinkRoute[1]}`);
      else { const data = authData(); data.identities = data.identities.filter(identity => !(identity.originalKeyId === session.keyId && identity.provider === identityUnlinkRoute[1])); writeData(data); }
      return json(response, 200, { unlinked: true });
    } catch (error) { console.error(error.message); return json(response, 503, { error: "IDENTITY_STORAGE_UNAVAILABLE" }); }
  }
  if (url.pathname === "/api/auth/github" && request.method === "GET") {
    if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET || !process.env.GITHUB_ADMIN_USERNAME || !process.env.GITHUB_OAUTH_STATE_SECRET || process.env.GITHUB_OAUTH_STATE_SECRET.length < 32) return json(response, 503, { error: "GITHUB_OAUTH_NOT_CONFIGURED" });
    const state = createOAuthState();
    const callback = `${APP_ORIGIN}/api/auth/github/callback`;
    const destination = new URL("https://github.com/login/oauth/authorize");
    destination.searchParams.set("client_id", process.env.GITHUB_CLIENT_ID); destination.searchParams.set("redirect_uri", callback); destination.searchParams.set("scope", "read:user user:email"); destination.searchParams.set("state", state);
    response.writeHead(302, { Location: destination.toString() }); return response.end();
  }
  if (url.pathname === "/api/auth/github/callback" && request.method === "GET") {
    const state = url.searchParams.get("state");
    if (!validOAuthState(state) || url.searchParams.has("error")) { response.writeHead(302, { Location: `${APP_ORIGIN}/?github=failed` }); return response.end(); }
    try {
      const tokenResponse = await fetch("https://github.com/login/oauth/access_token", { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ client_id: process.env.GITHUB_CLIENT_ID, client_secret: process.env.GITHUB_CLIENT_SECRET, code: url.searchParams.get("code"), state }) });
      const tokenBody = await tokenResponse.json(); if (!tokenResponse.ok || !tokenBody.access_token) throw new Error("GitHub token exchange failed");
      const profileResponse = await fetch("https://api.github.com/user", { headers: { Authorization: `Bearer ${tokenBody.access_token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "KingLegacyStock" } });
      const profile = await profileResponse.json();
      if (!profileResponse.ok || String(profile.login).toLowerCase() !== String(process.env.GITHUB_ADMIN_USERNAME).toLowerCase()) throw new Error("GitHub account is not authorized");
      const sessionToken = createSignedAdminSession(profile);
      response.writeHead(302, { Location: `${APP_ORIGIN}/?github=success`, "Set-Cookie": `igh_session=${sessionToken}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${APP_ORIGIN.startsWith("https:") ? "; Secure" : ""}` }); return response.end();
    } catch (error) { console.error("GitHub OAuth failed:", error.message); response.writeHead(302, { Location: `${APP_ORIGIN}/?github=failed` }); return response.end(); }
  }
  if (url.pathname === "/api/auth/session" && request.method === "GET") {
    const session = sessionFromRequest(request); if (!session || !(await sessionHasActiveKey(session))) return json(response, 401, { error: "SESSION_INVALID" });
    let expiresAt = session.expiresAt || null;
    if (session.keyId) expiresAt = (await getAuthData()).keys.find(key => key.id === session.keyId)?.expiresAt || null;
    return json(response, 200, { token: request.headers.cookie?.match(/(?:^|;\s*)igh_session=([^;]+)/)?.[1] || "", admin: !!session.admin, ownerId: session.ownerId, keyId: session.keyId, expiresAt, githubLogin: session.githubLogin, provider: session.provider, displayName: session.displayName });
  }
  if (url.pathname === "/api/state" && (request.method === "GET" || request.method === "PUT")) {
    const session = sessionFromRequest(request); if (!session?.ownerId || !(await sessionHasActiveKey(session))) return json(response, 401, { error: "SESSION_INVALID" });
    try {
      if (!SUPABASE_ENABLED) return json(response, 503, { error: "SUPABASE_NOT_CONFIGURED" });
      if (request.method === "GET") {
        const rows = await supabaseRequest("user_states", "GET", `owner_id=eq.${encodeURIComponent(session.ownerId)}&select=state,updated_at`);
        if (!rows.length) return json(response, 404, { error: "STATE_NOT_FOUND" });
        const etag = stateEtag(rows[0].state, rows[0].updated_at);
        if (request.headers["if-none-match"] === etag) {
          response.writeHead(304, { ETag: etag, "Cache-Control": "no-store" });
          return response.end();
        }
        return json(response, 200, rows[0].state, { ETag: etag, "Cache-Control": "no-store" });
      }
      const body = await requestBody(request, 5 * 1024 * 1024);
      const updatedAt = new Date().toISOString();
      await supabaseRequest("user_states", "POST", "on_conflict=owner_id", { owner_id: session.ownerId, state: body, updated_at: updatedAt });
      return json(response, 200, { saved: true }, { ETag: stateEtag(body, updatedAt), "Cache-Control": "no-store" });
    } catch (error) { console.error(error.message); return json(response, 503, { error: "SUPABASE_UNAVAILABLE" }); }
  }
  if (url.pathname === "/api/profile" && (request.method === "GET" || request.method === "PUT")) {
    const session = sessionFromRequest(request);
    if (!session?.ownerId || (!session.admin && !session.keyId) || !(await sessionHasActiveKey(session))) return json(response, 401, { error: "ACTIVE_KEY_LOGIN_REQUIRED" });
    try {
      const identity = session.keyId ? await verifiedIdentityForKey(session.keyId) : null;
      if (request.method === "GET") {
        const rows = SUPABASE_ENABLED
          ? await supabaseRequest("user_profiles", "GET", `owner_id=eq.${encodeURIComponent(session.ownerId)}&select=avatar_data,presence_status`)
          : (readData().userProfiles || []).filter(profile => profile.ownerId === session.ownerId);
        const saved = rows[0] || {};
        return json(response, 200, {
          admin: Boolean(session.admin),
          verified: Boolean(identity),
          provider: identity?.provider || null,
          displayName: identity?.displayName || session.displayName || session.githubLogin || (session.admin ? "Admin" : null),
          avatarData: saved.avatar_data || saved.avatarData || "",
          avatarUrl: identity?.avatarUrl || "",
          presenceStatus: saved.presence_status || saved.presenceStatus || "online",
        }, { "Cache-Control": "no-store" });
      }
      let body;
      try { body = await requestBody(request, 200000); }
      catch (error) { return json(response, error.message === "payload too large" ? 413 : 400, { error: error.message === "payload too large" ? "PROFILE_IMAGE_TOO_LARGE" : "INVALID_JSON" }); }
      if (!["online", "offline"].includes(body.presenceStatus)) return json(response, 400, { error: "INVALID_PROFILE_STATUS" });
      let avatarData;
      try { avatarData = profileAvatar(body.avatarData); }
      catch (error) { return json(response, 400, { error: "INVALID_PROFILE_IMAGE" }); }
      const profile = { owner_id: session.ownerId, avatar_data: avatarData, presence_status: body.presenceStatus, updated_at: new Date().toISOString() };
      if (SUPABASE_ENABLED) await supabaseRequest("user_profiles", "POST", "on_conflict=owner_id", profile);
      else {
        const data = readData();
        data.userProfiles = Array.isArray(data.userProfiles) ? data.userProfiles : [];
        data.userProfiles = data.userProfiles.filter(item => item.ownerId !== session.ownerId);
        data.userProfiles.push({ ownerId: session.ownerId, avatarData, presenceStatus: body.presenceStatus, updatedAt: profile.updated_at });
        writeData(data);
      }
      return json(response, 200, { saved: true });
    } catch (error) { console.error("Could not access user profile:", error.message); return json(response, 503, { error: "PROFILE_STORAGE_UNAVAILABLE" }); }
  }
  if (url.pathname === "/api/suggestions" && request.method === "POST") {
    const session = sessionFromRequest(request);
    if (!session?.keyId || session.admin || !(await sessionHasActiveKey(session))) return json(response, 401, { error: "ACTIVE_KEY_LOGIN_REQUIRED" });
    try {
      const identity = await verifiedIdentityForKey(session.keyId);
      if (!identity) return json(response, 403, { error: "VERIFIED_IDENTITY_REQUIRED" });
      let body;
      try { body = await requestBody(request, 12000); }
      catch (error) { return json(response, error.message === "payload too large" ? 413 : 400, { error: error.message === "payload too large" ? "SUGGESTION_TOO_LARGE" : "INVALID_JSON" }); }
      const message = String(body.message || "").trim();
      if (message.length < 3 || message.length > 2000) return json(response, 400, { error: "INVALID_SUGGESTION" });
      const profiles = SUPABASE_ENABLED
        ? await supabaseRequest("user_profiles", "GET", `owner_id=eq.${encodeURIComponent(session.ownerId)}&select=avatar_data,presence_status`)
        : (readData().userProfiles || []).filter(profile => profile.ownerId === session.ownerId);
      const profile = profiles[0] || {};
      const suggestion = {
        id: crypto.randomUUID(), owner_id: session.ownerId, author_provider: identity.provider,
        author_name: identity.displayName, author_avatar: profile.avatar_data || profile.avatarData || identity.avatarUrl || "",
        author_presence: profile.presence_status || profile.presenceStatus || "online",
        message, created_at: new Date().toISOString(),
      };
      if (SUPABASE_ENABLED) await supabaseRequest("site_suggestions", "POST", "", suggestion, "return=representation");
      else {
        const data = readData();
        data.siteSuggestions = Array.isArray(data.siteSuggestions) ? data.siteSuggestions : [];
        data.siteSuggestions.push({ id: suggestion.id, ownerId: suggestion.owner_id, provider: suggestion.author_provider, displayName: suggestion.author_name, avatarData: suggestion.author_avatar, presenceStatus: suggestion.author_presence, message, createdAt: suggestion.created_at });
        writeData(data);
      }
      return json(response, 201, { submitted: true, createdAt: suggestion.created_at });
    } catch (error) { console.error("Could not save site suggestion:", error.message); return json(response, 503, { error: "SUGGESTION_STORAGE_UNAVAILABLE" }); }
  }
  if (url.pathname === "/api/admin/suggestions" && request.method === "GET") {
    const session = sessionFromRequest(request);
    if (!session?.admin) return json(response, 403, { error: "ADMIN_ONLY" });
    try {
      const rows = SUPABASE_ENABLED
        ? await supabaseRequest("site_suggestions", "GET", "select=id,author_provider,author_name,author_avatar,author_presence,message,created_at&order=created_at.desc&limit=200")
        : (readData().siteSuggestions || []).slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 200);
      return json(response, 200, rows.map(item => ({
        id: item.id, provider: item.author_provider || item.provider,
        displayName: item.author_name || item.displayName, avatarData: item.author_avatar || item.avatarData || "",
        presenceStatus: item.author_presence || item.presenceStatus || "offline",
        message: item.message, createdAt: item.created_at || item.createdAt,
      })));
    } catch (error) { console.error("Could not load site suggestions:", error.message); return json(response, 503, { error: "SUGGESTION_STORAGE_UNAVAILABLE" }); }
  }
  if (url.pathname === "/api/admin/updates" && request.method === "GET") {
    const session = sessionFromRequest(request);
    if (!session?.admin) return json(response, 403, { error: "ADMIN_ONLY" });
    return json(response, 200, UPDATE_HISTORY, { "Cache-Control": "private, no-store" });
  }
  const adminSuggestionRoute = url.pathname.match(/^\/api\/admin\/suggestions\/([0-9a-f-]+)$/i);
  if (adminSuggestionRoute && request.method === "DELETE") {
    const session = sessionFromRequest(request);
    if (!session?.admin) return json(response, 403, { error: "ADMIN_ONLY" });
    try {
      if (SUPABASE_ENABLED) {
        const rows = await supabaseRequest("site_suggestions", "DELETE", `id=eq.${encodeURIComponent(adminSuggestionRoute[1])}`);
        if (!rows.length) return json(response, 404, { error: "SUGGESTION_NOT_FOUND" });
      } else {
        const data = readData();
        data.siteSuggestions = Array.isArray(data.siteSuggestions) ? data.siteSuggestions : [];
        const remaining = data.siteSuggestions.filter(item => item.id !== adminSuggestionRoute[1]);
        if (remaining.length === data.siteSuggestions.length) return json(response, 404, { error: "SUGGESTION_NOT_FOUND" });
        data.siteSuggestions = remaining;
        writeData(data);
      }
      return json(response, 200, { deleted: true });
    } catch (error) { console.error("Could not delete site suggestion:", error.message); return json(response, 503, { error: "SUGGESTION_STORAGE_UNAVAILABLE" }); }
  }
  if (url.pathname === "/api/requests" && request.method === "GET") {
    const session = sessionFromRequest(request);
    if (!session?.keyId || session.admin) return json(response, 401, { error: "ACTIVE_KEY_LOGIN_REQUIRED" });
    try {
      if (!(await sessionHasActiveKey(session))) return json(response, 401, { error: "ACTIVE_KEY_LOGIN_REQUIRED" });
      if (!(await verifiedIdentityForKey(session.keyId))) return json(response, 403, { error: "VERIFIED_IDENTITY_REQUIRED" });
      const requestDate = bangkokDate();
      const rows = SUPABASE_ENABLED
        ? await supabaseRequest("support_requests", "GET", `owner_id=eq.${encodeURIComponent(session.keyId)}&request_date=eq.${requestDate}&select=id,created_at`)
        : (readData().supportRequests || []).filter(item => item.ownerId === session.keyId && item.requestDate === requestDate);
      return json(response, 200, { submitted: rows.length > 0, submittedAt: rows[0]?.created_at || rows[0]?.createdAt || null });
    } catch (error) { console.error("Could not load support-request status:", error.message); return json(response, 503, { error: "REQUEST_STORAGE_UNAVAILABLE" }); }
  }
  if (url.pathname === "/api/requests" && request.method === "POST") {
    const session = sessionFromRequest(request);
    if (!session?.keyId || session.admin) return json(response, 401, { error: "ACTIVE_KEY_LOGIN_REQUIRED" });
    try {
      if (!(await sessionHasActiveKey(session))) return json(response, 401, { error: "ACTIVE_KEY_LOGIN_REQUIRED" });
      const identity = await verifiedIdentityForKey(session.keyId);
      if (!identity) return json(response, 403, { error: "VERIFIED_IDENTITY_REQUIRED" });
      let body;
      try { body = await requestBody(request, 10000); }
      catch (error) { return json(response, error.message === "payload too large" ? 413 : 400, { error: error.message === "payload too large" ? "REQUEST_TOO_LARGE" : "INVALID_JSON" }); }
      const message = String(body.message || "").trim();
      if (message.length < 3 || message.length > 1000) return json(response, 400, { error: "INVALID_REQUEST_MESSAGE" });
      const requestDate = bangkokDate();
      if (SUPABASE_ENABLED) {
        const rows = await supabaseRequest("support_requests", "POST", "on_conflict=owner_id,request_date", { id: crypto.randomUUID(), owner_id: session.keyId, request_date: requestDate, message, status: "open" }, "resolution=ignore-duplicates,return=representation");
        if (!rows.length) return json(response, 429, { error: "REQUEST_DAILY_LIMIT" });
        return json(response, 201, { submitted: true, submittedAt: rows[0].created_at });
      }
      const data = readData();
      data.supportRequests = Array.isArray(data.supportRequests) ? data.supportRequests : [];
      if (data.supportRequests.some(item => item.ownerId === session.keyId && item.requestDate === requestDate)) return json(response, 429, { error: "REQUEST_DAILY_LIMIT" });
      const createdAt = new Date().toISOString();
      data.supportRequests.push({ id: crypto.randomUUID(), ownerId: session.keyId, requestDate, message, status: "open", createdAt });
      writeData(data);
      return json(response, 201, { submitted: true, submittedAt: createdAt });
    } catch (error) { console.error("Could not save support request:", error.message); return json(response, 503, { error: "REQUEST_STORAGE_UNAVAILABLE" }); }
  }
  if (url.pathname === "/api/admin/requests" && request.method === "GET") {
    const session = sessionFromRequest(request);
    if (!session?.admin) return json(response, 403, { error: "ADMIN_ONLY" });
    try {
      const requests = SUPABASE_ENABLED
        ? await supabaseRequest("support_requests", "GET", "select=id,owner_id,message,status,request_date,created_at&order=created_at.desc&limit=200")
        : (readData().supportRequests || []).slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 200);
      const data = await getAuthData();
      return json(response, 200, requests.map(item => {
        const keyId = item.owner_id || item.ownerId;
        const owner = data.users.find(user => user.keyId === keyId);
        const identity = data.identities.find(entry => entry.originalKeyId === keyId || entry.ownerId === owner?.id);
        const key = data.keys.find(entry => entry.id === keyId);
        return { id: item.id, owner: identity?.displayName || owner?.name || (key ? `Key ${String(key.id).slice(0, 8)}` : item.owner_id || item.ownerId), provider: identity?.provider || null, avatarUrl: identity?.avatarUrl || "", message: item.message, status: item.status, requestDate: item.request_date || item.requestDate, createdAt: item.created_at || item.createdAt };
      }));
    } catch (error) { console.error("Could not load admin support requests:", error.message); return json(response, 503, { error: "REQUEST_STORAGE_UNAVAILABLE" }); }
  }
  const adminRequestRoute = url.pathname.match(/^\/api\/admin\/requests\/([0-9a-f-]+)$/i);
  if (adminRequestRoute && request.method === "DELETE") {
    const session = sessionFromRequest(request);
    if (!session?.admin) return json(response, 403, { error: "ADMIN_ONLY" });
    try {
      if (SUPABASE_ENABLED) {
        const rows = await supabaseRequest("support_requests", "DELETE", `id=eq.${encodeURIComponent(adminRequestRoute[1])}`);
        if (!rows.length) return json(response, 404, { error: "REQUEST_NOT_FOUND" });
      } else {
        const data = readData();
        data.supportRequests = Array.isArray(data.supportRequests) ? data.supportRequests : [];
        const remaining = data.supportRequests.filter(item => item.id !== adminRequestRoute[1]);
        if (remaining.length === data.supportRequests.length) return json(response, 404, { error: "REQUEST_NOT_FOUND" });
        data.supportRequests = remaining;
        writeData(data);
      }
      return json(response, 200, { deleted: true });
    } catch (error) { console.error("Could not delete support request:", error.message); return json(response, 503, { error: "REQUEST_STORAGE_UNAVAILABLE" }); }
  }
  if (url.pathname === "/api/auth/key" && request.method === "POST") {
    try { const body = await requestBody(request); const value = String(body.key || "").trim(); const data = await getAuthData(); const key = keyRecord(data, value); if (!validKey(key)) return json(response, 401, { error: "KEY_INVALID_OR_EXPIRED" }); return json(response, 200, { valid: true, admin: !!key.admin, registered: key.admin || data.users.some(user => user.keyId === key.id), permanent: key.permanent, expiresAt: key.expiresAt || null, durationMs: key.durationMs || null, waitingForFirstUse: !key.permanent && !key.expiresAt && Number(key.durationMs) > 0 }); }
    catch (error) { if (SUPABASE_ENABLED) { console.error(error.message); return json(response, 503, { error: "AUTH_STORAGE_UNAVAILABLE" }); } return json(response, 400, { error: "Invalid JSON" }); }
  }
  if (url.pathname === "/api/auth/signup" && request.method === "POST") {
    try { const body = await requestBody(request); const data = await getAuthData(); const key = keyRecord(data, String(body.key || "").trim()); const name = String(body.name || ""); const email = String(body.email || ""); const password = String(body.password || "");
      if (!validKey(key) || key.admin || data.users.some(user => user.keyId === key.id)) return json(response, 400, { error: "KEY_INVALID_OR_USED" });
      if (name.trim().length < 1 || name.length > 80 || !/^\S+@\S+\.\S+$/.test(email) || !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{9,}$/.test(password)) return json(response, 400, { error: "INVALID_FIELDS" });
      const credential = passwordHash(password); const user = { id: crypto.randomUUID(), name: name.trim(), email, keyId: key.id, passwordHash: credential.hash, salt: credential.salt, createdAt: Date.now() }; await saveUser(user); await activateKey(key); return json(response, 201, { registered: true, expiresAt: key.expiresAt || null, permanent: key.permanent });
    } catch (error) { if (SUPABASE_ENABLED) { console.error(error.message); return json(response, 503, { error: "AUTH_STORAGE_UNAVAILABLE" }); } return json(response, 400, { error: "Invalid JSON" }); }
  }
  if (url.pathname === "/api/auth/login" && request.method === "POST") {
    try { const body = await requestBody(request); const value = String(body.key || "").trim(); const data = await getAuthData(); const key = keyRecord(data, value); const user = data.users.find(item => item.keyId === key?.id); if (!validKey(key)) return json(response, 401, { error: "ACCOUNT_NOT_FOUND_OR_EXPIRED" }); await activateKey(key); if (!validKey(key)) return json(response, 401, { error: "ACCOUNT_NOT_FOUND_OR_EXPIRED" }); const token = crypto.randomBytes(32).toString("hex"); sessions.set(token, { userId: user?.id, ownerId: user?.id || key.id, keyId: key.id, admin: !!key.admin }); return json(response, 200, { token, admin: !!key.admin, ownerId: user?.id || key.id, user: user ? { id: user.id, nickname: user.nickname } : null, expiresAt: key.expiresAt || null }); }
    catch (error) { if (SUPABASE_ENABLED) { console.error(error.message); return json(response, 503, { error: "AUTH_STORAGE_UNAVAILABLE" }); } return json(response, 400, { error: "Invalid JSON" }); }
  }
  if (url.pathname === "/api/admin/keys" && request.method === "POST") {
    const session = sessionFromRequest(request); if (!session?.admin) return json(response, 403, { error: "ADMIN_ONLY" });
    try { await archiveExpiredKeys(); const body = await requestBody(request); const data = await getAuthData(); const isAdmin = Boolean(body.admin); const permanent = isAdmin || Boolean(body.permanent); const key = { id: crypto.randomUUID(), value: makeKey(data, permanent, isAdmin), permanent, admin: isAdmin, createdAt: Date.now(), expiresAt: null, durationMs: permanent ? null : Math.max(1, Number(body.hours) || 24) * 3600000, activatedAt: null, revoked: false }; await saveKey(key); return json(response, 201, key); } catch (error) { console.error(error.message); return json(response, 503, { error: "KEY_SAVE_FAILED" }); }
  }
  const keyTimeRoute = url.pathname.match(/^\/api\/admin\/keys\/([^/]+)\/time$/);
  if (keyTimeRoute && request.method === "POST") {
    const session = sessionFromRequest(request); if (!session?.admin) return json(response, 403, { error: "ADMIN_ONLY" });
    try {
      await archiveExpiredKeys();
      const body = await requestBody(request);
      const deltaHours = Number(body.deltaHours);
      if (deltaHours !== 1 && deltaHours !== -1) return json(response, 400, { error: "INVALID_TIME_ADJUSTMENT" });
      const data = await getAuthData();
      const key = data.keys.find(item => item.id === decodeURIComponent(keyTimeRoute[1]));
      if (!key) {
        const archivedKey = (await getArchivedKeys()).some(item => item.id === decodeURIComponent(keyTimeRoute[1]));
        return archivedKey ? json(response, 410, { error: "KEY_EXTENSION_WINDOW_EXPIRED" }) : json(response, 404, { error: "KEY_NOT_FOUND" });
      }
      if (key.permanent) return json(response, 400, { error: "KEY_IS_PERMANENT" });
      if (key.expiresAt && Date.now() - Number(key.expiresAt) >= KEY_EXPIRY_GRACE_MS) return json(response, 410, { error: "KEY_EXTENSION_WINDOW_EXPIRED" });
      await adjustKeyTime(key, deltaHours);
      return json(response, 200, { updated: true, expiresAt: key.expiresAt || null, durationMs: key.durationMs || null, activatedAt: key.activatedAt || null, waitingForFirstUse: !key.expiresAt && !key.activatedAt });
    } catch (error) {
      if (error.message === "KEY_IS_PERMANENT") return json(response, 400, { error: error.message });
      if (error.message === "MINIMUM_KEY_DURATION") return json(response, 400, { error: error.message });
      if (error.message === "KEY_NOT_AVAILABLE") return json(response, 410, { error: "KEY_EXTENSION_WINDOW_EXPIRED" });
      console.error(error.message); return json(response, 503, { error: "KEY_TIME_UPDATE_FAILED" });
    }
  }
  if (url.pathname === "/api/admin/keys" && request.method === "GET") {
    const session = sessionFromRequest(request); if (!session?.admin) return json(response, 403, { error: "ADMIN_ONLY" });
    try {
      await archiveExpiredKeys();
      const [data, archivedKeys] = await Promise.all([getAuthData(), getArchivedKeys()]);
      const activeKeys = data.keys.map(key => { const waitingForFirstUse = !key.permanent && !key.expiresAt && Number(key.durationMs) > 0; const remainingMs = key.permanent ? null : waitingForFirstUse ? Number(key.durationMs) : Math.max(0, Number(key.expiresAt || 0) - Date.now()); const extensionRemainingMs = key.permanent || waitingForFirstUse || remainingMs > 0 ? null : Math.max(0, KEY_EXPIRY_GRACE_MS - (Date.now() - Number(key.expiresAt || 0))); const identityName = identityOwnerName(data.identities, key.id); return { ...key, user: identityName || data.users.find(item => item.keyId === key.id)?.name || null, waitingForFirstUse, remainingMs, extensionRemainingMs }; });
      const history = archivedKeys.map(key => ({ ...key, archived: true, waitingForFirstUse: false, remainingMs: 0, user: identityOwnerName(data.identities, key.id) || null }));
      return json(response, 200, [...activeKeys, ...history]);
    } catch (error) { console.error(error.message); return json(response, 503, { error: "KEY_STORAGE_UNAVAILABLE" }); }
  }
  if (url.pathname === "/api/reviews" && request.method === "GET") {
    if (SUPABASE_ENABLED) { try { const rows = await supabaseRequest("reviews", "GET", "select=*&order=created_at.asc"); return json(response, 200, rows.map(row => ({ id: row.id, rating: row.rating, text: row.text, date: row.created_at }))); } catch (error) { console.error(error.message); } }
    return json(response, 200, readData().reviews);
  }
  if (url.pathname === "/api/reviews" && request.method === "POST") {
    try {
      const body = await requestBody(request);
      const rating = Number(body.rating);
      const text = String(body.text || "").trim();
      if (!Number.isInteger(rating) || rating < 1 || rating > 5 || !text || text.length > 240) return json(response, 400, { error: "Invalid review" });
      const review = { id: crypto.randomUUID(), rating, text, date: Date.now() };
      if (SUPABASE_ENABLED) { await supabaseRequest("reviews", "POST", "on_conflict=id", { id: review.id, rating, text, created_at: review.date }); return json(response, 201, (await supabaseRequest("reviews", "GET", "select=*&order=created_at.asc")).map(row => ({ id: row.id, rating: row.rating, text: row.text, date: row.created_at }))); }
      const data = readData(); data.reviews.push(review);
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
    if (SUPABASE_ENABLED) { try { await supabaseRequest("presence_clients", "POST", "on_conflict=client_id", { client_id: clientId, last_seen: new Date().toISOString() }); data.totalUsers = (await supabaseRequest("presence_clients", "GET", "select=client_id")).length; } catch (error) { console.error(error.message); } }
    else writeData(data);
    const stats = communityStats(); stats.totalUsers = data.totalUsers;
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "X-Client-Id": clientId });
    return response.end(JSON.stringify(stats));
  }
  if (url.pathname === "/api/community" && request.method === "GET") {
    const stats = communityStats();
    if (SUPABASE_ENABLED) { try { stats.totalUsers = (await supabaseRequest("presence_clients", "GET", "select=client_id")).length; } catch (error) { console.error(error.message); } }
    return json(response, 200, stats);
  }
  if (request.method !== "GET" && request.method !== "HEAD") return json(response, 405, { error: "Method not allowed" });
  const clientRoutes = new Set(["/dashboard", "/products", "/sales", "/reports", "/settings", "/updates", "/admin"]);
  const requested = decodeURIComponent(url.pathname === "/" || clientRoutes.has(url.pathname.toLowerCase()) ? "/index.html" : url.pathname);
  const filePath = path.resolve(ROOT, `.${requested}`);
  const relativePath = path.relative(ROOT, filePath);
  const normalizedRelativePath = relativePath.split(path.sep).join("/").toLowerCase();
  const protectedPath = normalizedRelativePath.split("/").some(part => part.startsWith(".env") || part === ".git" || part === "node_modules") || normalizedRelativePath.startsWith("server/") || normalizedRelativePath.startsWith("scripts/") || normalizedRelativePath.startsWith("supabase/") || ["package.json", "package-lock.json", "render.yaml", ".gitignore"].includes(normalizedRelativePath);
  if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath) || protectedPath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    const notFound = path.join(ROOT, "404.html");
    response.writeHead(404, { ...SECURITY_HEADERS, "Content-Type": "text/html; charset=utf-8" });
    return fs.createReadStream(notFound).pipe(response);
  }
  response.writeHead(200, { ...SECURITY_HEADERS, "Content-Type": MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream" });
  if (request.method === "HEAD") return response.end();
  fs.createReadStream(filePath).pipe(response);
});

server.listen(PORT, () => {
  console.log(`King Legacy Stock server: http://localhost:${PORT}`);
  archiveExpiredKeys().catch(error => console.error("Could not archive expired keys:", error.message));
  const archiveTimer = setInterval(() => archiveExpiredKeys().catch(error => console.error("Could not archive expired keys:", error.message)), 60 * 60 * 1000);
  archiveTimer.unref();
});
