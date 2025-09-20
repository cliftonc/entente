/**
 * Semantic version matching utilities for finding the best version match
 * when an exact version is not available.
 */

export interface VersionCandidate {
  id: string
  version: string
  // Pass-through metadata (optional) used by callers
  spec?: any
  specType?: string | null
  createdAt?: Date
}

/**
 * Parse a version string into major.minor.patch components.
 * Returns null if the version doesn't follow semver format.
 */
function parseVersion(version: string): [number, number, number] | null {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/)
  if (!match) return null
  return [
    Number.parseInt(match[1], 10),
    Number.parseInt(match[2], 10),
    Number.parseInt(match[3], 10),
  ]
}

/**
 * Find the best semantic version match for a requested version.
 *
 * Matching strategy:
 * 1. Try exact match first
 * 2. If no exact match, find compatible versions (same major version)
 * 3. Sort by closest minor.patch version (prefer higher versions)
 * 4. If no compatible versions, fallback to latest available version
 *
 * @param requested The requested version string
 * @param available Array of available version candidates
 * @returns The best matching version candidate, or null if no versions available
 */
export function findBestSemverMatch(
  requested: string,
  available: VersionCandidate[]
): VersionCandidate | null {
  if (available.length === 0) {
    return null
  }

  // Try exact match first
  const exactMatch = available.find(v => v.version === requested)
  if (exactMatch) {
    return exactMatch
  }

  const requestedParts = parseVersion(requested)
  if (!requestedParts) {
    // If requested version is not semver format, try exact match only
    return null
  }

  const [reqMajor, reqMinor, reqPatch] = requestedParts

  // Filter and sort available versions
  const compatibleVersions = available
    .map(item => {
      const parts = parseVersion(item.version)
      if (!parts) return null
      return { ...item, parts }
    })
    .filter((item): item is VersionCandidate & { parts: [number, number, number] } => {
      if (!item) return false
      const [major] = item.parts
      // Same major version = compatible
      return major === reqMajor
    })
    .sort((a, b) => {
      const [aMajor, aMinor, aPatch] = a.parts
      const [bMajor, bMinor, bPatch] = b.parts

      // Prefer exact match (shouldn't happen since we checked above, but just in case)
      if (a.version === requested) return -1
      if (b.version === requested) return 1

      // For same major version, prefer the closest higher version
      // Compare minor versions first
      if (aMinor !== bMinor) {
        // If one is exactly the requested minor, prefer it
        if (aMinor === reqMinor) return -1
        if (bMinor === reqMinor) return 1

        // Otherwise prefer higher minor version
        return bMinor - aMinor
      }

      // Same minor version, compare patch
      if (aPatch !== bPatch) {
        // If one is exactly the requested patch, prefer it
        if (aPatch === reqPatch) return -1
        if (bPatch === reqPatch) return 1

        // Otherwise prefer higher patch version
        return bPatch - aPatch
      }

      return 0
    })

  // If we found compatible versions, return the best one
  if (compatibleVersions.length > 0) {
    return compatibleVersions[0]
  }

  // No compatible version in same major, fall back to latest available
  const latestVersion = available
    .map(item => {
      const parts = parseVersion(item.version)
      if (!parts) return null
      return { ...item, parts }
    })
    .filter((item): item is VersionCandidate & { parts: [number, number, number] } => !!item)
    .sort((a, b) => {
      const [aMajor, aMinor, aPatch] = a.parts
      const [bMajor, bMinor, bPatch] = b.parts

      if (aMajor !== bMajor) return bMajor - aMajor
      if (aMinor !== bMinor) return bMinor - aMinor
      return bPatch - aPatch
    })

  return latestVersion[0] || null
}

/**
 * Get the latest version from a list of versions.
 * Handles both semver and non-semver versions.
 */
export function getLatestVersion(available: VersionCandidate[]): VersionCandidate | null {
  if (available.length === 0) {
    return null
  }

  // Try to sort by semver first
  const semverVersions = available
    .map(item => {
      const parts = parseVersion(item.version)
      if (!parts) return null
      return { ...item, parts }
    })
    .filter((item): item is VersionCandidate & { parts: [number, number, number] } => !!item)

  if (semverVersions.length > 0) {
    const sorted = semverVersions.sort((a, b) => {
      const [aMajor, aMinor, aPatch] = a.parts
      const [bMajor, bMinor, bPatch] = b.parts

      if (aMajor !== bMajor) return bMajor - aMajor
      if (aMinor !== bMinor) return bMinor - aMinor
      return bPatch - aPatch
    })

    return sorted[0]
  }

  // Fall back to first available version if no semver versions
  return available[0]
}
