import type { Context, Next } from 'hono'

// Generic environment bindings interface for Cloudflare Workers
// Add any new environment variables here
interface Env {
  DATABASE_URL?: string
  GITHUB_CLIENT_ID?: string
  GITHUB_CLIENT_SECRET?: string
  APP_URL?: string
  NODE_ENV?: string
  // Add more environment variables as needed
}

// Environment helper type
type EnvVars = Record<string, string | undefined>

// Extend Hono context with environment variables
declare module 'hono' {
  interface ContextVariableMap {
    env: EnvVars
  }
}

export async function envMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  // In Cloudflare Workers, use c.env
  // In development, fall back to process.env
  const env: EnvVars = {
    DATABASE_URL: c.env?.DATABASE_URL || process.env.DATABASE_URL,
    GITHUB_CLIENT_ID: c.env?.GITHUB_CLIENT_ID || process.env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: c.env?.GITHUB_CLIENT_SECRET || process.env.GITHUB_CLIENT_SECRET,
    APP_URL: c.env?.APP_URL || process.env.APP_URL,
    NODE_ENV: c.env?.NODE_ENV || process.env.NODE_ENV,
    // Add more environment variables as needed
  }

  // Set the environment variables in the context
  c.set('env', env)

  await next()
}

// Helper function to get a required environment variable
export function getRequiredEnv(env: EnvVars, key: string): string {
  const value = env[key]
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

// Helper function to get an optional environment variable with default
export function getEnv(env: EnvVars, key: string, defaultValue?: string): string | undefined {
  return env[key] || defaultValue
}