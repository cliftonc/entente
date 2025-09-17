#!/usr/bin/env node

/**
 * Setup Cloudflare Tunnel for local development
 * This script creates a named tunnel that persists across restarts
 */

import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
const homeDir = os.homedir();

const DOMAIN = 'entente.dev';
const TUNNEL_NAME = path.basename(os.homedir());
const LOCAL_PORT = 3000;

function log(message) {
  console.log(`🌩️  ${message}`);
}

function error(message) {
  console.error(`❌ ${message}`);
}

function checkCloudflaredInstalled() {
  try {
    execSync('cloudflared version', { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

function installCloudflared() {
  log('Installing cloudflared...');
  try {
    if (process.platform === 'darwin') {
      execSync('brew install cloudflared', { stdio: 'inherit' });
    } else if (process.platform === 'linux') {
      execSync('curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb && sudo dpkg -i cloudflared.deb', { stdio: 'inherit' });
    } else {
      error('Please install cloudflared manually from https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/');
      process.exit(1);
    }
  } catch (e) {
    error('Failed to install cloudflared. Please install manually.');
    process.exit(1);
  }
}

function checkAuthenticated() {
  try {
    execSync('cloudflared tunnel list', { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

function authenticate() {
  log('Opening browser for Cloudflare authentication...');
  try {
    execSync('cloudflared tunnel login', { stdio: 'inherit' });
    log('Authentication successful!');
  } catch (e) {
    error('Authentication failed. Please try again.');
    process.exit(1);
  }
}

function tunnelExists() {
  try {
    const output = execSync(`cloudflared tunnel list --name ${TUNNEL_NAME}`, { encoding: 'utf8' });
    return output.includes(TUNNEL_NAME);
  } catch (e) {
    return false;
  }
}

function createTunnel() {
  log(`Creating tunnel: ${TUNNEL_NAME}`);
  try {
    execSync(`cloudflared tunnel create ${TUNNEL_NAME}`, { stdio: 'inherit' });
    log(`Tunnel ${TUNNEL_NAME} created successfully!`);
  } catch (e) {
    error('Failed to create tunnel.');
    process.exit(1);
  }
}

function getTunnelId() {
  try {
    const output = execSync(`cloudflared tunnel list --name ${TUNNEL_NAME}`, { encoding: 'utf8' });
    const lines = output.split('\n');
    for (const line of lines) {
      if (line.includes(TUNNEL_NAME)) {
        const parts = line.trim().split(/\s+/);
        return parts[0];
      }
    }
  } catch (e) {
    error('Failed to get tunnel ID.');
    process.exit(1);
  }
}

function createConfigFile(tunnelId) {
  const configDir = path.join('.cloudflared');
  const configPath = path.join(configDir, 'entente-config.yml');

  const config = `tunnel: ${tunnelId}
credentials-file: ${homeDir}/${configDir}/${tunnelId}.json

ingress:
  - service: http://localhost:${LOCAL_PORT}
    hostname: ${TUNNEL_NAME}.${DOMAIN}
    originServerName: localhost
    noTLSVerify: true
  - service: http_status:404
`;

  // Create directory if it doesn't exist
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  fs.writeFileSync(configPath, config);
  log(`Config file created at ${configPath}`);

  return configPath;
}

function getDNSCommand(tunnelId) {
  return `cloudflared tunnel route dns ${tunnelId} ${TUNNEL_NAME}.${DOMAIN}`;
}

async function main() {
  log('Setting up Cloudflare Tunnel for development...');

  // Check if cloudflared is installed
  if (!checkCloudflaredInstalled()) {
    log('cloudflared not found. Installing...');
    installCloudflared();
  }

  // Check authentication
  if (!checkAuthenticated()) {
    log('Not authenticated with Cloudflare. Starting authentication...');
    authenticate();
  }

  // Check if tunnel exists
  if (!tunnelExists()) {
    createTunnel();
  } else {
    log(`Tunnel ${TUNNEL_NAME} already exists.`);
  }

  // Get tunnel ID
  const tunnelId = getTunnelId();
  log(`Tunnel ID: ${tunnelId}`);

  // Create config file
  createConfigFile(tunnelId);

  // Create a route for the tunnel to get a public URL
  try {
    log('Creating public route for tunnel...');
    execSync(`cloudflared tunnel route dns ${tunnelId} ${TUNNEL_NAME}.${DOMAIN}`, { stdio: 'inherit' });
    log(`✅ Public route created: https://${TUNNEL_NAME}.${DOMAIN}`);
  } catch (error) {
    log('⚠️  Could not create DNS route - tunnel will still work but without a custom subdomain');
    log('The tunnel will get a random .trycloudflare.com URL when started');
  }

  // Show next steps
  log('✅ Tunnel setup complete!');
  console.log('\n📋 Your persistent tunnel is ready!');
  console.log(`Tunnel Name: ${TUNNEL_NAME}`);
  console.log(`Tunnel ID: ${tunnelId}`);
  console.log(`Expected URL: https://${TUNNEL_NAME}.${DOMAIN} (if route was successful)`);
  console.log('\n🚀 Start your tunnel:');
  console.log('   npm run tunnel:start');
  console.log('\n💡 The exact URL will be shown when you start the tunnel.');
}

// Check if this is the main module
const __filename = fileURLToPath(import.meta.url);
const isMain = process.argv[1] === __filename;

if (isMain) {
  main().catch(console.error);
}

export { TUNNEL_NAME, LOCAL_PORT, DOMAIN };
