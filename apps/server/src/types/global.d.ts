import type { GitHubHelper } from '../api/utils/github-helper'

// Global type augmentations for Hono context
declare module 'hono' {
  interface ContextVariableMap {
    github: GitHubHelper | null
  }
}