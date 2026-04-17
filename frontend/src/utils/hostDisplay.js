/** Stable accent per host so users can tell listings apart at a glance. */
const ACCENTS = [
  { bg: 'rgba(0, 108, 228, 0.28)', border: '#5eb3f0', text: '#e8f4ff' },
  { bg: 'rgba(199, 55, 55, 0.28)', border: '#e88888', text: '#ffecec' },
  { bg: 'rgba(16, 185, 129, 0.28)', border: '#5eead4', text: '#ecfdf5' },
  { bg: 'rgba(168, 85, 247, 0.28)', border: '#c4b5fd', text: '#f5f3ff' },
  { bg: 'rgba(245, 158, 11, 0.28)', border: '#fcd34d', text: '#fffbeb' },
  { bg: 'rgba(236, 72, 153, 0.28)', border: '#f9a8d4', text: '#fdf2f8' },
];

export const hostIdString = (owner) => {
  if (!owner) return '';
  if (typeof owner === 'object' && owner !== null) {
    const id = owner._id ?? owner.id;
    return id != null ? String(id) : '';
  }
  return String(owner);
};

export const hostDisplayName = (owner) => {
  if (!owner) return '';
  if (typeof owner === 'object' && owner !== null && owner.name) return String(owner.name).trim();
  return '';
};

export const getHostAccent = (owner) => {
  const id = hostIdString(owner);
  if (!id) return ACCENTS[0];
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return ACCENTS[Math.abs(hash) % ACCENTS.length];
};

/** Tailwind classes for badges on light cards (search / wishlist). */
const HOST_TONE_LIGHT = [
  { ring: 'border-blue-500', bg: 'bg-blue-50', text: 'text-blue-900' },
  { ring: 'border-red-500', bg: 'bg-red-50', text: 'text-red-900' },
  { ring: 'border-emerald-600', bg: 'bg-emerald-50', text: 'text-emerald-900' },
  { ring: 'border-violet-500', bg: 'bg-violet-50', text: 'text-violet-900' },
  { ring: 'border-amber-500', bg: 'bg-amber-50', text: 'text-amber-900' },
  { ring: 'border-pink-500', bg: 'bg-pink-50', text: 'text-pink-900' },
];

export const getHostToneLight = (owner) => {
  const id = hostIdString(owner);
  if (!id) return HOST_TONE_LIGHT[0];
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return HOST_TONE_LIGHT[Math.abs(hash) % HOST_TONE_LIGHT.length];
};
