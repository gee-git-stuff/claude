/**
 * Store tests — inventory helpers, data files, and server routes.
 * Run with: node tests/test.js
 */

const fs   = require("fs");
const path = require("path");
const vm   = require("vm");
const http = require("http");

const ROOT = path.join(__dirname, "..");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    process.stdout.write(`  \x1b[32m✓\x1b[0m ${message}\n`);
  } else {
    failed++;
    process.stdout.write(`  \x1b[31m✗\x1b[0m ${message}\n`);
  }
}

// ── Load inventory.js helpers in a sandbox ────────────────────
const inventoryCode = fs.readFileSync(path.join(ROOT, "js", "inventory.js"), "utf8");
const sandbox = {
  window: {
    PRODUCTS: [
      { id: "p1", name: "Widget", category: "Tools", stock: 5,  price: 1000 },
      { id: "p2", name: "Gadget", category: "Home",  stock: -1, price: 2500 },
      { id: "p3", name: "Donut",  category: "Food",  stock: 0,  price: 500  },
    ],
    STORE_CONFIG: { currencySymbol: "$" },
  },
};
vm.createContext(sandbox);
vm.runInContext(inventoryCode, sandbox);

// Pull helpers from sandbox — they reference sandbox.window
const formatPrice  = (c) => vm.runInContext(`formatPrice(${c})`,         sandbox);
const isInStock    = (s) => vm.runInContext(`isInStock({stock:${s}})`,   sandbox);
const getProduct   = (id) => vm.runInContext(`getProduct("${id}")`,      sandbox);
const getCategories= ()  => vm.runInContext("getCategories()",           sandbox);

// ── Helpers ───────────────────────────────────────────────────
console.log("\nInventory helpers:");
assert(formatPrice(1000) === "$10.00",  "formatPrice(1000) = $10.00");
assert(formatPrice(2999) === "$29.99",  "formatPrice(2999) = $29.99");
assert(formatPrice(100)  === "$1.00",   "formatPrice(100)  = $1.00");

assert(isInStock(5)  === true,  "isInStock(5)  = true");
assert(isInStock(-1) === true,  "isInStock(-1) = true (unlimited)");
assert(isInStock(0)  === false, "isInStock(0)  = false");

assert(getProduct("p1") !== null,       "getProduct returns item for known id");
assert(getProduct("p1").name === "Widget", "getProduct returns correct item");
assert(getProduct("nope") === null,     "getProduct returns null for unknown id");

const cats = getCategories();
assert(cats[0] === "All",   'getCategories()[0] = "All"');
assert(cats.length === 4,   "getCategories() includes All + 3 unique categories");
assert(cats.includes("Tools"), "getCategories includes Tools");

// ── data/products.json ────────────────────────────────────────
console.log("\ndata/products.json:");
const productsRaw = fs.readFileSync(path.join(ROOT, "data", "products.json"), "utf8");
let products;
try {
  products = JSON.parse(productsRaw);
  assert(true, "products.json is valid JSON");
} catch {
  assert(false, "products.json is valid JSON");
  products = [];
}

assert(Array.isArray(products),    "products.json is an array");
assert(products.length > 0,        "products.json has at least one product");

products.forEach((p, i) => {
  assert(typeof p.id          === "string"  && p.id,          `[${i}] has id`);
  assert(typeof p.name        === "string"  && p.name,        `[${i}] has name`);
  assert(typeof p.description === "string",                   `[${i}] has description`);
  assert(typeof p.price       === "number"  && p.price > 0,   `[${i}] has positive price`);
  assert(typeof p.stock       === "number",                   `[${i}] has stock`);
  assert(typeof p.featured    === "boolean",                  `[${i}] has featured`);
  assert(Array.isArray(p.tags),                               `[${i}] has tags array`);
});

const ids = products.map((p) => p.id);
assert(new Set(ids).size === ids.length, "all product IDs are unique");

// ── data/config.json ──────────────────────────────────────────
console.log("\ndata/config.json:");
const configRaw = fs.readFileSync(path.join(ROOT, "data", "config.json"), "utf8");
let config;
try {
  config = JSON.parse(configRaw);
  assert(true, "config.json is valid JSON");
} catch {
  assert(false, "config.json is valid JSON");
  config = {};
}

assert(typeof config.name          === "string" && config.name,          "config has name");
assert(typeof config.tagline       === "string",                         "config has tagline");
assert(typeof config.currency      === "string",                         "config has currency");
assert(typeof config.currencySymbol=== "string",                         "config has currencySymbol");
assert(config.accentColor && config.accentColor.startsWith("#"),         "config has valid accentColor");

// Design fields — colors
assert(config.accentDark  && config.accentDark.startsWith("#"),          "config has accentDark");
assert(config.accentLight && config.accentLight.startsWith("#"),         "config has accentLight");
assert(config.colorBg     && config.colorBg.startsWith("#"),             "config has colorBg");
assert(config.colorSurface&& config.colorSurface.startsWith("#"),        "config has colorSurface");
assert(config.colorText   && config.colorText.startsWith("#"),           "config has colorText");

// Design fields — typography
assert(typeof config.fontFamily === "string" && config.fontFamily,       "config has fontFamily");

// Design fields — background
assert(["color","image","gradient"].includes(config.bgType),             "config bgType is valid");

// Design fields — layout
assert(!isNaN(Number(config.containerWidth)),                            "config containerWidth is numeric");
assert(!isNaN(Number(config.heroPaddingTop)),                            "config heroPaddingTop is numeric");
assert(!isNaN(Number(config.heroPaddingBottom)),                         "config heroPaddingBottom is numeric");
assert(!isNaN(Number(config.gridGap)),                                   "config gridGap is numeric");
assert(!isNaN(Number(config.gridMinWidth)),                              "config gridMinWidth is numeric");
assert(["left","center","right"].includes(config.heroTextAlign),         "config heroTextAlign is valid");

// Design fields — cards & borders
assert(!isNaN(Number(config.borderRadius)),                              "config borderRadius is numeric");
assert(!isNaN(Number(config.borderWidth)),                               "config borderWidth is numeric");
assert(["none","subtle","medium","strong"].includes(config.shadowIntensity), "config shadowIntensity is valid");
assert(!isNaN(Number(config.cardHoverLift)),                             "config cardHoverLift is numeric");

// Design fields — nav & effects
assert(!isNaN(Number(config.navBgOpacity)),                              "config navBgOpacity is numeric");
assert(!isNaN(Number(config.navBlur)),                                   "config navBlur is numeric");
assert(!isNaN(Number(config.transitionSpeed)),                           "config transitionSpeed is numeric");

// ── File structure ────────────────────────────────────────────
console.log("\nFile structure:");
const requiredFiles = [
  "index.html", "cart.html", "success.html", "admin.html",
  "server.js", "start.bat", ".env.example",
  "css/style.css", "css/admin.css",
  "js/inventory.js", "js/store.js", "js/cart-page.js", "js/admin.js",
  "data/products.json", "data/config.json",
];
requiredFiles.forEach((f) => {
  assert(fs.existsSync(path.join(ROOT, f)), `${f} exists`);
});

// ── Server smoke test ─────────────────────────────────────────
console.log("\nServer API:");

// Start server with a test admin password
process.env.ADMIN_PASSWORD  = "test-password-123";
process.env.STRIPE_SECRET_KEY = "";  // skip stripe

// We need to clear require cache so server re-reads env
Object.keys(require.cache).forEach((k) => { if (k.includes("server")) delete require.cache[k]; });

const PORT = 4321;
process.env.PORT = PORT;

// Require server.js — it starts listening immediately
// We redirect its console output to avoid noise
const origLog  = console.log;
const origWarn = console.warn;
console.log  = () => {};
console.warn = () => {};
require(path.join(ROOT, "server.js"));
console.log  = origLog;
console.warn = origWarn;

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${PORT}${url}`, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end",  () => resolve({ status: res.statusCode, body: data, json: () => JSON.parse(data) }));
    }).on("error", reject);
  });
}

function post(url, body, token) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const opts = {
      hostname: "localhost", port: PORT,
      path: url, method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };
    const req = http.request(opts, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end",  () => resolve({ status: res.statusCode, body: data, json: () => JSON.parse(data) }));
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

async function runServerTests() {
  await new Promise((r) => setTimeout(r, 200)); // let server bind

  // Public endpoints
  const cfgRes = await get("/api/config");
  assert(cfgRes.status === 200, "GET /api/config returns 200");
  const cfg = cfgRes.json();
  assert(cfg.name && typeof cfg.name === "string", "GET /api/config returns name");

  const prodRes = await get("/api/products");
  assert(prodRes.status === 200, "GET /api/products returns 200");
  assert(Array.isArray(prodRes.json()), "GET /api/products returns array");

  // Admin login — wrong password
  const badLogin = await post("/api/admin/login", { password: "wrong" });
  assert(badLogin.status === 401, "Login with wrong password returns 401");

  // Admin login — correct password
  const goodLogin = await post("/api/admin/login", { password: "test-password-123" });
  assert(goodLogin.status === 200, "Login with correct password returns 200");
  const { token } = goodLogin.json();
  assert(typeof token === "string" && token.length > 0, "Login returns a token");

  // Protected route without token
  const noToken = await get("/api/admin/products");
  assert(noToken.status === 401, "Protected route without token returns 401");

  // Add a product
  const addRes = await post("/api/admin/products", {
    name: "Test Widget", description: "A test product.", details: "Details here.",
    price: 19.99, category: "Test", stock: 10, featured: false, tags: "test,widget",
  }, token);
  assert(addRes.status === 201, "POST /api/admin/products returns 201");
  const newProduct = addRes.json();
  assert(newProduct.id && newProduct.name === "Test Widget", "New product has correct name");
  assert(newProduct.price === 1999, "Price correctly converted to cents");

  // Update config — design fields
  const cfgUpdate = await new Promise((resolve, reject) => {
    const payload = JSON.stringify({ accentColor: "#ff0000", borderRadius: "16", shadowIntensity: "strong" });
    const opts = {
      hostname: "localhost", port: PORT,
      path: "/api/admin/config", method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        Authorization: `Bearer ${token}`,
      },
    };
    const req = http.request(opts, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end",  () => resolve({ status: res.statusCode, json: () => JSON.parse(data) }));
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
  assert(cfgUpdate.status === 200, "PUT /api/admin/config returns 200");
  const updatedCfg = cfgUpdate.json();
  assert(updatedCfg.accentColor  === "#ff0000", "Config update persists accentColor");
  assert(updatedCfg.borderRadius === "16",       "Config update persists borderRadius");
  assert(updatedCfg.shadowIntensity === "strong","Config update persists shadowIntensity");

  // Restore original accent color
  await new Promise((resolve, reject) => {
    const payload = JSON.stringify({ accentColor: "#6c63ff", borderRadius: "12", shadowIntensity: "medium" });
    const opts = {
      hostname: "localhost", port: PORT,
      path: "/api/admin/config", method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        Authorization: `Bearer ${token}`,
      },
    };
    const req = http.request(opts, (res) => { res.resume(); res.on("end", resolve); });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });

  // Clean up — delete the test product so data stays clean
  await new Promise((resolve, reject) => {
    const opts = {
      hostname: "localhost", port: PORT,
      path: `/api/admin/products/${newProduct.id}`, method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    };
    http.request(opts, (res) => { res.resume(); res.on("end", resolve); }).on("error", reject).end();
  });

  // Summary
  console.log(`\n${"=".repeat(44)}`);
  console.log(`  Results: \x1b[32m${passed} passed\x1b[0m, \x1b[31m${failed} failed\x1b[0m`);
  console.log(`${"=".repeat(44)}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runServerTests().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
