// Handle checkout process: display cart summary, create an order on the
// server, initialise the PayPal SDK and capture the payment.

function getCart() {
  try {
    return JSON.parse(localStorage.getItem('cart')) || [];
  } catch {
    return [];
  }
}

function clearCart() {
  localStorage.removeItem('cart');
}

function updateCartCount() {
  const cart = getCart();
  const count = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
  const countEl = document.getElementById('cartCount');
  if (countEl) {
    countEl.textContent = String(count);
  }
}

async function fetchProducts() {
  const res = await fetch('/api/products');
  return await res.json();
}

async function displaySummary() {
  const cart = getCart();
  const products = await fetchProducts();
  const detailDiv = document.getElementById('checkoutDetails');
  if (cart.length === 0) {
    detailDiv.innerHTML = '<p>Your cart is empty.</p>';
    return;
  }
  let subtotal = 0;
  const table = document.createElement('table');
  table.className = 'cart-table';
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>Product</th><th>Price</th><th>Qty</th><th>Total</th></tr>';
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  cart.forEach((item) => {
    const product = products.find((p) => p.id === item.id);
    if (!product) return;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${product.title}</td><td>€${product.price.toFixed(2)}</td><td>${item.quantity}</td><td>€${(product.price * item.quantity).toFixed(2)}</td>`;
    subtotal += product.price * item.quantity;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  const summaryDiv = document.createElement('div');
  summaryDiv.className = 'checkout-summary';
  const shipping = 0;
  const total = subtotal + shipping;
  summaryDiv.innerHTML =
    `<div class="summary-row"><span>Subtotal:</span><span>€${subtotal.toFixed(2)}</span></div>` +
    `<div class="summary-row"><span>Shipping:</span><span>${shipping > 0 ? '€' + shipping.toFixed(2) : 'Free'}</span></div>` +
    `<div class="summary-row"><strong>Total:</strong><strong id="orderTotal">€${total.toFixed(2)}</strong></div>`;
  detailDiv.appendChild(table);
  detailDiv.appendChild(summaryDiv);
  return total;
}

async function loadConfig() {
  const res = await fetch('/config.json');
  const cfg = await res.json();
  return cfg;
}

async function initPayPal() {
  const cfg = await loadConfig();
  const cart = getCart();
  if (cart.length === 0) {
    return;
  }
  // Create the order on the server
  async function createOrderOnServer() {
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: cart }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to create order');
    }
    return data.orderId;
  }
  // Dynamically load the PayPal script
  const scriptTag = document.getElementById('paypal-sdk');
  scriptTag.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(
    cfg.paypal_client_id
  )}&currency=EUR`;
  scriptTag.onload = async () => {
    const total = await displaySummary();
    window.paypal
      .Buttons({
        createOrder: async () => {
          // Order is created on the server and the ID returned
          return await createOrderOnServer();
        },
        onApprove: async (data, actions) => {
          // Capture the order on the server
          const response = await fetch(`/api/orders/${data.orderID}/capture`, {
            method: 'POST',
          });
          const result = await response.json();
          if (response.ok) {
            clearCart();
            window.location.href = '/success.html';
          } else {
            alert('Payment capture failed: ' + (result.error || 'unknown error'));
          }
        },
      })
      .render('#paypalContainer');
  };
}

document.addEventListener('DOMContentLoaded', () => {
  updateCartCount();
  displaySummary();
  initPayPal();
});