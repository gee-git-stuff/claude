/**
 * admin.js — admin panel logic.
 * Handles auth, product CRUD, design settings, and live design preview.
 */

const TOKEN_KEY = "admin_token";

// ── Auth ──────────────────────────────────────────────────────
function getToken()    { return sessionStorage.getItem(TOKEN_KEY); }
function setToken(t)   { sessionStorage.setItem(TOKEN_KEY, t); }
function clearToken()  { sessionStorage.removeItem(TOKEN_KEY); }
function authHdrs()    { return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` }; }

// ── Toast ─────────────────────────────────────────────────────
function showToast(message, type = "") {
  const c = document.getElementById("toast-container");
  if (!c) return;
  const t = document.createElement("div");
  t.className = `toast${type ? " " + type : ""}`;
  t.textContent = message;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

// ── Screens ───────────────────────────────────────────────────
function showAdmin() {
  document.getElementById("login-screen").classList.add("hidden");
  document.getElementById("admin-panel").classList.remove("hidden");
}
function showLogin() {
  document.getElementById("login-screen").classList.remove("hidden");
  document.getElementById("admin-panel").classList.add("hidden");
}

// ── Tabs ──────────────────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll(".admin-tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  document.querySelectorAll(".admin-tab-content").forEach((p) => {
    p.classList.toggle("active", p.id === `tab-${name}`);
    p.classList.toggle("hidden", p.id !== `tab-${name}`);
  });
}

// ── State ─────────────────────────────────────────────────────
let products  = [];
let config    = {};
let editingId = null;

// ── API ───────────────────────────────────────────────────────
async function apiFetch(url, opts = {}) {
  const res = await fetch(url, { ...opts, headers: { ...(opts.headers || {}), ...authHdrs() } });
  if (res.status === 401) { logout(); return null; }
  return res;
}

// ── Load data ─────────────────────────────────────────────────
async function loadProducts() {
  const res = await apiFetch("/api/admin/products");
  if (!res) return;
  products = await res.json();
  renderProductsTable();
}

async function loadConfig() {
  const res = await fetch("/api/config");
  config = await res.json();
  populateDesignForm();
  applyDesignPreview();
}

// ── Products table ────────────────────────────────────────────
function renderProductsTable() {
  const tbody = document.getElementById("products-tbody");
  const empty = document.getElementById("products-empty");
  const label = document.getElementById("product-count-label");
  label.textContent = `${products.length} product${products.length !== 1 ? "s" : ""}`;

  if (products.length === 0) { tbody.innerHTML = ""; empty.classList.remove("hidden"); return; }
  empty.classList.add("hidden");

  tbody.innerHTML = products.map((p) => `
    <tr data-id="${p.id}">
      <td>${p.image && p.image.startsWith("http")
          ? `<img class="table-thumb" src="${esc(p.image)}" alt="">`
          : `<div class="table-thumb table-thumb-empty">${esc(p.image || "")}</div>`}</td>
      <td><div class="table-name">${esc(p.name)}</div><div class="table-desc">${esc(p.description)}</div></td>
      <td><span class="table-category">${esc(p.category)}</span></td>
      <td class="table-price">${fmtPrice(p.price, config.currencySymbol)}</td>
      <td>${p.stock === -1 ? '<span class="stock-badge unlimited">∞</span>'
          : p.stock === 0  ? '<span class="stock-badge out">0</span>'
          : p.stock <= 5   ? `<span class="stock-badge low">${p.stock}</span>`
                           : `<span class="stock-badge ok">${p.stock}</span>`}</td>
      <td>${p.featured ? '<span class="featured-dot" title="Featured">★</span>' : ""}</td>
      <td class="table-actions">
        <button class="btn-table-edit" data-id="${p.id}">Edit</button>
        <button class="btn-table-delete" data-id="${p.id}">Delete</button>
      </td>
    </tr>
  `).join("");

  tbody.querySelectorAll(".btn-table-edit").forEach((b) => b.addEventListener("click", () => openProductModal(b.dataset.id)));
  tbody.querySelectorAll(".btn-table-delete").forEach((b) => b.addEventListener("click", () => deleteProduct(b.dataset.id)));
}

function fmtPrice(cents, sym = "$") { return sym + (cents / 100).toFixed(2); }

// ── Product modal ─────────────────────────────────────────────
function openProductModal(productId = null) {
  editingId = productId;
  const errEl = document.getElementById("product-form-error");
  document.getElementById("product-form").reset();
  errEl.classList.add("hidden");

  const dl = document.getElementById("category-list");
  dl.innerHTML = [...new Set(products.map((p) => p.category))].map((c) => `<option value="${esc(c)}">`).join("");
  document.getElementById("pf-currency-symbol").textContent = config.currencySymbol || "$";

  if (productId) {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    document.getElementById("product-modal-title").textContent  = "Edit Product";
    document.getElementById("product-id").value       = p.id;
    document.getElementById("pf-name").value           = p.name;
    document.getElementById("pf-category").value       = p.category;
    document.getElementById("pf-description").value    = p.description;
    document.getElementById("pf-details").value        = p.details || "";
    document.getElementById("pf-price").value          = (p.price / 100).toFixed(2);
    document.getElementById("pf-stock").value          = p.stock === -1 ? "" : p.stock;
    document.getElementById("pf-unlimited").checked   = p.stock === -1;
    document.getElementById("pf-stock").disabled      = p.stock === -1;
    document.getElementById("pf-image").value          = p.image || "";
    document.getElementById("pf-tags").value           = (p.tags || []).join(", ");
    document.getElementById("pf-featured").checked    = p.featured;
    updateImagePreview(p.image || "");
  } else {
    document.getElementById("product-modal-title").textContent = "Add Product";
    document.getElementById("product-id").value = "";
    updateImagePreview("");
  }

  document.getElementById("product-modal-overlay").classList.add("open");
  document.body.style.overflow = "hidden";
  document.getElementById("pf-name").focus();
}

function closeProductModal() {
  document.getElementById("product-modal-overlay").classList.remove("open");
  document.body.style.overflow = "";
  editingId = null;
}

function updateImagePreview(url) {
  const img = document.getElementById("pf-image-preview");
  if (url && url.startsWith("http")) { img.src = url; img.classList.remove("hidden"); }
  else { img.classList.add("hidden"); img.src = ""; }
}

async function saveProduct(e) {
  e.preventDefault();
  const errEl = document.getElementById("product-form-error");
  const btn   = document.getElementById("save-product-btn");
  errEl.classList.add("hidden");

  const unlimited = document.getElementById("pf-unlimited").checked;
  const priceVal  = parseFloat(document.getElementById("pf-price").value);
  if (!document.getElementById("pf-name").value.trim()) return showFieldError(errEl, "Product name is required.");
  if (isNaN(priceVal) || priceVal <= 0) return showFieldError(errEl, "A valid price is required.");

  const body = {
    name: document.getElementById("pf-name").value.trim(),
    category: document.getElementById("pf-category").value.trim(),
    description: document.getElementById("pf-description").value.trim(),
    details: document.getElementById("pf-details").value.trim(),
    price: priceVal,
    stock: unlimited ? -1 : parseInt(document.getElementById("pf-stock").value, 10) || 0,
    unlimitedStock: unlimited,
    image: document.getElementById("pf-image").value.trim(),
    tags: document.getElementById("pf-tags").value,
    featured: document.getElementById("pf-featured").checked,
  };

  btn.disabled = true; btn.textContent = "Saving…";
  const isEdit = Boolean(editingId);
  const res = await apiFetch(isEdit ? `/api/admin/products/${editingId}` : "/api/admin/products",
    { method: isEdit ? "PUT" : "POST", body: JSON.stringify(body) });
  btn.disabled = false; btn.textContent = "Save Product";
  if (!res) return;
  if (!res.ok) { const d = await res.json(); return showFieldError(errEl, d.error || "Save failed."); }
  await loadProducts();
  closeProductModal();
  showToast(isEdit ? "Product updated." : "Product added.", "success");
}

function showFieldError(el, msg) { el.textContent = msg; el.classList.remove("hidden"); }

async function deleteProduct(productId) {
  const p = products.find((x) => x.id === productId);
  if (!p || !confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
  const res = await apiFetch(`/api/admin/products/${productId}`, { method: "DELETE" });
  if (!res || !res.ok) { showToast("Delete failed.", "error"); return; }
  await loadProducts();
  showToast(`"${p.name}" deleted.`);
}

// ══════════════════════════════════════════════════════════════
//  DESIGN SETTINGS
// ══════════════════════════════════════════════════════════════

// Maps field id → config key for simple text/color inputs
const FIELD_MAP = {
  "cfg-name":          "name",
  "cfg-tagline":       "tagline",
  "cfg-eyebrow":       "heroEyebrow",
  "cfg-currency":      "currencySymbol",
  "cfg-accent":        "accentColor",
  "cfg-accent-dark":   "accentDark",
  "cfg-accent-light":  "accentLight",
  "cfg-bg":            "colorBg",
  "cfg-surface":       "colorSurface",
  "cfg-surface2":      "colorSurface2",
  "cfg-border":        "colorBorder",
  "cfg-text":          "colorText",
  "cfg-text-muted":    "colorTextMuted",
  "cfg-text-light":    "colorTextLight",
  "cfg-bg-color":      "bgColor",
  "cfg-bg-image":      "bgImageUrl",
  "cfg-bg-grad-from":  "bgGradientFrom",
  "cfg-bg-grad-to":    "bgGradientTo",
};

// Color picker pairs: [picker id, hex id]
const COLOR_PAIRS = [
  ["cfg-accent-picker",        "cfg-accent"],
  ["cfg-accent-dark-picker",   "cfg-accent-dark"],
  ["cfg-accent-light-picker",  "cfg-accent-light"],
  ["cfg-bg-picker",            "cfg-bg"],
  ["cfg-surface-picker",       "cfg-surface"],
  ["cfg-surface2-picker",      "cfg-surface2"],
  ["cfg-border-picker",        "cfg-border"],
  ["cfg-text-picker",          "cfg-text"],
  ["cfg-text-muted-picker",    "cfg-text-muted"],
  ["cfg-text-light-picker",    "cfg-text-light"],
  ["cfg-bg-color-picker",      "cfg-bg-color"],
  ["cfg-bg-grad-from-picker",  "cfg-bg-grad-from"],
  ["cfg-bg-grad-to-picker",    "cfg-bg-grad-to"],
];

// Slider definitions: [slider id, value display id, unit, config key]
const SLIDERS = [
  ["cfg-container-width",  "cfg-container-width-val",  "px", "containerWidth"],
  ["cfg-hero-pad-top",     "cfg-hero-pad-top-val",     "px", "heroPaddingTop"],
  ["cfg-hero-pad-bottom",  "cfg-hero-pad-bottom-val",  "px", "heroPaddingBottom"],
  ["cfg-grid-gap",         "cfg-grid-gap-val",         "px", "gridGap"],
  ["cfg-grid-min",         "cfg-grid-min-val",         "px", "gridMinWidth"],
  ["cfg-radius",           "cfg-radius-val",           "px", "borderRadius"],
  ["cfg-radius-sm",        "cfg-radius-sm-val",        "px", "borderRadiusSm"],
  ["cfg-border-width",     "cfg-border-width-val",     "px", "borderWidth"],
  ["cfg-card-lift",        "cfg-card-lift-val",        "px", "cardHoverLift"],
  ["cfg-nav-opacity",      "cfg-nav-opacity-val",      "",   "navBgOpacity"],
  ["cfg-nav-blur",         "cfg-nav-blur-val",         "px", "navBlur"],
  ["cfg-transition",       "cfg-transition-val",       "s",  "transitionSpeed"],
];

// ── Populate form from config ─────────────────────────────────
function populateDesignForm() {
  // Text/color hex inputs
  Object.entries(FIELD_MAP).forEach(([fieldId, cfgKey]) => {
    const el = document.getElementById(fieldId);
    if (el && config[cfgKey] !== undefined) el.value = config[cfgKey];
  });

  // Sync color pickers to hex inputs
  COLOR_PAIRS.forEach(([pickerId, hexId]) => {
    const picker = document.getElementById(pickerId);
    const hex    = document.getElementById(hexId);
    if (picker && hex && /^#[0-9a-fA-F]{6}$/.test(hex.value)) picker.value = hex.value;
  });

  // Sliders
  SLIDERS.forEach(([sliderId, valId, unit, cfgKey]) => {
    const slider = document.getElementById(sliderId);
    const disp   = document.getElementById(valId);
    if (slider && config[cfgKey] !== undefined) {
      slider.value = config[cfgKey];
      if (disp) disp.textContent = config[cfgKey] + unit;
    }
  });

  // Background type toggle
  const bgType = config.bgType || "color";
  setToggleGroup("bg-type-group", bgType);
  syncBgFields(bgType);

  // Hero text align
  setToggleGroup("hero-align-group", config.heroTextAlign || "center");

  // Shadow picker
  setShadowPicker(config.shadowIntensity || "medium");

  // Font
  const fontSel = document.getElementById("cfg-font");
  if (fontSel && config.fontFamily) fontSel.value = config.fontFamily;
  updateFontPreview(config.fontFamily || "Inter");

  // BG selects
  const bgSize = document.getElementById("cfg-bg-size");
  const bgPos  = document.getElementById("cfg-bg-pos");
  const bgDir  = document.getElementById("cfg-bg-gradient-dir");
  if (bgSize && config.bgImageSize)   bgSize.value = config.bgImageSize;
  if (bgPos  && config.bgImagePosition) bgPos.value = config.bgImagePosition;
  if (bgDir  && config.bgGradientDir) bgDir.value = config.bgGradientDir;

  // BG image preview
  updateBgImagePreview(config.bgImageUrl || "");

  // Gradient swatch
  updateGradientSwatch();

  // Store name in header
  if (config.name) document.getElementById("admin-store-name").textContent = config.name;
}

// ── Read form into a config-shaped object ─────────────────────
function readDesignForm() {
  const out = {};

  Object.entries(FIELD_MAP).forEach(([fieldId, cfgKey]) => {
    const el = document.getElementById(fieldId);
    if (el) out[cfgKey] = el.value;
  });

  SLIDERS.forEach(([sliderId, , , cfgKey]) => {
    const sl = document.getElementById(sliderId);
    if (sl) out[cfgKey] = sl.value;
  });

  out.heroTextAlign   = getToggleGroup("hero-align-group") || "center";
  out.bgType          = getToggleGroup("bg-type-group")    || "color";
  out.shadowIntensity = getShadowPicker();
  out.fontFamily      = (document.getElementById("cfg-font") || {}).value || "Inter";

  const bgSize = document.getElementById("cfg-bg-size");
  const bgPos  = document.getElementById("cfg-bg-pos");
  const bgDir  = document.getElementById("cfg-bg-gradient-dir");
  if (bgSize) out.bgImageSize     = bgSize.value;
  if (bgPos)  out.bgImagePosition = bgPos.value;
  if (bgDir)  out.bgGradientDir   = bgDir.value;

  return out;
}

// ── Apply design preview to the admin page (live) ─────────────
function applyDesignPreview() {
  const cfg  = readDesignForm();
  const root = document.documentElement;

  const CSS_VARS_ADM = {
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
    none:   ["none", "none"],
    subtle: ["0 1px 6px rgba(0,0,0,.05)", "0 4px 20px rgba(0,0,0,.08)"],
    medium: ["0 2px 16px rgba(0,0,0,.08)", "0 8px 40px rgba(0,0,0,.14)"],
    strong: ["0 4px 28px rgba(0,0,0,.14)", "0 14px 60px rgba(0,0,0,.22)"],
  };

  Object.entries(CSS_VARS_ADM).forEach(([key, { v, u = "" }]) => {
    if (cfg[key] !== undefined && cfg[key] !== "") root.style.setProperty(v, cfg[key] + u);
  });
  const [sh, shLg] = SHADOWS[cfg.shadowIntensity] || SHADOWS.medium;
  root.style.setProperty("--shadow",    sh);
  root.style.setProperty("--shadow-lg", shLg);

  // Nav bg-rgb for rgba()
  if (cfg.colorSurface) {
    const rgb = hexToRgbParts(cfg.colorSurface);
    if (rgb) root.style.setProperty("--nav-bg-rgb", rgb);
  }

  // Font
  if (cfg.fontFamily) {
    loadAdminFont(cfg.fontFamily);
    root.style.setProperty("--font", `'${cfg.fontFamily}', system-ui, -apple-system, sans-serif`);
  }

  // Apply background to the preview viewport only
  applyPreviewBg(cfg);

  // Update preview text
  const setText = (id, val) => { const el = document.getElementById(id); if (el && val) el.textContent = val; };
  setText("pv-store-name", cfg.name);
  setText("pv-title",      cfg.name);
  setText("pv-tagline",    cfg.tagline);
  setText("pv-eyebrow",    cfg.heroEyebrow);
}

function applyPreviewBg(cfg) {
  const vp = document.getElementById("preview-viewport");
  if (!vp) return;
  const t = cfg.bgType || "color";
  if (t === "image" && cfg.bgImageUrl) {
    vp.style.backgroundImage    = `url('${cfg.bgImageUrl}')`;
    vp.style.backgroundSize     = cfg.bgImageSize || "cover";
    vp.style.backgroundPosition = cfg.bgImagePosition || "center";
    vp.style.backgroundColor    = "";
  } else if (t === "gradient" && cfg.bgGradientFrom && cfg.bgGradientTo) {
    vp.style.backgroundImage = `linear-gradient(${cfg.bgGradientDir || "to bottom"}, ${cfg.bgGradientFrom}, ${cfg.bgGradientTo})`;
    vp.style.backgroundColor = "";
  } else {
    vp.style.backgroundImage = "";
    vp.style.backgroundColor = cfg.bgColor || "";
  }
}

// ── Background type helpers ───────────────────────────────────
function syncBgFields(type) {
  ["color", "image", "gradient"].forEach((t) => {
    const el = document.getElementById(`bg-${t}-fields`);
    if (el) el.classList.toggle("hidden", t !== type);
  });
}

function updateBgImagePreview(url) {
  const img = document.getElementById("cfg-bg-image-preview");
  if (!img) return;
  if (url && url.startsWith("http")) { img.src = url; img.classList.remove("hidden"); }
  else { img.classList.add("hidden"); img.src = ""; }
}

function updateGradientSwatch() {
  const swatch = document.getElementById("gradient-swatch");
  if (!swatch) return;
  const from = document.getElementById("cfg-bg-grad-from");
  const to   = document.getElementById("cfg-bg-grad-to");
  const dir  = document.getElementById("cfg-bg-gradient-dir");
  if (from && to) {
    swatch.style.background = `linear-gradient(${dir ? dir.value : "to bottom"}, ${from.value || "#6c63ff"}, ${to.value || "#a78bfa"})`;
  }
}

// ── Toggle groups ─────────────────────────────────────────────
function setToggleGroup(groupId, value) {
  const group = document.getElementById(groupId);
  if (!group) return;
  group.querySelectorAll(".toggle-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.val === value);
  });
}

function getToggleGroup(groupId) {
  const group = document.getElementById(groupId);
  if (!group) return null;
  const active = group.querySelector(".toggle-btn.active");
  return active ? active.dataset.val : null;
}

// ── Shadow picker ─────────────────────────────────────────────
function setShadowPicker(value) {
  document.querySelectorAll(".shadow-opt").forEach((b) => {
    b.classList.toggle("active", b.dataset.val === value);
  });
}

function getShadowPicker() {
  const active = document.querySelector(".shadow-opt.active");
  return active ? active.dataset.val : "medium";
}

// ── Font preview ──────────────────────────────────────────────
const GOOGLE_FONTS_ADM = new Set([
  "Inter","Poppins","Roboto","Open Sans","Lato","Montserrat","Raleway",
  "DM Sans","Outfit","Nunito","Plus Jakarta Sans",
  "Playfair Display","Merriweather","Libre Baskerville",
]);

function loadAdminFont(fontFamily) {
  if (!GOOGLE_FONTS_ADM.has(fontFamily)) return;
  const id = "gf-adm-" + fontFamily.replace(/ /g, "-").toLowerCase();
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id; link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/ /g, "+")}:wght@400;600;700;800&display=swap`;
  document.head.appendChild(link);
}

function updateFontPreview(fontFamily) {
  const preview = document.getElementById("font-preview");
  if (!preview) return;
  loadAdminFont(fontFamily);
  preview.style.fontFamily = `'${fontFamily}', system-ui, sans-serif`;
}

// ── Helpers ───────────────────────────────────────────────────
function hexToRgbParts(hex) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? `${parseInt(r[1],16)} ${parseInt(r[2],16)} ${parseInt(r[3],16)}` : null;
}

function esc(str) {
  return String(str || "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ── Save design ───────────────────────────────────────────────
async function saveDesign() {
  const btn = document.getElementById("save-design-btn");
  btn.disabled = true; btn.textContent = "Saving…";

  const body = readDesignForm();
  const res  = await apiFetch("/api/admin/config", { method: "PUT", body: JSON.stringify(body) });
  btn.disabled = false; btn.textContent = "Save Changes";

  if (!res || !res.ok) { showToast("Save failed.", "error"); return; }
  config = await res.json();
  document.getElementById("admin-store-name").textContent = config.name || "My Store";
  showToast("Design saved.", "success");
}

// ── Accordion ─────────────────────────────────────────────────
function initAccordions() {
  document.querySelectorAll(".ds-header").forEach((header) => {
    const section = header.closest(".ds");
    const body    = section.querySelector(".ds-body");

    // Set initial height for already-open sections
    if (section.classList.contains("open")) {
      body.style.height = "auto";
    } else {
      body.style.height = "0";
    }

    header.addEventListener("click", () => {
      const isOpen = section.classList.contains("open");
      if (isOpen) {
        body.style.height = body.scrollHeight + "px";
        requestAnimationFrame(() => {
          body.style.height = "0";
          section.classList.remove("open");
        });
      } else {
        section.classList.add("open");
        body.style.height = body.scrollHeight + "px";
        body.addEventListener("transitionend", () => {
          if (section.classList.contains("open")) body.style.height = "auto";
        }, { once: true });
      }
    });
  });
}

// ── Auth ──────────────────────────────────────────────────────
async function login(e) {
  e.preventDefault();
  const password = document.getElementById("password-input").value;
  const errEl = document.getElementById("login-error");
  const btn   = document.getElementById("login-btn");
  errEl.classList.add("hidden");
  btn.disabled = true; btn.textContent = "Logging in…";
  try {
    const res  = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");
    setToken(data.token);
    await initAdmin();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove("hidden");
  } finally {
    btn.disabled = false; btn.textContent = "Log In";
  }
}

async function logout() {
  if (getToken()) await fetch("/api/admin/logout", { method: "POST", headers: authHdrs() }).catch(() => {});
  clearToken();
  showLogin();
}

// ── Init ──────────────────────────────────────────────────────
async function initAdmin() {
  await Promise.all([loadProducts(), loadConfig()]);
  document.getElementById("admin-store-name").textContent = config.name || "My Store";
  showAdmin();
  initAccordions();
}

// ── Wire up events ────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // Auth
  document.getElementById("login-form").addEventListener("submit", login);
  document.getElementById("logout-btn").addEventListener("click", logout);

  // Tabs
  document.querySelectorAll(".admin-tab").forEach((b) => b.addEventListener("click", () => switchTab(b.dataset.tab)));

  // Product modal
  document.getElementById("add-product-btn").addEventListener("click", () => openProductModal(null));
  document.getElementById("product-modal-close").addEventListener("click", closeProductModal);
  document.getElementById("cancel-product-btn").addEventListener("click", closeProductModal);
  document.getElementById("product-modal-overlay").addEventListener("click", (e) => { if (e.target === document.getElementById("product-modal-overlay")) closeProductModal(); });
  document.getElementById("product-form").addEventListener("submit", saveProduct);
  document.getElementById("pf-image").addEventListener("input", (e) => updateImagePreview(e.target.value));
  document.getElementById("pf-unlimited").addEventListener("change", (e) => { document.getElementById("pf-stock").disabled = e.target.checked; });

  // Design: save
  document.getElementById("save-design-btn").addEventListener("click", saveDesign);

  // Design: color picker ↔ hex sync
  COLOR_PAIRS.forEach(([pickerId, hexId]) => {
    const picker = document.getElementById(pickerId);
    const hex    = document.getElementById(hexId);
    if (!picker || !hex) return;
    picker.addEventListener("input", () => {
      hex.value = picker.value;
      applyDesignPreview();
    });
    hex.addEventListener("input", () => {
      if (/^#[0-9a-fA-F]{6}$/.test(hex.value)) { picker.value = hex.value; applyDesignPreview(); }
    });
  });

  // Design: sliders
  SLIDERS.forEach(([sliderId, valId, unit]) => {
    const slider = document.getElementById(sliderId);
    const disp   = document.getElementById(valId);
    if (!slider) return;
    slider.addEventListener("input", () => {
      if (disp) disp.textContent = slider.value + unit;
      applyDesignPreview();
    });
  });

  // Design: text inputs
  ["cfg-name","cfg-tagline","cfg-eyebrow","cfg-currency"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", () => applyDesignPreview());
  });

  // Background type toggle
  document.getElementById("bg-type-group")?.querySelectorAll(".toggle-btn").forEach((b) => {
    b.addEventListener("click", () => {
      setToggleGroup("bg-type-group", b.dataset.val);
      syncBgFields(b.dataset.val);
      applyDesignPreview();
    });
  });

  // Background image URL
  document.getElementById("cfg-bg-image")?.addEventListener("input", (e) => {
    updateBgImagePreview(e.target.value);
    applyDesignPreview();
  });

  // BG selects
  ["cfg-bg-size","cfg-bg-pos","cfg-bg-gradient-dir"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", () => {
      updateGradientSwatch();
      applyDesignPreview();
    });
  });

  // Gradient colors
  ["cfg-bg-grad-from","cfg-bg-grad-to"].forEach((id) => {
    const hex    = document.getElementById(id);
    const picker = document.getElementById(id + "-picker");
    if (!hex) return;
    hex.addEventListener("input", () => { updateGradientSwatch(); applyDesignPreview(); });
    if (picker) picker.addEventListener("input", () => { hex.value = picker.value; updateGradientSwatch(); applyDesignPreview(); });
  });

  // Hero align toggle
  document.getElementById("hero-align-group")?.querySelectorAll(".toggle-btn").forEach((b) => {
    b.addEventListener("click", () => { setToggleGroup("hero-align-group", b.dataset.val); applyDesignPreview(); });
  });

  // Shadow picker
  document.querySelectorAll(".shadow-opt").forEach((b) => {
    b.addEventListener("click", () => { setShadowPicker(b.dataset.val); applyDesignPreview(); });
  });

  // Font selector
  const fontSel = document.getElementById("cfg-font");
  if (fontSel) fontSel.addEventListener("change", () => { updateFontPreview(fontSel.value); applyDesignPreview(); });

  // Keyboard
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeProductModal(); });

  // Check existing session
  if (getToken()) {
    initAdmin().catch(() => { clearToken(); showLogin(); });
  } else {
    showLogin();
  }
});
