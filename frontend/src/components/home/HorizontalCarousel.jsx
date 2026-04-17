import { useRef } from 'react';

const HorizontalCarousel = ({ title, subtitle, rightSlot, children }) => {
  const ref = useRef(null);

  const scrollByDir = (dir) => {
    ref.current?.scrollBy({ left: dir * 340, behavior: 'smooth' });
  };

  return (
    <section className="py-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 md:text-[26px]">{title}</h2>
          {subtitle ? <p className="mt-1 max-w-2xl text-slate-400">{subtitle}</p> : null}
        </div>
        {rightSlot}
      </div>
      <div className="relative">
        <div
          ref={ref}
          className="flex gap-4 overflow-x-auto scroll-smooth pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory"
        >
          {children}
        </div>
        <button
          type="button"
          aria-label="Xem thêm"
          onClick={() => scrollByDir(1)}
          className="absolute right-0 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-[#1d232b] text-lg text-[#8ad7f5] shadow-md transition-transform duration-200 [transform-style:preserve-3d] hover:bg-[#252c36] hover:[transform:perspective(500px)_translateY(-50%)_translateZ(12px)_scale(1.05)] md:flex"
        >
          →
        </button>
      </div>
    </section>
  );
};

export default HorizontalCarousel;
