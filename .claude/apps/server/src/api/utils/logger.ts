// Simple logging utility that respects DEBUG environment variable
// Works in both Cloudflare Workers and Node.js environments

export function debugLog(...args: unknown[]): void {
  // In Cloudflare Workers, check globalThis for DEBUG
  // In Node.js, check process.env.DEBUG
  const isDebug =
    (typeof globalThis !== 'undefined' && (globalThis as any).DEBUG === 'true') ||
    (typeof process !== 'undefined' && process.env?.DEBUG === 'true')

  if (isDebug) {
    console.log(...args)
  }
}

// Context-aware logging for when you have access to Hono context
export function contextLog(
  env: Record<string, string | undefined> | undefined,
  ...args: unknown[]
): void {
  if (env?.DEBUG === 'true') {
    console.log(...args)
  }
}
