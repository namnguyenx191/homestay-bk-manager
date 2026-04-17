import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import client from '../../api/client';

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
  'w-full rounded-lg border border-white/20 bg-white/10 px-2.5 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-[#c73737]/60';
const blankAddOn = () => ({ name: '', price: '', unit: 'item', description: '', active: true });

const HostListingsPanel = ({ tv, user, onListingsChanged }) => {
  const [homestays, setHomestays] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [showExtra, setShowExtra] = useState(false);

  const ownerId = String(user?.id || user?._id || '');

  const refresh = useCallback(async () => {
    try {
      const { data } = await client.get('/homestays');
      setHomestays(data.filter((item) => String(item.ownerId) === ownerId));
    } catch {
      setHomestays([]);
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
      await refresh();
      onListingsChanged?.();
    } catch (error) {
      const errs = error.response?.data?.errors;
      const msg =
        Array.isArray(errs) && errs.length
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

  return (
    <div className="space-y-8 text-white/90">
      <section className="rounded-xl border border-white/15 bg-white/[0.06] p-4 md:p-5">
        <h2 className="text-lg font-semibold text-white">{tv('Add listing', 'Thêm tin đăng')}</h2>
        <p className="mt-1 text-sm text-white/65">
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
            <p className="text-sm font-medium text-white/85">{tv('Photos', 'Ảnh')}</p>
            <input
              type="file"
              accept="image/*"
              className="mt-2 text-sm text-white/90 file:mr-3 file:rounded-lg file:border-0 file:bg-white/15 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white"
              onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])}
            />
            {uploading ? <p className="mt-1 text-xs text-white/50">{tv('Uploading...', 'Đang tải lên...')}</p> : null}
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
                  <p className="text-sm font-semibold text-white/90">{tv('Extra services table', 'Bảng dịch vụ thêm')}</p>
                  <button
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, serviceAddOns: [...(p.serviceAddOns || []), blankAddOn()] }))}
                    className="rounded border border-white/30 px-2 py-1 text-xs font-semibold text-white hover:bg-white/10"
                  >
                    {tv('+ Add service', '+ Thêm dịch vụ')}
                  </button>
                </div>
                {!!form.serviceAddOns.length && (
                  <div className="grid grid-cols-[1.3fr_0.8fr_0.8fr_1.4fr_0.6fr_auto] gap-2 text-xs text-white/60">
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
                  <p className="text-xs text-white/60">
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

          <button
            type="submit"
            className="w-full rounded-lg bg-[#c73737] py-3 text-sm font-semibold text-white hover:bg-[#a82c2c] sm:w-auto sm:px-8"
          >
            {tv('Publish listing', 'Đăng tin')}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-white/15 bg-white/[0.06] p-4 md:p-5">
        <h2 className="text-lg font-semibold text-white">{tv('Your listings', 'Tin đăng của bạn')}</h2>
        <ul className="mt-3 divide-y divide-white/10">
          {homestays.map((item) => (
            <li key={item._id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0">
              <div>
                <p className="font-medium text-white">{item.title}</p>
                <p className="text-xs text-white/55">
                  {item.location} - ${item.pricePerNight}/{tv('night', 'đêm')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link to={`/homestays/${item._id}`} className="text-sm text-sky-300 hover:underline">
                  {tv('View', 'Xem')}
                </Link>
                <button
                  type="button"
                  onClick={() => deleteHomestay(item._id)}
                  className="rounded border border-rose-400/40 px-2 py-1 text-xs text-rose-200 hover:bg-rose-500/20"
                >
                  {tv('Delete', 'Xóa')}
                </button>
              </div>
            </li>
          ))}
        </ul>
        {!homestays.length ? <p className="text-sm text-white/55">{tv('No listings yet.', 'Chưa có tin đăng.')}</p> : null}
      </section>
    </div>
  );
};

export default HostListingsPanel;
