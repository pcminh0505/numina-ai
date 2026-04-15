import { GEN_REGISTRY } from "../data/pokemon-registry";

// ── Domain types ─────────────────────────────────────────────────────

export type TimeLimitKey = "unlimited" | "20s" | "10s" | "5s";
export type QuestionCountKey = 5 | 10 | 20;
export type GameMode = "multiple-choice" | "typing";
export type GamePhase = "cover" | "setup" | "playing" | "results";
export type HintType = "first-letter" | "type" | "region";

export interface TimeOption {
  key: TimeLimitKey;
  label: string;
  seconds: number;
  multiplier: number;
}

export interface QuestionCountOption {
  count: QuestionCountKey;
  baseCelo: number;
}

export interface DifficultyConfig {
  generations: number[];       // e.g. [1], [1, 2, 3], all 9
  timeLimit: TimeLimitKey;
  questionCount: QuestionCountKey;
  gameMode: GameMode;
}

export interface PokemonEntry {
  id: number;
  name: string;
}

export interface Question {
  correct: PokemonEntry;
  choices: PokemonEntry[];    // length 4, shuffled (multiple-choice only)
}

export interface AnswerRecord {
  question: Question;
  chosen: PokemonEntry | null;
  isCorrect: boolean;
  typedText?: string;
  hintsUsed: number;
  timeBonus: number;          // extra points from speed
}

export interface QuizResult {
  answers: AnswerRecord[];
  score: number;
  total: number;
  earnedPoints: number;
  maxPoints: number;
  entryPrice: number;
  maxPrize: number;
  earnedPrize: number;
}

// ── Constants ────────────────────────────────────────────────────────

export const TIME_OPTIONS: TimeOption[] = [
  { key: "unlimited", label: "∞",   seconds: 0,  multiplier: 1.0 },
  { key: "20s",       label: "20s", seconds: 20, multiplier: 1.5 },
  { key: "10s",       label: "10s", seconds: 10, multiplier: 2.0 },
  { key: "5s",        label: "5s",  seconds: 5,  multiplier: 3.0 },
];

export const QUESTION_COUNT_OPTIONS: QuestionCountOption[] = [
  { count: 5,  baseCelo: 0.01 },
  { count: 10, baseCelo: 0.02 },
  { count: 20, baseCelo: 0.05 },
];

export const GAME_MODE_MULTIPLIER: Record<GameMode, number> = {
  "multiple-choice": 1.0,
  "typing":          1.5,
};

export const HINT_PENALTY_PTS = 35;     // deducted per hint used
export const BASE_PTS_PER_Q   = 100;
export const MAX_TIME_BONUS   = 50;

// ── Helpers ──────────────────────────────────────────────────────────

export function calcEraMultiplier(genCount: number): number {
  if (genCount <= 1) return 1.0;
  if (genCount <= 3) return 1.5;
  if (genCount <= 6) return 2.0;
  return 2.5;
}

export function calcEntryPrice(config: DifficultyConfig): number {
  const timeOpt  = TIME_OPTIONS.find((o) => o.key === config.timeLimit)!;
  const base     = QUESTION_COUNT_OPTIONS.find((o) => o.count === config.questionCount)!.baseCelo;
  const eraMult  = calcEraMultiplier(config.generations.length);
  const modeMult = GAME_MODE_MULTIPLIER[config.gameMode];
  return Math.round(base * timeOpt.multiplier * eraMult * modeMult * 10000) / 10000;
}

export function calcMaxPrize(entryPrice: number): number {
  return Math.round(entryPrice * 5 * 10000) / 10000;
}

export function calcMaxPoints(questionCount: number, hasTimer: boolean): number {
  return questionCount * (BASE_PTS_PER_Q + (hasTimer ? MAX_TIME_BONUS : 0));
}

export function calcQuestionPoints(isCorrect: boolean, hintsUsed: number, timeBonus: number): number {
  if (!isCorrect) return 0;
  return Math.max(0, BASE_PTS_PER_Q - hintsUsed * HINT_PENALTY_PTS) + timeBonus;
}

/** Converts "mr-mime" → "Mr Mime", "tapu-koko" → "Tapu Koko" */
export function formatPokemonName(name: string): string {
  return name
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Normalize for typing-mode comparison: strip all non-alphanumeric, lowercase */
export function normalizeForTyping(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function officialArtworkUrl(id: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
}

export function fallbackSpriteUrl(id: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
}

/** Fisher-Yates shuffle — returns a new array */
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function idFromUrl(url: string): number {
  return parseInt(url.split("/").filter(Boolean).at(-1) ?? "0", 10);
}

/** Get region/gen label for a given Pokemon ID */
export function getRegionLabel(id: number): string {
  const g = GEN_REGISTRY.find((r) => id >= r.min && id <= r.max);
  return g ? `${g.region} (${g.label})` : "Unknown";
}
