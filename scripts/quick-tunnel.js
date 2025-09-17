#!/usr/bin/env node

/**
 * Quick tunnel setup - creates a temporary tunnel without DNS setup
 * Perfect for GitHub App development and testing
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

function log(message) {
  console.log(`🚀 ${message}`);
}

function error(message) {
  console.error(`❌ ${message}`);
}

function startQuickTunnel() {
  log('Starting quick tunnel to localhost:4000...');
  log('This will create a temporary public URL for GitHub App testing');

  const tunnel = spawn('cloudflared', ['tunnel', '--url', 'http://localhost:4000'], {
    stdio: 'inherit'
  });

  tunnel.on('error', (err) => {
    error(`Failed to start tunnel: ${err.message}`);
    error('Make sure cloudflared is installed: brew install cloudflared');
    process.exit(1);
  });

  tunnel.on('close', (code) => {
    if (code !== 0) {
      error(`Tunnel exited with code ${code}`);
      process.exit(code);
    }
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    log('Shutting down tunnel...');
    tunnel.kill('SIGINT');
  });

  process.on('SIGTERM', () => {
    log('Shutting down tunnel...');
    tunnel.kill('SIGTERM');
  });
}

// Check if this is the main module
const __filename = fileURLToPath(import.meta.url);
const isMain = process.argv[1] === __filename;

if (isMain) {
  startQuickTunnel();
}
