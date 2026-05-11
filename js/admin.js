/**
 * admin.js — admin panel logic.
 * Handles auth, product CRUD, and design config updates.
 */

const TOKEN_KEY = "admin_token";

// ── Auth helpers ──────────────────────────────────────────────
function getToken()      { return sessionStorage.getItem(TOKEN_KEY); }
function setToken(t)     { sessionStorage.setItem(TOKEN_KEY, t); }
function clearToken()    { sessionStorage.removeItem(TOKEN_KEY); }
function authHeaders()   { return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` }; }

// ── Toast (reuse store pattern without store.js dependency) ───
function showToast(message, type = "") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast${type ? " " + type : ""}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

// ── Screen switching ──────────────────────────────────────────
function showAdmin()  {
  document.getElementById("login-screen").classList.add("hidden");
  document.getElementById("admin-panel").classList.remove("hidden");
}
function showLogin()  {
  document.getElementById("login-screen").classList.remove("hidden");
  document.getElementById("admin-panel").classList.add("hidden");
}

// ── Tab switching ─────────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll(".admin-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === name);
  });
  document.querySelectorAll(".admin-tab-content").forEach((pane) => {
    pane.classList.toggle("active", pane.id === `tab-${name}`);
    pane.classList.toggle("hidden", pane.id !== `tab-${name}`);
  });
}

// ── State ─────────────────────────────────────────────────────
let products   = [];
let config     = {};
let editingId  = null;  // null = adding new product

// ── API helpers ───────────────────────────────────────────────
async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), ...authHeaders() },
  });
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
  applyPreviewColors();
}

// ── Products table ────────────────────────────────────────────
function renderProductsTable() {
  const tbody  = document.getElementById("products-tbody");
  const empty  = document.getElementById("products-empty");
  const label  = document.getElementById("product-count-label");

  label.textContent = `${products.length} product${products.length !== 1 ? "s" : ""}`;

  if (products.length === 0) {
    tbody.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  tbody.innerHTML = products.map((p) => `
    <tr data-id="${p.id}">
      <td>
        ${p.image && p.image.startsWith("http")
          ? `<img class="table-thumb" src="${esc(p.image)}" alt="">`
          : `<div class="table-thumb table-thumb-empty">${esc(p.image || "")}</div>`
        }
      </td>
      <td>
        <div class="table-name">${esc(p.name)}</div>
        <div class="table-desc">${esc(p.description)}</div>
      </td>
      <td><span class="table-category">${esc(p.category)}</span></td>
      <td class="table-price">${fmtPrice(p.price, config.currencySymbol)}</td>
      <td>
        ${p.stock === -1
          ? '<span class="stock-badge unlimited">Unlimited</span>'
          : p.stock === 0
            ? '<span class="stock-badge out">Out</span>'
            : p.stock <= 5
              ? `<span class="stock-badge low">${p.stock}</span>`
              : `<span class="stock-badge ok">${p.stock}</span>`
        }
      </td>
      <td>${p.featured ? '<span class="featured-dot" title="Featured">&#9733;</span>' : ""}</td>
      <td class="table-actions">
        <button class="btn-table-edit"   data-id="${p.id}">Edit</button>
        <button class="btn-table-delete" data-id="${p.id}">Delete</button>
      </td>
    </tr>
  `).join("");

  tbody.querySelectorAll(".btn-table-edit").forEach((btn) =>
    btn.addEventListener("click", () => openProductModal(btn.dataset.id))
  );
  tbody.querySelectorAll(".btn-table-delete").forEach((btn) =>
    btn.addEventListener("click", () => deleteProduct(btn.dataset.id))
  );
}

function fmtPrice(cents, symbol = "$") {
  return symbol + (cents / 100).toFixed(2);
}

// ── Product modal ─────────────────────────────────────────────
function openProductModal(productId = null) {
  editingId = productId;
  const modal  = document.getElementById("product-modal-overlay");
  const title  = document.getElementById("product-modal-title");
  const form   = document.getElementById("product-form");
  const errEl  = document.getElementById("product-form-error");
  errEl.classList.add("hidden");
  form.reset();

  // Populate category datalist
  const dl = document.getElementById("category-list");
  dl.innerHTML = [...new Set(products.map((p) => p.category))].map((c) => `<option value="${esc(c)}">`).join("");

  // Update currency symbol in price field
  const sym = config.currencySymbol || "$";
  document.getElementById("pf-currency-symbol").textContent = sym;

  if (productId) {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    title.textContent = "Edit Product";
    document.getElementById("product-id").value   = p.id;
    document.getElementById("pf-name").value       = p.name;
    document.getElementById("pf-category").value   = p.category;
    document.getElementById("pf-description").value= p.description;
    document.getElementById("pf-details").value    = p.details || "";
    document.getElementById("pf-price").value       = (p.price / 100).toFixed(2);
    document.getElementById("pf-stock").value       = p.stock === -1 ? "" : p.stock;
    document.getElementById("pf-unlimited").checked = p.stock === -1;
    document.getElementById("pf-image").value       = p.image || "";
    document.getElementById("pf-tags").value        = (p.tags || []).join(", ");
    document.getElementById("pf-featured").checked  = p.featured;
    updateImagePreview(p.image || "");
  } else {
    title.textContent = "Add Product";
    document.getElementById("product-id").value = "";
    updateImagePreview("");
  }

  modal.classList.add("open");
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
  if (url && url.startsWith("http")) {
    img.src = url;
    img.classList.remove("hidden");
  } else {
    img.classList.add("hidden");
    img.src = "";
  }
}

// ── Save product ──────────────────────────────────────────────
async function saveProduct(e) {
  e.preventDefault();
  const errEl     = document.getElementById("product-form-error");
  const saveBtn   = document.getElementById("save-product-btn");
  errEl.classList.add("hidden");

  const unlimited = document.getElementById("pf-unlimited").checked;
  const priceVal  = parseFloat(document.getElementById("pf-price").value);

  if (!document.getElementById("pf-name").value.trim()) {
    return showFieldError(errEl, "Product name is required.");
  }
  if (isNaN(priceVal) || priceVal <= 0) {
    return showFieldError(errEl, "A valid price is required.");
  }

  const body = {
    name:         document.getElementById("pf-name").value.trim(),
    category:     document.getElementById("pf-category").value.trim(),
    description:  document.getElementById("pf-description").value.trim(),
    details:      document.getElementById("pf-details").value.trim(),
    price:        priceVal,
    stock:        unlimited ? -1 : parseInt(document.getElementById("pf-stock").value, 10) || 0,
    unlimitedStock: unlimited,
    image:        document.getElementById("pf-image").value.trim(),
    tags:         document.getElementById("pf-tags").value,
    featured:     document.getElementById("pf-featured").checked,
  };

  saveBtn.disabled = true;
  saveBtn.textContent = "Saving…";

  const isEdit = Boolean(editingId);
  const url    = isEdit ? `/api/admin/products/${editingId}` : "/api/admin/products";
  const method = isEdit ? "PUT" : "POST";

  const res = await apiFetch(url, { method, body: JSON.stringify(body) });
  saveBtn.disabled = false;
  saveBtn.textContent = "Save Product";

  if (!res) return;
  if (!res.ok) {
    const data = await res.json();
    return showFieldError(errEl, data.error || "Save failed.");
  }

  await loadProducts();
  closeProductModal();
  showToast(isEdit ? "Product updated." : "Product added.", "success");
}

function showFieldError(el, msg) {
  el.textContent = msg;
  el.classList.remove("hidden");
}

// ── Delete product ────────────────────────────────────────────
async function deleteProduct(productId) {
  const p = products.find((x) => x.id === productId);
  if (!p) return;
  if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;

  const res = await apiFetch(`/api/admin/products/${productId}`, { method: "DELETE" });
  if (!res || !res.ok) { showToast("Delete failed.", "error"); return; }
  await loadProducts();
  showToast(`"${p.name}" deleted.`);
}

// ── Design settings ───────────────────────────────────────────
function populateDesignForm() {
  const set = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; };
  set("cfg-name",        config.name);
  set("cfg-tagline",     config.tagline);
  set("cfg-eyebrow",     config.heroEyebrow);
  set("cfg-currency",    config.currencySymbol);
  set("cfg-accent",            config.accentColor);
  set("cfg-accent-picker",     config.accentColor);
  set("cfg-accent-dark",       config.accentDark);
  set("cfg-accent-dark-picker",config.accentDark);
  set("cfg-accent-light",      config.accentLight);
  set("cfg-accent-light-picker",config.accentLight);
}

function applyPreviewColors() {
  const accent      = document.getElementById("cfg-accent").value      || "#6c63ff";
  const accentDark  = document.getElementById("cfg-accent-dark").value || "#4b44cc";
  const accentLight = document.getElementById("cfg-accent-light").value|| "#ede9ff";

  const preview = document.getElementById("color-preview");
  if (!preview) return;
  preview.style.setProperty("--p-accent",       accent);
  preview.style.setProperty("--p-accent-dark",  accentDark);
  preview.style.setProperty("--p-accent-light", accentLight);
}

async function saveDesign() {
  const btn = document.getElementById("save-design-btn");
  btn.disabled = true;
  btn.textContent = "Saving…";

  const body = {
    name:          document.getElementById("cfg-name").value.trim(),
    tagline:       document.getElementById("cfg-tagline").value.trim(),
    heroEyebrow:   document.getElementById("cfg-eyebrow").value.trim(),
    currencySymbol:document.getElementById("cfg-currency").value.trim(),
    accentColor:   document.getElementById("cfg-accent").value.trim(),
    accentDark:    document.getElementById("cfg-accent-dark").value.trim(),
    accentLight:   document.getElementById("cfg-accent-light").value.trim(),
  };

  const res = await apiFetch("/api/admin/config", { method: "PUT", body: JSON.stringify(body) });
  btn.disabled = false;
  btn.textContent = "Save Changes";

  if (!res || !res.ok) { showToast("Save failed.", "error"); return; }
  config = await res.json();
  document.getElementById("admin-store-name").textContent = config.name;
  applyPreviewColors();
  showToast("Design settings saved.", "success");
}

// ── Auth ──────────────────────────────────────────────────────
async function login(e) {
  e.preventDefault();
  const password = document.getElementById("password-input").value;
  const errEl    = document.getElementById("login-error");
  const btn      = document.getElementById("login-btn");
  errEl.classList.add("hidden");
  btn.disabled = true;
  btn.textContent = "Logging in…";

  try {
    const res = await fetch("/api/admin/login", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");
    setToken(data.token);
    await initAdmin();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.textContent = "Log In";
  }
}

async function logout() {
  if (getToken()) {
    await fetch("/api/admin/logout", { method: "POST", headers: authHeaders() }).catch(() => {});
  }
  clearToken();
  showLogin();
}

// ── Init ──────────────────────────────────────────────────────
async function initAdmin() {
  await Promise.all([loadProducts(), loadConfig()]);
  document.getElementById("admin-store-name").textContent = config.name || "My Store";
  showAdmin();
}

function esc(str) {
  return String(str || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── Event wiring ──────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // Login
  document.getElementById("login-form").addEventListener("submit", login);

  // Logout
  document.getElementById("logout-btn").addEventListener("click", logout);

  // Tab switching
  document.querySelectorAll(".admin-tab").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  // Add product button
  document.getElementById("add-product-btn").addEventListener("click", () => openProductModal(null));

  // Product modal close
  document.getElementById("product-modal-close").addEventListener("click", closeProductModal);
  document.getElementById("cancel-product-btn").addEventListener("click", closeProductModal);
  document.getElementById("product-modal-overlay").addEventListener("click", (e) => {
    if (e.target === document.getElementById("product-modal-overlay")) closeProductModal();
  });

  // Product form submit
  document.getElementById("product-form").addEventListener("submit", saveProduct);

  // Image URL preview
  document.getElementById("pf-image").addEventListener("input", (e) => updateImagePreview(e.target.value));

  // Unlimited stock toggle
  document.getElementById("pf-unlimited").addEventListener("change", (e) => {
    document.getElementById("pf-stock").disabled = e.target.checked;
  });

  // Color pickers ↔ hex inputs sync
  [
    ["cfg-accent-picker",      "cfg-accent"],
    ["cfg-accent-dark-picker", "cfg-accent-dark"],
    ["cfg-accent-light-picker","cfg-accent-light"],
  ].forEach(([pickerId, hexId]) => {
    const picker = document.getElementById(pickerId);
    const hex    = document.getElementById(hexId);

    picker.addEventListener("input", () => { hex.value = picker.value; applyPreviewColors(); });
    hex.addEventListener("input", () => {
      if (/^#[0-9a-fA-F]{6}$/.test(hex.value)) { picker.value = hex.value; applyPreviewColors(); }
    });
  });

  // Save design
  document.getElementById("save-design-btn").addEventListener("click", saveDesign);

  // Keyboard close modal
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeProductModal(); });

  // Check for existing session
  if (getToken()) {
    initAdmin().catch(() => { clearToken(); showLogin(); });
  } else {
    showLogin();
  }
});
