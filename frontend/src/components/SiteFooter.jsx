import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

const col = (title, links) => (
  <div>
    <h3 className="mb-3 text-sm font-bold text-slate-100">{title}</h3>
    <ul className="space-y-2 text-sm text-slate-300">
      {links.map(([label, to]) => (
        <li key={`${label}-${to}`}>
          <Link to={to} className="hover:text-[#8ad7f5] hover:underline">
            {label}
          </Link>
        </li>
      ))}
    </ul>
  </div>
);

const SiteFooter = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const cities = [
    ['Homestay Ho Chi Minh City', '/search?location=Ho%20Chi%20Minh'],
    ['Homestay Da Nang', '/search?location=Da%20Nang'],
    ['Homestay Hanoi', '/search?location=Hanoi'],
    ['Homestay Nha Trang', '/search?location=Nha%20Trang'],
    ['Homestay Da Lat', '/search?location=Da%20Lat'],
    ['Homestay Phu Quoc', '/search?location=Phu%20Quoc'],
  ];

  return (
    <footer className="mt-auto border-t border-white/10 bg-[#151a20]/10 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="mb-10">
          <h3 className="mb-3 text-sm font-bold text-slate-100/95">{t('footerPopular')}</h3>
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {cities.map(([label, to]) => (
              <Link key={to} to={to} className="text-sm text-slate-400 hover:text-[#8ad7f5] hover:underline">
                {label}
              </Link>
            ))}
          </div>
          <button type="button" className="mt-4 text-sm font-semibold text-[#8ad7f5] hover:underline">
            {t('footerShowMore')}
          </button>
        </div>

        <div className="grid gap-8 border-t border-white/10 pt-10 sm:grid-cols-2 lg:grid-cols-5">
          {col(t('footerSupport'), [
            [t('footerHome'), '/'],
            [t('footerSearchStays'), '/search'],
            [t('headerMyBookings'), '/dashboard'],
          ])}
          {col(t('footerDiscover'), [
            [t('footerBestValue'), '/search?sort=priceAsc'],
            [t('footerTopRated'), '/search?sort=popularity'],
            [t('footerSavedHomes'), '/wishlist'],
          ])}
          {col(t('footerAccount'), [
            [t('headerSignIn'), '/login'],
            [t('headerRegister'), '/register'],
          ])}
          {col(t('footerHosts'), [
            user?.role === 'host' ? [t('navHost'), '/host'] : [t('navAdmin'), '/admin'],
            [
              t('footerManageListings'),
              user?.role === 'host' || user?.role === 'admin' ? '/admin?tab=listings' : '/admin',
            ],
          ])}
          {col(t('footerAbout'), [
            [t('footerHowItWorks'), '/'],
            [t('footerContact'), '/search'],
          ])}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-8 text-xs text-slate-400">
          <p>
            &copy; {new Date().getFullYear()} TRAVEL. {t('footerInspired')}
          </p>
          <div className="flex items-center gap-2">
            <span className="rounded border border-white/20 bg-[#1d232b] px-2 py-1 text-slate-200">VND</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
