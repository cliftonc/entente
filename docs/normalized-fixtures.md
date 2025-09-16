# Normalized Fixtures for Provider Testing

## Overview

Entente's normalized fixtures feature transforms operation-based test data into entity-based database records, enabling automatic test data setup for provider verification.

## The Problem

Traditional provider testing requires manual state handlers for each operation:

```typescript
const provider = createProvider({ /* config */ })

await provider.verify({
  stateHandlers: {
    'getUser': async () => {
      await db.insert('users', { id: '123', name: 'John' })
    },
    'getOrder': async () => {
      await db.insert('users', { id: '123', name: 'John' })
      await db.insert('orders', { id: '456', userId: '123', total: 100 })
    },
    'getUserOrders': async () => {
      await db.insert('users', { id: '123', name: 'John' })
      await db.insert('orders', { id: '456', userId: '123', total: 100 })
      await db.insert('orders', { id: '789', userId: '123', total: 200 })
    },
    // ... many more handlers
  }
})
```

This approach is:
- **Repetitive**: Same entities created across multiple handlers
- **Error-Prone**: Easy to forget dependencies or create inconsistent data
- **Maintenance Heavy**: Changes to entities require updating multiple handlers

## The Solution

Normalized fixtures automatically extract entities from all approved fixture data and set up your database once:

```typescript
const provider = createProvider({
  useNormalizedFixtures: true,
  dataSetupCallback: async (fixtures) => {
    // Entities are automatically extracted and normalized
    for (const [entityType, entities] of Object.entries(fixtures.entities)) {
      const tableName = entityType.toLowerCase() + 's'
      const records = entities.map(e => e.data)
      await db.batchInsert(tableName, records)
    }
  }
})

await provider.verify({
  // No state handlers needed - data is already set up!
})
```

## How It Works

### 1. Fixture Analysis
The system analyzes all approved fixtures for your service and extracts entities:

```
Fixture: POST /users + response {id: "123", name: "John"}
→ User entity: {id: "123", name: "John"}

Fixture: GET /orders/456 + response {id: "456", userId: "123", total: 100}
→ Order entity: {id: "456", userId: "123", total: 100}

Fixture: GET /users + response [{id: "123", name: "John"}, {id: "124", name: "Jane"}]
→ User entities: {id: "123", name: "John"}, {id: "124", name: "Jane"}
```

### 2. Entity Normalization
Duplicate entities are merged, with higher priority fixtures taking precedence:

```
Priority 1 (Consumer): User {id: "123", name: "John"}
Priority 2 (Provider):  User {id: "123", name: "John Doe", email: "john@example.com"}
→ Result: User {id: "123", name: "John Doe", email: "john@example.com"}
```

### 3. Database Setup
Your callback receives the normalized entities for insertion:

```typescript
{
  entities: {
    "User": [
      {id: "123", type: "User", data: {id: "123", name: "John Doe"}, operation: "create"},
      {id: "124", type: "User", data: {id: "124", name: "Jane"}, operation: "create"}
    ],
    "Order": [
      {id: "456", type: "Order", data: {id: "456", userId: "123", total: 100}, operation: "create"}
    ]
  },
  relationships: [
    {fromEntity: "Order", fromId: "456", toEntity: "User", toId: "123", relationship: "belongsTo"}
  ],
  metadata: {service: "order-service", version: "2.1.0", totalFixtures: 15}
}
```

## Benefits

### ✅ Automatic Setup
- No manual state handlers for basic CRUD operations
- Consistent data across all tests
- Handles entity relationships automatically

### ✅ Entity-Centric
- Maps naturally to database schemas
- Understands your domain model
- Resolves dependencies between entities

### ✅ Zero Duplication
- Same entities aren't created multiple times
- Higher priority fixtures override lower priority ones
- Clean, normalized dataset

### ✅ Backwards Compatible
- Works alongside existing state handlers
- Use normalized fixtures for basic setup
- Use state handlers for complex scenarios

## Configuration

```typescript
interface ProviderConfig {
  // Enable normalized fixtures
  useNormalizedFixtures?: boolean

  // Callback for database setup
  dataSetupCallback?: (fixtures: NormalizedFixtures) => Promise<void>
}
```

## Advanced Usage

### Custom Table Mapping
```typescript
const dataSetupCallback = async (fixtures) => {
  const tableMapping = {
    'User': 'users',
    'Order': 'sales_orders',
    'Product': 'inventory_items'
  }

  for (const [entityType, entities] of Object.entries(fixtures.entities)) {
    const tableName = tableMapping[entityType] || entityType.toLowerCase()
    await db.batchInsert(tableName, entities.map(e => e.data))
  }
}
```

### Field Transformation
```typescript
const dataSetupCallback = async (fixtures) => {
  const fieldMapping = {
    'User': { 'id': 'user_id', 'createdAt': 'created_timestamp' }
  }

  for (const [entityType, entities] of Object.entries(fixtures.entities)) {
    const fieldMap = fieldMapping[entityType] || {}
    const records = entities.map(entity => {
      const record = { ...entity.data }

      // Apply field mapping
      for (const [from, to] of Object.entries(fieldMap)) {
        if (from in record) {
          record[to] = record[from]
          delete record[from]
        }
      }

      return record
    })

    await db.batchInsert(entityType.toLowerCase() + 's', records)
  }
}
```

### Dependency Resolution
```typescript
const dataSetupCallback = async (fixtures) => {
  // Custom dependency order
  const insertOrder = ['User', 'Product', 'Order', 'OrderItem']

  await db.transaction(async () => {
    for (const entityType of insertOrder) {
      const entities = fixtures.entities[entityType] || []
      if (entities.length > 0) {
        await db.batchInsert(
          entityType.toLowerCase() + 's',
          entities.map(e => e.data)
        )
      }
    }
  })
}
```

## When to Use

### ✅ Good For
- Services with clear entity models
- CRUD-heavy APIs
- Standard REST operations
- Database-backed services

### ⚠️ Consider Traditional State Handlers For
- Complex business logic setup
- External API dependencies
- Stateful operations
- Non-standard data flows

## Implementation Notes

### Entity Type Inference
Entity types are inferred from operation names:
- `getUser` → `User`
- `createOrder` → `Order`
- `listCustomers` → `Customer`

### Operation Priority
1. **Provider fixtures** (priority 2+) - Real responses from provider verification
2. **Manual fixtures** (priority varies) - Hand-crafted test data
3. **Consumer fixtures** (priority 1) - Generated from consumer tests

### Relationship Detection
Basic relationship detection is supported:
- Foreign key fields (userId, orderId, etc.)
- Nested objects
- Array references

## Getting Started

1. **Enable the feature**:
   ```typescript
   const provider = createProvider({
     useNormalizedFixtures: true,
     dataSetupCallback: setupDatabase
   })
   ```

2. **Implement your callback**:
   ```typescript
   async function setupDatabase(fixtures) {
     await db.transaction(async () => {
       for (const [entityType, entities] of Object.entries(fixtures.entities)) {
         const records = entities.map(e => e.data)
         await db.batchInsert(entityType.toLowerCase() + 's', records)
       }
     })
   }
   ```

3. **Run verification**:
   ```typescript
   const results = await provider.verify({
     baseUrl: 'http://localhost:3000',
     environment: 'test'
   })
   ```

## Complete Example

See `/examples/normalized-fixtures-example.ts` for a complete working example with database setup, dependency resolution, and advanced configuration options.