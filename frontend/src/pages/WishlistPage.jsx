import { useEffect, useMemo, useState } from 'react';
import client from '../api/client';
import PropertyListingCard from '../components/home/PropertyListingCard';
import { useLanguage } from '../context/LanguageContext';

const WishlistPage = () => {
  const [items, setItems] = useState([]);
  const { tv } = useLanguage();

  useEffect(() => {
    client.get('/wishlist').then(({ data }) => setItems(data));
  }, []);

  const wishlistIds = useMemo(() => new Set(items.map((i) => i._id)), [items]);

  const onWishlistToggle = (id, inWishlist) => {
    if (!inWishlist) {
      setItems((prev) => prev.filter((x) => String(x._id) !== String(id)));
    }
  };

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">{tv('Saved homes', 'Chỗ ở đã lưu')}</h1>
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
      {!items.length && <p className="text-sm text-slate-500">{tv('No saved homes yet.', 'Bạn chưa lưu chỗ ở nào.')}</p>}
    </section>
  );
};

export default WishlistPage;
