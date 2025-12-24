const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Import PayPal helper functions
const { createOrder: paypalCreateOrder, captureOrder: paypalCaptureOrder } = require('./paypal');
// Import DSers helper functions
const { forwardOrder } = require('./dsers');

// File paths for data storage
const PRODUCTS_FILE = path.join(__dirname, 'data', 'products.json');
const ORDERS_FILE = path.join(__dirname, 'data', 'orders.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

function readOrders() {
  try {
    const json = fs.readFileSync(ORDERS_FILE, 'utf8');
    return JSON.parse(json);
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
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch (err) {
        reject(err);
      }
    });
  });
}

function calculateTotal(items) {
  const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
  let total = 0;
  for (const item of items) {
    const product = products.find((p) => p.id === item.id);
    if (product) total += product.price * (item.quantity || 1);
  }
  return total;
}

// Basic content-type mapping
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

// Safer + more flexible static serving
function serveStatic(res, pathname) {
  // Normalize and stop directory traversal
  let safePath = decodeURIComponent(pathname || '/');
  if (safePath.includes('\0')) return false;

  // If "/" -> index.html
  if (safePath === '/') safePath = '/index.html';

  // If request ends with "/" -> serve that folder's index.html
  if (safePath.endsWith('/')) safePath = safePath + 'index.html';

  const filePath = path.join(PUBLIC_DIR, safePath);

  // Ensure file stays inside PUBLIC_DIR
  const resolvedPublic = path.resolve(PUBLIC_DIR);
  const resolvedFile = path.resolve(filePath);
  if (!resolvedFile.startsWith(resolvedPublic)) return false;

  if (!fs.existsSync(resolvedFile) || !fs.statSync(resolvedFile).isFile()) return false;

  const ext = path.extname(resolvedFile).toLowerCase();
  res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
  res.end(fs.readFileSync(resolvedFile));
  return true;
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname || '/';

  // Health check (helps Railway keep it alive)
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('ok');
    return;
  }

  // Serve static files for any non-API GET/HEAD
  if ((req.method === 'GET' || req.method === 'HEAD') && !pathname.startsWith('/api/')) {
    if (serveStatic(res, pathname)) return;
  }

  // API: GET /api/products
  if (pathname === '/api/products' && req.method === 'GET') {
    const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(products));
    return;
  }

  // API: POST /api/orders
  if (pathname === '/api/orders' && req.method === 'POST') {
    try {
      const payload = await parseJsonBody(req);
      const items = payload.items || [];
      const total = calculateTotal(items);

      const paypalOrderId = await paypalCreateOrder(total);

      const orders = readOrders();
      const order = {
        id: paypalOrderId,
        items,
        total,
        status: 'pending',
        customer: payload.customer || {},
      };
      orders.push(order);
      writeOrders(orders);

      res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ orderId: paypalOrderId }));
    } catch (err) {
      console.error(err);
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // API: POST /api/orders/{id}/capture
  if (pathname.startsWith('/api/orders/') && pathname.endsWith('/capture') && req.method === 'POST') {
    const segments = pathname.split('/');
    const orderId = segments[3];
    try {
      const captureResult = await paypalCaptureOrder(orderId);

      const orders = readOrders();
      const idx = orders.findIndex((o) => o.id === orderId);
      if (idx !== -1) {
        orders[idx].status = 'paid';
        writeOrders(orders);
        await forwardOrder(orders[idx]);
      }

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ status: 'captured', result: captureResult }));
    } catch (err) {
      console.error(err);
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 404 for unknown API endpoints
  if (pathname.startsWith('/api/')) {
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  // If someone hits a frontend route that doesn't exist, send them back to index.html
  // (so your site never shows "Not found" for normal browsing)
  if (req.method === 'GET' || req.method === 'HEAD') {
    if (serveStatic(res, '/index.html')) return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Dropshipping server listening on port ${PORT}`);
});
