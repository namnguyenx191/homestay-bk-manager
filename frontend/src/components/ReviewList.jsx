import { useLanguage } from '../context/LanguageContext';

const scoreBar = (value) => `${Math.min(100, Math.round((value / 5) * 100))}%`;

const ReviewList = ({ reviews, summary }) => {
  const { tv } = useLanguage();
  if (!reviews.length) return <p className="text-sm text-slate-500">{tv('No reviews yet.', 'Chưa có đánh giá.')}</p>;

  return (
    <div className="space-y-5">
      {summary && (
        <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 flex items-end gap-3">
            <p className="text-3xl font-bold">{summary.averageRating?.toFixed(1) || '0.0'}</p>
            <p className="text-sm text-slate-600">{tv('from', 'từ')} {summary.totalReviews || 0} {tv('reviews', 'đánh giá')}</p>
          </div>
          <div className="space-y-2">
            {Object.entries(summary.categoryScores || {}).map(([key, value]) => (
              <div key={key} className="grid grid-cols-[120px_1fr_40px] items-center gap-2 text-sm">
                <span className="capitalize text-slate-600">{key}</span>
                <div className="h-2 rounded-full bg-slate-200">
                  <div className="h-2 rounded-full bg-emerald-500" style={{ width: scoreBar(value) }} />
                </div>
                <span className="text-right font-semibold text-slate-700">{value.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="space-y-3">
      {reviews.map((review) => (
        <article key={review._id} className="rounded border bg-white p-3">
          <p className="text-sm font-semibold">{review.userId?.name || tv('Anonymous', 'Ẩn danh')} - ⭐ {review.rating}</p>
          <p className="text-sm text-slate-700">{review.comment}</p>
        </article>
      ))}
      </div>
    </div>
  );
};

export default ReviewList;
