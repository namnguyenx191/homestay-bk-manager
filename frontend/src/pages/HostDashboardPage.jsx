import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import client from '../api/client';
import HostBankPanel from '../components/host/HostBankPanel';
import HostListingsPanel from '../components/host/HostListingsPanel';
import HostRevenuePanel from '../components/host/HostRevenuePanel';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const formatRange = (checkIn, checkOut, lang) => {
  const o = { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' };
  const a = new Date(checkIn).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-GB', o);
  const b = new Date(checkOut).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-GB', o);
  return `${a} — ${b}`;
};

const stripClass = (status) => {
  if (status === 'occupied') return 'from-emerald-500/90 to-teal-600/80';
  if (status === 'booked') return 'from-sky-500/90 to-blue-600/80';
  return 'from-slate-500/70 to-slate-600/70';
};

const HostDashboardPage = () => {
  const { user } = useAuth();
  const { lang, t, tv } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawSection = searchParams.get('section') || 'map';
  const section = ['map', 'bookings', 'listings', 'reports', 'bank'].includes(rawSection) ? rawSection : 'map';

  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState({ rooms: [], bookings: [], counts: {} });
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [confirmingPaymentId, setConfirmingPaymentId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await client.get('/bookings/host-dashboard');
      setPayload({
        rooms: Array.isArray(data.rooms) ? data.rooms : [],
        bookings: Array.isArray(data.bookings) ? data.bookings : [],
        counts: data.counts || {},
      });
    } catch (e) {
      toast.error(e.response?.data?.message || tv('Could not load host data', 'Không tải được dữ liệu chủ nhà'));
      setPayload({ rooms: [], bookings: [], counts: {} });
    } finally {
      setLoading(false);
    }
  }, [tv]);

  useEffect(() => {
    load();
  }, [load]);

  const setSection = (next) => {
    setSearchParams(next === 'map' ? {} : { section: next });
  };

  const navItems = useMemo(
    () => [
      { id: 'map', label: t('hostNavRoomMap') },
      { id: 'bookings', label: t('hostNavBookings') },
      { id: 'listings', label: t('hostNavListings') },
      { id: 'reports', label: t('hostNavReports') },
      { id: 'bank', label: t('hostNavBankQr') },
    ],
    [t]
  );

  const pillDefs = useMemo(
    () => [
      { key: 'empty', countKey: 'empty', label: t('hostPillEmpty'), ring: 'ring-emerald-400/50' },
      { key: 'occupied', countKey: 'occupied', label: t('hostPillOccupied'), ring: 'ring-amber-200/50' },
      { key: 'booked', countKey: 'booked', label: t('hostPillBooked'), ring: 'ring-sky-400/50' },
    ],
    [t]
  );

  const roomBadge = (room) => {
    if (room.dashboardStatus === 'occupied')
      return { label: t('hostBadgeInHouse'), className: 'border-amber-300/40 bg-amber-500/20 text-amber-50' };
    if (room.dashboardStatus === 'booked')
      return { label: t('hostBadgeReserved'), className: 'border-sky-400/40 bg-sky-600/25 text-sky-50' };
    return { label: t('hostBadgeVacant'), className: 'border-white/20 bg-slate-600/35 text-slate-100' };
  };

  const filteredRooms = useMemo(() => {
    let list = payload.rooms;
    if (filter === 'empty') list = list.filter((r) => r.dashboardStatus === 'empty');
    else if (filter === 'booked') list = list.filter((r) => r.dashboardStatus === 'booked');
    else if (filter === 'occupied') list = list.filter((r) => r.dashboardStatus === 'occupied');
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          String(r.title || '')
            .toLowerCase()
            .includes(q) ||
          String(r.location || '')
            .toLowerCase()
            .includes(q) ||
          String(r.roomType || '')
            .toLowerCase()
            .includes(q)
      );
    }
    return list;
  }, [payload.rooms, filter, query]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const r of filteredRooms) {
      const label = r.location || tv('Other', 'Khác');
      if (!map.has(label)) map.set(label, []);
      map.get(label).push(r);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredRooms, tv]);

  const confirmBankTransferPaid = async (bookingId) => {
    const ok = window.confirm(tv('Mark this booking as paid?', 'Xác nhận đã nhận tiền cho đơn này?'));
    if (!ok) return;
    setConfirmingPaymentId(bookingId);
    try {
      await client.put(`/bookings/${bookingId}/status`, {});
      toast.success(tv('Payment confirmed', 'Đã duyệt thanh toán'));
      await load();
    } catch (e) {
      toast.error(e.response?.data?.message || tv('Could not confirm payment', 'Không thể duyệt thanh toán'));
    } finally {
      setConfirmingPaymentId(null);
    }
  };

  const sidebarBtn = (id) =>
    `flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${
      section === id
        ? 'bg-white/15 text-white ring-1 ring-[#c73737]/50'
        : 'text-white/85 hover:bg-white/10 hover:text-white'
    }`;

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-4 md:flex-row md:gap-6">
      <aside className="w-full shrink-0 rounded-2xl border border-white/15 bg-[#1e293b]/55 p-3 shadow-lg backdrop-blur-md md:w-56">
        <p className="border-b border-white/10 px-2 pb-2 text-xs font-semibold uppercase tracking-wider text-white/50">
          {t('hostHubTitle')}
        </p>
        <nav className="mt-2 flex flex-col gap-0.5">
          {navItems.map((item) => (
            <button key={item.id} type="button" className={sidebarBtn(item.id)} onClick={() => setSection(item.id)}>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 flex-1 rounded-2xl border border-white/15 bg-slate-900/35 p-4 shadow-lg backdrop-blur-md md:p-6">
        {section === 'map' && (
          <>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-2">
                {pillDefs.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setFilter((prev) => (prev === p.key ? 'all' : p.key))}
                    className={`rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold ring-2 ring-transparent transition hover:bg-white/10 ${
                      filter === p.key ? `${p.ring} bg-white/10` : ''
                    }`}
                  >
                    {p.label}{' '}
                    <span className="text-white/70">{payload.counts[p.countKey] ?? 0}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setFilter('all')}
                  className={`rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold ${
                    filter === 'all' ? 'bg-[#c73737]/80 text-white' : 'bg-white/5 text-white/80 hover:bg-white/10'
                  }`}
                >
                  {t('hostFilterAll')}
                </button>
              </div>
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('hostSearchPlaceholder')}
                  className="w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/45 outline-none ring-0 focus:border-[#c73737]/60 sm:min-w-[220px]"
                />
                <Link
                  to="/search"
                  className="whitespace-nowrap rounded-xl border border-white/25 bg-white/10 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-white/15"
                >
                  {t('hostBookRoom')}
                </Link>
              </div>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-white/50">{t('hostMapHint')}</p>

            {loading ? (
              <p className="mt-10 text-center text-sm text-white/60">{t('hostLoading')}</p>
            ) : filteredRooms.length === 0 ? (
              <p className="mt-10 text-center text-sm text-white/60">{t('hostNoRooms')}</p>
            ) : (
              <div className="mt-6 space-y-8">
                {grouped.map(([loc, items]) => (
                  <section key={loc}>
                    <h2 className="mb-3 flex items-baseline gap-2 text-sm font-semibold text-white/90">
                      <span>{loc}</span>
                      <span className="text-white/45">
                        ({items.length})
                      </span>
                    </h2>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {items.map((room) => {
                        const badge = roomBadge(room);
                        const open = menuOpenId === room._id;
                        const guestCurrent = room.activeBooking?.userId?.name || room.activeBooking?.userId?.email;
                        const guestNext = room.nextBooking?.userId?.name || room.nextBooking?.userId?.email;
                        return (
                          <div
                            key={room._id}
                            className="relative overflow-hidden rounded-2xl border border-white/15 bg-white/[0.06] shadow-md"
                          >
                            <div className={`h-2 bg-gradient-to-r ${stripClass(room.dashboardStatus)}`} />
                            <div className="p-4 pt-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-medium text-white/55">{room.roomType || '—'}</p>
                                  <p className="mt-0.5 flex items-center gap-1 text-xs text-emerald-200/90">
                                    <span aria-hidden>✦</span> {t('hostClean')}
                                  </p>
                                  <span
                                    className={`mt-2 inline-block rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badge.className}`}
                                  >
                                    {badge.label}
                                  </span>
                                </div>
                                <div className="relative shrink-0">
                                  <button
                                    type="button"
                                    className="rounded p-1 text-white/60 hover:bg-white/10 hover:text-white"
                                    aria-label={t('hostRoomMenu')}
                                    onClick={() => setMenuOpenId(open ? null : room._id)}
                                  >
                                    ⋮
                                  </button>
                                  {open ? (
                                    <div className="absolute right-0 z-10 mt-1 min-w-[10rem] rounded-lg border border-white/15 bg-slate-900 py-1 text-sm shadow-xl">
                                      <Link
                                        to={`/homestays/${room._id}`}
                                        className="block px-3 py-2 text-white/90 hover:bg-white/10"
                                        onClick={() => setMenuOpenId(null)}
                                      >
                                        {t('hostViewListing')}
                                      </Link>
                                      <Link
                                        to="/host?section=listings"
                                        className="block px-3 py-2 text-white/90 hover:bg-white/10"
                                        onClick={() => setMenuOpenId(null)}
                                      >
                                        {t('hostEditListing')}
                                      </Link>
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                              <p className="mt-2 line-clamp-2 text-lg font-bold leading-snug text-white">{room.title}</p>
                              <div className="mt-3 space-y-2">
                                {room.activeBooking ? (
                                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-600/20 px-2.5 py-2">
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-200/95">
                                      {t('hostCurrentStay')}
                                    </p>
                                    <p className="mt-0.5 text-[11px] font-medium text-emerald-50">
                                      {formatRange(room.activeBooking.checkInDate, room.activeBooking.checkOutDate, lang)}
                                    </p>
                                    {guestCurrent ? (
                                      <p className="mt-1 truncate text-[10px] text-emerald-100/85">{guestCurrent}</p>
                                    ) : null}
                                  </div>
                                ) : null}
                                {room.nextBooking ? (
                                  <div className="rounded-lg border border-sky-400/35 bg-sky-600/20 px-2.5 py-2">
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-200/95">
                                      {room.activeBooking ? t('hostUpcomingBooking') : t('hostPillBooked')}
                                    </p>
                                    <p className="mt-0.5 text-[11px] font-medium text-sky-50">
                                      {formatRange(room.nextBooking.checkInDate, room.nextBooking.checkOutDate, lang)}
                                    </p>
                                    {guestNext ? (
                                      <p className="mt-1 truncate text-[10px] text-sky-100/85">{guestNext}</p>
                                    ) : null}
                                  </div>
                                ) : null}
                                {!room.activeBooking && !room.nextBooking ? (
                                  <div className="rounded-lg border border-dashed border-white/20 px-2 py-2 text-center text-[11px] text-white/50">
                                    {t('hostNoActiveBooking')}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </>
        )}

        {section === 'bookings' && (
          <div className="overflow-x-auto">
            <h1 className="mb-4 text-lg font-bold text-white">{t('hostBookingsTitle')}</h1>
            {loading ? (
              <p className="text-sm text-white/60">{t('hostLoading')}</p>
            ) : (
              <table className="w-full min-w-[860px] border-collapse text-left text-sm text-white/90">
                <thead>
                  <tr className="border-b border-white/15 text-xs uppercase tracking-wide text-white/50">
                    <th className="py-2 pr-3">{t('hostColStay')}</th>
                    <th className="py-2 pr-3">{t('hostColGuest')}</th>
                    <th className="py-2 pr-3">{t('hostColDates')}</th>
                    <th className="py-2 pr-3">{t('hostColStatus')}</th>
                    <th className="py-2 pr-3">{t('hostColPayment')}</th>
                    <th className="py-2 pr-3">{tv('Transfer code', 'Mã CK')}</th>
                    <th className="py-2">{tv('Action', 'Thao tác')}</th>
                  </tr>
                </thead>
                <tbody>
                  {payload.bookings.map((b) => {
                    const hs = payload.rooms.find((r) => String(r._id) === String(b.homestayId));
                    const guest = b.userId?.name || b.userId?.email || '—';
                    const canConfirmBankPaid = b.paymentMethod === 'bank_transfer' && b.paymentStatus === 'pending';
                    return (
                      <tr key={b._id} className="border-b border-white/10">
                        <td className="py-2 pr-3 font-medium">{hs?.title || '—'}</td>
                        <td className="py-2 pr-3 text-white/80">{guest}</td>
                        <td className="py-2 pr-3 text-white/75">
                          {formatRange(b.checkInDate, b.checkOutDate, lang)}
                        </td>
                        <td className="py-2 pr-3 capitalize">{b.status}</td>
                        <td className="py-2 pr-3 capitalize">
                          {b.paymentStatus}
                          {b.paymentMethod === 'bank_transfer' ? ' (CK)' : b.paymentMethod === 'card' ? ' (Card)' : ''}
                        </td>
                        <td className="py-2 pr-3 text-xs text-sky-100/90">{b.bankTransferReference || '—'}</td>
                        <td className="py-2">
                          {canConfirmBankPaid ? (
                            <button
                              type="button"
                              disabled={confirmingPaymentId === b._id}
                              onClick={() => confirmBankTransferPaid(b._id)}
                              className="rounded border border-emerald-300/70 bg-emerald-500/20 px-2 py-1 text-xs font-semibold text-emerald-50 hover:bg-emerald-500/35 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {confirmingPaymentId === b._id ? tv('Processing...', 'Đang xử lý...') : tv('Mark received', 'Duyệt đã nhận tiền')}
                            </button>
                          ) : (
                            <span className="text-xs text-white/50">{tv('No action', 'Không có')}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {!loading && payload.bookings.length === 0 ? (
              <p className="mt-4 text-sm text-white/60">{t('hostNoBookings')}</p>
            ) : null}
          </div>
        )}

        {section === 'listings' && (
          <HostListingsPanel tv={tv} user={user} onListingsChanged={load} />
        )}

        {section === 'reports' && <HostRevenuePanel tv={tv} lang={lang} />}

        {section === 'bank' && <HostBankPanel tv={tv} />}
      </div>
    </div>
  );
};

export default HostDashboardPage;
