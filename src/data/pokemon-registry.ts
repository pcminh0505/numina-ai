// ── Generation registry ──────────────────────────────────────────────

export interface GenInfo {
  gen: number;
  label: string;
  region: string;
  games: string;
  min: number;
  max: number;
  color: string;
}

export const GEN_REGISTRY: readonly GenInfo[] = [
  { gen: 1, label: "Gen I",    region: "Kanto",   games: "Red · Blue · Yellow",        min: 1,   max: 151,  color: "#e63c3c" },
  { gen: 2, label: "Gen II",   region: "Johto",   games: "Gold · Silver · Crystal",    min: 152, max: 251,  color: "#d49a00" },
  { gen: 3, label: "Gen III",  region: "Hoenn",   games: "Ruby · Sapphire · Emerald",  min: 252, max: 386,  color: "#3a9e52" },
  { gen: 4, label: "Gen IV",   region: "Sinnoh",  games: "Diamond · Pearl · Platinum", min: 387, max: 493,  color: "#4a8ed9" },
  { gen: 5, label: "Gen V",    region: "Unova",   games: "Black · White",              min: 494, max: 649,  color: "#7b5ea7" },
  { gen: 6, label: "Gen VI",   region: "Kalos",   games: "X · Y",                      min: 650, max: 721,  color: "#0d9488" },
  { gen: 7, label: "Gen VII",  region: "Alola",   games: "Sun · Moon",                 min: 722, max: 809,  color: "#e06820" },
  { gen: 8, label: "Gen VIII", region: "Galar",   games: "Sword · Shield",             min: 810, max: 905,  color: "#3a4a7e" },
  { gen: 9, label: "Gen IX",   region: "Paldea",  games: "Scarlet · Violet",           min: 906, max: 1025, color: "#b94090" },
] as const;

export function getGenForId(id: number): GenInfo | undefined {
  return GEN_REGISTRY.find((g) => id >= g.min && id <= g.max);
}

export function filterByGens(
  pokemon: ReadonlyArray<{ id: number }>,
  genNumbers: number[],
): Array<{ id: number }> {
  if (genNumbers.length === 0) return [...pokemon];
  const ranges = GEN_REGISTRY.filter((g) => genNumbers.includes(g.gen));
  return (pokemon as Array<{ id: number }>).filter((p) =>
    ranges.some((r) => p.id >= r.min && p.id <= r.max),
  );
}

// ── Type colors ──────────────────────────────────────────────────────

export const TYPE_COLORS: Record<string, string> = {
  normal:   "#a8a878",
  fire:     "#f08030",
  water:    "#6890f0",
  electric: "#f8d030",
  grass:    "#78c850",
  ice:      "#98d8d8",
  fighting: "#c03028",
  poison:   "#a040a0",
  ground:   "#e0c068",
  flying:   "#a890f0",
  psychic:  "#f85888",
  bug:      "#a8b820",
  rock:     "#b8a038",
  ghost:    "#705898",
  dragon:   "#7038f8",
  dark:     "#705848",
  steel:    "#b8b8d0",
  fairy:    "#ee99ac",
  stellar:  "#40b5a5",
};

// Iconic Pokemon to cycle through on the cover screen
export const COVER_POKEMON_IDS = [25, 6, 94, 143, 150, 133, 448, 249, 384, 487];
