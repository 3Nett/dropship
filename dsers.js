const fs = require('fs');
const path = require('path');

// Load DSers configuration from config.json.  Replace the
// placeholders in config.json with your DSers API credentials.  See
// DSers developer documentation for details:
// https://www.dsers.dev/docs
const config = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8')
);

const DSERS_BASE = 'https://openapi.dsers.com';

/**
 * Forward a customer order to your DSers account.  This function
 * demonstrates how you might interact with the DSers API to create an
 * order on AliExpress.  At a minimum you must provide the buyer’s
 * address, contact information and a list of order items.  See DSers
 * API documentation for the required fields.
 *
 * NOTE: This implementation is a placeholder.  DSers requires an
 * access token (API key and secret) and specific endpoints for
 * creating orders.  You should implement the request according to
 * DSers’ API specification once you have your credentials.
 * @param {object} order - The order object containing items and shipping info
 */
async function forwardOrder(order) {
  if (!config.dsers.api_key || !config.dsers.api_secret) {
    console.warn(
      'DSers credentials are missing.  Cannot forward order automatically.'
    );
    return { status: 'skipped', message: 'DSers credentials missing' };
  }
  // Pseudo-code demonstrating the request structure.  The real API
  // may differ.  Please refer to DSers developer docs for
  // authentication and endpoint details.
  try {
    const resp = await fetch(`${DSERS_BASE}/createOrder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': config.dsers.api_key,
        'X-API-SECRET': config.dsers.api_secret,
      },
      body: JSON.stringify(order),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`DSers order forwarding failed: ${text}`);
    }
    return await resp.json();
  } catch (err) {
    console.error(err);
    return { status: 'error', message: err.message };
  }
}

/**
 * Synchronize inventory and pricing from DSers to the local store.  This
 * function should be scheduled periodically (e.g. via cron) to fetch
 * current stock levels and pricing from your AliExpress suppliers and
 * update the local products database.  When DSers API access is not
 * available, this function simply logs a message.
 */
async function syncInventory() {
  if (!config.dsers.api_key || !config.dsers.api_secret) {
    console.warn(
      'DSers credentials are missing.  Inventory sync skipped.'
    );
    return;
  }
  // Example request to DSers to fetch product info.  Replace with
  // actual endpoint and parameters.  DSers may return a list of
  // products with their current inventory and price.
  try {
    const resp = await fetch(`${DSERS_BASE}/products`, {
      method: 'GET',
      headers: {
        'X-API-KEY': config.dsers.api_key,
        'X-API-SECRET': config.dsers.api_secret,
      },
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`DSers inventory sync failed: ${text}`);
    }
    const data = await resp.json();
    // Example: iterate through local products and update inventory and price
    const localPath = path.join(__dirname, 'data', 'products.json');
    const products = JSON.parse(fs.readFileSync(localPath, 'utf8'));
    let updated = false;
    data.products.forEach((remote) => {
      const idx = products.findIndex((p) => p.id === remote.id);
      if (idx !== -1) {
        products[idx].inventory = remote.inventory;
        products[idx].price = remote.price;
        updated = true;
      }
    });
    if (updated) {
      fs.writeFileSync(localPath, JSON.stringify(products, null, 2));
    }
  } catch (err) {
    console.error(err);
  }
}

module.exports = {
  forwardOrder,
  syncInventory,
};
