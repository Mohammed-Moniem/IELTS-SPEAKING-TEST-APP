#!/usr/bin/env node
/**
 * seed-library-40k.js
 * Seeds 20,000+ vocabulary (lexicon) entries and 20,000+ collocation entries
 * into Supabase for the IELTS Learner Library.
 *
 * Data is loaded from scripts/library-data/group{1..4}.js
 *
 * Tables:
 *   lexicon_entries      (id TEXT, data JSONB, created_at, updated_at)
 *   collocation_entries   (id TEXT, data JSONB, created_at, updated_at)
 *
 * Unique indexes:
 *   lexicon_entries:     lower(data->>'lemma')  + data->>'module'
 *   collocation_entries: lower(data->>'phrase')  + data->>'module'
 *
 * Usage:
 *   SUPABASE_DB_URL="postgresql://..." node scripts/seed-library-40k.js
 *   SUPABASE_DB_URL="..." node scripts/seed-library-40k.js --vocab-only
 *   SUPABASE_DB_URL="..." node scripts/seed-library-40k.js --collocations-only
 */

'use strict';

const { Pool } = require('pg');
const { randomBytes } = require('crypto');
const path = require('path');

/* ------------------------------------------------------------------ */
/*  CONFIGURATION                                                      */
/* ------------------------------------------------------------------ */

const MODULES = ['speaking', 'writing', 'reading', 'listening'];
const BATCH_SIZE = 200; // rows per INSERT statement
const DATA_FILES = [
  path.join(__dirname, 'library-data', 'group1.js'),
  path.join(__dirname, 'library-data', 'group2.js'),
  path.join(__dirname, 'library-data', 'group3.js'),
  path.join(__dirname, 'library-data', 'group4.js'),
  path.join(__dirname, 'library-data', 'group5.js'),
  path.join(__dirname, 'library-data', 'group6.js'),
  path.join(__dirname, 'library-data', 'group7.js'),
];

const CEFR_BAND_MAP = {
  A2: [4, 5],
  B1: [5, 6],
  B2: [6, 7.5],
  C1: [7, 8.5],
  C2: [8.5, 9],
};

const CEFR_QUALITY = {
  A2: 0.82,
  B1: 0.85,
  B2: 0.88,
  C1: 0.90,
  C2: 0.93,
};

/* ------------------------------------------------------------------ */
/*  HELPERS                                                            */
/* ------------------------------------------------------------------ */

const id = () => randomBytes(12).toString('hex');

function cefrToBands(cefr) {
  const [min, max] = CEFR_BAND_MAP[cefr] || [5, 7];
  return { bandTargetMin: min, bandTargetMax: max };
}

/** Deterministic but varied frequency rank based on word and cefr */
function frequencyRank(word, cefr) {
  const hash = [...word].reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
  const base = { A2: 500, B1: 1500, B2: 3000, C1: 5500, C2: 8000 }[cefr] || 3000;
  return base + (Math.abs(hash) % 1500);
}

/* ------------------------------------------------------------------ */
/*  EXAMPLE GENERATION                                                 */
/* ------------------------------------------------------------------ */

/**
 * Generates module-specific example sentences for vocabulary words.
 */
function vocabExamples(lemma, pos, definition, topic, cefr, mod) {
  const T = topic.charAt(0).toUpperCase() + topic.slice(1);
  const templates = {
    speaking: [
      `In my experience, the word '${lemma}' is something I often use when discussing ${topic}-related topics.`,
      `When speaking about ${topic}, I would describe something as ${pos === 'adj' ? lemma : `involving ${lemma}`}.`,
    ],
    writing: [
      `${T} experts argue that ${lemma} plays a critical role in modern discourse.`,
      `One could posit that ${lemma}, meaning ${definition.toLowerCase()}, is central to any ${topic} essay.`,
    ],
    reading: [
      `The passage explains how ${lemma} has become increasingly relevant to ${topic} in recent years.`,
      `According to the text, ${lemma} is defined as ${definition.toLowerCase()}.`,
    ],
    listening: [
      `The speaker emphasises that ${lemma} is a key concept in ${topic} discussions.`,
      `In the lecture, the professor describes ${lemma} as ${definition.toLowerCase()}.`,
    ],
  };
  return templates[mod] || templates.speaking;
}

/**
 * Generates module-specific example sentences for collocations.
 */
function collocationExamples(phrase, meaning, topic, cefr, mod) {
  const T = topic.charAt(0).toUpperCase() + topic.slice(1);
  const templates = {
    speaking: [
      `I would say that people often ${phrase} when dealing with ${topic} issues.`,
      `In everyday conversation about ${topic}, you might hear someone ${phrase}.`,
    ],
    writing: [
      `${T} policies should ${phrase} in order to address current challenges effectively.`,
      `It is widely acknowledged that governments must ${phrase} to improve ${topic} outcomes.`,
    ],
    reading: [
      `The author argues that it is essential to ${phrase} when considering ${topic} reforms.`,
      `According to recent research, organisations that ${phrase} tend to achieve better ${topic} results.`,
    ],
    listening: [
      `The speaker notes that professionals frequently ${phrase} in the ${topic} sector.`,
      `During the discussion, the expert mentions the importance of being able to ${phrase}.`,
    ],
  };
  return templates[mod] || templates.speaking;
}

/* ------------------------------------------------------------------ */
/*  DATA LOADING                                                       */
/* ------------------------------------------------------------------ */

function loadAllData() {
  const allVocab = {};     // topic -> entries[]
  const allCollocations = {}; // topic -> entries[]

  for (const file of DATA_FILES) {
    let mod;
    try {
      mod = require(file);
    } catch (err) {
      console.warn(`⚠ Skipping ${path.basename(file)}: ${err.message}`);
      continue;
    }
    if (mod.vocab) {
      for (const [topic, entries] of Object.entries(mod.vocab)) {
        allVocab[topic] = (allVocab[topic] || []).concat(entries);
      }
    }
    if (mod.collocations) {
      for (const [topic, entries] of Object.entries(mod.collocations)) {
        allCollocations[topic] = (allCollocations[topic] || []).concat(entries);
      }
    }
  }
  return { allVocab, allCollocations };
}

/* ------------------------------------------------------------------ */
/*  BATCH INSERT                                                       */
/* ------------------------------------------------------------------ */

async function batchInsert(pool, table, rows) {
  if (rows.length === 0) return 0;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const values = [];
    const params = [];
    let idx = 1;

    for (const row of chunk) {
      values.push(`($${idx}, $${idx + 1}::jsonb, now(), now())`);
      params.push(row.id, JSON.stringify(row.data));
      idx += 2;
    }

    const sql = `
      INSERT INTO ${table} (id, data, created_at, updated_at)
      VALUES ${values.join(',\n       ')}
      ON CONFLICT (id) DO NOTHING
    `;

    try {
      const res = await pool.query(sql, params);
      inserted += res.rowCount;
    } catch (err) {
      // If batch fails, try individual inserts
      for (const row of chunk) {
        try {
          await pool.query(
            `INSERT INTO ${table} (id, data, created_at, updated_at)
             VALUES ($1, $2::jsonb, now(), now())
             ON CONFLICT (id) DO NOTHING`,
            [row.id, JSON.stringify(row.data)]
          );
          inserted++;
        } catch (e2) {
          // duplicate or constraint violation – skip silently
        }
      }
    }
  }
  return inserted;
}

/* ------------------------------------------------------------------ */
/*  SEED VOCABULARY                                                    */
/* ------------------------------------------------------------------ */

async function seedVocabulary(pool, allVocab) {
  console.log('\n📖  Seeding vocabulary (lexicon_entries)...');
  const rows = [];
  const seen = new Set();
  let dupes = 0;

  for (const [topic, entries] of Object.entries(allVocab)) {
    for (const entry of entries) {
      const [lemma, pos, definition, synsStr, cefr] = entry;
      if (!lemma || !definition || !cefr) continue;

      const synonyms = (synsStr || '').split(',').map(s => s.trim()).filter(Boolean);
      const { bandTargetMin, bandTargetMax } = cefrToBands(cefr);
      const freq = frequencyRank(lemma, cefr);
      const quality = CEFR_QUALITY[cefr] || 0.85;

      for (const mod of MODULES) {
        const key = `${lemma.toLowerCase()}|${mod}`;
        if (seen.has(key)) { dupes++; continue; }
        seen.add(key);

        const entryId = id();
        const examples = vocabExamples(lemma, pos, definition, topic, cefr, mod);

        rows.push({
          id: entryId,
          data: {
            _id: entryId,
            lemma,
            definition,
            cefr,
            module: mod,
            bandTargetMin,
            bandTargetMax,
            topic,
            synonyms,
            examples,
            frequencyRank: freq,
            sourceType: 'curated',
            qualityScore: quality,
            active: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        });
      }
    }
  }

  if (dupes > 0) console.log(`   ⚠ Skipped ${dupes} duplicate lemma+module combinations`);
  console.log(`   📦 Prepared ${rows.length} vocabulary rows across ${Object.keys(allVocab).length} topics`);

  const inserted = await batchInsert(pool, 'lexicon_entries', rows);
  console.log(`   ✅ Inserted ${inserted} vocabulary entries`);
  return inserted;
}

/* ------------------------------------------------------------------ */
/*  SEED COLLOCATIONS                                                  */
/* ------------------------------------------------------------------ */

async function seedCollocations(pool, allCollocations) {
  console.log('\n🔗  Seeding collocations (collocation_entries)...');
  const rows = [];
  const seen = new Set();
  let dupes = 0;

  for (const [topic, entries] of Object.entries(allCollocations)) {
    for (const entry of entries) {
      const [phrase, meaning, altsStr, cefr] = entry;
      if (!phrase || !meaning || !cefr) continue;

      const alternatives = (altsStr || '').split(',').map(s => s.trim()).filter(Boolean);
      const { bandTargetMin, bandTargetMax } = cefrToBands(cefr);
      const freq = frequencyRank(phrase, cefr);
      const quality = CEFR_QUALITY[cefr] || 0.85;

      for (const mod of MODULES) {
        const key = `${phrase.toLowerCase()}|${mod}`;
        if (seen.has(key)) { dupes++; continue; }
        seen.add(key);

        const entryId = id();
        const examples = collocationExamples(phrase, meaning, topic, cefr, mod);

        rows.push({
          id: entryId,
          data: {
            _id: entryId,
            phrase,
            meaning,
            module: mod,
            cefr,
            topic,
            bandTargetMin,
            bandTargetMax,
            examples,
            alternatives,
            frequencyRank: freq,
            sourceType: 'curated',
            qualityScore: quality,
            active: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        });
      }
    }
  }

  if (dupes > 0) console.log(`   ⚠ Skipped ${dupes} duplicate phrase+module combinations`);
  console.log(`   📦 Prepared ${rows.length} collocation rows across ${Object.keys(allCollocations).length} topics`);

  const inserted = await batchInsert(pool, 'collocation_entries', rows);
  console.log(`   ✅ Inserted ${inserted} collocation entries`);
  return inserted;
}

/* ------------------------------------------------------------------ */
/*  MAIN                                                               */
/* ------------------------------------------------------------------ */

async function main() {
  const vocabOnly = process.argv.includes('--vocab-only');
  const collocOnly = process.argv.includes('--collocations-only');

  console.log('═══════════════════════════════════════════════════');
  console.log('  IELTS Library Seeder – 40,000+ entries');
  console.log('═══════════════════════════════════════════════════');

  // Load data
  console.log('\n📂  Loading data files...');
  const { allVocab, allCollocations } = loadAllData();

  const vocabTopics = Object.keys(allVocab);
  const collocTopics = Object.keys(allCollocations);
  const totalVocabWords = Object.values(allVocab).reduce((s, a) => s + a.length, 0);
  const totalCollocPhrases = Object.values(allCollocations).reduce((s, a) => s + a.length, 0);

  console.log(`   Vocabulary:   ${totalVocabWords} unique words across ${vocabTopics.length} topics`);
  console.log(`   Collocations: ${totalCollocPhrases} unique phrases across ${collocTopics.length} topics`);
  console.log(`   Expected entries: ~${totalVocabWords * 4} vocab + ~${totalCollocPhrases * 4} collocations`);

  // Connect to database
  const connStr = process.env.SUPABASE_DB_URL;
  if (!connStr) {
    console.error('\n❌ Missing SUPABASE_DB_URL environment variable');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
    max: 5,
  });

  try {
    // Test connection
    const { rows } = await pool.query('SELECT 1 AS ok');
    if (!rows[0]?.ok) throw new Error('Connection test failed');
    console.log('\n🔌  Connected to Supabase');

    let totalInserted = 0;

    if (!collocOnly) {
      totalInserted += await seedVocabulary(pool, allVocab);
    }

    if (!vocabOnly) {
      totalInserted += await seedCollocations(pool, allCollocations);
    }

    // Summary
    console.log('\n═══════════════════════════════════════════════════');
    console.log(`  ✅ DONE – ${totalInserted.toLocaleString()} total entries seeded`);
    console.log('═══════════════════════════════════════════════════\n');

  } catch (err) {
    console.error('\n❌ Fatal error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
