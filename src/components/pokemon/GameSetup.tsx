import { useState } from "react";
import type { DifficultyConfig, TimeLimitKey, QuestionCountKey, GameMode } from "../../lib/pokemon";
import { TIME_OPTIONS, QUESTION_COUNT_OPTIONS, calcEntryPrice, calcMaxPrize } from "../../lib/pokemon";
import { GEN_REGISTRY } from "../../data/pokemon-registry";

interface GameSetupProps {
  onStart: (config: DifficultyConfig) => void;
  onBack:  () => void;
}

export function GameSetup({ onStart, onBack }: GameSetupProps) {
  const [generations, setGenerations]   = useState<number[]>([1]);
  const [timeLimit, setTimeLimit]       = useState<TimeLimitKey>("unlimited");
  const [questionCount, setCount]       = useState<QuestionCountKey>(10);
  const [gameMode, setGameMode]         = useState<GameMode>("multiple-choice");

  const toggleGen = (gen: number) => {
    setGenerations((prev) =>
      prev.includes(gen) ? (prev.length > 1 ? prev.filter((g) => g !== gen) : prev) : [...prev, gen],
    );
  };

  const allSelected  = generations.length === GEN_REGISTRY.length;
  const toggleAll    = () => setGenerations(allSelected ? [1] : GEN_REGISTRY.map((g) => g.gen));

  const config: DifficultyConfig = { generations, timeLimit, questionCount, gameMode };
  const entry    = calcEntryPrice(config);
  const maxPrize = calcMaxPrize(entry);

  return (
    <div className="pokemon-setup poke-screen-enter">
      <div className="setup-header">
        <button className="btn-back" onClick={onBack} aria-label="Back">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h3 className="setup-title">Choose Difficulty</h3>
      </div>

      {/* Generation multi-select */}
      <div className="setup-section">
        <div className="setup-label-row">
          <label className="setup-label">Generations</label>
          <button className={`gen-all-btn${allSelected ? " selected" : ""}`} onClick={toggleAll}>
            {allSelected ? "Deselect All" : "All"}
          </button>
        </div>
        <div className="gen-grid">
          {GEN_REGISTRY.map(({ gen, label, region, color }) => {
            const selected = generations.includes(gen);
            return (
              <button
                key={gen}
                className={`gen-btn${selected ? " selected" : ""}`}
                style={selected ? { "--gen-color": color } as React.CSSProperties : undefined}
                onClick={() => toggleGen(gen)}
              >
                <span className="gen-btn-num">{label}</span>
                <span className="gen-btn-region">{region}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Game mode */}
      <div className="setup-section">
        <label className="setup-label">Game Mode</label>
        <div className="option-group">
          <button
            className={`option-btn mode-btn${gameMode === "multiple-choice" ? " selected" : ""}`}
            onClick={() => setGameMode("multiple-choice")}
          >
            <span className="mode-icon">◉</span>
            <span>Multiple Choice</span>
          </button>
          <button
            className={`option-btn mode-btn${gameMode === "typing" ? " selected" : ""}`}
            onClick={() => setGameMode("typing")}
          >
            <span className="mode-icon">✍</span>
            <span>Typing <span className="mode-hard-badge">HARD</span></span>
          </button>
        </div>
      </div>

      {/* Time per question */}
      <div className="setup-section">
        <label className="setup-label">Time per question</label>
        <div className="option-group">
          {TIME_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              className={`option-btn${timeLimit === opt.key ? " selected" : ""}`}
              onClick={() => setTimeLimit(opt.key)}
            >
              {opt.label}
              {opt.multiplier > 1 && <span className="option-mult"> {opt.multiplier}×</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Questions */}
      <div className="setup-section">
        <label className="setup-label">Questions</label>
        <div className="option-group">
          {QUESTION_COUNT_OPTIONS.map((opt) => (
            <button
              key={opt.count}
              className={`option-btn${questionCount === opt.count ? " selected" : ""}`}
              onClick={() => setCount(opt.count)}
            >
              {opt.count}
            </button>
          ))}
        </div>
      </div>

      {/* Prize preview */}
      <div className="prize-preview">
        <div className="prize-preview-label">Entry</div>
        <div className="prize-preview-value">{entry.toFixed(4)} CELO</div>
        <div className="prize-preview-sub">
          Max reward: <strong>{maxPrize.toFixed(4)} CELO</strong>
        </div>
      </div>

      <button className="btn-primary full-width" onClick={() => onStart(config)}>
        Start Quiz
      </button>
    </div>
  );
}
