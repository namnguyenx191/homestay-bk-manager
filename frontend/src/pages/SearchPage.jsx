import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import client from '../api/client';
import SearchFilters from '../components/SearchFilters';
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
    <div>
      <h1 className="mb-4 text-2xl font-bold text-slate-900">{tv('Search results', 'Kết quả tìm kiếm')}</h1>
      <SearchFilters onApply={handleApply} />
      <p className="mb-4 text-sm text-slate-600">{items.length} {tv('properties found', 'chỗ ở được tìm thấy')}</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => (
          <PropertyListingCard
            key={item._id}
            item={item}
            className="!max-w-none min-w-0"
            wishlistIds={wishlistIds}
            onWishlistToggle={onWishlistToggle}
          />
        ))}
      </div>
    </div>
  );
};

export default SearchPage;
