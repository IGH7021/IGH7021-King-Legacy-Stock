const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

process.env.NODE_ENV = "test";
process.env.SUPABASE_DISABLED = "true";

const { server } = require("../server/server");
const listening = new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});

function request(path) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: "127.0.0.1",
      port: server.address().port,
      path,
    }, response => {
      response.resume();
      response.on("end", () => resolve(response));
    });
    req.once("error", reject);
    req.end();
  });
}

test("malformed percent-encoding returns 400 and the server remains available", async () => {
  await listening;
  const malformed = await request("/%E0%A4%A");
  assert.equal(malformed.statusCode, 400);

  const valid = await request("/api/config");
  assert.equal(valid.statusCode, 200);
});

test("static requests cannot access test files or nested test paths", async () => {
  await listening;
  for (const path of [
    "/test/server-boundary.test.js",
    "/test/nested/../server-boundary.test.js",
    "/%74est%2fserver-boundary.test.js",
  ]) {
    const response = await request(path);
    assert.equal(response.statusCode, 404, `${path} must be denied`);
  }

  const publicAsset = await request("/css/style.css");
  assert.equal(publicAsset.statusCode, 200);
});

test.after(async () => {
  if (server.listening) await new Promise(resolve => server.close(resolve));
});
