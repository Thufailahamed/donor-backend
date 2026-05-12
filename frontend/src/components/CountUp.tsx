'use client';

import { useEffect, useRef, useState } from 'react';

interface CountUpProps {
  to: number;
  duration?: number; // ms
  delay?: number;    // ms
}

export default function CountUp({ to, duration = 1200, delay = 0 }: CountUpProps) {
  const [value, setValue] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (to === 0) return;
    const timeout = setTimeout(() => {
      started.current = true;
      const startTime = performance.now();
      const tick = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        setValue(Math.round(eased * to));
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, delay);
    return () => clearTimeout(timeout);
  }, [to, duration, delay]);

  return <>{value}</>;
}
