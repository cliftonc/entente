import { parse as parseToml } from 'toml'
import { BaseExtractor } from './base.js'
import type { MetadataOptions, ProjectMetadata } from '../types.js'

export class CargoTomlExtractor extends BaseExtractor {
  getProjectType() {
    return 'rust' as const
  }

  getDefaultFilename(): string {
    return 'Cargo.toml'
  }

  async extract(options?: Pick<MetadataOptions, 'projectFile' | 'removeScope'>): Promise<ProjectMetadata> {
    try {
      const content = await this.readProjectFile(options?.projectFile)
      const cargoToml = parseToml(content) as any

      if (!cargoToml.package) {
        return this.createFallbackMetadata()
      }

      const name = this.processName(cargoToml.package.name || 'unknown-service', options?.removeScope)
      const version = cargoToml.package.version || '0.0.0'
      const description = cargoToml.package.description

      return {
        name,
        version,
        description,
        projectType: this.getProjectType(),
        raw: cargoToml
      }
    } catch (error) {
      return this.createFallbackMetadata()
    }
  }
}