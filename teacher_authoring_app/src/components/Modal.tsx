import { type ReactNode, useEffect, useId } from 'react';
import Icon from './Icon.tsx';

/**
 * A dialog over the page, used for every "create" and "edit" form (lesson, module, class, student).
 * Esc or a click outside closes it.
 */
export default function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const titleId = useId();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: clicking the dimmed backdrop closes the dialog (Esc also does)
    // biome-ignore lint/a11y/useKeyWithClickEvents: Esc is handled on window above
    <div
      className="modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`modal-card form-modal${wide ? ' wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="form-modal-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-btn icon-btn-quiet" aria-label="Fechar" onClick={onClose}>
            <Icon name="x" size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
