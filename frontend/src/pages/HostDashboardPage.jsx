import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import client from '../api/client';
import { getSocket } from '../utils/socket';
import HostListingsPanel from '../components/host/HostListingsPanel';
import HostRevenuePanel from '../components/host/HostRevenuePanel';
import HostInventoryPanel from '../components/host/HostInventoryPanel';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useCurrency } from '../context/CurrencyContext';

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

const pseudoRoomCode = (index) => {
  const floor = Math.floor(index / 10) + 2;
  const no = (index % 10) + 1;
  return `P.${floor}${String(no).padStart(2, '0')}`;
};

const HostDashboardPage = () => {
  const { user } = useAuth();
  const { lang, t, tv } = useLanguage();
  const { formatMoney } = useCurrency();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawSection = searchParams.get('section') || 'map';
  const section = ['map', 'bookings', 'listings', 'inventory', 'reports'].includes(rawSection) ? rawSection : 'map';

  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState({ rooms: [], bookings: [], counts: {} });
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [checkingInBookingId, setCheckingInBookingId] = useState('');
  const [checkingOutBookingId, setCheckingOutBookingId] = useState('');
  const [walkInDraft, setWalkInDraft] = useState({
    guestName: '',
    guestPhone: '',
    checkOutDate: '',
    paymentMethod: 'cash',
    paymentStatus: 'paid',
  });
  const [walkInSubmitting, setWalkInSubmitting] = useState(false);
  const [walkInModalOpen, setWalkInModalOpen] = useState(false);

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

  useEffect(() => {
    const socket = getSocket();
    const onHostNotification = (payload) => {
      if (!payload || String(payload.hostId || '') !== String(user?._id || '')) return;
      toast.success(payload.message || tv('You have a new host notification.', 'Bạn có thông báo mới.'));
      load();
    };
    socket.on('host:notification', onHostNotification);
    return () => socket.off('host:notification', onHostNotification);
  }, [user?._id, load, tv]);

  const setSection = (next) => {
    setSearchParams(next === 'map' ? {} : { section: next });
  };

  const navItems = useMemo(
    () => [
      { id: 'map', label: t('hostNavRoomMap') },
      { id: 'bookings', label: t('hostNavBookings') },
      { id: 'listings', label: t('hostNavListings') },
      { id: 'inventory', label: tv('Inventory', 'Kho') },
      { id: 'reports', label: t('hostNavReports') },
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

  const selectedRoom = useMemo(
    () => payload.rooms.find((room) => String(room._id) === String(selectedRoomId)),
    [payload.rooms, selectedRoomId]
  );
  const selectedRoomBookings = useMemo(() => {
    const now = new Date();
    return payload.bookings
      .filter((booking) => {
        if (String(booking.homestayId) !== String(selectedRoomId)) return false;
        const st = String(booking.status || '');
        if (!['pending', 'confirmed', 'checked_in'].includes(st)) return false;
        if (st === 'checked_in') return true;
        return new Date(booking.checkOutDate) > now;
      })
      .sort((a, b) => {
        const aIn = String(a.status) === 'checked_in' ? 0 : 1;
        const bIn = String(b.status) === 'checked_in' ? 0 : 1;
        if (aIn !== bIn) return aIn - bIn;
        return new Date(a.checkInDate) - new Date(b.checkInDate);
      });
  }, [payload.bookings, selectedRoomId]);

  const checkInBooking = async (bookingId) => {
    setCheckingInBookingId(bookingId);
    try {
      await client.put(`/bookings/${bookingId}/check-in`, {});
      toast.success(tv('Check-in confirmed.', 'Đã duyệt check-in.'));
      await load();
    } catch (e) {
      toast.error(e.response?.data?.message || tv('Could not check in booking.', 'Không thể check-in đơn.'));
    } finally {
      setCheckingInBookingId('');
    }
  };

  const checkOutBooking = async (bookingId) => {
    setCheckingOutBookingId(bookingId);
    try {
      await client.put(`/bookings/${bookingId}/check-out`, {});
      toast.success(tv('Check-out completed.', 'Đã check-out xong.'));
      await load();
    } catch (e) {
      toast.error(e.response?.data?.message || tv('Could not check out booking.', 'Không thể check-out đơn.'));
    } finally {
      setCheckingOutBookingId('');
    }
  };

  const createWalkInCheckIn = async () => {
    if (!selectedRoomId) return;
    if (!walkInDraft.guestName.trim() || !walkInDraft.checkOutDate) {
      toast.error(tv('Please enter guest name and check-out time.', 'Vui lòng nhập tên khách và giờ check-out.'));
      return;
    }
    setWalkInSubmitting(true);
    try {
      await client.post('/bookings/host/walk-in-checkin', {
        homestayId: selectedRoomId,
        guestName: walkInDraft.guestName,
        guestPhone: walkInDraft.guestPhone,
        checkOutDate: walkInDraft.checkOutDate,
        paymentMethod: walkInDraft.paymentMethod,
        paymentStatus: walkInDraft.paymentStatus,
      });
      toast.success(tv('Direct check-in created successfully.', 'Đã tạo check-in trực tiếp thành công.'));
      setWalkInDraft({
        guestName: '',
        guestPhone: '',
        checkOutDate: '',
        paymentMethod: 'cash',
        paymentStatus: 'paid',
      });
      setWalkInModalOpen(false);
      await load();
    } catch (e) {
      toast.error(e.response?.data?.message || tv('Could not create direct check-in.', 'Không thể tạo check-in trực tiếp.'));
    } finally {
      setWalkInSubmitting(false);
    }
  };

  const walkInNights = useMemo(() => {
    if (!walkInDraft.checkOutDate) return 1;
    const now = new Date();
    const out = new Date(walkInDraft.checkOutDate);
    if (Number.isNaN(out.getTime()) || out <= now) return 1;
    return Math.max(1, Math.ceil((out - now) / 86400000));
  }, [walkInDraft.checkOutDate]);
  const walkInEstimate = useMemo(() => {
    const base = Number(selectedRoom?.pricePerNight || 0);
    return base * walkInNights;
  }, [selectedRoom?.pricePerNight, walkInNights]);

  const sidebarBtn = (id) =>
    `flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${
      section === id
        ? 'bg-white/15 text-white ring-1 ring-[#c73737]/50'
        : 'text-slate-100 hover:bg-white/10 hover:text-white'
    }`;

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-4 md:flex-row md:gap-6">
      <aside className="w-full shrink-0 rounded-2xl border border-white/15 bg-[#1e293b]/55 p-3 shadow-lg backdrop-blur-md md:w-56">
        <p className="border-b border-white/10 px-2 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-200">
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
                    <span className="text-slate-100">{payload.counts[p.countKey] ?? 0}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setFilter('all')}
                  className={`rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold ${
                    filter === 'all' ? 'bg-[#c73737]/80 text-white' : 'bg-white/5 text-slate-100 hover:bg-white/10'
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
                  className="w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-300 outline-none ring-0 focus:border-[#c73737]/60 sm:min-w-[220px]"
                />
                <Link
                  to="/host?section=bookings"
                  className="whitespace-nowrap rounded-xl border border-white/25 bg-white/10 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-white/15"
                >
                  {t('hostNavBookings')}
                </Link>
              </div>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-200">{t('hostMapHint')}</p>

            {loading ? (
              <p className="mt-10 text-center text-sm text-slate-200">{t('hostLoading')}</p>
            ) : filteredRooms.length === 0 ? (
              <p className="mt-10 text-center text-sm text-slate-200">{t('hostNoRooms')}</p>
            ) : (
              <div className="mt-6 space-y-8">
                {grouped.map(([loc, items], locIdx) => (
                  <section key={loc}>
                    <h2 className="mb-3 flex items-baseline gap-2 text-sm font-semibold text-white">
                      <span>{loc}</span>
                      <span className="text-slate-300">
                        ({items.length})
                      </span>
                    </h2>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {items.map((room, idx) => {
                        const badge = roomBadge(room);
                        const open = menuOpenId === room._id;
                        const roomCode = pseudoRoomCode(locIdx * 100 + idx);
                        const guestCurrent =
                          (room.activeBooking?.guestName && String(room.activeBooking.guestName).trim()) ||
                          room.activeBooking?.userId?.name ||
                          room.activeBooking?.userId?.email;
                        const guestNext = room.nextBooking?.userId?.name || room.nextBooking?.userId?.email;
                        const prebookCheckInReady =
                          room.nextBooking &&
                          ['pending', 'confirmed'].includes(String(room.nextBooking.status || '')) &&
                          new Date(room.nextBooking.checkInDate) <= new Date() &&
                          new Date(room.nextBooking.checkOutDate) > new Date();
                        return (
                          <div
                            key={room._id}
                            className="relative overflow-hidden rounded-2xl border border-white/15 bg-white/[0.06] shadow-md"
                            onClick={() => setSelectedRoomId(room._id)}
                          >
                            <div className={`h-2 bg-gradient-to-r ${stripClass(room.dashboardStatus)}`} />
                            <div className="p-4 pt-3">
                              <div className="flex items-start justify-between gap-1">
                                <div>
                                  <p className="text-base font-bold tracking-wide text-white">{roomCode}</p>
                                  <p className="text-[10px] text-slate-300">{room.roomType || '—'}</p>
                                </div>
                                <div className="relative shrink-0 -mt-1 -mr-1">
                                  <button
                                    type="button"
                                    className="rounded p-1 text-slate-200 hover:bg-white/10 hover:text-white"
                                    aria-label={t('hostRoomMenu')}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setMenuOpenId(open ? null : room._id);
                                    }}
                                  >
                                    ⋮
                                  </button>
                                  {open ? (
                                    <div
                                      className="absolute right-0 z-10 mt-1 min-w-[10rem] rounded-lg border border-white/15 bg-slate-900 py-1 text-sm shadow-xl"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Link
                                        to={`/homestays/${room._id}`}
                                        className="block px-3 py-2 text-white hover:bg-white/10"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setMenuOpenId(null);
                                        }}
                                      >
                                        {t('hostViewListing')}
                                      </Link>
                                      <Link
                                        to="/host?section=listings"
                                        className="block px-3 py-2 text-white hover:bg-white/10"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setMenuOpenId(null);
                                        }}
                                      >
                                        {t('hostEditListing')}
                                      </Link>
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                              <p className="mt-2 line-clamp-2 text-lg font-bold leading-snug text-white">{room.title}</p>
                              <div className="mt-3 space-y-2">
                                <span
                                  className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badge.className}`}
                                >
                                  {badge.label}
                                </span>
                                {room.activeBooking ? (
                                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-600/20 px-2.5 py-2">
                                    <p className="text-[9px] font-semibold uppercase tracking-wide text-emerald-200/95">
                                      {t('hostCurrentStay')}
                                    </p>
                                    <p className="mt-0.5 line-clamp-1 text-[10px] font-medium text-emerald-50">
                                      {formatRange(room.activeBooking.checkInDate, room.activeBooking.checkOutDate, lang)}
                                    </p>
                                    {guestCurrent ? (
                                      <p className="truncate text-[9px] text-emerald-100/85">{guestCurrent}</p>
                                    ) : null}
                                    {Number(room.activeBooking.overstayFeeAccrued) > 0 ? (
                                      <p className="mt-1.5 text-[10px] font-semibold text-amber-200">
                                        {tv('Extra stay fee (accrued)', 'Phí lưu trú thêm (tích lũy)')}:{' '}
                                        {formatMoney(room.activeBooking.overstayFeeAccrued)}
                                      </p>
                                    ) : null}
                                  </div>
                                ) : null}
                                {room.nextBooking ? (
                                  <div className="rounded-lg border border-sky-400/35 bg-sky-600/20 px-2.5 py-2">
                                    <p className="text-[9px] font-semibold uppercase tracking-wide text-sky-200/95">
                                      {room.activeBooking ? t('hostUpcomingBooking') : t('hostPillBooked')}
                                    </p>
                                    <p className="mt-0.5 line-clamp-1 text-[10px] font-medium text-sky-50">
                                      {formatRange(room.nextBooking.checkInDate, room.nextBooking.checkOutDate, lang)}
                                    </p>
                                    {guestNext ? (
                                      <p className="truncate text-[9px] text-sky-100/85">{guestNext}</p>
                                    ) : null}
                                  </div>
                                ) : null}
                                {!room.activeBooking && !room.nextBooking ? (
                                  <div className="rounded-lg border border-dashed border-white/20 px-2 py-2 text-center text-[11px] text-slate-200">
                                    {t('hostNoActiveBooking')}
                                  </div>
                                ) : null}
                                {room.activeBooking && String(room.activeBooking.status) === 'checked_in' ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      checkOutBooking(room.activeBooking._id);
                                    }}
                                    disabled={checkingOutBookingId === room.activeBooking._id}
                                    className="w-full rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-60"
                                  >
                                    {checkingOutBookingId === room.activeBooking._id
                                      ? tv('Processing...', 'Đang xử lý...')
                                      : tv('Check-out guest', 'Check-out khách')}
                                  </button>
                                ) : null}
                                {prebookCheckInReady ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      checkInBooking(room.nextBooking._id);
                                    }}
                                    disabled={checkingInBookingId === room.nextBooking._id}
                                    className="w-full rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                                  >
                                    {checkingInBookingId === room.nextBooking._id
                                      ? tv('Processing...', 'Đang xử lý...')
                                      : tv('Check-in guest', 'Check-in khách')}
                                  </button>
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
              <p className="text-sm text-slate-200">{t('hostLoading')}</p>
            ) : (
              <table className="w-full min-w-[860px] border-collapse text-left text-sm text-white">
                <thead>
                  <tr className="border-b border-white/15 text-xs uppercase tracking-wide text-slate-200">
                    <th className="py-2 pr-3">{t('hostColStay')}</th>
                    <th className="py-2 pr-3">{t('hostColGuest')}</th>
                    <th className="py-2 pr-3">{t('hostColDates')}</th>
                    <th className="py-2 pr-3">{t('hostColStatus')}</th>
                    <th className="py-2 pr-3">{t('hostColPayment')}</th>
                    <th className="py-2 pr-3">{tv('Transfer code', 'Mã CK')}</th>
                  </tr>
                </thead>
                <tbody>
                  {payload.bookings.map((b) => {
                    const hs = payload.rooms.find((r) => String(r._id) === String(b.homestayId));
                    const guest = b.userId?.name || b.userId?.email || '—';
                    return (
                      <tr key={b._id} className="border-b border-white/10">
                        <td className="py-2 pr-3 font-medium">{hs?.title || '—'}</td>
                        <td className="py-2 pr-3 text-slate-100">{guest}</td>
                        <td className="py-2 pr-3 text-slate-100">
                          {formatRange(b.checkInDate, b.checkOutDate, lang)}
                        </td>
                        <td className="py-2 pr-3 capitalize">
                          {b.status}
                          {Number(b.overstayFeeAccrued) > 0 ? (
                            <span className="mt-0.5 block text-[10px] font-semibold text-amber-200">
                              {tv('Extra stay fee', 'Phí lưu trú thêm')}: {formatMoney(b.overstayFeeAccrued)}
                            </span>
                          ) : null}
                        </td>
                        <td className="py-2 pr-3 capitalize">
                          {b.paymentStatus}
                          {b.paymentMethod === 'bank_transfer' ? ' (CK)' : b.paymentMethod === 'card' ? ' (Card)' : ''}
                        </td>
                        <td className="py-2 pr-3 text-xs text-sky-100/90">{b.bankTransferReference || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {!loading && payload.bookings.length === 0 ? (
              <p className="mt-4 text-sm text-slate-200">{t('hostNoBookings')}</p>
            ) : null}
          </div>
        )}

        {section === 'listings' && (
          <HostListingsPanel tv={tv} user={user} onListingsChanged={load} />
        )}
        {section === 'inventory' && <HostInventoryPanel tv={tv} />}

        {section === 'reports' && <HostRevenuePanel tv={tv} lang={lang} />}

      </div>
      {selectedRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-600 bg-slate-900 p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-100">{selectedRoom.title}</h2>
                <p className="text-xs text-slate-300">{tv('Upcoming and active reservations', 'Danh sách đặt phòng hiện tại và sắp tới')}</p>
              </div>
              <button
                type="button"
                className="rounded border border-slate-500 px-2 py-1 text-xs text-slate-100 hover:bg-slate-700"
                onClick={() => {
                  setWalkInModalOpen(false);
                  setSelectedRoomId('');
                }}
              >
                {tv('Close', 'Đóng')}
              </button>
            </div>
            {selectedRoomBookings.length === 0 ? (
              <p className="rounded border border-dashed border-slate-500 p-4 text-sm text-slate-300">
                {tv('No reservations for this room.', 'Phòng này chưa có đặt chỗ nào.')}
              </p>
            ) : (
              <div className="max-h-[65vh] space-y-2 overflow-auto pr-1">
                {selectedRoomBookings.map((booking) => {
                  const canCheckIn =
                    booking.status !== 'cancelled' &&
                    booking.status !== 'checked_in' &&
                    booking.status !== 'checked_out' &&
                    new Date(booking.checkInDate) <= new Date() &&
                    new Date(booking.checkOutDate) > new Date();
                  const canCheckOut = String(booking.status) === 'checked_in';
                  return (
                    <div key={booking._id} className="rounded-xl border border-slate-600 bg-slate-800/60 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm text-slate-100">
                          <p className="font-semibold">{booking.guestName || booking.userId?.name || booking.userId?.email || 'Guest'}</p>
                          <p className="text-xs text-slate-300">
                            {formatRange(booking.checkInDate, booking.checkOutDate, lang)}
                          </p>
                          {Number(booking.overstayFeeAccrued) > 0 ? (
                            <p className="mt-1 text-xs font-semibold text-amber-200">
                              {tv('Extra stay fee (accrued)', 'Phí lưu trú thêm (tích lũy)')}:{' '}
                              {formatMoney(booking.overstayFeeAccrued)}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="rounded bg-slate-700 px-2 py-1 text-slate-100">
                            {tv('Status', 'Trạng thái')}: {booking.status}
                          </span>
                          <span className="rounded bg-slate-700 px-2 py-1 text-slate-100">
                            {tv('Payment', 'Thanh toán')}: {booking.paymentStatus}
                          </span>
                          {canCheckIn && (
                            <button
                              type="button"
                              onClick={() => checkInBooking(booking._id)}
                              disabled={checkingInBookingId === booking._id}
                              className="rounded bg-emerald-600 px-3 py-1 font-semibold text-white disabled:opacity-60"
                            >
                              {checkingInBookingId === booking._id
                                ? tv('Processing...', 'Đang xử lý...')
                                : tv('Confirm check-in', 'Duyệt check-in')}
                            </button>
                          )}
                          {canCheckOut && (
                            <button
                              type="button"
                              onClick={() => checkOutBooking(booking._id)}
                              disabled={checkingOutBookingId === booking._id}
                              className="rounded bg-amber-600 px-3 py-1 font-semibold text-white disabled:opacity-60"
                            >
                              {checkingOutBookingId === booking._id
                                ? tv('Processing...', 'Đang xử lý...')
                                : tv('Check-out', 'Check-out')}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="mt-4 rounded-xl border border-slate-600 bg-slate-800/70 p-3">
              <p className="mb-2 text-xs text-slate-300">
                {tv('Walk-in guest? Open the form to enter details and payment.', 'Khách vãng lai? Mở form để nhập thông tin và thanh toán.')}
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setWalkInModalOpen(true);
                }}
                className="w-full rounded-lg border border-emerald-500/60 bg-emerald-600/25 px-4 py-2.5 text-sm font-semibold text-emerald-100 hover:bg-emerald-600/40"
              >
                {tv('Direct check-in (walk-in)', 'Check-in trực tiếp')}
              </button>
            </div>
          </div>
        </div>
      )}
      {selectedRoom && walkInModalOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="walk-in-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setWalkInModalOpen(false);
          }}
        >
          <div className="w-full max-w-4xl rounded-2xl border border-slate-500 bg-slate-900 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-2 border-b border-slate-700 pb-3">
              <div>
                <h3 id="walk-in-title" className="text-lg font-bold text-slate-100">
                  {tv('Direct check-in', 'Check-in trực tiếp')}
                </h3>
                <p className="mt-0.5 text-xs text-slate-300">
                  {selectedRoom.title} · {selectedRoom.roomType || '—'}
                </p>
              </div>
              <button
                type="button"
                className="rounded border border-slate-500 px-2 py-1 text-xs text-slate-100 hover:bg-slate-700"
                onClick={() => setWalkInModalOpen(false)}
              >
                {tv('Close', 'Đóng')}
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-[1.35fr_0.85fr]">
              <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-800/60 p-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="text-xs font-medium text-slate-300 sm:col-span-2">
                    {tv('Guest name', 'Tên khách')}
                    <input
                      value={walkInDraft.guestName}
                      onChange={(e) => setWalkInDraft((prev) => ({ ...prev, guestName: e.target.value }))}
                      placeholder={tv('Guest name', 'Tên khách')}
                      className="mt-1 w-full rounded border border-slate-500 bg-slate-950 px-2 py-2 text-sm text-slate-100 placeholder:text-slate-300"
                    />
                  </label>
                  <label className="text-xs font-medium text-slate-300 sm:col-span-2">
                    {tv('Phone (optional)', 'Số điện thoại (tuỳ chọn)')}
                    <input
                      value={walkInDraft.guestPhone}
                      onChange={(e) => setWalkInDraft((prev) => ({ ...prev, guestPhone: e.target.value }))}
                      placeholder={tv('Phone (optional)', 'Số điện thoại (tuỳ chọn)')}
                      className="mt-1 w-full rounded border border-slate-500 bg-slate-950 px-2 py-2 text-sm text-slate-100 placeholder:text-slate-300"
                    />
                  </label>
                  <label className="text-xs font-medium text-slate-300">
                    {tv('Check-in', 'Check-in')}
                    <input
                      type="datetime-local"
                      value={new Date().toISOString().slice(0, 16)}
                      readOnly
                      className="mt-1 w-full rounded border border-slate-600 bg-slate-900/70 px-2 py-2 text-sm text-slate-300"
                    />
                  </label>
                  <label className="text-xs font-medium text-slate-300">
                    {tv('Check-out', 'Check-out')}
                    <input
                      type="datetime-local"
                      value={walkInDraft.checkOutDate}
                      onChange={(e) => setWalkInDraft((prev) => ({ ...prev, checkOutDate: e.target.value }))}
                      className="mt-1 w-full rounded border border-slate-500 bg-slate-950 px-2 py-2 text-sm text-slate-100"
                    />
                  </label>
                  <label className="text-xs font-medium text-slate-300">
                    {tv('Payment method', 'Phương thức thanh toán')}
                    <select
                      value={walkInDraft.paymentMethod}
                      onChange={(e) => setWalkInDraft((prev) => ({ ...prev, paymentMethod: e.target.value }))}
                      className="mt-1 w-full rounded border border-slate-500 bg-slate-950 px-2 py-2 text-sm text-slate-100"
                    >
                      <option value="cash">{tv('Cash', 'Tiền mặt')}</option>
                      <option value="card">{tv('Card', 'Thẻ')}</option>
                      <option value="bank_transfer">{tv('Bank transfer', 'Chuyển khoản')}</option>
                    </select>
                  </label>
                  <label className="text-xs font-medium text-slate-300">
                    {tv('Payment status', 'Trạng thái thanh toán')}
                    <select
                      value={walkInDraft.paymentStatus}
                      onChange={(e) => setWalkInDraft((prev) => ({ ...prev, paymentStatus: e.target.value }))}
                      className="mt-1 w-full rounded border border-slate-500 bg-slate-950 px-2 py-2 text-sm text-slate-100"
                    >
                      <option value="paid">{tv('Paid', 'Đã thanh toán')}</option>
                      <option value="pending">{tv('Pending', 'Chờ thanh toán')}</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                  {tv('Temporary invoice', 'Tạm tính')}
                </p>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between text-slate-200">
                    <span>{tv('Room', 'Phòng')}</span>
                    <span className="font-semibold text-white">{selectedRoom.title}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-200">
                    <span>{tv('Nightly rate', 'Giá mỗi đêm')}</span>
                    <span className="font-semibold text-white">{formatMoney(selectedRoom.pricePerNight)}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-200">
                    <span>{tv('Nights', 'Số đêm')}</span>
                    <span className="font-semibold text-white">{walkInNights}</span>
                  </div>
                  <div className="border-t border-slate-600 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-100">{tv('Estimated total', 'Tổng tạm tính')}</span>
                      <span className="text-base font-bold text-emerald-300">{formatMoney(walkInEstimate)}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setWalkInModalOpen(false)}
                    className="rounded-lg border border-slate-500 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700"
                  >
                    {tv('Cancel', 'Đóng')}
                  </button>
                  <button
                    type="button"
                    disabled={walkInSubmitting}
                    onClick={createWalkInCheckIn}
                    className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                  >
                    {walkInSubmitting
                      ? tv('Processing...', 'Đang xử lý...')
                      : tv('Check in now', 'Nhận phòng ngay')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HostDashboardPage;
