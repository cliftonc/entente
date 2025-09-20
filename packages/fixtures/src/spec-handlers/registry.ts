import type { APISpec, SpecHandler, SpecRegistry, SpecType } from '@entente/types'

// Pure function to find spec type from available handlers
export const findSpecType = (spec: any, handlers: SpecHandler[]): SpecType | null => {
  for (const handler of handlers) {
    if (handler.canHandle(spec)) {
      return handler.type
    }
  }
  return null
}

// Factory function to create a spec registry
export const createSpecRegistry = (): SpecRegistry => {
  const handlers = new Map<SpecType, SpecHandler>()

  return {
    register: (handler: SpecHandler): void => {
      if (handlers.has(handler.type)) {
        throw new Error(`Handler for ${handler.type} already registered`)
      }
      handlers.set(handler.type, handler)
    },

    getHandler: (type: SpecType): SpecHandler | null => {
      return handlers.get(type) || null
    },

    detectType: (spec: any): SpecType | null => {
      return findSpecType(spec, Array.from(handlers.values()))
    },

    getAllHandlers: (): SpecHandler[] => {
      return Array.from(handlers.values())
    },

    getSupportedTypes: (): SpecType[] => {
      return Array.from(handlers.keys())
    },

    parseSpec: (spec: any): APISpec | null => {
      const type = findSpecType(spec, Array.from(handlers.values()))
      if (!type) return null

      const handler = handlers.get(type)
      if (!handler) return null

      return handler.parseSpec(spec)
    },
  }
}

// Singleton registry instance
export const specRegistry = createSpecRegistry()
