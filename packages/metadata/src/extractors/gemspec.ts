import { BaseExtractor } from './base.js'
import type { MetadataOptions, ProjectMetadata } from '../types.js'
import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'

export class GemspecExtractor extends BaseExtractor {
  getProjectType() {
    return 'ruby' as const
  }

  getDefaultFilename(): string {
    return '*.gemspec'
  }

  async isApplicable(cwd: string): Promise<boolean> {
    try {
      const files = await readdir(cwd)
      return files.some(file => file.endsWith('.gemspec'))
    } catch {
      return false
    }
  }

  async extract(options?: Pick<MetadataOptions, 'projectFile' | 'removeScope'>): Promise<ProjectMetadata> {
    try {
      let gemspecFile = options?.projectFile

      if (!gemspecFile) {
        // Find the first .gemspec file
        const files = await readdir(this.cwd)
        const gemspecFiles = files.filter(file => file.endsWith('.gemspec'))
        if (gemspecFiles.length === 0) {
          return this.createFallbackMetadata()
        }
        gemspecFile = gemspecFiles[0]
      }

      const content = await this.readProjectFile(gemspecFile)

      // Simple regex parsing for common gemspec patterns
      const nameMatch = content.match(/s\.name\s*=\s*['"](.*?)['"]/)
      const versionMatch = content.match(/s\.version\s*=\s*['"](.*?)['"]/)
      const descriptionMatch = content.match(/s\.(?:description|summary)\s*=\s*['"](.*?)['"]/)

      const name = this.processName(nameMatch?.[1] || 'unknown-service', options?.removeScope)
      const version = versionMatch?.[1] || '0.0.0'
      const description = descriptionMatch?.[1]

      return {
        name,
        version,
        description,
        projectType: this.getProjectType(),
        raw: {
          gemspecFile,
          content
        }
      }
    } catch (error) {
      return this.createFallbackMetadata()
    }
  }
}