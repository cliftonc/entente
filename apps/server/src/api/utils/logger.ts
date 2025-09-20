// Re-export the shared debug utility from @entente/types
export { debugLog } from '@entente/types'

// Context-aware logging for when you have access to Hono context
export function contextLog(
  env: Record<string, string | undefined> | undefined,
  ...args: unknown[]
): void {
  if (env?.ENTENTE_DEBUG === 'true') {
    console.log(...args)
  }
}
