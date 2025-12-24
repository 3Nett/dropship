// Display a single product page based on the query parameter id.

function getProductId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
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
  if (countEl) countEl.textContent = String(count);
}

function addToCart(productId) {
  const cart = getCart();
  const existing = cart.find((item) => item.id === productId);

  if (existing) existing.quantity += 1;
  else cart.push({ id: productId, quantity: 1 });

  saveCart(cart);
  updateCartCount();
  alert('Item added to cart');
}

async function fetchProducts() {
  const res = await fetch('/api/products');
  if (!res.ok) throw new Error('Failed to load products');
  return await res.json();
}

function safeText(v, fallback = '') {
  if (v === undefined || v === null) return fallback;
  return String(v);
}

function safeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function renderStars(rating) {
  const r = Math.max(0, Math.min(5, Math.round(safeNumber(rating, 0))));
  return '★'.repeat(r) + '☆'.repeat(5 - r);
}

function renderProduct(product) {
  const container = document.getElementById('productContainer');
  if (!container) return;

  container.innerHTML = '';

  const title = safeText(product.title, 'Untitled Product');
  const price = safeNumber(product.price, 0);
  const description = safeText(product.description, 'No description available.');
  const shippingTime = safeText(product.shippingTime, '7–15 days');
  const rating = safeNumber(product.rating, 4.6);
  const image = product.image || '/img/placeholder.jpg';
  const reviews = Array.isArray(product.reviews) ? product.reviews : [];

  // Card
  const card = document.createElement('div');
  card.className = 'card';

  const img = document.createElement('img');
  img.src = image;
  img.alt = title;
  img.onerror = () => {
    img.src = '/img/placeholder.jpg';
  };

  const content = document.createElement('div');
  content.className = 'card-content';

  const h2 = document.createElement('h2');
  h2.textContent = title;

  const priceEl = document.createElement('div');
  priceEl.className = 'price';
  priceEl.textContent = `€${price.toFixed(2)}`;

  const descEl = document.createElement('p');
  descEl.textContent = description;

  const shipEl = document.createElement('p');
  shipEl.textContent = `Shipping: ${shippingTime}`;

  const ratingEl = document.createElement('p');
  ratingEl.innerHTML = `Rating: <span class="rating">${renderStars(rating)}</span>`;

  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.textContent = 'Add to cart';
  btn.onclick = () => addToCart(product.id);

  content.appendChild(h2);
  content.appendChild(priceEl);
  content.appendChild(descEl);
  content.appendChild(shipEl);
  content.appendChild(ratingEl);
  content.appendChild(btn);

  // Optional AliExpress button
  if (product.aliexpressUrl) {
    const link = document.createElement('a');
    link.href = product.aliexpressUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className = 'btn';
    link.style.marginLeft = '10px';
    link.textContent = 'View on AliExpress';
    content.appendChild(link);
  }

  // Reviews
  const reviewsDiv = document.createElement('div');
  reviewsDiv.className = 'reviews';

  const reviewsTitle = document.createElement('h3');
  reviewsTitle.textContent = 'Customer Reviews';
  reviewsDiv.appendChild(reviewsTitle);

  if (reviews.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'review';
    empty.textContent = 'No reviews yet.';
    reviewsDiv.appendChild(empty);
  } else {
    reviews.forEach((rev) => {
      const revEl = document.createElement('div');
      revEl.className = 'review';

      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = safeText(rev.name, 'Anonymous');

      const rEl = document.createElement('div');
      rEl.className = 'rating';
      rEl.textContent = renderStars(rev.rating || 5);

      const comment = document.createElement('div');
      comment.className = 'comment';
      comment.textContent = safeText(rev.comment, '');

      revEl.appendChild(name);
      revEl.appendChild(rEl);
      revEl.appendChild(comment);
      reviewsDiv.appendChild(revEl);
    });
  }

  card.appendChild(img);
  card.appendChild(content);

  container.appendChild(card);
  container.appendChild(reviewsDiv);
}

async function init() {
  updateCartCount();

  const id = getProductId();
  if (!id) {
    const el = document.getElementById('productContainer');
    if (el) el.textContent = 'Missing product id.';
    return;
  }

  try {
    const products = await fetchProducts();
    const product = products.find((p) => String(p.id) === String(id));

    if (product) renderProduct(product);
    else {
      const el = document.getElementById('productContainer');
      if (el) el.textContent = 'Product not found.';
    }
  } catch (err) {
    console.error(err);
    const el = document.getElementById('productContainer');
    if (el) el.textContent = 'Error loading product.';
  }
}

document.addEventListener('DOMContentLoaded', init);
