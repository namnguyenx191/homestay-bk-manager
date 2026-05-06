import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useCurrency } from '../context/CurrencyContext';
import { fallbackImageByString } from '../utils/fallbackMedia';
import { getHostToneLight, hostDisplayName, hostIdString } from '../utils/hostDisplay';

const HomestayCard = ({ item }) => {
  const { tv } = useLanguage();
  const { formatMoney } = useCurrency();
  const hostName = hostDisplayName(item.ownerId);
  const hostId = hostIdString(item.ownerId);
  const tone = getHostToneLight(item.ownerId);
  return (
  <article className="overflow-hidden rounded-xl border bg-white shadow-sm">
    <img src={item.images?.[0] || fallbackImageByString(item.title || item._id)} alt={item.title} className="h-48 w-full object-cover" />
    <div className="space-y-2 p-4">
      <h3 className="line-clamp-1 text-lg font-semibold">{item.title}</h3>
      {hostName ? (
        <p>
          {hostId ? (
            <Link
              to={`/hosts/${hostId}`}
              className={`inline-flex max-w-full items-center gap-1 truncate rounded-full border-2 px-2 py-0.5 text-xs font-semibold hover:brightness-95 ${tone.ring} ${tone.bg} ${tone.text}`}
              title={hostName}
            >
              <span className="shrink-0">{tv('Host', 'Chủ nhà')}</span>
              <span className="min-w-0 truncate">{hostName}</span>
            </Link>
          ) : (
            <span className={`inline-flex max-w-full items-center gap-1 truncate rounded-full border-2 px-2 py-0.5 text-xs font-semibold ${tone.ring} ${tone.bg} ${tone.text}`} title={hostName}>
              <span className="shrink-0">{tv('Host', 'Chủ nhà')}</span>
              <span className="min-w-0 truncate">{hostName}</span>
            </span>
          )}
        </p>
      ) : null}
      <p className="text-sm text-slate-600">{item.location}</p>
      <p className="text-sm">⭐ {item.rating?.toFixed(1) || '0.0'} ({item.reviewCount || 0} {tv('reviews', 'đánh giá')})</p>
      <div className="flex items-center justify-between">
        <span className="font-semibold text-emerald-600">{formatMoney(item.pricePerNight)}/{tv('night', 'đêm')}</span>
        <Link to={`/homestays/${item._id}`} className="rounded bg-slate-900 px-3 py-1 text-white">{tv('View', 'Xem')}</Link>
      </div>
    </div>
  </article>
  );
};

export default HomestayCard;
