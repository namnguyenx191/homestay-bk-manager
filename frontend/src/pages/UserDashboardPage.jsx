import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import client from '../api/client';
import StripeInlinePayment from '../components/StripeInlinePayment';
import { useLanguage } from '../context/LanguageContext';
import { useCurrency } from '../context/CurrencyContext';
import { resolveAssetUrl } from '../utils/resolveAssetUrl';

const UserDashboardPage = () => {
  const [bookings, setBookings] = useState([]);
  const [addOnDrafts, setAddOnDrafts] = useState({});
  const [pulseMap, setPulseMap] = useState({});
  const [savingId, setSavingId] = useState('');
  const [addOnPayMethod, setAddOnPayMethod] = useState({});
  const [addOnBankNote, setAddOnBankNote] = useState({});
  const [bankTransferResult, setBankTransferResult] = useState({});
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
            <p className="text-xs text-amber-800">
              {tv('Transfer code', 'Mã CK')}: <strong>{booking.bankTransferReference}</strong> — {tv('waiting for confirmation after funds are received.', 'chờ xác nhận sau khi nhận tiền.')}
            </p>
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
            <div className="mt-3 space-y-2 rounded border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase text-slate-500">
                {tv('Add services after booking', 'Bổ sung dịch vụ sau đặt phòng')}
              </p>
              {booking.addOnsFinalized && !addOnsPaid && (
                <p className="text-xs text-emerald-700">
                  {tv('Add-ons finalized. Complete payment below.', 'Dịch vụ đã chốt. Vui lòng thanh toán bên dưới.')}
                </p>
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                {booking.homestayId.serviceAddOns.filter((s) => s.active !== false).map((service) => {
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
                            [booking._id]: {
                              ...(prev[booking._id] || {}),
                              [service.name]: qty + 1,
                            },
                          }));
                        }}
                        className="min-w-0 flex-1 text-left text-sm text-slate-800 disabled:opacity-60"
                        title={tv('Click to add +1', 'Bấm để +1')}
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
                            [booking._id]: {
                              ...(prev[booking._id] || {}),
                              [service.name]: Math.max(0, qty - 1),
                            },
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
                    const cardEntryMode = cardInlineAvailable ? 'inline' : 'checkout';
                    const { data } = await client.put(`/bookings/${booking._id}/add-ons`, {
                      selectedAddOns,
                      paymentMethod,
                      cardEntryMode: paymentMethod === 'card' ? cardEntryMode : undefined,
                      bankTransferNote: paymentMethod === 'bank_transfer' ? addOnBankNote[booking._id] : undefined,
                    });
                    if (data.checkoutUrl) {
                      window.location.href = data.checkoutUrl;
                      return;
                    }
                    if (data.clientSecret && data.stripePublishableKey) {
                      setAddOnStripeStep((prev) => ({
                        ...prev,
                        [booking._id]: {
                          clientSecret: data.clientSecret,
                          publishableKey: data.stripePublishableKey,
                        },
                      }));
                      toast.success(tv('Enter your card below to pay add-ons.', 'Nhập thông tin thẻ bên dưới để thanh toán dịch vụ thêm.'));
                      return;
                    }
                    if (data.bankTransfer) {
                      setBankTransferResult((prev) => ({ ...prev, [booking._id]: data }));
                      toast.success(tv('Booking add-ons created. Complete bank transfer below.', 'Đã tạo thanh toán dịch vụ. Vui lòng chuyển khoản theo thông tin bên dưới.'));
                    } else {
                      toast.success(tv('Add-ons finalized.', 'Đã chốt dịch vụ thêm.'));
                    }
                    load();
                  } catch (error) {
                    toast.error(error.response?.data?.message || tv('Could not update add-ons', 'Không thể cập nhật dịch vụ thêm'));
                  } finally {
                    setSavingId('');
                  }
                }}
                className="rounded border border-emerald-600 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
              >
                {!addOnsEditable
                  ? tv('Paid', 'Đã thanh toán')
                  : savingId === booking._id
                    ? tv('Processing payment...', 'Đang xử lý thanh toán...')
                    : booking.addOnsFinalized
                      ? tv('Pay now for add-ons', 'Thanh toán dịch vụ ngay')
                      : tv('Finalize & pay add-ons', 'Chốt và thanh toán dịch vụ')}
              </button>
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
                  {!cardAnyAvailable && (
                    <p className="text-[11px] text-amber-700">
                      {tv('Card is not configured, switched to bank transfer.', 'Thẻ chưa được cấu hình, đã chuyển sang thanh toán chuyển khoản.')}
                    </p>
                  )}
                  {cardAnyAvailable && !cardInlineAvailable && cardCheckoutAvailable && (
                    <p className="text-[11px] text-slate-600">
                      {tv('Card payment will continue on Stripe Checkout.', 'Thanh toán thẻ sẽ chuyển sang Stripe Checkout.')}
                    </p>
                  )}
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
                  {activePayMethod === 'bank_transfer' && (
                    <>
                      {bankInfoPreview?.bankName && (
                        <p className="text-[11px] text-slate-600">
                          {tv('Bank', 'Ngân hàng')}: {bankInfoPreview.bankName}
                          {bankInfoPreview.accountNumber ? ` · ****${String(bankInfoPreview.accountNumber).slice(-4)}` : ''}
                        </p>
                      )}
                      {bankInfoPreview?.bankQrImageUrl && (
                        <div className="rounded border bg-white p-2 text-center">
                          <p className="mb-1 text-[11px] font-semibold text-slate-600">
                            {tv('Scan QR to pay', 'Quét QR để thanh toán')}
                          </p>
                          <img
                            src={resolveAssetUrl(bankInfoPreview.bankQrImageUrl)}
                            alt={tv('Bank transfer QR', 'QR chuyển khoản ngân hàng')}
                            className="mx-auto max-h-40 max-w-full object-contain"
                          />
                        </div>
                      )}
                      {!bankInfoPreview?.bankQrImageUrl && (
                        <p className="text-[11px] text-slate-500">
                          {tv('No QR image from host yet.', 'Chủ nhà chưa tải ảnh QR.')}
                        </p>
                      )}
                      <input
                        value={addOnBankNote[booking._id] || ''}
                        onChange={(e) => setAddOnBankNote((prev) => ({ ...prev, [booking._id]: e.target.value }))}
                        placeholder={tv('Transfer note (optional)', 'Nội dung chuyển khoản (tuỳ chọn)')}
                        className="w-full rounded border p-1.5 text-xs"
                      />
                    </>
                  )}
                </div>
              )}
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
              {bankTransferResult[booking._id]?.bankTransfer && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-3 text-xs text-amber-900">
                  <p className="font-semibold">
                    {tv('Add-on amount', 'Tiền dịch vụ thêm')}: <span className="text-base">{formatMoney(bankTransferResult[booking._id].addOnAmount)}</span>
                  </p>
                  <div className="mt-2 grid gap-3 md:grid-cols-[220px_1fr]">
                    {bankTransferResult[booking._id].bankTransfer.bankQrImageUrl && (
                      <div className="rounded-lg border bg-white p-2 text-center">
                        <p className="mb-1 text-[11px] font-semibold text-slate-600">{tv('Scan QR to pay', 'Quét QR để thanh toán')}</p>
                        <img
                          src={resolveAssetUrl(bankTransferResult[booking._id].bankTransfer.bankQrImageUrl)}
                          alt={tv('Bank transfer QR', 'QR chuyển khoản')}
                          className="mx-auto h-48 w-48 rounded object-contain"
                        />
                      </div>
                    )}
                    <div className="space-y-2 rounded-lg border border-amber-200 bg-white/80 p-2 text-slate-700">
                      <p>{tv('Bank', 'Ngân hàng')}: <strong>{bankTransferResult[booking._id].bankTransfer.bankName}</strong></p>
                      <p>
                        {tv('Account', 'Tài khoản')}: <strong className="select-all">{bankTransferResult[booking._id].bankTransfer.accountNumber}</strong>
                        <button
                          type="button"
                          onClick={() =>
                            copyText(
                              bankTransferResult[booking._id].bankTransfer.accountNumber,
                              tv('Account number copied', 'Đã copy số tài khoản'),
                              tv('Copy failed', 'Copy thất bại')
                            )
                          }
                          className="ml-2 rounded border border-slate-300 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-100"
                        >
                          {tv('Copy', 'Copy')}
                        </button>
                      </p>
                      <p>
                        {tv('Reference', 'Mã CK')}: <strong className="select-all">{bankTransferResult[booking._id].bankTransfer.reference}</strong>
                        <button
                          type="button"
                          onClick={() =>
                            copyText(
                              bankTransferResult[booking._id].bankTransfer.reference,
                              tv('Reference copied', 'Đã copy mã CK'),
                              tv('Copy failed', 'Copy thất bại')
                            )
                          }
                          className="ml-2 rounded border border-slate-300 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-100"
                        >
                          {tv('Copy', 'Copy')}
                        </button>
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          <p className="font-semibold text-emerald-600">{formatMoney(booking.totalPrice)}</p>
              </>
            );
          })()}
        </article>
      ))}
    </section>
  );
};

export default UserDashboardPage;
