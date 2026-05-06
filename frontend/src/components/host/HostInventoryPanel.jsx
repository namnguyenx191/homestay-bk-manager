import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import client from '../../api/client';

const blank = { province: '', name: '', sku: '', unit: 'item', quantity: '', minQuantity: '', note: '' };
const inputClass =
  'w-full rounded-lg border border-white/20 bg-white/10 px-2.5 py-2 text-sm text-white placeholder:text-slate-300 outline-none focus:border-[#c73737]/60';

const HostInventoryPanel = ({ tv }) => {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState('');

  const load = useCallback(async () => {
    try {
      const { data } = await client.get('/inventory');
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error(e.response?.data?.message || tv('Could not load inventory', 'Không tải được kho'));
      setItems([]);
    }
  }, [tv]);

  useEffect(() => {
    load();
  }, [load]);

  const provinceOptions = Array.from(
    new Set(
      items
        .map((x) => String(x.province || '').trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error(tv('Item name is required', 'Tên mặt hàng là bắt buộc'));
    const payload = {
      province: form.province.trim() || 'Khác',
      name: form.name.trim(),
      sku: form.sku.trim(),
      unit: form.unit.trim() || 'item',
      quantity: Number(form.quantity || 0),
      minQuantity: Number(form.minQuantity || 0),
      note: form.note.trim(),
    };
    try {
      if (editingId) {
        await client.put(`/inventory/${editingId}`, payload);
        toast.success(tv('Inventory item updated', 'Đã cập nhật mặt hàng'));
      } else {
        await client.post('/inventory', payload);
        toast.success(tv('Inventory item added', 'Đã thêm mặt hàng'));
      }
      setForm(blank);
      setEditingId('');
      load();
    } catch (e2) {
      toast.error(e2.response?.data?.message || tv('Could not save inventory item', 'Không thể lưu mặt hàng'));
    }
  };

  const onEdit = (item) => {
    setEditingId(item._id);
    setForm({
      province: item.province || '',
      name: item.name || '',
      sku: item.sku || '',
      unit: item.unit || 'item',
      quantity: String(item.quantity ?? ''),
      minQuantity: String(item.minQuantity ?? ''),
      note: item.note || '',
    });
  };

  const onDelete = async (id) => {
    if (!window.confirm(tv('Delete this inventory item?', 'Xóa mặt hàng này?'))) return;
    try {
      await client.delete(`/inventory/${id}`);
      toast.success(tv('Deleted', 'Đã xóa'));
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || tv('Could not delete inventory item', 'Không thể xóa mặt hàng'));
    }
  };

  return (
    <div className="space-y-6 text-white">
      <section className="rounded-xl border border-white/15 bg-white/[0.06] p-4 md:p-5">
        <h2 className="text-lg font-semibold">{tv('Inventory', 'Kho hàng')}</h2>
        <p className="mt-1 text-sm text-slate-200">
          {tv('Manage supplies and stock quantity for homestay operations.', 'Quản lý vật tư và số lượng tồn kho để vận hành homestay.')}
        </p>
        <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input className={inputClass} placeholder={tv('Province / city', 'Tỉnh / thành')} value={form.province} onChange={(e) => setForm((p) => ({ ...p, province: e.target.value }))} />
          <input className={inputClass} placeholder={tv('Item name *', 'Tên mặt hàng *')} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          <input className={inputClass} placeholder="SKU" value={form.sku} onChange={(e) => setForm((p) => ({ ...p, sku: e.target.value }))} />
          <input className={inputClass} placeholder={tv('Unit', 'Đơn vị')} value={form.unit} onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))} />
          <input type="number" min={0} className={inputClass} placeholder={tv('In stock', 'Tồn kho')} value={form.quantity} onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))} />
          <input type="number" min={0} className={inputClass} placeholder={tv('Min stock alert', 'Cảnh báo tồn tối thiểu')} value={form.minQuantity} onChange={(e) => setForm((p) => ({ ...p, minQuantity: e.target.value }))} />
          <input className={inputClass} placeholder={tv('Note', 'Ghi chú')} value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} />
          <div className="sm:col-span-2 flex gap-2">
            <button type="submit" className="rounded-lg bg-[#c73737] px-4 py-2 text-sm font-semibold text-white hover:bg-[#a82c2c]">
              {editingId ? tv('Update item', 'Cập nhật') : tv('Add item', 'Nhập kho')}
            </button>
            {editingId ? (
              <button type="button" className="rounded-lg border border-white/30 px-4 py-2 text-sm" onClick={() => { setEditingId(''); setForm(blank); }}>
                {tv('Cancel edit', 'Hủy sửa')}
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-white/15 bg-white/[0.06] p-4 md:p-5">
        <h3 className="text-base font-semibold">{tv('Stock list', 'Danh sách tồn kho')}</h3>
        {!items.length ? (
          <p className="mt-2 text-sm text-slate-200">{tv('No inventory items yet.', 'Chưa có mặt hàng trong kho.')}</p>
        ) : (
          <div className="mt-4 space-y-5">
            {provinceOptions.map((prov) => (
              <div key={prov}>
                <h4 className="mb-2 text-sm font-semibold text-emerald-200">{prov}</h4>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px] text-sm">
                    <thead>
                      <tr className="border-b border-white/15 text-left text-xs uppercase tracking-wide text-slate-300">
                        <th className="py-2 pr-3">{tv('Item', 'Mặt hàng')}</th>
                        <th className="py-2 pr-3">SKU</th>
                        <th className="py-2 pr-3">{tv('Unit', 'Đơn vị')}</th>
                        <th className="py-2 pr-3">{tv('In stock', 'Tồn kho')}</th>
                        <th className="py-2 pr-3">{tv('Min', 'Tối thiểu')}</th>
                        <th className="py-2 pr-3">{tv('Note', 'Ghi chú')}</th>
                        <th className="py-2 pr-3">{tv('Actions', 'Thao tác')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.filter((it) => String(it.province || '').trim() === prov).map((it) => (
                        <tr key={it._id} className="border-b border-white/10">
                          <td className="py-2 pr-3 font-semibold text-white">{it.name}</td>
                          <td className="py-2 pr-3 text-slate-200">{it.sku || '—'}</td>
                          <td className="py-2 pr-3 text-slate-200">{it.unit || '—'}</td>
                          <td className={`py-2 pr-3 font-semibold ${Number(it.quantity) <= Number(it.minQuantity || 0) ? 'text-amber-300' : 'text-emerald-300'}`}>
                            {it.quantity}
                          </td>
                          <td className="py-2 pr-3 text-slate-200">{it.minQuantity || 0}</td>
                          <td className="py-2 pr-3 text-slate-200">{it.note || '—'}</td>
                          <td className="py-2 pr-3">
                            <div className="flex gap-2">
                              <button type="button" className="rounded border border-sky-400/50 px-2 py-1 text-xs text-sky-200 hover:bg-sky-500/20" onClick={() => onEdit(it)}>
                                {tv('Edit', 'Sửa')}
                              </button>
                              <button type="button" className="rounded border border-rose-400/50 px-2 py-1 text-xs text-rose-200 hover:bg-rose-500/20" onClick={() => onDelete(it._id)}>
                                {tv('Delete', 'Xóa')}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default HostInventoryPanel;

