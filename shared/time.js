(function (root) {
  const TIME_ZONE = "Asia/Bangkok";
  const BANGKOK_OFFSET = "+07:00";

  function partsAt(timestamp, options) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, ...options }).formatToParts(new Date(timestamp));
    return Object.fromEntries(parts.map(part => [part.type, part.value]));
  }

  function dateKey(timestamp = Date.now()) {
    const time = Number(timestamp);
    if (!Number.isFinite(time)) return "";
    const parts = partsAt(time, { year: "numeric", month: "2-digit", day: "2-digit" });
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function dayStart(timestamp = Date.now()) {
    const key = dateKey(timestamp);
    return key ? startOfDateKey(key) : NaN;
  }

  function nextDayStart(timestamp = Date.now()) {
    const key = dateKey(timestamp);
    return key ? startOfDateKey(addDays(key, 1)) : NaN;
  }

  function startOfDateKey(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return NaN;
    const timestamp = Date.parse(`${value}T00:00:00${BANGKOK_OFFSET}`);
    return Number.isFinite(timestamp) && dateKey(timestamp) === value ? timestamp : NaN;
  }

  function addDays(value, amount) {
    if (!Number.isSafeInteger(amount) || !Number.isFinite(startOfDateKey(value))) return "";
    const [year, month, day] = String(value).split("-").map(Number);
    const date = new Date(Date.UTC(2000, 0, 1));
    date.setUTCFullYear(year, month - 1, day + amount);
    return `${String(date.getUTCFullYear()).padStart(4, "0")}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
  }

  function dateTimeInput(timestamp = Date.now()) {
    const parts = partsAt(timestamp, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  }

  function parseDateTimeInput(value) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(value))) return NaN;
    const timestamp = Date.parse(`${value}:00${BANGKOK_OFFSET}`);
    return Number.isFinite(timestamp) && dateTimeInput(timestamp) === value ? timestamp : NaN;
  }

  const api = { TIME_ZONE, dateKey, dayStart, nextDayStart, startOfDateKey, addDays, dateTimeInput, parseDateTimeInput };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.APP_TIME = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
