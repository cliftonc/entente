interface GraphQLRequestBody {
  query: string
  variables?: Record<string, any>
  operationName?: string
}

export interface ParsedGraphQLBody {
  query: string
  variables: Record<string, any> | null
  operationName: string | null
}

/**
 * Normalizes GraphQL query indentation by removing excessive leading whitespace
 * @param query The GraphQL query string
 * @returns Formatted query with consistent indentation
 */
function normalizeGraphQLQuery(query: string): string {
  // Split into lines and filter out empty lines at start/end
  const lines = query.split('\n')
  const nonEmptyLines = lines.filter(line => line.trim().length > 0)

  if (nonEmptyLines.length === 0) {
    return query.trim()
  }

  // Find minimum indentation (excluding completely empty lines)
  const minIndent = Math.min(
    ...nonEmptyLines.map(line => {
      const match = line.match(/^(\s*)/)
      return match ? match[1].length : 0
    })
  )

  // Remove the common leading whitespace from all lines
  const normalizedLines = lines.map(line => {
    if (line.trim().length === 0) {
      return '' // Keep empty lines as empty
    }
    return line.slice(minIndent)
  })

  // Remove leading and trailing empty lines
  while (normalizedLines.length > 0 && normalizedLines[0].trim() === '') {
    normalizedLines.shift()
  }
  while (normalizedLines.length > 0 && normalizedLines[normalizedLines.length - 1].trim() === '') {
    normalizedLines.pop()
  }

  return normalizedLines.join('\n')
}

/**
 * Parses a GraphQL request body and extracts query, variables, and operationName
 * @param body The request body (can be string or object)
 * @returns Parsed GraphQL body with separated components
 */
export function parseGraphQLBody(body: any): ParsedGraphQLBody | null {
  try {
    let parsedBody: GraphQLRequestBody

    // Handle different body formats
    if (typeof body === 'string') {
      try {
        parsedBody = JSON.parse(body)
      } catch {
        // If it's not valid JSON, treat as raw query
        return {
          query: normalizeGraphQLQuery(body),
          variables: null,
          operationName: null
        }
      }
    } else if (typeof body === 'object' && body !== null) {
      parsedBody = body
    } else {
      return null
    }

    // Check if this looks like a GraphQL request
    if (!parsedBody.query || typeof parsedBody.query !== 'string') {
      return null
    }

    return {
      query: normalizeGraphQLQuery(parsedBody.query),
      variables: parsedBody.variables || null,
      operationName: parsedBody.operationName || null
    }
  } catch {
    return null
  }
}

/**
 * Checks if a request body contains GraphQL data
 * @param body The request body to check
 * @returns True if the body appears to be a GraphQL request
 */
export function isGraphQLBody(body: any): boolean {
  const parsed = parseGraphQLBody(body)
  return parsed !== null && parsed.query.trim().match(/^(query|mutation|subscription)/i) !== null
}