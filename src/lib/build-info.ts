// What this build was made from, read once at build time and printed in the footer.
import { execSync } from 'node:child_process';

function commit(): string | null {
  const fromCi = process.env['GITHUB_SHA'];
  if (fromCi) return fromCi.slice(0, 7);
  try {
    return execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || null;
  } catch {
    return null;
  }
}

export const buildInfo = {
  commit: commit(),
  builtAt: new Date().toISOString(),
};
