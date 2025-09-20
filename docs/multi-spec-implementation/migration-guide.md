---
title: Multi-Spec Migration Guide
description: Step-by-step guide for migrating from OpenAPI-only to multi-specification support
---

# Multi-Spec Migration Guide

## Overview

This guide provides detailed instructions for migrating existing Entente installations and codebases to support the new multi-specification architecture (OpenAPI, GraphQL, AsyncAPI). The migration is designed to be backward compatible and can be performed incrementally.

## Migration Phases

### Phase 0: Pre-Migration Assessment

Before beginning the migration, assess your current installation:

**1. Inventory Current Usage**
```bash
# Check current contracts
entente contract list

# Review existing specs
find . -name "*.openapi.json" -o -name "*.openapi.yaml"

# Check active mocks
entente mock list

# Review consumer tests
grep -r "createMock\|@entente/consumer" test/
```

**2. Backup Current State**
```bash
# Export all contracts and fixtures
entente export --output ./entente-backup-$(date +%Y%m%d).json

# Backup configuration
cp entente.config.js entente.config.backup.js
```

**3. Version Compatibility Check**
```bash
# Check current version
entente --version

# Verify minimum requirements
node --version  # Should be 18+
npm --version   # Or pnpm version
```

### Phase 1: Core Infrastructure Migration

**Duration**: 1-2 days
**Risk Level**: Low (backward compatible)
**Rollback**: Easy

#### 1.1 Update Dependencies

```bash
# Update to multi-spec versions
pnpm update @entente/consumer@latest
pnpm update @entente/provider@latest
pnpm update @entente/fixtures@latest
pnpm update @entente/cli@latest
```

#### 1.2 Verify Backward Compatibility

```bash
# Run existing tests to ensure nothing broke
pnpm test

# Test existing OpenAPI mocks
entente mock create my-service 1.0.0
# Should work exactly as before
```

#### 1.3 Configuration Migration

**Old Configuration**:
```javascript
// entente.config.js (before)
module.exports = {
  serviceUrl: 'https://entente.example.com',
  apiKey: process.env.ENTENTE_API_KEY,
  contracts: './specs/*.openapi.json'
}
```

**New Configuration**:
```javascript
// entente.config.js (after)
module.exports = {
  serviceUrl: 'https://entente.example.com',
  apiKey: process.env.ENTENTE_API_KEY,
  contracts: {
    openapi: './specs/*.openapi.json',
    // Ready for future additions
    // graphql: './specs/*.graphql',
    // asyncapi: './specs/*.asyncapi.yaml'
  },
  // New optional settings
  specs: {
    autoDetection: true,  // Enable auto-detection for mixed requests
    defaultType: 'openapi'  // Fallback when detection fails
  }
}
```

#### 1.4 Test Migration Success

```bash
# Verify configuration
entente config validate

# Test spec detection
entente spec detect ./specs/my-service.openapi.json
# Should output: "openapi"

# Test mock creation still works
entente mock create my-service 1.0.0
curl http://localhost:3000/users
# Should work exactly as before
```

### Phase 2: GraphQL Integration

**Duration**: 3-5 days
**Risk Level**: Medium (new functionality)
**Rollback**: Easy (feature-flagged)

#### 2.1 Prepare GraphQL Schemas

**Convert Existing OpenAPI to GraphQL** (optional):
```bash
# Use conversion tool (if needed)
entente convert openapi-to-graphql ./specs/my-service.openapi.json > ./specs/my-service.graphql

# Or create from scratch
cat > ./specs/my-service.graphql << 'EOF'
type Query {
  users: [User!]!
  user(id: ID!): User
}

type User {
  id: ID!
  name: String!
  email: String!
}
EOF
```

#### 2.2 Update Configuration

```javascript
// entente.config.js
module.exports = {
  serviceUrl: 'https://entente.example.com',
  apiKey: process.env.ENTENTE_API_KEY,
  contracts: {
    openapi: './specs/*.openapi.json',
    graphql: './specs/*.graphql'  // Add GraphQL support
  },
  specs: {
    autoDetection: true,
    defaultType: 'openapi'
  }
}
```

#### 2.3 Upload GraphQL Schemas

```bash
# Upload new GraphQL schema
entente spec upload my-service 1.0.0 ./specs/my-service.graphql

# Verify upload
entente spec list my-service
# Should show both openapi and graphql versions
```

#### 2.4 Create Mixed Fixtures

**Convert OpenAPI Fixtures to GraphQL**:
```typescript
// Original OpenAPI fixture
const openApiFixture = {
  operation: 'getUsers',
  data: { response: [{ id: '1', name: 'John', email: 'john@example.com' }] }
}

// Equivalent GraphQL fixture
const graphqlFixture = {
  operation: 'Query.users',
  data: { response: { users: [{ id: '1', name: 'John', email: 'john@example.com' }] } }
}
```

#### 2.5 Test GraphQL Integration

```bash
# Create GraphQL mock
entente mock create my-service-gql 1.0.0 --spec-type graphql

# Test GraphQL queries
curl -X POST http://localhost:3001/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ users { id name email } }"}'

# Should return mock data
```

#### 2.6 Update Consumer Tests

**Before**:
```typescript
// Only OpenAPI tests
describe('User Service', () => {
  it('should get users', async () => {
    const mock = await createMock('user-service', '1.0.0')
    const response = await fetch(`${mock.url}/users`)
    expect(response.ok).toBe(true)
  })
})
```

**After**:
```typescript
// Both OpenAPI and GraphQL tests
describe('User Service', () => {
  it('should get users via REST', async () => {
    const mock = await createMock('user-service', '1.0.0', { specType: 'openapi' })
    const response = await fetch(`${mock.url}/users`)
    expect(response.ok).toBe(true)
  })

  it('should get users via GraphQL', async () => {
    const mock = await createMock('user-service-gql', '1.0.0', { specType: 'graphql' })
    const response = await fetch(`${mock.url}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ users { id name email } }' })
    })
    expect(response.ok).toBe(true)
  })

  it('should auto-detect GraphQL requests', async () => {
    // Test auto-detection on mixed mock
    const mock = await createMock('user-service-mixed', '1.0.0')

    // This should route to GraphQL handler
    const gqlResponse = await fetch(`${mock.url}/any-endpoint`, {
      method: 'POST',
      body: JSON.stringify({ query: '{ users { id } }' })
    })
    expect(gqlResponse.headers.get('x-spec-type')).toBe('graphql')
  })
})
```

### Phase 3: AsyncAPI Integration

**Duration**: 4-6 days
**Risk Level**: Medium (WebSocket complexity)
**Rollback**: Easy (feature-flagged)

#### 3.1 Prepare AsyncAPI Specifications

```yaml
# specs/my-service.asyncapi.yaml
asyncapi: 2.6.0
info:
  title: User Service Events
  version: 1.0.0
channels:
  user/created:
    subscribe:
      message:
        payload:
          type: object
          properties:
            userId:
              type: string
            timestamp:
              type: string
  user/updated:
    subscribe:
      message:
        payload:
          type: object
          properties:
            userId:
              type: string
            changes:
              type: object
```

#### 3.2 Update Configuration

```javascript
// entente.config.js
module.exports = {
  serviceUrl: 'https://entente.example.com',
  apiKey: process.env.ENTENTE_API_KEY,
  contracts: {
    openapi: './specs/*.openapi.json',
    graphql: './specs/*.graphql',
    asyncapi: './specs/*.asyncapi.yaml'  // Add AsyncAPI support
  },
  specs: {
    autoDetection: true,
    defaultType: 'openapi',
    asyncapi: {
      enableWebSocket: true,
      enableSSE: true
    }
  }
}
```

#### 3.3 Test WebSocket Integration

```bash
# Create AsyncAPI mock
entente mock create my-service-events 1.0.0 --spec-type asyncapi

# Test WebSocket connection (using wscat or similar)
wscat -c ws://localhost:3002/ws
# Should connect and allow message publishing
```

#### 3.4 Update Consumer Tests for Events

```typescript
// Event-driven tests
describe('User Service Events', () => {
  it('should handle user creation events', async () => {
    const mock = await createMock('user-service-events', '1.0.0', {
      specType: 'asyncapi',
      localFixtures: [{
        operation: 'user/created',
        data: { payload: { userId: '123', timestamp: '2024-01-01T00:00:00Z' } }
      }]
    })

    const ws = new WebSocket(`${mock.wsUrl}/ws`)
    await new Promise(resolve => ws.onopen = resolve)

    ws.send(JSON.stringify({ channel: 'user/created' }))

    const message = await new Promise(resolve => ws.onmessage = e => resolve(e.data))
    const data = JSON.parse(message)

    expect(data.payload.userId).toBe('123')
  })
})
```

### Phase 4: Advanced Features Migration

#### 4.1 Cross-Spec Fixture Sharing

**Enable Fixture Compatibility**:
```typescript
// Shared fixtures that work across specs
const sharedFixtures = [
  {
    operation: 'getUsers',  // OpenAPI operation
    graphqlOperation: 'Query.users',  // GraphQL equivalent
    asyncapiChannel: 'user/list',  // AsyncAPI equivalent
    data: {
      response: [{ id: '1', name: 'John', email: 'john@example.com' }]
    }
  }
]

// Use in tests
const openApiMock = await createMock('service', '1.0.0', {
  specType: 'openapi',
  localFixtures: sharedFixtures
})

const graphqlMock = await createMock('service-gql', '1.0.0', {
  specType: 'graphql',
  localFixtures: sharedFixtures
})
```

#### 4.2 Provider Verification Updates

**Multi-Spec Provider Tests**:
```typescript
// Update provider verification
const verificationResults = await provider.verify({
  baseUrl: 'http://localhost:3000',
  specs: {
    openapi: { path: '/api' },
    graphql: { path: '/graphql' },
    asyncapi: { wsUrl: 'ws://localhost:3000/ws' }
  }
})

// Results include all spec types
expect(verificationResults.openapi.success).toBe(true)
expect(verificationResults.graphql.success).toBe(true)
expect(verificationResults.asyncapi.success).toBe(true)
```

## Migration Validation

### Validation Checklist

**✅ Phase 1 Validation**:
- [ ] All existing OpenAPI tests pass
- [ ] Configuration successfully migrated
- [ ] Spec detection works for OpenAPI files
- [ ] Mock creation backward compatible
- [ ] No breaking changes to existing APIs

**✅ Phase 2 Validation**:
- [ ] GraphQL schemas upload successfully
- [ ] GraphQL mocks create and respond correctly
- [ ] Auto-detection routes GraphQL requests properly
- [ ] Mixed fixtures work across OpenAPI and GraphQL
- [ ] GraphQL playground accessible and functional

**✅ Phase 3 Validation**:
- [ ] AsyncAPI specs upload and parse correctly
- [ ] WebSocket mocks connect and handle messages
- [ ] Server-Sent Events work for applicable channels
- [ ] Event fixtures trigger correctly
- [ ] Auto-detection recognizes WebSocket upgrades

**✅ Phase 4 Validation**:
- [ ] Cross-spec fixtures work seamlessly
- [ ] Provider verification covers all spec types
- [ ] Performance meets established benchmarks
- [ ] All tests pass (unit, integration, e2e)
- [ ] Documentation is complete and accurate

### Performance Validation

```bash
# Run performance tests
pnpm test:performance

# Benchmark key operations
entente benchmark spec-detection --iterations 1000
entente benchmark mock-creation --spec-types all
entente benchmark request-handling --concurrent 100
```

Expected performance targets:
- Spec detection: < 10ms average
- Mock creation: < 2 seconds for any spec type
- Request handling: < 50ms for HTTP, < 100ms for WebSocket

## Rollback Procedures

### Emergency Rollback (Phase 1)

```bash
# Restore previous versions
pnpm install @entente/consumer@0.x.x @entente/provider@0.x.x @entente/fixtures@0.x.x

# Restore configuration
cp entente.config.backup.js entente.config.js

# Verify rollback
entente mock create test-service 1.0.0
```

### Feature Rollback (Phases 2-3)

```javascript
// Disable new features in config
module.exports = {
  serviceUrl: 'https://entente.example.com',
  apiKey: process.env.ENTENTE_API_KEY,
  contracts: './specs/*.openapi.json',  // Back to OpenAPI only
  specs: {
    autoDetection: false,  // Disable auto-detection
    enabledTypes: ['openapi']  // Restrict to OpenAPI
  }
}
```

## Troubleshooting

### Common Issues

**1. Spec Detection Failures**
```bash
# Debug detection
entente spec detect --verbose ./specs/problematic-spec.json

# Check file format
file ./specs/problematic-spec.json

# Validate spec syntax
entente spec validate ./specs/problematic-spec.json
```

**2. Auto-Detection Not Working**
```bash
# Enable debug logging
DEBUG=entente:* entente mock create test-service 1.0.0

# Check request headers
curl -v -H "Content-Type: application/json" \
  -d '{"query": "{ test }"}' \
  http://localhost:3000/test
```

**3. WebSocket Connection Issues**
```bash
# Check WebSocket server
entente mock create test-asyncapi 1.0.0 --spec-type asyncapi --debug

# Test direct connection
wscat -c ws://localhost:3002/ws -H "Origin: http://localhost"
```

**4. Fixture Compatibility Problems**
```typescript
// Debug fixture mapping
console.log(await mock.getOperationMapping())

// Check fixture format
console.log(await mock.getFixtures())
```

### Getting Help

**Documentation**: Check the comprehensive docs in `/docs/multi-spec-implementation/`

**Debug Mode**: Enable verbose logging
```bash
DEBUG=entente:* entente [command]
```

**Community Support**:
- GitHub Issues: Report bugs and get help
- Discussions: Ask questions and share experiences

**Professional Support**: Contact Entente team for enterprise migration assistance

## Post-Migration Optimization

### Performance Tuning

```javascript
// Optimize configuration for your use case
module.exports = {
  // ... existing config
  specs: {
    autoDetection: true,
    detectionCache: true,  // Cache detection results
    parsingCache: 1000,   // Cache parsed specs (MB)
    defaultType: 'openapi'  // Set based on primary usage
  },
  performance: {
    maxConcurrentMocks: 50,
    requestTimeout: 30000,
    wsHeartbeat: 30000
  }
}
```

### Monitoring Setup

```bash
# Enable metrics collection
entente config set metrics.enabled true
entente config set metrics.endpoint "https://your-metrics-service.com"

# Monitor key metrics
entente metrics view --type spec-detection
entente metrics view --type mock-performance
entente metrics view --type request-latency
```

### Best Practices

1. **Gradual Adoption**: Start with one service, expand gradually
2. **Test Coverage**: Maintain high test coverage across all spec types
3. **Fixture Management**: Use shared fixtures where possible
4. **Performance Monitoring**: Set up alerts for performance degradation
5. **Documentation**: Keep internal docs updated with new patterns

---

This migration guide ensures a smooth transition to multi-spec support while maintaining backward compatibility and providing clear rollback options for each phase.