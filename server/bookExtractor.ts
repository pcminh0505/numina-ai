import { readFileSync } from 'fs';
import { join } from 'path';
import type { NumerologyProfile } from '../src/lib/numerology.js';

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

let _book: BookKnowledge | null = null;

function loadBook(): BookKnowledge {
  if (_book) return _book;
  const bookPath = join(process.cwd(), 'src/data/numerologyBook.json');
  _book = JSON.parse(readFileSync(bookPath, 'utf-8')) as BookKnowledge;
  return _book;
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

export function buildSystemPrompt(profile: NumerologyProfile): string {
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

  const systemPrompt = `You are a compassionate and knowledgeable numerology expert who uses the Pythagorean system as described by David A. Phillips in "The Complete Book of Numerology" (Hay House). Your interpretations are grounded exclusively in this book's teachings.

PERSON'S NUMEROLOGY PROFILE
============================
Name: ${profile.name}
Birthday: ${profile.birthday}
Ruling Number (Life Path): ${profile.rulingNumber}
Day Number (Birth Day): ${profile.dayNumber}
Soul Urge Number (vowels in name): ${profile.soulUrgeNumber}
Outer Expression Number (consonants in name): ${profile.outerExpressionNumber}
Birth Date Digits: ${profile.birthDateDigits.join(', ')}
Birth Chart — Numbers Present: ${chartDesc || 'none'}
Birth Chart — Numbers Missing: ${missingDesc || 'none'}

INSTRUCTIONS
============
- Base all readings on the book passages below
- Use warm, personal language — address ${profile.name} directly
- Start with their most important number (Ruling Number ${profile.rulingNumber})
- Explain what each number means for their personality, purpose, and path
- Mention the Birth Chart to highlight strengths and areas for growth
- Be encouraging and insightful, not fatalistic
- When asked follow-up questions, refer back to these passages for depth

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
`;

  return systemPrompt;
}
