/** Rough city centers (Vietnam) when homestay.geo is missing */
const CITY_COORDS = [
  [/thanh\s*khe|thanh\s*khê/i, [16.0689, 108.1858]],
  [/da\s*nang|đà\s*nẵng/i, [16.0544, 108.2022]],
  [/ha\s*noi|hanoi/i, [21.0285, 105.8542]],
  [/ho\s*chi\s*minh|saigon|hcmc/i, [10.8231, 106.6297]],
  [/sapa/i, [22.3364, 103.8438]],
  [/hoi\s*an/i, [15.8801, 108.338]],
  [/phu\s*quoc/i, [10.2899, 103.984]],
  [/nha\s*trang/i, [12.2388, 109.1967]],
  [/da\s*lat/i, [11.9404, 108.4583]],
  [/hue/i, [16.4637, 107.5909]],
  [/ha\s*long/i, [20.9101, 107.1839]],
  [/can\s*tho/i, [10.0452, 105.7469]],
  [/vietnam/i, [16.0, 107.0]],
];

const DEFAULT_CENTER = [16.0583, 108.2772]; // Central Vietnam fallback

const offsetFromId = (id, i) => {
  const s = String(id || i);
  let h = 0;
  for (let k = 0; k < s.length; k += 1) h = (h * 31 + s.charCodeAt(k)) | 0;
  const a = ((h % 200) - 100) * 0.00015;
  const b = (((h >> 8) % 200) - 100) * 0.00015;
  return [a, b];
};

export const coordsFromLocationString = (locationStr) => {
  if (!locationStr || typeof locationStr !== 'string') return [...DEFAULT_CENTER];
  for (const [re, ll] of CITY_COORDS) {
    if (re.test(locationStr)) return [...ll];
  }
  return [...DEFAULT_CENTER];
};

/**
 * @param {object} homestay — expects geo.lat/lng and/or location
 * @param {number} index — spread markers in same city
 * @returns {[number, number]|null} [lat, lng]
 */
export const resolveHomestayLatLng = (homestay, index = 0) => {
  const g = homestay?.geo;
  const lat = Number(g?.lat);
  const lng = Number(g?.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    const [da, db] = offsetFromId(homestay._id, index);
    return [lat + da, lng + db];
  }
  const base = coordsFromLocationString(homestay?.location || '');
  const [da, db] = offsetFromId(homestay._id, index);
  return [base[0] + da, base[1] + db];
};

export const haversineKm = (a, b) => {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const la1 = (a[0] * Math.PI) / 180;
  const la2 = (b[0] * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
};
