import { useState } from 'react';
import toast from 'react-hot-toast';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const AccountPage = () => {
  const { user, setUser } = useAuth();
  const { tv } = useLanguage();
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const saveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const { data } = await client.put('/auth/me', profileForm);
      setUser(data);
      toast.success(tv('Account updated', 'Đã cập nhật tài khoản'));
    } catch (error) {
      toast.error(error.response?.data?.message || tv('Update failed', 'Cập nhật thất bại'));
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error(tv('Password confirmation does not match', 'Xác nhận mật khẩu không khớp'));
      return;
    }
    setSavingPassword(true);
    try {
      await client.put('/auth/me/password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success(tv('Password updated', 'Đã đổi mật khẩu'));
    } catch (error) {
      toast.error(error.response?.data?.message || tv('Password update failed', 'Đổi mật khẩu thất bại'));
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      <section className="rounded-xl border bg-white p-4">
        <h1 className="text-xl font-semibold">{tv('Account management', 'Quản lý tài khoản')}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {tv('Update your profile information below.', 'Cập nhật thông tin tài khoản bên dưới.')}
        </p>

        <form onSubmit={saveProfile} className="mt-4 space-y-3">
          <input
            value={profileForm.name}
            onChange={(e) => setProfileForm((p) => ({ ...p, name: e.target.value }))}
            placeholder={tv('Name', 'Họ tên')}
            className="w-full rounded border p-2"
            required
          />
          <input
            type="email"
            value={profileForm.email}
            onChange={(e) => setProfileForm((p) => ({ ...p, email: e.target.value }))}
            placeholder={tv('Email', 'Email')}
            className="w-full rounded border p-2"
            required
          />
          <button
            type="submit"
            disabled={savingProfile}
            className="rounded bg-[#003580] px-4 py-2 text-white disabled:opacity-60"
          >
            {savingProfile ? tv('Saving...', 'Đang lưu...') : tv('Save profile', 'Lưu thông tin')}
          </button>
        </form>
      </section>

      <section className="rounded-xl border bg-white p-4">
        <h2 className="text-lg font-semibold">{tv('Change password', 'Đổi mật khẩu')}</h2>
        <form onSubmit={changePassword} className="mt-4 space-y-3">
          <input
            type="password"
            value={passwordForm.currentPassword}
            onChange={(e) => setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))}
            placeholder={tv('Current password', 'Mật khẩu hiện tại')}
            className="w-full rounded border p-2"
            required
          />
          <input
            type="password"
            value={passwordForm.newPassword}
            onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))}
            placeholder={tv('New password', 'Mật khẩu mới')}
            className="w-full rounded border p-2"
            minLength={6}
            required
          />
          <input
            type="password"
            value={passwordForm.confirmPassword}
            onChange={(e) => setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))}
            placeholder={tv('Confirm new password', 'Xác nhận mật khẩu mới')}
            className="w-full rounded border p-2"
            minLength={6}
            required
          />
          <button
            type="submit"
            disabled={savingPassword}
            className="rounded bg-emerald-600 px-4 py-2 text-white disabled:opacity-60"
          >
            {savingPassword ? tv('Updating...', 'Đang cập nhật...') : tv('Update password', 'Cập nhật mật khẩu')}
          </button>
        </form>
      </section>
    </div>
  );
};

export default AccountPage;
