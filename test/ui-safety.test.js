const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../js/utils.js"), "utf8");
const context = { addEventListener() {} };
context.window = context;
context.document = { addEventListener() {} };
vm.runInNewContext(`${source}\nthis.escapeHtml = escapeHtml;`, context);

test("HTML-escapes account-controlled text before rendering", () => {
  assert.equal(
    context.escapeHtml(`<img src=x onerror="run()"> & 'text'`),
    "&lt;img src=x onerror=&quot;run()&quot;&gt; &amp; &#039;text&#039;",
  );
});
