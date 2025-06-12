/**
 * Centralized Error Handling System
 * 
 * Exports all error types, handlers, and utilities
 * for consistent error management across the application.
 */

// Export all error types and classes
export * from './types'

// Export error handler and utilities  
export * from './handler'

// Export specific commonly used items for convenience
export {
  HttpStatusCode,
  ErrorCategory,
  ErrorSeverity,
  ErrorFactory,
  AppError
} from './types'

export {
  withErrorHandler,
  createSuccessResponse,
  createErrorResponse,
  validateRequired,
  validatePagination,
  validateMethod,
  validateContentType
} from './handler' 