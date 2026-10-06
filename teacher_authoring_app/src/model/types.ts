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
  | 'jumper_longo';

export interface Piece {
  id: string;
  type: PieceType;
  a: number;
  b: number;
  row: number;
  value?: number;
}

export type LessonKind = 'guided' | 'challenge';
export type QuizPosition = 'before' | 'after' | 'step';
export type StepAction = 'place_component' | 'place_connection' | 'interact';
export type FeedbackCategory =
  | 'missing_component'
  | 'missing_connection'
  | 'excess_connection'
  | 'incorrect_connection'
  | 'reversed_polarity'
  | 'wrong_value'
  | 'wrong_component';

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

export type LessonValidation = { ok: true; lesson: Lesson } | { ok: false; error: string };
