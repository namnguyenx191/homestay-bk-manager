import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import client from '../../api/client';
import { useCurrency } from '../../context/CurrencyContext';
import { hostIdString } from '../../utils/hostDisplay';

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

const inputClass =
  'w-full rounded-lg border border-white/20 bg-white/10 px-2.5 py-2 text-sm text-white placeholder:text-slate-300 outline-none focus:border-[#c73737]/60';
const blankAddOn = () => ({ name: '', price: '', unit: 'item', description: '', active: true });
const DAY_MS = 24 * 60 * 60 * 1000;

const normalizeNights = (checkInDate, checkOutDate) => {
  const inDate = new Date(checkInDate);
  const outDate = new Date(checkOutDate);
  if (Number.isNaN(inDate.getTime()) || Number.isNaN(outDate.getTime())) return 1;
  return Math.max(1, Math.ceil((outDate - inDate) / DAY_MS));
};

const HostListingsPanel = ({ tv, user, onListingsChanged }) => {
  const { formatMoney } = useCurrency();
  const [homestays, setHomestays] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showExtra, setShowExtra] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState('');

  const ownerId = String(user?.id || user?._id || '');

  const refresh = useCallback(async () => {
    try {
      const [{ data: homestaysData }, { data: dashboardData }] = await Promise.all([
        client.get('/homestays'),
        client.get('/bookings/host-dashboard'),
      ]);
      setHomestays((homestaysData || []).filter((item) => hostIdString(item.ownerId) === ownerId));
      setBookings(Array.isArray(dashboardData?.bookings) ? dashboardData.bookings : []);
    } catch {
      setHomestays([]);
      setBookings([]);
    }
  }, [ownerId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

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
          active: item.active !== false,
        }))
        .filter((item) => item.name && Number.isFinite(item.price) && item.price >= 0);

      const payload = {
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
      };
      if (editingId) await client.put(`/homestays/${editingId}`, payload);
      else await client.post('/homestays', payload);
      setForm(emptyForm);
      setEditingId('');
      toast.success(editingId ? tv('Listing updated', 'Đã cập nhật tin đăng') : tv('Listing created', 'Đã tạo tin đăng'));
      await refresh();
      onListingsChanged?.();
    } catch (error) {
      const errs = error.response?.data?.errors;
      const msg =
        Array.isArray(errs) && errs.length
          ? errs.map((x) => x.msg || x.message).filter(Boolean).join(' · ')
          : error.response?.data?.message || tv('Could not save listing', 'Không thể lưu tin đăng');
      toast.error(msg);
    }
  };

  const deleteHomestay = async (id) => {
    if (!window.confirm(tv('Delete this listing?', 'Xóa tin đăng này?'))) return;
    try {
      await client.delete(`/homestays/${id}`);
      toast.success(tv('Deleted', 'Đã xóa'));
      await refresh();
      onListingsChanged?.();
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

  const startEdit = (item) => {
    setEditingId(item._id);
    setShowExtra(true);
    setForm({
      title: item.title || '',
      description: item.description || '',
      location: item.location || '',
      address: item.address || '',
      roomType: item.roomType || 'Entire place',
      pricePerNight: String(item.pricePerNight ?? ''),
      images: Array.isArray(item.images) ? item.images : [],
      amenities: Array.isArray(item.amenities) ? item.amenities.join(', ') : '',
      highlights: Array.isArray(item.highlights) ? item.highlights.join(', ') : '',
      houseRules: Array.isArray(item.houseRules) ? item.houseRules.join(', ') : '',
      serviceAddOns: Array.isArray(item.serviceAddOns) ? item.serviceAddOns : [],
      checkInWindow: item.checkInWindow || '14:00 - 22:00',
      checkOutWindow: item.checkOutWindow || '08:00 - 12:00',
      cancellationPolicy: item.cancellationPolicy || 'Free cancellation within 24 hours.',
      roomSummary: {
        guests: Number(item.roomSummary?.guests || 2),
        bedrooms: Number(item.roomSummary?.bedrooms || 1),
        beds: Number(item.roomSummary?.beds || 1),
        bathrooms: Number(item.roomSummary?.bathrooms || 1),
      },
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const reportByHomestayId = useMemo(() => {
    const now = new Date();
    return homestays.reduce((acc, stay) => {
      const stayBookings = bookings.filter((booking) => String(booking.homestayId) === String(stay._id));
      const activeBookings = stayBookings.filter((booking) => String(booking.status) !== 'cancelled');
      const cancelledBookings = stayBookings.length - activeBookings.length;
      const completedStays = stayBookings.filter((booking) => String(booking.status) === 'checked_out').length;
      const checkedInNow = stayBookings.filter((booking) => String(booking.status) === 'checked_in').length;
      const upcomingBookings = stayBookings.filter((booking) => {
        const status = String(booking.status || '');
        if (!['pending', 'confirmed'].includes(status)) return false;
        return new Date(booking.checkInDate) > now;
      }).length;
      const paidBookings = activeBookings.filter((booking) => String(booking.paymentStatus) === 'paid');
      const totalRevenue = activeBookings.reduce(
        (sum, booking) =>
          sum +
          Number(booking.totalPrice || 0) +
          Number(booking.addOnsTotal || 0) +
          Number(booking.overstayFeeAccrued || 0),
        0
      );
      const paidRevenue = paidBookings.reduce(
        (sum, booking) =>
          sum +
          Number(booking.totalPrice || 0) +
          Number(booking.addOnsTotal || 0) +
          Number(booking.overstayFeeAccrued || 0),
        0
      );
      const bookedNights = activeBookings.reduce(
        (sum, booking) => sum + normalizeNights(booking.checkInDate, booking.checkOutDate),
        0
      );
      const avgStayNights = activeBookings.length ? bookedNights / activeBookings.length : 0;
      const cancellationRate = stayBookings.length ? (cancelledBookings / stayBookings.length) * 100 : 0;
      const paymentCompletionRate = activeBookings.length ? (paidBookings.length / activeBookings.length) * 100 : 0;

      acc[String(stay._id)] = {
        bookingsCount: stayBookings.length,
        activeBookingsCount: activeBookings.length,
        upcomingBookings,
        checkedInNow,
        completedStays,
        cancelledBookings,
        totalRevenue,
        paidRevenue,
        bookedNights,
        avgStayNights,
        cancellationRate,
        paymentCompletionRate,
      };
      return acc;
    }, {});
  }, [bookings, homestays]);

  const selectedReportStay = useMemo(
    () => homestays.find((item) => String(item._id) === String(selectedReportId)) || null,
    [homestays, selectedReportId]
  );

  const selectedReportBookings = useMemo(() => {
    if (!selectedReportId) return [];
    return bookings
      .filter((booking) => String(booking.homestayId) === String(selectedReportId))
      .sort((a, b) => new Date(b.createdAt || b.checkInDate) - new Date(a.createdAt || a.checkInDate))
      .slice(0, 8);
  }, [bookings, selectedReportId]);

  return (
    <div className="space-y-8 text-white">
      <section className="rounded-xl border border-white/15 bg-white/[0.06] p-4 md:p-5">
        <h2 className="text-lg font-semibold text-white">{editingId ? tv('Edit listing', 'Chỉnh sửa tin đăng') : tv('Add listing', 'Thêm tin đăng')}</h2>
        <p className="mt-1 text-sm text-slate-100">
          {tv('Core fields and photo upload. Expand for address, amenities, and policy.', 'Trường cơ bản và tải ảnh. Mở rộng để nhập địa chỉ, tiện nghi và chính sách.')}
        </p>

        <form onSubmit={createHomestay} className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              placeholder={tv('Title *', 'Tiêu đề *')}
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              className={inputClass}
              required
            />
            <input
              placeholder={tv('Location *', 'Địa điểm *')}
              value={form.location}
              onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
              className={inputClass}
              required
            />
            <input
              placeholder={tv('Price / night (USD) *', 'Giá / đêm (USD) *')}
              value={form.pricePerNight}
              onChange={(e) => setForm((p) => ({ ...p, pricePerNight: e.target.value }))}
              className={inputClass}
              required
            />
            <input
              placeholder={tv('Room type (e.g. Entire place)', 'Loại phòng (VD: Nguyên căn)')}
              value={form.roomType}
              onChange={(e) => setForm((p) => ({ ...p, roomType: e.target.value }))}
              className={inputClass}
            />
          </div>
          <textarea
            placeholder={tv('Description *', 'Mô tả *')}
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            className={`${inputClass} min-h-[5rem]`}
            rows={3}
            required
          />

          <div className="rounded-lg border border-dashed border-white/25 bg-white/5 p-3">
            <p className="text-sm font-medium text-white">{tv('Photos', 'Ảnh')}</p>
            <input
              type="file"
              accept="image/*"
              className="mt-2 text-sm text-white file:mr-3 file:rounded-lg file:border-0 file:bg-white/15 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white"
              onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])}
            />
            {uploading ? <p className="mt-1 text-xs text-slate-200">{tv('Uploading...', 'Đang tải lên...')}</p> : null}
            <div className="mt-2 flex flex-wrap gap-2">
              {form.images.map((url) => (
                <img key={url} src={url} alt="" className="h-16 w-20 rounded object-cover" />
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowExtra((v) => !v)}
            className="text-sm font-semibold text-sky-300 hover:underline"
          >
            {showExtra ? tv('Hide extra fields', 'Ẩn trường mở rộng') : tv('More: address, amenities, policy...', 'Thêm: địa chỉ, tiện nghi, chính sách...')}
          </button>

          {showExtra && (
            <div className="grid gap-3 border-t border-white/10 pt-3 sm:grid-cols-2">
              <input
                placeholder={tv('Street address', 'Địa chỉ')}
                value={form.address}
                onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                className={`${inputClass} sm:col-span-2`}
              />
              <input
                placeholder={tv('Amenities (comma separated)', 'Tiện nghi (cách nhau dấu phẩy)')}
                value={form.amenities}
                onChange={(e) => setForm((p) => ({ ...p, amenities: e.target.value }))}
                className={`${inputClass} sm:col-span-2`}
              />
              <input
                placeholder={tv('Highlights (comma separated)', 'Điểm nổi bật')}
                value={form.highlights}
                onChange={(e) => setForm((p) => ({ ...p, highlights: e.target.value }))}
                className={`${inputClass} sm:col-span-2`}
              />
              <input
                placeholder={tv('House rules (comma separated)', 'Nội quy')}
                value={form.houseRules}
                onChange={(e) => setForm((p) => ({ ...p, houseRules: e.target.value }))}
                className={`${inputClass} sm:col-span-2`}
              />
              <div className="space-y-2 rounded-lg border border-white/15 bg-white/5 p-3 sm:col-span-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white">{tv('Extra services table', 'Bảng dịch vụ thêm')}</p>
                  <button
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, serviceAddOns: [...(p.serviceAddOns || []), blankAddOn()] }))}
                    className="rounded border border-white/30 px-2 py-1 text-xs font-semibold text-white hover:bg-white/10"
                  >
                    {tv('+ Add service', '+ Thêm dịch vụ')}
                  </button>
                </div>
                {!!form.serviceAddOns.length && (
                  <div className="grid grid-cols-[1.3fr_0.8fr_0.8fr_1.4fr_0.6fr_auto] gap-2 text-xs text-slate-100">
                    <span>{tv('Name', 'Tên')}</span>
                    <span>{tv('Price', 'Giá')}</span>
                    <span>{tv('Unit', 'Đơn vị')}</span>
                    <span>{tv('Description', 'Mô tả')}</span>
                    <span>{tv('On', 'Bật')}</span>
                    <span />
                  </div>
                )}
                {(form.serviceAddOns || []).map((item, idx) => (
                  <div key={idx} className="grid grid-cols-[1.3fr_0.8fr_0.8fr_1.4fr_0.6fr_auto] gap-2">
                    <input
                      value={item.name}
                      onChange={(e) => updateAddOnField(idx, 'name', e.target.value)}
                      className={inputClass}
                      placeholder={tv('Breakfast', 'Bữa sáng')}
                    />
                    <input
                      type="number"
                      min={0}
                      value={item.price}
                      onChange={(e) => updateAddOnField(idx, 'price', e.target.value)}
                      className={inputClass}
                      placeholder="0"
                    />
                    <input
                      value={item.unit}
                      onChange={(e) => updateAddOnField(idx, 'unit', e.target.value)}
                      className={inputClass}
                      placeholder={tv('set', 'suất')}
                    />
                    <input
                      value={item.description}
                      onChange={(e) => updateAddOnField(idx, 'description', e.target.value)}
                      className={inputClass}
                      placeholder={tv('Optional note', 'Ghi chú')}
                    />
                    <label className="flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={item.active !== false}
                        onChange={(e) => updateAddOnField(idx, 'active', e.target.checked)}
                        className="h-4 w-4 accent-emerald-500"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((p) => ({
                          ...p,
                          serviceAddOns: (p.serviceAddOns || []).filter((_, i) => i !== idx),
                        }))
                      }
                      className="rounded border border-rose-300/60 px-2 text-xs font-semibold text-rose-200 hover:bg-rose-500/20"
                    >
                      {tv('Del', 'Xóa')}
                    </button>
                  </div>
                ))}
                {!form.serviceAddOns.length && (
                  <p className="text-xs text-slate-200">
                    {tv('No add-on service yet. Click "Add service".', 'Chưa có dịch vụ thêm. Bấm "Thêm dịch vụ".')}
                  </p>
                )}
              </div>
              <input
                placeholder={tv('Check-in window', 'Giờ nhận phòng')}
                value={form.checkInWindow}
                onChange={(e) => setForm((p) => ({ ...p, checkInWindow: e.target.value }))}
                className={inputClass}
              />
              <input
                placeholder={tv('Check-out window', 'Giờ trả phòng')}
                value={form.checkOutWindow}
                onChange={(e) => setForm((p) => ({ ...p, checkOutWindow: e.target.value }))}
                className={inputClass}
              />
              <textarea
                placeholder={tv('Cancellation policy', 'Chính sách hủy')}
                value={form.cancellationPolicy}
                onChange={(e) => setForm((p) => ({ ...p, cancellationPolicy: e.target.value }))}
                className={`${inputClass} sm:col-span-2`}
                rows={2}
              />
              <div className="grid grid-cols-2 gap-2 sm:col-span-2 sm:grid-cols-4">
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
                    className={inputClass}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              className="w-full rounded-lg bg-[#c73737] py-3 text-sm font-semibold text-white hover:bg-[#a82c2c] sm:w-auto sm:px-8"
            >
              {editingId ? tv('Save changes', 'Lưu thay đổi') : tv('Publish listing', 'Đăng tin')}
            </button>
            {editingId ? (
              <button
                type="button"
                className="w-full rounded-lg border border-white/30 py-3 text-sm font-semibold text-white hover:bg-white/10 sm:w-auto sm:px-6"
                onClick={() => {
                  setEditingId('');
                  setForm(emptyForm);
                }}
              >
                {tv('Cancel edit', 'Hủy sửa')}
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-white/15 bg-white/[0.06] p-4 md:p-5">
        <h2 className="text-lg font-semibold text-white">{tv('Your listings', 'Tin đăng của bạn')}</h2>
        <ul className="mt-3 divide-y divide-white/10">
          {homestays.map((item) => (
            <li key={item._id} className="py-3 first:pt-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedReportId((prev) => (prev === item._id ? '' : item._id))}
                  className="text-left"
                >
                  <p className="font-medium text-white">{item.title}</p>
                  <p className="text-xs text-slate-200">
                    {item.location} - {formatMoney(item.pricePerNight)}/{tv('night', 'đêm')}
                  </p>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedReportId(item._id)}
                    className="rounded border border-violet-400/40 px-2 py-1 text-xs text-violet-200 hover:bg-violet-500/20"
                  >
                    {tv('View report', 'Xem báo cáo')}
                  </button>
                  <Link to={`/homestays/${item._id}`} className="text-sm text-sky-300 hover:underline">
                    {tv('View', 'Xem')}
                  </Link>
                  <button
                    type="button"
                    onClick={() => startEdit(item)}
                    className="rounded border border-sky-400/40 px-2 py-1 text-xs text-sky-200 hover:bg-sky-500/20"
                  >
                    {tv('Edit', 'Sửa')}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteHomestay(item._id)}
                    className="rounded border border-rose-400/40 px-2 py-1 text-xs text-rose-200 hover:bg-rose-500/20"
                  >
                    {tv('Delete', 'Xóa')}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
        {!homestays.length ? <p className="text-sm text-slate-200">{tv('No listings yet.', 'Chưa có tin đăng.')}</p> : null}
      </section>
      {selectedReportStay
        ? createPortal(
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/65 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedReportId('');
          }}
        >
          <div className="w-full max-w-6xl rounded-2xl border border-white/20 bg-slate-900/95 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-2 border-b border-white/10 px-4 py-3 md:px-5">
              <div>
                <h3 className="text-base font-semibold text-white md:text-lg">
                  {tv('Listing report', 'Báo cáo tin đăng')}: {selectedReportStay.title}
                </h3>
                <p className="text-xs text-slate-300">
                  {selectedReportStay.location} · {formatMoney(selectedReportStay.pricePerNight)}/{tv('night', 'đêm')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReportId('')}
                className="rounded-lg border border-white/25 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-white/10"
              >
                {tv('Close', 'Đóng')}
              </button>
            </div>
            <div className="grid gap-4 p-4 md:grid-cols-[1.1fr_0.9fr] md:p-5">
              <div className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-white/10 bg-emerald-500/10 p-3">
                    <p className="text-[11px] text-slate-200">{tv('Total revenue', 'Tổng doanh thu')}</p>
                    <p className="mt-1 text-lg font-bold text-emerald-300">
                      {formatMoney(reportByHomestayId[selectedReportStay._id]?.totalRevenue || 0)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-sky-500/10 p-3">
                    <p className="text-[11px] text-slate-200">{tv('Collected revenue', 'Doanh thu đã thu')}</p>
                    <p className="mt-1 text-lg font-bold text-sky-200">
                      {formatMoney(reportByHomestayId[selectedReportStay._id]?.paidRevenue || 0)}
                    </p>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                    <p className="text-[11px] text-slate-300">{tv('Rating', 'Đánh giá')}</p>
                    <p className="mt-1 text-sm font-semibold text-amber-200">
                      {Number(selectedReportStay.rating || 0).toFixed(1)} / 5
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {Number(selectedReportStay.reviewCount || 0)} {tv('reviews', 'đánh giá')}
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                    <p className="text-[11px] text-slate-300">{tv('Payment completion', 'Tỷ lệ thanh toán')}</p>
                    <p className="mt-1 text-sm font-semibold text-white">
                      {Number(reportByHomestayId[selectedReportStay._id]?.paymentCompletionRate || 0).toFixed(0)}%
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                    <p className="text-[11px] text-slate-300">{tv('Cancellation rate', 'Tỷ lệ hủy')}</p>
                    <p className="mt-1 text-sm font-semibold text-white">
                      {Number(reportByHomestayId[selectedReportStay._id]?.cancellationRate || 0).toFixed(0)}%
                    </p>
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
                    {tv('Operating overview', 'Tổng quan vận hành')}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <p className="rounded border border-white/10 bg-slate-900/40 px-2 py-1.5 text-xs text-slate-200">
                      {tv('Total bookings', 'Tổng đơn')}: <span className="font-semibold text-white">{reportByHomestayId[selectedReportStay._id]?.bookingsCount || 0}</span>
                    </p>
                    <p className="rounded border border-white/10 bg-slate-900/40 px-2 py-1.5 text-xs text-slate-200">
                      {tv('Completed stays', 'Lượt lưu trú hoàn tất')}: <span className="font-semibold text-white">{reportByHomestayId[selectedReportStay._id]?.completedStays || 0}</span>
                    </p>
                    <p className="rounded border border-white/10 bg-slate-900/40 px-2 py-1.5 text-xs text-slate-200">
                      {tv('Currently occupied', 'Đang có khách')}: <span className="font-semibold text-white">{reportByHomestayId[selectedReportStay._id]?.checkedInNow || 0}</span>
                    </p>
                    <p className="rounded border border-white/10 bg-slate-900/40 px-2 py-1.5 text-xs text-slate-200">
                      {tv('Upcoming bookings', 'Đơn sắp tới')}: <span className="font-semibold text-white">{reportByHomestayId[selectedReportStay._id]?.upcomingBookings || 0}</span>
                    </p>
                    <p className="rounded border border-white/10 bg-slate-900/40 px-2 py-1.5 text-xs text-slate-200">
                      {tv('Booked nights', 'Tổng số đêm')}: <span className="font-semibold text-white">{reportByHomestayId[selectedReportStay._id]?.bookedNights || 0}</span>
                    </p>
                    <p className="rounded border border-white/10 bg-slate-900/40 px-2 py-1.5 text-xs text-slate-200">
                      {tv('Average stay length', 'Thời gian lưu trú trung bình')}:{' '}
                      <span className="font-semibold text-white">{Number(reportByHomestayId[selectedReportStay._id]?.avgStayNights || 0).toFixed(1)} {tv('nights', 'đêm')}</span>
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
                  {tv('Recent bookings', 'Đơn đặt gần đây')}
                </p>
                {selectedReportBookings.length ? (
                  <div className="max-h-[420px] space-y-2 overflow-auto pr-1">
                    {selectedReportBookings.map((booking) => (
                      <div key={booking._id} className="rounded-lg border border-white/10 bg-slate-900/40 p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-white">
                            {booking.guestName || booking.userId?.name || booking.userId?.email || 'Guest'}
                          </p>
                          <span className="rounded bg-white/10 px-2 py-0.5 text-[11px] text-slate-200">
                            {booking.status}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-300">
                          {new Date(booking.checkInDate).toLocaleDateString('vi-VN')} - {new Date(booking.checkOutDate).toLocaleDateString('vi-VN')}
                        </p>
                        <p className="text-[11px] text-slate-300">
                          {tv('Payment', 'Thanh toán')}: {booking.paymentStatus} · {tv('Amount', 'Giá trị')}:{' '}
                          <span className="font-semibold text-slate-100">
                            {formatMoney(Number(booking.totalPrice || 0) + Number(booking.addOnsTotal || 0) + Number(booking.overstayFeeAccrued || 0))}
                          </span>
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded border border-dashed border-white/20 p-3 text-sm text-slate-300">
                    {tv('No booking data for this listing yet.', 'Tin đăng này chưa có dữ liệu đặt phòng.')}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
            ,
            document.body
          )
        : null}
    </div>
  );
};

export default HostListingsPanel;
