import { CAPSULE, DEFS, POT_DEFAULT, formatOhms } from '../engine/sim.js';

/**
 * Visual for one component, sized to `width` × `height`. Used on the board, tray and drag ghost.
 * Capsule colors follow MFR10; the black dots on top follow MFR11.
 *  - fill: jumpers take the full `height` (on the board they cover the whole square sockets)
 *  - lit: LED glows / buzzer pulses
 *  - value + onPotStep(±1): potentiometer setting with −/+ buttons
 *  - pressed + onButton(down): pushbutton cap that can be held down
 */
export default function PieceView({
  type, width, height = 28, fill = false, lit = false, brilho = 1, pins = true, reversed = false,
  value, onPotStep, pressed = false, onButton, style
}) {
  const d = DEFS[type];
  const c = CAPSULE[d.cor];
  const isLed = type === 'led';
  const isJumper = type.startsWith('jumper');
  const h = isJumper && !fill ? 12 : height;
  const base = {
    width, height: h, background: c.bg, color: c.ink,
    borderRadius: isLed ? (reversed ? '18px 8px 8px 18px' : '8px 18px 18px 8px') : (isJumper ? 6 : 10),
    boxShadow: 'inset 0 2px 0 rgba(255,255,255,.34), inset 0 -3px 0 rgba(0,0,0,.28)',
    border: d.cor === 'branco' ? '1px solid #b9b2a4' : 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, fontWeight: 700, position: 'relative', ...style
  };
  if (lit && (isLed || type === 'buzzer')) {
    base.background = 'linear-gradient(180deg,#7fe08f,#3f9b4f)';
    base.boxShadow += `, 0 0 ${14 + 26 * brilho}px rgba(110,230,130,${0.5 + 0.4 * brilho})`;
  }

  return (
    <div style={base}>
      {d.dots && !isJumper && <Dots n={d.dots} />}
      {type === 'potenciometro' ? (
        <PotFace value={value || POT_DEFAULT} onStep={onPotStep} />
      ) : type === 'botao' ? (
        <ButtonCap pressed={pressed} onChange={onButton} />
      ) : (
        <span style={type === 'buzzer' && lit ? { animation: 'pulse .5s ease-in-out infinite alternate' } : undefined}>{d.text}</span>
      )}
      {isLed && <span style={{ position: 'absolute', [reversed ? 'left' : 'right']: 6, top: 3, bottom: 3, width: 4, background: '#f5ead8', borderRadius: 2, opacity: 0.8 }} />}
      {pins && d.pinA && <Pin side="left" label={reversed ? d.pinB : d.pinA} bg={type === 'bateria' ? (reversed ? '#8b9096' : '#f5ead8') : '#fff'} />}
      {pins && d.pinB && <Pin side="right" label={reversed ? d.pinA : d.pinB} bg={type === 'bateria' ? (reversed ? '#f5ead8' : '#8b9096') : '#fff'} />}
    </div>
  );
}

/** 1–4 black dots printed on top of the capsule (MFR11). */
function Dots({ n }) {
  return (
    <span aria-label={`${n} pontos`} style={{ position: 'absolute', top: 2, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 3, pointerEvents: 'none' }}>
      {Array.from({ length: n }).map((_, i) => <i key={i} style={{ width: 5, height: 5, borderRadius: 999, background: '#111' }} />)}
    </span>
  );
}

function PotFace({ value, onStep }) {
  const btn = { border: 0, background: 'rgba(0,0,0,.18)', color: 'inherit', borderRadius: 4, width: 14, height: 14, lineHeight: 1, fontSize: 11, fontWeight: 700, padding: 0, cursor: onStep ? 'pointer' : 'default' };
  const stop = (e) => e.stopPropagation();
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 5, fontSize: 10 }}>
      {onStep && <button style={btn} onPointerDown={stop} onClick={() => onStep(-1)} aria-label="Diminuir resistência">−</button>}
      {formatOhms(value)}
      {onStep && <button style={btn} onPointerDown={stop} onClick={() => onStep(1)} aria-label="Aumentar resistência">+</button>}
    </span>
  );
}

/** Round cap: hold the pointer on it to press; releasing anywhere lets go. */
function ButtonCap({ pressed, onChange }) {
  function down(e) {
    if (!onChange) return;
    e.stopPropagation();
    e.preventDefault();
    onChange(true);
    const up = () => { onChange(false); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointerup', up);
  }
  return (
    <span
      onPointerDown={down}
      role={onChange ? 'button' : undefined}
      aria-pressed={onChange ? pressed : undefined}
      aria-label="Botão: segure para fechar o circuito"
      style={{
        marginTop: 5, width: 16, height: 16, borderRadius: 999, background: pressed ? '#b8870f' : '#f3cf5a',
        boxShadow: pressed ? 'inset 0 2px 3px rgba(0,0,0,.5)' : 'inset 0 -2px 0 rgba(0,0,0,.3), 0 1px 2px rgba(0,0,0,.35)',
        cursor: onChange ? 'pointer' : 'inherit'
      }}
    />
  );
}

function Pin({ side, label, bg }) {
  return (
    <span style={{
      position: 'absolute', [side]: -6, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, borderRadius: 999,
      background: bg, color: '#22201f', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 1px 2px rgba(0,0,0,.3)'
    }}>{label}</span>
  );
}
