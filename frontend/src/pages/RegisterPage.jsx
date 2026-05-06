import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { parseApiError } from '../utils/formatApiError';

const RegisterPage = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', accountType: 'user' });
  const [loading, setLoading] = useState(false);
  const { tv } = useLanguage();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(form);
      navigate('/');
    } catch (error) {
      const parsed = parseApiError(error);
      let text;
      if (parsed?.code === 'NETWORK') {
        text = tv(
          'Cannot reach the API. Use the main Vercel URL, set VITE_API_URL / VITE_SOCKET_URL on Vercel, Redeploy, and ensure Render CLIENT_URLS matches your site.',
          'Không kết nối được máy chủ API. Hãy: mở đúng link Vercel đã cấu hình trên Render; trong Vercel đặt VITE_API_URL và VITE_SOCKET_URL rồi Redeploy; kiểm tra Render CLIENT_URLS trùng URL web.'
        );
      } else if (parsed?.code === 'HTML_RESPONSE') {
        text = tv(
          'Wrong API URL (received HTML). Set VITE_API_URL=https://homestay-api-bh1a.onrender.com/api on Vercel and redeploy.',
          'Sai địa chỉ API (nhận HTML thay vì JSON). Trên Vercel đặt VITE_API_URL=https://homestay-api-bh1a.onrender.com/api và Redeploy.'
        );
      } else {
        text =
          parsed?.message ||
          tv('Register failed. Please try again.', 'Đăng ký thất bại. Vui lòng thử lại.');
      }
      toast.error(text);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto max-w-md space-y-4 rounded-xl border bg-white p-4">
      <h1 className="text-xl font-semibold">{tv('Register', 'Đăng ký')}</h1>
      <div className="grid gap-2">
        <button
          type="button"
          onClick={() => setForm((p) => ({ ...p, accountType: 'user' }))}
          className={`rounded-lg border p-3 text-left text-sm ${
            form.accountType === 'user' ? 'border-[#006ce4] bg-[#e7f3ff]' : 'border-slate-200'
          }`}
        >
          <p className="font-semibold">{tv('I am looking for a place', 'Tôi muốn tìm phòng')}</p>
          <p className="text-xs text-slate-600">
            {tv('Book stays, save wishlist, and chat with hosts.', 'Đặt phòng, lưu yêu thích và chat với chủ nhà.')}
          </p>
        </button>
        <button
          type="button"
          onClick={() => setForm((p) => ({ ...p, accountType: 'host' }))}
          className={`rounded-lg border p-3 text-left text-sm ${
            form.accountType === 'host' ? 'border-[#006ce4] bg-[#e7f3ff]' : 'border-slate-200'
          }`}
        >
          <p className="font-semibold">{tv('I want to post homestays', 'Tôi muốn đăng homestay tìm khách')}</p>
          <p className="text-xs text-slate-600">
            {tv('Create listings and manage your rooms.', 'Tạo tin đăng và quản lý phòng của bạn.')}
          </p>
        </button>
      </div>
      <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder={tv('Name', 'Họ tên')} className="w-full rounded border p-2" required />
      <input value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} type="email" placeholder={tv('Email', 'Email')} className="w-full rounded border p-2" required />
      <input value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} type="password" placeholder={tv('Password', 'Mật khẩu')} className="w-full rounded border p-2" required />
      <button disabled={loading} className="w-full rounded bg-emerald-600 p-2 text-white disabled:opacity-60">
        {loading ? tv('Creating...', 'Đang tạo...') : tv('Create Account', 'Tạo tài khoản')}
      </button>
      <p className="text-sm">{tv('Already registered?', 'Đã có tài khoản?')} <Link to="/login" className="text-emerald-600">{tv('Login', 'Đăng nhập')}</Link></p>
    </form>
  );
};

export default RegisterPage;
