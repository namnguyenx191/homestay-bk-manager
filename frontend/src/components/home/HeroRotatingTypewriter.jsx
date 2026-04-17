import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TypewriterText from './TypewriterText';

const PAUSE_AFTER_LINE_MS = 2600;

/** Cycles through SEO subtitle lines with typewriter + pause between lines. */
const HeroRotatingTypewriter = ({ lines, className = '' }) => {
  const safeLines = useMemo(() => (Array.isArray(lines) ? lines.filter(Boolean) : []), [lines]);
  const linesKey = safeLines.join('\u0001');
  const [index, setIndex] = useState(0);
  const timeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  const scheduleNext = useCallback(() => {
    if (safeLines.length <= 1) return;
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      setIndex((i) => (i + 1) % safeLines.length);
      timeoutRef.current = null;
    }, PAUSE_AFTER_LINE_MS);
  }, [safeLines]);

  useEffect(() => {
    setIndex(0);
  }, [linesKey]);

  if (!safeLines.length) return null;

  const current = safeLines[index % safeLines.length];

  return (
    <TypewriterText text={current} className={className} onComplete={safeLines.length > 1 ? scheduleNext : undefined} />
  );
};

export default HeroRotatingTypewriter;
