import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import client from '../api/client';
import StripeInlinePayment from '../components/StripeInlinePayment';
import { resolveAssetUrl } from '../utils/resolveAssetUrl';
import { useLanguage } from '../context/LanguageContext';
import { useCurrency } from '../context/CurrencyContext';

const BookingPage = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [homestay, setHomestay] = useState(null);
  const [form, setForm] = useState({
    checkInDate: location.state?.prefilledCheckIn || '',
    checkOutDate: location.state?.prefilledCheckOut || '',
  });
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [cardEntryMode, setCardEntryMode] = useState('inline');
  const [bankNote, setBankNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [bankTransferResult, setBankTransferResult] = useState(null);
  const [bankInfoPreview, setBankInfoPreview] = useState(null);
  const [payCaps, setPayCaps] = useState(undefined);
  const [stripeStep, setStripeStep] = useState(null);
  const [selectedAddOns, setSelectedAddOns] = useState({});
  const [pulseMap, setPulseMap] = useState({});
  const [devCardForm, setDevCardForm] = useState({
    holderName: '',
    cardNumber: '',
    expiry: '',
    cvc: '',
  });
  const { tv } = useLanguage();
  const { formatMoney } = useCurrency();

  const cardCheckoutBlocked = paymentMethod === 'card' && cardEntryMode === 'checkout' && payCaps && !payCaps.cardCheckoutAvailable;
  const cardInlineBlocked = paymentMethod === 'card' && cardEntryMode === 'inline' && payCaps && !payCaps.cardInlineAvailable;
  const isDevCardFallback = payCaps?.cardMode === 'dev_fallback';

  const nights = useMemo(() => {
    if (!form.checkInDate || !form.checkOutDate) return 0;
    return Math.ceil((new Date(form.checkOutDate) - new Date(form.checkInDate)) / (1000 * 60 * 60 * 24));
  }, [form]);
  const subtotal = nights * (homestay?.pricePerNight || 0);
  const serviceFee = Math.round(subtotal * 0.12);
  const addOnsTotal = (homestay?.serviceAddOns || []).reduce((sum, item) => {
    const qty = Number(selectedAddOns[item.name] || 0);
    const unitPrice = Number(item.price || 0);
    return sum + qty * unitPrice;
  }, 0);
  const total = subtotal + serviceFee + addOnsTotal;

  useEffect(() => {
    client.get(`/homestays/${id}`).then(({ data }) => setHomestay(data)).catch(() => {
      toast.error(tv('Could not load homestay info', 'Không thể tải thông tin homestay'));
    });
  }, [id]);

  useEffect(() => {
    client.get('/bookings/bank-transfer-info').then(({ data }) => setBankInfoPreview(data)).catch(() => {});
  }, []);

  useEffect(() => {
    client
      .get('/bookings/payment-capabilities')
      .then(({ data }) => setPayCaps(data))
      .catch(() => setPayCaps(null));
  }, []);

  useEffect(() => {
    if (!payCaps) return;
    setPaymentMethod((pm) => {
      if (pm !== 'card') return pm;
      if (payCaps.cardCheckoutAvailable || payCaps.cardInlineAvailable) return pm;
      return 'bank_transfer';
    });
  }, [payCaps]);

  useEffect(() => {
    if (!payCaps) return;
    setCardEntryMode((mode) => {
      if (mode === 'checkout' && !payCaps.cardCheckoutAvailable && payCaps.cardInlineAvailable) return 'inline';
      if (mode === 'inline' && !payCaps.cardInlineAvailable && payCaps.cardCheckoutAvailable) return 'checkout';
      return mode;
    });
  }, [payCaps]);

  const abandonStripeInline = async () => {
    if (stripeStep?.bookingId) {
      try {
        await client.delete(`/bookings/${stripeStep.bookingId}/pending`);
      } catch {
        /* ignore */
      }
    }
    setStripeStep(null);
  };

  const triggerPlusPulse = (key) => {
    setPulseMap((prev) => ({ ...prev, [key]: true }));
    window.setTimeout(() => {
      setPulseMap((prev) => ({ ...prev, [key]: false }));
    }, 260);
  };

  const copyText = async (value, successMsg, failMsg) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(String(value));
      toast.success(successMsg);
    } catch {
      toast.error(failMsg);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (
      paymentMethod === 'card' &&
      isDevCardFallback &&
      (!devCardForm.holderName.trim() || !devCardForm.cardNumber.trim() || !devCardForm.expiry.trim() || !devCardForm.cvc.trim())
    ) {
      toast.error(tv('Please fill all card fields.', 'Vui lòng nhập đầy đủ thông tin thẻ.'));
      return;
    }
    setLoading(true);
    setBankTransferResult(null);
    setStripeStep(null);
    const requestCardMode =
      paymentMethod === 'card'
        ? cardEntryMode === 'inline' && payCaps?.cardInlineAvailable === false && payCaps?.cardCheckoutAvailable
          ? 'checkout'
          : cardEntryMode
        : undefined;
    try {
      const { data } = await client.post('/bookings', {
        homestayId: id,
        checkInDate: form.checkInDate,
        checkOutDate: form.checkOutDate,
        paymentMethod,
        cardEntryMode: requestCardMode,
        bankTransferNote: paymentMethod === 'bank_transfer' ? bankNote : undefined,
        selectedAddOns: Object.entries(selectedAddOns)
          .map(([serviceName, quantity]) => ({ serviceName, quantity: Number(quantity || 0) }))
          .filter((item) => item.quantity > 0),
      });

      if (data.checkoutUrl) {
        toast.success(tv('Redirecting to Stripe Checkout...', 'Đang chuyển đến Stripe Checkout...'));
        window.location.href = data.checkoutUrl;
        return;
      }

      if (data.clientSecret && data.stripePublishableKey && data.booking?._id) {
        setStripeStep({
          clientSecret: data.clientSecret,
          publishableKey: data.stripePublishableKey,
          bookingId: data.booking._id,
        });
        toast.success(tv('Enter your card below. Details are sent securely to Stripe.', 'Nhập thẻ bên dưới. Dữ liệu được gửi an toàn tới Stripe.'));
        return;
      }

      if (data.bankTransfer) {
        setBankTransferResult(data.bankTransfer);
        toast.success(tv('Booking created. Complete the bank transfer using the details below.', 'Đã tạo đơn. Hoàn tất chuyển khoản theo thông tin bên dưới.'));
        return;
      }

      toast.success(tv('Booking created', 'Đã tạo đơn đặt chỗ'));
      navigate('/dashboard');
    } catch (error) {
      const serverMsg = error.response?.data?.message || '';
      if (paymentMethod === 'card' && requestCardMode === 'inline' && payCaps?.cardCheckoutAvailable) {
        setCardEntryMode('checkout');
        toast.error(tv('Inline card form is unavailable, switched to Stripe Checkout.', 'Form nhập thẻ trực tiếp chưa sẵn sàng, đã chuyển sang Stripe Checkout.'));
      } else {
        toast.error(serverMsg || tv('Cannot create booking', 'Không thể tạo đơn đặt chỗ'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-4">
      {!stripeStep && (
        <form onSubmit={submit} className="space-y-4 rounded-xl border bg-white p-4 shadow-sm">
          <h1 className="text-xl font-semibold">{tv('Payment & booking', 'Thanh toán & đặt chỗ')}</h1>
          {homestay && (
            <div className="rounded border bg-slate-50 p-3 text-sm">
              <p className="font-semibold">{homestay.title}</p>
              <p className="text-slate-600">{homestay.location}</p>
              <p className="mt-1 font-medium">{formatMoney(homestay.pricePerNight)}/{tv('night', 'đêm')}</p>
            </div>
          )}
          <input
            type="date"
            required
            value={form.checkInDate}
            onChange={(e) => setForm((p) => ({ ...p, checkInDate: e.target.value }))}
            className="w-full rounded border p-2"
          />
          <input
            type="date"
            required
            value={form.checkOutDate}
            onChange={(e) => setForm((p) => ({ ...p, checkOutDate: e.target.value }))}
            className="w-full rounded border p-2"
          />

          <div className="rounded border bg-slate-50 p-3 text-sm">
            <p className="text-slate-600">{tv('Nights', 'Số đêm')}: {nights > 0 ? `${nights}` : '—'}</p>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between"><span>{tv('Subtotal', 'Tạm tính')}</span><span>{formatMoney(subtotal)}</span></div>
              <div className="flex justify-between"><span>{tv('Service fee (12%)', 'Phí dịch vụ (12%)')}</span><span>{formatMoney(serviceFee)}</span></div>
              <div className="flex justify-between"><span>{tv('Add-ons (one-time)', 'Dịch vụ thêm (1 lần)')}</span><span>{formatMoney(addOnsTotal)}</span></div>
              <div className="flex justify-between border-t pt-2 font-semibold"><span>{tv('Total', 'Tổng')}</span><span>{formatMoney(total)}</span></div>
            </div>
          </div>

          {!!homestay?.serviceAddOns?.length && (
            <div className="space-y-2 rounded border bg-white p-3">
              <p className="text-sm font-semibold">{tv('Extra services', 'Dịch vụ đính kèm')}</p>
              <div className="space-y-2">
                {homestay.serviceAddOns.filter((s) => s.active !== false).map((service) => {
                  const qty = Number(selectedAddOns[service.name] || 0);
                  const lineTotal = qty * Number(service.price || 0);
                  const pulseKey = `book-${service.name}`;
                  return (
                    <div
                      key={service.name}
                      className={`rounded-lg border border-slate-200 bg-slate-50 p-3 transition duration-200 ${
                        pulseMap[pulseKey] ? 'scale-[1.02] border-emerald-300 bg-emerald-50/80' : ''
                      }`}
                      onClick={() => {
                        triggerPlusPulse(pulseKey);
                        setSelectedAddOns((prev) => ({ ...prev, [service.name]: qty + 1 }));
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          triggerPlusPulse(pulseKey);
                          setSelectedAddOns((prev) => ({ ...prev, [service.name]: qty + 1 }));
                        }
                      }}
                      title={tv('Click card to add +1', 'Bấm vào dịch vụ để +1')}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{service.name}</p>
                          <p className="text-xs text-slate-500">
                            {formatMoney(service.price)}/{service.unit || tv('item', 'suất')}
                            {service.description ? ` · ${service.description}` : ''}
                          </p>
                        </div>
                        <div className="text-right text-xs text-slate-600">
                          <p>{tv('Line total', 'Tổng dòng')}</p>
                          <p className="font-semibold text-slate-900">{formatMoney(lineTotal)}</p>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAddOns((prev) => ({ ...prev, [service.name]: Math.max(0, qty - 1) }));
                          }}
                          className="h-8 w-8 rounded border border-slate-300 text-base font-semibold text-slate-700 hover:bg-white"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min={0}
                          value={qty}
                          onChange={(e) =>
                            setSelectedAddOns((prev) => ({ ...prev, [service.name]: Math.max(0, Number(e.target.value || 0)) }))
                          }
                          onClick={(e) => e.stopPropagation()}
                          className="w-16 rounded border p-1.5 text-center"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            triggerPlusPulse(pulseKey);
                            setSelectedAddOns((prev) => ({ ...prev, [service.name]: qty + 1 }));
                          }}
                          className="h-8 w-8 rounded border border-slate-300 text-base font-semibold text-slate-700 hover:bg-white"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-800">{tv('Payment method', 'Phương thức thanh toán')}</p>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50/50">
              <input
                type="radio"
                name="pay"
                checked={paymentMethod === 'card'}
                onChange={() => setPaymentMethod('card')}
                className="mt-1"
              />
              <div className="flex-1">
                <p className="font-medium">{tv('Card (Visa / Mastercard / etc.)', 'Thẻ (Visa / Mastercard / ... )')}</p>
                <p className="text-xs text-slate-600">{tv('Pay with Stripe — enter card on this page or use hosted checkout.', 'Thanh toán bằng Stripe — nhập thẻ tại trang này hoặc dùng Checkout của Stripe.')}</p>
                {paymentMethod === 'card' && (
                  <div className="mt-2 space-y-2 border-t border-slate-100 pt-2">
                    {isDevCardFallback && (
                      <div className="space-y-2 rounded border border-sky-200 bg-sky-50 p-2">
                        <p className="text-xs font-semibold text-sky-700">
                          {tv('Development card form (simulation)', 'Form thẻ môi trường dev (mô phỏng)')}
                        </p>
                        <input
                          value={devCardForm.holderName}
                          onChange={(e) => setDevCardForm((prev) => ({ ...prev, holderName: e.target.value }))}
                          placeholder={tv('Cardholder name', 'Tên chủ thẻ')}
                          className="w-full rounded border p-2 text-sm"
                        />
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <input
                            value={devCardForm.cardNumber}
                            onChange={(e) => setDevCardForm((prev) => ({ ...prev, cardNumber: e.target.value }))}
                            placeholder={tv('Card number', 'Số thẻ')}
                            className="w-full rounded border p-2 text-sm"
                          />
                          <input
                            value={devCardForm.expiry}
                            onChange={(e) => setDevCardForm((prev) => ({ ...prev, expiry: e.target.value }))}
                            placeholder={tv('MM/YY', 'MM/YY')}
                            className="w-full rounded border p-2 text-sm"
                          />
                        </div>
                        <input
                          value={devCardForm.cvc}
                          onChange={(e) => setDevCardForm((prev) => ({ ...prev, cvc: e.target.value }))}
                          placeholder="CVC"
                          className="w-full rounded border p-2 text-sm"
                        />
                      </div>
                    )}
                    {cardCheckoutBlocked && (
                      <p className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
                        {tv('Stripe Checkout is not configured. Add ' ,'Stripe Checkout chưa được cấu hình. Thêm ' )}<code className="rounded bg-white px-0.5">STRIPE_SECRET_KEY</code> to{' '}
                        <code className="rounded bg-white px-0.5">backend/.env</code> {tv('and restart the API, or choose bank transfer.', 'rồi khởi động lại API, hoặc chọn chuyển khoản ngân hàng.')}
                      </p>
                    )}
                    {cardInlineBlocked && (
                      <p className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
                        {tv('Pay on this page needs both ' , 'Thanh toán tại trang này cần cả ' )}<code className="rounded bg-white px-0.5">STRIPE_SECRET_KEY</code> and{' '}
                        <code className="rounded bg-white px-0.5">STRIPE_PUBLISHABLE_KEY</code> {tv('in', 'trong')} <code className="rounded bg-white px-0.5">backend/.env</code>{tv(', or use Checkout / bank transfer.', ', hoặc dùng Checkout / chuyển khoản.')}
                      </p>
                    )}
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="cardMode"
                        checked={cardEntryMode === 'inline'}
                        onChange={() => setCardEntryMode('inline')}
                      />
                      {tv('Enter card on this page (Stripe Elements)', 'Nhập thẻ tại trang này (Stripe Elements)')}
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="cardMode"
                        checked={cardEntryMode === 'checkout'}
                        onChange={() => setCardEntryMode('checkout')}
                      />
                      {tv('Redirect to Stripe Checkout page', 'Chuyển tới trang Stripe Checkout')}
                    </label>
                  </div>
                )}
              </div>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50/50">
              <input
                type="radio"
                name="pay"
                checked={paymentMethod === 'bank_transfer'}
                onChange={() => setPaymentMethod('bank_transfer')}
                className="mt-1"
              />
              <div className="flex-1">
                <p className="font-medium">{tv('Bank transfer', 'Chuyển khoản ngân hàng')}</p>
                <p className="text-xs text-slate-600">
                  {tv('If the host uploaded a QR, it appears below. After you submit, you also get the transfer reference and full account details.', 'Nếu chủ nhà đã tải QR, mã sẽ hiện bên dưới. Sau khi tạo đơn, bạn sẽ nhận mã chuyển khoản và đầy đủ thông tin tài khoản.')}
                </p>
              </div>
            </label>
          </div>

          {paymentMethod === 'bank_transfer' && bankInfoPreview?.bankName && (
            <p className="text-xs text-slate-500">
              {tv('Bank', 'Ngân hàng')}: {bankInfoPreview.bankName}
              {bankInfoPreview.accountNumber ? ` · ****${String(bankInfoPreview.accountNumber).slice(-4)}` : ''}
            </p>
          )}
          {paymentMethod === 'bank_transfer' && bankInfoPreview?.bankQrImageUrl && (
            <div className="rounded border bg-white p-3 text-center">
              <p className="mb-2 text-xs font-semibold text-slate-600">{tv('Scan QR to pay', 'Quét QR để thanh toán')}</p>
              <img
                src={resolveAssetUrl(bankInfoPreview.bankQrImageUrl)}
                alt={tv('Bank transfer QR', 'QR chuyển khoản ngân hàng')}
                className="mx-auto max-h-64 max-w-full object-contain"
              />
              <p className="mt-2 text-xs text-slate-500">
                After you create the booking, account number and your transfer reference appear {tv('in', 'trong')} the summary below.
              </p>
            </div>
          )}
          {paymentMethod === 'bank_transfer' && bankInfoPreview && !bankInfoPreview.bankQrImageUrl && (
            <p className="text-xs text-slate-500">
              {tv('No QR image from the host yet; you can still transfer using the details shown after you create the booking.', 'Chủ nhà chưa có ảnh QR; bạn vẫn có thể chuyển khoản bằng thông tin hiển thị sau khi tạo đơn.')}
            </p>
          )}

          {paymentMethod === 'bank_transfer' && (
            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">{tv('Transfer note (optional)', 'Nội dung chuyển khoản (tuỳ chọn)')}</label>
              <input
                value={bankNote}
                onChange={(e) => setBankNote(e.target.value)}
                placeholder={tv('e.g. Sender name', 'VD: Tên người chuyển')}
                className="mt-1 w-full rounded border p-2 text-sm"
                maxLength={500}
              />
            </div>
          )}

          <button
            disabled={loading || !nights || cardCheckoutBlocked || cardInlineBlocked}
            className="w-full rounded bg-emerald-600 p-2 text-white disabled:opacity-60"
          >
            {loading ? tv('Processing...', 'Đang xử lý...') : paymentMethod === 'card' ? tv('Continue to card form', 'Tiếp tục tới form thẻ') : tv('Create booking and transfer info', 'Tạo đơn và nhận thông tin chuyển khoản')}
          </button>
        </form>
      )}

      {stripeStep && (
        <StripeInlinePayment
          publishableKey={stripeStep.publishableKey}
          clientSecret={stripeStep.clientSecret}
          onSuccess={() => navigate('/dashboard?payment=success')}
          onBack={abandonStripeInline}
        />
      )}

      {bankTransferResult && (
        <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm">
          <h2 className="font-semibold text-amber-900">{tv('Bank transfer', 'Chuyển khoản ngân hàng')}</h2>
          <p className="text-slate-700">{tv('Amount', 'Số tiền')}: <strong className="text-base">{formatMoney(total)}</strong></p>
          <div className="grid gap-3 md:grid-cols-[250px_1fr]">
            {bankTransferResult.bankQrImageUrl && (
              <div className="rounded-lg border bg-white p-3 text-center">
                <p className="mb-2 text-xs font-semibold text-slate-600">{tv('Scan QR to pay', 'Quét QR để thanh toán')}</p>
                <img
                  src={resolveAssetUrl(bankTransferResult.bankQrImageUrl)}
                  alt={tv('Bank transfer QR', 'QR chuyển khoản')}
                  className="mx-auto h-56 w-56 rounded object-contain"
                />
              </div>
            )}
            <div className="space-y-2 rounded-lg border border-amber-200 bg-white/80 p-3">
              <p><span className="text-slate-600">{tv('Bank', 'Ngân hàng')}:</span> <strong>{bankTransferResult.bankName}</strong></p>
              <p>
                <span className="text-slate-600">{tv('Account', 'Tài khoản')}:</span> <strong className="select-all">{bankTransferResult.accountNumber}</strong>
                <button
                  type="button"
                  onClick={() =>
                    copyText(
                      bankTransferResult.accountNumber,
                      tv('Account number copied', 'Đã copy số tài khoản'),
                      tv('Copy failed', 'Copy thất bại')
                    )
                  }
                  className="ml-2 rounded border border-slate-300 px-2 py-0.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  {tv('Copy', 'Copy')}
                </button>
              </p>
              <p><span className="text-slate-600">{tv('Account name', 'Tên tài khoản')}:</span> {bankTransferResult.accountName}</p>
              {bankTransferResult.branch && <p><span className="text-slate-600">{tv('Branch', 'Chi nhánh')}:</span> {bankTransferResult.branch}</p>}
              {bankTransferResult.swift && <p><span className="text-slate-600">SWIFT:</span> {bankTransferResult.swift}</p>}
              <p>
                <span className="text-slate-600">{tv('Transfer reference', 'Mã chuyển khoản')}:</span> <strong className="select-all text-emerald-800">{bankTransferResult.reference}</strong>
                <button
                  type="button"
                  onClick={() =>
                    copyText(
                      bankTransferResult.reference,
                      tv('Reference copied', 'Đã copy mã CK'),
                      tv('Copy failed', 'Copy thất bại')
                    )
                  }
                  className="ml-2 rounded border border-slate-300 px-2 py-0.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  {tv('Copy', 'Copy')}
                </button>
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-600">{bankTransferResult.instructions}</p>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="w-full rounded border border-slate-300 bg-white py-2 font-medium"
          >
            My bookings
          </button>
        </div>
      )}
    </div>
  );
};

export default BookingPage;
