const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// PayPal + DSers (keep these files in same folder as server.js)
let paypal = null;
let dsers = null;
try { paypal = require('./paypal'); } catch {}
try { dsers = require('./dsers'); } catch {}

const SEED_PRODUCTS = [
  {
    id: "gan65",
    title: "65W GaN Fast Charger",
    name: "65W GaN Fast Charger",
    price: 29.99,
    image: "https://placehold.co/800x800?text=65W+GaN+Charger",
    description: "Compact 65W GaN charger for phone/tablet/laptop. Great tech vibe product.",
    shippingTime: "7–12 days",
    rating: 4.7,
    reviews: [
      { name: "Alex", rating: 5, comment: "Small but super fast. Perfect." },
      { name: "Emma", rating: 4, comment: "Charges my laptop and phone." }
    ],
    aliexpressUrl: "https://www.aliexpress.com/wholesale?SearchText=65w+gan+charger"
  },
  {
    id: "magsafe",
    title: "Magnetic Wireless Charger",
    name: "Magnetic Wireless Charger",
    price: 24.99,
    image: "https://placehold.co/800x800?text=Magnetic+Wireless+Charger",
    description: "Magnetic snap-on wireless charger. Clean desk setup, TikTok-ready.",
    shippingTime: "6–10 days",
    rating: 4.6,
    reviews: [
      { name: "Daniel", rating: 5, comment: "Snaps perfectly, charges well." },
      { name: "Sarah", rating: 4, comment: "Looks premium for the price." }
    ],
    aliexpressUrl: "https://www.aliexpress.com/wholesale?SearchText=magnetic+wireless+charger"
  },
  {
    id: "powerbank",
    title: "20,000mAh Power Bank (Fast Charge)",
    name: "20,000mAh Power Bank (Fast Charge)",
    price: 39.99,
    image: "https://placehold.co/800x800?text=20000mAh+Power+Bank",
    description: "High capacity power bank with fast charging. Perfect upsell item.",
    shippingTime: "8–14 days",
    rating: 4.5,
    reviews: [
      { name: "Lucas", rating: 5, comment: "Lasts multiple days." },
      { name: "Noah", rating: 4, comment: "Strong power, a bit heavy." }
    ],
    aliexpressUrl: "https://www.aliexpress.com/wholesale?SearchText=20000mah+power+bank+usb+c"
  }
];

// --------- Auto-detect folders (fixes your nested dropship/ folder issues) ----------
function pickPaths() {
  const candidates = [
    { base: __dirname },
    { base: path.join(__dirname, 'dropship') },
    { base: process.cwd() },
    { base: path.join(process.cwd(), 'dropship') }
  ];

  for (const c of candidates) {
    const publicDir = path.join(c.base, 'public');
    const dataDir = path.join(c.base, 'data');
    if (fs.existsSync(publicDir) && fs.existsSync(dataDir)) {
      return { BASE: c.base, PUBLIC_DIR: publicDir, DATA_DIR: dataDir };
    }
  }

  // fallback (won't crash)
  return {
    BASE: __dirname,
    PUBLIC_DIR: path.join(__dirname, 'public'),
    DATA_DIR: path.join(__dirname, 'data')
  };
}

const { PUBLIC_DIR, DATA_DIR } = pickPaths();
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');

// Ensure data folder + files exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, JSON.stringify([], null, 2));

// If products file missing/empty -> seed it
function ensureProducts() {
  let products = [];
  try {
    products = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
  } catch {
    products = [];
  }
  if (!Array.isArray(products) || products.length === 0) {
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(SEED_PRODUCTS, null, 2));
    return SEED_PRODUCTS;
  }
  return products;
}

function readOrders() {
  try {
    return JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeOrders(orders) {
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch (e) {
        reject(e);
      }
    });
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function serveStatic(res, pathname) {
  const relPath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = path.join(PUBLIC_DIR, relPath);

  if (!path.resolve(filePath).startsWith(path.resolve(PUBLIC_DIR))) return false;
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return false;

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  res.end(fs.readFileSync(filePath));
  return true;
}

// Normalize products so frontend always has title/price/image
function normalizeProducts(list) {
  return (list || []).map(p => ({
    ...p,
    title: p.title || p.name || 'Untitled',
    name: p.name || p.title || 'Untitled',
    price: Number(p.price) || 0,
    image: p.image || "https://placehold.co/800x800?text=Product",
    description: p.description || "No description yet.",
    shippingTime: p.shippingTime || "7–15 days",
    rating: Number(p.rating) || 4.6,
    reviews: Array.isArray(p.reviews) ? p.reviews : []
  }));
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname || '/';

  // Health check
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }

  // Static
  if (req.method === 'GET' && !pathname.startsWith('/api')) {
    if (serveStatic(res, pathname)) return;
  }

  // API: products
  if (pathname === '/api/products' && req.method === 'GET') {
    const products = normalizeProducts(ensureProducts());
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(products));
    return;
  }

  // API: create order
  if (pathname === '/api/orders' && req.method === 'POST') {
    try {
      const payload = await parseJsonBody(req);
      const items = payload.items || [];
      const products = normalizeProducts(ensureProducts());

      let total = 0;
      for (const item of items) {
        const p = products.find(x => x.id === item.id);
        if (p) total += (p.price * (item.quantity || 1));
      }

      // If PayPal not configured, still create a fake order id so site works
      const orderId = paypal?.createOrder
        ? await paypal.createOrder(total)
        : `ORDER_${Date.now()}`;

      const orders = readOrders();
      orders.push({
        id: orderId,
        items,
        total,
        status: 'pending',
        customer: payload.customer || {}
      });
      writeOrders(orders);

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ orderId }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // API: capture order
  if (pathname.startsWith('/api/orders/') && pathname.endsWith('/capture') && req.method === 'POST') {
    const orderId = pathname.split('/')[3];
    try {
      const result = paypal?.captureOrder ? await paypal.captureOrder(orderId) : { ok: true };

      const orders = readOrders();
      const order = orders.find(o => o.id === orderId);
      if (order) {
        order.status = 'paid';
        writeOrders(orders);
        if (dsers?.forwardOrder) await dsers.forwardOrder(order);
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'captured', result }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Unknown API
  if (pathname.startsWith('/api')) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  // Fallback to homepage (prevents blank routes)
  if (serveStatic(res, '/')) return;

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Dropshipping server listening on port ${PORT}`);
  console.log(`PUBLIC_DIR = ${PUBLIC_DIR}`);
  console.log(`PRODUCTS_FILE = ${PRODUCTS_FILE}`);
});
