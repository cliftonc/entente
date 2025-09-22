import { describe, it, expect } from 'vitest'
import { getProjectMetadata, getPackageJsonMetadata, removeScopeFromName } from '../src/index.js'
import { resolve } from 'node:path'

describe('@entente/metadata', () => {
  const fixturesDir = resolve(__dirname, 'fixtures')

  describe('getPackageJsonMetadata', () => {
    it('should extract metadata from package.json', async () => {
      const metadata = await getPackageJsonMetadata({
        cwd: fixturesDir,
        projectFile: 'package.json'
      })

      expect(metadata).toEqual({
        name: '@entente/test-service',
        version: '1.2.3',
        description: 'Test service for metadata extraction',
        projectType: 'node',
        raw: expect.objectContaining({
          name: '@entente/test-service',
          version: '1.2.3',
          description: 'Test service for metadata extraction',
          type: 'module'
        })
      })
    })

    it('should remove scope when requested', async () => {
      const metadata = await getPackageJsonMetadata({
        cwd: fixturesDir,
        projectFile: 'package.json',
        removeScope: true
      })

      expect(metadata.name).toBe('test-service')
    })

    it('should fallback gracefully for missing files', async () => {
      const metadata = await getPackageJsonMetadata({
        cwd: fixturesDir,
        projectFile: 'nonexistent.json'
      })

      expect(metadata).toEqual({
        name: 'unknown-service',
        version: '0.0.0',
        projectType: 'node',
        raw: {}
      })
    })
  })

  describe('getProjectMetadata', () => {
    it('should auto-detect package.json', async () => {
      const metadata = await getProjectMetadata({
        cwd: fixturesDir
      })

      expect(metadata.name).toBe('@entente/test-service')
      expect(metadata.projectType).toBe('node')
    })
  })

  describe('removeScopeFromName', () => {
    it('should remove scope prefix', () => {
      expect(removeScopeFromName('@entente/consumer')).toBe('consumer')
      expect(removeScopeFromName('@org/my-package')).toBe('my-package')
    })

    it('should leave regular names unchanged', () => {
      expect(removeScopeFromName('regular-package')).toBe('regular-package')
      expect(removeScopeFromName('my-service')).toBe('my-service')
    })
  })
})