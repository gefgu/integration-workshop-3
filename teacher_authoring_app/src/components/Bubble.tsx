import Mascot from '../mascot/Mascot.tsx';

const TONE_BG = {
  erro: 'var(--color-accent-200)',
  ok: 'var(--color-accent-2-200)',
  obs: 'var(--color-neutral-200)',
  info: 'var(--color-neutral-100)',
};
const TONE_INK = {
  erro: 'var(--color-accent-800)',
  ok: 'var(--color-accent-2-800)',
  obs: 'var(--color-neutral-800)',
  info: 'var(--color-neutral-800)',
};

/** Mascote + balão de fala colorido pelo tom da mensagem. */
export default function Bubble({ kind = 'fox', tone = 'info', message }) {
  return (
    <div style={{ width: '100%', maxWidth: 720, display: 'flex', alignItems: 'center', gap: 16 }}>
      <Mascot kind={kind} message={message} size={80} />
      <div style={{ position: 'relative', flex: 1 }}>
        <div
          style={{
            position: 'absolute',
            left: -9,
            top: 22,
            width: 0,
            height: 0,
            borderTop: '9px solid transparent',
            borderBottom: '9px solid transparent',
            borderRight: `11px solid ${TONE_BG[tone]}`,
          }}
        />
        <div
          style={{
            background: TONE_BG[tone],
            color: TONE_INK[tone],
            borderRadius: 22,
            padding: '12px 18px',
            fontSize: 14,
            lineHeight: 1.45,
            minHeight: 52,
          }}
        >
          {message}
        </div>
      </div>
    </div>
  );
}
