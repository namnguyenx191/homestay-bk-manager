import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';

const SearchFilters = ({ onApply }) => {
  const [searchParams] = useSearchParams();
  const { tv } = useLanguage();
  const [filters, setFilters] = useState({
    location: '',
    q: '',
    minPrice: '',
    maxPrice: '',
    rating: '',
    roomType: '',
    sort: 'newest',
  });

  useEffect(() => {
    setFilters({
      location: searchParams.get('location') || '',
      q: searchParams.get('q') || '',
      minPrice: searchParams.get('minPrice') || '',
      maxPrice: searchParams.get('maxPrice') || '',
      rating: searchParams.get('rating') || '',
      roomType: searchParams.get('roomType') || '',
      sort: searchParams.get('sort') || 'newest',
    });
  }, [searchParams]);

  const update = (e) => setFilters((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const apply = () => {
    const next = new URLSearchParams(searchParams);
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== '' && v != null) next.set(k, String(v));
      else next.delete(k);
    });
    onApply(next);
  };

  return (
    <section className="mb-6 rounded-xl border border-white/20 bg-white/95 p-4 shadow-sm backdrop-blur">
      <div className="grid gap-3 md:grid-cols-6 lg:grid-cols-8">
        <input
          name="location"
          placeholder={tv('Location', 'Địa điểm')}
          value={filters.location}
          onChange={update}
          className="rounded border border-slate-200 bg-white p-2 text-sm text-slate-900 placeholder:text-slate-500"
        />
        <input
          name="q"
          placeholder={tv('Keyword (title)', 'Từ khóa (tiêu đề)')}
          value={filters.q}
          onChange={update}
          className="rounded border border-slate-200 bg-white p-2 text-sm text-slate-900 placeholder:text-slate-500"
        />
        <input
          name="roomType"
          placeholder={tv('Room type', 'Loại phòng')}
          value={filters.roomType}
          onChange={update}
          className="rounded border border-slate-200 bg-white p-2 text-sm text-slate-900 placeholder:text-slate-500"
        />
        <input
          name="minPrice"
          placeholder={tv('Min price', 'Giá tối thiểu')}
          value={filters.minPrice}
          onChange={update}
          className="rounded border border-slate-200 bg-white p-2 text-sm text-slate-900 placeholder:text-slate-500"
        />
        <input
          name="maxPrice"
          placeholder={tv('Max price', 'Giá tối đa')}
          value={filters.maxPrice}
          onChange={update}
          className="rounded border border-slate-200 bg-white p-2 text-sm text-slate-900 placeholder:text-slate-500"
        />
        <input
          name="rating"
          placeholder={tv('Min rating', 'Điểm tối thiểu')}
          value={filters.rating}
          onChange={update}
          className="rounded border border-slate-200 bg-white p-2 text-sm text-slate-900 placeholder:text-slate-500"
        />
        <select
          name="sort"
          value={filters.sort}
          onChange={update}
          className="rounded border border-slate-200 bg-white p-2 text-sm font-medium text-slate-900"
        >
          <option value="newest">{tv('Newest', 'Mới nhất')}</option>
          <option value="priceAsc">{tv('Price: Low to High', 'Giá: thấp đến cao')}</option>
          <option value="priceDesc">{tv('Price: High to Low', 'Giá: cao đến thấp')}</option>
          <option value="popularity">{tv('Popularity', 'Phổ biến')}</option>
        </select>
        <button
          type="button"
          onClick={apply}
          className="rounded bg-[#006ce4] px-4 py-2 text-sm font-semibold text-white shadow hover:bg-[#0057b8]"
        >
          Apply
        </button>
      </div>
    </section>
  );
};

export default SearchFilters;
