import CodeBlock from '../CodeBlock'

function ContractsExample() {
  const bashCode = `npm install @entente/consumer @entente/types`

  const testCode = `import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@entente/consumer'
import type { LocalMockData } from '@entente/types'
import { beforeAll, afterAll, describe, it, expect } from 'vitest'

describe('Consumer Contract Tests', () => {
  let client, mock, apiClient

  beforeAll(async () => {
    // Load local mock data
    const mockDataPath = join(process.cwd(), 'mocks', 'my-service.json')
    const localMockData: LocalMockData = JSON.parse(readFileSync(mockDataPath, 'utf-8'))

    client = createClient({
      apiKey: process.env.ENTENTE_API_KEY || '',
      consumer: 'my-consumer',
      environment: 'test', // Test context (not deployment environment - reference only)
      recordingEnabled: process.env.CI === 'true', // If true, upload recordings to entente
    })

    mock = await client.createMock('my-service', '1.0.0', {
      useFixtures: true, // Use fixtures already on entente.dev
      validateRequests: true,
      validateResponses: true,
      localMockData, // Use local mock data for testing
    })

    apiClient = new ApiClient(mock.url)
  })

  afterAll(async () => {
    if (mock) {
      await mock.close() // If recordingEnabled this is needed to upload
    }
  })

  // Here you can add as many tests as you like to test real application functions
  // Using the mock as you would any other mock
  it('should test API contract', async () => {
    const result = await apiClient.getData()
    expect(result).toHaveProperty('id')
  })
})`

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-base-content mb-2">
          Add Consumer & Create Mock Server
        </h4>
        <CodeBlock code={bashCode} language="bash" showLineNumbers={false} />
      </div>

      <div>
        <h4 className="text-sm font-semibold text-base-content mb-2">
          Add to your tests (
          <a
            href="https://github.com/entente-dev/entente-example-castle-client/blob/main/test/consumer.test.ts"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            see example
          </a>
          )
        </h4>
        <CodeBlock code={testCode} language="typescript" />
      </div>
    </div>
  )
}

export default ContractsExample
