#!/usr/bin/env node
/**
 * Script to start the Python YouTube downloader service.
 *
 * IMPORTANT: On macOS with Homebrew Python, pip is often blocked system-wide by PEP 668
 * ("externally-managed-environment"). To be reliable, we always install/run using a local
 * virtualenv (.venv) in the project directory.
 */

import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.join(__dirname, '..');
const PYTHON_SERVICE_FILE = path.join(PROJECT_ROOT, 'youtube_downloader_service.py');
const REQUIREMENTS_FILE = path.join(PROJECT_ROOT, 'requirements.txt');
const VENV_DIR = path.join(PROJECT_ROOT, '.venv');
const IS_WIN = process.platform === 'win32';

function getVenvPythonPath() {
  return IS_WIN ? path.join(VENV_DIR, 'Scripts', 'python.exe') : path.join(VENV_DIR, 'bin', 'python');
}

// Detect Python command
function findPython() {
  const pythonCommands = ['python3', 'python'];
  for (const cmd of pythonCommands) {
    try {
      const result = execSync(`${cmd} --version`, { encoding: 'utf8', stdio: 'pipe' });
      if (result) {
        return cmd;
      }
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

  try {
    execSync(`${pythonCmd} -m venv "${VENV_DIR}"`, { stdio: 'inherit' });
  } catch (e) {
    console.error('❌ Failed to create virtual environment:', e.message);
    return null;
  }

  // Ensure pip exists/up-to-date inside the venv
  try {
    execSync(`"${venvPython}" -m ensurepip --upgrade`, { stdio: 'ignore' });
  } catch {
    // ignore; ensurepip may be unavailable on some distros
  }
  try {
    execSync(`"${venvPython}" -m pip install --upgrade pip`, { stdio: 'ignore' });
  } catch {
    // ignore; not fatal
  }

  return venvPython;
}

// Check if dependencies are installed
function checkDependencies(venvPython) {
  try {
    execSync(`"${venvPython}" -c "import yt_dlp; import flask; import flask_cors; import requests"`, {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    return true;
  } catch (e) {
    return false;
  }
}

// Install dependencies
function installDependencies(venvPython) {
  console.log('📦 Installing Python dependencies...');
  
  try {
    execSync(
      `"${venvPython}" -m pip install -r "${REQUIREMENTS_FILE}"`,
      { stdio: 'inherit' }
    );
    console.log('✅ Python dependencies installed successfully!\n');
    return true;
  } catch (e) {
    console.error('❌ Failed to install Python dependencies:', e.message);
    console.error('\nPlease install manually (recommended inside a venv):');
    console.error('  python3 -m venv .venv');
    console.error('  source .venv/bin/activate  # (macOS/Linux)');
    console.error('  python -m pip install -r requirements.txt\n');
    return false;
  }
}

// Start Python service
function startService(venvPython) {
  if (!fs.existsSync(PYTHON_SERVICE_FILE)) {
    console.error(`❌ Python service file not found: ${PYTHON_SERVICE_FILE}`);
    process.exit(1);
  }

  console.log('🚀 Starting Python YouTube downloader service...');
  console.log('   Service will be available at: http://localhost:8000');
  console.log('   Health check: http://localhost:8000/health\n');

  const pythonProcess = spawn(venvPython, [PYTHON_SERVICE_FILE], {
    stdio: 'inherit',
    shell: false
  });

  pythonProcess.on('error', (error) => {
    console.error('❌ Failed to start Python service:', error.message);
    process.exit(1);
  });

  pythonProcess.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`\n❌ Python service exited with code ${code}`);
    }
  });

  // Handle process termination
  process.on('SIGINT', () => {
    console.log('\n🛑 Stopping Python service...');
    pythonProcess.kill();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    pythonProcess.kill();
    process.exit(0);
  });

  return pythonProcess;
}

// Main execution
function main() {
  console.log('🐍 Checking Python installation...\n');

  const pythonCmd = findPython();
  if (!pythonCmd) {
    console.error('❌ Python not found!');
    console.error('Please install Python 3.7+ from https://www.python.org/downloads/');
    process.exit(1);
  }

  console.log(`✅ Found Python: ${pythonCmd}\n`);

  const venvPython = ensureVenv(pythonCmd);
  if (!venvPython) process.exit(1);

  // Check if dependencies are installed
  if (!checkDependencies(venvPython)) {
    console.log('📦 Python dependencies not found. Installing...\n');
    if (!installDependencies(venvPython)) {
      process.exit(1);
    }
  } else {
    console.log('✅ Python dependencies are installed\n');
  }

  // Start the service
  startService(venvPython);
}

main();

