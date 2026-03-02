import 'reflect-metadata';

import connectDB from '../src/loaders/DBLoader';
import { Logger } from '../src/lib/logger';
import { FeatureFlagService } from '../src/api/services/FeatureFlagService';
import { PartnerProgramService } from '../src/api/services/PartnerProgramService';

const log = new Logger(__filename);

async function main() {
  await connectDB();

  const actorUserId = process.env.BACKFILL_ACTOR_USER_ID;
  const service = new PartnerProgramService(new FeatureFlagService());

  const result = await service.backfillFromInfluencerCoupons(actorUserId);

  log.info('Partner backfill completed', result);
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(result, null, 2));
}

main().catch(error => {
  log.error('Partner backfill failed', { error });
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
