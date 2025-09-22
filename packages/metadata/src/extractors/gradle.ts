import { BaseExtractor } from './base.js'
import type { MetadataOptions, ProjectMetadata } from '../types.js'
import { access } from 'node:fs/promises'
import { resolve } from 'node:path'

export class GradleExtractor extends BaseExtractor {
  getProjectType() {
    return 'groovy' as const
  }

  getDefaultFilename(): string {
    return 'build.gradle'
  }

  async isApplicable(cwd: string): Promise<boolean> {
    try {
      // Check for either build.gradle or build.gradle.kts
      const buildGradle = resolve(cwd, 'build.gradle')
      const buildGradleKts = resolve(cwd, 'build.gradle.kts')

      try {
        await access(buildGradle)
        return true
      } catch {
        await access(buildGradleKts)
        return true
      }
    } catch {
      return false
    }
  }

  async extract(options?: Pick<MetadataOptions, 'projectFile' | 'removeScope'>): Promise<ProjectMetadata> {
    try {
      let gradleFile = options?.projectFile

      if (!gradleFile) {
        // Try build.gradle first, then build.gradle.kts
        try {
          await this.readProjectFile('build.gradle')
          gradleFile = 'build.gradle'
        } catch {
          gradleFile = 'build.gradle.kts'
        }
      }

      const content = await this.readProjectFile(gradleFile)

      // Parse Gradle build files for common patterns
      const nameMatch = content.match(/(?:archivesBaseName|project\.name)\s*=\s*['"](.*?)['"]/) ||
                       content.match(/name\s*=\s*['"](.*?)['"]/)
      const versionMatch = content.match(/version\s*=\s*['"](.*?)['"]/)
      const descriptionMatch = content.match(/description\s*=\s*['"](.*?)['"]/)

      // Fallback to directory name if no explicit name found
      const name = this.processName(
        nameMatch?.[1] || this.cwd.split('/').pop() || 'unknown-service',
        options?.removeScope
      )
      const version = versionMatch?.[1] || '0.0.0'
      const description = descriptionMatch?.[1]

      return {
        name,
        version,
        description,
        projectType: this.getProjectType(),
        raw: {
          gradleFile,
          content
        }
      }
    } catch (error) {
      return this.createFallbackMetadata()
    }
  }
}