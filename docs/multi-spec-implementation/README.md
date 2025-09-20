---
title: Multi-Spec Support Implementation Guide
description: Complete implementation guide for adding GraphQL, AsyncAPI, and extensible specification support to Entente
---

# Multi-Spec Support Implementation Guide

## Overview

This guide provides detailed, step-by-step instructions for implementing multi-specification support in Entente. The goal is to extend the current OpenAPI-only system to support GraphQL, AsyncAPI, gRPC, and other API specification types while maintaining backward compatibility.

## Project Goals

1. **Extensible Architecture**: Create a modular system that can easily support new specification types
2. **Auto-Detection**: Automatically detect the specification type from HTTP requests
3. **Unified Developer Experience**: Same APIs and workflows for all specification types
4. **Backward Compatibility**: All existing OpenAPI functionality continues to work unchanged
5. **Testing Coverage**: Comprehensive tests to ensure reliability across all spec types
6. **Functional Programming**: Follow the existing codebase patterns using pure functions

## Key Design Principles

### 1. Functional Specification Type Handling
- Use pure functions instead of classes for spec handlers
- Each spec type has its own module with exported functions
- Spec handlers are composable and can be combined easily
- Registry uses a simple Map with functional operations

### 2. Auto-Detection Strategy
- **GraphQL**: Detect by request path (`/graphql`), Content-Type, or query/mutation in body
- **AsyncAPI**: Detect by WebSocket upgrade headers or SSE endpoints
- **gRPC**: Detect by Content-Type `application/grpc`
- **OpenAPI**: Default fallback for REST requests

### 3. Operation Mapping
- Each specification type maps its operations to a common format
- **OpenAPI**: `operationId` (e.g., `listCastles`)
- **GraphQL**: `Type.field` (e.g., `Query.listCastles`, `Mutation.createCastle`)
- **AsyncAPI**: `action.channel` (e.g., `publish.castle/created`)
- **gRPC**: `service.method` (e.g., `CastleService.ListCastles`)

### 4. Fixture Isolation
- Fixtures are isolated by specification type using the `specType` field
- Each spec type (openapi, graphql, asyncapi, etc.) maintains its own fixtures
- No sharing of fixtures between different specification types ensures clean separation
- Fixtures include a `specType` field that must match the handler using them

## Test Case: Castles Service

We'll use a castles service as our primary test case, implementing it in multiple specification types:

- **OpenAPI**: REST API for managing French castles (existing)
- **GraphQL**: Query/mutation API for the same operations
- **AsyncAPI**: Event-driven API for castle lifecycle events

## Implementation Phases

| Phase | Status | Focus | Deliverables |
|-------|--------|-------|--------------|
| **Phase 1** | ✅ **COMPLETE** | Core Infrastructure | Functional spec abstraction, OpenAPI refactor, DB schema |
| **Phase 2** | ✅ **COMPLETE** | GraphQL Support | GraphQL handler, auto-detection, playground |
| **Phase 3** | ✅ **COMPLETE** | AsyncAPI Support | WebSocket support, event handling, SSE endpoints |
| **Phase 4** | 🔄 **NEXT** | Testing & Polish | Integration tests, docs, migration guide |

### Current Status (as of 2024-09-19)
- **Phases 1, 2 & 3**: Successfully implemented and tested
- **All tests passing**: 72+ tests across all packages
- **AsyncAPI Features**: WebSocket mocking, event broadcasting, SSE endpoints
- **Ready for Phase 4**: Final testing, documentation, and migration guide

## Directory Structure

```
packages/
├── types/src/
│   ├── specs.ts              # New: Unified spec types
│   └── index.ts              # Updated: Export new types
├── fixtures/src/
│   ├── spec-handlers/        # New: Functional spec handlers
│   │   ├── types.ts         # Handler interfaces and types
│   │   ├── registry.ts      # Handler registry (functional)
│   │   ├── openapi.ts       # OpenAPI handler functions
│   │   ├── graphql.ts       # GraphQL handler functions
│   │   ├── asyncapi.ts      # AsyncAPI handler functions
│   │   └── index.ts         # Export all handlers
│   └── test/
│       └── specs/           # Test specification files
│           ├── castles-openapi.json
│           ├── castles.graphql
│           └── castles-asyncapi.yaml
├── consumer/src/
│   ├── mock-detector.ts     # New: Auto-detection logic
│   └── index.ts             # Updated: Multi-spec mock creation
└── provider/src/
    └── index.ts             # Updated: Multi-spec verification

apps/server/src/
├── db/schema/
│   └── specs.ts             # Updated: Add specType column
├── api/routes/
│   └── specs.ts             # Updated: Handle all spec types
└── ui/pages/
    └── GraphQLPlayground.tsx # New: GraphQL testing interface
```

## Key Files to Create/Modify

### New Files (23 total)
- Type definitions for unified spec support
- Functional spec handler implementations for each type
- Test specification files (OpenAPI, GraphQL, AsyncAPI)
- Auto-detection logic
- GraphQL playground component
- Comprehensive test suites

### Modified Files (8 total)
- Database schema updates
- API route enhancements
- Mock server updates
- Provider verification updates

## Getting Started

1. **Read Phase Documentation**: Start with [Phase 1: Core Infrastructure](./phase-1-core-infrastructure.md)
2. **Set Up Development Environment**: Ensure you have the latest dependencies
3. **Run Existing Tests**: Verify all current OpenAPI functionality works
4. **Follow Phase Order**: Complete each phase before moving to the next

## Prerequisites

### Required Knowledge
- TypeScript/JavaScript proficiency
- Understanding of OpenAPI specifications
- Basic GraphQL concepts (queries, mutations, schema)
- HTTP request/response handling
- Database schema modifications with Drizzle ORM
- Functional programming patterns

### Development Setup
```bash
# Install dependencies
pnpm install

# Run tests to verify current state
pnpm test

# Start development server
pnpm dev
```

### Testing Philosophy
- **Unit Tests**: Test each spec handler function in isolation
- **Integration Tests**: Test auto-detection and cross-spec workflows
- **E2E Tests**: Test complete user workflows with real specifications
- **Regression Tests**: Ensure existing OpenAPI functionality remains intact

## Success Criteria

### Phase 1 Success ✅ **COMPLETED**
- [x] Functional spec abstraction layer implemented and tested
- [x] OpenAPI handler refactored to use new functional architecture
- [x] Database supports multiple spec types
- [x] All existing OpenAPI tests pass

### Phase 2 Success ✅ **COMPLETED**
- [x] GraphQL requests auto-detected and routed correctly
- [x] GraphQL operations extracted and mapped to fixtures
- [x] GraphQL playground functional
- [x] Cross-spec fixture compatibility verified

### Phase 3 Success ✅ **COMPLETED**
- [x] AsyncAPI events handled via WebSocket/SSE
- [x] Event-based operations mapped correctly
- [x] Real-time testing capabilities added
- [x] WebSocket mock server with connection management
- [x] Event broadcasting to multiple clients
- [x] Auto-detection for WebSocket and SSE requests

### Phase 4 Success ⏳ **PENDING**
- [ ] 100% test coverage for multi-spec functionality
- [ ] Documentation complete and accessible
- [ ] Migration path tested with real services
- [ ] Performance benchmarks meet requirements

## Functional Programming Guidelines

### Handler Structure
```typescript
// Instead of classes, use pure functions
export const canHandleOpenAPI = (spec: any): boolean => { ... }
export const parseOpenAPISpec = (spec: any): APISpec => { ... }
export const extractOpenAPIOperations = (spec: APISpec): APIOperation[] => { ... }

// Compose handlers using higher-order functions
export const createOpenAPIHandler = (): SpecHandler => ({
  type: 'openapi',
  canHandle: canHandleOpenAPI,
  parseSpec: parseOpenAPISpec,
  extractOperations: extractOpenAPIOperations,
  // ... other functions
})
```

### Registry Pattern
```typescript
// Use Map and functional operations instead of class-based registry
export const createSpecRegistry = () => {
  const handlers = new Map<SpecType, SpecHandler>()

  return {
    register: (handler: SpecHandler) => handlers.set(handler.type, handler),
    getHandler: (type: SpecType) => handlers.get(type),
    detectType: (spec: any) => findSpecType(spec, Array.from(handlers.values())),
    // ... other operations
  }
}
```

## Risk Mitigation

### Technical Risks
1. **Breaking Changes**: Maintain strict backward compatibility through extensive testing
2. **Performance**: Benchmark spec detection and parsing to ensure no degradation
3. **Complexity**: Keep spec handlers simple and focused on single responsibility

### Process Risks
1. **Scope Creep**: Stick to defined phases and deliverables
2. **Testing Gaps**: Require tests for every new feature before review
3. **Documentation Lag**: Write documentation as you implement, not after

## Getting Help

- **Architecture Questions**: Refer to the functional handler interfaces
- **GraphQL Questions**: Check the GraphQL handler implementation examples
- **Testing Questions**: Review existing OpenAPI test patterns
- **Database Questions**: Follow Drizzle ORM patterns in existing schema files

## What's Working Now ✅

### Multi-Spec Infrastructure (Phases 1, 2 & 3 Complete)
```bash
# Spec type auto-detection
🔍 Detected spec type: openapi
🔍 Detected spec type: graphql
🔍 Detected spec type: asyncapi

# Upload any spec type
entente spec upload my-service 1.0.0 schema.graphql
entente spec upload my-service 1.0.0 openapi.json
entente spec upload my-service 1.0.0 asyncapi.yaml

# Create mocks with auto-detection
const mock = await entente.createMock('my-service', '1.0.0')
// Works for OpenAPI, GraphQL, and AsyncAPI specs automatically

# AsyncAPI WebSocket and SSE features
console.log('WebSocket URL:', mock.websocket.url)
console.log('Available channels:', mock.getChannels())
mock.sendEvent('castle/created', { eventId: 'test', castle: {...} })

# GraphQL Playground available at:
/graphql/service/{serviceId}/{version}

# AsyncAPI SSE endpoint available at:
/api/events/stream/{service}/{version}
```

### Test Coverage
- **Fixtures Package**: 72 tests (includes AsyncAPI handler tests)
- **Consumer Package**: 20+ tests (multi-spec mock creation)
- **Provider Package**: 60 tests
- **CLI Package**: 44 tests
- **Total**: 196+ tests passing ✅

### Architecture Components
- ✅ **Functional spec handlers** (`packages/fixtures/src/spec-handlers/`)
- ✅ **Unified type system** (`packages/types/src/index.ts`)
- ✅ **Database multi-spec support** (`apps/server/src/db/schema/specs.ts`)
- ✅ **Auto-detection registry** (`packages/fixtures/src/spec-handlers/registry.ts`)
- ✅ **GraphQL playground** (`apps/server/src/ui/pages/GraphQLPlayground.tsx`)
- ✅ **AsyncAPI WebSocket handler** (`packages/consumer/src/websocket-handler.ts`)
- ✅ **AsyncAPI SSE endpoints** (`apps/server/src/api/routes/events.ts`)
- ✅ **Cross-spec fixture compatibility**

---

**Next Step**: Begin [Phase 4: Testing & Documentation](./phase-4-testing-documentation.md)
**Completed**: [Phase 1: Core Infrastructure](./phase-1-core-infrastructure.md), [Phase 2: GraphQL Support](./phase-2-graphql-support.md) & [Phase 3: AsyncAPI Support](./phase-3-asyncapi-support.md)