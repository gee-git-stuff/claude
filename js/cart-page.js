/**
 * cart-page.js — cart page rendering and Stripe checkout trigger.
 * Only loaded on cart.html.
 */

function cartRemove(productId) {
  const cart = cartLoad().filter((i) => i.id !== productId);
  cartSave(cart);
  renderCart();
  updateCartBadge();
}

function cartSetQty(productId, qty) {
  const cart = cartLoad();
  const item = cart.find((i) => i.id === productId);
  if (!item) return;
  if (qty < 1) {
    cartRemove(productId);
    return;
  }
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
  const cart = cartLoad();
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
    const imgSrc = product.image.startsWith("http") ? product.image : "";

    const row = document.createElement("div");
    row.className = "cart-item";
    row.innerHTML = `
      ${imgSrc
        ? `<img class="cart-item-img" src="${imgSrc}" alt="${escHtml(product.name)}">`
        : `<div class="cart-item-img" style="display:flex;align-items:center;justify-content:center;font-size:2.5rem;">${product.image}</div>`
      }
      <div class="cart-item-info">
        <div class="cart-item-name">${escHtml(product.name)}</div>
        <div class="cart-item-price">${formatPrice(product.price)} each</div>
        <div class="cart-item-controls">
          <button class="qty-btn" data-action="dec" data-id="${product.id}" aria-label="Decrease quantity">&#8722;</button>
          <span class="qty-display" aria-label="Quantity">${entry.qty}</span>
          <button class="qty-btn" data-action="inc" data-id="${product.id}" aria-label="Increase quantity">&#43;</button>
          <button class="btn-remove" data-id="${product.id}">Remove</button>
        </div>
      </div>
      <div class="cart-item-subtotal">${formatPrice(subtotal)}</div>
    `;

    row.querySelector('[data-action="dec"]').addEventListener("click", () =>
      cartSetQty(product.id, entry.qty - 1)
    );
    row.querySelector('[data-action="inc"]').addEventListener("click", () =>
      cartSetQty(product.id, entry.qty + 1)
    );
    row.querySelector(".btn-remove").addEventListener("click", () =>
      cartRemove(product.id)
    );

    items.appendChild(row);
  });

  // Update summary
  const subtotalCents = cartSubtotal(cart);
  const totalItems = cart.reduce((s, i) => s + i.qty, 0);
  document.getElementById("summary-count").textContent = totalItems;
  document.getElementById("summary-subtotal").textContent = formatPrice(subtotalCents);
  document.getElementById("summary-total").textContent = formatPrice(subtotalCents);

  const checkoutBtn = document.getElementById("checkout-btn");
  checkoutBtn.disabled = cart.length === 0;
}

// ── Stripe Checkout ───────────────────────────────────────────
async function startCheckout() {
  const cart = cartLoad();
  if (!cart.length) return;

  const btn = document.getElementById("checkout-btn");
  btn.disabled = true;
  btn.textContent = "Redirecting…";

  // Build line items for the server
  const lineItems = cart.map((entry) => ({
    productId: entry.id,
    qty: entry.qty,
  }));

  try {
    const res = await fetch("/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineItems }),
    });

    if (!res.ok) throw new Error("Server error");
    const { url } = await res.json();
    window.location.href = url;   // redirect to Stripe Checkout
  } catch (err) {
    showToast("Checkout failed. Please try again.", "error");
    btn.disabled = false;
    btn.textContent = "Proceed to Checkout";
  }
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  renderCart();

  const checkoutBtn = document.getElementById("checkout-btn");
  if (checkoutBtn) checkoutBtn.addEventListener("click", startCheckout);
});
