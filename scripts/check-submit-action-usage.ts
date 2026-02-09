import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const ROOT_DIR = resolve(process.cwd());
const COMPONENTS_DIR = join(ROOT_DIR, 'src', 'components');

let hasFailure = false;

async function scanDirectory(dir: string) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      
      if (entry.isDirectory()) {
        await scanDirectory(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        await checkFile(fullPath);
      }
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      // Directory doesn't exist, likely acceptable if no components yet, but warn
      console.warn(`Warning: Directory not found: ${dir}`);
      return;
    }
    throw err;
  }
}

async function checkFile(filePath: string) {
  const content = await readFile(filePath, 'utf-8');
  const lines = content.split('\n');
  // Normalize path for output to be relative to repo root, starting with /
  const relativePath = filePath.replace(ROOT_DIR, '');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Check 1: invoke('submit_action' or invoke("submit_action"
    if (line.includes("invoke('submit_action'") || line.includes('invoke("submit_action"')) {
      console.error(`[FAIL] ${relativePath}:${lineNum}: Direct invoke('submit_action') forbidden in components.`);
      hasFailure = true;
    }

    // Check 2: import { invoke } from "@tauri-apps/api/core"
    // We check for 'invoke' being in the import clause
    if (/import\s+.*\{?.*invoke.*\}?.*\s+from\s+['"]@tauri-apps\/api\/core['"]/.test(line)) {
       console.error(`[FAIL] ${relativePath}:${lineNum}: Direct import of 'invoke' from @tauri-apps/api/core forbidden in components.`);
       hasFailure = true;
    }
  }
}

// Start scan
await scanDirectory(COMPONENTS_DIR);

if (hasFailure) {
  process.exit(1);
} else {
  console.log("OK");
  process.exit(0);
}
