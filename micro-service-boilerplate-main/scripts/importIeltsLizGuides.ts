import 'reflect-metadata';
import dotenv from 'dotenv';

import { initializeSupabasePersistence } from '@lib/db/bootstrap';
import { GuideService } from '@services/GuideService';

dotenv.config();

const DEFAULT_ACTOR_ID = '68e7cfc514d5a19ed89792b7';

const parseSitemaps = () => {
  const raw = (process.env.GUIDE_IMPORT_SITEMAPS || '').trim();
  if (!raw) return undefined;
  return raw
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
};

const main = async () => {
  const actorUserId = (process.env.GUIDE_IMPORT_ACTOR_ID || DEFAULT_ACTOR_ID).trim();
  const inventoryDate = (process.env.GUIDE_IMPORT_INVENTORY_DATE || new Date().toISOString().slice(0, 10)).trim();
  const sitemaps = parseSitemaps();

  await initializeSupabasePersistence();

  const service = new GuideService();
  const result = await service.importGuideSitemaps(
    {
      sitemaps,
      inventoryDate
    },
    actorUserId
  );

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(result, null, 2));
};

main()
  .then(() => process.exit(0))
  .catch(error => {
    // eslint-disable-next-line no-console
    console.error(error?.message || error);
    process.exit(1);
  });
