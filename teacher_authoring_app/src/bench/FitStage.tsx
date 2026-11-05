import { type ReactNode, useLayoutEffect, useRef, useState } from 'react';

/**
 * The bench monitor is 1024×600 with touch and no scrolling: every screen must show whole. FitStage lays its
 * content out at the stage width and, when it is taller (or wider) than the stage, scales it down to fit,
 * widening the layout as it shrinks so wide screens (tray + board) use the full width. `minScale` keeps text
 * from becoming unreadable; below it the stage clips rather than scrolls.
 */
export default function FitStage({ children, minScale = 0.5 }: { children: ReactNode; minScale?: number }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ scale: 1, width: 0 });

  useLayoutEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return undefined;
    const measure = () => {
      const W = o.clientWidth;
      const H = o.clientHeight;
      if (!W || !H) return;
      // Largest scale at which the content, laid out at width W/scale, fits in H/scale. Smaller scales give the
      // layout more room both ways, so fitting is monotonic and a binary search finds it.
      const fits = (scale: number) => {
        i.style.width = `${W / scale}px`;
        return i.scrollHeight <= H / scale + 1 && i.scrollWidth <= W / scale + 1;
      };
      let scale = 1;
      if (!fits(1)) {
        let lo = minScale;
        let hi = 1;
        for (let n = 0; n < 8; n++) {
          const mid = (lo + hi) / 2;
          if (fits(mid)) lo = mid;
          else hi = mid;
        }
        scale = lo;
      }
      const width = W / scale;
      i.style.width = `${width}px`;
      setFit((prev) =>
        Math.abs(prev.scale - scale) < 0.005 && Math.abs(prev.width - width) < 1 ? prev : { scale, width }
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(o);
    // The content's own height changes with every screen, step and message.
    observer.observe(i);
    const mutations = new MutationObserver(measure);
    mutations.observe(i, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      mutations.disconnect();
    };
  }, [minScale]);

  return (
    <div ref={outer} className="fit-stage">
      <div
        ref={inner}
        className="fit-stage-inner"
        style={{ width: fit.width || undefined, transform: `scale(${fit.scale})` }}
      >
        {children}
      </div>
    </div>
  );
}
