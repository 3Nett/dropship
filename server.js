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

/**
 * Read orders from the JSON file.  If the file does not exist, an
 * empty array is returned.
 */
function readOrders() {
  try {
    const json = fs.readFileSync(ORDERS_FILE, 'utf8');
    return JSON.parse(json);
  } catch {
    return [];
  }
}

/**
 * Persist the orders array back to the file system.
 * @param {Array} orders
 */
function writeOrders(orders) {
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
}

/**
 * Serve a static file from the public directory.  Determines the
 * appropriate content type based on the file extension.  If the
 * requested file does not exist, returns false so the caller can
 * handle the request differently.
 * @param {http.ServerResponse} res
 * @param {string} pathname
 * @returns {boolean}
 */
function serveStatic(res, pathname) {
  const filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  if (filePath.indexOf(PUBLIC_DIR) !== 0) {
    // Prevent directory traversal
    return false;
  }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
    };
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
    return true;
  }
  return false;
}

/**
 * Parse JSON body from an incoming request.  Returns a promise that
 * resolves to the parsed object or rejects on error.
 * @param {http.IncomingMessage} req
 */
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        const json = JSON.parse(body || '{}');
        resolve(json);
      } catch (err) {
        reject(err);
      }
    });
  });
}

/**
 * Compute the total price of the items in the order.  Each item
 * should have an `id` and `quantity`.  The function reads the
 * product catalog to fetch unit prices.
 * @param {Array} items
 */
function calculateTotal(items) {
  const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
  let total = 0;
  items.forEach((item) => {
    const product = products.find((p) => p.id === item.id);
    if (product) {
      total += product.price * (item.quantity || 1);
    }
  });
  return total;
}

const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    // Serve static files
    if (req.method === 'GET' && !pathname.startsWith('/api')) {
      if (serveStatic(res, pathname)) {
        return;
      }
    }
    // API: GET /api/products
    if (pathname === '/api/products' && req.method === 'GET') {
      const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(products));
      return;
    }
    // API: POST /api/orders
    if (pathname === '/api/orders' && req.method === 'POST') {
      try {
        const payload = await parseJsonBody(req);
        const items = payload.items || [];
        const total = calculateTotal(items);
        // Create a PayPal order to obtain an order ID.  The order is not
        // captured yet.  The client will use this ID to approve the
        // payment in the PayPal popup.
        const paypalOrderId = await paypalCreateOrder(total);
        // Create local order record with status "pending"
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
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ orderId: paypalOrderId }));
      } catch (err) {
        console.error(err);
        res.writeHead(400, { 'Content-Type': 'application/json' });
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
        // Update local order status
        const orders = readOrders();
        const idx = orders.findIndex((o) => o.id === orderId);
        if (idx !== -1) {
          orders[idx].status = 'paid';
          writeOrders(orders);
          // Forward to DSers for fulfillment
          await forwardOrder(orders[idx]);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'captured', result: captureResult }));
      } catch (err) {
        console.error(err);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }
    // 404 for unknown API endpoints
    if (pathname.startsWith('/api/')) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }
    // Fallback: 404
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Dropshipping server listening on port ${PORT}`);
});
