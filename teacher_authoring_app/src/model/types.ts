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
  /** Poorly seated (lesson 9): conducts intermittently until the student re-seats it by clicking. */
  loose?: boolean;
}

export type LessonKind = 'guided' | 'challenge';
export type QuizPosition = 'before' | 'after' | 'step';
/**
 * `explain` (a reading card) and `experiment` (a simulated lab with missions) are played by the app
 * only; the graph_validator sees them as `interact` steps that nothing ever answers.
 */
export type StepAction =
  | 'place_component'
  | 'place_connection'
  | 'connect_circuit'
  | 'interact'
  | 'explain'
  | 'experiment';

/** An inline SVG drawing stored with the lesson so it works offline on the bench. */
export interface Illustration {
  svg: string;
  alt: string;
  caption?: string;
}

/** Something the student can watch happen in an experiment; the lab latches these as they occur. */
export type LabEvent =
  | 'energized'
  | 'lit'
  | 'flicker'
  | 'short_cut'
  | 'reversed_dark'
  | 'pressed_lit'
  | 'released_dark'
  | 'partial_dark'
  | 'faded'
  | 'pot_low'
  | 'pot_high'
  | 'buzzed'
  | 'both_on'
  | 'heard_a'
  | 'heard_b'
  | 'seated';
/** What is true right now on the board. */
export type LabState =
  | 'status_led'
  | 'lit'
  | 'dark'
  | 'closed'
  | 'no_short'
  | 'no_loose'
  | 'all_lit';

export interface LabGoal {
  id: string;
  /** What the student reads in the mission checklist. */
  label: string;
  /** Latched events that must all have happened. */
  seen?: LabEvent[];
  /** Conditions that must hold now. */
  now?: LabState[];
  /** At least this many presets seen working (lit) at least once (compare two resistors). */
  presetsLit?: number;
  /** At least this many presets seen fading out after power-off (compare two capacitors). */
  presetsFaded?: number;
}

export interface LabPreset {
  label: string;
  pieces: Piece[];
}

/** A simulated experiment: the board, what the student may change, and the missions to complete. */
export interface ExperimentSpec {
  /** Board shown when the experiment starts (omit to keep the student's board). */
  board?: Piece[];
  /** Presets the student switches between (e.g. resistor 220 Ω / 1 kΩ). */
  presets?: LabPreset[];
  /** Continuous knob for a potentiometer piece. */
  slider?: { pieceId: string; label: string };
  /** Two simulated audio clips to compare (lesson 8 challenge); `a`/`b` are resistances in Ω. */
  clips?: { a: number; b: number };
  goals: LabGoal[];
}
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
  /** Heading of an `explain` or `experiment` card. */
  title?: string;
  illustration?: Illustration | null;
  /** `explain` only: an interactive widget shown with the text. */
  widget?: 'nodes' | null;
  experiment?: ExperimentSpec | null;
}

/** The bench the student starts from: preassembled or deliberately faulty. */
export interface LessonStart {
  pieces: Piece[];
  /** One of these pieces is removed at random when the lesson starts ("one jumper is missing"). */
  removeOneOf?: string[];
}

/** Optional per-lesson behaviour; every key is off/absent by default so older lessons play as before. */
export interface LessonSettings {
  /** Show the bench's built-in status LED (lesson 1). Simulated here. */
  statusLed?: boolean;
  /** Withhold the validator's hint until the same mistake happened this many times in a row. */
  hintAfter?: number;
  /** Teaching simplification of lesson 2: an LED with no resistor lights at the bench's current ceiling. */
  allowNoResistor?: boolean;
  /** The build only counts once the student energized it and saw it work. */
  requireLit?: boolean;
  /** Pieces offered in the tray (default: the whole kit). */
  tray?: PieceType[];
  /** Final check compares resistor values / exact positions. */
  matchValues?: boolean;
  strictPositions?: boolean;
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
  start?: LessonStart | null;
  settings?: LessonSettings;
  /** For the teacher: goal, success criterion, what is simulated, where the content came from. */
  teacherNotes?: string;
  /** Free labels (e.g. "exemplo", "experimento") the library can filter on. */
  tags?: string[];
  /** Written by the server on save: the tutor's MP3 for each phrase (absent until saved). */
  audio?: AudioManifest;
}

/** Normalized phrase text → MP3 file name, served at /api/tts/audio/<file>. */
export interface AudioManifest {
  voice: string | null;
  status: 'ok' | 'unavailable' | 'error' | 'missing';
  phrases: Record<string, string>;
  detail?: string;
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
  /** Every conducting path that powers a load (an LED and a buzzer in parallel give two). */
  branches?: { trail: TrailStep[]; ohms: number; load: 'led' | 'buzzer' | null }[];
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
  /** True when the bench's 15 mA ceiling capped the current shown. */
  limited: boolean;
  /** Which kinds of load are working right now (an alarm lights both). */
  loadsLit: ('led' | 'buzzer')[];
  /** Poorly seated pieces on the energized path. */
  looseIds: string[];
}

/** What a smart capsule shows on its OLED, plus its P3 output level (`z` = high impedance). */
export interface CapsuleReading {
  lines: string[];
  out: 'alto' | 'baixo' | 'z';
  fault?: boolean;
}

export type LessonValidation = { ok: true; lesson: Lesson } | { ok: false; error: string };
