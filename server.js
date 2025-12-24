const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// PayPal + DSers
const { createOrder, captureOrder } = require('./paypal');
const { forwardOrder } = require('./dsers');

// Paths
const DATA_DIR = path.join(__dirname, 'data');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const PUBLIC_DIR = path.join(__dirname, 'dropship', 'public');

// Helpers
function readJSON(file, fallback = []) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => (body += c));
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
  let relPath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = path.join(PUBLIC_DIR, relPath);

  if (!path.resolve(filePath).startsWith(path.resolve(PUBLIC_DIR))) {
    return false;
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return false;
  }

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  res.end(fs.readFileSync(filePath));
  return true;
}

// Server
const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname || '/';

  // Health check (Railway)
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }

  // Static files
  if ((req.method === 'GET' || req.method === 'HEAD') && !pathname.startsWith('/api')) {
    if (serveStatic(res, pathname)) return;
  }

  // API: products
  if (pathname === '/api/products' && req.method === 'GET') {
    const products = readJSON(PRODUCTS_FILE, []);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(products));
    return;
  }

  // API: create order
  if (pathname === '/api/orders' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const items = body.items || [];
      const products = readJSON(PRODUCTS_FILE, []);

      let total = 0;
      for (const item of items) {
        const p = products.find(x => x.id === item.id);
        if (p) total += p.price * (item.quantity || 1);
      }

      const paypalId = await createOrder(total);

      const orders = readJSON(ORDERS_FILE, []);
      orders.push({
        id: paypalId,
        items,
        total,
        status: 'pending',
        customer: body.customer || {}
      });
      writeJSON(ORDERS_FILE, orders);

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ orderId: paypalId }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // API: capture order
  if (pathname.startsWith('/api/orders/') && pathname.endsWith('/capture') && req.method === 'POST') {
    const orderId = pathname.split('/')[3];
    try {
      const result = await captureOrder(orderId);
      const orders = readJSON(ORDERS_FILE, []);
      const order = orders.find(o => o.id === orderId);
      if (order) {
        order.status = 'paid';
        writeJSON(ORDERS_FILE, orders);
        await forwardOrder(order);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'captured', result }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // Unknown API
  if (pathname.startsWith('/api')) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  // SPA fallback → always index.html
  if (serveStatic(res, '/')) return;

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

// Listen
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Dropshipping server listening on port ${PORT}`);
});
