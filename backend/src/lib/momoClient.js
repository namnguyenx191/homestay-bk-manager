const crypto = require('crypto');

const trim = (v) => String(v || '').trim();

const getMomoConfig = () => {
  const partnerCode = trim(process.env.MOMO_PARTNER_CODE);
  const accessKey = trim(process.env.MOMO_ACCESS_KEY);
  const secretKey = trim(process.env.MOMO_SECRET_KEY);
  const endpoint = trim(process.env.MOMO_ENDPOINT) || 'https://test-payment.momo.vn/v2/gateway/api/create';
  const redirectUrl = trim(process.env.MOMO_REDIRECT_URL);
  const ipnUrl = trim(process.env.MOMO_IPN_URL);

  return {
    partnerCode,
    accessKey,
    secretKey,
    endpoint,
    redirectUrl,
    ipnUrl,
  };
};

const isMomoConfigured = () => {
  const cfg = getMomoConfig();
  return Boolean(cfg.partnerCode && cfg.accessKey && cfg.secretKey && cfg.redirectUrl && cfg.ipnUrl);
};

const signPayload = (payload, secretKey) =>
  crypto.createHmac('sha256', secretKey).update(payload).digest('hex');

const createMomoPayment = async ({
  amount,
  orderId,
  orderInfo,
  requestId,
  extraData = '',
  requestType = 'captureWallet',
  lang = 'vi',
}) => {
  const cfg = getMomoConfig();
  if (!isMomoConfigured()) {
    throw new Error('MoMo is not configured. Set MOMO_PARTNER_CODE, MOMO_ACCESS_KEY, MOMO_SECRET_KEY, MOMO_REDIRECT_URL, MOMO_IPN_URL');
  }

  const normalizedAmount = Number(amount);
  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    throw new Error('Invalid MoMo amount');
  }

  const rawSignature =
    `accessKey=${cfg.accessKey}` +
    `&amount=${Math.round(normalizedAmount)}` +
    `&extraData=${extraData}` +
    `&ipnUrl=${cfg.ipnUrl}` +
    `&orderId=${orderId}` +
    `&orderInfo=${orderInfo}` +
    `&partnerCode=${cfg.partnerCode}` +
    `&redirectUrl=${cfg.redirectUrl}` +
    `&requestId=${requestId}` +
    `&requestType=${requestType}`;

  const signature = signPayload(rawSignature, cfg.secretKey);

  const body = {
    partnerCode: cfg.partnerCode,
    partnerName: 'Homestay Booking',
    storeId: 'HomestayBooking',
    requestId,
    amount: String(Math.round(normalizedAmount)),
    orderId,
    orderInfo,
    redirectUrl: cfg.redirectUrl,
    ipnUrl: cfg.ipnUrl,
    lang,
    requestType,
    autoCapture: true,
    extraData,
    signature,
  };

  const response = await fetch(cfg.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || `MoMo request failed with status ${response.status}`);
  }

  return data;
};

module.exports = {
  getMomoConfig,
  isMomoConfigured,
  createMomoPayment,
};
