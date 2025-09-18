#!/usr/bin/env node

import { promises as fs } from 'node:fs'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import chalk from 'chalk'
import { Command } from 'commander'
import { loginFlow, logoutFlow, whoAmI } from './auth.js'
import {
  approveFixtures,
  canIDeploy,
  deployConsumer,
  deployProvider,
  getDeploymentStatus,
  listFixtures,
  recordDeployment,
  registerConsumer,
  registerProvider,
  registerService,
  uploadSpec,
} from './index.js'

const program = new Command()

// Get the actual package version
const __dirname = dirname(fileURLToPath(import.meta.url))
const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'))

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
    'Register a service (consumer or provider) with package.json and optionally upload OpenAPI spec'
  )
  .requiredOption('-s, --service <service>', 'Service name')
  .requiredOption('-t, --type <type>', 'Service type: consumer or provider')
  .option('-p, --package <path>', 'Path to package.json', './package.json')
  .option('-d, --description <desc>', 'Service description')
  .option('--spec <file>', 'Path to OpenAPI spec file to upload (providers only)')
  .option(
    '-e, --environment <environment>',
    'Environment for spec (required if --spec provided)',
    'development'
  )
  .option('-b, --branch <branch>', 'Git branch for spec', 'main')
  .action(async options => {
    try {
      if (!['consumer', 'provider'].includes(options.type)) {
        throw new Error('Type must be either "consumer" or "provider"')
      }

      console.log(chalk.blue('📦'), `Registering ${options.type} service ${options.service}...`)
      await registerService({
        name: options.service,
        type: options.type,
        packagePath: options.package,
        description: options.description,
      })

      // If spec provided and it's a provider, upload it
      if (options.spec) {
        if (options.type !== 'provider') {
          console.log(
            chalk.yellow('⚠️'),
            'Skipping OpenAPI spec upload - specs can only be uploaded for provider services'
          )
          return
        }

        console.log(chalk.blue('📤'), `Uploading OpenAPI spec for ${options.service}...`)
        await uploadSpec({
          service: options.service,
          environment: options.environment,
          spec: options.spec,
          branch: options.branch,
        })
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error')
      process.exit(1)
    }
  })

program
  .command('register-provider')
  .description('Register a provider with package.json and optionally upload OpenAPI spec')
  .requiredOption('-s, --service <service>', 'Provider service name')
  .option('-p, --package <path>', 'Path to package.json', './package.json')
  .option('-d, --description <desc>', 'Provider description')
  .option('--spec <file>', 'Path to OpenAPI spec file to upload')
  .option('-v, --version <version>', 'Provider version (required if --spec provided)')
  .option(
    '-e, --environment <environment>',
    'Environment for spec (required if --spec provided)',
    'development'
  )
  .option('-b, --branch <branch>', 'Git branch for spec', 'main')
  .action(async options => {
    try {
      console.log(chalk.blue('📦'), `Registering provider ${options.service}...`)
      await registerProvider({
        name: options.service,
        packagePath: options.package,
        description: options.description,
      })

      // If spec provided, upload it
      if (options.spec) {
        if (!options.version) {
          throw new Error('--version is required when --spec is provided')
        }

        console.log(
          chalk.blue('📤'),
          `Uploading OpenAPI spec for ${options.service}@${options.version}...`
        )
        await uploadSpec({
          service: options.service,
          version: options.version,
          environment: options.environment,
          spec: options.spec,
          branch: options.branch,
        })
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error')
      process.exit(1)
    }
  })

program
  .command('register-consumer')
  .description('Register a consumer with package.json')
  .requiredOption('-s, --service <service>', 'Consumer service name')
  .requiredOption('-p, --package <path>', 'Path to package.json', './package.json')
  .option('-d, --description <desc>', 'Consumer description')
  .action(async options => {
    try {
      console.log(chalk.blue('📱'), `Registering consumer ${options.service}...`)
      await registerConsumer({
        name: options.service,
        packagePath: options.package,
        description: options.description,
      })
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error')
      process.exit(1)
    }
  })

// Deployment commands
program
  .command('deploy-service')
  .description('Deploy a service (consumer or provider)')
  .requiredOption('-s, --service <service>', 'Service name')
  .requiredOption('-v, --version <version>', 'Service version')
  .requiredOption('-e, --environment <environment>', 'Target environment')
  .requiredOption('-t, --type <type>', 'Service type: consumer or provider')
  .option('--deployed-by <user>', 'User who deployed (defaults to $USER)')
  .action(async options => {
    try {
      if (!['consumer', 'provider'].includes(options.type)) {
        throw new Error('Type must be either "consumer" or "provider"')
      }

      if (options.type === 'consumer') {
        console.log(
          chalk.blue('🚀'),
          `Deploying consumer ${options.service}@${options.version} to ${options.environment} ...`
        )
        await deployConsumer({
          name: options.service,
          version: options.version,
          environment: options.environment,
          deployedBy: options.deployedBy,
        })
      } else {
        console.log(
          chalk.blue('🚀'),
          `Deploying provider ${options.service}@${options.version} to ${options.environment}...`
        )
        await deployProvider({
          name: options.service,
          version: options.version,
          environment: options.environment,
          deployedBy: options.deployedBy,
        })
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error')
      process.exit(1)
    }
  })

// Upload OpenAPI specification (with auto-registration)
program
  .command('upload-spec')
  .description(
    'Upload OpenAPI specification to central service (auto-registers provider if needed)'
  )
  .requiredOption('-s, --service <service>', 'Service name')
  .requiredOption('-v, --version <version>', 'Service version')
  .requiredOption('-e, --environment <environment>', 'Target environment')
  .requiredOption('--spec <file>', 'Path to OpenAPI spec file')
  .option('-b, --branch <branch>', 'Git branch', 'main')
  .action(async options => {
    try {
      console.log(
        chalk.blue('📤'),
        `Uploading OpenAPI spec for ${options.service}@${options.version} to ${options.environment}...`
      )
      await uploadSpec({
        service: options.service,
        version: options.version,
        environment: options.environment,
        spec: options.spec,
        branch: options.branch,
      })
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
  .requiredOption('-t, --type <type>', 'Service type: consumer or provider')
  .option('-p, --package <path>', 'Path to package.json', './package.json')
  .action(async options => {
    try {
      // Validate service type
      if (!['consumer', 'provider'].includes(options.type)) {
        throw new Error('Type must be either "consumer" or "provider"')
      }

      let service = options.service
      let version = options.version

      // If service or version not provided, read from package.json
      if (!service || !version) {
        try {
          const packageJsonPath = options.package
          const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8')
          const packageJson = JSON.parse(packageJsonContent)

          if (!service) {
            // Try to extract service name from package name
            // Handle scoped packages like @entente/example-castle-client -> castle-client
            const packageName = packageJson.name
            if (packageName) {
              // Remove scope and common prefixes
              service = packageName
                .replace(/^@[^\/]+\//, '') // Remove scope like @entente/
                .replace(/^example-/, '') // Remove example- prefix
                .replace(/^entente-/, '') // Remove entente- prefix
            }
          }

          if (!version) {
            version = packageJson.version
          }

          if (service && version) {
            console.log(
              chalk.gray(`Using service "${service}" version "${version}" from ${packageJsonPath}`)
            )
          }
        } catch (error) {
          console.error(
            chalk.red('Error reading package.json:'),
            error instanceof Error ? error.message : 'Unknown error'
          )
          if (!service || !version) {
            console.error(
              chalk.red(
                'Service name and version are required. Provide them via --service and --version or ensure package.json exists.'
              )
            )
            process.exit(1)
          }
        }
      }

      if (!service || !version) {
        console.error(chalk.red('Error: Service name and version are required'))
        process.exit(1)
      }

      console.log(
        chalk.blue('🔍'),
        `Checking if ${service}@${version} can deploy to ${options.environment}...`
      )
      const result = await canIDeploy({
        service: service,
        version: version,
        environment: options.environment,
        type: options.type,
      })

      if (result.canDeploy) {
        console.log(
          chalk.green('✅'),
          `${service} v${version} can deploy to ${options.environment}`
        )
        console.log('')

        if (result.compatibleServices && result.compatibleServices.length > 0) {
          const serviceType = result.serviceType || 'service'
          console.log(`Compatible services (${serviceType}):`)
          for (const compatibleService of result.compatibleServices) {
            const status = compatibleService.verified ? chalk.green('✅') : chalk.yellow('⚠️')
            const typeLabel = compatibleService.type ? `[${compatibleService.type}]` : ''
            const deployedLabel =
              compatibleService.activelyDeployed === false ? ' (not deployed)' : ''
            console.log(
              `  - ${compatibleService.service} v${compatibleService.version} ${status} (${compatibleService.interactionCount} interactions) ${typeLabel}${deployedLabel}`
            )
          }
        }

        console.log('')
        console.log(chalk.green('Safe to deploy ✅'))
      } else {
        console.log(
          chalk.red('❌'),
          `${service} v${version} cannot deploy to ${options.environment}`
        )
        console.log('')
        console.log(chalk.red(result.message))
        if (result.serviceType) {
          console.log(chalk.gray(`Service type: ${result.serviceType}`))
        }
        console.log('')
        console.log(chalk.gray('📝 Failed deployment attempt has been recorded for analysis'))
        process.exit(1)
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error')
      process.exit(1)
    }
  })

// Fixture management
const fixtureCommand = program.command('fixtures').description('Manage fixtures')

fixtureCommand
  .command('approve')
  .description('Approve fixture proposals')
  .requiredOption('--approved-by <user>', 'User approving the fixtures')
  .option('--test-run <id>', 'Approve all fixtures from a test run')
  .option('--service <service>', 'Approve fixtures for specific service')
  .action(async options => {
    try {
      const count = await approveFixtures(options)
      console.log(chalk.green('✅'), `Approved ${count} fixture(s)`)
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error')
      process.exit(1)
    }
  })

fixtureCommand
  .command('list')
  .description('List fixture proposals')
  .option('--service <service>', 'Filter by service')
  .option('--status <status>', 'Filter by status', 'draft')
  .action(async options => {
    try {
      await listFixtures(options)
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
      await getDeploymentStatus(options.environment, options.includeFailures)
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
  console.log(`@entente/cli version ${packageJson.version}`)
  process.exit(0)
}

// Parse command line arguments
program.parse()
