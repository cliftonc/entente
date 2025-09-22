import { detectProjectType } from './detector.js'
import { getMetadataConfig } from './config.js'
import type { MetadataOptions, ProjectMetadata, ProjectType } from './types.js'
import { PackageJsonExtractor } from './extractors/packageJson.js'
import { GoModExtractor } from './extractors/goMod.js'
import { CargoTomlExtractor } from './extractors/cargoToml.js'
import { PyprojectTomlExtractor } from './extractors/pyproject.js'
import { GemspecExtractor } from './extractors/gemspec.js'
import { MavenExtractor } from './extractors/maven.js'
import { GradleExtractor } from './extractors/gradle.js'
import { DotnetExtractor } from './extractors/dotnet.js'

/**
 * Main function to extract project metadata with auto-detection
 */
export async function getProjectMetadata(options?: MetadataOptions): Promise<ProjectMetadata> {
  const cwd = options?.cwd || process.cwd()

  // Load project configuration
  const config = await getMetadataConfig(cwd)

  // Merge options with config (options take priority)
  const mergedOptions: MetadataOptions = {
    removeScope: config.removeScope,
    projectFile: config.preferredProjectFile,
    cwd,
    ...options
  }

  // Override service name if configured
  if (config.serviceNameOverride) {
    const metadata = await extractMetadataInternal(mergedOptions)
    return {
      ...metadata,
      name: config.serviceNameOverride
    }
  }

  return extractMetadataInternal(mergedOptions)
}

async function extractMetadataInternal(options: MetadataOptions): Promise<ProjectMetadata> {
  const cwd = options.cwd || process.cwd()

  // If projectFile is specified, try to determine extractor by file extension
  if (options.projectFile) {
    const extractor = getExtractorByFilename(options.projectFile, cwd)
    if (extractor) {
      return extractor.extract(options)
    }
  }

  // Auto-detect project type
  const extractor = await detectProjectType(cwd)
  if (extractor) {
    return extractor.extract(options)
  }

  // Fallback when no project type detected
  return {
    name: 'unknown-service',
    version: '0.0.0',
    projectType: 'unknown',
    raw: {}
  }
}

/**
 * Get extractor by filename/extension
 */
function getExtractorByFilename(filename: string, cwd: string) {
  const lowerFilename = filename.toLowerCase()

  if (lowerFilename.includes('package.json')) {
    return new PackageJsonExtractor(cwd)
  }
  if (lowerFilename.includes('go.mod')) {
    return new GoModExtractor(cwd)
  }
  if (lowerFilename.includes('cargo.toml')) {
    return new CargoTomlExtractor(cwd)
  }
  if (lowerFilename.includes('pyproject.toml')) {
    return new PyprojectTomlExtractor(cwd)
  }
  if (lowerFilename.includes('.gemspec')) {
    return new GemspecExtractor(cwd)
  }
  if (lowerFilename.includes('pom.xml')) {
    return new MavenExtractor(cwd)
  }
  if (lowerFilename.includes('build.gradle')) {
    return new GradleExtractor(cwd)
  }
  if (lowerFilename.includes('.csproj') || lowerFilename.includes('.fsproj') || lowerFilename.includes('.vbproj')) {
    return new DotnetExtractor(cwd)
  }

  return null
}

// Type-specific extractors for explicit use
export async function getPackageJsonMetadata(options?: MetadataOptions): Promise<ProjectMetadata> {
  const cwd = options?.cwd || process.cwd()
  const extractor = new PackageJsonExtractor(cwd)
  return extractor.extract(options)
}

export async function getGoModMetadata(options?: MetadataOptions): Promise<ProjectMetadata> {
  const cwd = options?.cwd || process.cwd()
  const extractor = new GoModExtractor(cwd)
  return extractor.extract(options)
}

export async function getCargoTomlMetadata(options?: MetadataOptions): Promise<ProjectMetadata> {
  const cwd = options?.cwd || process.cwd()
  const extractor = new CargoTomlExtractor(cwd)
  return extractor.extract(options)
}

export async function getPyprojectTomlMetadata(options?: MetadataOptions): Promise<ProjectMetadata> {
  const cwd = options?.cwd || process.cwd()
  const extractor = new PyprojectTomlExtractor(cwd)
  return extractor.extract(options)
}

export async function getGemspecMetadata(options?: MetadataOptions): Promise<ProjectMetadata> {
  const cwd = options?.cwd || process.cwd()
  const extractor = new GemspecExtractor(cwd)
  return extractor.extract(options)
}

export async function getMavenMetadata(options?: MetadataOptions): Promise<ProjectMetadata> {
  const cwd = options?.cwd || process.cwd()
  const extractor = new MavenExtractor(cwd)
  return extractor.extract(options)
}

export async function getGradleMetadata(options?: MetadataOptions): Promise<ProjectMetadata> {
  const cwd = options?.cwd || process.cwd()
  const extractor = new GradleExtractor(cwd)
  return extractor.extract(options)
}

export async function getDotnetMetadata(options?: MetadataOptions): Promise<ProjectMetadata> {
  const cwd = options?.cwd || process.cwd()
  const extractor = new DotnetExtractor(cwd)
  return extractor.extract(options)
}

// Export types and utilities
export type { ProjectMetadata, MetadataOptions, ProjectType } from './types.js'
export type { MetadataConfig, ProjectConfig } from './config.js'
export { detectProjectType, detectAllProjectTypes } from './detector.js'
export { removeScopeFromName } from './utils/scope.js'
export { loadProjectConfig, getMetadataConfig } from './config.js'