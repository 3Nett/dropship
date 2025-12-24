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

async function fetchProducts() {
  const res = await fetch('/api/products');
  return await res.json();
}

function renderProduct(product) {
  const container = document.getElementById('productContainer');
  container.innerHTML = '';
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
  const shipping = document.createElement('p');
  shipping.textContent = `Shipping: ${product.shippingTime}`;
  const rating = document.createElement('p');
  rating.innerHTML = `Rating: <span class="rating">${'★'.repeat(
    Math.round(product.rating)
  )}</span>`;
  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.textContent = 'Add to cart';
  btn.onclick = () => addToCart(product.id);
  content.appendChild(h2);
  content.appendChild(price);
  content.appendChild(desc);
  content.appendChild(shipping);
  content.appendChild(rating);
  content.appendChild(btn);
  // Reviews section
  const reviewsDiv = document.createElement('div');
  reviewsDiv.className = 'reviews';
  const reviewsTitle = document.createElement('h3');
  reviewsTitle.textContent = 'Customer Reviews';
  reviewsDiv.appendChild(reviewsTitle);
  product.reviews.forEach((rev) => {
    const revEl = document.createElement('div');
    revEl.className = 'review';
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = rev.name;
    const ratingEl = document.createElement('div');
    ratingEl.className = 'rating';
    ratingEl.textContent = '★'.repeat(rev.rating);
    const comment = document.createElement('div');
    comment.className = 'comment';
    comment.textContent = rev.comment;
    revEl.appendChild(name);
    revEl.appendChild(ratingEl);
    revEl.appendChild(comment);
    reviewsDiv.appendChild(revEl);
  });
  card.appendChild(img);
  card.appendChild(content);
  container.appendChild(card);
  container.appendChild(reviewsDiv);
}

async function init() {
  updateCartCount();
  const id = getProductId();
  const products = await fetchProducts();
  const product = products.find((p) => p.id === id);
  if (product) {
    renderProduct(product);
  } else {
    document.getElementById('productContainer').textContent = 'Product not found.';
  }
}

document.addEventListener('DOMContentLoaded', init);