/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');

const API_BASE = (process.env.BOT_API_BASE || '').replace(/\/$/, '');
const BOT_SYNC_TOKEN = String(process.env.BOT_SYNC_TOKEN || '').trim();
const IMAP_HOST = process.env.BOT_IMAP_HOST || 'imap.gmail.com';
const IMAP_PORT = Number(process.env.BOT_IMAP_PORT || 993);
const EMAIL_USER = process.env.BOT_EMAIL_USER;
const EMAIL_PASS = process.env.BOT_EMAIL_PASS;
const FROM_FILTERS = String(process.env.BOT_EMAIL_FROM_FILTER || 'momo,mbbank,mb bank,vietqr')
  .split(',')
  .map((x) => x.trim().toLowerCase())
  .filter(Boolean);
const MAX_FETCH_PER_RUN = Math.max(1, Number(process.env.BOT_MAX_FETCH_PER_RUN || 20));
const RECENT_DAYS = Math.max(1, Number(process.env.BOT_RECENT_DAYS || 7));
const POLL_SECONDS = Math.max(10, Number(process.env.BOT_POLL_SECONDS || 30));
const ENABLE_AUTO_SYNC = String(process.env.BOT_AUTO_SYNC || 'true').trim() !== 'false';

const STATE_FILE = path.join(__dirname, '../../bots/.bank-mail-bot-state.json');
const REF_REGEX = /\b(HS|AO)[-\s]?([A-Z0-9]{6,12})\b/gi;
const MONEY_REGEX = /(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+[.,]\d{1,2})\s?(VND|VNĐ)?/gi;

let started = false;
let timer = null;

const toNumber = (value) => Number(String(value || '').replace(/[^\d]/g, '')) || 0;
const parseMoneyToken = (token) => {
  const s = String(token || '').trim();
  if (!s) return 0;
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) {
    const n = Number.parseFloat(s.replace(/,/g, ''));
    return Number.isFinite(n) ? Math.round(n) : toNumber(s);
  }
  if (hasComma && !hasDot) {
    const parts = s.split(',');
    const last = parts[parts.length - 1] || '';
    if (last.length === 3) return toNumber(s);
    const n = Number.parseFloat(s.replace(',', '.'));
    return Number.isFinite(n) ? Math.round(n) : toNumber(s);
  }
  if (!hasComma && hasDot) {
    const parts = s.split('.');
    const last = parts[parts.length - 1] || '';
    if (last.length === 3) return toNumber(s);
    const n = Number.parseFloat(s);
    return Number.isFinite(n) ? Math.round(n) : toNumber(s);
  }
  return toNumber(s);
};

const extractReference = (text) => {
  if (!text) return '';
  const normalized = String(text).toUpperCase();
  const m = REF_REGEX.exec(normalized);
  REF_REGEX.lastIndex = 0;
  if (!m) return '';
  const prefix = String(m[1] || '').toUpperCase();
  const tail = String(m[2] || '').toUpperCase();
  if (!prefix || !tail) return '';
  return `${prefix}-${tail}`;
};

const extractAmount = (text) => {
  if (!text) return 0;
  const matches = [...String(text).matchAll(MONEY_REGEX)];
  if (!matches.length) return 0;
  const values = matches.map((m) => parseMoneyToken(m[1])).filter((n) => Number.isFinite(n) && n > 0);
  if (!values.length) return 0;
  return Math.max(...values);
};

const loadState = () => {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return { lastUid: Number(parsed.lastUid) || 0 };
  } catch {
    return { lastUid: 0 };
  }
};

const saveState = (state) => {
  fs.writeFileSync(STATE_FILE, JSON.stringify({ lastUid: Number(state.lastUid) || 0 }, null, 2));
};

const postConfirm = async ({ reference, amount, source }) => {
  const res = await fetch(`${API_BASE}/bookings/bot/confirm-transfer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-bot-token': BOT_SYNC_TOKEN,
    },
    body: JSON.stringify({ reference, amount, source }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
  return data;
};

const processInboxOnce = async () => {
  const client = new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: true,
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
    logger: false,
  });
  client.on('error', (err) => {
    console.error('[bank-mail-bot][IMAP ERROR]', err?.message || err);
  });

  try {
    await client.connect();
    await client.mailboxOpen('INBOX');

    const since = new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000);
    const allUids = await client.search({ since });
    const targetUids = allUids.slice(-MAX_FETCH_PER_RUN);
    const state = loadState();
    let processed = 0;
    let scanned = 0;
    let maxUidSeen = state.lastUid;

    for await (const msg of client.fetch(targetUids, { uid: true, source: true, envelope: true, flags: true })) {
      const uid = Number(msg.uid || 0);
      if (uid <= state.lastUid) continue;
      if (uid > maxUidSeen) maxUidSeen = uid;
      scanned += 1;

      const from = (msg.envelope?.from || [])
        .map((it) => `${it.name || ''} ${it.address || ''}`.trim().toLowerCase())
        .join(' ');
      if (!FROM_FILTERS.some((needle) => from.includes(needle))) continue;

      const parsed = await simpleParser(msg.source);
      const text = `${parsed.subject || ''}\n${parsed.text || ''}\n${parsed.html || ''}`;
      const reference = extractReference(text);
      const amount = extractAmount(text);
      if (!reference && !amount) continue;

      try {
        const result = await postConfirm({
          reference,
          amount,
          source: 'bank_email_server',
        });
        console.log('[bank-mail-bot][SYNC OK]', reference || '-', amount || 0, result.scope || '');
        processed += 1;
      } catch (err) {
        console.error('[bank-mail-bot][SYNC FAIL]', reference || '-', err.message);
      }
    }

    if (maxUidSeen > state.lastUid) {
      saveState({ lastUid: maxUidSeen });
    }

    if (scanned > 0 || processed > 0) {
      console.log('[bank-mail-bot] scanned:', scanned, 'processed:', processed);
    }
  } finally {
    try {
      await client.logout();
    } catch (_e) {
      // ignore
    }
  }
};

const shouldRun = () => {
  if (!ENABLE_AUTO_SYNC) return { ok: false, reason: 'BOT_AUTO_SYNC=false' };
  if (!BOT_SYNC_TOKEN) return { ok: false, reason: 'Missing BOT_SYNC_TOKEN' };
  if (!EMAIL_USER || !EMAIL_PASS) return { ok: false, reason: 'Missing BOT_EMAIL_USER/BOT_EMAIL_PASS' };
  if (!API_BASE) return { ok: false, reason: 'Missing BOT_API_BASE' };
  return { ok: true, reason: '' };
};

const startBankMailBot = () => {
  if (started) return;
  started = true;

  const check = shouldRun();
  if (!check.ok) {
    console.log(`[bank-mail-bot] disabled: ${check.reason}`);
    return;
  }

  console.log(`[bank-mail-bot] enabled, polling every ${POLL_SECONDS}s`);
  const runLoop = async () => {
    try {
      await processInboxOnce();
    } catch (err) {
      console.error('[bank-mail-bot][LOOP FAIL]', err?.message || err);
    } finally {
      timer = setTimeout(runLoop, POLL_SECONDS * 1000);
    }
  };
  runLoop();
};

const stopBankMailBot = () => {
  if (timer) clearTimeout(timer);
  timer = null;
  started = false;
};

module.exports = {
  startBankMailBot,
  stopBankMailBot,
};
