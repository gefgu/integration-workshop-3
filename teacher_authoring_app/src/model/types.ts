export type PieceType =
  | 'bateria'
  | 'led'
  | 'buzzer'
  | 'resistor_220'
  | 'resistor_470'
  | 'resistor_1k'
  | 'capacitor'
  | 'botao'
  | 'potenciometro'
  | 'jumper_curto'
  | 'jumper_longo'
  | 'jumper_3'
  | 'jumper_4'
  | 'jumper_5'
  | 'capsula_pulso'
  | 'capsula_voltimetro'
  | 'capsula_amperimetro'
  | 'capsula_porta'
  | 'capsula_memoria';

/** Smart-capsule behaviour. Missing keys fall back to the defaults in `engine/sim.ts`. */
export interface CapsuleConfig {
  hz?: number;
  duty?: number;
  op?: 'and' | 'or' | 'nand' | 'nor' | 'xor' | 'not';
  mem?: 'd' | 'sr';
}

export interface Piece {
  id: string;
  type: PieceType;
  a: number;
  b: number;
  row: number;
  value?: number;
  /** Third column (P3) of a smart capsule; its pins are a (P1), b = a + 1 (P2) and c = a + 2 (P3). */
  c?: number;
  config?: CapsuleConfig;
}

export type LessonKind = 'guided' | 'challenge';
export type QuizPosition = 'before' | 'after' | 'step';
export type StepAction = 'place_component' | 'place_connection' | 'connect_circuit' | 'interact';
export type FeedbackCategory =
  | 'missing_component'
  | 'missing_connection'
  | 'excess_connection'
  | 'excess_component'
  | 'incorrect_connection'
  | 'reversed_polarity'
  | 'wrong_value'
  | 'wrong_component'
  | 'wrong_config'
  | 'misconnected_component'
  | 'open_circuit'
  | 'short_circuit';

export interface QuizOption {
  id: string;
  text: string;
  feedback: string;
}
export interface Quiz {
  id: string;
  position: QuizPosition;
  prompt: string;
  options: QuizOption[];
  correctId: string;
}
export interface StepOptions {
  matchValues: boolean;
  strictPositions: boolean;
}
export interface LessonStep {
  id: string;
  action: StepAction;
  pieceId: string | null;
  quizId: string | null;
  text: string;
  options: StepOptions;
  overrides: Record<string, Record<string, string>>;
}
export interface Lesson {
  version: number;
  id: string;
  title: string;
  instruction: string;
  kind: LessonKind;
  board: { cols: number; rows: number; pieces: Piece[] };
  steps: LessonStep[];
  timeLimitS: number | null;
  quizzes: Quiz[];
  updatedAt: string;
}

export interface TrailStep {
  id: string;
  type: PieceType;
  from: number;
  to: number;
  forward: boolean;
  ohms: number;
}
export interface CircuitAnalysis {
  code: string;
  trail: TrailStep[] | null;
  ohms?: number;
  load?: 'led' | 'buzzer' | null;
}
export interface CircuitTrail {
  edgeIds: Set<string>;
  nodes: Set<number>;
}
export interface DiagnoseResult {
  code: string;
  tone: 'info' | 'ok' | 'erro';
  msg: string;
  trail: CircuitTrail | null;
  mA: number;
  load: 'led' | 'buzzer' | null;
}

/** What a smart capsule shows on its OLED, plus its P3 output level (`z` = high impedance). */
export interface CapsuleReading {
  lines: string[];
  out: 'alto' | 'baixo' | 'z';
  fault?: boolean;
}

export type LessonValidation = { ok: true; lesson: Lesson } | { ok: false; error: string };
