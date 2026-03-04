/**
 * Seed 200 IELTS Vocabulary articles to Supabase PostgreSQL.
 * 50 Speaking | 50 Writing | 50 Reading | 50 Listening
 * Each article ≥ 500 words with band-level vocabulary tables.
 *
 * Run: SUPABASE_DB_URL="..." npx ts-node scripts/seed-vocabulary-articles.ts
 */
import { randomBytes } from 'crypto';
import { Pool } from 'pg';

const SUPABASE_DB_URL = process.env.SUPABASE_DB_URL || '';
const generateId = (): string => randomBytes(12).toString('hex');
function slugify(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

type V = [string, string, string, string]; // [word, pos, definition, example]

interface Topic {
  title: string;
  mod: 'speaking' | 'writing' | 'reading' | 'listening';
  tag: string;
  intro: string;
  b56: V[]; b67: V[]; b78: V[]; b89: V[];
  colls: [string, string][];
  mistakes: string[];
  tips: string[];
  faq: [string, string];
}

function buildBody(t: Topic): string {
  const M = t.mod.charAt(0).toUpperCase() + t.mod.slice(1);
  const tbl = (rows: V[], label: string) => {
    let s = `### ${label}\n\n| Word / Phrase | Part of Speech | Definition | Example Sentence |\n|---|---|---|---|\n`;
    rows.forEach(([w, p, d, e]) => { s += `| ${w} | ${p} | ${d} | ${e} |\n`; });
    return s + '\n';
  };
  let b = `# ${t.title}\n\n${t.intro}\n\n`;
  b += `## Essential Vocabulary by Band Level\n\nThe tables below group the most useful vocabulary for this topic by target band score. Start with the band closest to your current level and work upward.\n\n`;
  b += tbl(t.b56, 'Band 5–6: Foundation Level');
  b += tbl(t.b67, 'Band 6–7: Intermediate Level');
  b += tbl(t.b78, 'Band 7–8: Advanced Level');
  b += tbl(t.b89, 'Band 8–9: Expert Level');
  b += `## Key Collocations\n\n| Collocation | Example Sentence |\n|---|---|\n`;
  t.colls.forEach(([c, e]) => { b += `| ${c} | ${e} |\n`; });
  b += '\n## Common Mistakes to Avoid\n\n';
  t.mistakes.forEach(m => { b += `- ${m}\n`; });
  b += `\n## Practice Tips for IELTS ${M}\n\n`;
  t.tips.forEach((tip, i) => { b += `${i + 1}. ${tip}\n`; });
  b += `\n## Frequently Asked Question\n\n**${t.faq[0]}**\n\n${t.faq[1]}\n\n`;
  b += `## Key Takeaway\n\nBuilding strong vocabulary for this topic is one of the fastest ways to improve your IELTS ${M} band score. Focus on learning words in context rather than memorising isolated definitions. Start with the band level closest to your target, practise using each word in full sentences, and gradually move to higher-band vocabulary as your confidence grows. Consistent daily review using spaced repetition will help these words become part of your active vocabulary.\n`;
  return b;
}

