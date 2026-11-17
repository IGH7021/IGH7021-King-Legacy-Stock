const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const time = require("../shared/time");

function createDashboardContext(initialState = {}) {
  let today = "2026-11-18";
  let saves = 0;
  const messages = [];
  const element = () => ({
    innerHTML: "",
    textContent: "",
    classList: {
      values: new Set(),
      toggle(name, force) {
        if (force) this.values.add(name);
        else this.values.delete(name);
      },
      contains(name) { return this.values.has(name); },
    },
  });
  const select = element();
  select.value = "";
  Object.defineProperty(select, "options", {
    get() { return { length: (this.innerHTML.match(/<option\b/g) || []).length }; },
  });
  const elements = {
    "daily-checklist-list": element(),
    "checklist-history-date": select,
    "daily-checklist-date": element(),
    "daily-checklist-empty": element(),
    "daily-checklist-form": element(),
  };
  const state = { dailyChecklist: {}, ...initialState };
  const appTime = { ...time, dateKey: () => today };
  const context = vm.createContext({
    state,
    APP_TIME: appTime,
    currentLang: "en",
    document: {
      addEventListener() {},
      getElementById: id => elements[id] || null,
    },
    t: key => key,
    genId: (() => { let index = 0; return prefix => `${prefix}-${++index}`; })(),
    saveState: () => { saves++; },
    toast: message => messages.push(message),
  });
  vm.runInContext(fs.readFileSync(require.resolve("../js/dashboard.js"), "utf8"), context);
  return {
    context,
    state,
    elements,
    messages,
    get saves() { return saves; },
    setToday(value) { today = value; },
  };
}

test("daily checklist saves tasks and completion changes to account state", () => {
  const dashboard = createDashboardContext();
  const { context, state, elements } = dashboard;
  context.renderDailyChecklist();

  assert.equal(context.addChecklistTask("<b>Restock</b>"), true);
  const task = state.dailyChecklist["2026-11-18"][0];
  assert.equal(task.text, "<b>Restock</b>");
  assert.match(elements["daily-checklist-list"].innerHTML, /&lt;b&gt;Restock&lt;\/b&gt;/);

  context.updateChecklistTask("2026-11-18", task.id, { completed: true, completedAt: 123 });
  assert.equal(task.completed, true);
  assert.equal(task.completedAt, 123);
  assert.equal(dashboard.saves, 2);
});

test("checklist rolls to the new Bangkok day and retains selectable history", () => {
  const { context, state, elements, setToday } = createDashboardContext({
    dailyChecklist: {
      "2026-11-17": [{ id: "old", text: "Yesterday", completed: true }],
    },
  });
  context.renderDailyChecklist();
  assert.equal(elements["checklist-history-date"].value, "2026-11-18");

  setToday("2026-11-19");
  assert.equal(context.addChecklistTask("Today"), true);
  assert.equal(elements["checklist-history-date"].value, "2026-11-19");
  assert.match(elements["daily-checklist-list"].innerHTML, /Today/);
  assert.equal(state.dailyChecklist["2026-11-19"].length, 1);

  elements["checklist-history-date"].value = "2026-11-17";
  context.renderDailyChecklist(true);
  assert.equal(elements["checklist-history-date"].value, "2026-11-17");
  assert.match(elements["daily-checklist-list"].innerHTML, /Yesterday/);
  assert.equal(elements["daily-checklist-form"].classList.contains("hidden"), true);
});

test("invalid checklist history dates and malformed tasks do not break rendering", () => {
  const { context, elements, state } = createDashboardContext({
    dailyChecklist: {
      "2026-02-31": [{ id: "invalid-date", text: "Bad date" }],
      "2026-11-17": [null, { id: "valid", text: "Visible" }],
    },
  });
  context.renderDailyChecklist();
  elements["checklist-history-date"].value = "2026-11-17";
  context.renderDailyChecklist(true);

  assert.equal(elements["checklist-history-date"].options.length, 2);
  assert.match(elements["daily-checklist-list"].innerHTML, /Visible/);
  assert.doesNotMatch(elements["daily-checklist-list"].innerHTML, /Bad date/);
  assert.ok(state.dailyChecklist["2026-02-31"]);
});
