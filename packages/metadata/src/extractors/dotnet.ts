import { BaseExtractor } from './base.js'
import type { MetadataOptions, ProjectMetadata } from '../types.js'
import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'

export class DotnetExtractor extends BaseExtractor {
  getProjectType() {
    return 'dotnet' as const
  }

  getDefaultFilename(): string {
    return '*.csproj'
  }

  async isApplicable(cwd: string): Promise<boolean> {
    try {
      const files = await readdir(cwd)
      return files.some(file => file.endsWith('.csproj') || file.endsWith('.fsproj') || file.endsWith('.vbproj'))
    } catch {
      return false
    }
  }

  async extract(options?: Pick<MetadataOptions, 'projectFile' | 'removeScope'>): Promise<ProjectMetadata> {
    try {
      let projectFile = options?.projectFile

      if (!projectFile) {
        // Find the first .csproj/.fsproj/.vbproj file
        const files = await readdir(this.cwd)
        const projectFiles = files.filter(file =>
          file.endsWith('.csproj') || file.endsWith('.fsproj') || file.endsWith('.vbproj')
        )
        if (projectFiles.length === 0) {
          return this.createFallbackMetadata()
        }
        projectFile = projectFiles[0]
      }

      const content = await this.readProjectFile(projectFile)

      // Parse .csproj/.fsproj/.vbproj files
      const assemblyNameMatch = content.match(/<AssemblyName>(.*?)<\/AssemblyName>/)
      const packageIdMatch = content.match(/<PackageId>(.*?)<\/PackageId>/)
      const versionMatch = content.match(/<Version>(.*?)<\/Version>/) ||
                          content.match(/<AssemblyVersion>(.*?)<\/AssemblyVersion>/)
      const descriptionMatch = content.match(/<Description>(.*?)<\/Description>/)

      // Use PackageId, then AssemblyName, then filename without extension
      const baseName = packageIdMatch?.[1] ||
                      assemblyNameMatch?.[1] ||
                      projectFile?.replace(/\.(cs|fs|vb)proj$/, '') ||
                      'unknown-service'

      const name = this.processName(baseName, options?.removeScope)
      const version = versionMatch?.[1] || '0.0.0'
      const description = descriptionMatch?.[1]

      return {
        name,
        version,
        description,
        projectType: this.getProjectType(),
        raw: {
          projectFile,
          content,
          assemblyName: assemblyNameMatch?.[1],
          packageId: packageIdMatch?.[1]
        }
      }
    } catch (error) {
      return this.createFallbackMetadata()
    }
  }
}