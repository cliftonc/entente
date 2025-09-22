/**
 * Remove scope prefix from package names
 * Examples:
 * - @entente/consumer -> consumer
 * - @org/my-package -> my-package
 * - regular-package -> regular-package
 */
export function removeScopeFromName(name: string): string {
  if (name.startsWith('@') && name.includes('/')) {
    return name.split('/')[1]
  }
  return name
}