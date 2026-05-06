import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import client from '../../api/client';

const HostBankPanel = ({ tv }) => {
  const [paymentSettings, setPaymentSettings] = useState({
    bankQrImageUrl: '',
    bankName: '',
    accountNumber: '',
    accountName: '',
    branch: '',
    swift: '',
    instructions: '',
  });
  const [qrUploading, setQrUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadPaymentSettings = async () => {
    try {
      const { data } = await client.get('/admin/payment-settings');
      setPaymentSettings(data);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    loadPaymentSettings();
  }, []);

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

  const saveBankInfo = async () => {
    setSaving(true);
    try {
      const payload = {
        bankName: paymentSettings.bankName || '',
        accountNumber: paymentSettings.accountNumber || '',
        accountName: paymentSettings.accountName || '',
        branch: paymentSettings.branch || '',
        swift: paymentSettings.swift || '',
        instructions: paymentSettings.instructions || '',
      };
      const { data } = await client.put('/admin/payment-settings', payload);
      setPaymentSettings((prev) => ({ ...prev, ...data }));
      toast.success(tv('Bank info saved', 'Đã lưu thông tin ngân hàng'));
    } catch (error) {
      toast.error(error.response?.data?.message || tv('Update failed', 'Cập nhật thất bại'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 text-white">
      <h1 className="text-lg font-bold text-white">{tv('Bank transfer QR (guests)', 'QR chuyển khoản (khách)')}</h1>
      <p className="text-sm text-slate-100">{tv('Shown when guests choose bank transfer at checkout.', 'Hiển thị khi khách chọn chuyển khoản ở bước thanh toán.')}</p>
      <div className="rounded-xl border border-white/15 bg-white/[0.06] p-4">
        <input
          type="file"
          accept="image/*"
          className="text-sm text-white file:mr-3 file:rounded-lg file:border-0 file:bg-white/15 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white"
          onChange={(e) => e.target.files?.[0] && uploadBankQr(e.target.files[0])}
        />
        {qrUploading ? <p className="mt-2 text-xs text-slate-200">{tv('Uploading...', 'Đang tải lên...')}</p> : null}
        {paymentSettings.bankQrImageUrl ? (
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <img
              src={paymentSettings.bankQrImageUrl}
              alt={tv('QR', 'QR')}
              className="h-36 w-36 rounded-lg border border-white/20 bg-white object-contain p-1"
            />
            <button type="button" onClick={clearBankQr} className="text-sm text-rose-300 hover:underline">
              {tv('Remove QR', 'Gỡ QR')}
            </button>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-200">{tv('No QR uploaded yet.', 'Chưa có ảnh QR.')}</p>
        )}

        <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-2">
          <input
            value={paymentSettings.bankName || ''}
            onChange={(e) => setPaymentSettings((p) => ({ ...p, bankName: e.target.value }))}
            placeholder={tv('Bank name', 'Tên ngân hàng')}
            className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-300"
          />
          <input
            value={paymentSettings.accountNumber || ''}
            onChange={(e) => setPaymentSettings((p) => ({ ...p, accountNumber: e.target.value }))}
            placeholder={tv('Account number', 'Số tài khoản')}
            className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-300"
          />
          <input
            value={paymentSettings.accountName || ''}
            onChange={(e) => setPaymentSettings((p) => ({ ...p, accountName: e.target.value }))}
            placeholder={tv('Account name', 'Tên tài khoản')}
            className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-300"
          />
          <input
            value={paymentSettings.branch || ''}
            onChange={(e) => setPaymentSettings((p) => ({ ...p, branch: e.target.value }))}
            placeholder={tv('Branch (optional)', 'Chi nhánh (tuỳ chọn)')}
            className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-300"
          />
          <input
            value={paymentSettings.swift || ''}
            onChange={(e) => setPaymentSettings((p) => ({ ...p, swift: e.target.value }))}
            placeholder="SWIFT (optional)"
            className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-300 sm:col-span-2"
          />
          <textarea
            value={paymentSettings.instructions || ''}
            onChange={(e) => setPaymentSettings((p) => ({ ...p, instructions: e.target.value }))}
            placeholder={tv('Transfer instructions', 'Hướng dẫn chuyển khoản')}
            className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-300 sm:col-span-2"
            rows={2}
          />
          <button
            type="button"
            onClick={saveBankInfo}
            disabled={saving}
            className="rounded-lg border border-emerald-400/50 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-60 sm:col-span-2 sm:w-fit"
          >
            {saving ? tv('Saving...', 'Đang lưu...') : tv('Save bank info', 'Lưu thông tin ngân hàng')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default HostBankPanel;
