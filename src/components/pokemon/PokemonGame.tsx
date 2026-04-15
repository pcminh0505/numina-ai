import { useState } from "react";
import type { DifficultyConfig, GamePhase, QuizResult } from "../../lib/pokemon";
import { GameCover }   from "./GameCover";
import { GameSetup }   from "./GameSetup";
import { GamePlay }    from "./GamePlay";
import { GameResults } from "./GameResults";

export function PokemonGame() {
  const [phase,      setPhase]      = useState<GamePhase>("cover");
  const [config,     setConfig]     = useState<DifficultyConfig | null>(null);
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);

  const handleStart = (cfg: DifficultyConfig) => {
    setConfig(cfg);
    setPhase("playing");
  };

  const handleFinish = (result: QuizResult) => {
    setQuizResult(result);
    setPhase("results");
  };

  return (
    <div className="pokemon-game-card">
      {phase === "cover" && (
        <GameCover lastResult={quizResult} onPlay={() => setPhase("setup")} />
      )}
      {phase === "setup" && (
        <GameSetup onStart={handleStart} onBack={() => setPhase("cover")} />
      )}
      {phase === "playing" && config && (
        <GamePlay config={config} onFinish={handleFinish} />
      )}
      {phase === "results" && quizResult && config && (
        <GameResults
          result={quizResult}
          config={config}
          onPlayAgain={() => setPhase("cover")}
        />
      )}
    </div>
  );
}
