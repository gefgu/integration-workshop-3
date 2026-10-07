import { useState } from 'react';
import BoardWorkspace from '../components/BoardWorkspace.tsx';
import { useCapsules } from '../components/useCapsules.ts';
import { mergeTrails } from '../engine/capsules.ts';
import { diagnose } from '../engine/diagnose.ts';
import type { Piece } from '../model/types.ts';
import LessonPlayer from '../player/LessonPlayer.tsx';

export default function Sandbox({ lesson, onExit }) {
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [pressed, setPressed] = useState<Set<string>>(() => new Set());
  const [energized, setEnergized] = useState(false);
  const [validated, setValidated] = useState(false);
  const [mode, setMode] = useState<'free' | 'lesson'>('free');
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

  return (
    <div className="sandbox-page">
      <nav className="sandbox-mode-toggle" aria-label="Modo do sandbox">
        <button type="button" className={mode === 'free' ? 'active' : ''} onClick={() => setMode('free')}>
          Sandbox livre
        </button>
        <button type="button" className={mode === 'lesson' ? 'active' : ''} onClick={() => setMode('lesson')}>
          Validador da lição
        </button>
      </nav>
      <section className="sandbox-free" style={{ display: mode === 'free' ? 'flex' : 'none' }}>
        <header className="sandbox-heading">
          <div>
            <h2>Sandbox de circuitos</h2>
            <p>Monte qualquer circuito na bancada e valide o funcionamento sem usar uma lição.</p>
          </div>
          <button
            type="button"
            className="pill-link-btn muted"
            onClick={() => changePieces([])}
            disabled={!pieces.length}
          >
            Limpar bancada
          </button>
        </header>

        <BoardWorkspace
          pieces={pieces}
          onChange={changePieces}
          trail={lit ? mergeTrails(valid ? diag.trail : null, capsules.driven) : null}
          ledMa={lit ? Math.max(valid ? diag.mA : 0, capsules.drivenMa) : 0}
          readings={capsules.readings}
          pressed={pressed}
          onPress={onPress}
        />

        <div className="sandbox-actions">
          <button type="button" className="btn-primary" onClick={() => setValidated(true)}>
            Validar circuito
          </button>
          <button type="button" className="pill-link-btn muted" onClick={() => setEnergized((current) => !current)}>
            {energized ? 'Desligar bancada' : 'Energizar bancada'}
          </button>
          <span className="sandbox-power-status">
            {energized
              ? lit
                ? `${Math.max(valid ? diag.mA : 0, capsules.drivenMa).toFixed(1)} mA`
                : 'Sem corrente'
              : 'Bancada desligada'}
          </span>
        </div>

        {validated && (
          <div className={`sandbox-result ${diag.tone}`} role="status" aria-live="polite">
            <strong>
              {valid ? 'Circuito válido' : diag.code === 'vazio' ? 'Bancada vazia' : 'Circuito não validado'}
            </strong>
            <span>{diag.msg}</span>
          </div>
        )}
      </section>
      <div style={{ display: mode === 'lesson' ? 'block' : 'none', width: '100%' }}>
        <LessonPlayer key={lesson.id + lesson.updatedAt} lesson={lesson} onExit={onExit} mascotKind="fox" />
      </div>
    </div>
  );
}
