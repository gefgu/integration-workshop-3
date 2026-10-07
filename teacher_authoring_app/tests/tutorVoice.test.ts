import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { type AudioSink, audioFileFor, normalize, TutorVoice } from '../src/audio/tutorVoice.ts';

const vectors = JSON.parse(readFileSync(new URL('./tts_vectors.json', import.meta.url), 'utf-8'));
const manifest = (phrases) => ({ voice: 'v', status: 'ok' as const, phrases });
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function fakeSink() {
  const played: string[] = [];
  const sink: AudioSink & { end: () => void } = {
    src: '',
    onended: null,
    play: async () => {
      played.push(sink.src.split('/').pop());
    },
    pause: () => {},
    end: () => sink.onended?.(new Event('ended')),
  };
  return { sink, played };
}

test('normalize é o mesmo do backend (graph_validator/tts/synth.py)', () => {
  for (const c of vectors) assert.equal(normalize(c.in), c.out);
});

test('áudio da lição tem prioridade sobre o pacote do sistema', () => {
  const lesson = manifest({ 'Boa!': 'lesson.mp3' });
  const system = manifest({ 'Boa!': 'system.mp3', 'Exato!': 'exato.mp3' });
  assert.equal(audioFileFor('  Boa! ', [lesson, system]), 'lesson.mp3');
  assert.equal(audioFileFor('Exato!', [lesson, system]), 'exato.mp3');
  assert.equal(audioFileFor('Nada', [lesson, undefined, system]), null);
});

test('falas do mesmo render tocam em ordem e uma fala nova interrompe a fila', async () => {
  const { sink, played } = fakeSink();
  const voice = new TutorVoice(() => sink);
  voice.manifests = [manifest({ Título: 't.mp3', Pergunta: 'p.mp3', Errou: 'e.mp3', 'Sem voz': '' })];
  voice.say(['Pergunta', 'Sem voz']);
  voice.say(['Título'], -1);
  await tick();
  assert.deepEqual(played, ['t.mp3']);
  sink.end();
  assert.deepEqual(played, ['t.mp3', 'p.mp3']);
  voice.say(['Errou']);
  await tick();
  assert.deepEqual(played, ['t.mp3', 'p.mp3', 'e.mp3']);
  voice.setMuted(true);
  voice.say(['Título']);
  await tick();
  assert.equal(played.length, 3);
});

test('speaking acompanha o áudio (para a boca do mascote)', async () => {
  const { sink } = fakeSink();
  const voice = new TutorVoice(() => sink);
  voice.manifests = [manifest({ Um: '1.mp3', Dois: '2.mp3' })];
  const seen: boolean[] = [];
  voice.subscribe(() => seen.push(voice.speaking));
  assert.equal(voice.hasAudio('Um'), true);
  assert.equal(voice.hasAudio('Sem áudio'), false);
  voice.say(['Um', 'Dois']);
  await tick();
  assert.equal(voice.speaking, true);
  sink.end();
  await tick();
  assert.equal(voice.speaking, true); // still talking: second line
  sink.end();
  assert.equal(voice.speaking, false);
  assert.deepEqual(seen, [true, false]);
  voice.setMuted(true);
  assert.equal(voice.hasAudio('Um'), false); // muted: the mascot falls back to its timer
});

test('StrictMode (efeito, limpeza, efeito) fala cada linha uma vez só', async () => {
  const { sink, played } = fakeSink();
  const voice = new TutorVoice(() => sink);
  voice.manifests = [manifest({ Título: 't.mp3', Pergunta: 'p.mp3' })];
  for (const lines of [['Título'], ['Pergunta']]) {
    const cancel = voice.say(lines); // 1st mount
    cancel(); // simulated cleanup
    voice.say(lines); // 2nd mount
  }
  await tick();
  sink.end();
  sink.end();
  assert.deepEqual(played, ['t.mp3', 'p.mp3']);
});
