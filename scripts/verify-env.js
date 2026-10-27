#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const CRITICAL_BINARIES = [
  path.join(rootDir, 'node_modules', '.bin', 'vite'),
  path.join(rootDir, 'node_modules', '.bin', 'tsx'),
];

const CRITICAL_PACKAGES = [
  'vite',
  'tsx',
  'express',
  '@libsql/client',
];

function checkEnvironment() {
  console.log('[verify-env] Verifying development environment & binaries...');

  // 1. Remove obsolete or conflicting lockfiles if present
  const bunLock = path.join(rootDir, 'bun.lock');
  const bunLockb = path.join(rootDir, 'bun.lockb');
  if (fs.existsSync(bunLock)) {
    try {
      fs.unlinkSync(bunLock);
      console.log('[verify-env] Cleaned up obsolete bun.lock file.');
    } catch (_) {}
  }
  if (fs.existsSync(bunLockb)) {
    try {
      fs.unlinkSync(bunLockb);
      console.log('[verify-env] Cleaned up obsolete bun.lockb file.');
    } catch (_) {}
  }

  // 2. Check if .bin executables exist
  let missing = false;
  for (const binPath of CRITICAL_BINARIES) {
    if (!fs.existsSync(binPath)) {
      console.warn(`[verify-env] Missing binary: ${binPath}`);
      missing = true;
    }
  }

  // 3. Check if critical package modules exist
  for (const pkg of CRITICAL_PACKAGES) {
    const pkgDir = path.join(rootDir, 'node_modules', ...pkg.split('/'));
    if (!fs.existsSync(pkgDir)) {
      console.warn(`[verify-env] Missing package directory: ${pkgDir}`);
      missing = true;
    }
  }

  // 4. Auto-repair if anything is missing
  if (missing) {
    console.log('[verify-env] Dependencies or binaries missing. Executing npm install self-healing...');
    try {
      execSync('npm install --no-audit --no-fund', {
        cwd: rootDir,
        stdio: 'inherit',
      });
      console.log('[verify-env] Dependencies restored successfully.');
    } catch (err) {
      console.error('[verify-env] Failed to automatically run npm install:', err.message);
      process.exit(1);
    }
  } else {
    console.log('[verify-env] All critical binaries and packages verified.');
  }
}

try {
  checkEnvironment();
} catch (e) {
  console.error('[verify-env] Verification encountered an error:', e);
}
