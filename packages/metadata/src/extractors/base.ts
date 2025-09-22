import { readFile, access } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { MetadataExtractor, MetadataOptions, ProjectMetadata, ProjectType } from '../types.js'
import { removeScopeFromName } from '../utils/scope.js'

export abstract class BaseExtractor implements MetadataExtractor {
  constructor(protected cwd: string = process.cwd()) {}

  async isApplicable(cwd: string): Promise<boolean> {
    try {
      const filePath = resolve(cwd, this.getDefaultFilename())
      await access(filePath)
      return true
    } catch {
      return false
    }
  }

  abstract extract(options?: Pick<MetadataOptions, 'projectFile' | 'removeScope'>): Promise<ProjectMetadata>
  abstract getProjectType(): ProjectType
  abstract getDefaultFilename(): string

  protected async readProjectFile(filePath?: string): Promise<string> {
    const resolvedPath = filePath
      ? resolve(this.cwd, filePath)
      : resolve(this.cwd, this.getDefaultFilename())

    return readFile(resolvedPath, 'utf-8')
  }

  protected processName(name: string, removeScope = false): string {
    return removeScope ? removeScopeFromName(name) : name
  }

  protected createFallbackMetadata(): ProjectMetadata {
    return {
      name: 'unknown-service',
      version: '0.0.0',
      projectType: this.getProjectType(),
      raw: {}
    }
  }
}