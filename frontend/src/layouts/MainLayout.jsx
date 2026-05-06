import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Languages, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import SiteFooter from '../components/SiteFooter';
import AnimatedBackground from '../components/AnimatedBackground';
import { getSocket } from '../utils/socket';
import toast from 'react-hot-toast';

const navPill = ({ isActive }) =>
  `relative px-3 py-2 text-sm font-semibold tracking-wide transition after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-full after:bg-white after:transition-opacity ${
    isActive
      ? 'text-white after:opacity-100'
      : 'text-slate-100 hover:text-white after:opacity-0 hover:after:opacity-70'
  }`;

const accountMenuLink =
  'block rounded-lg px-3 py-2.5 text-sm font-medium text-white transition hover:bg-white/12';
const langMenuBtn = (active) =>
  `flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs font-semibold transition ${
    active ? 'bg-white/20 text-white' : 'text-white/90 hover:bg-white/10'
  }`;

const MainLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const { lang, changeLanguage, t } = useLanguage();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const isHostOnly = user?.role === 'host';
  const listPropertyPath =
    user?.role === 'admin' ? '/admin?tab=listings' : user?.role === 'host' ? '/host?section=listings' : '/search';

  useEffect(() => {
    if (!user?._id) return undefined;
    const socket = getSocket();
    socket.emit('join:user', user._id);
    const onUserNotification = (payload) => {
      if (!payload?.message) return;
      toast(payload.message, { duration: 8000, icon: '⚠️' });
    };
    socket.on('user:notification', onUserNotification);
    return () => socket.off('user:notification', onUserNotification);
  }, [user?._id]);

  useEffect(() => {
    if (!langMenuOpen) return undefined;
    const onDocClick = () => setLangMenuOpen(false);
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [langMenuOpen]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = lang === 'vi' ? 'vi' : lang === 'zh' ? 'zh' : lang === 'ko' ? 'ko' : 'en';
    document.title =
      lang === 'vi'
        ? 'HomeStay Đặt phòng & Quản lý'
        : lang === 'zh'
          ? 'HomeStay 预订与管理'
          : lang === 'ko'
            ? 'HomeStay 예약 및 관리'
            : 'HomeStay Booking & Manager';
  }, [lang]);

  return (
    <div className="flex min-h-screen flex-col bg-transparent text-slate-100">
      <AnimatedBackground />
      <header className="sticky top-0 z-50 shadow-sm">
        <div className="border-b border-white/10 bg-[#6d7279]/55 text-white backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2.5">
            <Link
              to="/"
              className="flex items-center gap-2 text-xl font-semibold tracking-[0.22em] text-white transition-transform duration-200 md:text-2xl"
            >
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#c73737]" />
              HOMESTAY
            </Link>
            <div className="flex flex-wrap items-center justify-end gap-2 text-sm md:gap-3">
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLangMenuOpen((v) => !v);
                  }}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/40 bg-white/10 text-white transition hover:border-white/60 hover:bg-white/18 ${
                    langMenuOpen ? 'border-white/70 bg-white/20' : ''
                  }`}
                  aria-haspopup="menu"
                  aria-expanded={langMenuOpen}
                  aria-label={t('langEnglish')}
                >
                  <Languages className="h-4 w-4" aria-hidden />
                </button>
                <div
                  onClick={(e) => e.stopPropagation()}
                  className={`absolute right-0 top-full z-[60] mt-2 min-w-[9.5rem] rounded-lg border border-white/20 bg-[#4a5058]/95 p-1 shadow-xl backdrop-blur-md transition ${
                    langMenuOpen ? 'visible opacity-100' : 'invisible pointer-events-none opacity-0'
                  }`}
                  role="menu"
                >
                  <button type="button" role="menuitem" onClick={() => { changeLanguage('vi'); setLangMenuOpen(false); }} className={langMenuBtn(lang === 'vi')}>🇻🇳 {t('langVietnamese')}</button>
                  <button type="button" role="menuitem" onClick={() => { changeLanguage('en'); setLangMenuOpen(false); }} className={langMenuBtn(lang === 'en')}>🇬🇧 {t('langEnglish')}</button>
                  <button type="button" role="menuitem" onClick={() => { changeLanguage('zh'); setLangMenuOpen(false); }} className={langMenuBtn(lang === 'zh')}>🇨🇳 {t('langChinese')}</button>
                  <button type="button" role="menuitem" onClick={() => { changeLanguage('ko'); setLangMenuOpen(false); }} className={langMenuBtn(lang === 'ko')}>🇰🇷 {t('langKorean')}</button>
                </div>
              </div>
              {!user ? (
                <>
                  <NavLink
                    to="/register"
                    className="rounded border border-white px-3 py-1.5 font-semibold text-white hover:bg-white/10"
                  >
                    {t('headerRegister')}
                  </NavLink>
                  <NavLink
                    to="/login"
                    className="rounded border border-white bg-white px-3 py-1.5 font-semibold text-[#006ce4] hover:bg-blue-50"
                  >
                    {t('headerSignIn')}
                  </NavLink>
                </>
              ) : (
                <div
                  className="relative"
                  onMouseEnter={() => setAccountMenuOpen(true)}
                  onMouseLeave={() => setAccountMenuOpen(false)}
                >
                  <button
                    type="button"
                    className={`flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-white/10 text-white transition hover:border-white/60 hover:bg-white/18 ${
                      accountMenuOpen ? 'border-white/70 bg-white/20' : ''
                    }`}
                    aria-expanded={accountMenuOpen}
                    aria-haspopup="true"
                    aria-label={t('headerAccount')}
                    onClick={() => {
                      if (typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches) {
                        setAccountMenuOpen((o) => !o);
                      }
                    }}
                  >
                    <UserRound className="h-5 w-5" strokeWidth={2} aria-hidden />
                  </button>
                  <div
                    className={`absolute right-0 top-full z-[60] -mt-0.5 pt-2 transition-opacity duration-150 ${
                      accountMenuOpen ? 'visible opacity-100' : 'invisible opacity-0 pointer-events-none'
                    }`}
                  >
                    <div
                      className="min-w-[13.5rem] rounded-xl border border-white/20 bg-[#4a5058]/95 py-1 shadow-xl backdrop-blur-md"
                      role="menu"
                    >
                      {isHostOnly ? (
                        <NavLink to="/host" className={accountMenuLink} role="menuitem" onClick={() => setAccountMenuOpen(false)}>
                          {t('navHost')}
                        </NavLink>
                      ) : (
                        <>
                          <NavLink to={listPropertyPath} className={accountMenuLink} role="menuitem" onClick={() => setAccountMenuOpen(false)}>
                            {t('headerListProperty')}
                          </NavLink>
                          <NavLink to="/dashboard" className={accountMenuLink} role="menuitem" onClick={() => setAccountMenuOpen(false)}>
                            {t('headerMyBookings')}
                          </NavLink>
                          <NavLink to="/wishlist" className={accountMenuLink} role="menuitem" onClick={() => setAccountMenuOpen(false)}>
                            {t('headerSaved')}
                          </NavLink>
                        </>
                      )}
                      <NavLink to="/account" className={accountMenuLink} role="menuitem" onClick={() => setAccountMenuOpen(false)}>
                        {t('headerAccount')}
                      </NavLink>
                      <div className="my-1 border-t border-white/15" />
                      <button
                        type="button"
                        role="menuitem"
                        className={`${accountMenuLink} w-full text-left font-semibold text-white`}
                        onClick={() => {
                          setAccountMenuOpen(false);
                          logout();
                        }}
                      >
                        {t('headerLogout')}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="border-t border-white/25">
            <nav className="mx-auto flex max-w-7xl flex-wrap items-center gap-8 px-4 py-2">
              {!isHostOnly && (
                <>
                  <NavLink to="/" end className={navPill}>
                    {t('navStays')}
                  </NavLink>
                  <NavLink to="/search" className={navPill}>
                    {t('navSearch')}
                  </NavLink>
                  {user && (
                    <NavLink to="/dashboard" className={navPill}>
                      {t('navTrips')}
                    </NavLink>
                  )}
                </>
              )}
              <div className="h-px flex-1 bg-white/45" />
              {user?.role === 'host' && (
                <NavLink to="/host" className={navPill}>
                  {t('navHost')}
                </NavLink>
              )}
              {user?.role === 'admin' && (
                <div className="group relative">
                  <NavLink to="/admin" className={navPill}>
                    {t('navAdmin')}
                  </NavLink>
                  <div className="invisible absolute left-0 top-full z-50 mt-1 w-56 rounded-lg border border-slate-200 bg-white p-1 opacity-0 shadow-lg transition-all group-hover:visible group-hover:opacity-100">
                    <Link to="/admin?tab=overview" className="block rounded px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
                      {lang === 'vi' ? 'Tổng quan doanh thu' : 'Revenue overview'}
                    </Link>
                    <Link to="/admin?tab=trending" className="block rounded px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
                      {lang === 'vi' ? 'Phòng đang trending' : 'Trending rooms'}
                    </Link>
                    <Link to="/admin?tab=listings" className="block rounded px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
                      {lang === 'vi' ? 'Quản lý tin đăng' : 'Manage listings'}
                    </Link>
                    <Link to="/admin?tab=bank" className="block rounded px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
                      {lang === 'vi' ? 'QR chuyển khoản' : 'Bank transfer QR'}
                    </Link>
                    <Link to="/admin?tab=users" className="block rounded px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
                      {lang === 'vi' ? 'Quản lý user' : 'Manage users'}
                    </Link>
                  </div>
                </div>
              )}
            </nav>
          </div>
        </div>
      </header>
      <main className="readable-ui mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
      <SiteFooter />
    </div>
  );
};

export default MainLayout;
