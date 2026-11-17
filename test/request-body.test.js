const test = require("node:test");
const assert = require("node:assert/strict");
const { parseJsonChunks } = require("../server/request-body");

test("decodes UTF-8 characters split across request chunks", () => {
  const json = JSON.stringify({ thai: "ฟาร์มเงิน", english: "Acrospear" });
  const bytes = Buffer.from(json, "utf8");
  const split = bytes.indexOf(Buffer.from("ฟ", "utf8")) + 1;

  assert.deepEqual(parseJsonChunks([bytes.subarray(0, split), bytes.subarray(split)], 1024), {
    thai: "ฟาร์มเงิน",
    english: "Acrospear",
  });
});

test("rejects malformed UTF-8 instead of silently storing replacement characters", () => {
  assert.throws(() => parseJsonChunks([Buffer.from([0x7b, 0x22, 0x78, 0x22, 0x3a, 0x22, 0xc3, 0x28, 0x22, 0x7d])], 1024), TypeError);
});

test("enforces body limits in bytes", () => {
  assert.throws(() => parseJsonChunks([Buffer.from('{"name":"ฟาร์มเงิน"}', "utf8")], 5), /payload too large/);
});
