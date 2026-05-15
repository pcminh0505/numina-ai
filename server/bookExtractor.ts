import { readFileSync } from 'fs';
import { join } from 'path';
import type { NumerologyProfile, AdvancedNumerologyProfile } from '../src/lib/numerology.js';

interface RulingNumberData {
  intro: string;
  sections: Record<string, string>;
}

interface BookKnowledge {
  rulingNumbers: Record<string, RulingNumberData>;
  dayNumbers: Record<string, string>;
  names: Record<string, string>;
  birthChart: string;
  numberMeanings: string;
  arrows: string;
}

interface AdvancedBook {
  personalYears: Record<string, string>;
  pinnacles: Record<string, string>;
  challenges: Record<string, string>;
}

let _book: BookKnowledge | null = null;
let _advancedBook: AdvancedBook | null = null;

function loadBook(): BookKnowledge {
  if (_book) return _book;
  const bookPath = join(process.cwd(), 'src/data/numerologyBook.json');
  _book = JSON.parse(readFileSync(bookPath, 'utf-8')) as BookKnowledge;
  return _book;
}

function loadAdvancedBook(): AdvancedBook {
  if (_advancedBook) return _advancedBook;
  const path = join(process.cwd(), 'src/data/advancedNumerology.json');
  _advancedBook = JSON.parse(readFileSync(path, 'utf-8')) as AdvancedBook;
  return _advancedBook;
}

function buildAdvancedContextBlock(profile: AdvancedNumerologyProfile): string {
  const adv = loadAdvancedBook();
  const pyKey = String(profile.personalYear);
  const mainChallengeKey = String(profile.challenges.main);

  // Find the active pinnacle based on a rough current age
  const birthYear = parseInt(profile.birthday.split('-')[0], 10);
  const currentAge = new Date().getFullYear() - birthYear;
  const pinnacles = profile.pinnacles;
  let activePinnacle = pinnacles.fourth;
  if (currentAge <= pinnacles.first.ageEnd) activePinnacle = pinnacles.first;
  else if (currentAge <= pinnacles.second.ageEnd) activePinnacle = pinnacles.second;
  else if (currentAge <= pinnacles.third.ageEnd) activePinnacle = pinnacles.third;

  const pinnacleKey = String(activePinnacle.number);

  const lines: string[] = [
    'ADVANCED NUMEROLOGY CONTEXT',
    '===========================',
    '',
    `Personal Year Number: ${profile.personalYear}`,
    adv.personalYears[pyKey] ? `Personal Year Meaning:\n${adv.personalYears[pyKey]}` : '',
    '',
    `Active Pinnacle: ${activePinnacle.number} (ages ${activePinnacle.ageStart}–${activePinnacle.ageEnd === 999 ? 'life' : activePinnacle.ageEnd})`,
    adv.pinnacles[pinnacleKey] ? `Pinnacle Meaning:\n${adv.pinnacles[pinnacleKey]}` : '',
    '',
    `Main Challenge Number: ${profile.challenges.main}`,
    `Sub-Challenges: First = ${profile.challenges.first}, Second = ${profile.challenges.second}`,
    adv.challenges[mainChallengeKey] ? `Challenge Meaning:\n${adv.challenges[mainChallengeKey]}` : '',
  ];

  return lines.filter(l => l !== undefined).join('\n');
}

function getRulingNumberContent(key: string, book: BookKnowledge): string {
  const data = book.rulingNumbers[key];
  if (!data) return '';

  const sections = [
    `RULING NUMBER ${key}`,
    data.intro,
    ...Object.entries(data.sections).map(([heading, content]) =>
      `${heading}\n${content}`
    ),
  ];
  return sections.join('\n\n');
}

function getDayNumberContent(day: number | string, book: BookKnowledge): string {
  const key = String(day);
  const content = book.dayNumbers[key];
  if (content) return `DAY NUMBER ${key}\n${content}`;

  // For days 12-31 not explicitly in book, find their base number
  const note = book.dayNumbers['_reduction_note'] ?? '';
  return `DAY NUMBER ${key} (reduces to its base number)\n${note}`;
}

export function buildSystemPrompt(
  profile: NumerologyProfile,
  tier: 'free' | 'advanced' = 'free',
): string {
  const book = loadBook();
  const rulingKey = String(profile.rulingNumber);
  const dayKey = String(profile.dayNumber);

  // Compute birth chart description
  const chartDesc = Object.entries(profile.birthChart.grid)
    .filter(([, count]) => count > 0)
    .map(([digit, count]) => `${digit}${'×'.repeat(count)}`)
    .join(', ');

  const missingDesc = profile.birthChart.missing.join(', ');

  const soulKey = String(profile.soulUrgeNumber);
  const outerKey = String(profile.outerExpressionNumber);

  // Extract relevant name sections
  const soulSection = book.names[`Soul Urge ${soulKey}`]
    ? `SOUL URGE NUMBER ${soulKey}\n${book.names[`Soul Urge ${soulKey}`]}`
    : '';

  const outerExpressionSections = Object.entries(book.names)
    .filter(([k]) => k.startsWith('Outer Expression') || k === 'OUTER EXPRESSION NUMBERS')
    .map(([k, v]) => `${k}\n${v}`)
    .join('\n\n')
    .slice(0, 3000);

  const systemPrompt = `You are a warm, sharp numerology consultant — think personal life coach who genuinely finds people fascinating, not a professor reading from a textbook. You use the Pythagorean system from David A. Phillips' "The Complete Book of Numerology" as your knowledge base.

PERSON'S PROFILE
================
Name: ${profile.name}
Birthday: ${profile.birthday}
Ruling Number: ${profile.rulingNumber}
Day Number: ${profile.dayNumber}
Soul Urge: ${profile.soulUrgeNumber}
Outer Expression: ${profile.outerExpressionNumber}
Birth Chart — Present: ${chartDesc || 'none'}
Birth Chart — Missing: ${missingDesc || 'none'}

HOW TO RESPOND
==============
- **Short and punchy.** 2–4 short paragraphs max per message. Never a wall of text.
- **One idea at a time.** Don't dump every number in one response — focus on what's most relevant right now, then invite them to explore more.
- **Talk like a friend who knows their stuff.** Use "you", "your", "${profile.name}" naturally. Rhetorical questions work great ("Ever notice how you...?").
- **Lead with the most interesting or surprising insight first** — hook them before you explain.
- **End every message with one engaging question** to keep the conversation going.
- **Be specific, not generic.** "Your 7 means you need alone time to process" beats "7 is the number of introspection."
- **Positive and real.** Acknowledge challenges honestly but frame them as growth, never as fixed flaws.
- **No academic language.** No "according to Phillips" or "in the Pythagorean system" — just speak directly.
- **Use line breaks** between paragraphs for readability.
- Emojis: 1–2 per message max, only when they add warmth (not decoration).

RELEVANT BOOK PASSAGES
======================

${getRulingNumberContent(rulingKey, book)}

---

${getDayNumberContent(profile.dayNumber as number, book)}

---

SOUL URGE AND OUTER EXPRESSION (Names Chapter)
${book.names['intro']?.slice(0, 1500) ?? ''}

${soulSection}

${outerExpressionSections}

---

NUMBER MEANINGS (1–9)
${book.numberMeanings}

---

BIRTH CHART OVERVIEW (excerpt)
${book.birthChart.slice(0, 4000)}
${tier === 'advanced' ? '\n---\n\n' + buildAdvancedContextBlock(profile as AdvancedNumerologyProfile) : ''}
`;

  return systemPrompt;
}
