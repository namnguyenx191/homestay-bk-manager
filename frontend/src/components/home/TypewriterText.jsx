import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const CHAR_MS = 26;

/** Subtitle-style typewriter; restarts when `text` changes (e.g. language). Optional `onComplete` when full line is shown. */
const TypewriterText = ({ text, className = '', onComplete }) => {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  const onCompleteRef = useRef(onComplete);

  useLayoutEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!text) {
      setDisplayed('');
      setDone(true);
      return undefined;
    }

    setDisplayed('');
    setDone(false);
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      if (i > text.length) {
        window.clearInterval(id);
        setDisplayed(text);
        setDone(true);
        onCompleteRef.current?.();
        return;
      }
      setDisplayed(text.slice(0, i));
    }, CHAR_MS);

    return () => window.clearInterval(id);
  }, [text]);

  return (
    <span className={className} aria-live="polite">
      {displayed}
      <span
        className={`ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[0.12em] align-middle bg-current ${
          done ? 'animate-pulse opacity-90' : 'opacity-100'
        }`}
        aria-hidden
      />
    </span>
  );
};

export default TypewriterText;
