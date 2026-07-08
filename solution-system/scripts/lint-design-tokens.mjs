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
const PX_VALUE_REGEX = /\b(?!1px\b)(?!2px\b)(?!3px\b)\d+px\b/;
const COLOR_FUNC_REGEX = /\b(rgb|rgba|hsl|hsla)\(/;

let errorsFound = 0;
const violationsByFile = {};

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

    let errorMsg = null;
    let tip = null;

    // 1. Check for hex colors
    if (HEX_COLOR_REGEX.test(line)) {
      errorMsg = `Hardcoded hex color found: "${line.trim()}"`;
      tip = 'Use semantic tokens like var(--color-surface) or var(--color-primary).';
    }
    // 2. Check for hardcoded px values
    else if (PX_VALUE_REGEX.test(line)) {
      errorMsg = `Hardcoded px value found: "${line.trim()}"`;
      tip = 'Use layout spacing tokens like var(--space-*) or border-radius tokens var(--radius-*).';
    }
    // 3. Check for color functions
    else if (COLOR_FUNC_REGEX.test(line) && !line.includes('box-shadow:')) {
      errorMsg = `Hardcoded color function found: "${line.trim()}"`;
      tip = 'Declare functional gradients/colors in the semantic design token layer.';
    }

    if (errorMsg) {
      if (!violationsByFile[relativePath]) {
        violationsByFile[relativePath] = [];
      }
      violationsByFile[relativePath].push({
        line: lineNumber,
        message: errorMsg,
        tip: tip
      });
      errorsFound++;
    }
  });
}

SEARCH_DIRS.forEach(dir => {
  if (fs.existsSync(dir)) {
    walkDir(dir, lintFile);
  }
});

// Buffer all outputs so we can choose to write to stdout or stderr
const outputBuffer = [];
function writeLine(text) {
  outputBuffer.push(text);
}

writeLine('\n\x1b[36m🛡️  DESIGN SYSTEM LINT CHECK\x1b[0m');
writeLine('\x1b[90m────────────────────────────────────────────────────────────────────────\x1b[0m');

if (errorsFound > 0) {
  Object.keys(violationsByFile).forEach(file => {
    writeLine(`\n\x1b[33m📁 File: ${file}\x1b[0m`);
    violationsByFile[file].forEach(violation => {
      writeLine(`  \x1b[31m❌ Line ${violation.line}:\x1b[0m ${violation.message}`);
      if (violation.tip) {
        writeLine(`     \x1b[90m↳ Tip: ${violation.tip}\x1b[0m`);
      }
    });
  });
  writeLine('\x1b[90m────────────────────────────────────────────────────────────────────────\x1b[0m');
  writeLine(`\n\x1b[41m\x1b[37m FAIL \x1b[0m Found \x1b[31m${errorsFound}\x1b[0m design token violations. Please use design system variables.\n`);
  
  // Write everything to stderr so Git forwards the output to the user's terminal
  console.error(outputBuffer.join('\n'));
  process.exit(1);
} else {
  writeLine('✅ PASS: All component styles adhere to design tokens guidelines!');
  writeLine('\x1b[90m────────────────────────────────────────────────────────────────────────\x1b[0m\n');
  
  // Write to stdout
  console.log(outputBuffer.join('\n'));
  process.exit(0);
}
