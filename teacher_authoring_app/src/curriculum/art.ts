/**
 * Illustrations for the curriculum, drawn as small SVGs and stored inside each lesson so they work
 * offline on the bench. They were drafted with AI assistance during development (see AI/curriculum-notes.md)
 * and reviewed in the app; they are teaching sketches, not engineering drawings, and show no measured data.
 */
import { ohmsBands } from '../engine/lab.ts';
import { formatOhms } from '../engine/sim.ts';
import type { Illustration } from '../model/types.ts';

const INK = '#2e2b25';
const TEAL = '#2f8f6b';
const ORANGE = '#d4733a';
const RED = '#d23a30';
const SOFT = '#f3ede0';
const GREY = '#8b9096';

const svg = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" font-family="Arial, Helvetica, sans-serif" font-size="15" fill="${INK}"><rect width="${w}" height="${h}" fill="#fffdf8"/>${body}</svg>`;
const text = (
  x: number,
  y: number,
  t: string,
  o: { size?: number; anchor?: string; fill?: string; bold?: boolean } = {}
) =>
  `<text x="${x}" y="${y}" font-size="${o.size ?? 15}" text-anchor="${o.anchor ?? 'start'}" fill="${o.fill ?? INK}"${o.bold ? ' font-weight="700"' : ''}>${t}</text>`;
const line = (x1: number, y1: number, x2: number, y2: number, c = INK, w = 3) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;
const arrow = (x1: number, y1: number, x2: number, y2: number, c = ORANGE) => {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const tip = (t: number) =>
    `${(x2 - 11 * Math.cos(angle + t)).toFixed(1)},${(y2 - 11 * Math.sin(angle + t)).toFixed(1)}`;
  return `${line(x1, y1, x2, y2, c, 3)}<polygon points="${x2},${y2} ${tip(0.45)} ${tip(-0.45)}" fill="${c}"/>`;
};
const rect = (x: number, y: number, w: number, h: number, fill: string, r = 8, stroke = 'none') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
const circle = (x: number, y: number, r: number, fill: string, stroke = 'none') =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;

const art = (w: number, h: number, body: string, alt: string, caption?: string): Illustration => ({
  svg: svg(w, h, body),
  alt,
  ...(caption ? { caption } : {}),
});

/** A battery symbol, + on top. */
const batterySymbol = (x: number, y: number) =>
  `${line(x - 18, y, x + 18, y, INK, 4)}${line(x - 10, y + 14, x + 10, y + 14, INK, 7)}${text(x + 26, y + 4, '+', { bold: true })}${text(x + 26, y + 22, '−', { bold: true })}`;

/** Lesson 1: the two nodes of a column, with the center break. */
export function artNodes(): Illustration {
  const col = (x: number, label: string, y0: number, labelY: number) => {
    let body = line(x, y0, x, y0 + 110, TEAL, 8);
    for (let i = 0; i < 6; i++) body += rect(x - 12, y0 + i * 22 - 9, 24, 18, '#cfc8b8', 4, '#8a836f');
    return body + text(x, labelY, label, { anchor: 'middle', bold: true, fill: TEAL });
  };
  return art(
    720,
    410,
    `${rect(120, 12, 480, 386, SOFT, 18)}
${col(260, 'nó A5', 52, 36)}${col(460, 'nó A6', 52, 36)}
${rect(140, 182, 440, 30, '#c9c2b0', 6)}${text(360, 202, 'abertura central — separa os nós de cima e de baixo', { anchor: 'middle', size: 13 })}
${col(260, 'nó B5', 240, 386)}${col(460, 'nó B6', 240, 386)}
${text(40, 112, 'banco A', { bold: true })}${text(40, 300, 'banco B', { bold: true })}`,
    'Duas colunas da bancada. Em cada uma, os seis furos de cima formam um nó (A) e os seis de baixo formam outro nó (B); a abertura central separa os dois.',
    'Cada coluna tem DOIS nós: A (em cima) e B (embaixo). Os 6 furos de um banco já estão ligados entre si.'
  );
}

/** Lesson 1: the workbench in one picture. */
export function artWorkbench(): Illustration {
  return art(
    720,
    300,
    `${rect(20, 30, 150, 240, SOFT, 16)}${text(95, 56, 'Bandeja', { anchor: 'middle', bold: true })}
${rect(45, 75, 100, 34, '#d23a30', 10)}${text(95, 98, 'bateria 5 V', { anchor: 'middle', fill: '#fff', size: 13 })}
${rect(45, 120, 100, 34, '#3f9b4f', 10)}${text(95, 143, 'LED', { anchor: 'middle', fill: '#fff', size: 13 })}
${rect(45, 165, 100, 34, '#2f66c9', 10)}${text(95, 188, 'resistor', { anchor: 'middle', fill: '#fff', size: 13 })}
${rect(45, 210, 100, 34, '#f6f2ea', 10, '#b9b2a4')}${text(95, 233, 'jumper', { anchor: 'middle', size: 13 })}
${rect(210, 30, 330, 240, '#e6dfcf', 20)}${text(375, 52, 'Bancada: 11 colunas × (6 furos A + 6 furos B)', { anchor: 'middle', bold: true, size: 13 })}
${Array.from({ length: 12 }, (_, r) => Array.from({ length: 11 }, (_, c) => circle(238 + c * 27.4, 72 + r * 15 + (r >= 6 ? 12 : 0), 5, '#bdb5a2')).join('')).join('')}
${text(220, 258, 'A em cima, B embaixo', { size: 11 })}
${rect(570, 30, 130, 110, SOFT, 16)}${circle(635, 76, 14, '#4fd36b')}${text(635, 112, 'LED de status', { anchor: 'middle', size: 13 })}${text(635, 130, 'acende com a bateria', { anchor: 'middle', size: 11 })}
${rect(570, 160, 130, 110, SOFT, 16)}${text(635, 196, 'Tela', { anchor: 'middle', bold: true })}${text(635, 218, 'mostra dicas,', { anchor: 'middle', size: 13 })}${text(635, 236, 'perguntas e valores', { anchor: 'middle', size: 13 })}`,
    'Esquema da bancada: bandeja com as peças à esquerda, bancada com furos ao centro, LED de status e tela à direita.',
    'Você pega peças na bandeja, encaixa na bancada e a tela explica o que acontece.'
  );
}

/** Lessons 2/3: the closed loop with the current's direction. */
export function artLoop(withResistor = false): Illustration {
  const mid = withResistor
    ? `${line(280, 60, 330, 60)}${rect(330, 46, 80, 28, '#fff', 4, INK)}${text(370, 66, 'resistor', { anchor: 'middle', size: 13 })}${line(410, 60, 470, 60)}`
    : `${line(280, 60, 470, 60)}`;
  return art(
    720,
    280,
    `${line(120, 60, 280, 60)}${mid}
${rect(470, 36, 70, 48, '#fff', 8, INK)}<path d="M492 44 L492 76 L518 60 Z" fill="${INK}"/>${line(520, 44, 520, 76, INK, 3)}${text(505, 104, 'LED', { anchor: 'middle', bold: true })}
${line(540, 60, 620, 60)}${line(620, 60, 620, 220)}${line(620, 220, 120, 220)}${line(120, 220, 120, 150)}${line(120, 60, 120, 110)}
${batterySymbol(120, 124)}${text(150, 160, 'bateria', { size: 13 })}
${arrow(190, 36, 250, 36)}${arrow(620, 130, 620, 170)}${arrow(520, 244, 440, 244)}${arrow(100, 180, 100, 200)}
${text(360, 262, 'a corrente só passa se o caminho estiver FECHADO do + ao −', { anchor: 'middle', fill: TEAL, bold: true, size: 14 })}`,
    withResistor
      ? 'Circuito com bateria, resistor e LED em um caminho fechado; setas mostram a corrente saindo do mais, passando pelo resistor e pelo LED e voltando ao menos.'
      : 'Circuito com bateria e LED em um caminho fechado; setas mostram a corrente saindo do mais, passando pelo LED e voltando ao menos.',
    'A corrente anda em círculo: sai do +, passa pelas peças e volta ao −.'
  );
}

/** Resistor with bands drawn from its value, with a wide marker band like the on-screen piece. */
export function artResistorBands(ohms: number, label = formatOhms(ohms)): Illustration {
  const b = ohmsBands(ohms);
  const bands = b
    ? b.colors
        .map((c, i) => rect(i === 0 ? 232 : 280 + (i - 1) * 46, 62, i === 0 ? 30 : 24, 76, c, 3, '#1e1b16'))
        .join('')
    : '';
  const names = b ? b.names : [];
  return art(
    720,
    260,
    `${line(70, 100, 200, 100, GREY, 6)}${line(520, 100, 650, 100, GREY, 6)}${rect(200, 56, 320, 88, '#e8d3a8', 40)}${bands}
${names.map((n, i) => text(i === 0 ? 247 : 292 + (i - 1) * 46, 172, `${i + 1}ª`, { anchor: 'middle', bold: true, size: 14 })).join('')}
${names.map((n, i) => text(i === 0 ? 247 : 292 + (i - 1) * 46, 192, n, { anchor: 'middle', size: 12 })).join('')}
${text(360, 232, `${b ? `${b.digits[0]}${b.digits[1]} × ${10 ** b.digits[2]}` : ''} = ${label}`, { anchor: 'middle', bold: true, size: 17, fill: TEAL })}`,
    `Resistor de ${label} com as faixas ${names.join(', ')}.`,
    `Faixas de ${label}: ${names.join(' · ')}. Ilustração do software (não é leitura da câmera).`
  );
}


/** Lesson 4: LED polarity. */
export function artLedPolarity(): Illustration {
  return art(
    720,
    260,
    `${line(60, 110, 250, 110)}<path d="M250 70 L250 150 L330 110 Z" fill="${INK}"/>${line(332, 70, 332, 150, INK, 5)}${line(334, 110, 520, 110)}
${text(150, 90, 'anodo (+)', { anchor: 'middle', bold: true })}${text(430, 90, 'catodo (−)', { anchor: 'middle', bold: true })}
${arrow(380, 150, 480, 150)}${text(430, 176, 'a corrente passa neste sentido', { anchor: 'middle', size: 13, fill: ORANGE })}
${line(345, 62, 365, 36, ORANGE, 3)}${line(362, 70, 382, 44, ORANGE, 3)}
${text(360, 226, 'O triângulo aponta para onde a corrente PODE ir. Ao contrário, o LED não acende.', { anchor: 'middle', bold: true, fill: TEAL, size: 14 })}`,
    'Símbolo do LED: o triângulo aponta do anodo, que é o mais, para o catodo, que é o menos, e a barra marca o lado do catodo.',
    'O LED é uma via de mão única: o lado da barra é o −.'
  );
}

/** Lesson 5: the button as a gap in the path. */
export function artButton(): Illustration {
  const sw = (x: number, closed: boolean, label: string) =>
    `${line(x, 100, x + 60, 100)}${circle(x + 60, 100, 5, INK)}${line(x + 60, 100, x + 120, closed ? 100 : 66, closed ? TEAL : RED, 4)}${circle(x + 120, 100, 5, INK)}${line(x + 120, 100, x + 190, 100)}${text(x + 95, 160, label, { anchor: 'middle', bold: true, fill: closed ? TEAL : RED })}`;
  return art(
    720,
    230,
    `${sw(30, false, 'solto: caminho ABERTO')}${sw(360, true, 'apertado: caminho FECHADO')}${text(360, 210, 'O botão é uma ponte que só existe enquanto você aperta.', { anchor: 'middle', size: 14 })}`,
    'Dois desenhos de botão: solto, com a ponte levantada e o caminho aberto; apertado, com a ponte baixa e o caminho fechado.',
    'Aberto: nada passa. Fechado: a corrente passa.'
  );
}

/** Lesson 6: the potentiometer as a resistor you turn. */
export function artPot(): Illustration {
  return art(
    720,
    260,
    `${line(60, 120, 230, 120)}${rect(230, 96, 220, 48, '#fff', 6, INK)}${line(450, 120, 640, 120)}
${line(340, 52, 340, 96, ORANGE, 4)}<path d="M330 80 L340 98 L350 80" fill="${ORANGE}"/>${text(340, 40, 'botão giratório', { anchor: 'middle', bold: true, fill: ORANGE })}
${text(235, 170, 'menos resistência', { size: 13 })}${text(445, 170, 'mais resistência', { size: 13, anchor: 'end' })}
${arrow(240, 192, 440, 192, TEAL)}${text(340, 218, 'mais resistência → menos corrente → LED mais fraco', { anchor: 'middle', bold: true, fill: TEAL, size: 14 })}`,
    'Potenciômetro desenhado como um resistor com uma seta giratória; girar para um lado aumenta a resistência e reduz a corrente.',
    'O potenciômetro é um resistor que você regula, sem degraus.'
  );
}

/** Lesson 7: the capacitor as a small tank. */
export function artCapacitor(): Illustration {
  return art(
    720,
    280,
    `${line(60, 90, 220, 90, INK, 4)}${rect(220, 60, 90, 60, '#fff', 6, INK)}${text(265, 96, 'resistor', { anchor: 'middle', size: 13 })}${line(310, 90, 420, 90, INK, 4)}
${rect(420, 50, 110, 150, '#e1eef2', 12, '#4a7c8c')}${rect(424, 100, 102, 96, '#6fb6cc', 8)}${text(475, 40, 'capacitor', { anchor: 'middle', bold: true })}${text(475, 154, 'energia', { anchor: 'middle', fill: '#fff', bold: true })}${text(475, 172, 'guardada', { anchor: 'middle', fill: '#fff', bold: true })}
${line(530, 150, 640, 150, INK, 4)}${rect(580, 120, 50, 60, '#fff', 8, INK)}${text(605, 156, 'LED', { anchor: 'middle', size: 13, bold: true })}
${text(360, 245, 'Com a fonte ligada o capacitor “enche”. Ao desligar, ele “esvazia” pelo LED: a luz apaga aos poucos.', { anchor: 'middle', size: 14, fill: TEAL, bold: true })}`,
    'Capacitor desenhado como um pequeno tanque que se enche pela fonte e depois se esvazia pelo LED.',
    'Capacitor = pequeno reservatório de energia elétrica.'
  );
}

/** Lesson 8: buzzer, resistor and sound. */
export function artBuzzer(): Illustration {
  return art(
    720,
    250,
    `${line(60, 110, 200, 110)}${rect(200, 86, 100, 48, '#fff', 6, INK)}${text(250, 116, 'resistor', { anchor: 'middle', size: 13 })}${line(300, 110, 440, 110)}
${circle(500, 110, 52, '#fff', INK)}${text(500, 116, 'buzzer', { anchor: 'middle', bold: true })}
<path d="M566 80 q22 30 0 60 M584 66 q36 44 0 88" stroke="${ORANGE}" stroke-width="4" fill="none" stroke-linecap="round"/>
${line(552, 110, 660, 110)}
${text(360, 206, 'Resistor maior → menos corrente → buzzer com menos “força”.', { anchor: 'middle', bold: true, fill: TEAL, size: 15 })}
${text(360, 230, 'No simulador, menos corrente dá som mais baixo e mais grave (modelo didático).', { anchor: 'middle', size: 13 })}`,
    'Bateria, resistor e buzzer em série; o buzzer emite ondas sonoras. Um resistor maior reduz a corrente e a força do som.',
    'O resistor controla o quanto o buzzer é alimentado.'
  );
}

/** Lesson 9: a short circuit and a loose contact side by side. */
export function artSafety(): Illustration {
  return art(
    720,
    350,
    `${text(360, 28, 'Curto-circuito', { anchor: 'middle', bold: true, size: 17, fill: RED })}
${line(140, 60, 580, 60, RED, 6)}${line(140, 60, 140, 140)}${line(580, 60, 580, 140)}${line(140, 140, 580, 140)}${batterySymbol(140, 84)}
${text(360, 108, 'sem nada no meio — a corrente é enorme!', { anchor: 'middle', size: 13, fill: RED })}${text(360, 168, 'a bancada corta a energia sozinha (simulado)', { anchor: 'middle', size: 13 })}
${text(360, 208, 'Mau contato', { anchor: 'middle', bold: true, size: 17, fill: ORANGE })}
${line(140, 240, 300, 240)}${rect(300, 226, 70, 28, '#fff', 4, INK)}${line(370, 240, 440, 240)}${line(440, 240, 470, 232, ORANGE, 4)}${line(500, 240, 580, 240)}${line(580, 240, 580, 310)}${line(580, 310, 140, 310)}${line(140, 310, 140, 260)}${line(140, 240, 140, 285)}
${text(470, 224, 'peça mal encaixada', { size: 12, anchor: 'middle', fill: ORANGE })}${text(360, 342, 'a luz pisca: o caminho abre e fecha sozinho', { anchor: 'middle', size: 13 })}`,
    'Dois acidentes: em cima um curto-circuito, com um fio ligando o mais direto ao menos; embaixo um mau contato, com um fio mal encaixado que abre e fecha o caminho.',
    'Curto = caminho curto demais. Mau contato = caminho que falha.'
  );
}

/** Lesson 10: the alarm's block diagram. */
export function artAlarm(): Illustration {
  return art(
    720,
    290,
    `${rect(40, 110, 110, 56, '#f3cf5a', 12)}${text(95, 144, 'botão', { anchor: 'middle', bold: true })}
${arrow(150, 138, 230, 138, INK)}${circle(240, 138, 7, INK)}
${line(240, 138, 240, 70)}${arrow(240, 70, 300, 70, INK)}${rect(300, 44, 120, 52, '#2f66c9', 10)}${text(360, 76, 'resistor', { anchor: 'middle', fill: '#fff' })}${arrow(420, 70, 480, 70, INK)}${rect(480, 44, 120, 52, '#3f9b4f', 10)}${text(540, 76, 'LED', { anchor: 'middle', fill: '#fff', bold: true })}
${line(240, 138, 240, 210)}${arrow(240, 210, 300, 210, INK)}${rect(300, 184, 120, 52, '#2f66c9', 10)}${text(360, 216, 'resistor', { anchor: 'middle', fill: '#fff' })}${arrow(420, 210, 480, 210, INK)}${rect(480, 184, 120, 52, '#3f9b4f', 10)}${text(540, 216, 'buzzer', { anchor: 'middle', fill: '#fff', bold: true })}
${line(600, 70, 650, 70)}${line(650, 70, 650, 210)}${line(600, 210, 650, 210)}
${text(360, 272, 'Um botão alimenta dois ramos ao mesmo tempo: a corrente se divide.', { anchor: 'middle', bold: true, fill: TEAL, size: 14 })}`,
    'Diagrama do alarme: um botão alimenta dois caminhos paralelos, um com resistor e LED e outro com resistor e buzzer.',
    'Dois ramos em paralelo: o LED e o buzzer funcionam juntos.'
  );
}
