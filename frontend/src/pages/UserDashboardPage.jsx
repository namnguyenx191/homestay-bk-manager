import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import client from '../api/client';
import StripeInlinePayment from '../components/StripeInlinePayment';
import { useLanguage } from '../context/LanguageContext';
import { useCurrency } from '../context/CurrencyContext';

const UserDashboardPage = () => {
  const [bookings, setBookings] = useState([]);
  const [addOnDrafts, setAddOnDrafts] = useState({});
  const [pulseMap, setPulseMap] = useState({});
  const [savingId, setSavingId] = useState('');
  const [addOnPayMethod, setAddOnPayMethod] = useState({});
  const [bankTransferResult, setBankTransferResult] = useState({});
  const [dynamicQrByBooking, setDynamicQrByBooking] = useState({});
  const [dynamicQrLoadingId, setDynamicQrLoadingId] = useState('');
  const [qrModal, setQrModal] = useState({ open: false, bookingId: '', scope: 'booking' });
  const [addOnModal, setAddOnModal] = useState({ open: false, bookingId: '' });
  const [payCaps, setPayCaps] = useState(null);
  const [addOnStripeStep, setAddOnStripeStep] = useState({});
  const [addOnDevCardForm, setAddOnDevCardForm] = useState({});
  const [bankInfoPreview, setBankInfoPreview] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const { tv } = useLanguage();
  const { formatMoney } = useCurrency();

  const load = () =>
    client.get('/bookings/user').then(({ data }) => {
      setBookings(data);
      const nextDrafts = {};
      data.forEach((booking) => {
        const byName = {};
        (booking.addOns || []).forEach((item) => {
          byName[item.serviceName] = item.quantity;
        });
        nextDrafts[booking._id] = byName;
      });
      setAddOnDrafts(nextDrafts);
    });

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    client
      .get('/bookings/payment-capabilities')
      .then(({ data }) => setPayCaps(data))
      .catch(() => setPayCaps(null));
  }, []);

  useEffect(() => {
    client
      .get('/bookings/bank-transfer-info')
      .then(({ data }) => setBankInfoPreview(data))
      .catch(() => setBankInfoPreview(null));
  }, []);

  useEffect(() => {
    if (!qrModal.open || !qrModal.bookingId) return undefined;
    const timer = window.setInterval(() => {
      load().catch(() => {});
    }, 5000);
    return () => window.clearInterval(timer);
  }, [qrModal.open, qrModal.bookingId]);

  useEffect(() => {
    const payment = searchParams.get('payment');
    if (payment === 'success') {
      toast.success(tv('Card payment successful. Booking will update after Stripe confirms (or refresh in a few seconds).', 'Thanh toán thẻ thành công. Đơn sẽ được cập nhật khi Stripe xác nhận (hoặc F5 sau vài giây).'));
      load();
      searchParams.delete('payment');
      searchParams.delete('session_id');
      setSearchParams(searchParams, { replace: true });
    }
    if (payment === 'cancel') {
      toast.error(tv('Card payment was canceled.', 'Bạn đã hủy thanh toán thẻ.'));
      searchParams.delete('payment');
      setSearchParams(searchParams, { replace: true });
    }
    const addonPayment = searchParams.get('addonPayment');
    if (addonPayment === 'success') {
      toast.success(tv('Add-on payment successful.', 'Thanh toán dịch vụ thêm thành công.'));
      load();
      searchParams.delete('addonPayment');
      setSearchParams(searchParams, { replace: true });
    }
    if (addonPayment === 'cancel') {
      toast.error(tv('Add-on payment was canceled.', 'Bạn đã hủy thanh toán dịch vụ thêm.'));
      searchParams.delete('addonPayment');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

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

  const createDynamicQr = async (bookingId, scope = 'booking') => {
    if (!bookingId) return;
    setDynamicQrLoadingId(bookingId);
    setDynamicQrByBooking((prev) => ({ ...prev, [bookingId]: null }));
    try {
      let data = null;
      const vietQrRes = await client.post('/bookings/vietqr', { bookingId, scope });
      data = { ...vietQrRes.data, provider: 'vietqr' };
      if (!data?.qrCodeUrl) {
        toast.error(tv('QR provider returned no image.', 'Nhà cung cấp QR không trả về ảnh.'));
        return;
      }
      setDynamicQrByBooking((prev) => ({ ...prev, [bookingId]: data }));
      toast.success(tv('Dynamic VietQR created.', 'Đã tạo VietQR động.'));
    } catch (error) {
      toast.error(error.response?.data?.message || tv('Could not create payment QR', 'Không thể tạo QR thanh toán'));
    } finally {
      setDynamicQrLoadingId('');
    }
  };

  const openQrModal = (bookingId, scope = 'booking') => {
    setQrModal({ open: true, bookingId, scope });
    createDynamicQr(bookingId, scope);
  };

  const openAddOnModal = (bookingId) => {
    setAddOnModal({ open: true, bookingId });
  };

  return (
    <section className="space-y-3">
      <h1 className="text-2xl font-bold">{tv('My Bookings', 'Đặt chỗ của tôi')}</h1>
      {bookings.map((booking) => (
        <article key={booking._id} className="rounded border bg-white p-4">
          {(() => {
            const addOnsPaid = booking.addOnPaymentStatus === 'paid';
            const addOnsEditable = !addOnsPaid;
            const cardCheckoutAvailable = payCaps ? Boolean(payCaps.cardCheckoutAvailable) : true;
            const cardInlineAvailable = payCaps ? Boolean(payCaps.cardInlineAvailable) : true;
            const cardAnyAvailable = cardCheckoutAvailable || cardInlineAvailable;
            const isDevCardFallback = payCaps?.cardMode === 'dev_fallback';
            const activePayMethod = addOnPayMethod[booking._id] || (cardAnyAvailable ? 'card' : 'bank_transfer');
            return (
              <>
          <h2 className="font-semibold">{booking.homestayId?.title}</h2>
          <p className="text-sm">{new Date(booking.checkInDate).toLocaleDateString()} - {new Date(booking.checkOutDate).toLocaleDateString()}</p>
          <p className="text-sm">
            {tv('Status', 'Trạng thái')}: {booking.status} | {tv('Payment', 'Thanh toán')}: {booking.paymentStatus}
            {booking.paymentMethod === 'bank_transfer' && tv(' (Bank transfer)', ' (CK)')}
            {booking.paymentMethod === 'card' && tv(' (Card)', ' (Thẻ)')}
          </p>
          <p className="mt-1 text-xs">
            <span className="font-semibold text-slate-600">Add-ons:</span>{' '}
            <span
              className={`rounded-full px-2 py-0.5 font-semibold ${
                addOnsPaid
                  ? 'bg-emerald-100 text-emerald-700'
                  : booking.addOnsFinalized
                    ? 'bg-sky-100 text-sky-700'
                    : 'bg-amber-100 text-amber-700'
              }`}
            >
              {addOnsPaid
                ? tv('Paid', 'Đã thanh toán')
                : booking.addOnsFinalized
                  ? tv('Finalized - waiting payment', 'Đã chốt - chờ thanh toán')
                  : tv('Not finalized', 'Chưa chốt')}
            </span>
          </p>
          {booking.paymentMethod === 'bank_transfer' && booking.bankTransferReference && booking.paymentStatus === 'pending' && (
            <div className="mt-1 space-y-2 rounded border border-amber-200 bg-amber-50/80 p-2 text-xs text-amber-900">
              <p>
                {tv('Transfer code', 'Mã CK')}: <strong>{booking.bankTransferReference}</strong> — {tv('waiting for confirmation after funds are received.', 'chờ xác nhận sau khi nhận tiền.')}
              </p>
            </div>
          )}
          {booking.status === 'checked_in' &&
            booking.paymentStatus === 'paid' &&
            Number(booking.overstayFeeAccrued) > 0 && (
              <div className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-xs font-medium text-red-900">
                <p>
                  {tv(
                    'You are past your check-out time. An extra stay fee applies (see amount below). Please contact the host to check out.',
                    'Bạn đã quá giờ trả phòng đã đặt. Phí lưu trú thêm được tính (xem số tiền bên dưới). Vui lòng liên hệ chủ nhà để check-out.'
                  )}
                </p>
                <p className="mt-1">
                  {tv('Accrued extra stay fee', 'Phí lưu trú thêm tích lũy')}:{' '}
                  <strong>{formatMoney(booking.overstayFeeAccrued)}</strong>
                </p>
              </div>
            )}
          {!!booking.addOns?.length && (
            <div className="mt-2 rounded bg-slate-50 p-2 text-xs text-slate-700">
              <p className="font-semibold">{tv('Selected add-ons', 'Dịch vụ đã chọn')}:</p>
              {(booking.addOns || []).map((item) => (
                <p key={`${booking._id}-${item.serviceName}`}>
                  {item.serviceName} x {item.quantity} = {formatMoney(item.totalPrice)}
                </p>
              ))}
            </div>
          )}
          {!!booking.homestayId?.serviceAddOns?.length && booking.status !== 'cancelled' && (
            <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">
                    {tv('Add services after booking', 'Bổ sung dịch vụ sau đặt phòng')}
                  </p>
                  <p className="text-xs text-slate-600">
                    {booking.addOnsFinalized
                      ? tv('Add-ons are finalized. Open mini page to pay/update.', 'Dịch vụ đã chốt. Mở mini page để thanh toán/cập nhật.')
                      : tv('Open mini page to choose add-ons and payment.', 'Mở mini page để chọn dịch vụ và thanh toán.')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openAddOnModal(booking._id)}
                  className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  {tv('Add-on services', 'Dịch vụ thêm')}
                </button>
              </div>
            </div>
          )}
          <p className="font-semibold text-emerald-600">{formatMoney(booking.totalPrice)}</p>
              </>
            );
          })()}
        </article>
      ))}

      {addOnModal.open && (() => {
        const booking = bookings.find((b) => String(b._id) === String(addOnModal.bookingId));
        if (!booking) return null;
        const addOnsPaid = booking.addOnPaymentStatus === 'paid';
        const addOnsEditable = !addOnsPaid;
        const cardCheckoutAvailable = payCaps ? Boolean(payCaps.cardCheckoutAvailable) : true;
        const cardInlineAvailable = payCaps ? Boolean(payCaps.cardInlineAvailable) : true;
        const cardAnyAvailable = cardCheckoutAvailable || cardInlineAvailable;
        const isDevCardFallback = payCaps?.cardMode === 'dev_fallback';
        const activePayMethod = addOnPayMethod[booking._id] || (cardAnyAvailable ? 'card' : 'bank_transfer');
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
            <div className="w-full max-w-2xl rounded-2xl bg-white p-4 shadow-2xl">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{tv('Add-on services', 'Dịch vụ thêm')}</h3>
                  <p className="text-xs text-slate-500">{booking.homestayId?.title}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAddOnModal({ open: false, bookingId: '' })}
                  className="rounded border px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  {tv('Close', 'Đóng')}
                </button>
              </div>

              <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
                <div className="grid gap-2 sm:grid-cols-2">
                  {booking.homestayId?.serviceAddOns?.filter((s) => s.active !== false).map((service) => {
                    const qty = Number(addOnDrafts[booking._id]?.[service.name] || 0);
                    const pulseKey = `${booking._id}-${service.name}`;
                    return (
                      <div
                        key={pulseKey}
                        className={`flex items-center gap-2 rounded border bg-white p-2 transition duration-200 ${
                          pulseMap[pulseKey] ? 'scale-[1.02] border-emerald-300 bg-emerald-50/80' : ''
                        }`}
                      >
                        <button
                          type="button"
                          disabled={!addOnsEditable}
                          onClick={() => {
                            triggerPlusPulse(pulseKey);
                            setAddOnDrafts((prev) => ({
                              ...prev,
                              [booking._id]: { ...(prev[booking._id] || {}), [service.name]: qty + 1 },
                            }));
                          }}
                          className="min-w-0 flex-1 text-left text-sm text-slate-800 disabled:opacity-60"
                        >
                          <span className="font-medium">{service.name}</span>
                          <span className="ml-1 text-xs text-slate-500">({formatMoney(service.price)}/{service.unit || tv('item', 'suất')})</span>
                        </button>
                        <button
                          type="button"
                          disabled={!addOnsEditable || qty <= 0}
                          onClick={() =>
                            setAddOnDrafts((prev) => ({
                              ...prev,
                              [booking._id]: { ...(prev[booking._id] || {}), [service.name]: Math.max(0, qty - 1) },
                            }))
                          }
                          className="h-7 w-7 rounded border border-slate-300 text-sm font-semibold text-slate-700 disabled:opacity-40"
                        >
                          -
                        </button>
                        <span className="inline-flex min-w-[2rem] justify-center rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                          {qty}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {addOnsEditable && (
                  <div className="space-y-2 rounded border border-slate-200 bg-white p-2">
                    <p className="text-xs font-semibold text-slate-600">{tv('Payment method for add-ons', 'Phương thức thanh toán dịch vụ thêm')}</p>
                    <div className="flex gap-3 text-xs">
                      <label className="flex items-center gap-1">
                        <input
                          type="radio"
                          name={`addon-pay-${booking._id}`}
                          checked={activePayMethod === 'card'}
                          disabled={!cardAnyAvailable}
                          onChange={() => setAddOnPayMethod((prev) => ({ ...prev, [booking._id]: 'card' }))}
                        />
                        {tv('Card (enter details below)', 'Thẻ (nhập thông tin bên dưới)')}
                      </label>
                      <label className="flex items-center gap-1">
                        <input
                          type="radio"
                          name={`addon-pay-${booking._id}`}
                          checked={activePayMethod === 'bank_transfer'}
                          onChange={() => setAddOnPayMethod((prev) => ({ ...prev, [booking._id]: 'bank_transfer' }))}
                        />
                        {tv('Bank transfer', 'Chuyển khoản')}
                      </label>
                    </div>
                    {activePayMethod === 'card' && isDevCardFallback && (
                      <div className="space-y-2 rounded border border-sky-200 bg-sky-50 p-2">
                        <p className="text-[11px] font-semibold text-sky-700">
                          {tv('Development card form (simulation)', 'Form thẻ môi trường dev (mô phỏng)')}
                        </p>
                        <input
                          value={addOnDevCardForm[booking._id]?.holderName || ''}
                          onChange={(e) =>
                            setAddOnDevCardForm((prev) => ({
                              ...prev,
                              [booking._id]: { ...(prev[booking._id] || {}), holderName: e.target.value },
                            }))
                          }
                          placeholder={tv('Cardholder name', 'Tên chủ thẻ')}
                          className="w-full rounded border p-1.5 text-xs"
                        />
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <input
                            value={addOnDevCardForm[booking._id]?.cardNumber || ''}
                            onChange={(e) =>
                              setAddOnDevCardForm((prev) => ({
                                ...prev,
                                [booking._id]: { ...(prev[booking._id] || {}), cardNumber: e.target.value },
                              }))
                            }
                            placeholder={tv('Card number', 'Số thẻ')}
                            className="w-full rounded border p-1.5 text-xs"
                          />
                          <input
                            value={addOnDevCardForm[booking._id]?.expiry || ''}
                            onChange={(e) =>
                              setAddOnDevCardForm((prev) => ({
                                ...prev,
                                [booking._id]: { ...(prev[booking._id] || {}), expiry: e.target.value },
                              }))
                            }
                            placeholder="MM/YY"
                            className="w-full rounded border p-1.5 text-xs"
                          />
                        </div>
                        <input
                          value={addOnDevCardForm[booking._id]?.cvc || ''}
                          onChange={(e) =>
                            setAddOnDevCardForm((prev) => ({
                              ...prev,
                              [booking._id]: { ...(prev[booking._id] || {}), cvc: e.target.value },
                            }))
                          }
                          placeholder="CVC"
                          className="w-full rounded border p-1.5 text-xs"
                        />
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  disabled={savingId === booking._id || !addOnsEditable}
                  onClick={async () => {
                    setSavingId(booking._id);
                    setBankTransferResult((prev) => ({ ...prev, [booking._id]: null }));
                    try {
                      if (activePayMethod === 'card' && isDevCardFallback) {
                        const draft = addOnDevCardForm[booking._id] || {};
                        if (!String(draft.holderName || '').trim() || !String(draft.cardNumber || '').trim() || !String(draft.expiry || '').trim() || !String(draft.cvc || '').trim()) {
                          toast.error(tv('Please fill all card fields.', 'Vui lòng nhập đầy đủ thông tin thẻ.'));
                          return;
                        }
                      }
                      const selectedAddOns = Object.entries(addOnDrafts[booking._id] || {})
                        .map(([serviceName, quantity]) => ({ serviceName, quantity: Number(quantity || 0) }))
                        .filter((item) => item.quantity > 0);
                      const paymentMethod = activePayMethod === 'bank_transfer' ? 'bank_transfer' : 'card';
                      if (paymentMethod === 'bank_transfer' && selectedAddOns.length === 0) {
                        if (booking.paymentMethod === 'bank_transfer' && booking.paymentStatus === 'pending') {
                          openQrModal(booking._id, 'booking');
                        } else {
                          toast.error(tv('Please choose at least one add-on service before paying.', 'Vui lòng chọn ít nhất một dịch vụ thêm trước khi thanh toán.'));
                        }
                        return;
                      }
                      if (paymentMethod === 'card' && !cardInlineAvailable) {
                        toast.error(tv('Card form is unavailable. Please configure Stripe inline keys or choose bank transfer.', 'Form thẻ chưa sẵn sàng. Vui lòng cấu hình Stripe inline hoặc chọn chuyển khoản.'));
                        return;
                      }
                      const { data } = await client.put(`/bookings/${booking._id}/add-ons`, {
                        selectedAddOns,
                        paymentMethod,
                        cardEntryMode: paymentMethod === 'card' ? 'inline' : undefined,
                      });
                      if (data.clientSecret && data.stripePublishableKey) {
                        setAddOnStripeStep((prev) => ({
                          ...prev,
                          [booking._id]: { clientSecret: data.clientSecret, publishableKey: data.stripePublishableKey },
                        }));
                        return;
                      }
                      if (data.bankTransfer) {
                        setBankTransferResult((prev) => ({ ...prev, [booking._id]: data }));
                        openQrModal(booking._id, 'addon');
                      }
                      await load();
                    } catch (error) {
                      toast.error(error.response?.data?.message || tv('Could not update add-ons', 'Không thể cập nhật dịch vụ thêm'));
                    } finally {
                      setSavingId('');
                    }
                  }}
                  className="w-full rounded bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {!addOnsEditable
                    ? tv('Paid', 'Đã thanh toán')
                    : savingId === booking._id
                      ? tv('Processing payment...', 'Đang xử lý thanh toán...')
                      : booking.addOnsFinalized
                        ? tv('Pay now for add-ons', 'Thanh toán dịch vụ ngay')
                        : tv('Finalize & pay add-ons', 'Chốt và thanh toán dịch vụ')}
                </button>

                {addOnStripeStep[booking._id] && (
                  <StripeInlinePayment
                    publishableKey={addOnStripeStep[booking._id].publishableKey}
                    clientSecret={addOnStripeStep[booking._id].clientSecret}
                    returnUrl={`${window.location.origin}/dashboard?addonPayment=success`}
                    onSuccess={() => {
                      setAddOnStripeStep((prev) => ({ ...prev, [booking._id]: null }));
                      toast.success(tv('Add-on payment successful.', 'Thanh toán dịch vụ thêm thành công.'));
                      load();
                    }}
                    onBack={() => setAddOnStripeStep((prev) => ({ ...prev, [booking._id]: null }))}
                  />
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {qrModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            {(() => {
              const currentBooking = bookings.find((b) => String(b._id) === String(qrModal.bookingId));
              const paidByScope = qrModal.scope === 'addon'
                ? currentBooking?.addOnPaymentStatus === 'paid'
                : currentBooking?.paymentStatus === 'paid';
              return (
                <>
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold tracking-tight text-slate-900">
                  {paidByScope ? tv('Payment success', 'Thanh toán thành công') : tv('Payment QR', 'QR thanh toán')}
                </h3>
                <p className="text-xs text-slate-500">
                  {paidByScope
                    ? tv('This order has been confirmed paid.', 'Đơn này đã được xác nhận thanh toán.')
                    : tv('Scan by banking app or MoMo', 'Quét bằng app ngân hàng hoặc MoMo')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQrModal({ open: false, bookingId: '', scope: 'booking' })}
                className="rounded border px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                {tv('Close', 'Đóng')}
              </button>
            </div>

            <div className="rounded-xl border bg-white p-3 text-center">
              {paidByScope ? (
                <div className="py-10">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700">
                    ✓
                  </div>
                  <p className="text-base font-semibold text-emerald-700">
                    {tv('Payment confirmed successfully', 'Đã xác nhận thanh toán thành công')}
                  </p>
                </div>
              ) : dynamicQrLoadingId === qrModal.bookingId ? (
                <p className="py-16 text-sm font-semibold text-slate-600">{tv('Generating QR...', 'Đang tạo QR...')}</p>
              ) : dynamicQrByBooking[qrModal.bookingId]?.qrCodeUrl ? (
                <>
                  <p className="mb-2 text-xs font-semibold text-pink-700">
                    {tv('Scan QR to pay', 'Quét QR để thanh toán')}
                  </p>
                  <img
                    src={dynamicQrByBooking[qrModal.bookingId].qrCodeUrl}
                    alt={tv('Dynamic payment QR', 'QR thanh toán động')}
                    className="mx-auto h-64 w-64 rounded-lg object-contain"
                  />
                </>
              ) : (
                <p className="py-16 text-sm text-rose-600">{tv('QR unavailable', 'QR chưa khả dụng')}</p>
              )}
            </div>

            {!paidByScope && (
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    copyText(
                      dynamicQrByBooking[qrModal.bookingId]?.reference,
                      tv('Reference copied', 'Đã copy mã CK'),
                      tv('Copy failed', 'Copy thất bại')
                    )
                  }
                  className="rounded border border-slate-300 py-2 text-sm font-semibold text-slate-700"
                >
                  {tv('Copy reference', 'Copy mã CK')}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await createDynamicQr(qrModal.bookingId, qrModal.scope);
                    await load();
                  }}
                  disabled={dynamicQrLoadingId === qrModal.bookingId}
                  className="rounded bg-pink-600 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {tv('Refresh QR', 'Làm mới QR')}
                </button>
              </div>
            )}
                </>
              );
            })()}
          </div>
        </div>
      )}
    </section>
  );
};

export default UserDashboardPage;
