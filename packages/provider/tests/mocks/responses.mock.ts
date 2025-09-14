import type { HTTPResponse } from '@entente/types'

export const mockSuccessResponse: HTTPResponse = {
  status: 200,
  headers: {
    'Content-Type': 'application/json',
  },
  body: {
    id: 'test-id-123',
    name: 'Test Resource',
    status: 'active',
    metadata: {
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T10:00:00Z',
    },
  },
}

export const mockCreatedResponse: HTTPResponse = {
  status: 201,
  headers: {
    'Content-Type': 'application/json',
  },
  body: {
    id: 'new-resource-456',
    name: 'New Resource',
    status: 'created',
  },
}

export const mockNotFoundResponse: HTTPResponse = {
  status: 404,
  headers: {
    'Content-Type': 'application/json',
  },
  body: {
    error: 'Resource not found',
    code: 'RESOURCE_NOT_FOUND',
  },
}

export const mockArrayResponse: HTTPResponse = {
  status: 200,
  headers: {
    'Content-Type': 'application/json',
  },
  body: [
    { id: '1', name: 'Item 1' },
    { id: '2', name: 'Item 2' },
    { id: '3', name: 'Item 3' },
  ],
}

export const mockEmptyArrayResponse: HTTPResponse = {
  status: 200,
  headers: {
    'Content-Type': 'application/json',
  },
  body: [],
}

export const mockTextResponse: HTTPResponse = {
  status: 200,
  headers: {
    'Content-Type': 'text/plain',
  },
  body: 'Hello, World!',
}

export const mockResponseWithDifferentStatus: HTTPResponse = {
  status: 500,
  headers: {
    'Content-Type': 'application/json',
  },
  body: {
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
  },
}

export const mockResponseWithMissingFields: HTTPResponse = {
  status: 200,
  headers: {
    'Content-Type': 'application/json',
  },
  body: {
    id: 'partial-resource',
  },
}

export const mockResponseWithExtraFields: HTTPResponse = {
  status: 200,
  headers: {
    'Content-Type': 'application/json',
  },
  body: {
    id: 'test-id-123',
    name: 'Test Resource',
    status: 'active',
    metadata: {
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T10:00:00Z',
    },
    extraField: 'This field was not expected',
    anotherExtra: { nested: 'data' },
  },
}
