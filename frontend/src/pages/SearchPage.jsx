import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import client from '../api/client';
import SearchFiltersBar from '../components/SearchFiltersBar';
import SearchFilterSidebar from '../components/SearchFilterSidebar';
import PropertyListingCard from '../components/home/PropertyListingCard';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const SearchPage = () => {
  const { user } = useAuth();
  const { tv } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [wishlistIds, setWishlistIds] = useState(() => new Set());

  const fetchData = useCallback(async (params) => {
    const plain = Object.fromEntries(params.entries());
    const { data } = await client.get('/homestays', { params: plain });
    setItems(data);
  }, []);

  useEffect(() => {
    fetchData(searchParams);
  }, [searchParams, fetchData]);

  useEffect(() => {
    if (!user) {
      setWishlistIds(new Set());
      return;
    }
    client
      .get('/wishlist')
      .then(({ data }) => setWishlistIds(new Set(data.map((h) => h._id))))
      .catch(() => {});
  }, [user]);

  const onWishlistToggle = (id, inWishlist) => {
    setWishlistIds((prev) => {
      const next = new Set(prev);
      if (inWishlist) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleApply = (nextParams) => {
    setSearchParams(nextParams);
  };

  return (
    <div className="mx-auto max-w-7xl px-2 pb-6 sm:px-4">
      <SearchFiltersBar onApply={handleApply} />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <SearchFilterSidebar
          onApply={handleApply}
          homestaysForMap={items}
          className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:w-[300px] lg:shrink-0 lg:overflow-y-auto"
        />
        <div className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <div className="mb-4 flex items-end justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{tv('Search results', 'Kết quả tìm kiếm')}</h1>
              <p className="text-sm text-slate-600">
                {items.length} {tv('properties found', 'chỗ ở được tìm thấy')}
              </p>
            </div>
          </div>
          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">
              {tv('No properties found for this filter set.', 'Không có chỗ ở phù hợp với bộ lọc hiện tại.')}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <PropertyListingCard
                  key={item._id}
                  item={item}
                  variant="search"
                  className="!max-w-none min-w-0"
                  wishlistIds={wishlistIds}
                  onWishlistToggle={onWishlistToggle}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchPage;
