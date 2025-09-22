import { BaseExtractor } from './base.js'
import type { MetadataOptions, ProjectMetadata } from '../types.js'

export class GoModExtractor extends BaseExtractor {
  getProjectType() {
    return 'go' as const
  }

  getDefaultFilename(): string {
    return 'go.mod'
  }

  async extract(options?: Pick<MetadataOptions, 'projectFile' | 'removeScope'>): Promise<ProjectMetadata> {
    try {
      const content = await this.readProjectFile(options?.projectFile)

      // Parse go.mod file - extract module name
      const moduleMatch = content.match(/^module\s+(.+)$/m)
      if (!moduleMatch) {
        return this.createFallbackMetadata()
      }

      const modulePath = moduleMatch[1].trim()

      // Extract service name from module path (e.g., github.com/user/service -> service)
      const name = this.processName(modulePath.split('/').pop() || 'unknown-service', options?.removeScope)

      // Go modules don't have explicit versions in go.mod - typically use git tags
      // For now, default to 0.0.0 unless version is provided via environment
      const version = process.env.GO_MODULE_VERSION || '0.0.0'

      return {
        name,
        version,
        projectType: this.getProjectType(),
        raw: {
          module: modulePath,
          content: content
        }
      }
    } catch (error) {
      return this.createFallbackMetadata()
    }
  }
}