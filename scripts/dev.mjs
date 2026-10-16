// Runs the API server and the web app together, with prefixed output. Ctrl+C stops both.
import { spawn } from 'node:child_process';

const procs = [
  ['api', ['run', 'start', '-w', '@portion/server'], '\x1b[36m'],
  ['web', ['run', 'dev', '-w', '@portion/web'], '\x1b[35m'],
].map(([name, args, color]) => {
  const p = spawn('npm', args, { stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
  const out = (d) => String(d).split('\n').filter(Boolean).forEach((l) => console.log(`${color}[${name}]\x1b[0m ${l}`));
  p.stdout.on('data', out);
  p.stderr.on('data', out);
  p.on('exit', (code) => { console.log(`[${name}] exited (${code})`); stop(); });
  return p;
});
function stop() { procs.forEach((p) => p.kill()); setTimeout(() => process.exit(0), 200); }
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
