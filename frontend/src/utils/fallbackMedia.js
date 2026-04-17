const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1400&q=80',
  'https://images.unsplash.com/photo-1473116763249-2faaef81ccda?w=1400&q=80',
  'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1400&q=80',
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1400&q=80',
  'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?w=1400&q=80',
];

export const fallbackImageByIndex = (idx = 0) =>
  FALLBACK_IMAGES[Math.abs(Number(idx) || 0) % FALLBACK_IMAGES.length];

export const fallbackImageByString = (text = '') => {
  const raw = String(text);
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
  return fallbackImageByIndex(hash);
};
