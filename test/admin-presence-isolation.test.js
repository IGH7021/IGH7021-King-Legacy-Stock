const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ENVIRONMENT_KEYS = [
  "NODE_ENV", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_DISABLED",
  "GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET", "GITHUB_ADMIN_USERNAME",
  "GITHUB_OAUTH_STATE_SECRET", "APP_ORIGIN",
];
const previousEnvironment = Object.fromEntries(ENVIRONMENT_KEYS.map(key => [key, process.env[key]]));
const previousFetch = global.fetch;
const previousReadFileSync = fs.readFileSync;
const supabaseCalls = [];
let failPresenceCountQuery = false;
let localCommunityData = { totalUsers: 17, userIds: ["legacy-one", "legacy-two"] };
const localDataPath = path.resolve(__dirname, "../server/data.json");
const coreKey = {
  id: "test-core-key-id",
  value: "CORE-TEST-KEY",
  admin: false,
  permanent: true,
  expires_at: null,
  duration_ms: null,
  activated_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
  revoked: false,
};

Object.assign(process.env, {
  NODE_ENV: "test",
  SUPABASE_URL: "http://supabase.test",
  SUPABASE_SERVICE_ROLE_KEY: "test-only-service-role",
  SUPABASE_DISABLED: "false",
  GITHUB_CLIENT_ID: "test-only-client-id",
  GITHUB_CLIENT_SECRET: "test-only-client-secret",
  GITHUB_ADMIN_USERNAME: "release-test-admin",
  GITHUB_OAUTH_STATE_SECRET: "test-only-session-signing-secret-123456789",
  APP_ORIGIN: "http://localhost",
});

function mockedResponse(body, status = 200) {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
    json: async () => typeof body === "string" ? JSON.parse(body) : body,
  };
}

global.fetch = async (input, options = {}) => {
  const url = new URL(String(input));
  const method = options.method || "GET";
  if (url.hostname === "github.com" && url.pathname === "/login/oauth/access_token") {
    return mockedResponse({ access_token: "test-only-oauth-token" });
  }
  if (url.hostname === "api.github.com" && url.pathname === "/user") {
    return mockedResponse({ id: 7021, login: "release-test-admin" });
  }
  if (url.hostname === "supabase.test") {
    const table = url.pathname.split("/").pop();
    const call = { table, method, url: url.toString(), body: options.body ? JSON.parse(options.body) : null };
    supabaseCalls.push(call);
    if (table === "access_keys" && method === "GET") return mockedResponse([coreKey]);
    if (table === "presence_clients" && method === "GET") {
      if (failPresenceCountQuery) return mockedResponse({ error: "synthetic count failure" }, 503);
      return mockedResponse([{ client_id: "visitor-test" }]);
    }
    return mockedResponse([]);
  }
  throw new Error(`Unexpected external request to ${url.hostname}`);
};

fs.readFileSync = function (filePath, ...args) {
  if (path.resolve(String(filePath)) === localDataPath) return JSON.stringify(localCommunityData);
  return previousReadFileSync.call(this, filePath, ...args);
};

const analyticsModulePath = require.resolve("../server/admin-analytics");
delete require.cache[analyticsModulePath];
const { server } = require("../server/server");
const portReady = new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, resolve);
});

function request(path, { method = "GET", headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: "127.0.0.1",
      port: server.address().port,
      path,
      method,
      headers: body === undefined ? headers : { "Content-Type": "application/json", ...headers },
    }, response => {
      const chunks = [];
      response.on("data", chunk => chunks.push(chunk));
      response.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        let parsed = text;
        try { parsed = text ? JSON.parse(text) : {}; } catch (error) {}
        resolve({ status: response.statusCode, headers: response.headers, body: parsed });
      });
    });
    req.once("error", reject);
    if (body !== undefined) req.write(JSON.stringify(body));
    req.end();
  });
}

test("Core mode isolates analytics and preserves Admin, auth, profile, and community behavior", async () => {
  await portReady;
  assert.equal(require.cache[analyticsModulePath], undefined, "server startup must not load Admin Analytics");

  const unauthenticatedOverview = await request("/api/admin/overview");
  const unauthenticatedUser = await request("/api/admin/users/user-test");
  assert.deepEqual([unauthenticatedOverview.status, unauthenticatedUser.status], [403, 403]);
  assert.equal(supabaseCalls.length, 0, "unauthenticated analytics requests must not query Supabase");

  const authStart = await request("/api/auth/github");
  assert.equal(authStart.status, 302);
  const oauthState = new URL(authStart.headers.location).searchParams.get("state");
  const callback = await request(`/api/auth/github/callback?code=test-code&state=${encodeURIComponent(oauthState)}`);
  assert.equal(callback.status, 302);
  const adminCookie = callback.headers["set-cookie"][0].split(";")[0];

  const callsBeforeAnalytics = supabaseCalls.length;
  for (const endpoint of ["/api/admin/overview", "/api/admin/users/user-test"]) {
    const response = await request(endpoint, { headers: { Cookie: adminCookie } });
    assert.equal(response.status, 503);
    assert.equal(response.body.error, "ADMIN_ANALYTICS_DISABLED");
  }
  assert.equal(supabaseCalls.length, callsBeforeAnalytics, "disabled analytics routes must not query Supabase");

  const adminEndpoints = [
    "/api/admin/keys",
    "/api/admin/suggestions",
    "/api/admin/requests",
    "/api/admin/updates",
  ];
  const adminResponses = await Promise.all(adminEndpoints.map(endpoint => request(endpoint, { headers: { Cookie: adminCookie } })));
  assert.deepEqual(adminResponses.map(response => response.status), [200, 200, 200, 200]);

  const keyCheck = await request("/api/auth/key", { method: "POST", body: { key: coreKey.value } });
  assert.equal(keyCheck.status, 200);
  assert.equal(keyCheck.body.valid, true);
  const login = await request("/api/auth/login", { method: "POST", body: { key: coreKey.value } });
  assert.equal(login.status, 200);
  const ownerHeaders = { Authorization: `Bearer ${login.body.token}` };

  const stateResponse = await request("/api/state", { headers: ownerHeaders });
  assert.equal(stateResponse.status, 404);
  assert.equal(stateResponse.body.error, "STATE_NOT_FOUND");

  const profile = await request("/api/profile", { headers: ownerHeaders });
  assert.equal(profile.status, 200);
  assert.equal(profile.body.presenceStatus, "online");
  const savedProfile = await request("/api/profile", {
    method: "PUT",
    headers: ownerHeaders,
    body: { avatarData: "", presenceStatus: "offline" },
  });
  assert.equal(savedProfile.status, 200);
  assert.ok(supabaseCalls.some(call => call.table === "user_profiles" && call.body?.presence_status === "offline"));

  const heartbeat = await request("/api/presence", {
    method: "POST",
    headers: { ...ownerHeaders, "X-Client-Id": "visitor-test" },
  });
  assert.equal(heartbeat.status, 200);
  assert.equal(heartbeat.body.totalUsers, 1);
  const heartbeatWrite = supabaseCalls.find(call => call.table === "presence_clients" && call.method === "POST");
  assert.deepEqual(Object.keys(heartbeatWrite.body).sort(), ["client_id", "last_seen"]);
  assert.equal(heartbeatWrite.body.client_id, "visitor-test");
  assert.ok(!("first_seen" in heartbeatWrite.body));
  assert.ok(!("owner_id" in heartbeatWrite.body));
  assert.ok(!("last_authenticated_at" in heartbeatWrite.body));

  const community = await request("/api/community");
  assert.equal(community.status, 200);
  assert.equal(community.body.totalUsers, 1);
  assert.ok(supabaseCalls.some(call => call.table === "presence_clients" && call.method === "GET" && call.url.includes("select=client_id")));

  const adminCalls = supabaseCalls.filter(call => call.url.includes("last_authenticated_at") || /select=[^&]*owner_id[^&]*last_seen/.test(call.url));
  assert.equal(adminCalls.length, 0, "Core mode must not query the new presence-attribution columns");
});

test("Community counts fall back to local JSON when Supabase count queries fail", async () => {
  await portReady;
  failPresenceCountQuery = true;

  try {
    const heartbeat = await request("/api/presence", {
      method: "POST",
      headers: { "X-Client-Id": "fallback-visitor" },
    });
    assert.equal(heartbeat.status, 200);
    assert.equal(heartbeat.body.totalUsers, 3);

    const community = await request("/api/community");
    assert.equal(community.status, 200);
    assert.equal(community.body.totalUsers, 17);
  } finally {
    failPresenceCountQuery = false;
  }
});

test("Heartbeat replaces missing or blank client IDs and preserves valid IDs", async () => {
  await portReady;
  const cases = [
    { headers: {}, label: "missing" },
    { headers: { "X-Client-Id": "" }, label: "empty" },
    { headers: { "X-Client-Id": "   " }, label: "whitespace-only" },
  ];

  for (const { headers, label } of cases) {
    const response = await request("/api/presence", { method: "POST", headers });
    const clientId = response.headers["x-client-id"];
    assert.match(clientId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, `${label} ID must be replaced with a UUID`);
    const writes = supabaseCalls.filter(call => call.table === "presence_clients" && call.method === "POST");
    const write = writes[writes.length - 1];
    assert.equal(write.body.client_id, clientId);
  }

  const validClientId = "valid-visitor-id";
  const validResponse = await request("/api/presence", {
    method: "POST",
    headers: { "X-Client-Id": validClientId },
  });
  assert.equal(validResponse.headers["x-client-id"], validClientId);
  const writes = supabaseCalls.filter(call => call.table === "presence_clients" && call.method === "POST");
  const validWrite = writes[writes.length - 1];
  assert.equal(validWrite.body.client_id, validClientId);
});

test("Admin frontend initializes without analytics DOM and makes no analytics request", async () => {
  const frontendCalls = [];
  const handlers = [];
  const mockElement = () => ({
    innerHTML: "",
    classList: { add() {}, remove() {}, toggle() {} },
    setAttribute() {},
    getAttribute() { return null; },
    replaceChildren() {},
    addEventListener() {},
  });
  const elements = new Map([
    ["admin-key-list", mockElement()],
    ["admin-key-stats", mockElement()],
  ]);
  const document = {
    visibilityState: "visible",
    addEventListener(type, handler) { handlers.push({ type, handler }); },
    querySelectorAll() { return []; },
    getElementById(id) { return elements.get(id) || null; },
    querySelector() { return null; },
  };
  const context = {
    document,
    window: {},
    localStorage: { getItem(key) { return key === "igh_kinglegacy_is_admin" ? "1" : ""; } },
    setInterval() { return 1; },
    clearInterval() {},
    setTimeout() { return 1; },
    clearTimeout() {},
    fetch: async path => {
      frontendCalls.push(path);
      return { ok: true, text: async () => "[]" };
    },
    readApiResponse: async response => JSON.parse(await response.text()),
    t: key => key,
    toast() {},
    console: { error() {} },
    AUTH_TOKEN_KEY: "igh_kinglegacy_auth_token",
    APP_TIME: { TIME_ZONE: "Asia/Bangkok" },
    currentLang: "en",
    fmtNum: String,
    fmtBaht: String,
    fmtDate: String,
    escapeHtml: String,
  };
  vm.runInNewContext(fs.readFileSync(require.resolve("../js/admin.js"), "utf8"), context);
  const ready = handlers.find(handler => handler.type === "DOMContentLoaded");
  assert.ok(ready);
  assert.equal(vm.runInNewContext("ADMIN_ANALYTICS_ENABLED", context), false);
  ready.handler();
  await new Promise(resolve => setImmediate(resolve));

  assert.ok(frontendCalls.length > 0);
  assert.ok(frontendCalls.every(path => path === "/api/admin/keys"));
  assert.equal(typeof context.enableAdminUi, "function");
});

test.after(async () => {
  if (server.listening) await new Promise(resolve => server.close(resolve));
  global.fetch = previousFetch;
  fs.readFileSync = previousReadFileSync;
  for (const key of ENVIRONMENT_KEYS) {
    if (previousEnvironment[key] === undefined) delete process.env[key];
    else process.env[key] = previousEnvironment[key];
  }
});
