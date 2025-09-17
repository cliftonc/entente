import CodeBlock from '../CodeBlock'

function VerificationExample() {
  const installCode = `npm install @entente/provider`

  const verificationCode = `import { createProvider } from '@entente/provider'

const provider = createProvider({
  provider: 'my-service'
})

await provider.verify({
  baseUrl: 'http://localhost:3000',
  stateHandlers: {
    'getResource': async () => setupTestData(),
    'createResource': async () => clearTestData()
  }
})`

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-base-content mb-2">Add Provider Verification</h4>
        <CodeBlock code={installCode} language="bash" showLineNumbers={false} />
      </div>

      <div>
        <h4 className="text-sm font-semibold text-base-content mb-2">
          Add to your tests (
          <a
            href="https://github.com/entente-dev/entente-example-castle-service/blob/main/test/provider.test.ts"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            see example
          </a>
          )
        </h4>
        <CodeBlock code={verificationCode} language="typescript" />
      </div>
    </div>
  )
}

export default VerificationExample