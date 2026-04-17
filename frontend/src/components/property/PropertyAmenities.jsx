import { useLanguage } from '../../context/LanguageContext';

const PropertyAmenities = ({ amenities = [] }) => {
  const { tv } = useLanguage();
  const list = amenities.length ? amenities : [tv('WiFi', 'WiFi'), tv('Air conditioning', 'Điều hòa'), tv('Private bathroom', 'Phòng tắm riêng'), tv('Parking', 'Chỗ đỗ xe')];

  return (
    <section className="space-y-3 rounded-xl border bg-white p-5">
      <h2 className="text-xl font-semibold">{tv('Popular facilities', 'Tiện nghi phổ biến')}</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {list.map((item) => (
          <div key={item} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">{item}</div>
        ))}
      </div>
    </section>
  );
};

export default PropertyAmenities;
