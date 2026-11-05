import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

/** One stop of a guided tour: the element to highlight (CSS selectors, first visible match) and what it does. */
export interface TourStep {
  /** omitted = a centred card (introduction or closing) */
  target?: string | string[];
  title: string;
  text: string;
}

const PAD = 8;
const CARD_W = 360;

function visible(selectors: string | string[] | undefined): HTMLElement | null {
  if (!selectors) return null;
  for (const selector of Array.isArray(selectors) ? selectors : [selectors]) {
    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden') return el;
    }
  }
  return null;
}

/**
 * Guided tour: dims the page, cuts a spotlight around each element in turn and explains it in a card with
 * Pular / Voltar / Próximo. Steps whose element is not on the page are left out. Keys: → or Enter = next,
 * ← = back, Esc = skip (the bench joystick sends the same keys).
 */
export default function Tour({
  steps,
  onClose,
  className = '',
  cardWidth = CARD_W,
}: {
  steps: TourStep[];
  onClose: () => void;
  className?: string;
  cardWidth?: number;
}) {
  // Decide once, when the tour opens, which steps apply to this page.
  const usable = useMemo(() => steps.filter((s) => !s.target || visible(s.target)), [steps]);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const card = useRef<HTMLElement>(null);
  const [cardH, setCardH] = useState(220);
  const step = usable[index];
  const last = index === usable.length - 1;

  const next = useCallback(() => (last ? onClose() : setIndex((i) => i + 1)), [last, onClose]);
  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  // Follow the highlighted element (it may move while the page scrolls or resizes).
  useLayoutEffect(() => {
    let el = visible(step?.target);
    if (!el) {
      setRect(null);
      return undefined;
    }
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    let frame = 0;
    const measure = () => {
      // The page may re-render and replace the element: find it again.
      if (!el?.isConnected) el = visible(step?.target);
      if (!el) {
        setRect(null);
        frame = requestAnimationFrame(measure);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect((prev) =>
        prev && prev.top === r.top && prev.left === r.left && prev.width === r.width && prev.height === r.height
          ? prev
          : r
      );
      frame = requestAnimationFrame(measure);
    };
    measure();
    return () => cancelAnimationFrame(frame);
  }, [step]);

  // The tour owns the keyboard while it is open (capture phase: the page's own shortcuts do not fire).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const keys: Record<string, () => void> = {
        Escape: onClose,
        ArrowRight: next,
        ArrowDown: next,
        Enter: next,
        ArrowLeft: back,
        ArrowUp: back,
      };
      const action = keys[event.key];
      if (!action) return;
      event.preventDefault();
      event.stopPropagation();
      action();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [next, back, onClose]);

  // The card's real height decides where it fits.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-measure for each step
  useLayoutEffect(() => {
    if (card.current) setCardH(card.current.offsetHeight);
  }, [index]);

  if (!step) return null;

  // Card below the element when it fits, else above, else centred.
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(cardWidth, vw - 24);
  let cardStyle: React.CSSProperties = { width, left: (vw - width) / 2, top: vh / 2, transform: 'translateY(-50%)' };
  if (rect) {
    const gap = PAD + 12;
    const left = Math.min(Math.max(12, rect.left + rect.width / 2 - width / 2), vw - width - 12);
    const sideTop = Math.min(Math.max(12, rect.top), vh - cardH - 12);
    if (rect.bottom + gap + cardH <= vh - 8) cardStyle = { width, left, top: rect.bottom + gap };
    else if (rect.top - gap - cardH >= 8) cardStyle = { width, left, top: rect.top - gap - cardH };
    else if (rect.right + gap + width <= vw - 8) cardStyle = { width, left: rect.right + gap, top: sideTop };
    else if (rect.left - gap - width >= 8) cardStyle = { width, left: rect.left - gap - width, top: sideTop };
    else {
      // no free side: pin the card to the screen edge farther from the element's centre
      const below = rect.top + rect.height / 2 < vh / 2;
      cardStyle = { width, left, top: below ? vh - cardH - 12 : 12 };
    }
  }

  return (
    <div className={`tour ${className}`} role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {/* blocks the page; the spotlight's shadow dims everything around the element */}
      <div className="tour-block" />
      {rect ? (
        <div
          className="tour-spot"
          style={{
            left: rect.left - PAD,
            top: rect.top - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
          }}
        />
      ) : (
        <div className="tour-dim" />
      )}
      <section className="tour-card" style={cardStyle} ref={card}>
        <div className="tour-progress" aria-hidden="true">
          {usable.map((s, i) => (
            <span key={`${s.title}-${i}`} className={i === index ? 'active' : i < index ? 'done' : ''} />
          ))}
        </div>
        <h2 id="tour-title">{step.title}</h2>
        <p>{step.text}</p>
        <div className="tour-actions">
          <button type="button" className="tour-skip" onClick={onClose}>
            {last ? 'Fechar' : 'Pular tutorial'}
          </button>
          <span className="tour-count">
            {index + 1}/{usable.length}
          </span>
          {index > 0 && (
            <button type="button" className="btn-outline" onClick={back}>
              Voltar
            </button>
          )}
          <button type="button" className="btn-primary" onClick={next}>
            {last ? 'Concluir' : 'Próximo'}
          </button>
        </div>
      </section>
    </div>
  );
}

/** First visit of a page opens its tour once; the help button opens it again. Kept per browser. */
export function useFirstRunTour(key: string | null, enabled = true) {
  const storageKey = key ? `tedtronics-tour-${key}` : null;
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!storageKey || !enabled) return undefined;
    let seen = false;
    try {
      seen = localStorage.getItem(storageKey) === '1';
    } catch {
      seen = true; // storage blocked: do not insist
    }
    if (seen) return undefined;
    // let the page render its elements before measuring them
    const timer = setTimeout(() => setOpen(true), 700);
    return () => clearTimeout(timer);
  }, [storageKey, enabled]);
  const close = useCallback(() => {
    setOpen(false);
    try {
      if (storageKey) localStorage.setItem(storageKey, '1');
    } catch {
      /* ignore */
    }
  }, [storageKey]);
  return { open, start: () => setOpen(true), close };
}
