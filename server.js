/**
 * server.js — Express backend
 *
 * Handles:
 *   POST /create-checkout-session  — creates a Stripe Checkout session
 *   GET  /success                  — shown after successful payment
 *   GET  /cancel                   — shown if user cancels checkout
 *
 * Setup:
 *   1. Copy .env.example to .env
 *   2. Add your Stripe secret key (STRIPE_SECRET_KEY) to .env
 *   3. npm install && npm start
 */

require("dotenv").config();
const express  = require("express");
const cors     = require("cors");
const path     = require("path");
const fs       = require("fs");

// ── Inventory — shared with the frontend ─────────────────────
// We load the product list by evaluating the inventory.js file in a
// minimal sandbox so we don't duplicate data.
const inventoryPath = path.join(__dirname, "js", "inventory.js");
const inventoryCode = fs.readFileSync(inventoryPath, "utf8");

// Execute to get PRODUCTS and helpers in scope
const vm = require("vm");
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(inventoryCode, sandbox);

const { PRODUCTS, STORE_CONFIG, formatPrice, isInStock } = sandbox;

// ── Stripe ────────────────────────────────────────────────────
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// ── App ───────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));   // serves index.html, cart.html, css/, js/

// ── POST /create-checkout-session ─────────────────────────────
app.post("/create-checkout-session", async (req, res) => {
  const { lineItems } = req.body;

  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    return res.status(400).json({ error: "No items provided." });
  }

  // Build Stripe line_items
  const stripeLineItems = [];

  for (const entry of lineItems) {
    const product = PRODUCTS.find((p) => p.id === entry.productId);
    if (!product) {
      return res.status(400).json({ error: `Unknown product: ${entry.productId}` });
    }
    if (!isInStock(product)) {
      return res.status(400).json({ error: `${product.name} is out of stock.` });
    }

    stripeLineItems.push({
      price_data: {
        currency:     STORE_CONFIG.currency,
        unit_amount:  product.price,
        product_data: {
          name:        product.name,
          description: product.description,
          ...(product.image.startsWith("http")
            ? { images: [product.image] }
            : {}),
        },
      },
      quantity: entry.qty,
    });
  }

  const origin = req.headers.origin || `http://localhost:${PORT}`;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items:           stripeLineItems,
      mode:                 "payment",
      success_url:          `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:           `${origin}/cart.html`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Stripe error:", err.message);
    res.status(500).json({ error: "Failed to create checkout session." });
  }
});

// ── Start server ──────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Store running at http://localhost:${PORT}`);
  if (!process.env.STRIPE_SECRET_KEY) {
    console.warn(
      "\n  [!] STRIPE_SECRET_KEY is not set.\n" +
      "      Payments will not work until you add it to your .env file.\n"
    );
  }
});
