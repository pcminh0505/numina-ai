// Pythagorean numerology calculations based on David A. Phillips' system
// Source: "The Complete Book of Numerology" by David A. Phillips (Hay House)

export interface BirthChart {
  grid: Record<number, number>; // digit → count (1-9, 0 ignored)
  missing: number[];
  present: number[];
}

export interface NumerologyProfile {
  name: string;
  birthday: string;
  rulingNumber: number | string; // 1-9, 10, 11, or '22/4'
  dayNumber: number | string;
  soulUrgeNumber: number | string;
  outerExpressionNumber: number | string;
  birthChart: BirthChart;
  birthDateDigits: number[];
}

// Pythagorean letter-to-number map (A=1...Z=8, no 9 for single letters in standard table)
const LETTER_VALUES: Record<string, number> = {
  A: 1, J: 1, S: 1,
  B: 2, K: 2, T: 2,
  C: 3, L: 3, U: 3,
  D: 4, M: 4, V: 4,
  E: 5, N: 5, W: 5,
  F: 6, O: 6, X: 6,
  G: 7, P: 7, Y: 7,
  H: 8, Q: 8, Z: 8,
  I: 9, R: 9,
};

const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);

// Reduce a number to 1-9 or stop at 10, 11, 22 (special numbers in this system)
function reduceNumber(n: number): number | string {
  while (n > 9 && n !== 10 && n !== 11 && n !== 22) {
    n = String(n)
      .split('')
      .map(Number)
      .reduce((a, b) => a + b, 0);
  }
  return n === 22 ? '22/4' : n;
}

export function calculateRulingNumber(birthday: string): number | string {
  // birthday format: YYYY-MM-DD
  const [year, month, day] = birthday.split('-');
  const digits = `${day}${month}${year}`
    .split('')
    .map(Number);
  const sum = digits.reduce((a, b) => a + b, 0);
  return reduceNumber(sum);
}

export function calculateDayNumber(birthday: string): number | string {
  const day = parseInt(birthday.split('-')[2], 10);
  return reduceNumber(day);
}

export function calculateNameNumber(name: string, vowelsOnly: boolean): number | string {
  const letters = name
    .toUpperCase()
    .split('')
    .filter(c => /[A-Z]/.test(c));

  const filtered = vowelsOnly
    ? letters.filter(c => VOWELS.has(c))
    : letters.filter(c => !VOWELS.has(c));

  if (filtered.length === 0) return 0;

  const sum = filtered
    .map(c => LETTER_VALUES[c] ?? 0)
    .reduce((a, b) => a + b, 0);

  return reduceNumber(sum);
}

export function buildBirthChart(birthday: string): BirthChart {
  const [year, month, day] = birthday.split('-');
  const dateStr = `${day}${month}${year}`;
  const digits = dateStr.split('').map(Number).filter(d => d !== 0);

  const grid: Record<number, number> = {};
  for (let i = 1; i <= 9; i++) grid[i] = 0;
  for (const d of digits) {
    if (d >= 1 && d <= 9) grid[d]++;
  }

  const missing = Object.entries(grid).filter(([, v]) => v === 0).map(([k]) => Number(k));
  const present = Object.entries(grid).filter(([, v]) => v > 0).map(([k]) => Number(k));

  return { grid, missing, present };
}

export function computeNumerologyProfile(name: string, birthday: string): NumerologyProfile {
  const [year, month, day] = birthday.split('-');
  const dateStr = `${day}${month}${year}`;
  const birthDateDigits = dateStr.split('').map(Number);

  return {
    name,
    birthday,
    rulingNumber: calculateRulingNumber(birthday),
    dayNumber: calculateDayNumber(birthday),
    soulUrgeNumber: calculateNameNumber(name, true),
    outerExpressionNumber: calculateNameNumber(name, false),
    birthChart: buildBirthChart(birthday),
    birthDateDigits,
  };
}

export function formatRulingNumber(n: number | string): string {
  if (n === '22/4') return '22/4';
  return String(n);
}

// Convert ruling number to book key for lookup
export function rulingNumberKey(n: number | string): string {
  if (n === '22/4') return '22/4';
  return String(n);
}

// Grid position labels (row from bottom: Physical=1,4,7 | Soul=2,5,8 | Mind=3,6,9)
export const BIRTH_CHART_PLANES = {
  physical: [1, 4, 7],
  soul: [2, 5, 8],
  mind: [3, 6, 9],
};
