const { spawnSync } = require('node:child_process');
const { validateVercelEnvironment } = require('./environment.cjs');

try {
  validateVercelEnvironment(process.env);
} catch (error) {
  console.error('Vercel configuration: ' + error.message);
  process.exit(1);
}

// Vercel dependency caches must not leave a Prisma Client from an older schema.
// Schema changes remain an explicit operation; a web build never migrates a DB.
const commands = [
  [process.execPath, ['node_modules/prisma/build/index.js', 'generate']],
  ...(process.env.VERCEL === '1' ? [[process.execPath, ['scripts/vercel/check-database.cjs']]] : []),
  [process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build', '--', '--webpack']],
];
for (const [command, args] of commands) {
  const result = spawnSync(command, args, { stdio: 'inherit', env: { ...process.env, NODE_ENV: 'production' } });
  if (result.error || result.status !== 0) process.exit(result.status || 1);
}
