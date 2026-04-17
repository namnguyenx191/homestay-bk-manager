import { Link } from 'react-router-dom';
import WishlistButton from '../WishlistButton';
import TiltCard from '../motion/TiltCard';
import { useLanguage } from '../../context/LanguageContext';
import { useCurrency } from '../../context/CurrencyContext';
import { fallbackImageByString } from '../../utils/fallbackMedia';
import { getHostAccent, hostDisplayName } from '../../utils/hostDisplay';

const ratingLabel = (score, tv) => {
  const s = Number(score) || 0;
  if (s >= 9) return tv('Superb', 'Xuất sắc');
  if (s >= 8) return tv('Excellent', 'Rất tốt');
  if (s >= 7) return tv('Good', 'Tốt');
  if (s >= 6) return tv('Pleasant', 'Ổn');
  return tv('Review score', 'Điểm đánh giá');
};

const PropertyListingCard = ({ item, wishlistIds = new Set(), onWishlistToggle, className = '' }) => {
  const { tv } = useLanguage();
  const { formatMoney } = useCurrency();
  const score = item.rating ?? 0;
  const reviews = item.reviewCount ?? 0;
  const inList = wishlistIds.has(item._id);
  const hostName = hostDisplayName(item.ownerId);
  const hostAccent = getHostAccent(item.ownerId);

  return (
    <TiltCard
      className={`w-full min-w-[260px] max-w-[320px] flex-shrink-0 snap-start ${className}`}
      innerClassName="rounded-lg shadow-sm transition-shadow duration-200 [box-shadow:0_8px_28px_-10px_rgba(0,0,0,0.45)] hover:[box-shadow:0_18px_44px_-14px_rgba(0,0,0,0.55)]"
      intensity={9}
    >
      <article className="group relative z-[1] h-full overflow-hidden rounded-lg border border-white/10 bg-[#20262e]">
      <div className="relative aspect-[4/3] overflow-hidden bg-[#171c22]">
        <img
          src={item.images?.[0] || fallbackImageByString(item.title || item._id)}
          alt={item.title}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        />
        <div className="absolute right-2 top-2 z-10">
          <WishlistButton
            homestayId={item._id}
            isActive={inList}
            onChanged={(data) => onWishlistToggle?.(item._id, data?.inWishlist)}
          />
        </div>
      </div>
      <div className="p-3">
        <Link to={`/homestays/${item._id}`} className="block">
          <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-bold leading-tight text-slate-100 hover:underline">
            {item.title}
          </h3>
        </Link>
        {hostName ? (
          <p className="mt-1.5">
            <span
              className="inline-flex max-w-full items-center gap-1 truncate rounded-full border px-2 py-0.5 text-[11px] font-semibold"
              style={{
                backgroundColor: hostAccent.bg,
                borderColor: hostAccent.border,
                color: hostAccent.text,
              }}
              title={hostName}
            >
              <span className="shrink-0">{tv('Host', 'Chủ nhà')}</span>
              <span className="min-w-0 truncate">{hostName}</span>
            </span>
          </p>
        ) : null}
        <p className="mt-1 line-clamp-1 text-xs text-slate-300">{item.location}</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className="flex h-7 min-w-[2rem] items-center justify-center rounded px-1.5 text-xs font-bold text-white"
              style={{ backgroundColor: '#003580' }}
            >
              {Number(score).toFixed(1).replace('.', ',')}
            </span>
            <div className="text-xs leading-tight">
              <span className="font-semibold text-slate-200">{ratingLabel(score, tv)}</span>
              <span className="block text-slate-300">{reviews} {tv('reviews', 'đánh giá')}</span>
            </div>
          </div>
          <div className="text-right text-xs">
            <span className="text-slate-300">{tv('Starting from', 'Giá từ')}</span>
            <p className="font-bold text-slate-100">
              {formatMoney(item.pricePerNight)}
              <span className="font-normal text-slate-300"> / {tv('night', 'đêm')}</span>
            </p>
          </div>
        </div>
      </div>
      </article>
    </TiltCard>
  );
};

export default PropertyListingCard;
