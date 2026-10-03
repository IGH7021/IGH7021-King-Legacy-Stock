const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = path.resolve(__dirname, "..");
const envPath = path.join(root, ".env");
if (fs.existsSync(envPath)) fs.readFileSync(envPath, "utf8").split(/\r?\n/).forEach(line => {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (match && !Object.hasOwn(process.env, match[1])) process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
});

const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env first.");

async function upsert(table, conflict, rows) {
  if (!rows.length) return;
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?on_conflict=${conflict}`, {
    method: "POST",
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
  if (!response.ok) throw new Error(`${table} import failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
}

function uuidFor(value) {
  const text = String(value || "");
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) return text;
  const bytes = crypto.createHash("sha256").update(`kinglegacy:${text}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function main() {
  const keysDir = path.join(root, "server", "keys");
  const keyFiles = fs.existsSync(keysDir) ? fs.readdirSync(keysDir).filter(name => name.endsWith(".json")) : [];
  const sourceKeys = keyFiles.map(name => JSON.parse(fs.readFileSync(path.join(keysDir, name), "utf8"))).filter(key => key.id && key.value);
  const normalizedKeyId = new Map(sourceKeys.map(key => [String(key.id), uuidFor(key.id)]));
  const keys = sourceKeys.map(key => ({ id: normalizedKeyId.get(String(key.id)), value: key.value, admin: !!key.admin, permanent: !!key.permanent, expires_at: key.expiresAt || null, duration_ms: key.durationMs || null, activated_at: key.activatedAt || null, created_at: key.createdAt || Date.now(), revoked: !!key.revoked }));
  const localDataPath = path.join(root, "server", "data.json");
  const localData = fs.existsSync(localDataPath) ? JSON.parse(fs.readFileSync(localDataPath, "utf8")) : {};
  const users = (Array.isArray(localData.users) ? localData.users : []).filter(user => user.id && user.keyId && normalizedKeyId.has(String(user.keyId))).map(user => ({ id: uuidFor(user.id), name: user.name, email: user.email, key_id: normalizedKeyId.get(String(user.keyId)), password_hash: user.passwordHash || null, salt: user.salt || null, created_at: user.createdAt || Date.now() }));
  const reviews = (Array.isArray(localData.reviews) ? localData.reviews : []).filter(review => review.id && review.rating && review.text).map(review => ({ id: uuidFor(review.id), rating: review.rating, text: review.text, created_at: review.date || Date.now() }));
  const presence = [...new Set(Array.isArray(localData.userIds) ? localData.userIds : [])].map(clientId => ({ client_id: clientId, first_seen: new Date().toISOString(), last_seen: new Date().toISOString() }));
  await upsert("access_keys", "id", keys);
  await upsert("app_users", "id", users);
  await upsert("reviews", "id", reviews);
  await upsert("presence_clients", "client_id", presence);
  console.log(`Imported ${keys.length} key(s), ${users.length} user(s), ${reviews.length} review(s), and ${presence.length} visitor record(s).`);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
