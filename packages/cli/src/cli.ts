#!/usr/bin/env node

import { Command } from 'commander'
import chalk from 'chalk'
import {
  uploadSpec,
  recordDeployment,
  canIDeploy,
  approveFixtures,
  listFixtures,
  getDeploymentStatus,
} from './index.js'
import { loginFlow, logoutFlow, whoAmI } from './auth.js'

const program = new Command()

program
  .name('entente')
  .description('CLI for Entente contract testing')
  .version('0.1.0')

// Authentication commands
program
  .command('login')
  .description('Authenticate with Entente server')
  .option('--server <url>', 'Server URL', 'http://localhost:3000')
  .action(async (options) => {
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

// Upload OpenAPI specification
program
  .command('upload-spec')
  .description('Upload OpenAPI specification to central service')
  .requiredOption('-s, --service <service>', 'Service name')
  .requiredOption('-v, --version <version>', 'Service version')
  .requiredOption('-e, --environment <environment>', 'Target environment')
  .requiredOption('--spec <file>', 'Path to OpenAPI spec file')
  .option('-b, --branch <branch>', 'Git branch', 'main')
  .action(async (options) => {
    try {
      await uploadSpec(options)
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error')
      process.exit(1)
    }
  })

// Record deployment
program
  .command('record-deployment')
  .description('Record service deployment state')
  .requiredOption('-s, --service <service>', 'Service name')
  .requiredOption('-v, --version <version>', 'Service version')
  .requiredOption('-e, --environment <environment>', 'Target environment')
  .option('--deployed-by <user>', 'User who deployed (defaults to $USER)')
  .action(async (options) => {
    try {
      await recordDeployment(options)
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error')
      process.exit(1)
    }
  })

// Can I deploy check
program
  .command('can-i-deploy')
  .description('Check if consumer can safely deploy to environment')
  .requiredOption('-c, --consumer <consumer>', 'Consumer service name')
  .requiredOption('-v, --version <version>', 'Consumer version')
  .requiredOption('-e, --environment <environment>', 'Target environment')
  .action(async (options) => {
    try {
      const result = await canIDeploy(options)
      
      if (result.canDeploy) {
        console.log(chalk.green('✅'), `${options.consumer} v${options.version} can deploy to ${options.environment}`)
        console.log('')
        console.log('Compatible with active providers:')
        for (const provider of result.compatibleProviders) {
          const status = provider.verified ? chalk.green('✅') : chalk.yellow('⚠️')
          console.log(`  - ${provider.service} v${provider.version} ${status} (${provider.interactionCount} interactions)`)
        }
        console.log('')
        console.log(chalk.green('Safe to deploy ✅'))
      } else {
        console.log(chalk.red('❌'), `${options.consumer} v${options.version} cannot deploy to ${options.environment}`)
        console.log('')
        console.log(chalk.red(result.message))
        process.exit(1)
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error')
      process.exit(1)
    }
  })

// Fixture management
const fixtureCommand = program
  .command('fixtures')
  .description('Manage fixtures')

fixtureCommand
  .command('approve')
  .description('Approve fixture proposals')
  .requiredOption('--approved-by <user>', 'User approving the fixtures')
  .option('--test-run <id>', 'Approve all fixtures from a test run')
  .option('--service <service>', 'Approve fixtures for specific service')
  .action(async (options) => {
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
  .action(async (options) => {
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
  .action(async (options) => {
    try {
      await getDeploymentStatus(options.environment)
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error')
      process.exit(1)
    }
  })

// Parse command line arguments
program.parse()