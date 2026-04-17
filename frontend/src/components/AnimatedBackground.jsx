import { useEffect, useRef, useState } from 'react';

const VIDEO_BACKGROUNDS = [
  {
    video: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=2200&q=80',
  },
  {
    video: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    image: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=2200&q=80',
  },
  {
    video: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    image: 'https://images.unsplash.com/photo-1473116763249-2faaef81ccda?w=2200&q=80',
  },
];

const AnimatedBackground = () => {
  const [index, setIndex] = useState(0);
  const [broken, setBroken] = useState(() => new Set());
  const videoRefs = useRef([]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIndex((i) => (i + 1) % VIDEO_BACKGROUNDS.length);
    }, 9000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    videoRefs.current.forEach((v, i) => {
      if (!v) return;
      if (i === index) {
        const p = v.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } else {
        v.pause();
      }
    });
  }, [index]);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {VIDEO_BACKGROUNDS.map((item, i) => (
        <div
          key={item.video}
          className={`absolute inset-0 transition-opacity duration-[1800ms] ${
            i === index ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {broken.has(i) ? (
            <img src={item.image} alt="" className="h-full w-full scale-105 object-cover" />
          ) : (
            <video
              ref={(el) => {
                videoRefs.current[i] = el;
              }}
              src={item.video}
              poster={item.image}
              className="h-full w-full scale-105 object-cover"
              autoPlay={i === 0}
              muted
              loop
              playsInline
              preload="auto"
              onError={() =>
                setBroken((prev) => {
                  const next = new Set(prev);
                  next.add(i);
                  return next;
                })
              }
            />
          )}
        </div>
      ))}
      <div className="absolute inset-0 bg-[#090f15]/45" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,8,12,0.22)_0%,rgba(7,11,16,0.42)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(86,175,214,0.16),transparent_35%),radial-gradient(circle_at_80%_20%,rgba(35,87,132,0.14),transparent_30%)]" />
    </div>
  );
};

export default AnimatedBackground;
