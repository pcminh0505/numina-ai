import { useEffect, useRef, useState } from "react";
import type { DifficultyConfig, PokemonEntry, QuizResult, HintType } from "../../lib/pokemon";
import {
  formatPokemonName,
  officialArtworkUrl,
  fallbackSpriteUrl,
  getRegionLabel,
  HINT_PENALTY_PTS,
} from "../../lib/pokemon";
import { usePokemonQuiz } from "../../hooks/usePokemonQuiz";
import { usePokemonDetail } from "../../hooks/usePokemonDetail";
import { TYPE_COLORS } from "../../data/pokemon-registry";

interface GamePlayProps {
  config:   DifficultyConfig;
  onFinish: (result: QuizResult) => void;
}

/** Build the pool of eligible hint types for the current config. */
function buildHintPool(config: DifficultyConfig): HintType[] {
  const pool: HintType[] = ["type"];
  // 1st-letter too easy for multiple-choice
  if (config.gameMode === "typing") pool.push("first-letter");
  // Region only meaningful when spanning multiple generations
  if (config.generations.length > 1) pool.push("region");
  return pool;
}

export function GamePlay({ config, onFinish }: GamePlayProps) {
  const quiz = usePokemonQuiz();
  const {
    status, fetchError, currentQuestion, currentIndex, totalQuestions,
    timeLeft, timeFraction, isRevealed, chosenId, chosenText, isCorrect,
    nextQuestionPokemon, result,
    start, submitAnswer, submitTyping, nextQuestion, handleTimeout,
  } = quiz;

  const { detail: pokemonDetail } = usePokemonDetail(
    currentQuestion?.correct.id ?? null,
  );

  const startedRef = useRef(false);
  useEffect(() => {
    if (!startedRef.current) { startedRef.current = true; start(config); }
  }, [config, start]);

  useEffect(() => {
    if (status === "done" && result) onFinish(result);
  }, [status, result, onFinish]);

  // ── Hint state: one random hint per question ────────────────────────
  const [assignedHint, setAssignedHint] = useState<HintType>("type");
  const [hintUsed, setHintUsed] = useState(false);

  useEffect(() => {
    const pool = buildHintPool(config);
    const picked = pool[Math.floor(Math.random() * pool.length)];
    setAssignedHint(picked);
    setHintUsed(false);
  }, [currentIndex, config]);

  // ── Typing input ────────────────────────────────────────────────────
  const [typedValue, setTypedValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!isRevealed && config.gameMode === "typing") {
      setTypedValue("");
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [currentIndex, isRevealed, config.gameMode]);

  if (status === "loading" || status === "idle") {
    return (
      <div className="pokemon-loading poke-screen-enter">
        <div className="pokemon-loading-spinner" />
        <p>Loading Pokédex…</p>
      </div>
    );
  }

  if (fetchError) {
    return <div className="error poke-screen-enter" style={{ padding: "16px 0" }}>{fetchError}</div>;
  }

  if (!currentQuestion) return null;

  const { correct, choices } = currentQuestion;
  const isLast           = currentIndex + 1 >= totalQuestions;
  const isMultipleChoice = config.gameMode === "multiple-choice";
  const hintsUsed        = hintUsed ? 1 : 0;

  // Timer styling
  const timerWarning = timeFraction !== null && timeFraction < 0.4;
  const timerDanger  = timeFraction !== null && timeFraction < 0.2;
  const timerClass   = ["timer-bar-fill", timerDanger ? "danger" : timerWarning ? "warning" : ""].filter(Boolean).join(" ");

  // Multiple-choice button class
  const choiceClass = (p: PokemonEntry): string => {
    if (!isRevealed) return "choice-btn";
    if (p.id === correct.id && p.id === chosenId) return "choice-btn correct";
    if (p.id === chosenId && p.id !== correct.id) return "choice-btn wrong";
    if (p.id === correct.id && chosenId !== correct.id) return "choice-btn correct-unselected";
    return "choice-btn";
  };

  const typingCorrect = isRevealed && isCorrect === true;

  const handleTypingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedValue.trim() || isRevealed) return;
    submitTyping(typedValue.trim(), hintsUsed);
  };

  const handleChoiceClick = (p: PokemonEntry) => {
    if (isRevealed) return;
    submitAnswer(p, hintsUsed);
  };

  const handleGiveUp = () => {
    if (isRevealed) return;
    handleTimeout();
  };

  const handleUseHint = () => {
    if (hintUsed || isRevealed) return;
    setHintUsed(true);
  };

  // Render the used hint chip(s)
  const renderHintContent = () => {
    switch (assignedHint) {
      case "first-letter":
        return (
          <span className="hint-chip">
            Starts with <strong>{formatPokemonName(correct.name).charAt(0)}</strong>
          </span>
        );
      case "type":
        return pokemonDetail
          ? pokemonDetail.types.map((t) => (
            <span
              key={t}
              className="hint-chip type-chip"
              style={{
                background: `${TYPE_COLORS[t] ?? "#888"}33`,
                borderColor: TYPE_COLORS[t] ?? "#888",
                color: TYPE_COLORS[t] ?? "#888",
              }}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </span>
          ))
          : <span className="hint-chip">…</span>;
      case "region":
        return <span className="hint-chip">{getRegionLabel(correct.id)}</span>;
    }
  };

  return (
    <div className="pokemon-gameplay poke-screen-enter">

      {/* Progress header */}
      <div className="quiz-progress">
        <span>
          <span className="quiz-progress-count">{currentIndex + 1}</span>
          <span className="quiz-progress-sep"> / {totalQuestions}</span>
        </span>
        <span className="quiz-score-live">
          {isLast ? "Last one!" : `${config.gameMode === "typing" ? "✍ Typing" : "◉ Choice"}`}
        </span>
        {timeLeft !== null && (
          <span className={`quiz-timer-text${timerDanger ? " danger" : timerWarning ? " warning" : ""}`}>
            {timeLeft}s
          </span>
        )}
      </div>

      {/* Timer bar */}
      {timeFraction !== null && (
        <div className="timer-bar-track">
          <div className={timerClass} style={{ width: `${Math.max(0, timeFraction * 100)}%` }} />
        </div>
      )}

      {/* Silhouette */}
      <p className="whos-that-label">Who's that Pokémon?</p>
      <div className="sprite-wrapper" key={currentIndex}>
        <img
          src={officialArtworkUrl(correct.id)}
          alt={isRevealed ? formatPokemonName(correct.name) : "Who's that Pokemon?"}
          className={`pokemon-sprite${isRevealed ? " revealed" : ""}`}
          onError={(e) => {
            const img = e.currentTarget;
            if (!img.src.includes("official-artwork")) return;
            img.src = fallbackSpriteUrl(correct.id);
          }}
        />
        {isRevealed && (
          <p className={`reveal-name${isCorrect ? " correct" : " wrong"}`}>
            {formatPokemonName(correct.name)}
          </p>
        )}
      </div>

      {/* Hint row — only while question is active */}
      {!isRevealed && (
        <div className="hint-row">
          {!hintUsed ? (
            <button className="hint-mystery-btn" onClick={handleUseHint}>
              <span className="hint-mystery-icon">💡</span>
              <span className="hint-mystery-label">Hint</span>
              <span className="hint-mystery-cost">−{HINT_PENALTY_PTS} pts</span>
            </button>
          ) : (
            <div className="hint-revealed-row">
              {renderHintContent()}
              <span className="hint-penalty">−{HINT_PENALTY_PTS} pts</span>
            </div>
          )}

          <button className="give-up-btn" onClick={handleGiveUp}>
            Give up
          </button>
        </div>
      )}

      {/* Multiple choice */}
      {isMultipleChoice && (
        <div className="pokemon-choices">
          {choices.map((p, i) => (
            <button
              key={p.id}
              className={choiceClass(p)}
              disabled={isRevealed}
              onClick={() => handleChoiceClick(p)}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {formatPokemonName(p.name)}
            </button>
          ))}
        </div>
      )}

      {/* Typing mode */}
      {!isMultipleChoice && !isRevealed && (
        <form className="typing-form" onSubmit={handleTypingSubmit}>
          <input
            ref={inputRef}
            className="typing-input"
            value={typedValue}
            onChange={(e) => setTypedValue(e.target.value)}
            placeholder="Type the Pokémon's name…"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          <button type="submit" className="btn-primary full-width" disabled={!typedValue.trim()}>
            Submit
          </button>
        </form>
      )}

      {/* Typing result feedback */}
      {!isMultipleChoice && isRevealed && (
        <div className={`typing-feedback${typingCorrect ? " correct" : " wrong"}`}>
          {typingCorrect
            ? <span>✓ Correct!</span>
            : (
              <span>
                ✗ You typed: <em>{chosenText ?? "(gave up)"}</em>
              </span>
            )}
        </div>
      )}

      {/* Next button */}
      {isRevealed && (
        <button className="btn-primary full-width" style={{ marginTop: 14 }} onClick={nextQuestion}>
          {isLast ? "See Results" : "Next →"}
        </button>
      )}

      {/* Preload next sprite */}
      {nextQuestionPokemon && (
        <img
          src={officialArtworkUrl(nextQuestionPokemon.id)}
          alt=""
          style={{ display: "none" }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
