import WishlistButton from '../WishlistButton';
import { useLanguage } from '../../context/LanguageContext';
import { useCurrency } from '../../context/CurrencyContext';
import { getHostToneLight, hostDisplayName } from '../../utils/hostDisplay';

const PropertyHeader = ({ homestay, inWishlist, onWishlistChanged }) => {
  const { tv } = useLanguage();
  const { formatMoney } = useCurrency();
  const hostName = hostDisplayName(homestay.ownerId);
  const tone = getHostToneLight(homestay.ownerId);
  return (
  <section className="space-y-3 rounded-xl border bg-white p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{homestay.title}</h1>
        <p className="text-sm text-slate-600">{homestay.location}{homestay.address ? `, ${homestay.address}` : ''}</p>
        {hostName ? (
          <p className="mt-2">
            <span className={`inline-flex max-w-full items-center gap-2 truncate rounded-full border-2 px-3 py-1 text-sm font-semibold ${tone.ring} ${tone.bg} ${tone.text}`}>
              <span className="shrink-0">{tv('Host', 'Chủ nhà')}</span>
              <span className="min-w-0 truncate">{hostName}</span>
            </span>
          </p>
        ) : null}
      </div>
      <WishlistButton homestayId={homestay._id} isActive={inWishlist} onChanged={onWishlistChanged} />
    </div>

    <div className="flex flex-wrap gap-2">
      {(homestay.highlights?.length ? homestay.highlights : [tv('Great location', 'Vị trí đẹp'), tv('Free cancellation', 'Hủy miễn phí'), tv('Top rated host', 'Chủ nhà được đánh giá cao')]).map((tag) => (
        <span key={tag} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{tag}</span>
      ))}
    </div>

    <div className="flex flex-wrap items-center gap-4 text-sm">
      <span className="rounded bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">⭐ {homestay.rating?.toFixed(1) || '0.0'}</span>
      <span className="text-slate-600">{homestay.reviewCount || 0} {tv('verified reviews', 'đánh giá xác thực')}</span>
      <span className="font-semibold text-slate-700">{formatMoney(homestay.pricePerNight)}/{tv('night', 'đêm')}</span>
    </div>
  </section>
  );
};

export default PropertyHeader;
