/**
 * cart-page.js — cart page rendering and Stripe checkout trigger.
 * Only loaded on cart.html. store.js calls initCartPage() after data loads.
 */

function cartRemove(productId) {
  cartSave(cartLoad().filter((i) => i.id !== productId));
  renderCart();
  updateCartBadge();
}

function cartSetQty(productId, qty) {
  if (qty < 1) { cartRemove(productId); return; }
  const cart = cartLoad();
  const item = cart.find((i) => i.id === productId);
  if (!item) return;
  item.qty = qty;
  cartSave(cart);
  renderCart();
  updateCartBadge();
}

function cartSubtotal(cart) {
  return cart.reduce((sum, i) => {
    const product = getProduct(i.id);
    return product ? sum + product.price * i.qty : sum;
  }, 0);
}

function renderCart() {
  const cart   = cartLoad();
  const layout = document.getElementById("cart-layout");
  const empty  = document.getElementById("empty-cart");
  const items  = document.getElementById("cart-items");

  if (cart.length === 0) {
    layout.classList.add("hidden");
    empty.classList.remove("hidden");
    return;
  }

  layout.classList.remove("hidden");
  empty.classList.add("hidden");
  items.innerHTML = "";

  cart.forEach((entry) => {
    const product = getProduct(entry.id);
    if (!product) return;

    const subtotal = product.price * entry.qty;
    const imgSrc   = product.image && product.image.startsWith("http") ? product.image : "";

    const row = document.createElement("div");
    row.className = "cart-item";
    row.innerHTML = `
      ${imgSrc
        ? `<img class="cart-item-img" src="${escHtml(imgSrc)}" alt="${escHtml(product.name)}">`
        : `<div class="cart-item-img" style="display:flex;align-items:center;justify-content:center;font-size:2.5rem;">${escHtml(product.image || "")}</div>`
      }
      <div class="cart-item-info">
        <div class="cart-item-name">${escHtml(product.name)}</div>
        <div class="cart-item-price">${formatPrice(product.price)} each</div>
        <div class="cart-item-controls">
          <button class="qty-btn" data-action="dec" aria-label="Decrease quantity">&#8722;</button>
          <span class="qty-display" aria-label="Quantity">${entry.qty}</span>
          <button class="qty-btn" data-action="inc" aria-label="Increase quantity">&#43;</button>
          <button class="btn-remove">Remove</button>
        </div>
      </div>
      <div class="cart-item-subtotal">${formatPrice(subtotal)}</div>
    `;

    row.querySelector('[data-action="dec"]').addEventListener("click", () => cartSetQty(product.id, entry.qty - 1));
    row.querySelector('[data-action="inc"]').addEventListener("click", () => cartSetQty(product.id, entry.qty + 1));
    row.querySelector(".btn-remove").addEventListener("click", () => cartRemove(product.id));
    items.appendChild(row);
  });

  const subtotalCents = cartSubtotal(cart);
  const totalItems    = cart.reduce((s, i) => s + i.qty, 0);
  document.getElementById("summary-count").textContent    = totalItems;
  document.getElementById("summary-subtotal").textContent = formatPrice(subtotalCents);
  document.getElementById("summary-total").textContent    = formatPrice(subtotalCents);

  const btn = document.getElementById("checkout-btn");
  if (btn) btn.disabled = cart.length === 0;
}

async function startCheckout() {
  const cart = cartLoad();
  if (!cart.length) return;

  const btn = document.getElementById("checkout-btn");
  btn.disabled = true;
  btn.textContent = "Redirecting…";

  try {
    const res = await fetch("/create-checkout-session", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ lineItems: cart.map((e) => ({ productId: e.id, qty: e.qty })) }),
    });
    if (!res.ok) throw new Error("Server error");
    const { url } = await res.json();
    window.location.href = url;
  } catch {
    showToast("Checkout failed. Please try again.", "error");
    btn.disabled = false;
    btn.textContent = "Proceed to Checkout";
  }
}

function initCartPage() {
  renderCart();
  const btn = document.getElementById("checkout-btn");
  if (btn) btn.addEventListener("click", startCheckout);
}
