#!/usr/bin/env node
/**
 * Script to install Python dependencies
 */

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REQUIREMENTS_FILE = path.join(__dirname, '..', 'requirements.txt');

function findPython() {
  const pythonCommands = ['python3', 'python'];
  for (const cmd of pythonCommands) {
    try {
      execSync(`${cmd} --version`, { encoding: 'utf8', stdio: 'pipe' });
      return cmd;
    } catch (e) {
      // Continue to next command
    }
  }
  return null;
}

function main() {
  console.log('🐍 Installing Python dependencies...\n');

  const pythonCmd = findPython();
  if (!pythonCmd) {
    console.error('❌ Python not found!');
    console.error('Please install Python 3.7+ from https://www.python.org/downloads/');
    process.exit(1);
  }

  if (!fs.existsSync(REQUIREMENTS_FILE)) {
    console.error(`❌ Requirements file not found: ${REQUIREMENTS_FILE}`);
    process.exit(1);
  }

  const pipCmd = pythonCmd === 'python3' ? 'pip3' : 'pip';

  try {
    console.log(`Using: ${pythonCmd} and ${pipCmd}\n`);
    execSync(`${pipCmd} install -r ${REQUIREMENTS_FILE}`, { stdio: 'inherit' });
    console.log('\n✅ Python dependencies installed successfully!');
  } catch (e) {
    console.error('\n❌ Failed to install Python dependencies');
    console.error('Please try manually:');
    console.error(`  ${pipCmd} install -r requirements.txt`);
    process.exit(1);
  }
}

main();

