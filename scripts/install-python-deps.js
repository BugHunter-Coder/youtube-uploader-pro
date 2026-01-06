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

const PROJECT_ROOT = path.join(__dirname, '..');
const REQUIREMENTS_FILE = path.join(PROJECT_ROOT, 'requirements.txt');
const VENV_DIR = path.join(PROJECT_ROOT, '.venv');
const IS_WIN = process.platform === 'win32';

function getVenvPythonPath() {
  return IS_WIN ? path.join(VENV_DIR, 'Scripts', 'python.exe') : path.join(VENV_DIR, 'bin', 'python');
}

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

function ensureVenv(pythonCmd) {
  const venvPython = getVenvPythonPath();
  if (fs.existsSync(venvPython)) return venvPython;

  console.log(`🧪 Creating virtualenv at: ${VENV_DIR}\n`);
  fs.mkdirSync(VENV_DIR, { recursive: true });
  execSync(`${pythonCmd} -m venv "${VENV_DIR}"`, { stdio: 'inherit' });

  try {
    execSync(`"${venvPython}" -m ensurepip --upgrade`, { stdio: 'ignore' });
  } catch {
    // ignore
  }
  try {
    execSync(`"${venvPython}" -m pip install --upgrade pip`, { stdio: 'ignore' });
  } catch {
    // ignore
  }

  return venvPython;
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

  try {
    const venvPython = ensureVenv(pythonCmd);
    console.log(`Using: ${venvPython}\n`);
    execSync(`"${venvPython}" -m pip install -r "${REQUIREMENTS_FILE}"`, { stdio: 'inherit' });
    console.log('\n✅ Python dependencies installed successfully!');
  } catch (e) {
    console.error('\n❌ Failed to install Python dependencies');
    console.error('Please try manually:');
    console.error('  python3 -m venv .venv');
    console.error('  source .venv/bin/activate  # (macOS/Linux)');
    console.error('  python -m pip install -r requirements.txt');
    process.exit(1);
  }
}

main();

