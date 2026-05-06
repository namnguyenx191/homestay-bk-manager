import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { parseApiError } from '../utils/formatApiError';

const LoginPage = () => {
  const { user, loading: authLoading, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState('');
  const { tv } = useLanguage();

  useEffect(() => {
    if (authLoading || !user) return;
    if (user.role === 'host') {
      navigate('/host', { replace: true });
      return;
    }
    navigate('/', { replace: true });
  }, [authLoading, user, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorText('');
    try {
      const loggedInUser = await login({ email, password });
      if (loggedInUser?.role === 'host') {
        navigate('/host', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (error) {
      const parsed = parseApiError(error);
      let detail;
      if (parsed?.code === 'NETWORK') {
        detail = tv(
          'Cannot reach the API. Check VITE_API_URL on Vercel and CLIENT_URLS on Render.',
          'Không kết nối được API. Kiểm tra VITE_API_URL trên Vercel và CLIENT_URLS trên Render.'
        );
      } else if (parsed?.code === 'HTML_RESPONSE') {
        detail = tv(
          'Wrong API URL. Redeploy frontend with correct VITE_API_URL.',
          'Sai địa chỉ API. Redeploy frontend với VITE_API_URL đúng.'
        );
      } else {
        detail =
          parsed?.message ||
          error.message ||
          tv('Unknown error', 'Lỗi không xác định');
      }
      setErrorText(detail);
      toast.error(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto max-w-md space-y-4 rounded-xl border bg-white p-4">
      <h1 className="text-xl font-semibold">{tv('Login', 'Đăng nhập')}</h1>
      <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder={tv('Email', 'Email')} className="w-full rounded border p-2" required />
      <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder={tv('Password', 'Mật khẩu')} className="w-full rounded border p-2" required />
      <button disabled={loading} className="w-full rounded bg-emerald-600 p-2 text-white disabled:opacity-60">
        {loading ? tv('Logging in...', 'Đang đăng nhập...') : tv('Login', 'Đăng nhập')}
      </button>
      {errorText && <p className="text-sm text-red-600">{tv('Error', 'Lỗi')}: {errorText}</p>}
      <p className="text-sm">{tv('No account?', 'Chưa có tài khoản?')} <Link to="/register" className="text-emerald-600">{tv('Create one', 'Tạo tài khoản')}</Link></p>
    </form>
  );
};

export default LoginPage;
