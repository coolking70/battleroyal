import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const root = process.cwd();
const staticSecret = /sk-[A-Za-z0-9]{20,}/;
const assignmentSecret = /(?:IMAGE_API_KEY|VITE_IMAGE_API_KEY)\s*=\s*['"]?[^\s'"`]+/;
const textExtensions = /\.(?:ts|tsx|js|jsx|json|md|txt|yml|yaml|env|html|css|scss|sh|toml|xml)$/i;

const { stdout } = await execFileAsync('git', ['ls-files', '-z'], { cwd: root });
const files = stdout.split('\0').filter(Boolean);
const violations: string[] = [];

for (const relative of files) {
  if (!textExtensions.test(relative)) continue;
  const buffer = await fs.readFile(`${root}/${relative}`);
  if (buffer.includes(0)) continue;
  const text = buffer.toString('utf8');
  if (staticSecret.test(text) || assignmentSecret.test(text)) violations.push(relative);
}

if (violations.length > 0) {
  console.error(`FAIL tracked repository secret-like content: ${violations.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log(`PASS tracked repository secret scan (${files.length} tracked files)`);
}
