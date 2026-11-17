const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

test("GitHub admin login remembers to open the Admin page after OAuth", async () => {
  const listeners = new Map();
  const buttonListeners = new Map();
  const sessionValues = new Map();
  const localValues = new Map();
  const scheduled = [];
  const openedPages = [];
  const githubButton = {
    classList: { toggle() {} },
    addEventListener(type, handler) { buttonListeners.set(type, handler); },
  };
  const form = { addEventListener() {} };
  const appRoot = { classList: { remove() {} } };
  const authGate = { classList: { add() {} }, remove() {} };
  const document = {
    addEventListener(type, handler) { listeners.set(type, handler); },
    getElementById(id) {
      if (id === "github-admin-login") return githubButton;
      if (id === "auth-key-form") return form;
      if (id === "app-root") return appRoot;
      if (id === "auth-gate") return authGate;
      return null;
    },
    querySelectorAll() { return []; },
  };
  const context = vm.createContext({
    document,
    location: { search: "", protocol: "https:", pathname: "/", href: "/" },
    history: { replaceState() {} },
    URLSearchParams,
    localStorage: {
      getItem: key => localValues.get(key) || null,
      setItem: (key, value) => localValues.set(key, String(value)),
      removeItem: key => localValues.delete(key),
    },
    sessionStorage: {
      getItem: key => sessionValues.get(key) || null,
      setItem: (key, value) => sessionValues.set(key, String(value)),
      removeItem: key => sessionValues.delete(key),
    },
    fetch: async () => ({ json: async () => ({ githubConfigured: true }) }),
    console,
    t: key => key,
    setTimeout: (callback, delay) => { scheduled.push({ callback, delay }); return scheduled.length; },
    clearInterval() {},
    setInterval() { return 1; },
  });
  context.window = context;
  context.activateUserState = async () => ({});
  context.enableAdminUi = () => {};
  context.showPage = page => openedPages.push(page);

  vm.runInContext(fs.readFileSync(require.resolve("../js/auth.js"), "utf8"), context);
  listeners.get("DOMContentLoaded")();
  buttonListeners.get("click")();
  await Promise.resolve();
  assert.equal(sessionValues.get("igh_pending_admin_route"), "1");

  await context.openApp({ admin: true, ownerId: "github:admin", token: "admin-session" });
  scheduled.find(timer => timer.delay === 400).callback();

  assert.equal(context.location.href, "/api/auth/github");
  assert.equal(openedPages[0], "admin");
  assert.equal(sessionValues.has("igh_pending_admin_route"), false);
});
