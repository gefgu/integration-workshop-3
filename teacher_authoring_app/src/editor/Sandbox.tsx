import { useState } from 'react';
import { BoardSlotContext } from '../components/boardSlot.ts';
import CircuitWorkspace from '../components/CircuitWorkspace.tsx';
import Icon from '../components/Icon.tsx';
import { PowerButton } from '../components/LabBoard.tsx';
import { useCapsules } from '../components/useCapsules.ts';
import { mergeTrails } from '../engine/capsules.ts';
import { diagnose } from '../engine/diagnose.ts';
import type { Piece } from '../model/types.ts';
import BenchPreview from '../player/BenchPreview.tsx';

export default function Sandbox({ lesson, mode, onMode, onExit, notice = undefined }) {
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [pressed, setPressed] = useState<Set<string>>(() => new Set());
  const [energized, setEnergized] = useState(false);
  const [validated, setValidated] = useState(false);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const diag = diagnose(pieces, pressed);
  const capsules = useCapsules(pieces, pressed, energized);
  const valid = diag.code === 'valido';
  const lit = energized && (valid || !!capsules.driven);

  function onPress(id: string, down: boolean) {
    setPressed((current) => {
      const next = new Set(current);
      if (down) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function changePieces(next: Piece[]) {
    setPieces(next);
    setValidated(false);
  }

  // The Sandbox / Validator switch sits in the controls box of each mode, so it takes no row of its own.
  const modeToggle = (
    <nav className="sandbox-mode-toggle" aria-label="Modo do sandbox">
      <button type="button" className={mode === 'free' ? 'active' : ''} onClick={() => onMode('free')}>
        Sandbox livre
      </button>
      <button type="button" className={mode === 'lesson' ? 'active' : ''} onClick={() => onMode('lesson')}>
        Validador da lição
      </button>
    </nav>
  );

  return (
    <div className="sandbox-page">
      <section className="sandbox-free" style={{ display: mode === 'free' ? 'flex' : 'none' }}>
        <div className="lab-split">
          <div className="board-slot" ref={setSlot} />
          <div className="lab-right">
            <BoardSlotContext.Provider value={slot}>
              <CircuitWorkspace
                pieces={pieces}
                onChange={changePieces}
                trail={lit ? mergeTrails(valid ? diag.trail : null, capsules.driven) : null}
                ledMa={lit ? Math.max(valid ? diag.mA : 0, capsules.drivenMa) : 0}
                readings={capsules.readings}
                pressed={pressed}
                onPress={onPress}
                fit
              />
            </BoardSlotContext.Provider>
            {/* same box and place as the validator's controls, so the switch never moves */}
            <section className="panel player-tools" aria-label="Modo">
              {modeToggle}
            </section>
            <div className="sandbox-side-head">
              <div>
                <h2>Sandbox de circuitos</h2>
                <p className="muted-line">Monte qualquer circuito e valide o funcionamento sem usar uma lição.</p>
              </div>
            </div>
            <div className="lab-box">
              <PowerButton on={energized} onClick={() => setEnergized((current) => !current)} />
              <span className="sandbox-power-status" role="status">
                {energized
                  ? lit
                    ? `${Math.max(valid ? diag.mA : 0, capsules.drivenMa)
                        .toFixed(1)
                        .replace('.', ',')} mA`
                    : 'Sem corrente'
                  : 'Bancada desligada'}
              </span>
              <button type="button" className="btn-outline btn-icon" onClick={() => setValidated(true)}>
                <Icon name="check" size={18} />
                Validar circuito
              </button>
            </div>
            {validated && (
              <div className={`sandbox-result ${diag.tone}`} role="status" aria-live="polite">
                <strong>
                  {valid ? 'Circuito válido' : diag.code === 'vazio' ? 'Bancada vazia' : 'Circuito não validado'}
                </strong>
                <span>{diag.msg}</span>
              </div>
            )}
          </div>
        </div>
      </section>
      <div className="sandbox-lesson" style={{ display: mode === 'lesson' ? 'flex' : 'none' }}>
        {mode === 'lesson' && (
          <BenchPreview
            key={lesson.id + lesson.updatedAt}
            lesson={lesson}
            onExit={onExit}
            toolbar={modeToggle}
            notice={notice}
          />
        )}
      </div>
    </div>
  );
}
