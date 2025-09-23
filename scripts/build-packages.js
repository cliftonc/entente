#!/usr/bin/env node

import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

// Package build order (dependencies first)
const packages = [
  'types',
  'metadata',
  'fixtures',
  'cli',
  'consumer',
  'provider'
]

// Apps to build (after packages)
const apps = [
  'server',
  'docs'
]

/**
 * Run a command and return a promise
 */
function runCommand(command, args, cwd, silent = true) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: silent ? 'pipe' : 'inherit'
    })

    let stdout = ''
    let stderr = ''

    if (silent) {
      child.stdout?.on('data', (data) => {
        stdout += data.toString()
      })

      child.stderr?.on('data', (data) => {
        stderr += data.toString()
      })
    }

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr })
      } else {
        reject(new Error(`Command failed with code ${code}\n${stderr || stdout}`))
      }
    })

    child.on('error', reject)
  })
}

/**
 * Build a single package
 */
async function buildPackage(packageName) {
  const packageDir = join(rootDir, 'packages', packageName)

  if (!existsSync(packageDir)) {
    throw new Error(`Package directory not found: ${packageDir}`)
  }

  const startTime = Date.now()

  try {
    // Clean
    await runCommand('pnpm', ['run', 'clean'], packageDir)

    // Build ESM and CJS in parallel
    await Promise.all([
      runCommand('pnpm', ['run', 'build:esm'], packageDir),
      runCommand('pnpm', ['run', 'build:cjs'], packageDir)
    ])

    // Create CJS package.json
    await runCommand('pnpm', ['run', 'build:cjs-package'], packageDir)

    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    return { success: true, duration, packageName, type: 'package' }
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    return { success: false, duration, packageName, type: 'package', error: error.message }
  }
}

/**
 * Build a single app
 */
async function buildApp(appName) {
  const appDir = join(rootDir, 'apps', appName)

  if (!existsSync(appDir)) {
    throw new Error(`App directory not found: ${appDir}`)
  }

  const startTime = Date.now()

  try {
    // Run the build command for the app
    await runCommand('pnpm', ['run', 'build'], appDir)

    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    return { success: true, duration, packageName: appName, type: 'app' }
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    return { success: false, duration, packageName: appName, type: 'app', error: error.message }
  }
}

/**
 * Main build function
 */
async function main() {
  console.log('Building packages and apps...')
  const startTime = Date.now()

  const results = []

  // Build packages in sequence to respect dependencies
  for (const packageName of packages) {
    process.stdout.write(`  Building @entente/${packageName}... `)

    const result = await buildPackage(packageName)
    results.push(result)

    if (result.success) {
      console.log(`✓ (${result.duration}s)`)
    } else {
      console.log(`✗ (${result.duration}s)`)
      console.error(`    Error: ${result.error}`)
    }
  }

  // Build apps after packages
  for (const appName of apps) {
    process.stdout.write(`  Building @entente/${appName}... `)

    const result = await buildApp(appName)
    results.push(result)

    if (result.success) {
      console.log(`✓ (${result.duration}s)`)
    } else {
      console.log(`✗ (${result.duration}s)`)
      console.error(`    Error: ${result.error}`)
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
  const successCount = results.filter(r => r.success).length
  const failureCount = results.filter(r => !r.success).length
  const packageCount = results.filter(r => r.type === 'package').length
  const appCount = results.filter(r => r.type === 'app').length

  console.log()
  if (failureCount === 0) {
    console.log(`All ${packageCount} packages and ${appCount} apps built successfully in ${totalTime}s`)
    process.exit(0)
  } else {
    console.log(`${successCount} items built successfully, ${failureCount} failed in ${totalTime}s`)
    process.exit(1)
  }
}

// Handle specific package/app builds
if (process.argv[2]) {
  const target = process.argv[2]

  if (packages.includes(target)) {
    console.log(`Building single package: @entente/${target}`)
    buildPackage(target)
      .then(result => {
        if (result.success) {
          console.log(`✓ @entente/${result.packageName} built in ${result.duration}s`)
          process.exit(0)
        } else {
          console.log(`✗ @entente/${result.packageName} failed in ${result.duration}s`)
          console.error(result.error)
          process.exit(1)
        }
      })
      .catch(console.error)
  } else if (apps.includes(target)) {
    console.log(`Building single app: @entente/${target}`)
    buildApp(target)
      .then(result => {
        if (result.success) {
          console.log(`✓ @entente/${result.packageName} built in ${result.duration}s`)
          process.exit(0)
        } else {
          console.log(`✗ @entente/${result.packageName} failed in ${result.duration}s`)
          console.error(result.error)
          process.exit(1)
        }
      })
      .catch(console.error)
  } else {
    console.error(`Unknown package or app: ${target}`)
    console.error(`Available packages: ${packages.join(', ')}`)
    console.error(`Available apps: ${apps.join(', ')}`)
    process.exit(1)
  }
} else {
  main().catch(console.error)
}