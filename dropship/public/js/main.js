// Fetch and display products on the home page.  Attach event listeners
// to add products to the cart stored in localStorage.

async function fetchProducts() {
  const res = await fetch('/api/products');
  if (!res.ok) {
    console.error('Failed to fetch products');
    return [];
  }
  return await res.json();
}

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

function addToCart(productId) {
  const cart = getCart();
  const existing = cart.find((item) => item.id === productId);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ id: productId, quantity: 1 });
  }
  saveCart(cart);
  updateCartCount();
  alert('Item added to cart');
}

function createProductCard(product) {
  const card = document.createElement('div');
  card.className = 'card';
  const img = document.createElement('img');
  img.src = product.image;
  img.alt = product.title;
  const content = document.createElement('div');
  content.className = 'card-content';
  const h2 = document.createElement('h2');
  h2.textContent = product.title;
  const price = document.createElement('div');
  price.className = 'price';
  price.textContent = `€${product.price.toFixed(2)}`;
  const desc = document.createElement('p');
  desc.textContent = product.description;
  const badgeContainer = document.createElement('div');
  badgeContainer.className = 'trust-badges';
  // Trust badges: secure checkout and fast shipping
  const badges = [
    { icon: '🔒', text: 'SSL Secured Checkout' },
    { icon: '🚚', text: `Shipping: ${product.shippingTime}` },
  ];
  badges.forEach((b) => {
    const badge = document.createElement('div');
    badge.className = 'badge';
    badge.textContent = `${b.icon} ${b.text}`;
    badgeContainer.appendChild(badge);
  });
  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.textContent = 'Add to cart';
  btn.onclick = () => addToCart(product.id);
  // Wrap image in a link to product page
  const link = document.createElement('a');
  link.href = `/product.html?id=${encodeURIComponent(product.id)}`;
  link.appendChild(img);
  card.appendChild(link);
  content.appendChild(h2);
  content.appendChild(price);
  content.appendChild(desc);
  content.appendChild(badgeContainer);
  content.appendChild(btn);
  card.appendChild(content);
  return card;
}

async function init() {
  updateCartCount();
  const products = await fetchProducts();
  const grid = document.getElementById('productGrid');
  products.forEach((product) => {
    const card = createProductCard(product);
    grid.appendChild(card);
  });
}

document.addEventListener('DOMContentLoaded', init);