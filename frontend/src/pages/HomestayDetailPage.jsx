import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import client from '../api/client';
import ReviewList from '../components/ReviewList';
import PropertyGallery from '../components/property/PropertyGallery';
import PropertyHeader from '../components/property/PropertyHeader';
import PropertyAmenities from '../components/property/PropertyAmenities';
import PropertyPolicies from '../components/property/PropertyPolicies';
import PropertyBookingCard from '../components/property/PropertyBookingCard';
import { useAuth } from '../context/AuthContext';
import { useChatWidget } from '../context/ChatWidgetContext';
import { useLanguage } from '../context/LanguageContext';

const HomestayDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { openWidget } = useChatWidget();
  const [homestay, setHomestay] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [reviewSummary, setReviewSummary] = useState(null);
  const [inWishlist, setInWishlist] = useState(false);
  const [loading, setLoading] = useState(true);
  const { tv } = useLanguage();

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      const requests = [
        client.get(`/homestays/${id}`),
        client.get(`/reviews/${id}`),
        client.get(`/reviews/${id}/summary`),
      ];
      if (user) requests.push(client.get('/wishlist'));
      try {
        const responses = await Promise.all(requests);
        const home = responses[0].data;
        const revs = responses[1].data;
        const summary = responses[2].data;
        setHomestay(home);
        setReviews(revs);
        setReviewSummary(summary);
        if (user && responses[3]) {
          const wishIds = responses[3].data.map((item) => item._id);
          setInWishlist(wishIds.includes(home._id));
        }
      } catch (error) {
        toast.error(error.response?.data?.message || tv('Could not load property details', 'Không thể tải thông tin chỗ ở'));
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [id, user]);

  const startChat = async () => {
    if (!user) return navigate('/login');
    try {
      const { data: chat } = await client.post('/chats/start', {
        participantId: homestay.ownerId?._id,
        homestayId: homestay._id,
      });
      openWidget(chat?._id);
    } catch (error) {
      toast.error(error.response?.data?.message || tv('Cannot create chat', 'Không thể tạo cuộc trò chuyện'));
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-72 animate-pulse rounded-xl bg-slate-200" />
        <div className="h-32 animate-pulse rounded-xl bg-slate-200" />
        <div className="h-56 animate-pulse rounded-xl bg-slate-200" />
      </div>
    );
  }
  if (!homestay) return <p className="rounded-xl border bg-white p-4">{tv('Property not found.', 'Không tìm thấy chỗ ở.')}</p>;

  return (
    <div className="space-y-6">
      <PropertyGallery images={homestay.images} title={homestay.title} />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <PropertyHeader homestay={homestay} inWishlist={inWishlist} onWishlistChanged={(data) => setInWishlist(data.inWishlist)} />

          <section className="rounded-xl border bg-white p-5">
            <h2 className="text-xl font-semibold">{tv('Overview', 'Tổng quan')}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{homestay.description}</p>
            <div className="mt-4 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
              <p><span className="font-semibold">{tv('Room type', 'Loại phòng')}: </span> {homestay.roomType}</p>
              <p><span className="font-semibold">{tv('Guests', 'Khách')}: </span> {homestay.roomSummary?.guests || 2}</p>
              <p><span className="font-semibold">{tv('Bedrooms', 'Phòng ngủ')}: </span> {homestay.roomSummary?.bedrooms || 1}</p>
              <p><span className="font-semibold">{tv('Bathrooms', 'Phòng tắm')}: </span> {homestay.roomSummary?.bathrooms || 1}</p>
            </div>
          </section>

          <PropertyAmenities amenities={homestay.amenities} />
          <PropertyPolicies homestay={homestay} />

          <div className="rounded-xl border bg-white p-5">
            <h2 className="mb-3 text-xl font-semibold">{tv('Guest reviews', 'Đánh giá của khách')}</h2>
            <ReviewList reviews={reviews} summary={reviewSummary} />
          </div>

          {user && user.role !== 'admin' && (
            <div className="rounded-xl border bg-white p-5">
              <h2 className="text-lg font-semibold">{tv('Need more details?', 'Cần thêm thông tin?')}</h2>
              <p className="mt-1 text-sm text-slate-600">{tv('Message the host to confirm check-in details, room setup, or special requests.', 'Nhắn chủ nhà để xác nhận giờ nhận phòng, bố trí phòng hoặc yêu cầu đặc biệt.')}</p>
              <button onClick={startChat} className="mt-3 rounded border border-emerald-600 px-4 py-2 text-emerald-700">{tv('Chat with host', 'Chat với chủ nhà')}</button>
            </div>
          )}
        </div>

        <PropertyBookingCard homestay={homestay} />
      </div>
    </div>
  );
};

export default HomestayDetailPage;
