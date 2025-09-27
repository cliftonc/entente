import { debugLog } from '@entente/types'

export interface ErrorContext {
  operation?: string
  service?: string
  version?: string
  mode?: 'mock' | 'interceptor'
  phase?: 'init' | 'request' | 'response' | 'cleanup'
}

export interface HandledError {
  type: 'warning' | 'error' | 'fatal'
  message: string
  originalError?: unknown
  context?: ErrorContext
  canContinue: boolean
}

export class ConsumerError extends Error {
  public readonly type: 'warning' | 'error' | 'fatal'
  public readonly context: ErrorContext
  public readonly canContinue: boolean
  public readonly originalError?: unknown

  constructor(
    type: 'warning' | 'error' | 'fatal',
    message: string,
    context: ErrorContext = {},
    originalError?: unknown
  ) {
    super(message)
    this.name = 'ConsumerError'
    this.type = type
    this.context = context
    this.canContinue = type !== 'fatal'
    this.originalError = originalError
  }
}

export const handleError = (
  error: unknown,
  context: ErrorContext = {},
  defaultMessage = 'Unknown error occurred'
): HandledError => {
  let message = defaultMessage
  let type: 'warning' | 'error' | 'fatal' = 'error'
  let canContinue = true

  // Extract meaningful information from different error types
  if (error instanceof ConsumerError) {
    return {
      type: error.type,
      message: error.message,
      originalError: error.originalError,
      context: { ...context, ...error.context },
      canContinue: error.canContinue,
    }
  }

  if (error instanceof Error) {
    message = error.message

    // Classify errors based on their nature
    if (error.name === 'AbortError' || error.message.includes('aborted')) {
      type = 'warning'
      message = 'Request was aborted'
    } else if (error.message.includes('network') || error.message.includes('fetch')) {
      type = 'error'
      message = `Network error: ${error.message}`
    } else if (error.message.includes('parse') || error.message.includes('JSON')) {
      type = 'warning'
      message = `Parsing error: ${error.message}`
    } else if (error.message.includes('unauthorized') || error.message.includes('401')) {
      type = 'fatal'
      message = 'Authentication failed - check API key'
      canContinue = false
    } else if (error.message.includes('not found') || error.message.includes('404')) {
      type = 'error'
      message = `Resource not found: ${error.message}`
    }
  } else if (typeof error === 'string') {
    message = error
  } else {
    message = `Unknown error: ${String(error)}`
  }

  return {
    type,
    message,
    originalError: error,
    context,
    canContinue,
  }
}

export const withErrorHandling = async <T>(
  operation: () => Promise<T>,
  context: ErrorContext = {},
  fallback?: () => T
): Promise<T> => {
  try {
    return await operation()
  } catch (error) {
    const handledError = handleError(error, context)

    // Log the error appropriately
    const contextStr = Object.entries(handledError.context || {})
      .filter(([_, value]) => value !== undefined)
      .map(([key, value]) => `${key}=${value}`)
      .join(' ')

    const logMessage = `[${handledError.type.toUpperCase()}] ${handledError.message}${contextStr ? ` (${contextStr})` : ''}`

    switch (handledError.type) {
      case 'warning':
        debugLog(`⚠️ ${logMessage}`)
        break
      case 'error':
        console.error(`❌ ${logMessage}`)
        break
      case 'fatal':
        console.error(`💀 ${logMessage}`)
        break
    }

    // If we have a fallback and can continue, use it
    if (handledError.canContinue && fallback) {
      debugLog(`🔄 Using fallback for: ${handledError.message}`)
      return fallback()
    }

    // Re-throw as our standardized error
    throw new ConsumerError(
      handledError.type,
      handledError.message,
      handledError.context,
      handledError.originalError
    )
  }
}

export const safeAsync = async <T>(
  operation: () => Promise<T>,
  context: ErrorContext = {},
  defaultValue?: T
): Promise<T | undefined> => {
  try {
    return await withErrorHandling(operation, context, () => defaultValue)
  } catch (error) {
    const handledError = handleError(error, context)

    if (!handledError.canContinue) {
      throw error
    }

    return defaultValue
  }
}

export const createErrorReporter = (service: string, mode: 'mock' | 'interceptor') => {
  const baseContext: ErrorContext = { service, mode }

  return {
    warning: (message: string, context: Partial<ErrorContext> = {}, originalError?: unknown) => {
      const error = new ConsumerError('warning', message, { ...baseContext, ...context }, originalError)
      debugLog(`⚠️ [${mode}][${service}] ${message}`)
      return error
    },

    error: (message: string, context: Partial<ErrorContext> = {}, originalError?: unknown) => {
      const error = new ConsumerError('error', message, { ...baseContext, ...context }, originalError)
      console.error(`❌ [${mode}][${service}] ${message}`)
      return error
    },

    fatal: (message: string, context: Partial<ErrorContext> = {}, originalError?: unknown) => {
      const error = new ConsumerError('fatal', message, { ...baseContext, ...context }, originalError)
      console.error(`💀 [${mode}][${service}] ${message}`)
      return error
    },

    handleRequest: async <T>(
      operation: () => Promise<T>,
      operationName: string,
      fallback?: () => T
    ): Promise<T> => {
      return withErrorHandling(
        operation,
        { ...baseContext, phase: 'request', operation: operationName },
        fallback
      )
    },

    handleResponse: async <T>(
      operation: () => Promise<T>,
      operationName: string,
      fallback?: () => T
    ): Promise<T> => {
      return withErrorHandling(
        operation,
        { ...baseContext, phase: 'response', operation: operationName },
        fallback
      )
    },
  }
}