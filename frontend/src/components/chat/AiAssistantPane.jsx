import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import client from '../../api/client';
import { useLanguage } from '../../context/LanguageContext';
import { useCurrency } from '../../context/CurrencyContext';

export const AiMessageContent = ({ text }) => {
  const { tv } = useLanguage();
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
              {tv('View listing', 'Xem tin')}
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

const AiAssistantPane = ({ variant = 'page' }) => {
  const { t, tv } = useLanguage();
  const { formatMoney } = useCurrency();
  const suggestions = useMemo(
    () => [
      tv(`Homestay under ${formatMoney(3000000)} with good reviews`, `Homestay dưới ${formatMoney(3000000)} có đánh giá tốt`),
      tv('How does bank transfer payment work?', 'Chuyển khoản ngân hàng hoạt động như thế nào?'),
      tv('Private room for 2 guests in Da Nang', 'Phòng riêng cho 2 khách ở Đà Nẵng'),
      tv('Explain Stripe card checkout on booking', 'Giải thích thanh toán thẻ Stripe khi đặt phòng'),
    ],
    [formatMoney, tv]
  );
  const [messages, setMessages] = useState(() => [
    {
      role: 'assistant',
      content:
        tv(
          'Hi! I can suggest homestays from our catalog, explain booking and payment (card or bank transfer), and help troubleshoot. What are you looking for?',
          'Xin chào! Tôi có thể gợi ý homestay, giải thích đặt phòng và thanh toán (thẻ/chuyển khoản), và hỗ trợ xử lý sự cố. Bạn đang tìm gì?'
        ),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiOn, setAiOn] = useState(null);

  const scrollClass =
    variant === 'widget'
      ? 'min-h-0 flex-1 space-y-2 overflow-y-auto rounded border border-slate-200 bg-slate-50 p-2'
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
      const text = combined || err.message || tv('Request failed', 'Yêu cầu thất bại');
      const shortToast = text.length > 140 ? `${text.slice(0, 137)}…` : text;
      toast.error(shortToast);
      const quotaHint = /quota|rate limit|resource_exhausted/i.test(text)
        ? tv(
            'This usually means the Google Gemini free tier or project quota is used up. In Google Cloud / AI Studio: enable billing, wait for the daily limit to reset, or use a new API key from a project with available quota.\n\n',
            'Điều này thường do vượt hạn mức miễn phí/quota Gemini. Vào Google Cloud / AI Studio để bật billing, chờ reset hạn mức ngày, hoặc dùng API key mới từ project còn quota.\n\n'
          )
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
              m.role === 'user'
                ? 'ml-auto border border-emerald-200 bg-emerald-100 text-slate-950'
                : 'border border-slate-200 bg-white text-slate-900 shadow-sm'
            }`}
          >
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-700">
              {m.role === 'user' ? tv('You', 'Bạn') : 'AI'}
            </p>
            <div className="text-slate-900">
              <AiMessageContent text={m.content} />
            </div>
          </div>
        ))}
        {loading && <p className="animate-pulse text-xs font-medium text-slate-700">{t('aiThinking')}</p>}
      </div>
      <div className="flex flex-wrap gap-1">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setInput(s)}
            className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-800 hover:border-[#006ce4] hover:text-[#003580]"
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
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900 placeholder:text-slate-500"
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
