#!/usr/bin/env node
/**
 * Script to start the Python YouTube downloader service
 * Checks for Python and dependencies, installs if needed, then starts the service
 */

import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PYTHON_SERVICE_FILE = path.join(__dirname, '..', 'youtube_downloader_service.py');
const REQUIREMENTS_FILE = path.join(__dirname, '..', 'requirements.txt');

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

// Check if dependencies are installed
function checkDependencies(pythonCmd) {
  try {
    execSync(`${pythonCmd} -c "import yt_dlp; import flask; import flask_cors"`, {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    return true;
  } catch (e) {
    return false;
  }
}

// Install dependencies
function installDependencies(pythonCmd) {
  console.log('📦 Installing Python dependencies...');
  const pipCmd = pythonCmd === 'python3' ? 'pip3' : 'pip';
  
  try {
    execSync(
      `${pipCmd} install -r ${REQUIREMENTS_FILE}`,
      { stdio: 'inherit' }
    );
    console.log('✅ Python dependencies installed successfully!\n');
    return true;
  } catch (e) {
    console.error('❌ Failed to install Python dependencies:', e.message);
    console.error('\nPlease install manually:');
    console.error(`  ${pipCmd} install -r requirements.txt\n`);
    return false;
  }
}

// Start Python service
function startService(pythonCmd) {
  if (!fs.existsSync(PYTHON_SERVICE_FILE)) {
    console.error(`❌ Python service file not found: ${PYTHON_SERVICE_FILE}`);
    process.exit(1);
  }

  console.log('🚀 Starting Python YouTube downloader service...');
  console.log('   Service will be available at: http://localhost:8000');
  console.log('   Health check: http://localhost:8000/health\n');

  const pythonProcess = spawn(pythonCmd, [PYTHON_SERVICE_FILE], {
    stdio: 'inherit',
    shell: true
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

  // Check if dependencies are installed
  if (!checkDependencies(pythonCmd)) {
    console.log('📦 Python dependencies not found. Installing...\n');
    if (!installDependencies(pythonCmd)) {
      process.exit(1);
    }
  } else {
    console.log('✅ Python dependencies are installed\n');
  }

  // Start the service
  startService(pythonCmd);
}

main();

