import { BaseExtractor } from './base.js'
import type { MetadataOptions, ProjectMetadata } from '../types.js'

export class PackageJsonExtractor extends BaseExtractor {
  getProjectType() {
    return 'node' as const
  }

  getDefaultFilename(): string {
    return 'package.json'
  }

  async extract(options?: Pick<MetadataOptions, 'projectFile' | 'removeScope'>): Promise<ProjectMetadata> {
    try {
      const content = await this.readProjectFile(options?.projectFile)
      const packageJson = JSON.parse(content)

      const name = this.processName(packageJson.name || 'unknown-service', options?.removeScope)
      const version = packageJson.version || '0.0.0'
      const description = packageJson.description

      return {
        name,
        version,
        description,
        projectType: this.getProjectType(),
        raw: packageJson
      }
    } catch (error) {
      // If we can't read or parse package.json, return fallback
      return this.createFallbackMetadata()
    }
  }
}