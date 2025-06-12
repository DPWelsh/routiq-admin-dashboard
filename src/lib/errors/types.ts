/**
 * Standardized Error Types and Enums
 * 
 * Provides consistent error categorization and HTTP status codes
 * across all API routes and services.
 */

// HTTP Status Codes for consistent usage
export enum HttpStatusCode {
  // Success
  OK = 200,
  CREATED = 201,
  NO_CONTENT = 204,
  
  // Client Errors
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  METHOD_NOT_ALLOWED = 405,
  CONFLICT = 409,
  UNPROCESSABLE_ENTITY = 422,
  TOO_MANY_REQUESTS = 429,
  
  // Server Errors
  INTERNAL_SERVER_ERROR = 500,
  BAD_GATEWAY = 502,
  SERVICE_UNAVAILABLE = 503,
  GATEWAY_TIMEOUT = 504
}

// Error Categories for classification
export enum ErrorCategory {
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  DATABASE = 'DATABASE',
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE',
  RATE_LIMIT = 'RATE_LIMIT',
  INTERNAL = 'INTERNAL',
  NETWORK = 'NETWORK'
}

// Error Severity Levels
export enum ErrorSeverity {
  LOW = 'LOW',        // Expected errors, user recoverable
  MEDIUM = 'MEDIUM',  // Unexpected but handleable errors
  HIGH = 'HIGH',      // Service degradation
  CRITICAL = 'CRITICAL' // Service unavailable
}

// Standard error response interface
export interface ErrorResponse {
  success: false
  error: {
    code: string
    message: string
    category: ErrorCategory
    severity: ErrorSeverity
    timestamp: string
    requestId?: string
    details?: Record<string, unknown>
    stack?: string // Only in development
  }
}

// Success response interface for consistency
export interface SuccessResponse<T = unknown> {
  success: true
  data: T
  requestId?: string
  timestamp?: string
}

// Combined response type
export type ApiResponse<T = unknown> = SuccessResponse<T> | ErrorResponse

// Base error class for application errors
export abstract class AppError extends Error {
  abstract readonly category: ErrorCategory
  abstract readonly severity: ErrorSeverity
  abstract readonly statusCode: HttpStatusCode
  abstract readonly code: string
  
  public readonly timestamp: string
  public readonly requestId?: string
  public readonly details?: Record<string, unknown>

  constructor(
    message: string,
    details?: Record<string, unknown>,
    requestId?: string
  ) {
    super(message)
    this.name = this.constructor.name
    this.timestamp = new Date().toISOString()
    this.details = details
    this.requestId = requestId
    
    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }

  toResponse(): ErrorResponse {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        category: this.category,
        severity: this.severity,
        timestamp: this.timestamp,
        requestId: this.requestId,
        details: this.details,
        stack: process.env.NODE_ENV === 'development' ? this.stack : undefined
      }
    }
  }
}

// Specific error classes
export class ValidationError extends AppError {
  readonly category = ErrorCategory.VALIDATION
  readonly severity = ErrorSeverity.LOW
  readonly statusCode = HttpStatusCode.BAD_REQUEST
  readonly code = 'VALIDATION_ERROR'
}

export class AuthenticationError extends AppError {
  readonly category = ErrorCategory.AUTHENTICATION
  readonly severity = ErrorSeverity.MEDIUM
  readonly statusCode = HttpStatusCode.UNAUTHORIZED
  readonly code = 'AUTHENTICATION_ERROR'
}

export class AuthorizationError extends AppError {
  readonly category = ErrorCategory.AUTHORIZATION
  readonly severity = ErrorSeverity.MEDIUM
  readonly statusCode = HttpStatusCode.FORBIDDEN
  readonly code = 'AUTHORIZATION_ERROR'
}

export class NotFoundError extends AppError {
  readonly category = ErrorCategory.NOT_FOUND
  readonly severity = ErrorSeverity.LOW
  readonly statusCode = HttpStatusCode.NOT_FOUND
  readonly code = 'NOT_FOUND_ERROR'
}

export class ConflictError extends AppError {
  readonly category = ErrorCategory.CONFLICT
  readonly severity = ErrorSeverity.MEDIUM
  readonly statusCode = HttpStatusCode.CONFLICT
  readonly code = 'CONFLICT_ERROR'
}

export class DatabaseError extends AppError {
  readonly category = ErrorCategory.DATABASE
  readonly severity = ErrorSeverity.HIGH
  readonly statusCode = HttpStatusCode.INTERNAL_SERVER_ERROR
  readonly code = 'DATABASE_ERROR'
}

export class ExternalServiceError extends AppError {
  readonly category = ErrorCategory.EXTERNAL_SERVICE
  readonly severity = ErrorSeverity.MEDIUM
  readonly statusCode = HttpStatusCode.BAD_GATEWAY
  readonly code = 'EXTERNAL_SERVICE_ERROR'
}

export class RateLimitError extends AppError {
  readonly category = ErrorCategory.RATE_LIMIT
  readonly severity = ErrorSeverity.MEDIUM
  readonly statusCode = HttpStatusCode.TOO_MANY_REQUESTS
  readonly code = 'RATE_LIMIT_ERROR'
}

export class InternalError extends AppError {
  readonly category = ErrorCategory.INTERNAL
  readonly severity = ErrorSeverity.CRITICAL
  readonly statusCode = HttpStatusCode.INTERNAL_SERVER_ERROR
  readonly code = 'INTERNAL_ERROR'
}

// Error factory for creating appropriate error types
export class ErrorFactory {
  static validation(message: string, details?: Record<string, unknown>, requestId?: string): ValidationError {
    return new ValidationError(message, details, requestId)
  }

  static authentication(message: string, details?: Record<string, unknown>, requestId?: string): AuthenticationError {
    return new AuthenticationError(message, details, requestId)
  }

  static authorization(message: string, details?: Record<string, unknown>, requestId?: string): AuthorizationError {
    return new AuthorizationError(message, details, requestId)
  }

  static notFound(resource: string, identifier?: string, requestId?: string): NotFoundError {
    const message = identifier 
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`
    return new NotFoundError(message, { resource, identifier }, requestId)
  }

  static conflict(message: string, details?: Record<string, unknown>, requestId?: string): ConflictError {
    return new ConflictError(message, details, requestId)
  }

  static database(message: string, originalError?: unknown, requestId?: string): DatabaseError {
    const details = originalError instanceof Error 
      ? { originalMessage: originalError.message, originalName: originalError.name }
      : { originalError }
    return new DatabaseError(message, details, requestId)
  }

  static externalService(service: string, message: string, details?: Record<string, unknown>, requestId?: string): ExternalServiceError {
    return new ExternalServiceError(`${service}: ${message}`, { service, ...details }, requestId)
  }

  static rateLimit(message: string = 'Rate limit exceeded', retryAfter?: number, requestId?: string): RateLimitError {
    return new RateLimitError(message, { retryAfter }, requestId)
  }

  static internal(message: string = 'Internal server error', originalError?: unknown, requestId?: string): InternalError {
    const details = originalError instanceof Error 
      ? { originalMessage: originalError.message, originalName: originalError.name }
      : { originalError }
    return new InternalError(message, details, requestId)
  }

  static fromError(error: unknown, requestId?: string): AppError {
    if (error instanceof AppError) {
      return error
    }

    if (error instanceof Error) {
      // Try to map common error patterns
      if (error.message.includes('not found') || error.message.includes('NOT_FOUND')) {
        return ErrorFactory.notFound('Resource', undefined, requestId)
      }
      
      if (error.message.includes('duplicate') || error.message.includes('UNIQUE')) {
        return ErrorFactory.conflict('Resource already exists', undefined, requestId)
      }
      
      if (error.message.includes('connection') || error.message.includes('timeout')) {
        return ErrorFactory.database('Database connection failed', error, requestId)
      }
      
      // Default to internal error
      return ErrorFactory.internal('An unexpected error occurred', error, requestId)
    }

    return ErrorFactory.internal('Unknown error occurred', { error }, requestId)
  }
} 