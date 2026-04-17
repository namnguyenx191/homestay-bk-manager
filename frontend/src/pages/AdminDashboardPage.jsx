import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import client from '../api/client';
import TiltCard from '../components/motion/TiltCard';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { fallbackImageByString } from '../utils/fallbackMedia';

const emptyForm = {
  title: '',
  description: '',
  location: '',
  address: '',
  roomType: 'Entire place',
  pricePerNight: '',
  images: [],
  amenities: '',
  highlights: '',
  houseRules: '',
  serviceAddOns: [],
  checkInWindow: '14:00 - 22:00',
  checkOutWindow: '08:00 - 12:00',
  cancellationPolicy: 'Free cancellation within 24 hours.',
  roomSummary: { guests: 2, bedrooms: 1, beds: 1, bathrooms: 1 },
};

const StatCard = ({ title, value, hint }) => (
  <TiltCard className="h-full" innerClassName="h-full rounded-xl" intensity={6} shine={false}>
    <div className="h-full rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-[#003580]">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  </TiltCard>
);

const buildTabs = (isAdmin, tv) => {
  const base = [
    { id: 'overview', label: tv('Revenue', 'Doanh thu') },
    { id: 'trending', label: tv('Trending rooms', 'Phòng trending') },
    { id: 'listings', label: tv('Manage listings', 'Quản lý tin đăng') },
    { id: 'bank', label: tv('Bank QR', 'QR chuyển khoản') },
  ];
  if (isAdmin) base.splice(2, 0, { id: 'users', label: tv('Manage users', 'Quản lý user') });
  return base;
};

const formatYmd = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
const blankAddOn = () => ({ name: '', price: '', unit: 'item', description: '' });

const AdminDashboardPage = () => {
  const { tv, lang } = useLanguage();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [stats, setStats] = useState(null);
  const [trending, setTrending] = useState([]);
  const [homestays, setHomestays] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [paymentSettings, setPaymentSettings] = useState({ bankQrImageUrl: '' });
  const [qrUploading, setQrUploading] = useState(false);
  const [showExtra, setShowExtra] = useState(false);
  const [revFrom, setRevFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return formatYmd(d);
  });
  const [revTo, setRevTo] = useState(() => formatYmd(new Date()));
  const [revGran, setRevGran] = useState('day');
  const [revExporting, setRevExporting] = useState(false);
  const isAdmin = user?.role === 'admin';
  const tabs = buildTabs(isAdmin, tv);
  const rawTab = searchParams.get('tab') || 'overview';
  const activeTab = tabs.some((t) => t.id === rawTab) ? rawTab : 'overview';

  const refresh = async () => {
    const [s, h] = await Promise.all([
      client.get('/admin/stats'),
      client.get('/homestays'),
    ]);
    setStats(s.data);
    setTrending(Array.isArray(s.data?.myTrending) ? s.data.myTrending : []);
    setHomestays(
      h.data.filter((item) => {
        if (user?.role === 'admin') return true;
        return String(item.ownerId) === String(user?.id || user?._id);
      })
    );
  };

  const loadUsers = async () => {
    if (user?.role !== 'admin') return;
    try {
      const { data } = await client.get('/admin/users');
      setUsers(data);
    } catch (error) {
      toast.error(error.response?.data?.message || tv('Could not load users', 'Không thể tải danh sách user'));
    }
  };

  const loadPaymentSettings = async () => {
    try {
      const { data } = await client.get('/admin/payment-settings');
      setPaymentSettings(data);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (!user) return;
    refresh();
    loadPaymentSettings();
    loadUsers();
  }, [user]);

  const uploadBankQr = async (file) => {
    setQrUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const { data } = await client.post('/upload/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      await client.put('/admin/payment-settings', { bankQrImageUrl: data.url });
      setPaymentSettings((p) => ({ ...p, bankQrImageUrl: data.url }));
      toast.success(tv('Saved bank QR', 'Đã lưu QR ngân hàng'));
    } catch (error) {
      toast.error(error.response?.data?.message || tv('QR upload failed', 'Tải QR thất bại'));
    } finally {
      setQrUploading(false);
    }
  };

  const clearBankQr = async () => {
    try {
      await client.put('/admin/payment-settings', { bankQrImageUrl: '' });
      setPaymentSettings((p) => ({ ...p, bankQrImageUrl: '' }));
      toast.success(tv('QR removed', 'Đã gỡ QR'));
    } catch (error) {
      toast.error(error.response?.data?.message || tv('Update failed', 'Cập nhật thất bại'));
    }
  };

  const uploadImage = async (file) => {
    const fd = new FormData();
    fd.append('image', file);
    setUploading(true);
    try {
      const { data } = await client.post('/upload/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setForm((prev) => ({ ...prev, images: [...prev.images, data.url] }));
      toast.success(tv('Image uploaded', 'Đã tải ảnh lên'));
    } catch (error) {
      toast.error(error.response?.data?.message || tv('Upload failed', 'Tải lên thất bại'));
    } finally {
      setUploading(false);
    }
  };

  const createHomestay = async (e) => {
    e.preventDefault();
    const price = Number(form.pricePerNight);
    if (!Number.isFinite(price) || price < 1) {
      toast.error(tv('Enter a valid price per night (min 1).', 'Nhập giá/đêm hợp lệ (tối thiểu 1).'));
      return;
    }
    try {
      const serviceAddOns = (form.serviceAddOns || [])
        .map((item) => ({
          name: String(item.name || '').trim(),
          price: Number(item.price || 0),
          unit: String(item.unit || 'item').trim() || 'item',
          description: String(item.description || '').trim(),
        }))
        .filter((item) => item.name && Number.isFinite(item.price) && item.price >= 0);

      await client.post('/homestays', {
        title: form.title,
        description: form.description,
        location: form.location,
        address: form.address,
        roomType: form.roomType,
        pricePerNight: price,
        images: form.images,
        amenities: form.amenities.split(',').map((s) => s.trim()).filter(Boolean),
        highlights: form.highlights.split(',').map((s) => s.trim()).filter(Boolean),
        houseRules: form.houseRules.split(',').map((s) => s.trim()).filter(Boolean),
        serviceAddOns,
        checkInWindow: form.checkInWindow,
        checkOutWindow: form.checkOutWindow,
        cancellationPolicy: form.cancellationPolicy,
        roomSummary: form.roomSummary,
      });
      setForm(emptyForm);
      toast.success(tv('Listing created', 'Đã tạo tin đăng'));
      refresh();
    } catch (error) {
      const errs = error.response?.data?.errors;
      const msg = Array.isArray(errs) && errs.length
        ? errs.map((x) => x.msg || x.message).filter(Boolean).join(' · ')
        : error.response?.data?.message || tv('Could not create listing', 'Không thể tạo tin đăng');
      toast.error(msg);
    }
  };

  const deleteHomestay = async (id) => {
    if (!window.confirm(tv('Delete this listing?', 'Xóa tin đăng này?'))) return;
    try {
      await client.delete(`/homestays/${id}`);
      toast.success(tv('Deleted', 'Đã xóa'));
      refresh();
    } catch (error) {
      toast.error(error.response?.data?.message || tv('Could not delete', 'Không thể xóa'));
    }
  };

  const updateAddOnField = (idx, key, value) => {
    setForm((prev) => ({
      ...prev,
      serviceAddOns: (prev.serviceAddOns || []).map((item, i) => (i === idx ? { ...item, [key]: value } : item)),
    }));
  };

  const deleteUserAccount = async (target) => {
    if (!target?._id) return;
    if (target.role === 'admin') {
      toast.error(tv('Admin account cannot be deleted', 'Không thể xóa tài khoản admin'));
      return;
    }
    const ok = window.confirm(
      tv(
        `Delete account ${target.email}? This will remove related data.`,
        `Xóa tài khoản ${target.email}? Dữ liệu liên quan sẽ bị xóa.`
      )
    );
    if (!ok) return;
    try {
      await client.delete(`/admin/users/${target._id}`);
      toast.success(tv('Account deleted', 'Đã xóa tài khoản'));
      await Promise.all([loadUsers(), refresh()]);
    } catch (error) {
      toast.error(error.response?.data?.message || tv('Could not delete account', 'Không thể xóa tài khoản'));
    }
  };

  const pendingHint =
    stats && stats.pendingRevenue
      ? tv(`About ${Number(stats.pendingRevenue).toLocaleString()} outstanding`, `Khoảng ${Number(stats.pendingRevenue).toLocaleString()} đang chờ`)
      : tv('No pending payment total', 'Không có khoản chờ thanh toán');

  const switchTab = (tabId) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tabId);
    setSearchParams(next, { replace: true });
  };

  const applyRevPreset = (preset) => {
    const to = new Date();
    if (preset === 'lastMonth') {
      const lastDayPrev = new Date(to.getFullYear(), to.getMonth(), 0);
      const firstPrev = new Date(lastDayPrev.getFullYear(), lastDayPrev.getMonth(), 1);
      setRevFrom(formatYmd(firstPrev));
      setRevTo(formatYmd(lastDayPrev));
      return;
    }
    const from = new Date();
    if (preset === '7d') {
      from.setDate(to.getDate() - 7);
    } else if (preset === 'week') {
      const offset = (to.getDay() + 6) % 7;
      from.setTime(to.getTime());
      from.setDate(to.getDate() - offset);
    } else if (preset === 'month') {
      from.setTime(to.getTime());
      from.setDate(1);
    }
    setRevFrom(formatYmd(from));
    setRevTo(formatYmd(to));
  };

  const handleExportRevenueExcel = async () => {
    setRevExporting(true);
    try {
      const { data } = await client.get('/admin/revenue-report', {
        params: { from: revFrom, to: revTo, granularity: revGran },
      });
      const fname = `revenue-${revGran}-${revFrom}-${revTo}`;
      const { exportRevenueWorkbook } = await import('../utils/revenueExcelExport');
      exportRevenueWorkbook({
        lang,
        summary: data.summary || [],
        rows: data.rows || [],
        filename: fname,
        reportMeta: {
          from: data.from,
          to: data.to,
          granularity: data.granularity,
        },
      });
      toast.success(tv('Excel file downloaded', 'Đã tải file Excel'));
    } catch (error) {
      toast.error(error.response?.data?.message || tv('Export failed', 'Xuất file thất bại'));
    } finally {
      setRevExporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {user?.role === 'host' ? tv('Host dashboard', 'Bảng điều khiển chủ nhà') : tv('Admin', 'Quản trị')}
        </h1>
        <p className="text-sm text-slate-600">{tv('Revenue snapshot, trending listings, and publish rooms.', 'Tổng quan doanh thu, tin nổi bật và đăng phòng.')}</p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => switchTab(tab.id)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                activeTab === tab.id
                  ? 'border-[#006ce4] bg-[#e7f3ff] text-[#006ce4]'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {activeTab === 'overview' && stats && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">{tv('Revenue', 'Doanh thu')}</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              title={tv('Paid revenue', 'Doanh thu đã thanh toán')}
              value={`$${Number(stats.revenue).toLocaleString()}`}
              hint={tv('Bookings with payment status: paid', 'Đơn có trạng thái thanh toán: paid')}
            />
            <StatCard
              title={tv('Awaiting payment', 'Đang chờ thanh toán')}
              value={String(stats.pendingBookings ?? 0)}
              hint={pendingHint}
            />
            <StatCard
              title={tv('Live listings', 'Tin đang hiển thị')}
              value={String(stats.homestays)}
              hint={tv(`${stats.bookings} bookings total`, `${stats.bookings} đơn tổng cộng`)}
            />
          </div>
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">
              {tv('Revenue report & Excel export', 'Báo cáo doanh thu — xuất Excel')}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {tv(
                'Includes bookings whose stay overlaps the selected dates. Summary buckets use check-in date (day, week starting Monday, or month).',
                'Gồm các đơn có kỳ lưu trú giao với khoảng ngày đã chọn. Bảng tổng hợp theo ngày nhận phòng: theo ngày, tuần (bắt đầu thứ Hai), hoặc tháng.'
              )}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                ['7d', tv('Last 7 days', '7 ngày qua')],
                ['week', tv('This week', 'Tuần này')],
                ['month', tv('This month', 'Tháng này')],
                ['lastMonth', tv('Last month', 'Tháng trước')],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => applyRevPreset(id)}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                {tv('From', 'Từ ngày')}
                <input
                  type="date"
                  value={revFrom}
                  onChange={(e) => setRevFrom(e.target.value)}
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-900"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                {tv('To', 'Đến ngày')}
                <input
                  type="date"
                  value={revTo}
                  onChange={(e) => setRevTo(e.target.value)}
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-900"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                {tv('Group by', 'Gom theo')}
                <select
                  value={revGran}
                  onChange={(e) => setRevGran(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900"
                >
                  <option value="day">{tv('By day', 'Theo ngày')}</option>
                  <option value="week">{tv('By week', 'Theo tuần')}</option>
                  <option value="month">{tv('By month', 'Theo tháng')}</option>
                </select>
              </label>
              <button
                type="button"
                disabled={revExporting}
                onClick={handleExportRevenueExcel}
                className="rounded-lg border border-[#006ce4] bg-[#006ce4] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0056b3] disabled:opacity-60"
              >
                {revExporting ? tv('Preparing…', 'Đang xử lý…') : tv('Download Excel', 'Tải file Excel')}
              </button>
            </div>
            {revGran === 'week' ? (
              <p className="mt-2 text-xs text-slate-500">{tv('Week bucket = Monday date of that week.', 'Mỗi tuần = ngày thứ Hai đầu tuần (YYYY-MM-DD).')}</p>
            ) : null}
          </div>
        </section>
      )}

      {activeTab === 'trending' && (
      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">{tv('Your trending rooms', 'Phòng của bạn đang trending')}</h2>
        <p className="mb-4 text-sm text-slate-600">
          {tv('Your top homestays by reviews and popularity.', 'Các homestay của bạn nổi bật theo đánh giá và độ phổ biến.')}
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {trending.map((item) => (
            <div
              key={item._id}
              className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
            >
              <img
                src={item.images?.[0] || fallbackImageByString(item.title || item._id)}
                alt=""
                className="h-20 w-28 shrink-0 rounded-lg object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-bold text-slate-900">{item.title}</p>
                <p className="mt-0.5 text-xs text-slate-500">{item.location}</p>
                <p className="mt-1 text-xs text-slate-600">
                  {item.rating?.toFixed(1) ?? '—'} {tv('rating', 'điểm')} - {item.reviewCount ?? 0} {tv('reviews', 'đánh giá')}
                </p>
                <Link to={`/homestays/${item._id}`} className="mt-1 inline-block text-xs font-semibold text-[#006ce4] hover:underline">
                  {tv('View page', 'Xem trang')}
                </Link>
              </div>
            </div>
          ))}
        </div>
        {!trending.length && <p className="text-sm text-slate-500">{tv('No listings yet.', 'Chưa có tin đăng.')}</p>}
      </section>
      )}

      {activeTab === 'users' && user?.role === 'admin' && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">{tv('All users', 'Tất cả tài khoản user')}</h2>
          <div className="mt-3 overflow-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b text-slate-600">
                  <th className="px-2 py-2">{tv('Name', 'Tên')}</th>
                  <th className="px-2 py-2">Email</th>
                  <th className="px-2 py-2">{tv('Role', 'Vai trò')}</th>
                  <th className="px-2 py-2">{tv('Created', 'Tạo lúc')}</th>
                  <th className="px-2 py-2">{tv('Actions', 'Thao tác')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u._id} className="border-b last:border-b-0">
                    <td className="px-2 py-2">{u.name}</td>
                    <td className="px-2 py-2">{u.email}</td>
                    <td className="px-2 py-2">{u.role}</td>
                    <td className="px-2 py-2">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="px-2 py-2">
                      {u.role !== 'admin' && (
                        <button
                          type="button"
                          onClick={() => deleteUserAccount(u)}
                          className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                        >
                          {tv('Delete', 'Xóa')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!users.length && <p className="mt-2 text-sm text-slate-500">{tv('No users yet.', 'Chưa có user nào.')}</p>}
        </section>
      )}

      {activeTab === 'listings' && (
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">{tv('Add listing', 'Thêm tin đăng')}</h2>
        <p className="mt-1 text-sm text-slate-600">{tv('Core fields and photo upload. Expand for address, amenities, and policy.', 'Trường cơ bản và tải ảnh. Mở rộng để nhập địa chỉ, tiện nghi và chính sách.')}</p>

        <form onSubmit={createHomestay} className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              placeholder={tv('Title *', 'Tiêu đề *')}
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              className="rounded-lg border border-slate-200 p-2.5 text-sm"
              required
            />
            <input
              placeholder={tv('Location *', 'Địa điểm *')}
              value={form.location}
              onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
              className="rounded-lg border border-slate-200 p-2.5 text-sm"
              required
            />
            <input
              placeholder={tv('Price / night (USD) *', 'Giá / đêm (USD) *')}
              value={form.pricePerNight}
              onChange={(e) => setForm((p) => ({ ...p, pricePerNight: e.target.value }))}
              className="rounded-lg border border-slate-200 p-2.5 text-sm"
              required
            />
            <input
              placeholder={tv('Room type (e.g. Entire place)', 'Loại phòng (VD: Nguyên căn)')}
              value={form.roomType}
              onChange={(e) => setForm((p) => ({ ...p, roomType: e.target.value }))}
              className="rounded-lg border border-slate-200 p-2.5 text-sm"
            />
          </div>
          <textarea
            placeholder={tv('Description *', 'Mô tả *')}
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            className="w-full rounded-lg border border-slate-200 p-2.5 text-sm"
            rows={3}
            required
          />

          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
            <p className="text-sm font-medium text-slate-700">{tv('Photos', 'Ảnh')}</p>
            <input type="file" accept="image/*" className="mt-2 text-sm" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} />
            {uploading && <p className="mt-1 text-xs text-slate-500">{tv('Uploading...', 'Đang tải lên...')}</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              {form.images.map((url) => (
                <img key={url} src={url} alt="" className="h-16 w-20 rounded object-cover" />
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowExtra((v) => !v)}
            className="text-sm font-semibold text-[#006ce4] hover:underline"
          >
            {showExtra ? tv('Hide extra fields', 'Ẩn trường mở rộng') : tv('More: address, amenities, policy...', 'Thêm: địa chỉ, tiện nghi, chính sách...')}
          </button>

          {showExtra && (
            <div className="grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2">
              <input
                placeholder="Street address"
                value={form.address}
                onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                className="rounded-lg border border-slate-200 p-2 text-sm sm:col-span-2"
              />
              <input
                placeholder="Amenities (comma separated)"
                value={form.amenities}
                onChange={(e) => setForm((p) => ({ ...p, amenities: e.target.value }))}
                className="rounded-lg border border-slate-200 p-2 text-sm sm:col-span-2"
              />
              <input
                placeholder="Highlights (comma separated)"
                value={form.highlights}
                onChange={(e) => setForm((p) => ({ ...p, highlights: e.target.value }))}
                className="rounded-lg border border-slate-200 p-2 text-sm sm:col-span-2"
              />
              <input
                placeholder="House rules (comma separated)"
                value={form.houseRules}
                onChange={(e) => setForm((p) => ({ ...p, houseRules: e.target.value }))}
                className="rounded-lg border border-slate-200 p-2 text-sm sm:col-span-2"
              />
              <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:col-span-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-800">{tv('Extra services table', 'Bảng dịch vụ thêm')}</p>
                  <button
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, serviceAddOns: [...(p.serviceAddOns || []), blankAddOn()] }))}
                    className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    {tv('+ Add service', '+ Thêm dịch vụ')}
                  </button>
                </div>
                {!!form.serviceAddOns.length && (
                  <div className="grid grid-cols-[1.4fr_0.8fr_0.8fr_1.6fr_auto] gap-2 text-xs text-slate-500">
                    <span>{tv('Name', 'Tên')}</span>
                    <span>{tv('Price', 'Giá')}</span>
                    <span>{tv('Unit', 'Đơn vị')}</span>
                    <span>{tv('Description', 'Mô tả')}</span>
                    <span />
                  </div>
                )}
                {(form.serviceAddOns || []).map((item, idx) => (
                  <div key={idx} className="grid grid-cols-[1.4fr_0.8fr_0.8fr_1.6fr_auto] gap-2">
                    <input
                      value={item.name}
                      onChange={(e) => updateAddOnField(idx, 'name', e.target.value)}
                      className="rounded-lg border border-slate-200 p-2 text-sm"
                      placeholder={tv('Breakfast', 'Bữa sáng')}
                    />
                    <input
                      type="number"
                      min={0}
                      value={item.price}
                      onChange={(e) => updateAddOnField(idx, 'price', e.target.value)}
                      className="rounded-lg border border-slate-200 p-2 text-sm"
                      placeholder="0"
                    />
                    <input
                      value={item.unit}
                      onChange={(e) => updateAddOnField(idx, 'unit', e.target.value)}
                      className="rounded-lg border border-slate-200 p-2 text-sm"
                      placeholder={tv('set', 'suất')}
                    />
                    <input
                      value={item.description}
                      onChange={(e) => updateAddOnField(idx, 'description', e.target.value)}
                      className="rounded-lg border border-slate-200 p-2 text-sm"
                      placeholder={tv('Optional note', 'Ghi chú')}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setForm((p) => ({
                          ...p,
                          serviceAddOns: (p.serviceAddOns || []).filter((_, i) => i !== idx),
                        }))
                      }
                      className="rounded border border-rose-200 px-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                    >
                      {tv('Del', 'Xóa')}
                    </button>
                  </div>
                ))}
                {!form.serviceAddOns.length && (
                  <p className="text-xs text-slate-500">
                    {tv('No add-on service yet. Click \"Add service\".', 'Chưa có dịch vụ thêm. Bấm \"Thêm dịch vụ\".')}
                  </p>
                )}
              </div>
              <input
                placeholder="Check-in window"
                value={form.checkInWindow}
                onChange={(e) => setForm((p) => ({ ...p, checkInWindow: e.target.value }))}
                className="rounded-lg border border-slate-200 p-2 text-sm"
              />
              <input
                placeholder="Check-out window"
                value={form.checkOutWindow}
                onChange={(e) => setForm((p) => ({ ...p, checkOutWindow: e.target.value }))}
                className="rounded-lg border border-slate-200 p-2 text-sm"
              />
              <textarea
                placeholder="Cancellation policy"
                value={form.cancellationPolicy}
                onChange={(e) => setForm((p) => ({ ...p, cancellationPolicy: e.target.value }))}
                className="rounded-lg border border-slate-200 p-2 text-sm sm:col-span-2"
                rows={2}
              />
              <div className="grid grid-cols-4 gap-2 sm:col-span-2">
                {['guests', 'bedrooms', 'beds', 'bathrooms'].map((k) => (
                  <input
                    key={k}
                    placeholder={k}
                    type="number"
                    min={1}
                    value={form.roomSummary[k]}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        roomSummary: { ...p.roomSummary, [k]: Number(e.target.value || 1) },
                      }))
                    }
                    className="rounded-lg border border-slate-200 p-2 text-sm"
                  />
                ))}
              </div>
            </div>
          )}

          <button type="submit" className="w-full rounded-lg bg-[#003580] py-3 text-sm font-semibold text-white hover:bg-[#00224d] sm:w-auto sm:px-8">
            Publish listing
          </button>
        </form>
      </section>
      )}

      {activeTab === 'listings' && (
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">{tv('Your listings', 'Tin đăng của bạn')}</h2>
        <ul className="mt-3 divide-y divide-slate-100">
          {homestays.map((item) => (
            <li key={item._id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0">
              <div>
                <p className="font-medium text-slate-900">{item.title}</p>
                <p className="text-xs text-slate-500">
                  {item.location} - ${item.pricePerNight}/{tv('night', 'đêm')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link to={`/homestays/${item._id}`} className="text-sm text-[#006ce4] hover:underline">
                  View
                </Link>
                <button type="button" onClick={() => deleteHomestay(item._id)} className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50">
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
        {!homestays.length && <p className="text-sm text-slate-500">{tv('No listings yet.', 'Chưa có tin đăng.')}</p>}
      </section>
      )}

      {activeTab === 'bank' && (
      <section className="rounded-xl border border-slate-200 bg-slate-50 p-5">
        <h2 className="text-sm font-semibold text-slate-800">{tv('Bank transfer QR (guests)', 'QR chuyển khoản (khách)')}</h2>
        <p className="mt-1 text-xs text-slate-600">{tv('Shown when guests choose bank transfer at checkout.', 'Hiển thị khi khách chọn chuyển khoản ở bước thanh toán.')}</p>
        <input type="file" accept="image/*" className="mt-2 text-sm" onChange={(e) => e.target.files?.[0] && uploadBankQr(e.target.files[0])} />
        {qrUploading && <p className="text-xs text-slate-500">Uploading...</p>}
        {paymentSettings.bankQrImageUrl && (
          <div className="mt-3 flex items-end gap-3">
            <img src={paymentSettings.bankQrImageUrl} alt={tv('QR', 'QR')} className="h-32 w-32 rounded border bg-white object-contain" />
            <button type="button" onClick={clearBankQr} className="text-xs text-red-600 hover:underline">
              Remove QR
            </button>
          </div>
        )}
      </section>
      )}
    </div>
  );
};

export default AdminDashboardPage;
