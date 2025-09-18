#!/usr/bin/env node

/**
 * Start Cloudflare Tunnel for local development
 */

import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { TUNNEL_NAME } from './setup-tunnel.js'

function log(message) {
  console.log(`🌩️  ${message}`)
}

function error(message) {
  console.error(`❌ ${message}`)
}

function startTunnel() {
  log(`Starting persistent tunnel: ${TUNNEL_NAME}`)
  log('This will create a consistent URL that persists across restarts!')

  const tunnel = spawn(
    'cloudflared',
    ['tunnel', '--config', '.cloudflared/entente-config.yml', 'run', TUNNEL_NAME],
    {
      stdio: 'pipe',
    }
  )

  // Capture and display output to show the tunnel URL
  tunnel.stdout.on('data', data => {
    const output = data.toString()
    console.log(output)

    // Look for the tunnel URL in the output
    if (output.includes('trycloudflare.com')) {
      const match = output.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/)
      if (match) {
        console.log('\n' + '='.repeat(80))
        console.log('🎉 Your persistent tunnel is running!')
        console.log(`📋 Tunnel URL: ${match[0]}`)
        console.log('💡 This URL will stay the same every time you restart the tunnel')
        console.log('='.repeat(80) + '\n')
      }
    }
  })

  tunnel.stderr.on('data', data => {
    console.error(data.toString())
  })

  tunnel.on('error', err => {
    error(`Failed to start tunnel: ${err.message}`)
    process.exit(1)
  })

  tunnel.on('close', code => {
    if (code !== 0) {
      error(`Tunnel exited with code ${code}`)
      process.exit(code)
    }
  })

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    log('Shutting down tunnel...')
    tunnel.kill('SIGINT')
  })

  process.on('SIGTERM', () => {
    log('Shutting down tunnel...')
    tunnel.kill('SIGTERM')
  })
}

// Check if this is the main module
const __filename = fileURLToPath(import.meta.url)
const isMain = process.argv[1] === __filename

if (isMain) {
  startTunnel()
}
