import CodeBlock from './CodeBlock'
import { parseGraphQLBody, type ParsedGraphQLBody } from '../utils/graphql-parser'

interface GraphQLRequestDisplayProps {
  body: any
}

function GraphQLRequestDisplay({ body }: GraphQLRequestDisplayProps) {
  const parsed: ParsedGraphQLBody | null = parseGraphQLBody(body)

  if (!parsed) {
    return (
      <div>
        <h4 className="font-medium text-sm text-base-content/70 mb-2">Body</h4>
        <div className="bg-base-200 p-1 rounded">
          <CodeBlock
            code={
              typeof body === 'string'
                ? body
                : JSON.stringify(body, null, 2) || ''
            }
            language="json"
            showLineNumbers={false}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h4 className="font-medium text-sm text-base-content/70 mb-2">GraphQL Request</h4>

      {/* Query Panel */}
      <div>
        <h5 className="font-medium text-xs text-primary/80 mb-1">Query</h5>
        <div className="bg-base-200 p-1 rounded">
          <CodeBlock
            code={parsed.query}
            language="graphql"
            showLineNumbers={false}
          />
        </div>
      </div>

      {/* Variables Panel */}
      {parsed.variables && (
        <div>
          <h5 className="font-medium text-xs text-primary/80 mb-1">Variables</h5>
          <div className="bg-base-200 p-1 rounded">
            <CodeBlock
              code={JSON.stringify(parsed.variables, null, 2)}
              language="json"
              showLineNumbers={false}
            />
          </div>
        </div>
      )}

      {/* Operation Name Panel */}
      {parsed.operationName && (
        <div>
          <h5 className="font-medium text-xs text-primary/80 mb-1">Operation Name</h5>
          <div className="bg-base-200 p-2 rounded font-mono text-sm">
            {parsed.operationName}
          </div>
        </div>
      )}
    </div>
  )
}

export default GraphQLRequestDisplay