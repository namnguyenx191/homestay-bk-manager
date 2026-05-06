import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BedDouble,
  Compass,
  DollarSign,
  FilterX,
  Home,
  Star,
  Wind,
  Wifi,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

/** Thanh tìm kiếm ngang: địa điểm, ngày nhận / trả phòng (đồng bộ URL; không còn tìm theo văn bản). */
const SearchFiltersBar = ({ onApply }) => {
  const [searchParams] = useSearchParams();
  const { t, tv } = useLanguage();
  const [filters, setFilters] = useState({
    location: '',
  });

  useEffect(() => {
    setFilters({
      location: searchParams.get('location') || '',
    });
  }, [searchParams]);

  const update = (e) => setFilters((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const apply = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('q');
    if (filters.location.trim()) next.set('location', filters.location.trim());
    else next.delete('location');
    onApply(next);
  };

  const quickActions = [
    { id: 'recommended', icon: Compass, label: tv('Recommended', 'Đề xuất'), apply: (next) => next.delete('sort') },
    { id: 'priceAsc', icon: DollarSign, label: tv('Low price', 'Giá thấp'), apply: (next) => next.set('sort', 'priceAsc') },
    { id: 'priceDesc', icon: DollarSign, label: tv('High price', 'Giá cao'), apply: (next) => next.set('sort', 'priceDesc') },
    { id: 'rating', icon: Star, label: tv('Rating 4+', 'Điểm 4+'), apply: (next) => next.set('rating', '4') },
    { id: 'entire', icon: Home, label: tv('Entire place', 'Nguyên căn'), apply: (next) => next.set('roomType', 'Entire place') },
    { id: 'private', icon: BedDouble, label: tv('Private room', 'Phòng riêng'), apply: (next) => next.set('roomType', 'Private room') },
    { id: 'wifi', icon: Wifi, label: 'WiFi', apply: (next) => next.set('amenities', 'WiFi') },
    { id: 'ac', icon: Wind, label: tv('Air conditioning', 'Điều hòa'), apply: (next) => next.set('amenities', 'Air conditioning') },
    {
      id: 'clear',
      icon: FilterX,
      label: tv('Clear filters', 'Xóa lọc'),
      apply: (next) => {
        next.delete('sort');
        next.delete('rating');
        next.delete('roomType');
        next.delete('amenities');
        next.delete('minPrice');
        next.delete('maxPrice');
        next.delete('freeCancel');
      },
    },
  ];

  const applyQuick = (handler) => {
    const next = new URLSearchParams(searchParams);
    handler(next);
    if (filters.location.trim()) next.set('location', filters.location.trim());
    else next.delete('location');
    next.delete('q');
    onApply(next);
  };

  return (
    <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <div className="grid gap-2 rounded-xl bg-white p-2 sm:grid-cols-[1fr_auto]">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">{t('heroDestination')}</span>
          <input
            name="location"
            placeholder={t('heroWhere')}
            value={filters.location}
            onChange={update}
            className="rounded-lg border border-slate-200 bg-white p-2.5 text-sm text-slate-900 placeholder:text-slate-500"
          />
        </label>
        <div className="flex items-end">
          <button
            type="button"
            onClick={apply}
            className="w-full rounded-lg bg-[#006ce4] px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-[#0057b8] sm:w-auto sm:min-w-[8rem]"
          >
            {t('heroSearch')}
          </button>
        </div>
      </div>
      <div className="mt-2 flex gap-1 overflow-x-auto rounded-xl bg-white px-1 py-2 sm:gap-2">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              type="button"
              onClick={() => applyQuick(action.apply)}
              className="inline-flex min-w-[90px] shrink-0 flex-col items-center gap-1 rounded-lg border border-slate-200 px-2 py-2 text-center text-[11px] font-medium text-slate-700 hover:border-[#006ce4] hover:text-[#006ce4]"
            >
              <Icon className="h-4 w-4" aria-hidden />
              <span className="line-clamp-2 leading-tight">{action.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default SearchFiltersBar;
