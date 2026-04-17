import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';

const IconBed = () => (
  <svg className="h-6 w-6 shrink-0 text-[#003580]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5M3.75 18h16.5M5.25 4.5h13.5a2.25 2.25 0 012.25 2.25v7.5H3V6.75A2.25 2.25 0 015.25 4.5z" />
  </svg>
);

const IconCalendar = () => (
  <svg className="h-6 w-6 shrink-0 text-[#003580]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5a2.25 2.25 0 002.25-2.25m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5a2.25 2.25 0 012.25 2.25v7.5" />
  </svg>
);

const IconUser = () => (
  <svg className="h-6 w-6 shrink-0 text-[#003580]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
  </svg>
);

const HeroSearchBar = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [destination, setDestination] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState(2);

  const submit = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (destination.trim()) {
      params.set('location', destination.trim());
    }
    params.set('sort', 'popularity');
    if (checkIn) params.set('checkIn', checkIn);
    if (checkOut) params.set('checkOut', checkOut);
    if (guests) params.set('guests', String(guests));
    navigate(`/search?${params.toString()}`);
  };

  return (
    <form
      onSubmit={submit}
      className="hero-search-3d flex flex-col gap-1 rounded-md border-4 border-[#febb02] bg-[#febb02] p-1 shadow-lg [transform-style:preserve-3d] md:flex-row md:items-stretch"
    >
      <label className="flex min-h-[52px] flex-1 cursor-pointer items-center gap-3 rounded bg-white px-4 py-2">
        <IconBed />
        <div className="min-w-0 flex-1">
          <span className="block text-xs font-semibold text-slate-800">{t('heroDestination')}</span>
          <input
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder={t('heroWhere')}
            className="w-full border-0 p-0 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-0"
          />
        </div>
      </label>
      <label className="flex min-h-[52px] flex-1 cursor-pointer items-center gap-3 rounded bg-white px-4 py-2 md:max-w-[240px]">
        <IconCalendar />
        <div className="grid flex-1 grid-cols-2 gap-2">
          <div>
            <span className="block text-xs font-semibold text-slate-800">{t('heroCheckIn')}</span>
            <input
              type="date"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              className="w-full border-0 p-0 text-xs text-slate-900 focus:ring-0"
            />
          </div>
          <div>
            <span className="block text-xs font-semibold text-slate-800">{t('heroCheckOut')}</span>
            <input
              type="date"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              className="w-full border-0 p-0 text-xs text-slate-900 focus:ring-0"
            />
          </div>
        </div>
      </label>
      <label className="flex min-h-[52px] flex-1 cursor-pointer items-center gap-3 rounded bg-white px-4 py-2 md:max-w-[180px]">
        <IconUser />
        <div className="min-w-0 flex-1">
          <span className="block text-xs font-semibold text-slate-800">{t('heroGuests')}</span>
          <select
            value={guests}
            onChange={(e) => setGuests(Number(e.target.value))}
            className="w-full border-0 bg-transparent p-0 text-sm text-slate-900 focus:ring-0"
          >
            {[1, 2, 3, 4, 5, 6, 8].map((n) => (
              <option key={n} value={n}>
                {n} {t('heroAdults')}
              </option>
            ))}
          </select>
        </div>
      </label>
      <button
        type="submit"
        className="min-h-[52px] rounded bg-[#006ce4] px-8 text-sm font-semibold text-white hover:bg-[#0057b8] md:px-10"
      >
        {t('heroSearch')}
      </button>
    </form>
  );
};

export default HeroSearchBar;
