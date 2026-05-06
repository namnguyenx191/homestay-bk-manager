import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import HeroSearchBar from '../components/home/HeroSearchBar';
import HeroRotatingTypewriter from '../components/home/HeroRotatingTypewriter';
import HorizontalCarousel from '../components/home/HorizontalCarousel';
import PropertyListingCard from '../components/home/PropertyListingCard';
import TiltCard from '../components/motion/TiltCard';
import { useLanguage } from '../context/LanguageContext';
import { fallbackImageByString } from '../utils/fallbackMedia';

const WHY = [
  {
    title: 'Book now, pay your way',
    body: 'Choose secure card checkout with Stripe or pay by bank transfer with a clear reference.',
    icon: 'pay',
  },
  {
    title: 'Real guest reviews',
    body: 'Read verified feedback and ratings before you reserve your next homestay.',
    icon: 'star',
  },
  {
    title: 'Live availability',
    body: 'See up-to-date calendars and avoid double bookings on busy dates.',
    icon: 'cal',
  },
  {
    title: 'Message your host',
    body: 'Chat in-app to confirm check-in, amenities, and special requests.',
    icon: 'chat',
  },
];

const TRENDING = [
  { name: 'Hong Kong', img: 'https://images.unsplash.com/photo-1536599018102-9f803c140fc1?w=800&q=80', span: 'md:col-span-3' },
  { name: 'Singapore', img: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=800&q=80', span: 'md:col-span-3' },
  { name: 'Da Nang', img: 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=600&q=80', span: 'md:col-span-2' },
  { name: 'Kuala Lumpur', img: 'https://images.unsplash.com/photo-1518005020951-eccb494ad742?w=600&q=80', span: 'md:col-span-2' },
  { name: 'Bangkok', img: 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=600&q=80', span: 'md:col-span-2' },
];

const PLAN_TABS = [
  { id: 'bike', label: 'Bike trips', places: ['Hoi An', 'Hue', 'Da Lat', 'Mui Ne', 'Ninh Binh', 'Sa Pa'] },
  { id: 'food', label: 'Food & drink', places: ['Hanoi', 'HCMC', 'Da Nang', 'Can Tho', 'Hue', 'Vung Tau'] },
  { id: 'photo', label: 'Photography', places: ['Ha Long', 'Ly Son', 'Phu Quoc', 'Da Lat', 'Moc Chau', 'Ban Gioc'] },
];

const PROPERTY_TYPES = [
  { label: 'Entire homes', img: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400&q=80', filter: 'Entire place' },
  { label: 'Private rooms', img: 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=400&q=80', filter: 'Private room' },
  { label: 'Shared rooms', img: 'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?w=400&q=80', filter: 'Shared room' },
  { label: 'Unique stays', img: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=400&q=80', filter: '' },
];

const WhyIcon = ({ type }) => {
  const cls = 'h-12 w-12 text-[#006ce4]';
  if (type === 'pay')
    return (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.25}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
      </svg>
    );
  if (type === 'star')
    return (
      <svg className={cls} fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    );
  if (type === 'cal')
    return (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.25}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25" />
      </svg>
    );
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.25}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.556 4.03-8 9-8s9 3.444 9 8z" />
    </svg>
  );
};

const HomePage = () => {
  const { user } = useAuth();
  const { lang, t, tv } = useLanguage();
  const [popular, setPopular] = useState([]);
  const [wishlistIds, setWishlistIds] = useState(() => new Set());
  const [planTab, setPlanTab] = useState(PLAN_TABS[0].id);
  const motionRootRef = useRef(null);

  const planPlaces = useMemo(() => PLAN_TABS.find((t) => t.id === planTab)?.places || [], [planTab]);

  useEffect(() => {
    client
      .get('/homestays?sort=popularity')
      .then(({ data }) => setPopular(data.slice(0, 14)))
      .catch(() => setPopular([]));
  }, []);

  useEffect(() => {
    if (!user) {
      setWishlistIds(new Set());
      return;
    }
    client
      .get('/wishlist')
      .then(({ data }) => setWishlistIds(new Set(data.map((h) => h._id))))
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    const root = motionRootRef.current;
    if (!root) return undefined;
    const nodes = Array.from(root.querySelectorAll('[data-motion]'));
    if (!nodes.length) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('is-visible');
          else entry.target.classList.remove('is-visible');
        });
      },
      { threshold: 0.2 }
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [popular.length, planTab, user]);

  const onWishlistToggle = (id, inWishlist) => {
    setWishlistIds((prev) => {
      const next = new Set(prev);
      if (inWishlist) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const heroSeoLines = useMemo(
    () => [t('homeSubtitle1'), t('homeSubtitle2'), t('homeSubtitle3')],
    [t, lang]
  );

  const weekendSubtitle = useMemo(() => {
    const end = new Date();
    end.setDate(end.getDate() + 2);
    const start = new Date();
    start.setDate(start.getDate() + 1);
    const fmt = (d) =>
      d.toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-GB', { day: 'numeric', month: 'short' });
    return tv(`Save on stays from ${fmt(start)} – ${fmt(end)}`, `Ưu đãi cho kỳ lưu trú từ ${fmt(start)} – ${fmt(end)}`);
  }, [lang, tv]);

  return (
    <div className="-mx-4">
      <section
        className="relative overflow-hidden pb-28 pt-10 text-white md:pb-32 md:pt-14"
        style={{
          backgroundImage:
            'linear-gradient(rgba(5, 12, 16, 0.45), rgba(5, 12, 16, 0.72)), url(https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1800&q=80)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="mx-auto max-w-7xl px-4">
          <h1 className="reveal-3d text-3xl font-bold md:text-4xl" style={{ animationDelay: '0.05s' }}>
            {t('homeTitle')}
          </h1>
          <p className="reveal-3d mt-2 min-h-[3.25rem] max-w-2xl text-lg text-slate-100 drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)] md:min-h-[5rem]" style={{ animationDelay: '0.15s' }}>
            <HeroRotatingTypewriter lines={heroSeoLines} />
          </p>
        </div>
        <div className="relative z-20 mx-auto mt-8 max-w-7xl px-4">
          <div className="animate-float-soft">
            <HeroSearchBar />
          </div>
        </div>
      </section>

      <div ref={motionRootRef} className="mx-auto max-w-7xl space-y-4 px-4 pt-8">
        <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div
            data-motion="left"
            className="mag-panel rounded-xl p-6 motion-side motion-left"
          >
            <p className="mag-subtitle">{tv('Travel blog', 'Cẩm nang du lịch')}</p>
            <h2 className="mag-title mt-2 text-3xl">{tv('Slow travelling', 'Du lịch chậm')}</h2>
            <p className="mt-3 max-w-2xl text-sm text-slate-200">
              {tv(
                'We look to provide the most authentic routes and stays. Explore coastlines, islands and hidden local spots.',
                'Chúng tôi gợi ý lộ trình và nơi ở chân thực. Khám phá biển đảo và các điểm địa phương ẩn mình.'
              )}
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {TRENDING.slice(0, 3).map((d) => (
                <Link key={d.name} to={`/search?location=${encodeURIComponent(d.name)}`} className="group rounded-lg border border-white/10 bg-black/30 p-2">
                  <img src={d.img} alt={d.name} className="h-32 w-full rounded object-cover transition group-hover:opacity-90" />
                  <p className="mt-2 text-xs font-semibold tracking-[0.2em] text-slate-300">{d.name}</p>
                </Link>
              ))}
            </div>
          </div>
          <aside
            data-motion="right"
            className="mag-panel rounded-xl p-4 motion-side motion-right"
          >
            <p className="mag-subtitle">{tv('Latest articles', 'Bài viết mới nhất')}</p>
            <div className="mt-3 space-y-3">
              {TRENDING.slice(2, 5).map((d) => (
                <Link key={`side-${d.name}`} to={`/search?location=${encodeURIComponent(d.name)}`} className="block rounded border border-white/10 bg-black/25 p-2">
                  <img src={d.img} alt={d.name} className="h-24 w-full rounded object-cover" />
                  <p className="mt-1 text-xs font-semibold tracking-[0.2em] text-slate-300">{d.name}</p>
                </Link>
              ))}
            </div>
          </aside>
        </section>

        <section data-motion="left" className="py-10 motion-side motion-left">
          <h2 className="text-2xl font-bold text-slate-100 md:text-[26px]">{t('whyTitle')}</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {WHY.map((item, idx) => (
              <TiltCard
                key={item.title}
                className="h-full min-h-[200px]"
                innerClassName="h-full rounded-lg"
                intensity={7}
              >
                <div
                  data-motion={idx % 2 === 0 ? 'left' : 'right'}
                  className={`h-full rounded-lg border border-white/10 glass-60 p-5 transition-colors hover:border-slate-300 motion-side ${
                    idx % 2 === 0 ? 'motion-left' : 'motion-right'
                  }`}
                  style={{ animationDelay: `${idx * 0.06}s` }}
                >
                  <WhyIcon type={item.icon} />
                  <h3 className="mt-3 font-bold text-slate-100">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.body}</p>
                </div>
              </TiltCard>
            ))}
          </div>
        </section>

        <div data-motion="right" className="motion-side motion-right">
          <TiltCard className="w-full" innerClassName="rounded-xl" intensity={5} shine={false}>
            <section className="flex flex-col rounded-xl border border-white/10 glass-60 p-6 shadow-sm md:flex-row md:items-center md:gap-8">
              <div className="flex-1">
                <h2 className="text-xl font-bold text-slate-100">{tv('Travel with peace of mind', 'Du lịch an tâm')}</h2>
                <p className="mt-2 text-sm text-slate-300">
                  {tv(
                    'Many homes offer flexible cancellation. Browse top-rated stays and lock in your dates early.',
                    'Nhiều chỗ ở hỗ trợ hủy linh hoạt. Xem các nơi được đánh giá cao và chốt lịch sớm.'
                  )}
                </p>
                <Link
                  to="/search?sort=popularity"
                  className="mt-4 inline-block rounded-md bg-[#006ce4] px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-[#0057b8] hover:shadow-lg [transform:translateZ(0)]"
                >
                  {tv('See deals', 'Xem ưu đãi')}
                </Link>
              </div>
              <div className="mt-6 h-36 shrink-0 overflow-hidden rounded-lg bg-[#1d232b] shadow-inner md:mt-0 md:h-40 md:w-64 [transform:translateZ(12px)]">
                <img
                  src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=80"
                  alt=""
                  className="h-full w-full object-cover transition duration-500 hover:scale-105"
                />
              </div>
            </section>
          </TiltCard>
        </div>

        <div data-motion="left" className="motion-side motion-left">
          <HorizontalCarousel
            title={tv('Homes guests love', 'Những chỗ ở được yêu thích')}
            subtitle={tv('Highly reviewed properties with great photos and host response.', 'Các chỗ ở có nhiều đánh giá tốt, ảnh đẹp và chủ nhà phản hồi nhanh.')}
            rightSlot={
              <Link to="/search?sort=popularity" className="text-sm font-semibold text-[#006ce4] hover:underline">
                {tv('See more places', 'Xem thêm chỗ ở')}
              </Link>
            }
          >
            {popular.slice(0, 10).map((item) => (
              <PropertyListingCard
                key={item._id}
                item={item}
                wishlistIds={wishlistIds}
                onWishlistToggle={onWishlistToggle}
              />
            ))}
          </HorizontalCarousel>
        </div>

        <section data-motion="right" className="py-10 motion-side motion-right">
          <h2 className="text-2xl font-bold text-slate-100 md:text-[26px]">{tv('Trending destinations', 'Điểm đến xu hướng')}</h2>
          <p className="mt-1 text-slate-300">{tv('Explore cities travelers are viewing right now.', 'Khám phá những thành phố đang được xem nhiều.')}</p>
          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-6">
            {TRENDING.map((d) => (
              <TiltCard
                key={d.name}
                className={`relative h-44 md:h-52 ${d.span}`}
                innerClassName="h-full overflow-hidden rounded-xl"
                intensity={11}
              >
                <Link
                  data-motion={d.name.length % 2 === 0 ? 'left' : 'right'}
                  to={`/search?location=${encodeURIComponent(d.name)}`}
                  className={`group relative flex h-full w-full overflow-hidden rounded-xl motion-side ${
                    d.name.length % 2 === 0 ? 'motion-left' : 'motion-right'
                  }`}
                >
                  <img
                    src={d.img}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/40" />
                  <span className="relative z-10 p-4 text-lg font-bold text-white drop-shadow-md [transform:translateZ(20px)]">
                    {d.name}
                  </span>
                </Link>
              </TiltCard>
            ))}
          </div>
        </section>

        <section data-motion="left" className="py-10 motion-side motion-left">
          <h2 className="text-2xl font-bold text-slate-100 md:text-[26px]">{tv('Plan your trip', 'Lên kế hoạch chuyến đi')}</h2>
          <p className="mt-1 text-slate-300">{tv('Pick a vibe and discover places to match.', 'Chọn phong cách và khám phá điểm đến phù hợp.')}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {PLAN_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPlanTab(tab.id)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  planTab === tab.id
                    ? 'border-[#006ce4] bg-[#e7f3ff] text-[#006ce4]'
                    : 'border-white/10 bg-[#20262e] text-slate-300 hover:border-slate-300'
                }`}
              >
                {tab.id === 'bike'
                  ? tv('Bike trips', 'Du lịch xe máy')
                  : tab.id === 'food'
                    ? tv('Food & drink', 'Ẩm thực')
                    : tv('Photography', 'Nhiếp ảnh')}
              </button>
            ))}
          </div>
          <div className="mt-4 flex gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {planPlaces.map((name) => (
              <div
                key={name}
                data-motion={name.length % 2 === 0 ? 'left' : 'right'}
                className={`motion-side ${name.length % 2 === 0 ? 'motion-left' : 'motion-right'}`}
              >
                <TiltCard className="min-w-[160px] snap-start" innerClassName="rounded-lg" intensity={8}>
                  <Link
                    to={`/search?location=${encodeURIComponent(name)}`}
                    className="block rounded-lg border border-white/10 glass-60 p-4 shadow-sm transition-colors hover:border-[#006ce4]"
                  >
                    <img
                      src={fallbackImageByString(name)}
                      alt={name}
                      className="aspect-video w-full rounded-md object-cover shadow-inner"
                    />
                    <p className="mt-2 font-bold text-slate-100">{name}</p>
                    <p className="text-xs text-slate-300">{tv('Homestays nearby', 'Homestay lân cận')}</p>
                  </Link>
                </TiltCard>
              </div>
            ))}
          </div>
        </section>

        <div data-motion="right" className="motion-side motion-right">
          <HorizontalCarousel title={tv('Weekend picks', 'Gợi ý cuối tuần')} subtitle={weekendSubtitle}>
            {popular.slice(2, 10).map((item) => (
              <PropertyListingCard
                key={item._id}
                item={item}
                wishlistIds={wishlistIds}
                onWishlistToggle={onWishlistToggle}
              />
            ))}
          </HorizontalCarousel>
        </div>

        <section data-motion="left" className="py-10 motion-side motion-left">
          <h2 className="text-2xl font-bold text-slate-100 md:text-[26px]">{tv('Browse by property type', 'Khám phá theo loại chỗ ở')}</h2>
          <div className="relative mt-4">
            <div className="flex gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {PROPERTY_TYPES.map((p) => (
                <div
                  key={p.label}
                  data-motion={p.label.length % 2 === 0 ? 'left' : 'right'}
                  className={`motion-side ${p.label.length % 2 === 0 ? 'motion-left' : 'motion-right'}`}
                >
                  <TiltCard
                    className="min-w-[200px] shrink-0 snap-start"
                    innerClassName="overflow-hidden rounded-xl"
                    intensity={9}
                  >
                    <Link
                      to={p.filter ? `/search?roomType=${encodeURIComponent(p.filter)}` : '/search'}
                      className="block overflow-hidden rounded-xl border border-white/10 glass-60 shadow-sm transition-shadow hover:shadow-md"
                    >
                      <div className="aspect-[4/3] overflow-hidden">
                        <img src={p.img} alt="" className="h-full w-full object-cover transition duration-500 hover:scale-110" />
                      </div>
                      <p className="p-3 text-center text-sm font-bold text-slate-100">
                        {p.filter === 'Entire place'
                          ? tv('Entire homes', 'Nhà nguyên căn')
                          : p.filter === 'Private room'
                            ? tv('Private rooms', 'Phòng riêng')
                            : p.filter === 'Shared room'
                              ? tv('Shared rooms', 'Phòng ở ghép')
                              : tv('Unique stays', 'Chỗ ở độc đáo')}
                      </p>
                    </Link>
                  </TiltCard>
                </div>
              ))}
            </div>
          </div>
        </section>

        {!user && (
          <section data-motion="right" className="mb-10 flex flex-col items-stretch gap-6 rounded-xl border border-white/10 glass-60 p-6 motion-side motion-right md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-100">{tv('Travel more, stress less', 'Du lịch nhiều hơn, ít lo hơn')}</h2>
              <p className="mt-2 max-w-xl text-sm text-slate-300">
                {tv(
                  'Sign in to save homes, message hosts from the chat bubble, and manage bookings in one place.',
                  'Đăng nhập để lưu chỗ ở, nhắn chủ nhà bằng khung chat và quản lý đặt phòng tại một nơi.'
                )}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  to="/login"
                  className="rounded-md bg-[#006ce4] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0057b8]"
                >
                  {tv('Sign in', 'Đăng nhập')}
                </Link>
                <Link to="/register" className="rounded-md border border-[#006ce4] px-5 py-2.5 text-sm font-semibold text-[#006ce4] hover:bg-[#20262e]">
                  {tv('Register', 'Đăng ký')}
                </Link>
              </div>
            </div>
            <div className="hidden h-28 w-40 shrink-0 rounded-lg bg-[#003580]/10 md:block" aria-hidden />
          </section>
        )}
      </div>
    </div>
  );
};

export default HomePage;
