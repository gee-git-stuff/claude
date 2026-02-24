/**
 * store.js — core store logic
 * Handles: branding, product rendering, filtering, searching,
 *           the product modal, and the cart (via localStorage).
 */

// ── Cart helpers ──────────────────────────────────────────────
const CART_KEY = "store_cart";

function cartLoad() {
  try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
  catch { return []; }
}

function cartSave(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function cartAdd(productId, qty = 1) {
  const cart = cartLoad();
  const existing = cart.find((i) => i.id === productId);
  if (existing) {
    existing.qty += qty;
  } else {
    cart.push({ id: productId, qty });
  }
  cartSave(cart);
  updateCartBadge();
}

function cartItemCount() {
  return cartLoad().reduce((sum, i) => sum + i.qty, 0);
}

function updateCartBadge() {
  const badges = document.querySelectorAll("#cart-count");
  badges.forEach((b) => (b.textContent = cartItemCount()));
}

// ── Toast notifications ───────────────────────────────────────
function showToast(message, type = "") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast${type ? " " + type : ""}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

// ── Branding ──────────────────────────────────────────────────
function applyBranding() {
  // Apply accent color from STORE_CONFIG
  document.documentElement.style.setProperty("--accent", STORE_CONFIG.accentColor);
  document.documentElement.style.setProperty("--accent-dark", STORE_CONFIG.accentDark);

  // Lighten accent for light variant (rough approximation via opacity overlay)
  const el = document.getElementById("nav-store-name");
  if (el) el.textContent = STORE_CONFIG.name;

  const title = document.getElementById("page-title");
  if (title) title.textContent = STORE_CONFIG.name;

  const heroTitle = document.getElementById("hero-title");
  if (heroTitle) heroTitle.textContent = STORE_CONFIG.name;

  const heroTagline = document.getElementById("hero-tagline");
  if (heroTagline) heroTagline.textContent = STORE_CONFIG.tagline;

  const footerText = document.getElementById("footer-text");
  if (footerText)
    footerText.innerHTML = `${STORE_CONFIG.name} &mdash; Payments secured by <a href="https://stripe.com" target="_blank" rel="noopener">Stripe</a>`;
}

// ── Product card builder ──────────────────────────────────────
function buildCard(product) {
  const inStock = isInStock(product);
  const card = document.createElement("div");
  card.className = `product-card${product.featured ? " featured" : ""}`;
  card.setAttribute("role", "listitem");
  card.dataset.id = product.id;

  // Use emoji placeholder if no image URL provided
  const imgSrc = product.image.startsWith("http")
    ? product.image
    : "";
  const imgContent = imgSrc
    ? `<img src="${imgSrc}" alt="${escHtml(product.name)}" loading="lazy">`
    : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:4rem;">${product.image}</div>`;

  card.innerHTML = `
    <div class="card-image-wrap">
      ${imgContent}
      ${product.featured ? '<span class="featured-badge">Featured</span>' : ""}
      ${!inStock ? '<div class="out-of-stock-overlay">Out of Stock</div>' : ""}
    </div>
    <div class="card-body">
      <span class="card-category">${escHtml(product.category)}</span>
      <h3 class="card-name">${escHtml(product.name)}</h3>
      <p class="card-desc">${escHtml(product.description)}</p>
      <div class="card-footer">
        <span class="card-price">${formatPrice(product.price)}</span>
        <button class="btn-add" data-id="${product.id}" ${!inStock ? "disabled" : ""}>
          ${inStock ? "Add to Cart" : "Sold Out"}
        </button>
      </div>
    </div>
  `;

  // Click card body → open modal
  card.addEventListener("click", (e) => {
    if (!e.target.closest(".btn-add")) openModal(product.id);
  });

  // Add to cart button
  card.querySelector(".btn-add").addEventListener("click", (e) => {
    e.stopPropagation();
    cartAdd(product.id);
    showToast(`"${product.name}" added to cart`, "success");
  });

  return card;
}

// ── Filter & render products ──────────────────────────────────
let activeCategory = "All";
let searchQuery = "";

function renderProducts() {
  const grid = document.getElementById("product-grid");
  if (!grid) return;
  grid.innerHTML = "";

  let filtered = PRODUCTS.filter((p) => {
    const matchCat = activeCategory === "All" || p.category === activeCategory;
    const q = searchQuery.toLowerCase();
    const matchSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.tags.some((t) => t.includes(q));
    return matchCat && matchSearch;
  });

  // Featured first
  filtered.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));

  if (filtered.length === 0) {
    grid.innerHTML = '<p class="no-results">No products found.</p>';
    return;
  }

  filtered.forEach((p) => grid.appendChild(buildCard(p)));
}

function renderFilters() {
  const bar = document.getElementById("filter-bar");
  if (!bar) return;
  getCategories().forEach((cat) => {
    const btn = document.createElement("button");
    btn.className = `filter-btn${cat === activeCategory ? " active" : ""}`;
    btn.textContent = cat;
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", cat === activeCategory);
    btn.addEventListener("click", () => {
      activeCategory = cat;
      document.querySelectorAll(".filter-btn").forEach((b) => {
        b.classList.toggle("active", b.textContent === cat);
        b.setAttribute("aria-selected", b.textContent === cat);
      });
      renderProducts();
    });
    bar.appendChild(btn);
  });
}

// ── Product modal ─────────────────────────────────────────────
function openModal(productId) {
  const product = getProduct(productId);
  if (!product) return;
  const overlay = document.getElementById("modal-overlay");

  document.getElementById("modal-img").src = product.image.startsWith("http") ? product.image : "";
  document.getElementById("modal-img").alt = product.name;
  document.getElementById("modal-category").textContent = product.category;
  document.getElementById("modal-product-name").textContent = product.name;
  document.getElementById("modal-details").textContent = product.details;
  document.getElementById("modal-price").textContent = formatPrice(product.price);

  const stockEl = document.getElementById("modal-stock");
  const addBtn = document.getElementById("modal-add-btn");

  if (!isInStock(product)) {
    stockEl.textContent = "Out of stock";
    stockEl.className = "modal-stock out";
    addBtn.disabled = true;
    addBtn.textContent = "Sold Out";
  } else if (product.stock !== -1 && product.stock <= 5) {
    stockEl.textContent = `Only ${product.stock} left`;
    stockEl.className = "modal-stock low";
    addBtn.disabled = false;
    addBtn.textContent = "Add to Cart";
  } else {
    stockEl.textContent = product.stock === -1 ? "In stock" : `${product.stock} in stock`;
    stockEl.className = "modal-stock";
    addBtn.disabled = false;
    addBtn.textContent = "Add to Cart";
  }

  addBtn.onclick = () => {
    cartAdd(productId);
    showToast(`"${product.name}" added to cart`, "success");
    closeModal();
  };

  overlay.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  const overlay = document.getElementById("modal-overlay");
  if (overlay) overlay.classList.remove("open");
  document.body.style.overflow = "";
}

// ── Search ────────────────────────────────────────────────────
function initSearch() {
  const input = document.getElementById("search-input");
  if (!input) return;
  let debounce;
  input.addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      searchQuery = input.value.trim();
      renderProducts();
    }, 180);
  });
}

// ── Escape HTML helper ────────────────────────────────────────
function escHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  applyBranding();
  updateCartBadge();

  // Store page
  if (document.getElementById("product-grid")) {
    renderFilters();
    renderProducts();
    initSearch();
  }

  // Modal close handlers
  const overlay = document.getElementById("modal-overlay");
  const closeBtn = document.getElementById("modal-close");
  if (overlay) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal();
    });
  }
  if (closeBtn) closeBtn.addEventListener("click", closeModal);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
});
