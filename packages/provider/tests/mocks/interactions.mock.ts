import type { ClientInteraction, HTTPRequest, HTTPResponse, VerificationTask } from '@entente/types'

export const mockHTTPRequest: HTTPRequest = {
  method: 'GET',
  path: '/api/orders/123',
  headers: {
    Accept: 'application/json',
    Authorization: 'Bearer token123',
  },
  query: {
    include: 'items',
  },
}

export const mockHTTPRequestPost: HTTPRequest = {
  method: 'POST',
  path: '/api/orders',
  headers: {
    'Content-Type': 'application/json',
    Authorization: 'Bearer token456',
  },
  body: {
    customerId: 'customer-456',
    items: [{ productId: 'prod-789', quantity: 2 }],
  },
}

export const mockHTTPResponse: HTTPResponse = {
  status: 200,
  headers: {
    'Content-Type': 'application/json',
  },
  body: {
    id: 'order-123',
    customerId: 'customer-456',
    status: 'pending',
    items: [
      {
        productId: 'prod-789',
        quantity: 2,
        price: 29.99,
      },
    ],
    total: 59.98,
  },
}

export const mockHTTPResponseCreated: HTTPResponse = {
  status: 201,
  headers: {
    'Content-Type': 'application/json',
  },
  body: {
    id: 'order-456',
    customerId: 'customer-456',
    status: 'pending',
    items: [
      {
        productId: 'prod-789',
        quantity: 2,
        price: 29.99,
      },
    ],
    total: 59.98,
  },
}

export const mockHTTPResponseError: HTTPResponse = {
  status: 404,
  headers: {
    'Content-Type': 'application/json',
  },
  body: {
    error: 'Order not found',
    code: 'ORDER_NOT_FOUND',
  },
}

export const mockClientInteraction: ClientInteraction = {
  id: 'interaction-123',
  consumer: 'checkout-service',
  consumerVersion: '2.1.0',
  operation: 'getOrder',
  request: mockHTTPRequest,
  response: mockHTTPResponse,
  metadata: {
    timestamp: '2024-01-15T10:30:00Z',
    environment: 'test',
  },
}

export const mockClientInteractionPost: ClientInteraction = {
  id: 'interaction-456',
  consumer: 'checkout-service',
  consumerVersion: '2.1.0',
  operation: 'createOrder',
  request: mockHTTPRequestPost,
  response: mockHTTPResponseCreated,
  metadata: {
    timestamp: '2024-01-15T10:31:00Z',
    environment: 'test',
  },
}

export const mockVerificationTask: VerificationTask = {
  id: 'task-789',
  consumer: 'checkout-service',
  consumerVersion: '2.1.0',
  consumerGitSha: 'abc123def456',
  provider: 'order-service',
  interactions: [mockClientInteraction, mockClientInteractionPost],
  environment: 'test',
  createdAt: '2024-01-15T10:00:00Z',
}

export const mockVerificationTaskEmpty: VerificationTask = {
  id: 'task-empty',
  consumer: 'empty-service',
  consumerVersion: '1.0.0',
  consumerGitSha: 'empty123',
  provider: 'order-service',
  interactions: [],
  environment: 'test',
  createdAt: '2024-01-15T10:00:00Z',
}

export const mockVerificationTasks: VerificationTask[] = [
  mockVerificationTask,
  mockVerificationTaskEmpty,
]
