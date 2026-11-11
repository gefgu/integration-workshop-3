import { createContext, type ReactNode, useContext, useEffect, useRef } from 'react';
import { buzzerSound, statusLedOn } from '../engine/lab.ts';
import { NOMES } from '../engine/sim.ts';
import type { LessonSettings, Piece } from '../model/types.ts';
import { isEnergizeKey, useBenchMode, useLiveBoard } from '../player/benchMode.ts';
import type { Lab } from '../player/useLab.ts';
import BoardWorkspace from './BoardWorkspace.tsx';
import CapsuleLegend from './CapsuleLegend.tsx';
import CircuitWorkspace from './CircuitWorkspace.tsx';
import Icon from './Icon.tsx';

/** True where the board should shrink to its box instead of making the page scroll (the teacher's validator). */
export const BoardFitContext = createContext(false);

/** Bench: the power switch is a physical button; the screen shows its state and where to press. */
function PowerIndicator({ on, locked = false }: { on: boolean; locked?: boolean }) {
  if (locked) {
    return (
      <div className="power-indicator locked" role="status">
        <span className="power-indicator-dot" aria-hidden="true">
          <Icon name="lock" size={24} />
        </span>
        <span>
          <strong>Energizar bloqueado</strong>
          <small>Libera quando a montagem estiver completa</small>
        </span>
      </div>
    );
  }
  return (
    <div className={`power-indicator${on ? ' on' : ''}`} role="status" data-pad="energize">
      <span className="power-indicator-dot" aria-hidden="true">
        <Icon name="power" size={26} />
      </span>
      <span>
        <strong>{on ? 'Energizada' : 'Desligada'}</strong>
        <small>{on ? 'Aperte ENERGIZAR (Enter) para desligar' : 'Aperte ENERGIZAR (Enter)'}</small>
      </span>
    </div>
  );
}

/** The bench's power switch: the most visible control on a lab screen. */
export function PowerButton({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`power-btn${on ? ' on' : ''}`} aria-pressed={on} onClick={onClick}>
      <Icon name="power" size={22} />
      {on ? 'Desligar' : 'Energizar'}
    </button>
  );
}

const mA = (n: number) => n.toFixed(1).replace('.', ',');

/** The bench's built-in status LED (lesson 1). Drawn by the software: no hardware was read. */
function StatusLed({ on }: { on: boolean }) {
  const bench = useBenchMode();
  if (bench) {
    return (
      <div role="status" className="bench-status-led">
        <span aria-hidden="true" className={on ? 'on' : ''} />
        LED de status: <strong>{on ? 'aceso' : 'apagado'}</strong>
      </div>
    );
  }
  return (
    <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
      <span
        aria-hidden="true"
        style={{
          width: 18,
          height: 18,
          borderRadius: 999,
          background: on ? '#4fd36b' : '#59635a',
          boxShadow: on ? '0 0 14px 4px rgba(79,211,107,.7)' : 'inset 0 2px 3px rgba(0,0,0,.5)',
        }}
      />
      <span>
        <strong>LED de status da bancada:</strong>{' '}
        {on ? 'aceso — a bateria foi reconhecida' : 'apagado — nenhuma bateria encaixada'}{' '}
        <em style={{ color: 'var(--color-neutral-600)' }}>(simulado na tela)</em>
      </span>
    </div>
  );
}

/**
 * A playable bench: the board plus the power switch, button holds, readout and explanations.
 * `lab` comes from `useLab(pieces, settings)`.
 */
export default function LabBoard({
  lab,
  pieces,
  setPieces,
  settings,
  hideTray = false,
  extra,
  energizeLocked = false,
}: {
  lab: Lab;
  pieces: Piece[];
  setPieces: (next: Piece[]) => void;
  settings?: LessonSettings;
  hideTray?: boolean;
  extra?: ReactNode;
  /** bench, guided assembly steps: the board is only powered on the step that closes the circuit */
  energizeLocked?: boolean;
}) {
  const fit = useContext(BoardFitContext);
  const bench = useBenchMode();
  const live = useLiveBoard();
  // The bench's physical Energizar button arrives as the "e" key.
  const toggle = useRef(lab.toggle);
  toggle.current = lab.toggle;
  useEffect(() => {
    if (!bench || energizeLocked) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (isEnergizeKey(event) && !(event.target instanceof HTMLInputElement)) toggle.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [bench, energizeLocked]);
  const Workspace = fit ? CircuitWorkspace : BoardWorkspace;
  const buttons = pieces.filter((p) => p.type === 'botao');
  const loads = lab.diag.loadsLit;
  let readout = 'Bancada desligada';
  if (lab.fading) readout = `Descarregando o capacitor: ${mA(lab.ledMa)} mA no LED, caindo…`;
  else if (lab.energized && lab.lit) {
    const where = loads[0] === 'buzzer' ? 'no buzzer' : 'no LED';
    const currents = lab.diag.currents;
    readout =
      loads.length > 1 && currents
        ? `LED: ${mA(currents.led ?? 0)} mA · buzzer: ${mA(currents.buzzer ?? 0)} mA`
        : `${mA(lab.ledMa)} mA ${where}`;
    // Without a resistor the real current would be far above this: say the bench is holding it back.
    if (lab.diag.limited) readout += ' (limite da simulação)';
  } else if (lab.energized && lab.blinkOff) readout = 'Contato instável: a luz pisca';
  else if (lab.energized) readout = 'Sem corrente';
  return (
    <>
      {settings?.statusLed && <StatusLed on={statusLedOn(pieces)} />}
      {lab.alarm && (
        <div
          role="alert"
          style={{
            maxWidth: 720,
            padding: '10px 14px',
            borderRadius: 14,
            background: 'var(--color-accent-200)',
            border: '2px solid var(--color-accent-700)',
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          ⚠ {lab.alarm}
        </div>
      )}
      <Workspace
        pieces={pieces}
        onChange={setPieces}
        trail={lab.trail}
        ledMa={lab.ledMa}
        readings={lab.cap.readings}
        pressed={lab.held}
        onPress={lab.press}
        onReseat={lab.onReseat}
        trayTypes={hideTray ? [] : (settings?.tray ?? null)}
        fit={fit}
        readOnly={live}
        guideTray={live && !hideTray}
      />
      {extra}
      <CapsuleLegend pieces={pieces} readings={lab.cap.readings} />
      <details hidden={bench} className="panel lab-help" style={{ maxWidth: 720, width: '100%', textAlign: 'left' }}>
        <summary>Entenda a bancada e as telas</summary>
        <p>
          Cada coluna tem <strong>dois nós</strong>: um no banco de cima (A) e outro no de baixo (B). Os 6 furos da
          mesma linha vertical, dentro de um banco, já estão ligados entre si. A abertura central separa A de B, mesmo
          com o mesmo número de coluna.
        </p>
        <p>
          Para um LED acender, a corrente precisa percorrer um caminho fechado do + ao − da bateria. O resistor limita a
          corrente; a orientação do LED também importa.
        </p>
        <p>
          mA significa <em>miliampère</em>, um milésimo de ampère: é quanta corrente passa. Esta tela é uma simulação:
          os valores e efeitos mostrados não são medições da bancada física.
        </p>
        <p>
          <strong>V</strong> (volt) é a “força” com que a bateria empurra a corrente; <strong>Ω</strong> (ohm) mede
          quanto uma peça atrapalha a passagem; <strong>µF</strong> (microfarad) é o tamanho do “tanque” de um
          capacitor. Os encaixes tracejados <strong>E1–E6</strong> são para as cápsulas inteligentes, que aparecem em
          lições mais adiante.
        </p>
      </details>
      <div
        className="power-row"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}
      >
        {bench ? (
          <PowerIndicator on={lab.energized} locked={energizeLocked} />
        ) : (
          <PowerButton on={lab.energized} onClick={lab.toggle} />
        )}
        <span
          role="status"
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: lab.lit ? 'var(--color-accent-2-700)' : 'var(--color-neutral-600)',
          }}
        >
          {readout}
        </span>
        {lab.diag.code === 'valido' && lab.energized && lab.diag.limited && (
          <span style={{ fontSize: 13 }}>
            ⚠ resistência ausente ou pequena demais: o modelo simulado limita a corrente a 15 mA. Isso não comprova
            proteção na bancada física.
          </span>
        )}
        {lab.diag.code === 'valido' && lab.energized && !lab.diag.limited && !pieces.some((p) => p.loose) && (
          <span style={{ fontSize: 13 }}>circuito fechado ✓</span>
        )}
        {lab.diag.code === 'valido' && lab.energized && pieces.some((p) => p.loose) && (
          <span style={{ fontSize: 13 }}>⚠ há uma peça mal encaixada</span>
        )}
        {lab.lastFade && (
          <span style={{ fontSize: 13 }}>
            Última descarga: o LED levou {lab.lastFade.seconds.toFixed(1).replace('.', ',')} s para apagar, com{' '}
            {lab.lastFade.microFarads} µF (modelo simulado).
          </span>
        )}
      </div>
      {pieces.some((p) => p.type === 'buzzer') && (
        <p role="status">
          Som simulado: volume{' '}
          {Math.round(buzzerSound(lab.energized ? (lab.diag.currents?.buzzer ?? 0) : 0).volume * 100)}% · tom{' '}
          {buzzerSound(lab.energized ? (lab.diag.currents?.buzzer ?? 0) : 0).hz} Hz. O comportamento do buzzer físico
          ainda não foi medido.
        </p>
      )}
      {pieces.some((p) => p.type === 'buzzer') && (
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <input type="checkbox" checked={lab.soundOn} onChange={(e) => lab.setSoundOn(e.target.checked)} />
          Som simulado do buzzer (modelo didático, não é gravação nem medição)
        </label>
      )}
      {buttons.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
          <span style={{ fontSize: 13 }}>Botões (segure o botão na bancada ou use estes controles):</span>
          {buttons.map((b, i) => (
            <button
              key={b.id}
              type="button"
              className={lab.held.has(b.id) ? 'btn-primary' : 'btn-outline'}
              aria-pressed={lab.held.has(b.id)}
              onClick={() => lab.toggleHold(b.id)}
            >
              {buttons.length > 1 ? `Botão ${String.fromCharCode(65 + i)}` : NOMES.botao}:{' '}
              {lab.held.has(b.id) ? 'apertado' : 'solto'}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
