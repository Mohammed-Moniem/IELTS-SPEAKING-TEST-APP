import * as dotenv from 'dotenv';
import * as jsonfile from 'jsonfile';
import * as path from 'path';

import { env } from '../src/env';

dotenv.config();

const content = {
  mongoURL: env.db.mongoURL
};

const filePath = path.join(process.cwd(), 'ormconfig.json');

jsonfile.writeFile(filePath, content, { space: 2 }, err => {
  if (err === null) {
    process.exit(0);
  } else {
    console.error('Failed to generate the ormconfig.json', err);
    process.exit();
  }
});
