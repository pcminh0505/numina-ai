import { useState, useEffect } from "react";
import { officialArtworkUrl, fallbackSpriteUrl } from "../../lib/pokemon";
import { COVER_POKEMON_IDS } from "../../data/pokemon-registry";
import type { QuizResult } from "../../lib/pokemon";

interface GameCoverProps {
  lastResult: QuizResult | null;
  onPlay: () => void;
}

export function GameCover({ lastResult, onPlay }: GameCoverProps) {
  const [coverIdx, setCoverIdx] = useState(0);

  // Cycle through iconic Pokemon every 3 seconds
  useEffect(() => {
    const id = setInterval(() => {
      setCoverIdx((i) => (i + 1) % COVER_POKEMON_IDS.length);
    }, 3000);
    return () => clearInterval(id);
  }, []);

  const pokemonId = COVER_POKEMON_IDS[coverIdx];

  return (
    <div className="game-cover">
      {/* Banner: cover.png as background, silhouette floats over the burst */}
      <div className="cover-banner">
        <img
          key={pokemonId}
          src={officialArtworkUrl(pokemonId)}
          alt="Who's that Pokemon?"
          className="cover-silhouette"
          onError={(e) => {
            const img = e.currentTarget;
            if (!img.src.includes("official-artwork")) return;
            img.src = fallbackSpriteUrl(pokemonId);
          }}
        />
      </div>

      {/* Title bar below the split */}
      <div className="cover-title-bar">
        <h2 className="cover-whos-that">Who's that Pokémon?</h2>
        <p className="cover-subtitle">Test your Pokédex knowledge</p>
      </div>

      {/* Last score badge */}
      {lastResult && (
        <div className="cover-last-score">
          <span className="cover-last-label">Last game</span>
          <span className="cover-last-value">
            {lastResult.score}/{lastResult.total} · {lastResult.earnedPoints}pts
          </span>
        </div>
      )}

      <button className="btn-primary full-width cover-play-btn" onClick={onPlay}>
        Play
      </button>
    </div>
  );
}
