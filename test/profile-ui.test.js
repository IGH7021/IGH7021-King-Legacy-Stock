const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

test("profile image picker is localized and reports the selected filename", async () => {
  const listeners = new Map();
  const elements = new Map();
  const avatarInput = {
    files: [],
    value: "",
    clicked: false,
    click() { this.clicked = true; },
    addEventListener(type, handler) { listeners.set(`input:${type}`, handler); },
  };
  const avatarChoose = {
    addEventListener(type, handler) { listeners.set(`choose:${type}`, handler); },
  };
  const filename = { textContent: "" };
  const status = { textContent: "" };
  elements.set("profile-avatar-input", avatarInput);
  elements.set("profile-avatar-choose", avatarChoose);
  elements.set("profile-avatar-filename", filename);
  elements.set("profile-save-status", status);
  let ready;
  const document = {
    addEventListener(type, handler) {
      if (type === "DOMContentLoaded") ready = handler;
    },
    getElementById: id => elements.get(id) || null,
  };
  const context = vm.createContext({
    document,
    localStorage: { getItem() { return null; } },
    console: { error() {} },
    t: key => key,
  });
  context.window = context;

  vm.runInContext(fs.readFileSync(require.resolve("../js/profile.js"), "utf8"), context);
  ready();
  listeners.get("choose:click")();
  assert.equal(avatarInput.clicked, true);

  avatarInput.files = [{ name: "profile.png", type: "image/gif", size: 10 }];
  await listeners.get("input:change")();

  assert.equal(filename.textContent, "profile.png");
  assert.equal(status.textContent, "profile_image_invalid");
  assert.equal(avatarInput.value, "");
});
