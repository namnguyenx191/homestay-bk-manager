import { useLanguage } from '../../context/LanguageContext';

const PropertyPolicies = ({ homestay }) => {
  const { tv } = useLanguage();
  const rules = homestay.houseRules?.length
    ? homestay.houseRules
    : [tv('No smoking', 'Không hút thuốc'), tv('No parties or events', 'Không tổ chức tiệc/sự kiện'), tv('Respect quiet hours after 10 PM', 'Giữ yên lặng sau 22:00')];

  return (
    <section className="space-y-4 rounded-xl border bg-white p-5">
      <h2 className="text-xl font-semibold">{tv('Property policies', 'Chính sách chỗ ở')}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">{tv('Check-in', 'Nhận phòng')}</p>
          <p className="text-sm text-slate-600">{homestay.checkInWindow || tv('14:00 - 22:00', '14:00 - 22:00')}</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">{tv('Check-out', 'Trả phòng')}</p>
          <p className="text-sm text-slate-600">{homestay.checkOutWindow || tv('08:00 - 12:00', '08:00 - 12:00')}</p>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold text-slate-900">{tv('Cancellation policy', 'Chính sách hủy')}</p>
        <p className="text-sm text-slate-600">{homestay.cancellationPolicy || tv('Free cancellation within 24 hours.', 'Miễn phí hủy trong vòng 24 giờ.')}</p>
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold text-slate-900">{tv('House rules', 'Nội quy')}</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
          {rules.map((rule) => <li key={rule}>{rule}</li>)}
        </ul>
      </div>
    </section>
  );
};

export default PropertyPolicies;
