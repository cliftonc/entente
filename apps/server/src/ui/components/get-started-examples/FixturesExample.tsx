import CodeBlock from '../CodeBlock'

function FixturesExample() {
  const fixturesCode = `import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@entente/consumer'
import type { LocalMockData } from '@entente/types'
import { beforeAll, afterAll, describe } from 'vitest'

describe('Consumer Tests with Fixtures', () => {
  let client, mock, apiClient

  beforeAll(async () => {
    // Load local mock data
    const mockDataPath = join(process.cwd(), 'mocks', 'my-service.json')
    const localMockData: LocalMockData = JSON.parse(readFileSync(mockDataPath, 'utf-8'))

    client = createClient({
      serviceUrl: process.env.ENTENTE_SERVICE_URL || '',
      apiKey: process.env.ENTENTE_API_KEY || '',
      consumer: 'my-consumer',
      environment: 'test', // Test context (not deployment environment)
      recordingEnabled: process.env.CI === 'true',
    })

    mock = await client.createMock('my-service', '1.0.0', {
      useFixtures: true,
      validateRequests: true,
      validateResponses: true,
      localMockData,
    })

    apiClient = new ApiClient(mock.url)
  })

  afterAll(async () => {
    if (mock) {
      await mock.close()
    }
  })
})`

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-base-content mb-2">
          Use Fixtures with Mock Server (
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
        <CodeBlock code={fixturesCode} language="typescript" />
      </div>
    </div>
  )
}

export default FixturesExample
