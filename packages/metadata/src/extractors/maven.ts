import { BaseExtractor } from './base.js'
import type { MetadataOptions, ProjectMetadata } from '../types.js'

export class MavenExtractor extends BaseExtractor {
  getProjectType() {
    return 'java' as const
  }

  getDefaultFilename(): string {
    return 'pom.xml'
  }

  async extract(options?: Pick<MetadataOptions, 'projectFile' | 'removeScope'>): Promise<ProjectMetadata> {
    try {
      const content = await this.readProjectFile(options?.projectFile)

      // Simple XML parsing for Maven POM files
      const artifactIdMatch = content.match(/<artifactId>(.*?)<\/artifactId>/)
      const versionMatch = content.match(/<version>(.*?)<\/version>/)
      const nameMatch = content.match(/<name>(.*?)<\/name>/)
      const descriptionMatch = content.match(/<description>(.*?)<\/description>/)

      // Use artifactId as the service name (more reliable than <name>)
      const name = this.processName(artifactIdMatch?.[1] || 'unknown-service', options?.removeScope)
      const version = versionMatch?.[1] || '0.0.0'
      const description = descriptionMatch?.[1] || nameMatch?.[1]

      return {
        name,
        version,
        description,
        projectType: this.getProjectType(),
        raw: {
          content,
          artifactId: artifactIdMatch?.[1],
          displayName: nameMatch?.[1]
        }
      }
    } catch (error) {
      return this.createFallbackMetadata()
    }
  }
}