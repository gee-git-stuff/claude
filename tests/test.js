/**
 * Basic tests for the store — inventory data and server helpers.
 * Run with: node tests/test.js
 */

const fs  = require("fs");
const vm  = require("vm");
const path = require("path");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message}`);
  }
}

// ── Load inventory in a sandbox ───────────────────────────────
const inventoryCode = fs.readFileSync(
  path.join(__dirname, "..", "js", "inventory.js"),
  "utf8"
);
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(inventoryCode, sandbox);

const { PRODUCTS, STORE_CONFIG, getCategories, formatPrice, getProduct, isInStock } = sandbox;

// ── STORE_CONFIG ──────────────────────────────────────────────
console.log("\nSTORE_CONFIG:");
assert(typeof STORE_CONFIG.name === "string" && STORE_CONFIG.name.length > 0, "name is set");
assert(typeof STORE_CONFIG.currency === "string", "currency is set");
assert(typeof STORE_CONFIG.currencySymbol === "string", "currencySymbol is set");
assert(STORE_CONFIG.accentColor.startsWith("#"), "accentColor is a hex color");

// ── PRODUCTS array ────────────────────────────────────────────
console.log("\nPRODUCTS array:");
assert(Array.isArray(PRODUCTS), "PRODUCTS is an array");
assert(PRODUCTS.length > 0, "PRODUCTS has at least one item");

PRODUCTS.forEach((p, i) => {
  assert(typeof p.id === "string" && p.id.length > 0,         `[${i}] id is a non-empty string`);
  assert(typeof p.name === "string" && p.name.length > 0,     `[${i}] name is set`);
  assert(typeof p.description === "string",                   `[${i}] description is set`);
  assert(typeof p.details === "string",                       `[${i}] details is set`);
  assert(typeof p.price === "number" && p.price > 0,          `[${i}] price is a positive number`);
  assert(typeof p.category === "string" && p.category.length, `[${i}] category is set`);
  assert(typeof p.stock === "number",                         `[${i}] stock is a number`);
  assert(typeof p.featured === "boolean",                     `[${i}] featured is a boolean`);
  assert(Array.isArray(p.tags),                               `[${i}] tags is an array`);
});

// No duplicate IDs
const ids = PRODUCTS.map((p) => p.id);
const uniqueIds = new Set(ids);
assert(uniqueIds.size === ids.length, "All product IDs are unique");

// ── Helper functions ──────────────────────────────────────────
console.log("\nHelpers:");

const categories = getCategories();
assert(categories[0] === "All", 'getCategories() starts with "All"');
assert(categories.length >= 2, "getCategories() returns multiple entries");

assert(formatPrice(1000) === "$10.00",  "formatPrice(1000) = $10.00");
assert(formatPrice(2999) === "$29.99",  "formatPrice(2999) = $29.99");
assert(formatPrice(100)  === "$1.00",   "formatPrice(100)  = $1.00");

const firstId = PRODUCTS[0].id;
assert(getProduct(firstId) !== null,        "getProduct returns a product for valid id");
assert(getProduct("nonexistent") === null,  "getProduct returns null for unknown id");

const inStockProduct = { stock: 5 };
const unlimitedProduct = { stock: -1 };
const outProduct = { stock: 0 };
assert(isInStock(inStockProduct)  === true,  "isInStock(5)  = true");
assert(isInStock(unlimitedProduct) === true, "isInStock(-1) = true (unlimited)");
assert(isInStock(outProduct) === false,      "isInStock(0)  = false");

// ── File structure ────────────────────────────────────────────
console.log("\nFile structure:");
const requiredFiles = [
  "index.html",
  "cart.html",
  "success.html",
  "server.js",
  "css/style.css",
  "js/inventory.js",
  "js/store.js",
  "js/cart-page.js",
  ".env.example",
];
requiredFiles.forEach((f) => {
  const exists = fs.existsSync(path.join(__dirname, "..", f));
  assert(exists, `${f} exists`);
});

// ── Summary ───────────────────────────────────────────────────
console.log(`\n${"=".repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${"=".repeat(40)}\n`);

process.exit(failed > 0 ? 1 : 0);
