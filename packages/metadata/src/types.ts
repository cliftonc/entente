export interface ProjectMetadata {
  /** Service/package name */
  name: string
  /** Version string */
  version: string
  /** Optional description */
  description?: string
  /** Detected project type */
  projectType: ProjectType
  /** Raw content of the parsed file for advanced use */
  raw: Record<string, any>
}

export type ProjectType = 'node' | 'go' | 'rust' | 'ruby' | 'python' | 'java' | 'groovy' | 'dotnet' | 'unknown'

export interface MetadataOptions {
  /** Override auto-detection with specific project file path */
  projectFile?: string
  /** Remove @org/ scope prefix from package names (default: false) */
  removeScope?: boolean
  /** Working directory to search from (default: process.cwd()) */
  cwd?: string
}

export interface MetadataExtractor {
  /** Check if this extractor can handle the current directory */
  isApplicable(cwd: string): Promise<boolean>
  /** Extract metadata from the project file */
  extract(options?: Pick<MetadataOptions, 'projectFile' | 'removeScope'>): Promise<ProjectMetadata>
  /** Get the project type this extractor handles */
  getProjectType(): ProjectType
  /** Get the default filename this extractor looks for */
  getDefaultFilename(): string
}