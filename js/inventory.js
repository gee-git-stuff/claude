/**
 * INVENTORY — Edit this file to manage your products.
 *
 * Each product has:
 *   id          — unique identifier (no spaces)
 *   name        — display name
 *   description — shown on the product card
 *   details     — longer text shown in the product modal
 *   price       — in cents (e.g. 2999 = $29.99)
 *   image       — path to image, or a placeholder emoji string
 *   category    — used for filter tabs (create any categories you want)
 *   stock       — number of units available; set to -1 for unlimited
 *   featured    — if true, shown first / highlighted on the store page
 *   tags        — array of search keywords
 */

var STORE_CONFIG = {
  name: "My Store",
  tagline: "Quality goods, delivered fast.",
  currency: "usd",
  currencySymbol: "$",
  accentColor: "#6c63ff",   // primary brand color
  accentDark: "#4b44cc",    // hover state
};

var PRODUCTS = [
  {
    id: "product-001",
    name: "Essential Tote Bag",
    description: "Durable canvas tote — fits everything you need for the day.",
    details:
      "Hand-stitched from 12oz organic cotton canvas. Reinforced handles rated to 40 lbs. Inside zip pocket. Available in natural and black.",
    price: 2999,
    image: "https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&q=80",
    category: "Accessories",
    stock: 24,
    featured: true,
    tags: ["bag", "tote", "canvas", "accessories"],
  },
  {
    id: "product-002",
    name: "Ceramic Pour-Over Set",
    description: "Handcrafted pour-over dripper and server — for the perfect cup.",
    details:
      "Wheel-thrown stoneware fired at cone 10. Includes 500ml server and dripper cone. Food-safe glaze. Dishwasher safe.",
    price: 5499,
    image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&q=80",
    category: "Kitchen",
    stock: 10,
    featured: true,
    tags: ["coffee", "ceramic", "pour-over", "kitchen"],
  },
  {
    id: "product-003",
    name: "Linen Throw Blanket",
    description: "Washed linen — light, breathable, and gets softer with every wash.",
    details:
      "100% French linen, pre-washed for softness. 130 × 170 cm. Tassel fringe edges. Available in oat, sage, and slate.",
    price: 7900,
    image: "https://images.unsplash.com/photo-1612437118756-e34ed62ee6d0?w=600&q=80",
    category: "Home",
    stock: 15,
    featured: false,
    tags: ["linen", "blanket", "home", "throw"],
  },
  {
    id: "product-004",
    name: "Soy Candle — Cedar & Smoke",
    description: "Hand-poured soy wax candle with a warm, woody scent.",
    details:
      "Made with 100% soy wax, cotton wick, and phthalate-free fragrance oil. 8 oz amber jar. Burn time ~50 hours.",
    price: 2200,
    image: "https://images.unsplash.com/photo-1603006905003-be475563bc59?w=600&q=80",
    category: "Home",
    stock: 40,
    featured: false,
    tags: ["candle", "soy", "cedar", "scent", "home"],
  },
  {
    id: "product-005",
    name: "Walnut Phone Stand",
    description: "Solid walnut desk stand — keeps your phone at the perfect angle.",
    details:
      "CNC-milled from American black walnut with a hand-applied oil finish. Compatible with all phone sizes. Weighted base stays put.",
    price: 3499,
    image: "https://images.unsplash.com/photo-1586936893354-362ad6ae47ba?w=600&q=80",
    category: "Accessories",
    stock: 18,
    featured: true,
    tags: ["walnut", "stand", "desk", "wood", "phone"],
  },
  {
    id: "product-006",
    name: "Glass Water Bottle",
    description: "Borosilicate glass bottle with silicone sleeve — 600ml.",
    details:
      "BPA-free borosilicate glass rated to 200°C. Non-slip silicone sleeve. Leakproof lid. Wide mouth for ice. Dishwasher safe.",
    price: 2499,
    image: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600&q=80",
    category: "Kitchen",
    stock: -1,
    featured: false,
    tags: ["glass", "bottle", "water", "kitchen", "eco"],
  },
];

// --- helpers used by store.js ---

function getCategories() {
  const cats = [...new Set(PRODUCTS.map((p) => p.category))];
  return ["All", ...cats];
}

function formatPrice(cents) {
  return STORE_CONFIG.currencySymbol + (cents / 100).toFixed(2);
}

function getProduct(id) {
  return PRODUCTS.find((p) => p.id === id) || null;
}

function isInStock(product) {
  return product.stock === -1 || product.stock > 0;
}
