import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useLanguage } from '../context/LanguageContext';

const InnerForm = ({ onSuccess, onBack, returnUrl }) => {
  const { tv } = useLanguage();
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: returnUrl || `${window.location.origin}/dashboard?payment=success`,
      },
      redirect: 'if_required',
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    onSuccess?.();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!stripe || busy}
          className="flex-1 rounded bg-emerald-600 py-2 text-white disabled:opacity-50"
        >
          {busy ? tv('Processing...', 'Đang xử lý...') : tv('Pay now', 'Thanh toán ngay')}
        </button>
        <button type="button" onClick={onBack} className="rounded border px-4 py-2">
          Back
        </button>
      </div>
    </form>
  );
};

const StripeInlinePayment = ({ publishableKey, clientSecret, onSuccess, onBack, returnUrl }) => {
  const { tv } = useLanguage();
  const stripePromise = useMemo(() => (publishableKey ? loadStripe(publishableKey) : null), [publishableKey]);

  if (!publishableKey || !clientSecret || !stripePromise) return null;

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <h2 className="mb-2 text-lg font-semibold">{tv('Card details', 'Thông tin thẻ')}</h2>
      <p className="mb-4 text-xs text-slate-600">
        {tv('Card data is processed by Stripe on this page — we do not store your full card number on our servers.', 'Dữ liệu thẻ được Stripe xử lý tại trang này — chúng tôi không lưu toàn bộ số thẻ trên máy chủ.')}
      </p>
      <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
        <InnerForm onSuccess={onSuccess} onBack={onBack} returnUrl={returnUrl} />
      </Elements>
    </div>
  );
};

export default StripeInlinePayment;
