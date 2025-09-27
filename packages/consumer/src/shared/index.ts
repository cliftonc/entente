// Operation matching
export {
  createOperationMatchingService,
  type OperationMatchingService,
  type OperationMatchResult,
  type RequestHandleResult,
  type OperationMatchingOptions,
} from './operation-matching.js'

// Fixture collection
export {
  createFixtureCollectionService,
  type FixtureCollectionService,
  type FixtureCollectionData,
  type FixtureCollectionOptions,
} from './fixture-collection.js'

// Interaction recording
export {
  createInteractionRecordingService,
  type InteractionRecordingService,
  type InteractionData,
  type InteractionRecordingOptions,
} from './interaction-recording.js'

// Error handling
export {
  handleError,
  withErrorHandling,
  safeAsync,
  createErrorReporter,
  ConsumerError,
  type ErrorContext,
  type HandledError,
} from './error-handling.js'

// Unified test helper
export {
  createUnifiedTestHelper,
  incrementStat,
  type UnifiedTestHelper,
  type TestHelperStats,
  type TestHelperConfig,
  type TestHelperDependencies,
  type TestMode,
} from './test-helper.js'