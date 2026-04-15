import { useQuery } from "@tanstack/react-query";

interface RawType {
  type: { name: string };
}

interface RawMove {
  move: { name: string };
}

interface RawPokemonDetail {
  types: RawType[];
  moves: RawMove[];
}

export interface PokemonDetail {
  types: string[];
  randomMove: string | null;
}

async function fetchDetail(id: number): Promise<PokemonDetail> {
  const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
  if (!res.ok) throw new Error(`PokeAPI error: ${res.status}`);
  const data: RawPokemonDetail = await res.json();
  const types = data.types.map((t) => t.type.name);
  const moves = data.moves.map((m) => m.move.name);
  // Pick a random move from first 20
  const pool = moves.slice(0, 20);
  const randomMove = pool.length > 0
    ? pool[Math.floor(Math.random() * pool.length)]
    : null;
  return { types, randomMove };
}

export function usePokemonDetail(id: number | null): {
  detail: PokemonDetail | null;
  isLoading: boolean;
} {
  const { data, isLoading } = useQuery({
    queryKey: ["pokemon-detail", id],
    queryFn: () => fetchDetail(id!),
    enabled: id !== null,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  return { detail: data ?? null, isLoading };
}
