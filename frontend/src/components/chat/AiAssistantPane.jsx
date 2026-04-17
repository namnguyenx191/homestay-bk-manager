import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import client from '../../api/client';
import { useLanguage } from '../../context/LanguageContext';

export const AiMessageContent = ({ text }) => {
  const parts = String(text).split(/(\[HOMESTAY_ID:[a-f0-9]{24}\])/gi);
  return (
    <>
      {parts.map((part, i) => {
        const m = part.match(/^\[HOMESTAY_ID:([a-f0-9]{24})\]$/i);
        if (m) {
          return (
            <Link
              key={`id-${m[1]}-${i}`}
              to={`/homestays/${m[1]}`}
              className="my-1 inline-block rounded-md bg-[#e7f3ff] px-2 py-1 text-xs font-semibold text-[#006ce4] underline decoration-[#006ce4]/50 hover:bg-[#d4e9fc]"
            >
              View listing
            </Link>
          );
        }
        return (
          <span key={i} className="whitespace-pre-wrap">
            {part}
          </span>
        );
      })}
    </>
  );
};

const SUGGESTIONS = [
  'Homestay under $80 with good reviews',
  'How does bank transfer payment work?',
  'Private room for 2 guests in Da Nang',
  'Explain Stripe card checkout on booking',
];

const AiAssistantPane = ({ variant = 'page' }) => {
  const { t } = useLanguage();
  const [messages, setMessages] = useState(() => [
    {
      role: 'assistant',
      content:
        'Hi! I can suggest homestays from our catalog, explain booking and payment (card or bank transfer), and help troubleshoot. What are you looking for?',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiOn, setAiOn] = useState(null);

  const scrollClass =
    variant === 'widget'
      ? 'min-h-0 flex-1 space-y-2 overflow-y-auto rounded border border-slate-100 bg-slate-50/50 p-2'
      : 'mb-3 h-96 space-y-2 overflow-y-auto rounded border border-slate-200 bg-slate-50/30 p-2';

  useEffect(() => {
    let cancelled = false;
    client
      .get('/ai/status')
      .then(({ data }) => {
        if (!cancelled) setAiOn(data.configured);
      })
      .catch(() => {
        if (!cancelled) setAiOn(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const send = async (e) => {
    e.preventDefault();
    const userText = input.trim();
    if (!userText || loading) return;
    const history = [...messages, { role: 'user', content: userText }];
    setMessages(history);
    setInput('');
    setLoading(true);
    try {
      const { data } = await client.post('/ai/assistant', {
        messages: history.map(({ role, content }) => ({ role, content })),
      });
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      const d = err.response?.data || {};
      const detail = typeof d.detail === 'string' ? d.detail.trim() : '';
      const msg = typeof d.message === 'string' ? d.message.trim() : '';
      const combined = [msg, detail].filter(Boolean).join('\n\n');
      const text = combined || err.message || 'Request failed';
      const shortToast = text.length > 140 ? `${text.slice(0, 137)}…` : text;
      toast.error(shortToast);
      const quotaHint = /quota|rate limit|resource_exhausted/i.test(text)
        ? 'This usually means the Google Gemini free tier or project quota is used up. In Google Cloud / AI Studio: enable billing, wait for the daily limit to reset, or use a new API key from a project with available quota.\n\n'
        : '';
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `${t('aiSorry')}\n\n${quotaHint}${text}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {aiOn === false && (
        <p className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
          {t('aiConfigMissing')}
        </p>
      )}
      <div className={scrollClass}>
        {messages.map((m, i) => (
          <div
            key={`${i}-${m.role}-${String(m.content).slice(0, 20)}`}
            className={`max-w-[92%] rounded-lg p-2.5 text-sm ${
              m.role === 'user' ? 'ml-auto bg-emerald-100 text-slate-900' : 'bg-white shadow-sm ring-1 ring-slate-100'
            }`}
          >
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              {m.role === 'user' ? 'You' : 'AI'}
            </p>
            <div className="text-slate-800">
              <AiMessageContent text={m.content} />
            </div>
          </div>
        ))}
        {loading && <p className="animate-pulse text-xs text-slate-500">{t('aiThinking')}</p>}
      </div>
      <div className="flex flex-wrap gap-1">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setInput(s)}
            className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-700 hover:border-[#006ce4] hover:text-[#003580]"
          >
            {s}
          </button>
        ))}
      </div>
      <form onSubmit={send} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('aiPlaceholder')}
          className="min-w-0 flex-1 rounded-lg border border-slate-200 p-2 text-sm"
        />
        <button
          type="submit"
          disabled={loading}
          className="shrink-0 rounded-lg bg-[#003580] px-4 py-2 text-sm font-semibold text-white hover:bg-[#00224d] disabled:opacity-50"
        >
          {t('aiSend')}
        </button>
      </form>
    </div>
  );
};

export default AiAssistantPane;
