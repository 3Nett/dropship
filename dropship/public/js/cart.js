// Manage the cart page: display items, update quantities, compute totals and
// handle checkout button activation.

function getCart() {
  try {
    return JSON.parse(localStorage.getItem('cart')) || [];
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem('cart', JSON.stringify(cart));
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

function removeItem(productId) {
  let cart = getCart();
  cart = cart.filter((item) => item.id !== productId);
  saveCart(cart);
  renderCart();
  updateCartCount();
}

function changeQuantity(productId, quantity) {
  const cart = getCart();
  const item = cart.find((i) => i.id === productId);
  if (item) {
    item.quantity = quantity;
    if (item.quantity < 1) item.quantity = 1;
    saveCart(cart);
    renderCart();
    updateCartCount();
  }
}

async function renderCart() {
  const cartBody = document.getElementById('cartBody');
  cartBody.innerHTML = '';
  const products = await fetchProducts();
  const cart = getCart();
  let subtotal = 0;
  cart.forEach((item) => {
    const product = products.find((p) => p.id === item.id);
    if (!product) return;
    const row = document.createElement('tr');
    // Product name
    const nameCell = document.createElement('td');
    nameCell.textContent = product.title;
    row.appendChild(nameCell);
    // Price
    const priceCell = document.createElement('td');
    priceCell.textContent = `€${product.price.toFixed(2)}`;
    row.appendChild(priceCell);
    // Quantity with input
    const qtyCell = document.createElement('td');
    const qtyInput = document.createElement('input');
    qtyInput.type = 'number';
    qtyInput.min = 1;
    qtyInput.value = item.quantity;
    qtyInput.onchange = (e) => changeQuantity(item.id, parseInt(e.target.value));
    qtyCell.appendChild(qtyInput);
    row.appendChild(qtyCell);
    // Total price for item
    const totalCell = document.createElement('td');
    const lineTotal = product.price * item.quantity;
    totalCell.textContent = `€${lineTotal.toFixed(2)}`;
    subtotal += lineTotal;
    row.appendChild(totalCell);
    // Remove button
    const removeCell = document.createElement('td');
    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn';
    removeBtn.textContent = 'Remove';
    removeBtn.onclick = () => removeItem(item.id);
    removeCell.appendChild(removeBtn);
    row.appendChild(removeCell);
    cartBody.appendChild(row);
  });
  document.getElementById('cartSubtotal').textContent = `€${subtotal.toFixed(2)}`;
  // Shipping is free for demonstration; adjust as needed
  const shipping = 0;
  document.getElementById('cartShipping').textContent = shipping > 0 ? `€${shipping.toFixed(2)}` : 'Free';
  const total = subtotal + shipping;
  document.getElementById('cartTotal').textContent = `€${total.toFixed(2)}`;
  // Disable checkout if cart empty
  const checkoutBtn = document.getElementById('checkoutBtn');
  if (cart.length === 0) {
    checkoutBtn.classList.add('disabled');
    checkoutBtn.onclick = (e) => {
      e.preventDefault();
      alert('Your cart is empty. Please add items before checking out.');
    };
  }
}

document.addEventListener('DOMContentLoaded', () => {
  updateCartCount();
  renderCart();
});