import { useEffect, useState } from 'react';

/**
 * Shows the `data-tip` of the hovered or focused `.has-tip` element in a fixed layer above the page, kept inside the
 * window. A CSS ::after tip would be cut by any box that scrolls or hides its overflow.
 */
export default function TipLayer() {
  const [tip, setTip] = useState<{ text: string; x: number; y: number; up: boolean } | null>(null);

  useEffect(() => {
    let current: HTMLElement | null = null;
    const show = (event: Event) => {
      const el = (event.target as HTMLElement | null)?.closest?.('.has-tip[data-tip]') as HTMLElement | null;
      if (!el || el === current) return;
      current = el;
      const r = el.getBoundingClientRect();
      const up = el.classList.contains('tip-up') || r.bottom + 40 > window.innerHeight;
      setTip({ text: el.dataset.tip ?? '', x: r.left + r.width / 2, y: up ? r.top - 8 : r.bottom + 8, up });
    };
    const hide = (event: Event) => {
      const next = (event as MouseEvent).relatedTarget as HTMLElement | null;
      if (current && next && current.contains(next)) return;
      current = null;
      setTip(null);
    };
    const clear = () => {
      current = null;
      setTip(null);
    };
    document.addEventListener('mouseover', show);
    document.addEventListener('focusin', show);
    document.addEventListener('mouseout', hide);
    document.addEventListener('focusout', hide);
    window.addEventListener('scroll', clear, true);
    document.addEventListener('mousedown', clear);
    return () => {
      document.removeEventListener('mouseover', show);
      document.removeEventListener('focusin', show);
      document.removeEventListener('mouseout', hide);
      document.removeEventListener('focusout', hide);
      window.removeEventListener('scroll', clear, true);
      document.removeEventListener('mousedown', clear);
    };
  }, []);

  if (!tip?.text) return null;
  return (
    <div
      className="tip-layer"
      role="tooltip"
      ref={(node) => {
        if (!node) return;
        // keep the whole tip inside the window
        const w = node.offsetWidth;
        const left = Math.min(Math.max(8, tip.x - w / 2), window.innerWidth - w - 8);
        node.style.left = `${left}px`;
        node.style.top = tip.up ? `${tip.y - node.offsetHeight}px` : `${tip.y}px`;
      }}
      style={{ left: -9999, top: -9999 }}
    >
      {tip.text}
    </div>
  );
}
