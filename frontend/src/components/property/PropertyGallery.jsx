import { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { fallbackImageByIndex, fallbackImageByString } from '../../utils/fallbackMedia';

const PropertyGallery = ({ images = [], title }) => {
  const { tv } = useLanguage();
  const [previewOpen, setPreviewOpen] = useState(false);
  const base = fallbackImageByString(title);
  const list = images.length ? images : [base, fallbackImageByIndex(1), fallbackImageByIndex(2), fallbackImageByIndex(3)];
  const hero = list[0];
  const thumbs = list.slice(1, 5);

  return (
    <section className="space-y-2">
      <div className="grid gap-2 md:grid-cols-4">
        <img src={hero} alt={title} className="h-72 w-full rounded-xl object-cover md:col-span-2 md:h-[28rem]" />
        <div className="grid grid-cols-2 gap-2 md:col-span-2">
          {thumbs.map((img) => (
            <img key={img} src={img} alt={title} className="h-36 w-full rounded-xl object-cover md:h-[13.8rem]" />
          ))}
          {!thumbs.length && (
            <img src={fallbackImageByIndex(4)} alt={title} className="col-span-2 h-36 w-full rounded-xl object-cover md:h-[13.8rem]" />
          )}
        </div>
      </div>

      <button onClick={() => setPreviewOpen(true)} className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50">
        Show all photos
      </button>

      {previewOpen && (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-black/75 p-4" onClick={() => setPreviewOpen(false)}>
          <div className="mx-auto max-w-6xl rounded-xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">{title} {tv('photos', 'ảnh')}</h3>
              <button onClick={() => setPreviewOpen(false)} className="rounded border px-3 py-1 text-sm">{tv('Close', 'Đóng')}</button>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {list.map((img) => (
                <img key={img} src={img} alt={title} className="h-52 w-full rounded-lg object-cover" />
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default PropertyGallery;
