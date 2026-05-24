/**
 * server.js — Express backend for the store.
 *
 * Public API:
 *   GET  /api/config                  — store branding/theme
 *   GET  /api/products                — product list
 *
 * Admin API (requires Bearer token from /api/admin/login):
 *   POST   /api/admin/login           — returns a session token
 *   POST   /api/admin/logout          — invalidates the token
 *   GET    /api/admin/products        — same as public, confirms auth works
 *   POST   /api/admin/products        — add a product
 *   PUT    /api/admin/products/:id    — update a product
 *   DELETE /api/admin/products/:id    — delete a product
 *   PUT    /api/admin/config          — update store branding/theme
 *
 * Stripe:
 *   POST /create-checkout-session     — creates a Stripe Checkout session
 *
 * Setup:
 *   1. cp .env.example .env
 *   2. Fill in STRIPE_SECRET_KEY and ADMIN_PASSWORD
 *   3. npm install && npm start
 */

require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const path    = require("path");
const fs      = require("fs");
const crypto  = require("crypto");

// ── Paths ─────────────────────────────────────────────────────
const DATA_DIR      = path.join(__dirname, "data");
const PRODUCTS_FILE = path.join(DATA_DIR, "products.json");
const CONFIG_FILE   = path.join(DATA_DIR, "config.json");
const PAGES_FILE    = path.join(DATA_DIR, "pages.json");

// Default data written on first run if files are missing
const DEFAULT_CONFIG = {
  name:          "My Store",
  tagline:       "Quality goods, delivered fast.",
  heroEyebrow:   "New Arrivals",
  currency:      "usd",
  currencySymbol:"$",
  accentColor:   "#6c63ff",
  accentDark:    "#4b44cc",
  accentLight:   "#ede9ff",
};

const DEFAULT_HOME_PAGE = {
  id: "home",
  name: "Home",
  slug: "home",
  isHome: true,
  showInNav: true,
  navLabel: "Home",
  background: { inherit: true },
  blocks: [
    {
      id: "block-home-hero",
      type: "hero",
      content: {
        eyebrow: "New Arrivals",
        title: "My Store",
        tagline: "Quality goods, delivered fast.",
        showButton: false,
        buttonText: "Shop Now",
        buttonUrl: "#products",
      },
      style: { inherit: true },
    },
    {
      id: "block-home-products",
      type: "product-grid",
      content: {
        showFilters: true,
        showSearch: true,
        categoryFilter: "all",
        limit: 0,
      },
      style: { inherit: true },
    },
  ],
};

// Ensure data directory and files exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(CONFIG_FILE)) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
}
if (!fs.existsSync(PRODUCTS_FILE)) {
  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify([], null, 2));
}
if (!fs.existsSync(PAGES_FILE)) {
  fs.writeFileSync(PAGES_FILE, JSON.stringify({ pages: [DEFAULT_HOME_PAGE] }, null, 2));
}

// ── JSON helpers ──────────────────────────────────────────────
function readProducts() {
  return JSON.parse(fs.readFileSync(PRODUCTS_FILE, "utf8"));
}
function writeProducts(products) {
  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2));
}
function readConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
}
function writeConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}
function readPages() {
  return JSON.parse(fs.readFileSync(PAGES_FILE, "utf8"));
}
function writePages(data) {
  fs.writeFileSync(PAGES_FILE, JSON.stringify(data, null, 2));
}

// ── Admin auth ─────────────────────────────────────────────────
// Simple in-memory token set — tokens reset when the server restarts.
const adminTokens = new Set();

function requireAdmin(req, res, next) {
  const auth  = req.headers.authorization || "";
  const token = auth.replace("Bearer ", "").trim();
  if (!token || !adminTokens.has(token)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// ── Stripe ────────────────────────────────────────────────────
const stripe = process.env.STRIPE_SECRET_KEY
  ? require("stripe")(process.env.STRIPE_SECRET_KEY)
  : null;

// ── App ───────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));   // serves index.html, cart.html, admin.html, etc.

// ── Admin page route ──────────────────────────────────────────
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

// ── Public API ────────────────────────────────────────────────
app.get("/api/config", (req, res) => {
  res.json(readConfig());
});

app.get("/api/products", (req, res) => {
  res.json(readProducts());
});

app.get("/api/pages", (req, res) => {
  res.json(readPages());
});

app.get("/api/pages/:slug", (req, res) => {
  const pages = readPages().pages || [];
  const page  = pages.find((p) => p.slug === req.params.slug);
  if (!page) return res.status(404).json({ error: "Page not found" });
  res.json(page);
});

// Pretty-URL route for any page: /p/:slug → serves index.html, JS handles render
app.get("/p/:slug", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ── Admin auth routes ─────────────────────────────────────────
app.post("/api/admin/login", (req, res) => {
  const { password } = req.body || {};
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return res.status(500).json({ error: "ADMIN_PASSWORD is not set in .env" });
  }
  if (password !== adminPassword) {
    return res.status(401).json({ error: "Invalid password" });
  }

  const token = crypto.randomUUID();
  adminTokens.add(token);
  res.json({ token });
});

app.post("/api/admin/logout", requireAdmin, (req, res) => {
  const token = (req.headers.authorization || "").replace("Bearer ", "").trim();
  adminTokens.delete(token);
  res.json({ ok: true });
});

// ── Admin product routes ──────────────────────────────────────
app.get("/api/admin/products", requireAdmin, (req, res) => {
  res.json(readProducts());
});

app.post("/api/admin/products", requireAdmin, (req, res) => {
  const products = readProducts();
  const body     = req.body;

  const newProduct = {
    id:          "product-" + Date.now(),
    name:        String(body.name        || "").trim(),
    description: String(body.description || "").trim(),
    details:     String(body.details     || "").trim(),
    price:       Math.round(Number(body.price) * 100),  // dollars → cents
    image:       String(body.image       || "").trim(),
    category:    String(body.category    || "").trim(),
    stock:       body.unlimitedStock ? -1 : Math.max(-1, parseInt(body.stock, 10) || 0),
    featured:    Boolean(body.featured),
    tags:        parseTags(body.tags),
  };

  if (!newProduct.name) return res.status(400).json({ error: "name is required" });
  if (!newProduct.price || newProduct.price <= 0) return res.status(400).json({ error: "valid price is required" });

  products.push(newProduct);
  writeProducts(products);
  res.status(201).json(newProduct);
});

app.put("/api/admin/products/:id", requireAdmin, (req, res) => {
  const products = readProducts();
  const idx      = products.findIndex((p) => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Product not found" });

  const body = req.body;
  products[idx] = {
    ...products[idx],
    name:        String(body.name        ?? products[idx].name).trim(),
    description: String(body.description ?? products[idx].description).trim(),
    details:     String(body.details     ?? products[idx].details).trim(),
    price:       body.price !== undefined ? Math.round(Number(body.price) * 100) : products[idx].price,
    image:       String(body.image       ?? products[idx].image).trim(),
    category:    String(body.category    ?? products[idx].category).trim(),
    stock:       body.unlimitedStock ? -1 : (body.stock !== undefined ? Math.max(-1, parseInt(body.stock, 10) || 0) : products[idx].stock),
    featured:    body.featured !== undefined ? Boolean(body.featured) : products[idx].featured,
    tags:        body.tags !== undefined ? parseTags(body.tags) : products[idx].tags,
    id:          req.params.id,  // id never changes
  };

  writeProducts(products);
  res.json(products[idx]);
});

app.delete("/api/admin/products/:id", requireAdmin, (req, res) => {
  const products = readProducts();
  const filtered = products.filter((p) => p.id !== req.params.id);
  if (filtered.length === products.length) {
    return res.status(404).json({ error: "Product not found" });
  }
  writeProducts(filtered);
  res.json({ ok: true });
});

// ── Admin pages routes ────────────────────────────────────────
app.get("/api/admin/pages", requireAdmin, (req, res) => {
  res.json(readPages());
});

app.put("/api/admin/pages", requireAdmin, (req, res) => {
  const body = req.body || {};
  if (!Array.isArray(body.pages)) {
    return res.status(400).json({ error: "pages must be an array" });
  }
  const sanitized = body.pages.map(sanitizePage).filter(Boolean);
  if (sanitized.length === 0) {
    return res.status(400).json({ error: "at least one page is required" });
  }
  // Exactly one home page — first one wins if multiple
  let homeFound = false;
  sanitized.forEach((p) => {
    if (p.isHome && !homeFound) homeFound = true;
    else p.isHome = false;
  });
  if (!homeFound) sanitized[0].isHome = true;

  // Slugs must be unique
  const slugs = new Set();
  for (const p of sanitized) {
    if (slugs.has(p.slug)) return res.status(400).json({ error: `duplicate slug: ${p.slug}` });
    slugs.add(p.slug);
  }

  writePages({ pages: sanitized });
  res.json({ pages: sanitized });
});

// ── Admin config route ────────────────────────────────────────
app.put("/api/admin/config", requireAdmin, (req, res) => {
  const allowed = [
    // Store info
    "name","tagline","heroEyebrow","currency","currencySymbol",
    // Brand colors
    "accentColor","accentDark","accentLight",
    // Page colors
    "colorBg","colorSurface","colorSurface2","colorBorder",
    "colorText","colorTextMuted","colorTextLight",
    // Typography
    "fontFamily",
    // Background
    "bgType","bgColor","bgImageUrl","bgImageSize","bgImagePosition",
    "bgGradientDir","bgGradientFrom","bgGradientTo",
    // Layout
    "containerWidth","heroTextAlign","heroPaddingTop","heroPaddingBottom",
    "gridGap","gridMinWidth",
    // Cards & borders
    "borderRadius","borderRadiusSm","borderWidth","shadowIntensity","cardHoverLift",
    // Navigation
    "navBgOpacity","navBlur",
    // Effects
    "transitionSpeed",
  ];
  const current = readConfig();
  const updated = { ...current };

  allowed.forEach((key) => {
    if (req.body[key] !== undefined) updated[key] = String(req.body[key]).trim();
  });

  writeConfig(updated);
  res.json(updated);
});

// ── Stripe Checkout ───────────────────────────────────────────
app.post("/create-checkout-session", async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ error: "Stripe is not configured. Add STRIPE_SECRET_KEY to .env" });
  }

  const { lineItems } = req.body;
  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    return res.status(400).json({ error: "No items provided." });
  }

  const products   = readProducts();
  const config     = readConfig();
  const stripeItems = [];

  for (const entry of lineItems) {
    const product = products.find((p) => p.id === entry.productId);
    if (!product) return res.status(400).json({ error: `Unknown product: ${entry.productId}` });
    if (product.stock === 0) return res.status(400).json({ error: `${product.name} is out of stock.` });

    stripeItems.push({
      price_data: {
        currency:     config.currency || "usd",
        unit_amount:  product.price,
        product_data: {
          name:        product.name,
          description: product.description,
          ...(product.image.startsWith("http") ? { images: [product.image] } : {}),
        },
      },
      quantity: entry.qty,
    });
  }

  const baseUrl = process.env.BASE_URL || (req.headers.origin || `http://localhost:${PORT}`);

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items:           stripeItems,
      mode:                 "payment",
      success_url:          `${baseUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:           `${baseUrl}/cart.html`,
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error("Stripe error:", err.message);
    res.status(500).json({ error: "Failed to create checkout session." });
  }
});

// ── Helpers ───────────────────────────────────────────────────
function parseTags(raw) {
  if (Array.isArray(raw)) return raw.map(String).map((t) => t.trim()).filter(Boolean);
  if (typeof raw === "string") return raw.split(",").map((t) => t.trim()).filter(Boolean);
  return [];
}

const VALID_BLOCK_TYPES = new Set([
  "hero","text","banner","image","button-row","product-grid","spacer","divider",
]);

function sanitizePage(p) {
  if (!p || typeof p !== "object") return null;
  const id   = String(p.id   || "page-" + Date.now()).trim();
  const name = String(p.name || "Untitled").trim();
  const slug = String(p.slug || name.toLowerCase()).trim()
                 .replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || id;
  const blocks = Array.isArray(p.blocks) ? p.blocks.map(sanitizeBlock).filter(Boolean) : [];
  return {
    id,
    name,
    slug,
    isHome:    Boolean(p.isHome),
    showInNav: p.showInNav !== false,
    navLabel:  String(p.navLabel || name).trim(),
    background: (p.background && typeof p.background === "object") ? p.background : { inherit: true },
    blocks,
  };
}

function sanitizeBlock(b) {
  if (!b || typeof b !== "object") return null;
  if (!VALID_BLOCK_TYPES.has(b.type)) return null;
  return {
    id:      String(b.id || "block-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8)),
    type:    b.type,
    content: (b.content && typeof b.content === "object") ? b.content : {},
    style:   (b.style   && typeof b.style   === "object") ? b.style   : { inherit: true },
  };
}

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  Store:  http://localhost:${PORT}`);
  console.log(`  Admin:  http://localhost:${PORT}/admin\n`);
  if (!process.env.ADMIN_PASSWORD) {
    console.warn("  [!] ADMIN_PASSWORD not set — admin panel will not work until you add it to .env\n");
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    console.warn("  [!] STRIPE_SECRET_KEY not set — checkout will not work until you add it to .env\n");
  }
});
