/**
 * inventory.js — shared utility functions for the store frontend.
 *
 * Product data now lives in data/products.json on the server and is loaded
 * via the API. window.PRODUCTS and window.STORE_CONFIG are populated by
 * store.js after it fetches /api/products and /api/config.
 *
 * To edit inventory without the admin panel, you can also edit
 * data/products.json directly — it's plain JSON.
 */

function formatPrice(cents) {
  const symbol = (window.STORE_CONFIG && window.STORE_CONFIG.currencySymbol) || "$";
  return symbol + (cents / 100).toFixed(2);
}

function isInStock(product) {
  return product.stock === -1 || product.stock > 0;
}

function getProduct(id) {
  return (window.PRODUCTS || []).find((p) => p.id === id) || null;
}

function getCategories() {
  const cats = [...new Set((window.PRODUCTS || []).map((p) => p.category))];
  return ["All", ...cats];
}
