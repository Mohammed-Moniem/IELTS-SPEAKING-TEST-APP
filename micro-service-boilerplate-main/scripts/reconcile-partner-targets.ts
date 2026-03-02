import 'reflect-metadata';

import connectDB from '../src/loaders/DBLoader';
import { Logger } from '../src/lib/logger';
import { FeatureFlagService } from '../src/api/services/FeatureFlagService';
import { PartnerProgramService } from '../src/api/services/PartnerProgramService';

const log = new Logger(__filename);

async function main() {
  await connectDB();

  const service = new PartnerProgramService(new FeatureFlagService());
  const referenceDate = process.env.RECONCILE_REFERENCE_DATE ? new Date(process.env.RECONCILE_REFERENCE_DATE) : new Date();
  const partnerId = process.env.PARTNER_ID?.trim();
  const result = await service.reconcileTargets(referenceDate, {
    partnerIds: partnerId ? [partnerId] : undefined
  });

  log.info('Partner target reconciliation completed', result);
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(result, null, 2));
}

main().catch(error => {
  log.error('Partner target reconciliation failed', { error });
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
