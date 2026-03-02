import chalk from 'chalk';
import * as figlet from 'figlet';

try {
  const text = process.argv[2] || 'Spokio';
  const data = typeof (figlet as any).textSync === 'function' ? (figlet as any).textSync(text) : text;
  console.log(chalk.blue(data));
  console.log('');
  process.exit(0);
} catch {
  process.exit(1);
}
