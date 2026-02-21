import fs from 'fs';
import mongoose from 'mongoose';
import path from 'path';
import 'reflect-metadata';

import { IELTSQuestionModel, IIELTSQuestion } from './src/api/models/IELTSQuestionModel';
import { env } from './src/env';

type SeedQuestion = Partial<Omit<IIELTSQuestion, 'createdAt' | 'updatedAt'>>;

interface SeedPayload {
  part1: SeedQuestion[];
  part2: SeedQuestion[];
  part3: SeedQuestion[];
}

async function main(): Promise<void> {
  const mongoUrl = env.db.mongoURL;
  const dataPath = path.join(__dirname, 'seed-data', 'ielts-questions.json');

  if (!fs.existsSync(dataPath)) {
    throw new Error(`Seed data file not found at ${dataPath}`);
  }

  const raw = fs.readFileSync(dataPath, 'utf-8');
  const parsedData = JSON.parse(raw);

  // Handle both flat array and object format
  let questions: SeedQuestion[];
  if (Array.isArray(parsedData)) {
    // Flat array format
    questions = parsedData.map(question => ({
      verified: true,
      active: true,
      timesUsed: 0,
      ...question
    }));
  } else {
    // Object format with part1, part2, part3
    const payload = parsedData as SeedPayload;
    questions = [...(payload.part1 || []), ...(payload.part2 || []), ...(payload.part3 || [])].map(question => ({
      verified: true,
      active: true,
      timesUsed: 0,
      ...question
    }));
  }

  if (!questions.length) {
    console.info('No questions found in seed file. Nothing to do.');
    return;
  }

  console.info(`📝 Found ${questions.length} questions to seed...`);

  await mongoose.connect(mongoUrl);
  console.info(`✅ Connected to MongoDB at ${mongoUrl}`);

  const bulkWriteOperations = questions.map(question => {
    if (!question.category || !question.question || !question.difficulty || !question.topic) {
      throw new Error('Seed question is missing required fields: category, question text, difficulty, or topic.');
    }

    const updatePayload: Record<string, unknown> = {
      ...question,
      timesUsed: question.timesUsed ?? 0,
      verified: question.verified ?? true,
      active: question.active ?? true
    };

    if (!question.lastUsedAt) {
      delete updatePayload.lastUsedAt;
    } else if (typeof question.lastUsedAt === 'string') {
      const parsedDate = new Date(question.lastUsedAt);
      if (!Number.isNaN(parsedDate.getTime())) {
        updatePayload.lastUsedAt = parsedDate;
      } else {
        delete updatePayload.lastUsedAt;
      }
    }

    return {
      updateOne: {
        filter: {
          category: question.category,
          question: question.question
        },
        update: {
          $set: updatePayload
        },
        upsert: true
      }
    };
  });

  const result = await IELTSQuestionModel.bulkWrite(bulkWriteOperations, { ordered: false });

  console.info('📊 Seed completed:', {
    matched: result.matchedCount,
    modified: result.modifiedCount,
    upserted: result.upsertedCount
  });

  await mongoose.disconnect();
  console.info('🔌 Disconnected from MongoDB');
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Failed to seed IELTS questions:', error);
    mongoose.disconnect().finally(() => process.exit(1));
  });
