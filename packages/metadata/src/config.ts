import { access, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

export interface MetadataConfig {
  /** Remove @org/ scope prefix from service names */
  removeScope?: boolean
  /** Preferred project file when multiple are detected */
  preferredProjectFile?: string
  /** Service name overrides */
  serviceNameOverride?: string
  /** Additional prefixes to remove from service names */
  removePrefixes?: string[]
}

export interface ProjectConfig {
  metadata?: MetadataConfig
  [key: string]: any
}

/**
 * Load project-level configuration from .entente/ directory
 */
export async function loadProjectConfig(cwd: string = process.cwd()): Promise<ProjectConfig> {
  const configPaths = [
    resolve(cwd, '.entente', 'config.json'),
    resolve(cwd, '.entente.json')
  ]

  for (const configPath of configPaths) {
    try {
      await access(configPath)
      const content = await readFile(configPath, 'utf-8')
      return JSON.parse(content)
    } catch {
      // Continue to next path
    }
  }

  return {}
}

/**
 * Get merged metadata configuration (project config takes priority)
 */
export async function getMetadataConfig(cwd: string = process.cwd()): Promise<MetadataConfig> {
  const projectConfig = await loadProjectConfig(cwd)

  return {
    removeScope: false,
    ...projectConfig.metadata
  }
}