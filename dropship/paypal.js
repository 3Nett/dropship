const fs = require('fs');
const path = require('path');

// Load configuration from config.json.  This file contains your PayPal
// credentials and environment (sandbox or live).  The user must
// replace the placeholder values in config.json with real keys.
const config = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8')
);

// Determine the correct PayPal API base URL based on the environment
const PAYPAL_BASE =
  config.paypal.environment === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

/**
 * Obtain an OAuth access token from PayPal.  This token is required
 * for subsequent API requests.  It uses client credentials stored in
 * config.json.  Returns a promise that resolves to the access token
 * string.  See PayPal’s documentation for details on the token
 * request: https://developer.paypal.com/docs/api/get-an-access-token-curl/
 */
async function getAccessToken() {
  const basicAuth = Buffer.from(
    `${config.paypal.client_id}:${config.paypal.client_secret}`,
    'utf8'
  ).toString('base64');
  const response = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PayPal token request failed: ${text}`);
  }
  const data = await response.json();
  return data.access_token;
}

/**
 * Create a PayPal order.  The `total` parameter should be a number
 * representing the order total in EUR.  The function returns the
 * PayPal order ID.  See https://developer.paypal.com/docs/checkout/reference/server-integration/set-up-transaction/
 * for the expected payload structure.
 * @param {number} total
 */
async function createOrder(total) {
  const token = await getAccessToken();
  const response = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: 'EUR',
            value: total.toFixed(2),
          },
        },
      ],
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PayPal create order failed: ${text}`);
  }
  const data = await response.json();
  return data.id;
}

/**
 * Capture a PayPal order once the buyer has approved the payment in
 * the PayPal popup.  The `orderId` parameter is returned from
 * createOrder.  Returns the capture response from PayPal.
 * @param {string} orderId
 */
async function captureOrder(orderId) {
  const token = await getAccessToken();
  const response = await fetch(
    `${PAYPAL_BASE}/v2/checkout/orders/${orderId}/capture`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    }
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PayPal capture order failed: ${text}`);
  }
  return await response.json();
}

module.exports = {
  getAccessToken,
  createOrder,
  captureOrder,
};