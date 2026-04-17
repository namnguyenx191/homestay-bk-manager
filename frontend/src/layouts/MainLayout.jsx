import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useCurrency } from '../context/CurrencyContext';
import SiteFooter from '../components/SiteFooter';
import AnimatedBackground from '../components/AnimatedBackground';

const navPill = ({ isActive }) =>
  `relative px-3 py-2 text-sm font-semibold tracking-wide transition after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-full after:bg-white after:transition-opacity ${
    isActive
      ? 'text-white after:opacity-100'
      : 'text-white/80 hover:text-white after:opacity-0 hover:after:opacity-70'
  }`;

const accountMenuLink =
  'block rounded-lg px-3 py-2.5 text-sm font-medium text-white/95 transition hover:bg-white/12';

const MainLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const { lang, changeLanguage, t } = useLanguage();
  const { currency, setCurrency } = useCurrency();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const listPropertyPath =
    user?.role === 'admin' ? '/admin?tab=listings' : user?.role === 'host' ? '/host?section=listings' : '/search';

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
              TRAVEL
            </Link>
            <div className="flex flex-wrap items-center justify-end gap-2 text-sm md:gap-3">
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="rounded border border-white/40 bg-white/10 px-2 py-1 text-xs font-semibold text-white outline-none"
                aria-label="Currency"
              >
                <option value="USD" className="text-slate-900">USD</option>
                <option value="VND" className="text-slate-900">VND</option>
              </select>
              <select
                value={lang}
                onChange={(e) => changeLanguage(e.target.value)}
                className="rounded border border-white/40 bg-white/10 px-2 py-1 text-xs font-semibold text-white outline-none"
                aria-label="Language"
              >
                <option value="en" className="text-slate-900">
                  {t('langEnglish')}
                </option>
                <option value="vi" className="text-slate-900">
                  {t('langVietnamese')}
                </option>
              </select>
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
                      <NavLink to={listPropertyPath} className={accountMenuLink} role="menuitem" onClick={() => setAccountMenuOpen(false)}>
                        {t('headerListProperty')}
                      </NavLink>
                      <NavLink to="/dashboard" className={accountMenuLink} role="menuitem" onClick={() => setAccountMenuOpen(false)}>
                        {t('headerMyBookings')}
                      </NavLink>
                      <NavLink to="/wishlist" className={accountMenuLink} role="menuitem" onClick={() => setAccountMenuOpen(false)}>
                        {t('headerSaved')}
                      </NavLink>
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
