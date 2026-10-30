import type { ReactNode } from 'react';
import { statusLedOn } from '../engine/lab.ts';
import { NOMES } from '../engine/sim.ts';
import type { Lab } from '../player/useLab.ts';
import type { LessonSettings, Piece } from '../model/types.ts';
import BoardWorkspace from './BoardWorkspace.tsx';
import CapsuleLegend from './CapsuleLegend.tsx';

const mA = (n: number) => n.toFixed(1).replace('.', ',');

/** The bench's built-in status LED (lesson 1). Drawn by the software: no hardware was read. */
function StatusLed({ on }: { on: boolean }) {
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
}: {
  lab: Lab;
  pieces: Piece[];
  setPieces: (next: Piece[]) => void;
  settings?: LessonSettings;
  hideTray?: boolean;
  extra?: ReactNode;
}) {
  const buttons = pieces.filter((p) => p.type === 'botao');
  const loads = lab.diag.loadsLit;
  let readout = 'Bancada desligada';
  if (lab.fading) readout = `Descarregando o capacitor: ${mA(lab.ledMa)} mA no LED, caindo…`;
  else if (lab.energized && lab.lit) {
    const where = loads.length > 1 ? 'no LED e no buzzer (cada ramo)' : loads[0] === 'buzzer' ? 'no buzzer' : 'no LED';
    readout = `${mA(lab.ledMa)} mA ${where}`;
    // Without a resistor the real current would be far above this: say the bench is holding it back.
    if (lab.diag.limited) readout += ' (limitada pela bancada)';
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
      <BoardWorkspace
        pieces={pieces}
        onChange={setPieces}
        trail={lab.trail}
        ledMa={lab.ledMa}
        readings={lab.cap.readings}
        pressed={lab.held}
        onPress={lab.press}
        onReseat={lab.onReseat}
        trayTypes={hideTray ? [] : (settings?.tray ?? null)}
      />
      {extra}
      <CapsuleLegend pieces={pieces} readings={lab.cap.readings} />
      <details className="panel" style={{ maxWidth: 720, width: '100%', textAlign: 'left' }}>
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={lab.toggle}
          style={{
            border: 0,
            cursor: 'pointer',
            fontFamily: 'var(--font-heading)',
            fontSize: 16,
            padding: '14px 30px',
            borderRadius: 999,
            background: lab.energized ? 'var(--color-neutral-700)' : 'var(--color-accent)',
            color: 'var(--color-bg)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          {lab.energized ? 'Desligar' : 'Energizar'}
        </button>
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
            ⚠ circuito fechado, mas sem resistor: a bancada está segurando a corrente. Um LED sozinho, sem esse limite,
            poderia queimar.
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
