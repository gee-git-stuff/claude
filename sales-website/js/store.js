/**
 * store.js — core store logic.
 * Loads config + products from the API and applies all design variables.
 * The page-renderer.js handles rendering blocks; this file handles
 * branding, the product modal, the cart badge, and the product section helpers.
 */

// ── CSS variable map ──────────────────────────────────────────
const CSS_VAR_MAP = {
  accentColor:       { v: "--accent" },
  accentDark:        { v: "--accent-dark" },
  accentLight:       { v: "--accent-light" },
  colorBg:           { v: "--bg" },
  colorSurface:      { v: "--surface" },
  colorSurface2:     { v: "--surface-2" },
  colorBorder:       { v: "--border" },
  colorText:         { v: "--text" },
  colorTextMuted:    { v: "--text-muted" },
  colorTextLight:    { v: "--text-light" },
  heroTextAlign:     { v: "--hero-text-align" },
  navBgOpacity:      { v: "--nav-bg-opacity" },
  borderRadius:      { v: "--radius",             u: "px" },
  borderRadiusSm:    { v: "--radius-sm",          u: "px" },
  borderWidth:       { v: "--border-width",       u: "px" },
  cardHoverLift:     { v: "--card-lift",          u: "px" },
  containerWidth:    { v: "--container-width",    u: "px" },
  heroPaddingTop:    { v: "--hero-padding-top",   u: "px" },
  heroPaddingBottom: { v: "--hero-padding-bottom",u: "px" },
  gridGap:           { v: "--grid-gap",           u: "px" },
  gridMinWidth:      { v: "--grid-min-width",     u: "px" },
  navBlur:           { v: "--nav-blur",           u: "px" },
  transitionSpeed:   { v: "--transition",         u: "s"  },
};

const SHADOWS = {
  none:   ["none",                              "none"],
  subtle: ["0 1px 6px rgba(0,0,0,.05)",         "0 4px 20px rgba(0,0,0,.08)"],
  medium: ["0 2px 16px rgba(0,0,0,.08)",        "0 8px 40px rgba(0,0,0,.14)"],
  strong: ["0 4px 28px rgba(0,0,0,.14)",        "0 14px 60px rgba(0,0,0,.22)"],
};

const GOOGLE_FONTS = new Set([
  "Inter","Poppins","Roboto","Open Sans","Lato","Montserrat","Raleway",
  "DM Sans","Outfit","Nunito","Plus Jakarta Sans",
  "Playfair Display","Merriweather","Libre Baskerville",
]);

// ── Data loading ──────────────────────────────────────────────
async function loadStoreData() {
  try {
    const [configRes, productsRes] = await Promise.all([
      fetch("/api/config"),
      fetch("/api/products"),
    ]);
    window.STORE_CONFIG = await configRes.json();
    window.PRODUCTS     = await productsRes.json();
  } catch (err) {
    console.error("Failed to load store data:", err);
    window.STORE_CONFIG = window.STORE_CONFIG || {};
    window.PRODUCTS     = window.PRODUCTS     || [];
  }
}

// ── Apply branding / design ───────────────────────────────────
function applyBranding(cfg) {
  cfg = cfg || window.STORE_CONFIG || {};
  const root = document.documentElement;

  Object.entries(CSS_VAR_MAP).forEach(([key, { v, u = "" }]) => {
    if (cfg[key] !== undefined && cfg[key] !== "") {
      root.style.setProperty(v, cfg[key] + u);
    }
  });

  const [sh, shLg] = SHADOWS[cfg.shadowIntensity] || SHADOWS.medium;
  root.style.setProperty("--shadow",    sh);
  root.style.setProperty("--shadow-lg", shLg);

  if (cfg.colorSurface || cfg.navBgOpacity) {
    const rgb = hexToRgb(cfg.colorSurface || "#ffffff");
    const op  = cfg.navBgOpacity || "0.85";
    root.style.setProperty("--nav-bg-opacity", op);
    root.style.setProperty("--nav-bg-rgb", `${rgb.r} ${rgb.g} ${rgb.b}`);
  }

  if (cfg.fontFamily) {
    loadGoogleFont(cfg.fontFamily);
    root.style.setProperty("--font", `'${cfg.fontFamily}', system-ui, -apple-system, sans-serif`);
  }

  applyBackground(cfg);

  // Store name and footer (not page-block content)
  const setText = (id, val) => { const el = document.getElementById(id); if (el && val) el.textContent = val; };
  setText("nav-store-name", cfg.name);

  if (cfg.name) {
    const titleEl = document.getElementById("page-title");
    if (titleEl) titleEl.textContent = cfg.name;
    const footerEl = document.getElementById("footer-text");
    if (footerEl)
      footerEl.innerHTML = `${escHtml(cfg.name)} &mdash; Payments secured by <a href="https://stripe.com" target="_blank" rel="noopener">Stripe</a>`;
  }
}

function applyBackground(cfg) {
  const b = document.body;
  const t = cfg.bgType || "color";

  if (t === "image" && cfg.bgImageUrl) {
    b.style.backgroundImage    = `url('${cfg.bgImageUrl}')`;
    b.style.backgroundSize     = cfg.bgImageSize     || "cover";
    b.style.backgroundPosition = cfg.bgImagePosition || "center";
    b.style.backgroundAttachment = "fixed";
    b.style.backgroundRepeat   = "no-repeat";
    b.style.backgroundColor    = "";
  } else if (t === "gradient" && cfg.bgGradientFrom && cfg.bgGradientTo) {
    const dir  = cfg.bgGradientDir || "to bottom";
    b.style.backgroundImage    = `linear-gradient(${dir}, ${cfg.bgGradientFrom}, ${cfg.bgGradientTo})`;
    b.style.backgroundSize     = "";
    b.style.backgroundAttachment = "";
    b.style.backgroundRepeat   = "";
    b.style.backgroundColor    = "";
  } else {
    b.style.backgroundImage    = "";
    b.style.backgroundSize     = "";
    b.style.backgroundAttachment = "";
    b.style.backgroundRepeat   = "";
    if (cfg.bgColor) b.style.backgroundColor = cfg.bgColor;
    else b.style.backgroundColor = "";
  }
}

function loadGoogleFont(fontFamily) {
  if (!GOOGLE_FONTS.has(fontFamily)) return;
  const id   = "gf-" + fontFamily.replace(/ /g, "-").toLowerCase();
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id   = id;
  link.rel  = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/ /g, "+")}:wght@400;500;600;700;800&display=swap`;
  document.head.appendChild(link);
}

function hexToRgb(hex) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? { r: parseInt(r[1],16), g: parseInt(r[2],16), b: parseInt(r[3],16) }
           : { r: 255, g: 255, b: 255 };
}

// ── Cart helpers ──────────────────────────────────────────────
const CART_KEY = "store_cart";

function cartLoad() {
  try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
  catch { return []; }
}
function cartSave(cart) { localStorage.setItem(CART_KEY, JSON.stringify(cart)); }

function cartAdd(productId, qty = 1) {
  const cart = cartLoad();
  const existing = cart.find((i) => i.id === productId);
  if (existing) existing.qty += qty;
  else cart.push({ id: productId, qty });
  cartSave(cart);
  updateCartBadge();
}

function cartItemCount() { return cartLoad().reduce((s, i) => s + i.qty, 0); }

function updateCartBadge() {
  document.querySelectorAll("#cart-count").forEach((b) => { b.textContent = cartItemCount(); });
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(message, type = "") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast${type ? " " + type : ""}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

// ── Product card ──────────────────────────────────────────────
function buildCard(product) {
  const inStock = isInStock(product);
  const card    = document.createElement("div");
  card.className = `product-card${product.featured ? " featured" : ""}`;
  card.setAttribute("role", "listitem");
  card.dataset.id = product.id;

  const imgContent = product.image && product.image.startsWith("http")
    ? `<img src="${escAttr(product.image)}" alt="${escAttr(product.name)}" loading="lazy">`
    : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:4rem;">${escHtml(product.image || "")}</div>`;

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

  card.addEventListener("click", (e) => { if (!e.target.closest(".btn-add")) openModal(product.id); });
  card.querySelector(".btn-add").addEventListener("click", (e) => {
    e.stopPropagation();
    cartAdd(product.id);
    showToast(`"${product.name}" added to cart`, "success");
  });
  return card;
}

// ── Product section — used by the product-grid block renderer ─
function initProductSection({ gridEl, filterEl, categoryFilter, limit, showSearch }) {
  if (!gridEl) return;
  const state = {
    activeCategory: categoryFilter && categoryFilter !== "all" ? categoryFilter : "All",
    search: "",
    limit: limit || 0,
  };

  function render() {
    gridEl.innerHTML = "";
    const q = state.search.toLowerCase();
    let filtered = (window.PRODUCTS || []).filter((p) => {
      const matchCat = state.activeCategory === "All" || p.category === state.activeCategory;
      const matchSearch = !q || p.name.toLowerCase().includes(q) ||
                         p.description.toLowerCase().includes(q) ||
                         (p.tags || []).some((t) => t.includes(q));
      return matchCat && matchSearch;
    });
    filtered.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
    if (state.limit > 0) filtered = filtered.slice(0, state.limit);

    if (filtered.length === 0) {
      gridEl.innerHTML = '<p class="no-results">No products found.</p>';
      return;
    }
    filtered.forEach((p) => gridEl.appendChild(buildCard(p)));
  }

  if (filterEl) {
    filterEl.innerHTML = "";
    getCategories().forEach((cat) => {
      const btn = document.createElement("button");
      btn.className = `filter-btn${cat === state.activeCategory ? " active" : ""}`;
      btn.textContent = cat;
      btn.addEventListener("click", () => {
        state.activeCategory = cat;
        filterEl.querySelectorAll(".filter-btn").forEach((b) => {
          b.classList.toggle("active", b.textContent === cat);
        });
        render();
      });
      filterEl.appendChild(btn);
    });
  }

  if (showSearch) {
    const input = document.getElementById("search-input");
    if (input) {
      let debounce;
      input.addEventListener("input", () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => { state.search = input.value.trim(); render(); }, 180);
      });
    }
  }

  render();
}

// ── Modal ─────────────────────────────────────────────────────
function openModal(productId) {
  const product = getProduct(productId);
  if (!product) return;
  const overlay = document.getElementById("modal-overlay");
  if (!overlay) return;

  const imgEl = document.getElementById("modal-img");
  if (imgEl) { imgEl.src = product.image && product.image.startsWith("http") ? product.image : ""; imgEl.alt = product.name; }
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set("modal-category", product.category);  set("modal-product-name", product.name);
  set("modal-details",  product.details);   set("modal-price", formatPrice(product.price));

  const stockEl = document.getElementById("modal-stock");
  const addBtn  = document.getElementById("modal-add-btn");
  if (!isInStock(product)) {
    stockEl.textContent = "Out of stock"; stockEl.className = "modal-stock out";
    addBtn.disabled = true; addBtn.textContent = "Sold Out";
  } else if (product.stock !== -1 && product.stock <= 5) {
    stockEl.textContent = `Only ${product.stock} left`; stockEl.className = "modal-stock low";
    addBtn.disabled = false; addBtn.textContent = "Add to Cart";
  } else {
    stockEl.textContent = product.stock === -1 ? "In stock" : `${product.stock} in stock`;
    stockEl.className = "modal-stock"; addBtn.disabled = false; addBtn.textContent = "Add to Cart";
  }
  addBtn.onclick = () => { cartAdd(productId); showToast(`"${product.name}" added to cart`, "success"); closeModal(); };
  overlay.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  const overlay = document.getElementById("modal-overlay");
  if (overlay) overlay.classList.remove("open");
  document.body.style.overflow = "";
}

// ── HTML escape ───────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  await loadStoreData();
  applyBranding();
  updateCartBadge();

  if (typeof renderCurrentPage === "function") {
    await renderCurrentPage();
  }

  const overlay  = document.getElementById("modal-overlay");
  const closeBtn = document.getElementById("modal-close");
  if (overlay)  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });
  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

  if (typeof initCartPage === "function") initCartPage();
});
