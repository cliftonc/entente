import { vi } from 'vitest'

export const createMockFs = () => {
  const mockFiles: Record<string, string> = {}

  const readFileSync = vi.fn().mockImplementation((path: string, encoding?: string) => {
    const content = mockFiles[path]
    if (content === undefined) {
      const error = new Error(`ENOENT: no such file or directory, open '${path}'`)
      ;(error as any).code = 'ENOENT'
      throw error
    }
    return content
  })

  const existsSync = vi.fn().mockImplementation((path: string) => {
    return mockFiles[path] !== undefined
  })

  const setMockFile = (path: string, content: string) => {
    mockFiles[path] = content
  }

  const removeMockFile = (path: string) => {
    delete mockFiles[path]
  }

  const clearMockFiles = () => {
    Object.keys(mockFiles).forEach(key => delete mockFiles[key])
  }

  return {
    readFileSync,
    existsSync,
    setMockFile,
    removeMockFile,
    clearMockFiles,
    mockFiles,
  }
}

export const setupFsMock = () => {
  const fsMock = createMockFs()

  vi.doMock('fs', () => fsMock)

  return fsMock
}
