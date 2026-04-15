import type { QuizResult } from "../../lib/pokemon";
import { formatPokemonName } from "../../lib/pokemon";

interface GameLobbyProps {
  lastResult: QuizResult | null;
  onPlay: () => void;
}

export function GameLobby({ lastResult, onPlay }: GameLobbyProps) {
  return (
    <div className="pokemon-lobby">
      <div className="pokemon-logo">
        <span className="pokemon-silhouette-icon">?</span>
      </div>
      <h3 className="pokemon-title">Who's That Pokemon?</h3>
      <p className="pokemon-tagline">
        Test your Pokedex knowledge across 9 generations
      </p>

      {lastResult && (
        <div className="last-score-box">
          <span className="last-score-label">Last game</span>
          <span className="last-score-value">
            {lastResult.score} / {lastResult.total}
          </span>
          {lastResult.score > 0 && (
            <span className="last-score-hero">
              Got{" "}
              {formatPokemonName(
                lastResult.answers.find((a) => a.isCorrect)?.question.correct
                  .name ?? "",
              )}
              {lastResult.score > 1 && ` +${lastResult.score - 1} more`}
            </span>
          )}
        </div>
      )}

      <button className="btn-primary full-width" onClick={onPlay}>
        Play
      </button>
    </div>
  );
}
