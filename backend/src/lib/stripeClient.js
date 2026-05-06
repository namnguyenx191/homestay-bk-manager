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

const detectKeyMode = (key) => {
  const normalized = normalizeKey(key);
  if (!normalized) return 'none';
  if (normalized.startsWith('sk_live_') || normalized.startsWith('pk_live_') || normalized.startsWith('whsec_live_')) return 'live';
  if (normalized.startsWith('sk_test_') || normalized.startsWith('pk_test_') || normalized.startsWith('whsec_')) return 'test';
  return 'unknown';
};

const getStripeSecretMode = () => detectKeyMode(getStripeSecret());
const getStripePublishableMode = () => detectKeyMode(getStripePublishable());

const isStripeModeMismatch = () => {
  const secretMode = getStripeSecretMode();
  const publishableMode = getStripePublishableMode();
  if (secretMode === 'none' || publishableMode === 'none') return false;
  if (secretMode === 'unknown' || publishableMode === 'unknown') return false;
  return secretMode !== publishableMode;
};

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
  getStripeSecretMode,
  getStripePublishableMode,
  isStripeModeMismatch,
};
