import { useCallback, useRef, useState } from 'react';

/**
 * Mouse-follow 3D tilt with perspective. Keeps motion subtle for accessibility.
 */
const TiltCard = ({
  children,
  className = '',
  innerClassName = '',
  intensity = 12,
  shine = true,
  disabled = false,
}) => {
  const wrapRef = useRef(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, active: false });

  const onMove = useCallback(
    (e) => {
      if (disabled) return;
      const el = wrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      setTilt({
        rx: Number((-py * intensity).toFixed(2)),
        ry: Number((px * intensity).toFixed(2)),
        active: true,
      });
    },
    [disabled, intensity]
  );

  const onLeave = useCallback(() => {
    setTilt({ rx: 0, ry: 0, active: false });
  }, []);

  return (
    <div
      ref={wrapRef}
      className={`tilt-3d-root ${className}`}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      <div
        className={`tilt-3d-inner h-full ${innerClassName}`}
        style={{
          transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) translateZ(${tilt.active ? 10 : 0}px)`,
        }}
      >
        {shine ? <span className="tilt-3d-shine pointer-events-none" aria-hidden /> : null}
        {children}
      </div>
    </div>
  );
};

export default TiltCard;
