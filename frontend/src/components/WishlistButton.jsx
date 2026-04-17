import { Heart } from 'lucide-react';
import toast from 'react-hot-toast';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const WishlistButton = ({ homestayId, isActive, onChanged }) => {
  const { user } = useAuth();
  const { tv } = useLanguage();

  const toggle = async () => {
    if (!user) {
      toast.error(tv('Please login first', 'Vui lòng đăng nhập trước'));
      return;
    }

    const { data } = await client.post('/wishlist/toggle', { homestayId });
    onChanged?.(data);
  };

  return (
    <button onClick={toggle} className={`rounded-full border p-2 ${isActive ? 'bg-rose-500 text-white' : 'bg-white text-slate-700'}`}>
      <Heart size={16} fill={isActive ? 'currentColor' : 'none'} />
    </button>
  );
};

export default WishlistButton;
