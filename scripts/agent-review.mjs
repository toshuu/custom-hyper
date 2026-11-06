import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const spec = args[0];
const at = args.includes('--at') ? args[args.indexOf('--at') + 1] : '1,4,8';
if (!spec || spec.startsWith('-') || !at) throw new Error('usage: npm run agent:review -- specs/<slug>.json --at 1,4,8');
for (const command of [
  ['src/cli.mjs', 'lint', spec],
  ['src/cli.mjs', 'check', spec],
  ['src/cli.mjs', 'stills', spec, '--at', at, '--scale', '0.5'],
]) {
  const result = spawnSync(process.execPath, command, { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
