import type { QuizResult, DifficultyConfig } from "../../lib/pokemon";
import { formatPokemonName } from "../../lib/pokemon";
import { GEN_REGISTRY } from "../../data/pokemon-registry";

interface GameResultsProps {
  result:     QuizResult;
  config:     DifficultyConfig;
  onPlayAgain: () => void;
}

function scoreMessage(score: number, total: number): string {
  const pct = score / total;
  if (pct === 1)   return "Perfect! You're a Pokémon Master! 🏆";
  if (pct >= 0.8)  return "Incredible trainer! Almost perfect!";
  if (pct >= 0.6)  return "Nice work, keep training!";
  if (pct >= 0.4)  return "Not bad — back to the Pokédex!";
  return "Team Rocket approves… back to basics!";
}

export function GameResults({ result, config, onPlayAgain }: GameResultsProps) {
  const { answers, score, total, earnedPoints, maxPoints, entryPrice, maxPrize, earnedPrize } = result;
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;

  const genLabels = GEN_REGISTRY
    .filter((g) => config.generations.includes(g.gen))
    .map((g) => g.label)
    .join(", ");

  return (
    <div className="pokemon-results poke-screen-enter">

      {/* Score headline */}
      <div className="results-score-block">
        <div className="results-score-ring">
          <svg viewBox="0 0 64 64" className="score-ring-svg">
            <circle cx="32" cy="32" r="28" className="score-ring-bg" />
            <circle
              cx="32" cy="32" r="28"
              className="score-ring-fill"
              strokeDasharray={`${2 * Math.PI * 28}`}
              strokeDashoffset={`${2 * Math.PI * 28 * (1 - pct / 100)}`}
            />
          </svg>
          <div className="score-ring-text">
            <span className="score-ring-num">{score}</span>
            <span className="score-ring-denom">/{total}</span>
          </div>
        </div>
        <p className="results-message">{scoreMessage(score, total)}</p>
        <p className="results-meta">{genLabels} · {config.gameMode === "typing" ? "Typing" : "Choice"}</p>
      </div>

      {/* Points bar */}
      <div className="points-bar-wrap">
        <div className="points-bar-label">
          <span>Points</span>
          <span className="points-value">{earnedPoints} / {maxPoints}</span>
        </div>
        <div className="points-bar-track">
          <div
            className="points-bar-fill"
            style={{ width: `${maxPoints > 0 ? (earnedPoints / maxPoints) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Per-question breakdown */}
      <div className="results-summary">
        {answers.map((rec, i) => {
          const name       = formatPokemonName(rec.question.correct.name);
          const chosenName = rec.typedText
            ? rec.typedText
            : rec.chosen
              ? formatPokemonName(rec.chosen.name)
              : "Timed out";
          return (
            <div key={i} className={`result-row${rec.isCorrect ? " correct" : " wrong"}`}>
              <span className="result-icon">{rec.isCorrect ? "✓" : "✗"}</span>
              <span className="result-pokemon-name">{name}</span>
              {!rec.isCorrect && (
                <span className="result-chosen-name">{chosenName}</span>
              )}
              {rec.hintsUsed > 0 && (
                <span className="result-hint-used">💡×{rec.hintsUsed}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Prize box */}
      <div className="prize-result-box">
        <div className="prize-result-row">
          <span>Entry</span>
          <span>{entryPrice.toFixed(4)} CELO</span>
        </div>
        <div className="prize-result-row">
          <span>Max reward</span>
          <span>{maxPrize.toFixed(4)} CELO</span>
        </div>
        <div className="prize-result-divider" />
        <div className="prize-result-earned">
          <span>You earned</span>
          <span className="prize-earned-value">{earnedPrize.toFixed(4)} CELO</span>
        </div>
        <p className="prize-disclaimer">Display only — no transaction yet</p>
      </div>

      <button className="btn-primary full-width" onClick={onPlayAgain}>
        Play Again
      </button>
    </div>
  );
}
