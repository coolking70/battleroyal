import fs from 'node:fs/promises';
import path from 'node:path';

const forbidden = [
  /IMAGE_API_KEY\s*=/,
  new RegExp(`VITE_${'IMAGE_API_KEY'}`),
  /Authorization\s*:\s*Bearer\s+sk-/i,
  /sk-[A-Za-z0-9]{20,}/,
];

async function walk(dir: string): Promise<string[]> {
  const found: string[] = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await walk(full)));
    else found.push(full);
  }
  return found;
}

const root = process.cwd();
const scope = (await Promise.all(['src', 'public', 'dist'].map((relative) => walk(path.join(root, relative))))).flat();
const violations: string[] = [];
for (const file of scope) {
  const text = await fs.readFile(file, 'utf8');
  if (forbidden.some((pattern) => pattern.test(text))) violations.push(path.relative(root, file));
}
if (violations.length > 0) {
  console.error(`FAIL secret-like content found in browser assets: ${violations.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log(`PASS browser secret boundary scan (${scope.length} files)`);
}
