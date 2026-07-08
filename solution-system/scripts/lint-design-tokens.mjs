import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directories to check (relative to solution-system root)
const SEARCH_DIRS = [
  path.join(__dirname, '../apps/frontend/src/app'),
];

// File extension to check
const FILE_EXT = '.scss';

// Regex patterns to check for hardcoded design values
const HEX_COLOR_REGEX = /#[0-9a-fA-F]{3,8}\b/;
// Allows 1px, 2px, 3px for borders, outlines and offsets
const PX_VALUE_REGEX = /\b(?!1px\b)(?!2px\b)(?!3px\b)\d+px\b/;
const COLOR_FUNC_REGEX = /\b(rgb|rgba|hsl|hsla)\(/;

let errorsFound = 0;

function walkDir(dir, callback) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walkDir(fullPath, callback);
    } else if (stat.isFile() && file.endsWith(FILE_EXT)) {
      callback(fullPath);
    }
  }
}

function lintFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    // Skip comments
    if (line.trim().startsWith('//') || line.trim().startsWith('/*')) {
      return;
    }

    const lineNumber = index + 1;
    const relativePath = path.relative(path.join(__dirname, '..'), filePath);

    // 1. Check for hex colors
    if (HEX_COLOR_REGEX.test(line)) {
      console.error(`\x1b[31m[ERROR]\x1b[0m ${relativePath}:${lineNumber} - Hardcoded hex color found: "${line.trim()}"`);
      errorsFound++;
    }

    // 2. Check for hardcoded px values (excluding 1px/2px/3px borders/outlines)
    if (PX_VALUE_REGEX.test(line)) {
      console.error(`\x1b[31m[ERROR]\x1b[0m ${relativePath}:${lineNumber} - Hardcoded px value found: "${line.trim()}" (Use var(--space-*) or var(--radius-*))`);
      errorsFound++;
    }

    // 3. Check for color functions (excluding box-shadow alpha channels)
    if (COLOR_FUNC_REGEX.test(line) && !line.includes('box-shadow:')) {
      console.error(`\x1b[31m[ERROR]\x1b[0m ${relativePath}:${lineNumber} - Hardcoded color function found: "${line.trim()}"`);
      errorsFound++;
    }
  });
}

console.log('Running Design Tokens Lint Check...');
SEARCH_DIRS.forEach(dir => {
  if (fs.existsSync(dir)) {
    walkDir(dir, lintFile);
  }
});

if (errorsFound > 0) {
  console.log(`\n\x1b[31mFAIL:\x1b[0m Found ${errorsFound} design token violations. Please use design system variables.`);
  process.exit(1);
} else {
  console.log('\n\x1b[32mPASS:\x1b[0m All component styles adhere to design tokens guidelines!');
  process.exit(0);
}
