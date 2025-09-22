import { parse as parseToml } from 'toml'
import { BaseExtractor } from './base.js'
import type { MetadataOptions, ProjectMetadata } from '../types.js'

export class PyprojectTomlExtractor extends BaseExtractor {
  getProjectType() {
    return 'python' as const
  }

  getDefaultFilename(): string {
    return 'pyproject.toml'
  }

  async extract(options?: Pick<MetadataOptions, 'projectFile' | 'removeScope'>): Promise<ProjectMetadata> {
    try {
      const content = await this.readProjectFile(options?.projectFile)
      const pyprojectToml = parseToml(content) as any

      if (!pyprojectToml.project) {
        return this.createFallbackMetadata()
      }

      const name = this.processName(pyprojectToml.project.name || 'unknown-service', options?.removeScope)
      const version = pyprojectToml.project.version || '0.0.0'
      const description = pyprojectToml.project.description

      return {
        name,
        version,
        description,
        projectType: this.getProjectType(),
        raw: pyprojectToml
      }
    } catch (error) {
      return this.createFallbackMetadata()
    }
  }
}