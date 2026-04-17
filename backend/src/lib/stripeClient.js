const Stripe = require('stripe');

let cachedSecret = null;
let cachedClient = null;

const normalizeKey = (raw) => {
  if (raw == null) return '';
  const s = String(raw).trim();
  if (!s) return '';
  return s;
};

const getStripeSecret = () => normalizeKey(process.env.STRIPE_SECRET_KEY);

const getStripePublishable = () => normalizeKey(process.env.STRIPE_PUBLISHABLE_KEY);

const getStripeWebhookSecret = () => normalizeKey(process.env.STRIPE_WEBHOOK_SECRET);

/** Lazily construct Stripe client so .env is respected and keys can be trimmed. */
const getStripe = () => {
  const secret = getStripeSecret();
  if (!secret) {
    cachedSecret = null;
    cachedClient = null;
    return null;
  }
  if (cachedSecret === secret && cachedClient) return cachedClient;
  cachedSecret = secret;
  cachedClient = new Stripe(secret);
  return cachedClient;
};

module.exports = {
  getStripe,
  getStripeSecret,
  getStripePublishable,
  getStripeWebhookSecret,
};
