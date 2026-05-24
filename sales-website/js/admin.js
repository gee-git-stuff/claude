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

  // Push to the live preview iframe (if present)
  if (typeof sendPreviewUpdate === "function") sendPreviewUpdate();
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
  const cfgRes  = await apiFetch("/api/admin/config", { method: "PUT", body: JSON.stringify(body) });
  if (!cfgRes || !cfgRes.ok) { showToast("Config save failed.", "error"); btn.disabled = false; btn.textContent = "Save Changes"; return; }
  config = await cfgRes.json();

  const pagesOk = await savePages();
  btn.disabled = false; btn.textContent = "Save Changes";
  if (!pagesOk) return;

  document.getElementById("admin-store-name").textContent = config.name || "My Store";
  showToast("All changes saved.", "success");
}

function escAttr(s) {
  return String(s == null ? "" : s)
    .replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
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

// ══════════════════════════════════════════════════════════════
//  PAGES & BLOCKS — multi-page builder
// ══════════════════════════════════════════════════════════════

const FONT_OPTIONS = [
  "Inter","Poppins","DM Sans","Outfit","Nunito","Plus Jakarta Sans",
  "Raleway","Montserrat","Roboto","Open Sans","Lato",
  "Playfair Display","Merriweather","Libre Baskerville",
];

let pendingPages   = [];
let currentPageId  = null;
let editingBlockId = null;

async function loadPages() {
  const res = await apiFetch("/api/admin/pages");
  if (!res) return;
  const data = await res.json();
  pendingPages = data.pages || [];
  if (!currentPageId && pendingPages.length) currentPageId = pendingPages[0].id;
  renderPageSelector();
  populatePageEditor();
}

function currentPage() {
  return pendingPages.find((p) => p.id === currentPageId);
}

function renderPageSelector() {
  const sel = document.getElementById("page-selector");
  if (!sel) return;
  sel.innerHTML = pendingPages.map((p) =>
    `<option value="${p.id}"${p.id === currentPageId ? " selected" : ""}>${esc(p.name)}${p.isHome ? " (Home)" : ""}</option>`
  ).join("");
}

function selectPage(id) {
  currentPageId  = id;
  editingBlockId = null;
  renderPageSelector();
  populatePageEditor();
  sendPreviewUpdate(true);
}

function addPage() {
  const name = prompt("Page name:", "New Page");
  if (!name) return;
  const slug = slugify(name);
  if (pendingPages.find((p) => p.slug === slug)) {
    showToast(`A page with slug "${slug}" already exists.`, "error");
    return;
  }
  const page = {
    id: "page-" + Date.now(),
    name, slug, isHome: false,
    showInNav: true, navLabel: name,
    background: { inherit: true },
    blocks: [],
  };
  pendingPages.push(page);
  currentPageId = page.id;
  renderPageSelector();
  populatePageEditor();
  showToast(`Page "${name}" added. Save to publish.`, "success");
}

function deletePage() {
  const p = currentPage();
  if (!p) return;
  if (pendingPages.length <= 1) return showToast("Can't delete the only page.", "error");
  if (p.isHome) return showToast("Set another page as home before deleting.", "error");
  if (!confirm(`Delete page "${p.name}"? This cannot be undone after save.`)) return;
  pendingPages = pendingPages.filter((x) => x.id !== p.id);
  currentPageId = pendingPages[0].id;
  renderPageSelector();
  populatePageEditor();
}

function duplicatePage() {
  const p = currentPage();
  if (!p) return;
  const copy = JSON.parse(JSON.stringify(p));
  copy.id     = "page-" + Date.now();
  copy.name   = p.name + " Copy";
  copy.slug   = slugify(copy.name);
  copy.isHome = false;
  copy.blocks = copy.blocks.map((b) => ({ ...b, id: "block-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6) }));
  pendingPages.push(copy);
  currentPageId = copy.id;
  renderPageSelector();
  populatePageEditor();
}

function slugify(s) {
  return String(s).toLowerCase().trim()
    .replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
}

// ── Page settings form ────────────────────────────────────────
function populatePageEditor() {
  const p = currentPage();
  if (!p) return;
  document.getElementById("pg-name").value      = p.name;
  document.getElementById("pg-slug").value      = p.slug;
  document.getElementById("pg-nav-label").value = p.navLabel || p.name;
  document.getElementById("pg-show-in-nav").checked = p.showInNav !== false;
  document.getElementById("pg-is-home").checked     = !!p.isHome;
  populatePageBackground(p.background || { inherit: true });
  renderBlockList();
  updatePreviewLabel();
}

function readPageSettings() {
  const p = currentPage();
  if (!p) return;
  p.name      = document.getElementById("pg-name").value.trim() || "Untitled";
  p.slug      = slugify(document.getElementById("pg-slug").value || p.name);
  p.navLabel  = document.getElementById("pg-nav-label").value.trim() || p.name;
  p.showInNav = document.getElementById("pg-show-in-nav").checked;
  const wasHome = p.isHome;
  p.isHome    = document.getElementById("pg-is-home").checked;
  if (p.isHome && !wasHome) {
    pendingPages.forEach((other) => { if (other.id !== p.id) other.isHome = false; });
  }
  p.background = readPageBackground();
  renderPageSelector();
  updatePreviewLabel();
}

function updatePreviewLabel() {
  const lbl = document.getElementById("preview-page-name");
  const p = currentPage();
  if (lbl && p) lbl.textContent = p.name;
}

// ── Page background ───────────────────────────────────────────
function populatePageBackground(bg) {
  const inherit = bg.inherit !== false && !bg.type;
  document.getElementById("pg-bg-inherit").checked = inherit;
  document.getElementById("pg-bg-fields").classList.toggle("hidden", inherit);
  setToggleGroup("pg-bg-type-group", bg.type || "color");
  syncPageBgFields(bg.type || "color");
  document.getElementById("pg-bg-color").value     = bg.color || "";
  const colorPicker = document.getElementById("pg-bg-color-picker");
  if (colorPicker && /^#[0-9a-fA-F]{6}$/.test(bg.color || "")) colorPicker.value = bg.color;
  document.getElementById("pg-bg-image").value     = bg.imageUrl || "";
  document.getElementById("pg-bg-image-size").value = bg.imageSize || "cover";
  document.getElementById("pg-bg-image-pos").value  = bg.imagePosition || "center";
  document.getElementById("pg-bg-parallax").checked = !!bg.parallax;
  document.getElementById("pg-bg-grad-dir").value = bg.gradientDir || "to bottom";
  document.getElementById("pg-bg-grad-from").value = bg.gradientFrom || "";
  document.getElementById("pg-bg-grad-to").value   = bg.gradientTo   || "";
  document.getElementById("pg-bg-video").value     = bg.videoUrl || "";
  document.getElementById("pg-bg-slideshow").value = (bg.slideshowImages || []).join("\n");
  const intSlider = document.getElementById("pg-bg-slideshow-interval");
  const intDisp   = document.getElementById("pg-bg-slideshow-interval-val");
  if (intSlider) { intSlider.value = bg.slideshowInterval || 5; if (intDisp) intDisp.textContent = intSlider.value + "s"; }
}

function readPageBackground() {
  if (document.getElementById("pg-bg-inherit").checked) return { inherit: true };
  const type = getToggleGroup("pg-bg-type-group") || "color";
  return {
    inherit: false, type,
    color:        document.getElementById("pg-bg-color").value || "",
    imageUrl:     document.getElementById("pg-bg-image").value || "",
    imageSize:    document.getElementById("pg-bg-image-size").value,
    imagePosition:document.getElementById("pg-bg-image-pos").value,
    parallax:     document.getElementById("pg-bg-parallax").checked,
    gradientDir:  document.getElementById("pg-bg-grad-dir").value,
    gradientFrom: document.getElementById("pg-bg-grad-from").value || "",
    gradientTo:   document.getElementById("pg-bg-grad-to").value || "",
    videoUrl:     document.getElementById("pg-bg-video").value || "",
    slideshowImages: document.getElementById("pg-bg-slideshow").value.split(/\n+/).map((s) => s.trim()).filter(Boolean),
    slideshowInterval: Number(document.getElementById("pg-bg-slideshow-interval").value) || 5,
  };
}

function syncPageBgFields(type) {
  ["color","image","gradient","video","slideshow"].forEach((t) => {
    const el = document.getElementById(`pg-bg-${t}-fields`);
    if (el) el.classList.toggle("hidden", t !== type);
  });
}

// ── Block list ────────────────────────────────────────────────
const BLOCK_LABELS = {
  hero:"Hero", text:"Text", banner:"Banner", image:"Image",
  "button-row":"Buttons", "product-grid":"Product Grid", spacer:"Spacer", divider:"Divider",
};
const BLOCK_ICONS = {
  hero:        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="8" rx="1"/><path d="M3 15h18M3 19h12"/></svg>',
  text:        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
  banner:      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="1"/></svg>',
  image:       '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>',
  "button-row":'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="9" width="9" height="6" rx="3"/><rect x="13" y="9" width="9" height="6" rx="3"/></svg>',
  "product-grid":'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
  spacer:      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 6h8M8 18h8M12 4v16"/></svg>',
  divider:     '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18"/></svg>',
};

function renderBlockList() {
  const list = document.getElementById("block-list");
  const p = currentPage();
  if (!list || !p) return;
  if (p.blocks.length === 0) {
    list.innerHTML = '<p class="ds-empty">No blocks yet. Click a block type below to add one.</p>';
    return;
  }
  list.innerHTML = p.blocks.map((b, i) => `
    <div class="block-row${b.id === editingBlockId ? " editing" : ""}" data-block-id="${b.id}" draggable="true">
      <div class="block-row-header">
        <div class="block-handle" title="Drag to reorder">⋮⋮</div>
        <div class="block-row-info">
          <span class="block-icon">${BLOCK_ICONS[b.type] || ""}</span>
          <div>
            <div class="block-row-type">${BLOCK_LABELS[b.type] || b.type}</div>
            <div class="block-row-summary">${esc(blockSummary(b))}</div>
          </div>
        </div>
        <div class="block-row-actions">
          <button class="btn-block-move" data-act="up"     data-block-id="${b.id}" title="Move up"${i === 0 ? " disabled" : ""}>↑</button>
          <button class="btn-block-move" data-act="down"   data-block-id="${b.id}" title="Move down"${i === p.blocks.length - 1 ? " disabled" : ""}>↓</button>
          <button class="btn-block-edit"   data-block-id="${b.id}">${b.id === editingBlockId ? "Close" : "Edit"}</button>
          <button class="btn-block-delete" data-block-id="${b.id}">×</button>
        </div>
      </div>
      ${b.id === editingBlockId ? `<div class="block-editor">${blockEditorHtml(b)}</div>` : ""}
    </div>
  `).join("");

  list.querySelectorAll(".btn-block-edit").forEach((b) => b.addEventListener("click", () => toggleEditBlock(b.dataset.blockId)));
  list.querySelectorAll(".btn-block-delete").forEach((b) => b.addEventListener("click", () => deleteBlock(b.dataset.blockId)));
  list.querySelectorAll(".btn-block-move").forEach((b) => b.addEventListener("click", () => moveBlock(b.dataset.blockId, b.dataset.act)));

  // Wire block editor field events (for currently editing block)
  if (editingBlockId) wireBlockEditor(editingBlockId);

  // Drag & drop reordering
  initBlockDragDrop(list);
}

function blockSummary(b) {
  const c = b.content || {};
  switch (b.type) {
    case "hero":         return [c.eyebrow, c.title, c.tagline].filter(Boolean).join(" · ").slice(0, 80);
    case "text":         return (c.text || "").slice(0, 80);
    case "banner":       return [c.title, c.subtitle].filter(Boolean).join(" · ").slice(0, 80);
    case "image":        return c.url ? c.url.slice(-50) : "(no image)";
    case "button-row":   return (c.buttons || []).map((x) => x.label).join(", ").slice(0, 60) || "(no buttons)";
    case "product-grid": return `${c.categoryFilter || "all"} · ${c.limit ? `limit ${c.limit}` : "all items"}`;
    case "spacer":       return `${c.height || 40}px`;
    case "divider":      return "Horizontal line";
    default:             return "";
  }
}

function addBlock(type) {
  const p = currentPage();
  if (!p) return;
  const defaults = newBlockDefaults(type);
  const block = {
    id: "block-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
    type, content: defaults, style: { inherit: true },
  };
  p.blocks.push(block);
  editingBlockId = block.id;
  renderBlockList();
  sendPreviewUpdate(true);
  // Scroll new block into view in preview
  scrollPreviewToBlock(block.id);
}

function newBlockDefaults(type) {
  switch (type) {
    case "hero":         return { eyebrow:"", title:"New Hero", tagline:"", showButton:false, buttonText:"", buttonUrl:"" };
    case "text":         return { text:"Write your content here..." };
    case "banner":       return { title:"Special Offer", subtitle:"Limited time only.", buttonText:"Shop Now", buttonUrl:"/" };
    case "image":        return { url:"", alt:"", caption:"", linkUrl:"" };
    case "button-row":   return { buttons: [{ label:"Click me", url:"/", variant:"solid" }] };
    case "product-grid": return { showFilters:true, showSearch:true, categoryFilter:"all", limit:0 };
    case "spacer":       return { height: 40 };
    case "divider":      return {};
    default:             return {};
  }
}

function toggleEditBlock(id) {
  editingBlockId = editingBlockId === id ? null : id;
  renderBlockList();
  if (editingBlockId) scrollPreviewToBlock(editingBlockId);
}

function deleteBlock(id) {
  const p = currentPage();
  if (!p) return;
  if (!confirm("Delete this block?")) return;
  p.blocks = p.blocks.filter((b) => b.id !== id);
  if (editingBlockId === id) editingBlockId = null;
  renderBlockList();
  sendPreviewUpdate(true);
}

function moveBlock(id, dir) {
  const p = currentPage();
  if (!p) return;
  const i = p.blocks.findIndex((b) => b.id === id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i === -1 || j < 0 || j >= p.blocks.length) return;
  [p.blocks[i], p.blocks[j]] = [p.blocks[j], p.blocks[i]];
  renderBlockList();
  sendPreviewUpdate(true);
}

function initBlockDragDrop(list) {
  let dragged = null;
  list.querySelectorAll(".block-row").forEach((row) => {
    row.addEventListener("dragstart", (e) => {
      dragged = row;
      row.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });
    row.addEventListener("dragend", () => {
      if (dragged) dragged.classList.remove("dragging");
      dragged = null;
    });
    row.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (!dragged || dragged === row) return;
      const rect = row.getBoundingClientRect();
      const after = (e.clientY - rect.top) > rect.height / 2;
      row.parentNode.insertBefore(dragged, after ? row.nextSibling : row);
    });
    row.addEventListener("drop", (e) => {
      e.preventDefault();
      // Re-order pendingPages from DOM order
      const p = currentPage();
      const order = [...list.querySelectorAll(".block-row")].map((r) => r.dataset.blockId);
      p.blocks.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
      renderBlockList();
      sendPreviewUpdate(true);
    });
  });
}

// ── Block editors (inline forms) ──────────────────────────────
function blockEditorHtml(b) {
  const c = b.content || {};
  const s = b.style || { inherit: true };
  const styleHtml = blockStyleEditor(s, b.id);
  let body = "";
  switch (b.type) {
    case "hero":
      body = `
        <div class="form-field"><label>Eyebrow</label><input type="text" data-block-field="eyebrow" value="${escAttr(c.eyebrow || "")}"></div>
        <div class="form-field"><label>Title</label><input type="text" data-block-field="title" value="${escAttr(c.title || "")}"></div>
        <div class="form-field"><label>Tagline</label><input type="text" data-block-field="tagline" value="${escAttr(c.tagline || "")}"></div>
        <label class="checkbox-field"><input type="checkbox" data-block-field="showButton"${c.showButton ? " checked" : ""}> Show call-to-action button</label>
        <div class="form-row">
          <div class="form-field"><label>Button Text</label><input type="text" data-block-field="buttonText" value="${escAttr(c.buttonText || "")}"></div>
          <div class="form-field"><label>Button Link</label><input type="text" data-block-field="buttonUrl" placeholder="/p/about" value="${escAttr(c.buttonUrl || "")}"></div>
        </div>`;
      break;
    case "text":
      body = `<div class="form-field"><label>Text Content <span class="label-hint">(blank lines = new paragraph)</span></label><textarea data-block-field="text" rows="6">${esc(c.text || "")}</textarea></div>`;
      break;
    case "banner":
      body = `
        <div class="form-field"><label>Title</label><input type="text" data-block-field="title" value="${escAttr(c.title || "")}"></div>
        <div class="form-field"><label>Subtitle</label><input type="text" data-block-field="subtitle" value="${escAttr(c.subtitle || "")}"></div>
        <div class="form-row">
          <div class="form-field"><label>Button Text</label><input type="text" data-block-field="buttonText" value="${escAttr(c.buttonText || "")}"></div>
          <div class="form-field"><label>Button Link</label><input type="text" data-block-field="buttonUrl" value="${escAttr(c.buttonUrl || "")}"></div>
        </div>`;
      break;
    case "image":
      body = `
        <div class="form-field"><label>Image URL</label><input type="url" data-block-field="url" value="${escAttr(c.url || "")}"></div>
        <div class="form-field"><label>Alt Text</label><input type="text" data-block-field="alt" value="${escAttr(c.alt || "")}"></div>
        <div class="form-field"><label>Caption</label><input type="text" data-block-field="caption" value="${escAttr(c.caption || "")}"></div>
        <div class="form-field"><label>Click Link <span class="label-hint">(optional)</span></label><input type="text" data-block-field="linkUrl" value="${escAttr(c.linkUrl || "")}"></div>`;
      break;
    case "button-row":
      body = `
        <div class="form-field"><label>Buttons</label><div class="button-list" data-button-list>
          ${(c.buttons || []).map((btn, i) => buttonRowEditor(btn, i)).join("")}
        </div>
        <button class="btn-secondary btn-small" type="button" data-add-button>+ Add Button</button></div>`;
      break;
    case "product-grid":
      body = `
        <label class="checkbox-field"><input type="checkbox" data-block-field="showFilters"${c.showFilters !== false ? " checked" : ""}> Show category filters</label>
        <label class="checkbox-field"><input type="checkbox" data-block-field="showSearch"${c.showSearch !== false ? " checked" : ""}> Wire up nav search bar</label>
        <div class="form-row">
          <div class="form-field"><label>Default Category</label><input type="text" data-block-field="categoryFilter" placeholder="all" value="${escAttr(c.categoryFilter || "all")}"></div>
          <div class="form-field"><label>Max Items <span class="label-hint">(0 = all)</span></label><input type="number" data-block-field="limit" min="0" value="${c.limit || 0}"></div>
        </div>`;
      break;
    case "spacer":
      body = `<div class="slider-field"><label>Height</label><div class="slider-wrap"><input type="range" data-block-field="height" min="10" max="200" step="5" value="${c.height || 40}"><span class="slider-value" data-spacer-val>${c.height || 40}px</span></div></div>`;
      break;
    case "divider":
      body = `<p class="ds-help-text">Simple horizontal line. Color comes from the global border color.</p>`;
      break;
  }
  return body + styleHtml;
}

function buttonRowEditor(btn, i) {
  return `
    <div class="button-list-item" data-button-idx="${i}">
      <div class="form-row">
        <div class="form-field"><label>Label</label><input type="text" data-btn-field="label" value="${escAttr(btn.label || "")}"></div>
        <div class="form-field"><label>Link URL</label><input type="text" data-btn-field="url" value="${escAttr(btn.url || "")}"></div>
        <div class="form-field" style="max-width:120px"><label>Style</label>
          <select data-btn-field="variant" class="form-select">
            <option value="solid"${btn.variant !== "outline" ? " selected" : ""}>Solid</option>
            <option value="outline"${btn.variant === "outline" ? " selected" : ""}>Outline</option>
          </select>
        </div>
        <button class="btn-tiny-delete" type="button" data-remove-btn="${i}" title="Remove">×</button>
      </div>
    </div>`;
}

function blockStyleEditor(s, blockId) {
  return `
    <div class="block-style-sec">
      <label class="checkbox-field"><input type="checkbox" data-block-style-field="inherit"${s.inherit !== false ? " checked" : ""}> Use global design defaults</label>
      <div class="block-style-fields" ${s.inherit !== false ? 'style="display:none"' : ""}>
        <div class="color-grid">
          <div class="color-chip-field"><label>Background</label><div class="color-input-wrap"><input type="color" data-block-style-picker="bgColor" value="${escAttr(s.bgColor || "#ffffff")}"><input type="text" data-block-style-field="bgColor" class="color-hex" value="${escAttr(s.bgColor || "")}" placeholder="inherit"></div></div>
          <div class="color-chip-field"><label>Text Color</label><div class="color-input-wrap"><input type="color" data-block-style-picker="textColor" value="${escAttr(s.textColor || "#1a1a2e")}"><input type="text" data-block-style-field="textColor" class="color-hex" value="${escAttr(s.textColor || "")}" placeholder="inherit"></div></div>
          <div class="color-chip-field"><label>Accent</label><div class="color-input-wrap"><input type="color" data-block-style-picker="accentColor" value="${escAttr(s.accentColor || "#6c63ff")}"><input type="text" data-block-style-field="accentColor" class="color-hex" value="${escAttr(s.accentColor || "")}" placeholder="inherit"></div></div>
        </div>
        <div class="form-row" style="margin-top:10px">
          <div class="form-field"><label>Font</label><select data-block-style-field="fontFamily" class="form-select"><option value="">Use Global</option>${FONT_OPTIONS.map((f) => `<option value="${f}"${s.fontFamily === f ? " selected" : ""}>${f}</option>`).join("")}</select></div>
          <div class="form-field"><label>Text Align</label><select data-block-style-field="textAlign" class="form-select"><option value="">Inherit</option><option value="left"${s.textAlign === "left" ? " selected" : ""}>Left</option><option value="center"${s.textAlign === "center" ? " selected" : ""}>Center</option><option value="right"${s.textAlign === "right" ? " selected" : ""}>Right</option></select></div>
        </div>
        <div class="form-row">
          <div class="form-field"><label>Padding Top (px)</label><input type="number" data-block-style-field="paddingTop" value="${s.paddingTop || ""}" placeholder="inherit"></div>
          <div class="form-field"><label>Padding Bottom (px)</label><input type="number" data-block-style-field="paddingBottom" value="${s.paddingBottom || ""}" placeholder="inherit"></div>
          <div class="form-field"><label>Corner Radius (px)</label><input type="number" data-block-style-field="borderRadius" value="${s.borderRadius || ""}" placeholder="inherit"></div>
        </div>
      </div>
    </div>`;
}

// ── Wire block editor fields → state + preview ────────────────
function wireBlockEditor(blockId) {
  const block = currentPage()?.blocks.find((b) => b.id === blockId);
  if (!block) return;
  const root = document.querySelector(`.block-row[data-block-id="${blockId}"] .block-editor`);
  if (!root) return;

  // Content fields
  root.querySelectorAll("[data-block-field]").forEach((el) => {
    const key = el.dataset.blockField;
    const handler = () => {
      let v;
      if (el.type === "checkbox") v = el.checked;
      else if (el.type === "number" || el.type === "range") v = Number(el.value);
      else v = el.value;
      block.content[key] = v;
      if (el.type === "range" && el.parentElement.querySelector("[data-spacer-val]")) {
        el.parentElement.querySelector("[data-spacer-val]").textContent = el.value + "px";
      }
      // Update summary text in row
      const sumEl = document.querySelector(`.block-row[data-block-id="${blockId}"] .block-row-summary`);
      if (sumEl) sumEl.textContent = blockSummary(block);
      sendPreviewUpdate();
    };
    el.addEventListener("input",  handler);
    el.addEventListener("change", handler);
  });

  // Style fields
  root.querySelectorAll("[data-block-style-field]").forEach((el) => {
    const key = el.dataset.blockStyleField;
    const handler = () => {
      let v = el.type === "checkbox" ? el.checked : el.value;
      block.style[key] = v;
      if (key === "inherit") {
        const fields = root.querySelector(".block-style-fields");
        if (fields) fields.style.display = v ? "none" : "";
      }
      sendPreviewUpdate();
    };
    el.addEventListener("input",  handler);
    el.addEventListener("change", handler);
  });
  // Style color picker sync
  root.querySelectorAll("[data-block-style-picker]").forEach((picker) => {
    const key = picker.dataset.blockStylePicker;
    const hex = root.querySelector(`[data-block-style-field="${key}"]`);
    picker.addEventListener("input", () => { if (hex) { hex.value = picker.value; hex.dispatchEvent(new Event("input")); } });
  });

  // Button row editor
  if (block.type === "button-row") wireButtonRowEditor(root, block);
}

function wireButtonRowEditor(root, block) {
  const list = root.querySelector("[data-button-list]");
  const refresh = () => {
    list.innerHTML = (block.content.buttons || []).map((b, i) => buttonRowEditor(b, i)).join("");
    list.querySelectorAll("[data-button-idx]").forEach((row) => {
      const idx = Number(row.dataset.buttonIdx);
      row.querySelectorAll("[data-btn-field]").forEach((el) => {
        el.addEventListener("input", () => {
          block.content.buttons[idx][el.dataset.btnField] = el.value;
          sendPreviewUpdate();
        });
      });
      row.querySelector("[data-remove-btn]")?.addEventListener("click", () => {
        block.content.buttons.splice(idx, 1);
        refresh();
        sendPreviewUpdate();
      });
    });
  };
  refresh();
  root.querySelector("[data-add-button]")?.addEventListener("click", () => {
    block.content.buttons = block.content.buttons || [];
    block.content.buttons.push({ label: "Button", url: "/", variant: "solid" });
    refresh();
    sendPreviewUpdate();
  });
}

// ── Save pages ────────────────────────────────────────────────
async function savePages() {
  readPageSettings();
  const res = await apiFetch("/api/admin/pages", { method: "PUT", body: JSON.stringify({ pages: pendingPages }) });
  if (!res || !res.ok) {
    const err = res ? (await res.json()).error : "Network error";
    showToast(`Pages save failed: ${err}`, "error");
    return false;
  }
  const data = await res.json();
  pendingPages = data.pages;
  return true;
}

// ── Preview iframe ────────────────────────────────────────────
let previewReloadDebounce = null;
let previewReady = false;

function initPreviewIframe() {
  const iframe = document.getElementById("preview-iframe");
  if (!iframe) return;
  const p = currentPage();
  const url = p && !p.isHome ? `/p/${p.slug}` : "/";
  iframe.src = url;
  iframe.addEventListener("load", () => {
    previewReady = true;
    sendPreviewUpdate();
  });
}

function sendPreviewUpdate(reloadIfPageChanged) {
  const iframe = document.getElementById("preview-iframe");
  if (!iframe) return;
  const p = currentPage();
  if (!p) return;

  // If the editing page changed, navigate the iframe
  if (reloadIfPageChanged) {
    const targetUrl = p.isHome ? "/" : `/p/${p.slug}`;
    try {
      const curr = iframe.contentWindow?.location.pathname || "";
      if (curr !== targetUrl && curr !== "/index.html") {
        previewReady = false;
        iframe.src = targetUrl;
        return;
      }
    } catch { /* cross-origin guard — same origin so it's fine */ }
  }

  if (!previewReady || !iframe.contentWindow) return;
  // Read current state and send
  const cfg = readDesignForm();
  readPageSettings();
  clearTimeout(previewReloadDebounce);
  previewReloadDebounce = setTimeout(() => {
    iframe.contentWindow.postMessage({
      type: "preview-update",
      config: cfg,
      pages:  pendingPages,
      slug:   p.slug,
    }, window.location.origin);
  }, 50);
}

function scrollPreviewToBlock(blockId) {
  const iframe = document.getElementById("preview-iframe");
  if (!iframe || !iframe.contentWindow) return;
  iframe.contentWindow.postMessage({ type: "highlight-block", blockId }, window.location.origin);
}

// ── Custom font picker ────────────────────────────────────────
function initFontPicker() {
  const picker = document.getElementById("cfg-font-picker");
  const target = document.getElementById("cfg-font");
  if (!picker || !target) return;
  FONT_OPTIONS.forEach((f) => loadAdminFont(f));

  picker.innerHTML = `
    <button type="button" class="font-picker-toggle">
      <span class="font-picker-current" style="font-family:'${target.value}'">${target.value}</span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
    </button>
    <div class="font-picker-menu hidden">
      ${FONT_OPTIONS.map((f) => `<button type="button" class="font-picker-opt" data-font="${f}" style="font-family:'${f}'">${f}</button>`).join("")}
    </div>
  `;
  const toggle = picker.querySelector(".font-picker-toggle");
  const menu   = picker.querySelector(".font-picker-menu");
  const current= picker.querySelector(".font-picker-current");
  toggle.addEventListener("click", (e) => { e.stopPropagation(); menu.classList.toggle("hidden"); });
  document.addEventListener("click", () => menu.classList.add("hidden"));
  picker.querySelectorAll(".font-picker-opt").forEach((opt) => {
    opt.addEventListener("click", () => {
      const f = opt.dataset.font;
      target.value = f;
      current.textContent = f;
      current.style.fontFamily = `'${f}'`;
      menu.classList.add("hidden");
      updateFontPreview(f);
      applyDesignPreview();
    });
  });
}

// ── Init ──────────────────────────────────────────────────────
async function initAdmin() {
  await Promise.all([loadProducts(), loadConfig(), loadPages()]);
  document.getElementById("admin-store-name").textContent = config.name || "My Store";
  showAdmin();
  initAccordions();
  initFontPicker();
  initPageEditorEvents();
  initPreviewIframe();
}

// ── Wire page-editor specific events ──────────────────────────
function initPageEditorEvents() {
  const sel = document.getElementById("page-selector");
  if (sel) sel.addEventListener("change", () => selectPage(sel.value));
  document.getElementById("add-page-btn")?.addEventListener("click", addPage);
  document.getElementById("delete-page-btn")?.addEventListener("click", deletePage);
  document.getElementById("duplicate-page-btn")?.addEventListener("click", duplicatePage);

  // Page settings live update
  ["pg-name","pg-slug","pg-nav-label"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", () => { readPageSettings(); });
  });
  ["pg-show-in-nav","pg-is-home"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", () => { readPageSettings(); sendPreviewUpdate(); });
  });

  // Page background inherit toggle
  document.getElementById("pg-bg-inherit")?.addEventListener("change", (e) => {
    document.getElementById("pg-bg-fields").classList.toggle("hidden", e.target.checked);
    readPageSettings();
    sendPreviewUpdate();
  });
  // Page background type buttons
  document.getElementById("pg-bg-type-group")?.querySelectorAll(".toggle-btn").forEach((b) => {
    b.addEventListener("click", () => {
      setToggleGroup("pg-bg-type-group", b.dataset.val);
      syncPageBgFields(b.dataset.val);
      readPageSettings();
      sendPreviewUpdate();
    });
  });
  // Page background fields
  ["pg-bg-color","pg-bg-image","pg-bg-image-size","pg-bg-image-pos","pg-bg-grad-dir","pg-bg-grad-from","pg-bg-grad-to","pg-bg-video","pg-bg-slideshow"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", () => { readPageSettings(); sendPreviewUpdate(); });
  });
  document.getElementById("pg-bg-parallax")?.addEventListener("change", () => { readPageSettings(); sendPreviewUpdate(); });
  // Page bg color picker
  document.getElementById("pg-bg-color-picker")?.addEventListener("input", (e) => {
    document.getElementById("pg-bg-color").value = e.target.value;
    readPageSettings();
    sendPreviewUpdate();
  });
  ["pg-bg-grad-from","pg-bg-grad-to"].forEach((id) => {
    document.getElementById(id + "-picker")?.addEventListener("input", (e) => {
      document.getElementById(id).value = e.target.value;
      readPageSettings();
      sendPreviewUpdate();
    });
  });
  // Slideshow interval slider
  const intSlider = document.getElementById("pg-bg-slideshow-interval");
  if (intSlider) intSlider.addEventListener("input", () => {
    document.getElementById("pg-bg-slideshow-interval-val").textContent = intSlider.value + "s";
    readPageSettings(); sendPreviewUpdate();
  });

  // Add block buttons
  document.querySelectorAll(".add-block-btn").forEach((b) => {
    b.addEventListener("click", () => addBlock(b.dataset.blockType));
  });
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
