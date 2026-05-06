import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useCurrency } from '../context/CurrencyContext';
import SearchMapMiniPage from './SearchMapMiniPage';

/** Upper bound for price slider (USD in DB); UI converts to VND. */
const PRICE_SLIDER_MAX_USD = 2500;

const SearchFilterSidebar = ({ onApply, className = '', homestaysForMap = [] }) => {
  const [searchParams] = useSearchParams();
  const { tv } = useLanguage();
  const { usdToVndRate, convertFromUsd, formatMoney } = useCurrency();
  const toUsd = useCallback((displayVal) => {
    const v = Number(displayVal);
    if (!Number.isFinite(v) || v < 0) return 0;
    return v / usdToVndRate;
  }, [usdToVndRate]);

  const displaySliderMax = useMemo(() => convertFromUsd(PRICE_SLIDER_MAX_USD), [convertFromUsd]);

  const [sort, setSort] = useState('newest');
  const [priceMinDisplay, setPriceMinDisplay] = useState(0);
  const [priceMaxDisplay, setPriceMaxDisplay] = useState(() => displaySliderMax);
  const [freeCancel, setFreeCancel] = useState(false);
  const [ratingMin, setRatingMin] = useState(0);
  const [instantConfirm, setInstantConfirm] = useState(false);
  const [mapModalOpen, setMapModalOpen] = useState(false);

  const syncFromUrl = useCallback(() => {
    setSort(searchParams.get('sort') || 'newest');
    setFreeCancel(searchParams.get('freeCancel') === '1');
    setRatingMin(Number(searchParams.get('rating') || 0));
    setInstantConfirm(searchParams.get('instantConfirm') === '1');

    const minP = searchParams.get('minPrice');
    const maxP = searchParams.get('maxPrice');
    const maxBound = convertFromUsd(PRICE_SLIDER_MAX_USD);
    setPriceMinDisplay(minP ? convertFromUsd(Number(minP)) : 0);
    setPriceMaxDisplay(maxP ? convertFromUsd(Number(maxP)) : maxBound);
  }, [searchParams, convertFromUsd]);

  useEffect(() => {
    syncFromUrl();
  }, [syncFromUrl]);

  const clampMin = (v) => Math.max(0, Math.min(v, priceMaxDisplay));
  const clampMax = (v) => Math.max(priceMinDisplay, Math.min(v, displaySliderMax));
  const formatDotNumber = (v) => Math.round(Number(v) || 0).toLocaleString('vi-VN');
  const parseDotNumber = (raw) => {
    const n = Number(String(raw || '').replace(/[^\d]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };

  const apply = () => {
    const next = new URLSearchParams(searchParams);
    const setOrDel = (key, val) => {
      if (val !== '' && val != null && val !== false) next.set(key, String(val));
      else next.delete(key);
    };

    next.delete('q');
    setOrDel('sort', sort === 'newest' ? '' : sort);
    if (sort === 'newest') next.delete('sort');

    if (freeCancel) next.set('freeCancel', '1');
    else next.delete('freeCancel');

    if (ratingMin > 0) next.set('rating', String(ratingMin));
    else next.delete('rating');

    if (instantConfirm) next.set('instantConfirm', '1');
    else next.delete('instantConfirm');

    const minUsd = toUsd(priceMinDisplay);
    const maxUsd = toUsd(priceMaxDisplay);
    if (minUsd > 0.01) next.set('minPrice', String(Math.round(minUsd * 100) / 100));
    else next.delete('minPrice');

    const atCeiling = priceMaxDisplay >= displaySliderMax * 0.985;
    if (!atCeiling && maxUsd > minUsd + 0.01) next.set('maxPrice', String(Math.round(maxUsd * 100) / 100));
    else next.delete('maxPrice');

    onApply(next);
  };

  const resetFilters = () => {
    const next = new URLSearchParams();
    const s = searchParams.get('sort');
    if (s && s !== 'newest') next.set('sort', s);
    const loc = searchParams.get('location');
    if (loc) next.set('location', loc);
    const cin = searchParams.get('checkIn');
    if (cin) next.set('checkIn', cin);
    const cout = searchParams.get('checkOut');
    if (cout) next.set('checkOut', cout);
    onApply(next);
    setSort(s && s !== 'newest' ? s : 'newest');
    setFreeCancel(false);
    setRatingMin(0);
    setInstantConfirm(false);
    setPriceMinDisplay(0);
    setPriceMaxDisplay(displaySliderMax);
  };

  const step = 50000;

  const mapFocus = searchParams.get('location') || '';
  const locLabel = mapFocus || tv('Vietnam', 'Việt Nam');

  return (
    <>
    <aside
      className={`rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-sm ${className}`}
    >
      <button
        type="button"
        onClick={() => setMapModalOpen(true)}
        className="relative mb-4 w-full overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-sky-100 via-slate-100 to-sky-200 py-8 text-center transition hover:opacity-95"
      >
        <MapPin className="mx-auto mb-1 h-8 w-8 text-[#006ce4]" strokeWidth={2} aria-hidden />
        <span className="text-xs font-bold uppercase tracking-wide text-slate-800">
          {tv('View on map', 'Xem vị trí')}
        </span>
        <span className="mt-0.5 block text-[10px] text-slate-600">{locLabel}</span>
      </button>

      <div className="mb-4 border-t border-slate-200 pt-4">
        <p className="mb-2 text-sm font-bold text-slate-900">{tv('Sort', 'Sắp xếp')}</p>
        <div className="space-y-2 text-sm">
          {[
            { value: 'newest', label: tv('Recommended', 'Được ưa chuộng') },
            { value: 'priceAsc', label: tv('Price: Low to High', 'Giá thấp nhất trước') },
            { value: 'priceDesc', label: tv('Price: High to Low', 'Xếp hạng cao nhất trước') },
          ].map((opt) => (
            <label key={opt.value} className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="search-sort"
                value={opt.value}
                checked={sort === opt.value}
                onChange={() => setSort(opt.value)}
                className="h-4 w-4 border-slate-300 text-[#006ce4] focus:ring-[#006ce4]"
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="mb-4 border-t border-slate-200 pt-4">
        <p className="mb-3 text-sm font-bold text-slate-900">{tv('Price', 'Giá')}</p>
        <div className="mb-3 space-y-2">
          <input
            type="range"
            min={0}
            max={displaySliderMax}
            step={step}
            value={clampMax(priceMaxDisplay)}
            onChange={(e) => setPriceMaxDisplay(clampMax(Number(e.target.value)))}
            className="h-2 w-full cursor-pointer accent-[#006ce4]"
          />
        </div>
        <div className="flex items-end gap-2">
          <label className="flex-1 text-[10px] font-bold uppercase text-slate-500">
            {tv('Min', 'Tối thiểu')}
            <input
              type="text"
              inputMode="numeric"
              value={formatDotNumber(priceMinDisplay)}
              onChange={(e) => setPriceMinDisplay(clampMin(parseDotNumber(e.target.value)))}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
          <span className="mb-2 text-slate-400">—</span>
          <label className="flex-1 text-[10px] font-bold uppercase text-slate-500">
            {tv('Max', 'Tối đa')}
            <input
              type="text"
              inputMode="numeric"
              value={formatDotNumber(priceMaxDisplay)}
              onChange={(e) => setPriceMaxDisplay(clampMax(parseDotNumber(e.target.value)))}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {formatMoney(toUsd(priceMinDisplay))} – {formatMoney(toUsd(priceMaxDisplay))}
        </p>
      </div>

      <div className="border-t border-slate-200 pt-4">
        <p className="mb-2 text-sm font-bold text-slate-900">{tv('Star rating', 'Đánh giá sao')}</p>
        <div className="space-y-2 text-sm">
          {[5, 4, 3, 2, 1].map((star) => (
            <label key={star} className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={ratingMin === star}
                onChange={() => setRatingMin((prev) => (prev === star ? 0 : star))}
                className="h-4 w-4 rounded border-slate-300 text-[#006ce4] focus:ring-[#006ce4]"
              />
              <span className="text-amber-600">{'★'.repeat(star)}</span>
            </label>
          ))}
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={ratingMin === 0}
              onChange={() => setRatingMin(0)}
              className="h-4 w-4 rounded border-slate-300 text-[#006ce4] focus:ring-[#006ce4]"
            />
            <span className="text-slate-600">{tv('No rating filter', 'Không có đánh giá')}</span>
          </label>
        </div>
      </div>

      <div className="mt-4 border-t border-slate-200 pt-4">
        <p className="mb-2 text-sm font-bold text-slate-900">{tv('Booking features', 'Đặc điểm của đơn đặt chỗ')}</p>
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={freeCancel}
            onChange={(e) => setFreeCancel(e.target.checked)}
            className="mt-1 rounded border-slate-300 text-[#006ce4] focus:ring-[#006ce4]"
          />
          <span>{tv('Free cancellation policy', 'Chính sách hủy miễn phí / linh hoạt')}</span>
        </label>
        <label className="mt-2 flex cursor-pointer items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={instantConfirm}
            onChange={(e) => setInstantConfirm(e.target.checked)}
            className="mt-1 rounded border-slate-300 text-[#006ce4] focus:ring-[#006ce4]"
          />
          <span>{tv('Instant confirmation', 'Xác nhận ngay lập tức')}</span>
        </label>
      </div>

      <div className="mt-4 border-t border-slate-200 pt-4">
        <p className="mb-2 text-sm font-bold text-slate-900">{tv('Time', 'Thời gian')}</p>
        <p className="text-xs text-slate-500">
          {tv('Use check-in / check-out on top search bar.', 'Dùng ngày nhận / trả phòng ở thanh tìm kiếm phía trên.')}
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-2">
        <button
          type="button"
          onClick={apply}
          className="w-full rounded-lg bg-[#006ce4] py-2.5 text-sm font-semibold text-white shadow hover:bg-[#0057b8]"
        >
          {tv('Apply filters', 'Áp dụng bộ lọc')}
        </button>
        <button
          type="button"
          onClick={resetFilters}
          className="w-full rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {tv('Clear all', 'Xóa bộ lọc')}
        </button>
      </div>
    </aside>
    <SearchMapMiniPage
      open={mapModalOpen}
      onClose={() => setMapModalOpen(false)}
      homestays={homestaysForMap}
      focusLocation={mapFocus}
      checkIn={searchParams.get('checkIn') || ''}
      checkOut={searchParams.get('checkOut') || ''}
    />
    </>
  );
};

export default SearchFilterSidebar;
