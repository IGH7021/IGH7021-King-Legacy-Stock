const test = require("node:test");
const assert = require("node:assert/strict");
const time = require("../shared/time");

test("uses Bangkok calendar days consistently around UTC midnight", () => {
  const timestamp = Date.parse("2026-11-17T17:30:00Z");
  assert.equal(time.dateKey(timestamp), "2026-11-18");
  assert.equal(new Date(time.dayStart(timestamp)).toISOString(), "2026-11-17T17:00:00.000Z");
  assert.equal(new Date(time.nextDayStart(timestamp)).toISOString(), "2026-11-18T17:00:00.000Z");
});

test("round-trips Bangkok-local datetime input independent of host timezone", () => {
  const timestamp = Date.parse("2026-11-17T03:45:00Z");
  const input = time.dateTimeInput(timestamp);
  assert.equal(input, "2026-11-17T10:45");
  assert.equal(time.parseDateTimeInput(input), timestamp);
});

test("adds calendar days without relying on local timezone", () => {
  assert.equal(time.addDays("2026-12-31", 1), "2027-01-01");
});

test("rejects normalized invalid calendar dates and local date-times", () => {
  assert.ok(Number.isNaN(time.startOfDateKey("2026-02-31")));
  assert.equal(time.addDays("2026-02-31", 1), "");
  assert.ok(Number.isNaN(time.parseDateTimeInput("2026-02-31T10:45")));
  assert.ok(Number.isNaN(time.parseDateTimeInput("2026-11-18T24:00")));
});
