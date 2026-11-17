const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const readProjectFile = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const css = readProjectFile("css/style.css");
const html = readProjectFile("index.html");

function ruleFor(selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `Expected CSS rule for ${selector}`);
  return { index: match.index, declarations: match[1] };
}

test("hidden modal overlays are styled out of layout and pointer hit-testing", () => {
  const baseRule = ruleFor(".modal-overlay");
  const hiddenRule = ruleFor(".modal-overlay.hidden");
  assert.ok(hiddenRule.index > baseRule.index);
  assert.match(hiddenRule.declarations, /display:\s*none\s*;/);
  assert.match(hiddenRule.declarations, /pointer-events:\s*none\s*;/);
  assert.ok((html.match(/class="[^"]*\bmodal-overlay\b[^"]*\bhidden\b[^"]*"/g) || []).length > 0);
});

test("hidden cookie banners are styled out of layout", () => {
  const baseRule = ruleFor(".cookie-banner");
  const hiddenRule = ruleFor(".cookie-banner.hidden");
  assert.ok(hiddenRule.index > baseRule.index);
  assert.match(hiddenRule.declarations, /display:\s*none\s*;/);
  assert.match(html, /id="cookie-banner" class="cookie-banner hidden"/);
});

test("profile avatar picker uses localized controls instead of native file-picker text", () => {
  assert.match(html, /id="profile-avatar-choose"[^>]*data-i18n="profile_avatar_choose"/);
  assert.match(html, /id="profile-avatar-filename"[^>]*data-i18n="profile_avatar_no_file"/);
  assert.match(html, /id="profile-avatar-input"[^>]*class="sr-only"/);
  assert.doesNotMatch(html, /class="profile-file-input/);
});

test("the existing modal API opens and closes an overlay", () => {
  const classes = new Set(["hidden"]);
  const attributes = new Map();
  const closeTimers = [];
  const dialog = {
    setAttribute: (name, value) => attributes.set(name, value),
    querySelector: () => ({ id: "modal-title" }),
    querySelectorAll: () => [],
    focus() {},
  };
  const modal = {
    classList: {
      add: name => classes.add(name),
      remove: name => classes.delete(name),
      contains: name => classes.has(name),
    },
    querySelector: () => dialog,
    setAttribute: (name, value) => attributes.set(name, value),
  };
  const document = {
    activeElement: { isConnected: true, focus() {} },
    body: { classList: { add() {}, remove() {} } },
    addEventListener() {},
    getElementById: id => id === "test-modal" ? modal : null,
    querySelectorAll: () => [],
  };
  const context = {
    document,
    addEventListener() {},
    requestAnimationFrame: callback => callback(),
    setTimeout: callback => { closeTimers.push(callback); return callback; },
    clearTimeout() {},
  };
  context.window = context;
  const source = readProjectFile("js/utils.js");
  vm.runInNewContext(`${source}\nthis.testOpenModal = openModal;\nthis.testCloseModal = closeModal;`, context);

  context.testOpenModal("test-modal");
  assert.equal(classes.has("hidden"), false);
  assert.equal(classes.has("modal-show"), true);
  assert.equal(attributes.get("aria-hidden"), "false");

  context.testCloseModal("test-modal");
  closeTimers[0]();
  assert.equal(classes.has("hidden"), true);
  assert.equal(classes.has("modal-show"), false);
  assert.equal(attributes.get("aria-hidden"), "true");
});

test("cookie acceptance persists across page initialization", () => {
  const source = readProjectFile("js/cookie.js");
  const storedValues = new Map();
  const localStorage = {
    getItem: key => storedValues.get(key) || null,
    setItem: (key, value) => storedValues.set(key, value),
  };
  const createPage = () => {
    const listeners = new Map();
    const bannerClasses = new Set(["hidden"]);
    const buttonListeners = new Map();
    const banner = {
      classList: {
        add: name => bannerClasses.add(name),
        remove: name => bannerClasses.delete(name),
        contains: name => bannerClasses.has(name),
      },
    };
    const button = {
      addEventListener: (event, handler) => buttonListeners.set(event, handler),
    };
    const document = {
      addEventListener: (event, handler) => listeners.set(event, handler),
      getElementById: id => id === "cookie-banner" ? banner : id === "cookie-accept" ? button : null,
    };
    vm.runInNewContext(source, { document, localStorage });
    listeners.get("DOMContentLoaded")();
    return { bannerClasses, buttonListeners };
  };

  const firstPage = createPage();
  assert.equal(firstPage.bannerClasses.has("hidden"), false);
  firstPage.buttonListeners.get("click")();
  assert.equal(storedValues.get("igh_cookie_consent"), "accepted");
  assert.equal(firstPage.bannerClasses.has("hidden"), true);

  const reloadedPage = createPage();
  assert.equal(reloadedPage.bannerClasses.has("hidden"), true);
  assert.equal(reloadedPage.buttonListeners.size, 0);
});
