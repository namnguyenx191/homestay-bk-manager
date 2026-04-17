const Homestay = require('../models/Homestay');

const normalizeKey = (raw) => (raw == null ? '' : String(raw).trim());

const buildCatalog = async () => {
  const rows = await Homestay.find({})
    .sort({ reviewCount: -1, rating: -1 })
    .limit(45)
    .select('title location pricePerNight rating reviewCount roomType')
    .lean();

  return rows.map((h) => ({
    id: String(h._id),
    title: h.title,
    location: h.location,
    pricePerNight: h.pricePerNight,
    rating: h.rating,
    reviewCount: h.reviewCount,
    roomType: h.roomType,
  }));
};

const buildSystemPrompt = (catalogJson) => `You are the AI assistant for "HomeStay Pro", a homestay booking website.

Capabilities:
1) Help users FIND homestays using ONLY the catalog JSON below (real listings in the database). Match budget, location keywords, room type, guest count, and ratings.
2) Help with PROBLEMS: how booking works, date selection, Stripe card payment vs bank transfer (QR + reference code), wishlist, chatting with hosts, and navigating to /search.

Rules:
- Be concise, friendly, and accurate. Reply in the same language the user uses (Vietnamese or English).
- If the catalog is empty, say no listings are published yet and suggest they try again later or contact support.
- When recommending specific properties, mention title, location, and price per night from the catalog.
- For EACH property you recommend, add on its OWN line this exact token so the app can link it: [HOMESTAY_ID:the24CharHexId]
  Example line after describing a place:
  [HOMESTAY_ID:674a1f77bcf86cd799439011]
- Do not invent listing IDs; only use ids from the catalog.
- If nothing fits, suggest broader search terms or a higher budget.
- For payment issues: explain that card needs Stripe keys on the server; bank transfer shows QR/reference after booking when configured.

Catalog (JSON):
${catalogJson}`;

const normalizeChatMessages = (rawMessages) => {
  if (!Array.isArray(rawMessages) || rawMessages.length === 0) return null;
  const messages = rawMessages
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({
      role: m.role,
      content: m.content.slice(0, 4000),
    }))
    .slice(-14);

  if (!messages.length || messages[messages.length - 1].role !== 'user') return null;
  return messages;
};

const providerError = (res, rawText, fallbackDetail, httpStatus = null) => {
  let detail =
    typeof rawText === 'string' ? rawText.slice(0, 2000) : String(fallbackDetail ?? '');
  let apiCode = typeof httpStatus === 'number' ? httpStatus : null;
  try {
    const j = JSON.parse(rawText);
    const err = j.error;
    if (err && typeof err === 'object') {
      if (typeof err.message === 'string' && err.message) detail = err.message;
      if (typeof err.code === 'number') apiCode = err.code;
      else if (typeof err.status === 'number') apiCode = err.status;
    }
  } catch {
    /* keep detail */
  }
  const d = (detail || '').toLowerCase();
  const quotaExceeded =
    apiCode === 429 ||
    d.includes('quota') ||
    d.includes('rate limit') ||
    d.includes('resource_exhausted');
  const message = quotaExceeded
    ? 'AI service quota exceeded. Enable billing or wait for limits to reset.'
    : 'AI provider error';
  return res.status(quotaExceeded ? 503 : 502).json({
    message,
    detail: detail.slice(0, 2000),
  });
};

const runOpenAI = async (res, apiKey, system, messages) => {
  const model = normalizeKey(process.env.OPENAI_MODEL) || 'gpt-4o-mini';
  const payload = {
    model,
    messages: [{ role: 'system', content: system }, ...messages],
    temperature: 0.5,
    max_tokens: 900,
  };

  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  const rawText = await r.text();
  if (!r.ok) return providerError(res, rawText, undefined, r.status);

  const data = JSON.parse(rawText);
  const reply = data.choices?.[0]?.message?.content?.trim() || '';
  if (!reply) return res.status(502).json({ message: 'Empty AI response' });
  return res.json({ reply });
};

const extractCohereReply = (data) => {
  const msg = data && typeof data === 'object' ? data.message : null;
  if (!msg) return '';
  const c = msg.content;
  if (typeof c === 'string') return c.trim();
  if (Array.isArray(c)) {
    return c
      .map((block) => {
        if (typeof block === 'string') return block;
        if (block && typeof block.text === 'string') return block.text;
        return '';
      })
      .join('')
      .trim();
  }
  return '';
};

/** Cohere Chat API v2 — key from https://dashboard.cohere.com/ (not a Gemini key). */
const runCohere = async (res, apiKey, system, messages) => {
  const model = normalizeKey(process.env.COHERE_MODEL) || 'command-r-08-2024';
  const cohereMessages = [
    { role: 'user', content: system },
    { role: 'assistant', content: 'Understood. I will follow these instructions and use only listing IDs from the catalog.' },
    ...messages.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    })),
  ];

  const r = await fetch('https://api.cohere.com/v2/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      stream: false,
      model,
      temperature: 0.5,
      max_tokens: 1024,
      messages: cohereMessages,
    }),
  });

  const rawText = await r.text();
  if (!r.ok) return providerError(res, rawText, undefined, r.status);

  let data;
  try {
    data = JSON.parse(rawText);
  } catch {
    return providerError(res, rawText, 'Invalid JSON from Cohere', r.status);
  }

  const reply = extractCohereReply(data);
  if (!reply) {
    return res.status(502).json({ message: 'Empty AI response', detail: rawText.slice(0, 200) });
  }
  return res.json({ reply });
};

const runGemini = async (res, apiKey, system, messages) => {
  let start = 0;
  while (start < messages.length && messages[start].role !== 'user') start += 1;
  const conv = messages.slice(start);
  if (!conv.length) {
    return res.status(400).json({ message: 'No user message' });
  }

  const contents = conv.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const model = normalizeKey(process.env.GEMINI_MODEL) || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents,
    generationConfig: {
      temperature: 0.5,
      maxOutputTokens: 1024,
    },
  };

  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const rawText = await r.text();
  if (!r.ok) return providerError(res, rawText, undefined, r.status);

  let data;
  try {
    data = JSON.parse(rawText);
  } catch {
    return providerError(res, rawText, 'Invalid JSON from Gemini', r.status);
  }

  if (data.promptFeedback?.blockReason) {
    return res.status(502).json({
      message: 'AI provider error',
      detail: `Blocked: ${data.promptFeedback.blockReason}`,
    });
  }

  const parts = data.candidates?.[0]?.content?.parts;
  const reply = Array.isArray(parts) ? parts.map((p) => p.text || '').join('').trim() : '';
  if (!reply) {
    return res.status(502).json({ message: 'Empty AI response', detail: rawText.slice(0, 200) });
  }
  return res.json({ reply });
};

const postAssistant = async (req, res) => {
  const messages = normalizeChatMessages(req.body.messages);
  if (!messages) {
    return res.status(400).json({ message: 'messages array required, last must be user' });
  }

  let catalog;
  try {
    catalog = await buildCatalog();
  } catch (e) {
    return res.status(500).json({ message: 'Could not load listings catalog' });
  }

  const system = buildSystemPrompt(JSON.stringify(catalog));

  const cohereKey = normalizeKey(process.env.COHERE_API_KEY);
  if (cohereKey) {
    try {
      return await runCohere(res, cohereKey, system, messages);
    } catch (err) {
      return res.status(500).json({ message: err.message || 'AI request failed' });
    }
  }

  const geminiKey = normalizeKey(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY);
  if (geminiKey) {
    try {
      return await runGemini(res, geminiKey, system, messages);
    } catch (err) {
      return res.status(500).json({ message: err.message || 'AI request failed' });
    }
  }

  const openaiKey = normalizeKey(process.env.OPENAI_API_KEY);
  if (openaiKey) {
    try {
      return await runOpenAI(res, openaiKey, system, messages);
    } catch (err) {
      return res.status(500).json({ message: err.message || 'AI request failed' });
    }
  }

  return res.status(503).json({
    message:
      'AI assistant is not configured. Set COHERE_API_KEY, GEMINI_API_KEY (Google AI), or OPENAI_API_KEY in backend/.env and restart the server.',
  });
};

const getAiStatus = (_req, res) => {
  const cohere = normalizeKey(process.env.COHERE_API_KEY);
  const gemini = normalizeKey(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY);
  const openai = normalizeKey(process.env.OPENAI_API_KEY);
  const configured = Boolean(cohere || gemini || openai);
  let provider = null;
  let model = '';
  if (cohere) {
    provider = 'cohere';
    model = normalizeKey(process.env.COHERE_MODEL) || 'command-r-08-2024';
  } else if (gemini) {
    provider = 'gemini';
    model = normalizeKey(process.env.GEMINI_MODEL) || 'gemini-2.0-flash';
  } else if (openai) {
    provider = 'openai';
    model = normalizeKey(process.env.OPENAI_MODEL) || 'gpt-4o-mini';
  }
  res.json({ configured, provider, model });
};

module.exports = { postAssistant, getAiStatus };
