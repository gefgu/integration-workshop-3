import { useEffect, useRef, useState } from 'react';
import Bubble from '../components/Bubble.tsx';
import { BANK_ROWS, COLS } from '../engine/board.ts';
import type { BenchApi, VisionState } from './benchApi.ts';
import { cameraErrorMessage, gridLines } from './camera.ts';
import { useVisionLive } from './useVision.ts';

const GRID = gridLines(COLS, BANK_ROWS);

/**
 * Camera board view (SFR17.1). With the vision pipeline running in the bench service, it shows the service's
 * annotated frame (the socket grid it found and the pieces it read) and the pieces the lesson will get.
 * Without it, it falls back to the browser's own camera preview with a guide grid.
 */
export default function CameraView({
  api,
  vision,
  onBack,
}: {
  api: BenchApi;
  vision: VisionState;
  onBack: () => void;
}) {
  return vision.available ? (
    <VisionFeed api={api} vision={vision} onBack={onBack} />
  ) : (
    <BrowserPreview onBack={onBack} />
  );
}

const NOMES_VISAO: Record<string, string> = {
  led: 'LED',
  buzzer: 'Buzzer',
  capacitor: 'Capacitor',
  botao: 'Botão',
  jumper_curto: 'Fio curto',
  jumper_longo: 'Fio longo',
  resistor_220: 'Resistor',
  bateria: 'Bateria',
};

function where(p: { a: number; b: number; row: number }) {
  const bank = p.row < BANK_ROWS ? 'C' : 'B';
  return `${bank}, linha ${(p.row % BANK_ROWS) + 1}, colunas ${p.a}–${p.b}`;
}

/** Plain-language camera health: how fresh the picture is, how fast it runs, how it was calibrated. */
function Diagnostics({ live, vision }: { live: VisionState | null; vision: VisionState }) {
  if (!live) return <p className="bench-camera-diag">Sem resposta do serviço da câmera.</p>;
  const age = live.age_s;
  const stale = age == null || age > 3;
  const fps = live.fps;
  const need = live.stable_frames ?? vision.stable_frames;
  const confirming = live.confirming ?? 0;
  return (
    <ul className="bench-camera-diag" aria-label="Diagnóstico da câmera">
      <li className={stale ? 'bad' : ''}>
        Imagem:{' '}
        {age == null
          ? 'ainda sem quadro'
          : stale
            ? `parada há ${Math.round(age)} s`
            : `atualizada há ${age.toFixed(1)} s`}
      </li>
      <li className={fps != null && fps < 2 ? 'bad' : ''}>
        Velocidade: {fps != null ? `${fps.toFixed(1)} quadros/s` : 'medindo…'}
      </li>
      <li>
        Calibração: {live.calibration === 'manual' ? 'manual (arquivo)' : 'automática'}
        {live.frame_size ? ` · ${live.frame_size[0]}×${live.frame_size[1]}` : ''}
      </li>
      {need != null && (
        <li>
          Estabilidade: a peça precisa aparecer em {need} quadros seguidos
          {fps ? ` (~${(need / fps).toFixed(1)} s)` : ''}
          {confirming > 0 ? ` · ${confirming} confirmando` : ''}
        </li>
      )}
    </ul>
  );
}

function VisionFeed({ api, vision, onBack }: { api: BenchApi; vision: VisionState; onBack: () => void }) {
  const back = useRef<HTMLButtonElement>(null);
  const [stamp, setStamp] = useState(() => Date.now());
  const [frameError, setFrameError] = useState(false);
  const live = useVisionLive(api);
  useEffect(() => back.current?.focus(), []);
  // Next frame only after the previous one loaded, so slow links never pile up requests.
  const nextFrame = (failed: boolean) => {
    setFrameError(failed);
    setTimeout(() => setStamp(Date.now()), failed ? 1000 : 250);
  };
  const pieces = vision.pieces ?? [];
  const unknown = vision.unknown ?? [];
  const message = vision.recalibrating
    ? 'Recalibrando a câmera… isso pode levar alguns segundos.'
    : vision.valid
      ? pieces.length
        ? 'Assim a bancada vê a sua placa. As peças reconhecidas aparecem na lição.'
        : 'Estou vendo a placa, mas nenhuma peça ainda.'
      : `Não consegui ler a placa agora: ${vision.reason || 'aguardando imagem'}.`;
  return (
    <section className="bench-center">
      <Bubble kind="hamster" tone={vision.valid ? 'info' : 'obs'} message={message} />
      <div className="bench-camera">
        <img
          src={api.visionFrameUrl(stamp)}
          alt="Imagem da câmera com a leitura da placa"
          onLoad={() => nextFrame(false)}
          onError={() => nextFrame(true)}
        />
        {frameError && <p className="bench-camera-status">Ligando a câmera…</p>}
      </div>
      <div className="panel bench-card">
        <strong>Diagnóstico</strong>
        <Diagnostics live={live} vision={vision} />
      </div>
      <div className="panel bench-card bench-vision-list">
        <strong>Peças reconhecidas ({pieces.length})</strong>
        {pieces.length > 0 && (
          <ul>
            {pieces.map((p) => (
              <li key={p.id}>
                {NOMES_VISAO[p.type] ?? p.type} <small>{where(p)}</small>
              </li>
            ))}
          </ul>
        )}
        {unknown.length > 0 && (
          <>
            <strong>Não reconhecidas ({unknown.length})</strong>
            <ul>
              {unknown.map((p) => (
                <li key={p.id}>
                  {p.reason} <small>{where(p)}</small>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      <div className="workspace-actions">
        <button ref={back} type="button" className="btn-outline" data-pad="back" onClick={onBack}>
          Voltar
        </button>
        <button
          type="button"
          className="btn-outline"
          data-pad="item"
          disabled={vision.recalibrating}
          onClick={() => void api.visionRecalibrate().catch(() => undefined)}
        >
          {vision.recalibrating ? 'Recalibrando…' : 'Recalibrar câmera'}
        </button>
      </div>
    </section>
  );
}

/** No vision service: the browser's own camera, with a guide grid and corner marks to line the board up. */
function BrowserPreview({ onBack }: { onBack: () => void }) {
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
        <button ref={back} type="button" className="btn-outline" data-pad="back" onClick={onBack}>
          Voltar
        </button>
        <button
          type="button"
          className="btn-outline"
          data-pad="item"
          disabled={!live}
          onClick={() => setShowGrid((v) => !v)}
        >
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
