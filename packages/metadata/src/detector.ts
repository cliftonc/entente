import type { MetadataExtractor } from './types.js'
import { PackageJsonExtractor } from './extractors/packageJson.js'
import { GoModExtractor } from './extractors/goMod.js'
import { CargoTomlExtractor } from './extractors/cargoToml.js'
import { PyprojectTomlExtractor } from './extractors/pyproject.js'
import { GemspecExtractor } from './extractors/gemspec.js'
import { MavenExtractor } from './extractors/maven.js'
import { GradleExtractor } from './extractors/gradle.js'
import { DotnetExtractor } from './extractors/dotnet.js'

/**
 * Auto-detect the project type based on files present in the directory
 * Order matters - earlier extractors take precedence
 */
export async function detectProjectType(cwd: string = process.cwd()): Promise<MetadataExtractor | null> {
  const extractors: MetadataExtractor[] = [
    new PackageJsonExtractor(cwd),    // Node.js/npm
    new MavenExtractor(cwd),          // Java/Maven
    new GradleExtractor(cwd),         // Java/Groovy/Gradle
    new CargoTomlExtractor(cwd),      // Rust/Cargo
    new GoModExtractor(cwd),          // Go modules
    new PyprojectTomlExtractor(cwd),  // Python
    new DotnetExtractor(cwd),         // .NET (C#/F#/VB.NET)
    new GemspecExtractor(cwd),        // Ruby/Gems
  ]

  for (const extractor of extractors) {
    if (await extractor.isApplicable(cwd)) {
      return extractor
    }
  }

  return null
}

/**
 * Get all applicable extractors for a directory (useful for projects with multiple manifests)
 */
export async function detectAllProjectTypes(cwd: string = process.cwd()): Promise<MetadataExtractor[]> {
  const extractors: MetadataExtractor[] = [
    new PackageJsonExtractor(cwd),
    new MavenExtractor(cwd),
    new GradleExtractor(cwd),
    new CargoTomlExtractor(cwd),
    new GoModExtractor(cwd),
    new PyprojectTomlExtractor(cwd),
    new DotnetExtractor(cwd),
    new GemspecExtractor(cwd),
  ]

  const applicable: MetadataExtractor[] = []
  for (const extractor of extractors) {
    if (await extractor.isApplicable(cwd)) {
      applicable.push(extractor)
    }
  }

  return applicable
}