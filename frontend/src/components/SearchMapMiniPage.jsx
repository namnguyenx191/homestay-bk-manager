import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ExternalLink, MapPin, Search, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useCurrency } from '../context/CurrencyContext';
import { coordsFromLocationString, haversineKm, resolveHomestayLatLng } from '../utils/mapCoords';
import { fallbackImageByString } from '../utils/fallbackMedia';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const ratingLabel = (score, tv) => {
  const s = Number(score) || 0;
  if (s >= 9) return tv('Superb', 'Xuất sắc');
  if (s >= 8) return tv('Excellent', 'Rất tốt');
  if (s >= 7) return tv('Good', 'Tốt');
  if (s >= 6) return tv('Pleasant', 'Ổn');
  return tv('Review score', 'Điểm đánh giá');
};

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Chỉ hiển thị chỗ ở trong bán kính này (km) quanh điểm tham chiếu. */
const MAP_RADIUS_KM = 10;

const nightsBetween = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) return null;
  const a = new Date(checkIn);
  const b = new Date(checkOut);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b <= a) return null;
  return Math.ceil((b - a) / (86400000));
};

/**
 * Minipage: danh sách trái + bản đồ phải (marker giá), vị trí thực user, tìm trên bản đồ.
 */
const SearchMapMiniPage = ({
  open,
  onClose,
  homestays = [],
  focusLocation = '',
  checkIn = '',
  checkOut = '',
}) => {
  const { tv, lang } = useLanguage();
  const { formatMoney } = useCurrency();
  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const markersByIdRef = useRef({});

  const [mapQuery, setMapQuery] = useState('');
  const [sortMode, setSortMode] = useState('distance');
  const [userPos, setUserPos] = useState(null);
  const [geoDenied, setGeoDenied] = useState(false);
  /** Marker giá / dòng danh sách — panel tóm tắt homestay */
  const [previewHomestayId, setPreviewHomestayId] = useState(null);

  const homestayIdsKey = useMemo(() => homestays.map((h) => String(h._id)).join(','), [homestays]);

  const areaCenter = useMemo(() => {
    const label = String(focusLocation || '').trim();
    if (label) return coordsFromLocationString(label);
    if (!homestays.length) return coordsFromLocationString('Vietnam');
    let lat = 0;
    let lng = 0;
    homestays.forEach((h, i) => {
      const ll = resolveHomestayLatLng(h, i);
      lat += ll[0];
      lng += ll[1];
    });
    return [lat / homestays.length, lng / homestays.length];
  }, [focusLocation, homestayIdsKey, homestays]);

  const [cLat, cLng] = areaCenter;

  const refLat = userPos ? userPos.lat : cLat;
  const refLng = userPos ? userPos.lng : cLng;
  const rankPoint = [refLat, refLng];

  const filteredHomestays = useMemo(() => {
    const q = mapQuery.trim().toLowerCase();
    if (!q) return homestays;
    return homestays.filter((h) => {
      const t = `${h.title || ''} ${h.location || ''}`.toLowerCase();
      return t.includes(q);
    });
  }, [homestays, mapQuery]);

  const inRadiusHomestays = useMemo(() => {
    return filteredHomestays.filter((h) => {
      const oi = homestays.findIndex((x) => String(x._id) === String(h._id));
      const ll = resolveHomestayLatLng(h, oi >= 0 ? oi : 0);
      return haversineKm(rankPoint, ll) <= MAP_RADIUS_KM;
    });
  }, [filteredHomestays, homestays, refLat, refLng]);

  const ranked = useMemo(() => {
    const withDist = inRadiusHomestays.map((h) => {
      const oi = homestays.findIndex((x) => String(x._id) === String(h._id));
      const ll = resolveHomestayLatLng(h, oi >= 0 ? oi : 0);
      return { h, ll, km: haversineKm(rankPoint, ll) };
    });
    const sorted = [...withDist];
    if (sortMode === 'priceAsc') sorted.sort((a, b) => (a.h.pricePerNight || 0) - (b.h.pricePerNight || 0));
    else if (sortMode === 'priceDesc') sorted.sort((a, b) => (b.h.pricePerNight || 0) - (a.h.pricePerNight || 0));
    else sorted.sort((a, b) => a.km - b.km);
    return sorted;
  }, [inRadiusHomestays, homestays, refLat, refLng, sortMode]);

  const nights = nightsBetween(checkIn, checkOut);

  const previewEntry = useMemo(() => {
    if (!previewHomestayId) return null;
    return ranked.find((r) => String(r.h._id) === previewHomestayId) ?? null;
  }, [ranked, previewHomestayId]);

  useEffect(() => {
    if (!open) {
      setMapQuery('');
      setUserPos(null);
      setGeoDenied(false);
      setPreviewHomestayId(null);
      return undefined;
    }
    let cancelled = false;
    if (!navigator.geolocation) {
      setGeoDenied(true);
      return undefined;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoDenied(false);
      },
      () => {
        if (cancelled) return;
        setUserPos(null);
        setGeoDenied(true);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (previewHomestayId) setPreviewHomestayId(null);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, previewHomestayId]);

  const inRadiusKey = useMemo(
    () => inRadiusHomestays.map((h) => String(h._id)).join(','),
    [inRadiusHomestays]
  );

  const userKey = userPos ? `${userPos.lat.toFixed(5)},${userPos.lng.toFixed(5)}` : 'none';

  const homestaysRef = useRef(homestays);
  homestaysRef.current = homestays;
  const inRadiusHomestaysRef = useRef(inRadiusHomestays);
  inRadiusHomestaysRef.current = inRadiusHomestays;
  const formatMoneyRef = useRef(formatMoney);
  formatMoneyRef.current = formatMoney;
  const tvRef = useRef(tv);
  tvRef.current = tv;
  const userPosRef = useRef(userPos);
  userPosRef.current = userPos;

  useEffect(() => {
    if (!open || !mapElRef.current) return undefined;

    const refLatN = Number(refLat);
    const refLngN = Number(refLng);
    if (!Number.isFinite(refLatN) || !Number.isFinite(refLngN)) return undefined;

    const homestaysAll = homestaysRef.current;
    const inRadius = inRadiusHomestaysRef.current;
    const fm = formatMoneyRef.current;
    const tvFn = tvRef.current;
    const up = userPosRef.current;

    markersByIdRef.current = {};
    let map;
    try {
      map = L.map(mapElRef.current, { scrollWheelZoom: true, zoomControl: true });
    } catch (e) {
      console.error('[SearchMapMiniPage] Leaflet map init failed', e);
      return undefined;
    }
    map.zoomControl.setPosition('bottomright');
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    const group = L.layerGroup().addTo(map);
    const markers = [];
    const radiusM = MAP_RADIUS_KM * 1000;
    const zoneCircle = L.circle([refLatN, refLngN], {
      radius: radiusM,
      color: '#006ce4',
      weight: 2,
      fillColor: '#006ce4',
      fillOpacity: 0.06,
    }).addTo(group);

    inRadius.forEach((h, i) => {
      const oi = homestaysAll.findIndex((x) => String(x._id) === String(h._id));
      const ll = resolveHomestayLatLng(h, oi >= 0 ? oi : i);
      const priceText = escapeHtml(fm(h.pricePerNight));
      const bg = i % 2 === 0 ? '#0d9488' : '#0369a1';
      const iconHtml = `<div style="cursor:pointer;background:${bg};color:#fff;padding:5px 10px;border-radius:999px;font-size:11px;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,.25);white-space:nowrap;border:2px solid #fff;">${priceText}</div>`;
      const icon = L.divIcon({
        html: iconHtml,
        className: 'search-map-price-marker !m-0 !border-0 bg-transparent',
        iconSize: [88, 36],
        iconAnchor: [44, 36],
      });
      const m = L.marker(ll, { icon });
      m.on('click', (ev) => {
        if (ev?.originalEvent) L.DomEvent.stopPropagation(ev.originalEvent);
        setPreviewHomestayId(String(h._id));
      });
      m.addTo(group);
      markers.push(m);
      markersByIdRef.current[String(h._id)] = m;
    });

    if (up && Number.isFinite(up.lat) && Number.isFinite(up.lng)) {
      const uIcon = L.divIcon({
        html: `<div style="width:22px;height:22px;background:#dc2626;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.35);"></div>`,
        className: 'search-map-user-marker',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      const u = L.marker([up.lat, up.lng], { icon: uIcon }).bindPopup(
        `<strong>${escapeHtml(tvFn('Your location', 'Vị trí của bạn'))}</strong>`
      );
      u.addTo(group);
      markers.push(u);
    }

    try {
      const bounds = zoneCircle.getBounds();
      markers.forEach((m) => bounds.extend(m.getLatLng()));
      map.fitBounds(bounds, { padding: [28, 28], maxZoom: 14 });
    } catch (e) {
      console.error('[SearchMapMiniPage] fitBounds failed', e);
      map.setView([refLatN, refLngN], 12);
    }

    const onMapClick = () => setPreviewHomestayId(null);
    map.on('click', onMapClick);

    map.invalidateSize();
    requestAnimationFrame(() => map.invalidateSize());

    return () => {
      map.off('click', onMapClick);
      map.remove();
      mapRef.current = null;
      markersByIdRef.current = {};
    };
  }, [open, inRadiusKey, userKey, refLat, refLng]);

  useEffect(() => {
    if (!open || !mapRef.current) return;
    const t = window.setTimeout(() => {
      mapRef.current?.invalidateSize();
    }, 250);
    return () => window.clearTimeout(t);
  }, [open, inRadiusKey, userKey]);

  const flyToProperty = useCallback((id) => {
    const map = mapRef.current;
    const m = markersByIdRef.current[String(id)];
    setPreviewHomestayId(String(id));
    if (map && m) {
      map.flyTo(m.getLatLng(), Math.max(map.getZoom(), 14), { duration: 0.6 });
    }
  }, []);

  if (!open) return null;

  const dateFmt = (d) => {
    if (!d) return '';
    try {
      return new Date(d).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-GB', {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return d;
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="search-map-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex h-[min(88vh,920px)] max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl lg:max-w-[1200px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <h2 id="search-map-title" className="text-base font-bold text-slate-900 sm:text-lg">
              {tv('Stays on the map', 'Chỗ ở trên bản đồ')}
            </h2>
            <p className="text-xs text-slate-600">
              <span className="font-semibold text-slate-800">{ranked.length}</span>{' '}
              {tv('places within 10 km', 'nơi ở trong 10 km')}
              {userPos
                ? ` · ${tv('from your location', 'từ vị trí của bạn')}`
                : ` · ${tv('from search area center', 'từ tâm khu vực')}`}
              {nights != null && checkIn && checkOut ? (
                <>
                  {' · '}
                  {nights} {tv('night', 'đêm')} ({dateFmt(checkIn)} – {dateFmt(checkOut)})
                </>
              ) : null}
            </p>
            {geoDenied ? (
              <p className="mt-1 text-[11px] text-amber-700">
                {tv('Location access denied — distances use search area.', 'Không bật vị trí — khoảng cách theo khu vực tìm kiếm.')}
              </p>
            ) : userPos ? (
              <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-700">
                <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                {tv('Showing your position on the map', 'Đang hiển thị vị trí thực của bạn trên bản đồ')}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
            aria-label={tv('Close', 'Đóng')}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* Cột trái: danh sách */}
          <div className="flex min-h-[40vh] w-full flex-col border-slate-200 md:w-[40%] md:max-w-md md:border-r">
            <div className="shrink-0 border-b border-slate-100 p-3">
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {tv('Sort by', 'Sắp xếp theo')}
              </label>
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
              >
                <option value="distance">{tv('Distance', 'Khoảng cách')}</option>
                <option value="priceAsc">{tv('Price: Low to High', 'Giá: thấp → cao')}</option>
                <option value="priceDesc">{tv('Price: High to Low', 'Giá: cao → thấp')}</option>
              </select>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {ranked.length === 0 ? (
                <p className="text-sm text-slate-600">{tv('No properties match.', 'Không có chỗ ở phù hợp.')}</p>
              ) : (
                <ul className="space-y-3">
                  {ranked.map(({ h, km }) => {
                    const score = h.rating ?? 0;
                    const reviews = h.reviewCount ?? 0;
                    return (
                      <li key={h._id}>
                        <div
                          role="presentation"
                          onClick={() => flyToProperty(h._id)}
                          className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white p-2 text-left shadow-sm transition hover:border-sky-300 hover:shadow-md"
                        >
                          <div className="flex gap-3">
                            <Link
                              to={`/homestays/${h._id}`}
                              className="shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <img
                                src={h.images?.[0] || fallbackImageByString(h.title || h._id)}
                                alt=""
                                className="h-24 w-28 rounded-lg object-cover"
                              />
                            </Link>
                            <div className="min-w-0 flex-1">
                              <Link
                                to={`/homestays/${h._id}`}
                                className="line-clamp-2 text-sm font-bold text-slate-900 hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {h.title}
                              </Link>
                              <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{h.location}</p>
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                <span className="rounded bg-[#003580] px-1.5 py-0.5 text-xs font-bold text-white">
                                  {Number(score).toFixed(1)}
                                </span>
                                <span className="text-xs text-slate-600">
                                  {ratingLabel(score, tv)} · {reviews} {tv('reviews', 'đánh giá')}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-slate-500">
                                ~{km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`}{' '}
                                {userPos
                                  ? tv('from you', 'từ bạn')
                                  : tv('from area center', 'từ khu vực')}
                              </p>
                              <p className="mt-1 text-base font-bold text-[#006ce4]">
                                {formatMoney(h.pricePerNight)}
                                <span className="text-xs font-normal text-slate-500"> / {tv('night', 'đêm')}</span>
                              </p>
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Cột phải: bản đồ */}
          <div className="relative w-full min-h-[min(45vh,360px)] flex-1 bg-slate-100 md:min-h-[min(50vh,420px)]">
            <div className="absolute left-3 right-3 top-3 z-[500]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={mapQuery}
                  onChange={(e) => setMapQuery(e.target.value)}
                  placeholder={tv('Search on map', 'Tìm trên bản đồ')}
                  className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm shadow-md outline-none ring-0 placeholder:text-slate-400 focus:border-[#006ce4]"
                />
              </div>
            </div>
            <div
              ref={mapElRef}
              className="h-full min-h-[280px] w-full md:absolute md:inset-0 md:min-h-[280px]"
            />
            {previewEntry ? (
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 z-[600] flex justify-center p-3 md:justify-end md:p-4"
                role="presentation"
              >
                <div
                  className="pointer-events-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-3 shadow-xl"
                  role="dialog"
                  aria-label={tv('Listing summary', 'Tóm tắt chỗ ở')}
                  onClick={(e) => e.stopPropagation()}
                >
                  {(() => {
                    const { h: ph, km } = previewEntry;
                    const score = ph.rating ?? 0;
                    const reviews = ph.reviewCount ?? 0;
                    const rs = ph.roomSummary;
                    const amenityPreview = (ph.amenities || []).slice(0, 4).join(' · ');
                    return (
                      <>
                        <div className="flex gap-3">
                          <Link to={`/homestays/${ph._id}`} className="shrink-0">
                            <img
                              src={ph.images?.[0] || fallbackImageByString(ph.title || ph._id)}
                              alt=""
                              className="h-28 w-32 rounded-xl object-cover"
                            />
                          </Link>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <Link
                                to={`/homestays/${ph._id}`}
                                className="line-clamp-2 text-sm font-bold text-slate-900 hover:underline"
                              >
                                {ph.title}
                              </Link>
                              <button
                                type="button"
                                onClick={() => setPreviewHomestayId(null)}
                                className="shrink-0 rounded-full p-1 text-slate-500 hover:bg-slate-100"
                                aria-label={tv('Close summary', 'Đóng')}
                              >
                                <X className="h-5 w-5" />
                              </button>
                            </div>
                            <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{ph.location}</p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-2">
                              <span className="rounded bg-[#003580] px-1.5 py-0.5 text-xs font-bold text-white">
                                {Number(score).toFixed(1)}
                              </span>
                              <span className="text-xs text-slate-600">
                                {ratingLabel(score, tv)} · {reviews} {tv('reviews', 'đánh giá')}
                              </span>
                            </div>
                            <p className="mt-1 text-lg font-bold text-[#006ce4]">
                              {formatMoney(ph.pricePerNight)}
                              <span className="text-xs font-normal text-slate-500">
                                {' '}
                                / {tv('night', 'đêm')}
                              </span>
                            </p>
                          </div>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          ~{km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`}{' '}
                          {userPos ? tv('from you', 'từ bạn') : tv('from area center', 'từ khu vực')}
                          {rs ? (
                            <>
                              {' · '}
                              {rs.guests ?? '—'} {tv('guests', 'khách')}
                              {typeof rs.bedrooms === 'number' ? ` · ${rs.bedrooms} ${tv('bedrooms', 'phòng ngủ')}` : ''}
                              {ph.roomType ? ` · ${ph.roomType}` : ''}
                            </>
                          ) : null}
                        </p>
                        {amenityPreview ? (
                          <p className="mt-1 line-clamp-1 text-[11px] text-slate-500">{amenityPreview}</p>
                        ) : null}
                        {ph.description ? (
                          <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-slate-600">{ph.description}</p>
                        ) : null}
                        <Link
                          to={`/homestays/${ph._id}`}
                          className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-[#006ce4] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0056b3]"
                        >
                          {tv('View full listing', 'Xem chi tiết')}
                          <ExternalLink className="h-4 w-4" aria-hidden />
                        </Link>
                      </>
                    );
                  })()}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default SearchMapMiniPage;
