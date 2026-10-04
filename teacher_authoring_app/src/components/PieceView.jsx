import { DEFS } from '../engine/sim.js';

/** Visual for one component, sized to `width` × `height`. Used on the board, tray and drag ghost. */
export default function PieceView({ type, width, height = 28, lit = false, brilho = 1, pins = true, reversed = false, style }) {
  const d = DEFS[type];
  const isLed = type === 'led';
  const isJumper = type.startsWith('jumper');
  const h = isJumper ? 12 : height;
  const base = {
    width, height: h, background: d.color, color: d.ink,
    borderRadius: isLed ? (reversed ? '18px 8px 8px 18px' : '8px 18px 18px 8px') : (isJumper ? 6 : 10),
    boxShadow: 'inset 0 2px 0 rgba(255,255,255,.34), inset 0 -3px 0 rgba(0,0,0,.28)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, fontWeight: 700, position: 'relative', ...style
  };
  if (isLed && lit) {
    base.background = 'linear-gradient(180deg,#ff6b5e,#e0453a)';
    base.boxShadow += `, 0 0 ${14 + 26 * brilho}px rgba(255,90,70,${0.5 + 0.4 * brilho})`;
  }
  return (
    <div style={base}>
      {d.text}
      {isLed && <span style={{ position: 'absolute', [reversed ? 'left' : 'right']: 6, top: 3, bottom: 3, width: 4, background: '#f5ead8', borderRadius: 2, opacity: 0.8 }} />}
      {pins && d.pinA && <Pin side="left" label={reversed ? d.pinB : d.pinA} bg={type === 'bateria' ? (reversed ? '#8b9096' : '#f5ead8') : '#fff'} fg="#22201f" />}
      {pins && d.pinB && <Pin side="right" label={reversed ? d.pinA : d.pinB} bg={type === 'bateria' ? (reversed ? '#f5ead8' : '#8b9096') : '#fff'} fg="#22201f" />}
    </div>
  );
}

function Pin({ side, label, bg, fg }) {
  return (
    <span style={{
      position: 'absolute', [side]: -6, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, borderRadius: 999,
      background: bg, color: fg, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 1px 2px rgba(0,0,0,.3)'
    }}>{label}</span>
  );
}
