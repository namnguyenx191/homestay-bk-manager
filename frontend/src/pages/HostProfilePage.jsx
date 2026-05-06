import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import client from '../api/client';
import HomestayCard from '../components/HomestayCard';
import { useLanguage } from '../context/LanguageContext';
import { hostIdString } from '../utils/hostDisplay';

const provinceFromLocation = (location) => {
  const raw = String(location || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!raw.length) return '';
  return raw[raw.length - 1];
};

const HostProfilePage = () => {
  const { id } = useParams();
  const { tv } = useLanguage();
  const [items, setItems] = useState([]);
  const [areaFilter, setAreaFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await client.get('/homestays', { params: { ownerId: id, sort: 'newest' } });
        if (!cancelled) setItems(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!cancelled) {
          setItems([]);
          setError(e?.response?.data?.message || tv('Could not load host profile.', 'Không thể tải hồ sơ chủ nhà.'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [id, tv]);

  const host = items[0]?.ownerId;
  const hostName = useMemo(
    () => (host?.name ? String(host.name).trim() : tv('Host profile', 'Hồ sơ chủ nhà')),
    [host?.name, tv]
  );
  const ownerFilteredItems = useMemo(
    () => items.filter((item) => hostIdString(item.ownerId) === String(id)),
    [items, id]
  );
  const areaOptions = useMemo(() => {
    const uniq = new Set();
    ownerFilteredItems.forEach((item) => {
      const p = provinceFromLocation(item.location);
      if (p) uniq.add(p);
    });
    return ['all', ...Array.from(uniq)];
  }, [ownerFilteredItems]);
  const visibleItems = useMemo(() => {
    if (areaFilter === 'all') return ownerFilteredItems;
    return ownerFilteredItems.filter((item) => provinceFromLocation(item.location) === areaFilter);
  }, [ownerFilteredItems, areaFilter]);

  useEffect(() => {
    if (!areaOptions.includes(areaFilter)) setAreaFilter('all');
  }, [areaOptions, areaFilter]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-2xl bg-slate-200" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="h-72 animate-pulse rounded-xl bg-slate-200" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {tv('Host', 'Chủ nhà')}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">{hostName}</h1>
        {host?.email ? <p className="text-sm text-slate-600">{host.email}</p> : null}
        <p className="mt-2 text-sm text-slate-600">
          {ownerFilteredItems.length} {tv('listings by this host', 'chỗ ở của chủ nhà này')}
        </p>
      </section>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
      ) : null}

      {ownerFilteredItems.length > 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-2 text-sm font-semibold text-slate-800">
            {tv('Browse by province/city', 'Xem theo tỉnh/thành')}
          </p>
          <div className="flex flex-wrap gap-2">
            {areaOptions.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setAreaFilter(opt)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  areaFilter === opt
                    ? 'border-[#006ce4] bg-[#e8f3ff] text-[#006ce4]'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
                }`}
              >
                {opt === 'all' ? tv('All', 'Tất cả') : opt}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {ownerFilteredItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">
          {tv('This host has no public listings yet.', 'Chủ nhà này chưa có chỗ ở công khai.')}
          <div className="mt-3">
            <Link to="/search" className="font-semibold text-[#006ce4] hover:underline">
              {tv('Back to search', 'Quay lại tìm kiếm')}
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibleItems.map((item) => (
            <HomestayCard key={item._id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
};

export default HostProfilePage;
