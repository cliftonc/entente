#!/usr/bin/env node

import { promises as fs } from 'node:fs'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import chalk from 'chalk'
import { Command } from 'commander'
import { getProjectMetadata } from '@entente/metadata'
import { loginFlow, logoutFlow, whoAmI } from './auth.js'
import { canIDeploy } from './commands/can-i-deploy.js'
import { deployConsumer } from './commands/deploy-consumer.js'
import { deployProvider } from './commands/deploy-provider.js'
import { deployService } from './commands/deploy-service.js'
import { registerService } from './commands/register-service.js'
import { getDeploymentStatus } from './commands/status.js'
import { uploadSpec } from './commands/upload-spec.js'

const program = new Command()

// Get the actual package version using metadata package
const __dirname = dirname(fileURLToPath(import.meta.url))
const cliMetadata = await getProjectMetadata({ cwd: join(__dirname, '..') })

// Get project metadata once for all commands
let projectMetadata
try {
  projectMetadata = await getProjectMetadata()
} catch (error) {
  // Set to null if we couldn't read it - commands will require explicit parameters
  projectMetadata = null
}

program.name('entente').description('CLI for Entente contract testing')

// Disable Commander's default version option and add our own
program.option('--entente-version', 'show CLI version')

// Authentication commands
program
  .command('login')
  .description('Authenticate with Entente server')
  .option('--server <url>', 'Server URL', 'https://entente.dev')
  .action(async options => {
    try {
      await loginFlow(options.server)
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error')
      process.exit(1)
    }
  })

program
  .command('logout')
  .description('Remove stored credentials')
  .action(async () => {
    try {
      await logoutFlow()
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error')
      process.exit(1)
    }
  })

program
  .command('whoami')
  .description('Show current authenticated user')
  .action(async () => {
    try {
      await whoAmI()
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error')
      process.exit(1)
    }
  })

// Registration commands
program
  .command('register-service')
  .description(
    'Register a service with package.json and optionally upload API spec'
  )
  .option('-s, --service <service>', 'Service name (defaults to package.json name)')
  .option('-v, --version <version>', 'Service version (defaults to package.json version)')
  .option('-p, --package <path>', 'Path to package.json', './package.json')
  .option('-d, --description <desc>', 'Service description')
  .option('--spec <file>', 'Path to API spec file to upload')
  .option('-b, --branch <branch>', 'Git branch for spec', 'main')
  .action(async options => {
    try {
      let service = options.service
      let version = options.version

      // Use global metadata if available
      if (!service && projectMetadata) {
        service = projectMetadata.name
      }

      if (!version && projectMetadata) {
        version = projectMetadata.version
      }

      if (service && version && projectMetadata) {
        const sourceInfo = projectMetadata.projectType !== 'unknown'
          ? `${projectMetadata.projectType} project`
          : options.package
        console.log(
          chalk.gray(`Using service "${service}" version "${version}" from ${sourceInfo}`)
        )
      }

      if (!service || !version) {
        console.error(chalk.red('Error: Service name and version are required'))
        process.exit(1)
      }

      console.log('▶', `Registering service ${service}...`)
      await registerService({
        name: service,
        description: options.description,
      }, projectMetadata)

      // If spec provided, upload it
      if (options.spec) {
        console.log('▶', `Uploading API spec for ${service}...`)
        await uploadSpec({
          service: service,
          spec: options.spec,
          branch: options.branch,
          version: version,
        }, projectMetadata)
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error')
      process.exit(1)
    }
  })

// Deployment commands
program
  .command('deploy-service')
  .description('Deploy a service')
  .option('-s, --service <service>', 'Service name (defaults to package.json name)')
  .option('-v, --version <version>', 'Service version (defaults to package.json version)')
  .requiredOption('-e, --environment <environment>', 'Target environment')
  .option('--deployed-by <user>', 'User who deployed (defaults to $USER)')
  .option('-p, --package <path>', 'Path to package.json', './package.json')
  .action(async options => {
    try {
      let service = options.service
      let version = options.version

      // Use global metadata if available
      if (!service && projectMetadata) {
        service = projectMetadata.name
      }

      if (!version && projectMetadata) {
        version = projectMetadata.version
      }

      if (service && version && projectMetadata) {
        const sourceInfo = projectMetadata.projectType !== 'unknown'
          ? `${projectMetadata.projectType} project`
          : options.package
        console.log(
          chalk.gray(`Using service "${service}" version "${version}" from ${sourceInfo}`)
        )
      }

      if (!service || !version) {
        console.error(chalk.red('Error: Service name and version are required'))
        process.exit(1)
      }

      console.log(
        '▶',
        `Deploying service ${service}@${version} to ${options.environment}...`
      )
      await deployService({
        name: service,
        version: version,
        environment: options.environment,
        deployedBy: options.deployedBy,
      }, projectMetadata)
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error')
      process.exit(1)
    }
  })

// Upload API specification (with auto-registration)
program
  .command('upload-spec')
  .description(
    'Upload API specification (OpenAPI, GraphQL, AsyncAPI) to central service (auto-registers service if needed)'
  )
  .option('-s, --service <service>', 'Service name (defaults to package.json name)')
  .option('-v, --version <version>', 'Service version (defaults to package.json version)')
  .requiredOption('--spec <file>', 'Path to API spec file (JSON, GraphQL, etc.)')
  .option('-b, --branch <branch>', 'Git branch', 'main')
  .option('-p, --package <path>', 'Path to package.json', './package.json')
  .action(async options => {
    try {
      let service = options.service
      let version = options.version

      // Use global metadata if available
      if (!service && projectMetadata) {
        service = projectMetadata.name
      }

      if (!version && projectMetadata) {
        version = projectMetadata.version
      }

      if (service && version && projectMetadata) {
        const sourceInfo = projectMetadata.projectType !== 'unknown'
          ? `${projectMetadata.projectType} project`
          : options.package
        console.log(
          chalk.gray(`Using service "${service}" version "${version}" from ${sourceInfo}`)
        )
      }

      if (!service || !version) {
        console.error(chalk.red('Error: Service name and version are required'))
        process.exit(1)
      }

      console.log(
        '▶',
        `Uploading API spec for ${service}@${version}...`
      )
      await uploadSpec({
        service: service,
        version: version,
        spec: options.spec,
        branch: options.branch,
      }, projectMetadata)
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error')
      process.exit(1)
    }
  })

// Can I deploy check
program
  .command('can-i-deploy')
  .description('Check if service can safely deploy to environment')
  .option(
    '-s, --service <service>',
    'Service name (consumer or provider) - defaults to package.json name'
  )
  .option('-v, --version <version>', 'Service version - defaults to package.json version')
  .requiredOption('-e, --environment <environment>', 'Target environment')
  .option('--semver-compatibility <level>', 'Allow semver-compatible versions (none, patch, minor)', 'none')
  .option('-p, --package <path>', 'Path to package.json', './package.json')
  .action(async options => {
    try {
      // Validate semver compatibility option
      if (!['none', 'patch', 'minor'].includes(options.semverCompatibility)) {
        console.error(chalk.red('Error: --semver-compatibility must be one of: none, patch, minor'))
        process.exit(1)
      }

      let service = options.service
      let version = options.version

      // Use global metadata if available
      if (!service && projectMetadata) {
        service = projectMetadata.name
      }

      if (!version && projectMetadata) {
        version = projectMetadata.version
      }

      if (service && version && projectMetadata) {
        const sourceInfo = projectMetadata.projectType !== 'unknown'
          ? `${projectMetadata.projectType} project`
          : options.package
        console.log(
          chalk.gray(`Using service "${service}" version "${version}" from ${sourceInfo}`)
        )
      }

      if (!service || !version) {
        console.error(chalk.red('Error: Service name and version are required'))
        process.exit(1)
      }

      console.log(
        '▶',
        `Checking if ${service}@${version} can deploy to ${options.environment}...`
      )
      const result = await canIDeploy({
        service: service,
        version: version,
        environment: options.environment,
        semverCompatibility: options.semverCompatibility,
      }, projectMetadata)

      if (result.canDeploy) {
        const compatibilityNote = options.semverCompatibility !== 'none' &&
          [...(result.providers || []), ...(result.consumers || [])].some(s => s.semverCompatible && s.semverCompatible !== 'none')
          ? ` (with ${options.semverCompatibility} compatibility)`
          : ''

        console.log(
          chalk.green('✓'),
          `${service} v${version} can deploy to ${options.environment}${compatibilityNote}`
        )
        console.log('')

        // Display providers (dependencies)
        if (result.providers && result.providers.length > 0) {
          console.log(`Providers (${result.providers.length}):`)
          for (const provider of result.providers) {
            const status = provider.verified ? chalk.green('✓') : chalk.yellow('!')
            const compatibilityLabel = provider.semverCompatible && provider.semverCompatible !== 'none'
              ? chalk.blue(` [${provider.semverCompatible}-compatible]`)
              : ''
            const nearestLabel = provider.nearestVerifiedVersion && provider.nearestVerifiedVersion !== provider.version
              ? chalk.gray(` (verified at v${provider.nearestVerifiedVersion})`)
              : ''
            console.log(
              `  ${status} ${provider.service} v${provider.version} (${provider.interactionCount} interactions)${compatibilityLabel}${nearestLabel}`
            )
          }
          console.log('')
        }

        // Display consumers (dependents)
        if (result.consumers && result.consumers.length > 0) {
          console.log(`Consumers (${result.consumers.length}):`)
          for (const consumer of result.consumers) {
            const status = consumer.verified ? chalk.green('✓') : chalk.yellow('!')
            const compatibilityLabel = consumer.semverCompatible && consumer.semverCompatible !== 'none'
              ? chalk.blue(` [${consumer.semverCompatible}-compatible]`)
              : ''
            console.log(
              `  ${status} ${consumer.service} v${consumer.version} (${consumer.interactionCount} interactions)${compatibilityLabel}`
            )
          }
          console.log('')
        }

        console.log(chalk.green('Safe to deploy ✓'))
      } else {
        console.log(
          chalk.red('✗'),
          `${service} v${version} cannot deploy to ${options.environment}`
        )
        console.log('')

        // Display structured issues
        if (result.issues && result.issues.length > 0) {
          console.log('Issues blocking deployment:')
          for (const issue of result.issues) {
            console.log(`  • ${issue.service}@${issue.version} - ${issue.reason}`)
            if (issue.suggestion) {
              console.log(`    > ${issue.suggestion}`)
            }
          }
          console.log('')
        }

        // Display providers (dependencies) with status
        if (result.providers && result.providers.length > 0) {
          console.log(`Providers (${result.providers.length}):`)
          for (const provider of result.providers) {
            if (!provider.activelyDeployed) {
              // Special format for non-deployed services
              console.log(`  ${chalk.red('✗')} ${provider.service} is not deployed in ${options.environment}`)
            } else {
              const status = provider.verified ? chalk.green('✓') : chalk.red('✗')
              const compatibilityLabel = provider.semverCompatible && provider.semverCompatible !== 'none'
                ? chalk.blue(` [${provider.semverCompatible}-compatible]`)
                : ''
              const nearestLabel = provider.nearestVerifiedVersion && provider.nearestVerifiedVersion !== provider.version
                ? chalk.gray(` (nearest: v${provider.nearestVerifiedVersion})`)
                : ''
              console.log(
                `  ${status} ${provider.service} v${provider.version} (${provider.interactionCount} interactions)${compatibilityLabel}${nearestLabel}`
              )
            }
          }
          console.log('')
        }

        // Display consumers (dependents) with status
        if (result.consumers && result.consumers.length > 0) {
          console.log(`Consumers (${result.consumers.length}):`)
          for (const consumer of result.consumers) {
            if (!consumer.activelyDeployed) {
              // Special format for non-deployed services
              console.log(`  ${chalk.red('✗')} ${consumer.service} is not deployed in ${options.environment}`)
            } else {
              const status = consumer.verified ? chalk.green('✓') : chalk.red('✗')
              const compatibilityLabel = consumer.semverCompatible && consumer.semverCompatible !== 'none'
                ? chalk.blue(` [${consumer.semverCompatible}-compatible]`)
                : ''
              console.log(
                `  ${status} ${consumer.service} v${consumer.version} (${consumer.interactionCount} interactions)${compatibilityLabel}`
              )
            }
          }
          console.log('')
        }

        console.log(chalk.red(result.message))
        console.log('')
        console.log(chalk.gray('NOTE: Failed deployment attempt has been recorded for analysis'))
        process.exit(1)
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error')
      process.exit(1)
    }
  })


// Deployment status
program
  .command('status')
  .description('Show deployment status for environment')
  .requiredOption('-e, --environment <environment>', 'Environment to check')
  .option('--include-failures', 'Include failed deployment attempts', false)
  .action(async options => {
    try {
      await getDeploymentStatus(options.environment, options.includeFailures, projectMetadata)
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error')
      process.exit(1)
    }
  })

// Show help if no arguments provided
if (process.argv.length === 2) {
  program.help()
}

// Handle --entente-version flag before parsing
if (process.argv.includes('--entente-version')) {
  console.log(`@entente/cli version ${cliMetadata.version}`)
  process.exit(0)
}

// Parse command line arguments
program.parse()
