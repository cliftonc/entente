export const mockPackageJson = {
  name: 'test-service',
  version: '2.1.0',
  description: 'A test service for mocking',
  main: 'index.js',
}

export const mockPackageJsonMinimal = {
  name: 'minimal-service',
  version: '1.0.0',
}

export const mockPackageJsonWithoutName = {
  version: '1.5.2',
  description: 'Package without name',
}

export const mockPackageJsonWithoutVersion = {
  name: 'no-version-service',
  description: 'Package without version',
}

export const mockPackageJsonEmpty = {}

export const mockPackageJsonFallback = {
  name: 'unknown-service',
  version: '0.0.0',
}
