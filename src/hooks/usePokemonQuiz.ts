import { useQuery } from "@tanstack/react-query";
import { useReducer, useEffect, useRef } from "react";
import type {
  DifficultyConfig,
  PokemonEntry,
  Question,
  AnswerRecord,
  QuizResult,
  HintType,
} from "../lib/pokemon";
import {
  TIME_OPTIONS,
  calcEntryPrice,
  calcMaxPrize,
  calcMaxPoints,
  calcQuestionPoints,
  normalizeForTyping,
  shuffle,
  idFromUrl,
} from "../lib/pokemon";
import { GEN_REGISTRY } from "../data/pokemon-registry";

// ── PokeAPI ──────────────────────────────────────────────────────────

interface PokeApiEntry { name: string; url: string }
interface PokeApiList  { results: PokeApiEntry[] }

async function fetchAllPokemon(): Promise<PokemonEntry[]> {
  const res = await fetch("https://pokeapi.co/api/v2/pokemon?limit=1025&offset=0");
  if (!res.ok) throw new Error(`PokeAPI ${res.status}`);
  const data: PokeApiList = await res.json();
  return data.results.map((r) => ({ id: idFromUrl(r.url), name: r.name }));
}

// ── State ────────────────────────────────────────────────────────────

export type GameStatus = "idle" | "loading" | "active" | "done";

interface GameState {
  status: GameStatus;
  questions: Question[];
  currentIndex: number;
  answers: AnswerRecord[];
  isRevealed: boolean;
  chosenId: number | null;   // multiple-choice
  chosenText: string | null; // typing mode
  isCorrect: boolean | null;
  timeLeft: number | null;
  config: DifficultyConfig | null;
  result: QuizResult | null;
}

type GameAction =
  | { type: "START";          questions: Question[]; config: DifficultyConfig }
  | { type: "SUBMIT_ANSWER";  chosen: PokemonEntry | null; isCorrect: boolean; typedText?: string; hintsUsed: number; timeBonus: number }
  | { type: "TIMEOUT" }
  | { type: "NEXT_QUESTION" }
  | { type: "TICK" };

const INIT: GameState = {
  status:       "idle",
  questions:    [],
  currentIndex: 0,
  answers:      [],
  isRevealed:   false,
  chosenId:     null,
  chosenText:   null,
  isCorrect:    null,
  timeLeft:     null,
  config:       null,
  result:       null,
};

function timeLimitSeconds(config: DifficultyConfig): number | null {
  const opt = TIME_OPTIONS.find((o) => o.key === config.timeLimit)!;
  return opt.seconds > 0 ? opt.seconds : null;
}

function buildResult(state: GameState, answers: AnswerRecord[]): QuizResult {
  const config   = state.config!;
  const hasTimer = config.timeLimit !== "unlimited";
  const score    = answers.filter((a) => a.isCorrect).length;
  const earned   = answers.reduce((s, a) => s + calcQuestionPoints(a.isCorrect, a.hintsUsed, a.timeBonus), 0);
  const maxPts   = calcMaxPoints(state.questions.length, hasTimer);
  const entry    = calcEntryPrice(config);
  const maxPrize = calcMaxPrize(entry);
  return {
    answers,
    score,
    total:        state.questions.length,
    earnedPoints: earned,
    maxPoints:    maxPts,
    entryPrice:   entry,
    maxPrize,
    earnedPrize:  Math.round((earned / Math.max(maxPts, 1)) * maxPrize * 10000) / 10000,
  };
}

function reducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "START": {
      return {
        ...INIT,
        status:    "active",
        questions: action.questions,
        config:    action.config,
        timeLeft:  timeLimitSeconds(action.config),
      };
    }

    case "SUBMIT_ANSWER": {
      if (state.isRevealed) return state;
      const q       = state.questions[state.currentIndex];
      const newAns: AnswerRecord = {
        question:  q,
        chosen:    action.chosen,
        isCorrect: action.isCorrect,
        typedText: action.typedText,
        hintsUsed: action.hintsUsed,
        timeBonus: action.timeBonus,
      };
      return {
        ...state,
        isRevealed: true,
        chosenId:   action.chosen?.id ?? null,
        chosenText: action.typedText ?? null,
        isCorrect:  action.isCorrect,
        answers:    [...state.answers, newAns],
      };
    }

    case "TIMEOUT": {
      if (state.isRevealed) return state;
      const q = state.questions[state.currentIndex];
      const newAns: AnswerRecord = {
        question:  q,
        chosen:    null,
        isCorrect: false,
        hintsUsed: 0,
        timeBonus: 0,
      };
      return { ...state, isRevealed: true, chosenId: null, isCorrect: false, timeLeft: 0, answers: [...state.answers, newAns] };
    }

    case "TICK": {
      if (state.timeLeft === null || state.isRevealed) return state;
      return { ...state, timeLeft: Math.max(0, state.timeLeft - 1) };
    }

    case "NEXT_QUESTION": {
      if (!state.config) return state;
      const nextIndex = state.currentIndex + 1;
      if (nextIndex >= state.questions.length) {
        return { ...state, status: "done", result: buildResult(state, state.answers) };
      }
      return {
        ...state,
        currentIndex: nextIndex,
        isRevealed:   false,
        chosenId:     null,
        chosenText:   null,
        isCorrect:    null,
        timeLeft:     timeLimitSeconds(state.config),
      };
    }

    default:
      return state;
  }
}

// ── Question builder ─────────────────────────────────────────────────

function buildQuestions(
  allPokemon: PokemonEntry[],
  config: DifficultyConfig,
): Question[] {
  const ranges = GEN_REGISTRY.filter((g) => config.generations.includes(g.gen));
  const pool   = allPokemon.filter((p) =>
    ranges.some((r) => p.id >= r.min && p.id <= r.max),
  );
  const shuffled    = shuffle(pool);
  const correctPicks = shuffled.slice(0, config.questionCount);

  return correctPicks.map((correct) => {
    const wrongPool  = shuffled.filter((p) => p.id !== correct.id);
    const wrongPicks = shuffle(wrongPool).slice(0, 3);
    return { correct, choices: shuffle([correct, ...wrongPicks]) };
  });
}

// ── Public API ───────────────────────────────────────────────────────

export interface UsePokemonQuizReturn {
  status:              GameStatus;
  fetchError:          string | null;
  currentQuestion:     Question | null;
  currentIndex:        number;
  totalQuestions:      number;
  timeLeft:            number | null;
  timeFraction:        number | null;
  isRevealed:          boolean;
  chosenId:            number | null;
  chosenText:          string | null;
  isCorrect:           boolean | null;
  nextQuestionPokemon: PokemonEntry | null;
  result:              QuizResult | null;
  start:               (config: DifficultyConfig) => void;
  submitAnswer:        (chosen: PokemonEntry, hintsUsed: number) => void;
  submitTyping:        (text: string, hintsUsed: number) => void;
  handleTimeout:       () => void;
  nextQuestion:        () => void;
}

export function usePokemonQuiz(): UsePokemonQuizReturn {
  const { data: allPokemon, isLoading, error } = useQuery({
    queryKey: ["pokemon-list"],
    queryFn:  fetchAllPokemon,
    staleTime: Infinity,
    gcTime:    Infinity,
  });

  const [state, dispatch] = useReducer(reducer, INIT);
  const timeLimitRef      = useRef<number | null>(null);
  const pendingConfig     = useRef<DifficultyConfig | null>(null);

  // Auto-start once data arrives if start() was called while loading
  useEffect(() => {
    if (!allPokemon || !pendingConfig.current) return;
    const cfg = pendingConfig.current;
    pendingConfig.current = null;
    timeLimitRef.current  = timeLimitSeconds(cfg);
    dispatch({ type: "START", questions: buildQuestions(allPokemon, cfg), config: cfg });
  }, [allPokemon]);

  // Timer tick
  useEffect(() => {
    if (state.status !== "active" || state.isRevealed || state.timeLeft === null) return;
    if (state.timeLeft <= 0) { dispatch({ type: "TIMEOUT" }); return; }
    const id = setInterval(() => dispatch({ type: "TICK" }), 1000);
    return () => clearInterval(id);
  }, [state.status, state.isRevealed, state.timeLeft]);

  const start = (config: DifficultyConfig) => {
    if (!allPokemon) {
      pendingConfig.current = config;
      return;
    }
    timeLimitRef.current = timeLimitSeconds(config);
    dispatch({ type: "START", questions: buildQuestions(allPokemon, config), config });
  };

  const getTimeBonus = (): number => {
    const maxSec = timeLimitRef.current;
    if (maxSec === null || state.timeLeft === null) return 0;
    return Math.round((state.timeLeft / maxSec) * 50);
  };

  const submitAnswer = (chosen: PokemonEntry, hintsUsed: number) => {
    const q         = state.questions[state.currentIndex];
    const isCorrect = chosen.id === q.correct.id;
    dispatch({ type: "SUBMIT_ANSWER", chosen, isCorrect, hintsUsed, timeBonus: getTimeBonus() });
  };

  const submitTyping = (text: string, hintsUsed: number) => {
    const q         = state.questions[state.currentIndex];
    const isCorrect = normalizeForTyping(text) === normalizeForTyping(q.correct.name);
    dispatch({ type: "SUBMIT_ANSWER", chosen: isCorrect ? q.correct : null, isCorrect, typedText: text, hintsUsed, timeBonus: getTimeBonus() });
  };

  const handleTimeout = () => dispatch({ type: "TIMEOUT" });
  const nextQuestion  = () => dispatch({ type: "NEXT_QUESTION" });

  const currentQuestion = state.status === "active" ? (state.questions[state.currentIndex] ?? null) : null;
  const nextPokemon     = state.status === "active" && state.currentIndex + 1 < state.questions.length
    ? state.questions[state.currentIndex + 1].correct : null;

  const maxSec = timeLimitRef.current;
  const timeFraction = state.timeLeft !== null && maxSec !== null && maxSec > 0
    ? state.timeLeft / maxSec : null;

  const fetchError = error instanceof Error ? error.message : error ? "Failed to load Pokemon" : null;
  const status: GameStatus = state.status === "idle" && isLoading ? "loading" : state.status;

  return {
    status,
    fetchError,
    currentQuestion,
    currentIndex:        state.currentIndex,
    totalQuestions:      state.questions.length,
    timeLeft:            state.timeLeft,
    timeFraction,
    isRevealed:          state.isRevealed,
    chosenId:            state.chosenId,
    chosenText:          state.chosenText,
    isCorrect:           state.isCorrect,
    nextQuestionPokemon: nextPokemon,
    result:              state.result,
    start,
    submitAnswer,
    submitTyping,
    handleTimeout,
    nextQuestion,
  };
}

// Re-export HintType so callers can import from one place
export type { HintType };
