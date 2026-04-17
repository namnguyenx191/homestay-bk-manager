import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import client from '../../api/client';
import { useLanguage } from '../../context/LanguageContext';
import { useCurrency } from '../../context/CurrencyContext';

const serviceFeeRate = 0.12;

const PropertyBookingCard = ({ homestay }) => {
  const navigate = useNavigate();
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [availabilityState, setAvailabilityState] = useState(null);
  const [checking, setChecking] = useState(false);
  const { tv } = useLanguage();
  const { formatMoney } = useCurrency();

  const nights = useMemo(() => {
    if (!checkInDate || !checkOutDate) return 0;
    const value = Math.ceil((new Date(checkOutDate) - new Date(checkInDate)) / (1000 * 60 * 60 * 24));
    return value > 0 ? value : 0;
  }, [checkInDate, checkOutDate]);

  const subtotal = nights * homestay.pricePerNight;
  const serviceFee = Math.round(subtotal * serviceFeeRate);
  const total = subtotal + serviceFee;

  const checkAvailability = async () => {
    if (!checkInDate || !checkOutDate) {
      toast.error(tv('Please choose check-in and check-out dates', 'Vui lòng chọn ngày nhận và trả phòng'));
      return;
    }

    setChecking(true);
    try {
      const { data } = await client.get(`/homestays/${homestay._id}/availability`, {
        params: { checkInDate, checkOutDate },
      });
      setAvailabilityState(data.available ? 'available' : 'unavailable');
      toast.success(data.available ? tv('Dates available', 'Ngày đã chọn còn trống') : tv('Dates not available', 'Ngày đã chọn đã kín'));
    } catch {
      toast.error(tv('Could not check availability', 'Không thể kiểm tra tình trạng phòng'));
    } finally {
      setChecking(false);
    }
  };

  const goToBooking = () => {
    if (!checkInDate || !checkOutDate) {
      toast.error(tv('Please choose dates first', 'Vui lòng chọn ngày trước'));
      return;
    }

    navigate(`/book/${homestay._id}`, {
      state: { prefilledCheckIn: checkInDate, prefilledCheckOut: checkOutDate },
    });
  };

  return (
    <aside className="sticky top-20 space-y-4 rounded-xl border bg-white p-5 shadow-sm">
      <div className="flex items-baseline justify-between">
        <p className="text-2xl font-bold text-slate-900">{formatMoney(homestay.pricePerNight)}</p>
        <p className="text-sm text-slate-600">{tv('per night', 'mỗi đêm')}</p>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase text-slate-500">{tv('Check-in', 'Nhận phòng')}</label>
        <input type="date" value={checkInDate} onChange={(e) => setCheckInDate(e.target.value)} className="w-full rounded border p-2" />
      </div>
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase text-slate-500">{tv('Check-out', 'Trả phòng')}</label>
        <input type="date" value={checkOutDate} onChange={(e) => setCheckOutDate(e.target.value)} className="w-full rounded border p-2" />
      </div>

      <button onClick={checkAvailability} disabled={checking} className="w-full rounded border border-blue-600 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-70">
        {checking ? tv('Checking...', 'Đang kiểm tra...') : tv('Check availability', 'Kiểm tra tình trạng')}
      </button>

      {availabilityState && (
        <p className={`text-sm font-semibold ${availabilityState === 'available' ? 'text-emerald-600' : 'text-rose-600'}`}>
          {availabilityState === 'available' ? tv('Great choice! Your dates are available.', 'Tuyệt vời! Ngày bạn chọn còn trống.') : tv('Selected dates are currently unavailable.', 'Ngày bạn chọn hiện không còn trống.')}
        </p>
      )}

      <div className="space-y-2 rounded-lg bg-slate-50 p-3 text-sm">
        <div className="flex justify-between">
          <span>{formatMoney(homestay.pricePerNight)} x {nights || 0} {tv('nights', 'đêm')}</span>
          <span>{formatMoney(subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span>{tv('Service fee', 'Phí dịch vụ')}</span>
          <span>{formatMoney(serviceFee)}</span>
        </div>
        <div className="mt-2 flex justify-between border-t pt-2 font-semibold">
          <span>{tv('Total', 'Tổng')}</span>
          <span>{formatMoney(total)}</span>
        </div>
      </div>

      <button onClick={goToBooking} disabled={!nights} className="w-full rounded bg-emerald-600 px-4 py-2 text-white disabled:opacity-60">
        Reserve now
      </button>
    </aside>
  );
};

export default PropertyBookingCard;
