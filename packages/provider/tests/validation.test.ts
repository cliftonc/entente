import { describe, it, expect } from 'vitest'
import { validateResponse, validateJsonStructure } from '../src/index.js'
import {
  mockSuccessResponse,
  mockCreatedResponse,
  mockNotFoundResponse,
  mockArrayResponse,
  mockEmptyArrayResponse,
  mockResponseWithDifferentStatus,
  mockResponseWithMissingFields,
  mockResponseWithExtraFields,
} from './mocks/responses.mock.js'

describe('validateResponse', () => {
  it('should pass validation for identical responses', () => {
    const result = validateResponse(mockSuccessResponse, mockSuccessResponse)

    expect(result.success).toBe(true)
    expect(result.error).toBeUndefined()
    expect(result.errorDetails).toBeUndefined()
  })

  it('should fail validation for different status codes', () => {
    const result = validateResponse(mockSuccessResponse, mockResponseWithDifferentStatus)

    expect(result.success).toBe(false)
    expect(result.error).toContain('Status code mismatch')
    expect(result.errorDetails?.type).toBe('status_mismatch')
    expect(result.errorDetails?.expected).toBe(200)
    expect(result.errorDetails?.actual).toBe(500)
  })

  it('should pass validation for responses with extra fields', () => {
    const result = validateResponse(mockSuccessResponse, mockResponseWithExtraFields)

    expect(result.success).toBe(true)
  })

  it('should fail validation for responses with missing required fields', () => {
    const result = validateResponse(mockSuccessResponse, mockResponseWithMissingFields)

    expect(result.success).toBe(false)
    expect(result.error).toContain('Missing required field')
    expect(result.errorDetails?.type).toBe('structure_mismatch')
  })

  it('should validate array responses correctly', () => {
    const result = validateResponse(mockArrayResponse, mockArrayResponse)

    expect(result.success).toBe(true)
  })

  it('should fail when expecting non-empty array but got empty', () => {
    const result = validateResponse(mockArrayResponse, mockEmptyArrayResponse)

    expect(result.success).toBe(false)
    expect(result.error).toContain('Expected non-empty array but got empty array')
  })

  it('should pass when both arrays are empty', () => {
    const result = validateResponse(mockEmptyArrayResponse, mockEmptyArrayResponse)

    expect(result.success).toBe(true)
  })
})

describe('validateJsonStructure', () => {
  describe('primitive types', () => {
    it('should validate matching string types', () => {
      const result = validateJsonStructure('hello', 'world')

      expect(result.success).toBe(true)
    })

    it('should validate matching number types', () => {
      const result = validateJsonStructure(42, 100)

      expect(result.success).toBe(true)
    })

    it('should validate matching boolean types', () => {
      const result = validateJsonStructure(true, false)

      expect(result.success).toBe(true)
    })

    it('should fail for mismatched primitive types', () => {
      const result = validateJsonStructure('hello', 42)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Type mismatch')
      expect(result.errorDetails?.expected).toBe('string')
      expect(result.errorDetails?.actual).toBe('number')
    })
  })

  describe('arrays', () => {
    it('should validate matching array structures', () => {
      const expected = [{ id: 1, name: 'test' }]
      const actual = [{ id: 2, name: 'different' }]

      const result = validateJsonStructure(expected, actual)

      expect(result.success).toBe(true)
    })

    it('should fail when expected is array but actual is not', () => {
      const result = validateJsonStructure(['test'], 'not-array')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Type mismatch')
    })

    it('should pass for empty expected arrays', () => {
      const result = validateJsonStructure([], [1, 2, 3])

      expect(result.success).toBe(true)
    })

    it('should fail when expected has items but actual is empty', () => {
      const result = validateJsonStructure(['item'], [])

      expect(result.success).toBe(false)
      expect(result.error).toContain('Expected non-empty array but got empty array')
    })

    it('should validate nested array structures', () => {
      const expected = [{ items: [{ id: 1 }] }]
      const actual = [{ items: [{ id: 2 }] }]

      const result = validateJsonStructure(expected, actual)

      expect(result.success).toBe(true)
    })
  })

  describe('objects', () => {
    it('should validate matching object structures', () => {
      const expected = { id: 1, name: 'test' }
      const actual = { id: 2, name: 'different' }

      const result = validateJsonStructure(expected, actual)

      expect(result.success).toBe(true)
    })

    it('should pass when actual has extra fields', () => {
      const expected = { id: 1 }
      const actual = { id: 2, name: 'extra', status: 'active' }

      const result = validateJsonStructure(expected, actual)

      expect(result.success).toBe(true)
    })

    it('should fail when actual is missing required fields', () => {
      const expected = { id: 1, name: 'test' }
      const actual = { id: 2 }

      const result = validateJsonStructure(expected, actual)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Missing required field: name')
      expect(result.errorDetails?.field).toBe('name')
    })

    it('should fail when expected is object but actual is not', () => {
      const result = validateJsonStructure({ id: 1 }, 'not-object')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Type mismatch')
    })

    it('should handle null values correctly', () => {
      const result = validateJsonStructure({ id: 1 }, null)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Expected object but got non-object')
      expect(result.errorDetails?.actual).toBe('null')
    })

    it('should validate deeply nested structures', () => {
      const expected = {
        user: {
          profile: {
            settings: {
              theme: 'dark',
            },
          },
        },
      }
      const actual = {
        user: {
          profile: {
            settings: {
              theme: 'light',
              language: 'en', // extra field
            },
          },
        },
      }

      const result = validateJsonStructure(expected, actual)

      expect(result.success).toBe(true)
    })

    it('should fail with proper field path for nested missing fields', () => {
      const expected = {
        user: {
          profile: {
            name: 'required',
          },
        },
      }
      const actual = {
        user: {
          profile: {},
        },
      }

      const result = validateJsonStructure(expected, actual)

      expect(result.success).toBe(false)
      expect(result.errorDetails?.field).toBe('user.profile.name')
    })

    it('should validate mixed nested structures with arrays', () => {
      const expected = {
        orders: [
          {
            id: 1,
            items: [
              {
                productId: 'prod-1',
                quantity: 1,
              },
            ],
          },
        ],
      }
      const actual = {
        orders: [
          {
            id: 2,
            items: [
              {
                productId: 'prod-2',
                quantity: 3,
                price: 29.99, // extra field
              },
            ],
          },
        ],
      }

      const result = validateJsonStructure(expected, actual)

      expect(result.success).toBe(true)
    })
  })

  describe('field path tracking', () => {
    it('should provide correct field path for array elements', () => {
      const expected = [{ requiredField: 'test' }]
      const actual = [{}]

      const result = validateJsonStructure(expected, actual)

      expect(result.success).toBe(false)
      expect(result.errorDetails?.field).toBe('[0].requiredField')
    })

    it('should provide correct field path for deeply nested failures', () => {
      const expected = {
        level1: {
          level2: {
            level3: {
              requiredField: 'test',
            },
          },
        },
      }
      const actual = {
        level1: {
          level2: {
            level3: {},
          },
        },
      }

      const result = validateJsonStructure(expected, actual)

      expect(result.success).toBe(false)
      expect(result.errorDetails?.field).toBe('level1.level2.level3.requiredField')
    })
  })
})