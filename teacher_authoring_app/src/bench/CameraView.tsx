import { useEffect, useRef, useState } from 'react';
import Bubble from '../components/Bubble.tsx';
import { BANK_ROWS, COLS } from '../engine/board.ts';
import { cameraErrorMessage, gridLines } from './camera.ts';

const GRID = gridLines(COLS, BANK_ROWS);

/**
 * Camera board view (SFR17.1): the live picture of the student's board, with the bench grid and the four
 * corner marks drawn over it so the board can be lined up. Recognition and corner calibration come later.
 */
export default function CameraView({ onBack }: { onBack: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const back = useRef<HTMLButtonElement>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState('');
  const [error, setError] = useState('');
  const [live, setLive] = useState(false);
  const [showGrid, setShowGrid] = useState(true);

  useEffect(() => back.current?.focus(), []);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let alive = true;
    setLive(false);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(cameraErrorMessage('SecurityError'));
      return undefined;
    }
    navigator.mediaDevices
      .getUserMedia({
        video: deviceId ? { deviceId: { exact: deviceId } } : { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      .then(async (next) => {
        if (!alive) {
          for (const track of next.getTracks()) track.stop();
          return;
        }
        stream = next;
        if (video.current) video.current.srcObject = next;
        setError('');
        setLive(true);
        // Labels are only filled in after permission is granted.
        const all = await navigator.mediaDevices.enumerateDevices();
        if (alive) setDevices(all.filter((d) => d.kind === 'videoinput'));
      })
      .catch((cause: DOMException) => {
        if (alive) setError(cameraErrorMessage(cause.name));
      });
    return () => {
      alive = false;
      if (stream) for (const track of stream.getTracks()) track.stop();
    };
  }, [deviceId]);

  return (
    <section className="bench-center">
      <Bubble
        kind="hamster"
        tone={error ? 'erro' : 'info'}
        message={error || 'Assim a bancada vê a sua placa. Deixe os quatro cantos da placa dentro das marcas laranja.'}
      />
      <div className="bench-camera">
        <video ref={video} autoPlay playsInline muted aria-label="Imagem da câmera" />
        {live && showGrid && (
          <svg className="bench-camera-grid" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {GRID.xs.map((x) => (
              <line key={`x${x}`} x1={x} x2={x} y1={GRID.ys[0]} y2={GRID.ys[GRID.ys.length - 1]} />
            ))}
            {GRID.ys.map((y) => (
              <line key={`y${y}`} y1={y} y2={y} x1={GRID.xs[0]} x2={GRID.xs[GRID.xs.length - 1]} />
            ))}
          </svg>
        )}
        {live &&
          ['tl', 'tr', 'bl', 'br'].map((corner) => (
            <span key={corner} className={`bench-camera-corner ${corner}`} aria-hidden="true" />
          ))}
        {!live && !error && <p className="bench-camera-status">Ligando a câmera…</p>}
      </div>
      <div className="workspace-actions">
        <button ref={back} type="button" className="btn-outline" onClick={onBack}>
          Voltar (Esc)
        </button>
        <button type="button" className="btn-outline" disabled={!live} onClick={() => setShowGrid((v) => !v)}>
          {showGrid ? 'Esconder grade' : 'Mostrar grade'}
        </button>
        {devices.length > 1 && (
          <select
            className="text-input"
            aria-label="Câmera"
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
          >
            <option value="">Câmera padrão</option>
            {devices.map((d, i) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Câmera ${i + 1}`}
              </option>
            ))}
          </select>
        )}
      </div>
    </section>
  );
}
