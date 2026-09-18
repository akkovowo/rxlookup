import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

function easeOut(t: number) {
  return 1 - (1 - t) ** 3;
}

export function useCountUp(
  target: number,
  { duration = 920, delay = 0 }: { duration?: number; delay?: number } = {},
) {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(0);

  useEffect(() => {
    const end = Number.isFinite(target) ? target : 0;
    if (reduce) {
      setValue(end);
      return;
    }
    setValue(0);
    let raf = 0;
    const wait = window.setTimeout(() => {
      const start = performance.now();
      function frame(now: number) {
        const t = Math.min(1, (now - start) / duration);
        setValue(end * easeOut(t));
        if (t < 1) raf = window.requestAnimationFrame(frame);
        else setValue(end);
      }
      raf = window.requestAnimationFrame(frame);
    }, delay);
    return () => {
      window.clearTimeout(wait);
      window.cancelAnimationFrame(raf);
    };
  }, [target, duration, delay, reduce]);

  return value;
}
