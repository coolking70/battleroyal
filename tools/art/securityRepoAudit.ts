import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const staticSecret = /sk-[A-Za-z0-9]{20,}/;
const assignmentLine = /^[ \t]*(?:export[ \t]+)?(IMAGE_API_KEY|VITE_IMAGE_API_KEY)[ \t]*=[ \t]*(.*)$/gm;

export interface SecretScanViolation {
  file: string;
  reason: 'static-secret' | 'non-empty-api-key-assignment';
}

function isTextPath(relative: string): boolean {
  return /(?:^|\/)\.env(?:\.[^/]+)?$/i.test(relative) || /\.(?:ts|tsx|js|jsx|json|md|txt|yml|yaml|html|css|scss|sh|toml|xml)$/i.test(relative);
}

export function scanTextForSecrets(text: string): SecretScanViolation['reason'][] {
  const reasons: SecretScanViolation['reason'][] = [];
  if (staticSecret.test(text)) reasons.push('static-secret');
  assignmentLine.lastIndex = 0;
  for (const match of text.matchAll(assignmentLine)) {
    const value = match[2]!.trim();
    if (value && !value.startsWith('#')) {
      reasons.push('non-empty-api-key-assignment');
      break;
    }
  }
  return reasons;
}

export async function scanTrackedRepository(root: string, trackedFiles?: string[]): Promise<SecretScanViolation[]> {
  const files = trackedFiles ?? (await execFileAsync('git', ['ls-files', '-z'], { cwd: root })).stdout.split('\0').filter(Boolean);
  const violations: SecretScanViolation[] = [];
  for (const relative of files) {
    if (!isTextPath(relative)) continue;
    const buffer = await fs.readFile(path.join(root, relative));
    if (buffer.includes(0)) continue;
    for (const reason of scanTextForSecrets(buffer.toString('utf8'))) violations.push({ file: relative, reason });
  }
  return violations;
}

async function main(): Promise<void> {
  const root = process.cwd();
  const { stdout } = await execFileAsync('git', ['ls-files', '-z'], { cwd: root });
  const files = stdout.split('\0').filter(Boolean);
  const violations = await scanTrackedRepository(root, files);
  if (violations.length > 0) {
    console.error(`FAIL tracked repository secret-like content: ${violations.map((item) => `${item.file} (${item.reason})`).join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS tracked repository secret scan (${files.length} tracked files)`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(`FAIL repository secret scan: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
