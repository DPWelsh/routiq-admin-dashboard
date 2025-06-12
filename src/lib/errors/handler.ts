import { NextRequest, NextResponse } from 'next/server'
import { logger } from '../logging/logger'
import { 
  AppError, 
  ErrorFactory, 
  ErrorResponse, 
  SuccessResponse, 
  HttpStatusCode,
  ErrorSeverity 
} from './types'

/**
 * Global Error Handler
 * 
 * Provides centralized error handling, request tracing,
 * and standardized response formatting for all API routes.
 */

// Request context for tracing
export interface RequestContext {
  requestId: string
  method: string
  path: string
  userAgent?: string
  ip?: string
  timestamp: string
}

// Generate unique request ID
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Extract request context
function extractRequestContext(request: NextRequest): RequestContext {
  return {
    requestId: generateRequestId(),
    method: request.method,
    path: new URL(request.url).pathname,
    userAgent: request.headers.get('user-agent') || undefined,
    ip: request.headers.get('x-forwarded-for') || 
        request.headers.get('x-real-ip') || 
        'unknown',
    timestamp: new Date().toISOString()
  }
}

// API route wrapper types for Next.js
export type ApiRouteHandler = (
  request: NextRequest,
  context: RequestContext,
  params?: Record<string, string>
) => Promise<NextResponse>

// Success response helper
export function createSuccessResponse<T>(
  data: T,
  statusCode: HttpStatusCode = HttpStatusCode.OK,
  requestId?: string
): NextResponse {
  const response: SuccessResponse<T> = {
    success: true,
    data,
    requestId,
    timestamp: new Date().toISOString()
  }

  return NextResponse.json(response, { status: statusCode })
}

// Error response helper
export function createErrorResponse(
  error: AppError,
  requestId?: string
): NextResponse {
  const errorResponse = error.toResponse()
  
  // Add request ID if not already present
  if (requestId && !errorResponse.error.requestId) {
    errorResponse.error.requestId = requestId
  }

  return NextResponse.json(errorResponse, { status: error.statusCode })
}

// Log error with appropriate level based on severity
function logError(error: AppError, context: RequestContext): void {
  const logData = {
    requestId: context.requestId,
    method: context.method,
    path: context.path,
    ip: context.ip,
    userAgent: context.userAgent,
    errorCode: error.code,
    errorCategory: error.category,
    errorSeverity: error.severity,
    errorMessage: error.message,
    errorDetails: error.details,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
  }

  switch (error.severity) {
    case ErrorSeverity.LOW:
      logger.warn('API Error (Low Severity)', logData)
      break
    case ErrorSeverity.MEDIUM:
      logger.error('API Error (Medium Severity)', logData)
      break
    case ErrorSeverity.HIGH:
    case ErrorSeverity.CRITICAL:
      logger.error('API Error (High/Critical Severity)', logData)
      // In production, you might want to send alerts for critical errors
      break
    default:
      logger.error('API Error (Unknown Severity)', logData)
  }
}

// Overloaded function for different Next.js route signatures
export function withErrorHandler(handler: ApiRouteHandler) {
  // Return function that can handle both cases
  return async function wrappedHandler(
    request: NextRequest,
    routeContext?: { params: Record<string, string> }
  ): Promise<NextResponse> {
    const context = extractRequestContext(request)
    
    // Log incoming request
    logger.info('API Request', {
      requestId: context.requestId,
      method: context.method,
      path: context.path,
      ip: context.ip,
      userAgent: context.userAgent
    })

    try {
      // Execute the actual route handler
      const response = await handler(request, context, routeContext?.params)
      
      // Log successful response
      logger.info('API Response', {
        requestId: context.requestId,
        method: context.method,
        path: context.path,
        status: response.status,
        responseTime: Date.now() - new Date(context.timestamp).getTime()
      })

      return response

    } catch (error) {
      // Convert to AppError if needed
      const appError = error instanceof AppError 
        ? error 
        : ErrorFactory.fromError(error, context.requestId)

      // Log the error
      logError(appError, context)

      // Return standardized error response
      return createErrorResponse(appError, context.requestId)
    }
  }
}

// Validation helper
export function validateRequired(
  data: Record<string, unknown>,
  requiredFields: string[],
  requestId?: string
): void {
  const missing = requiredFields.filter(field => 
    data[field] === undefined || 
    data[field] === null || 
    data[field] === ''
  )

  if (missing.length > 0) {
    throw ErrorFactory.validation(
      `Missing required fields: ${missing.join(', ')}`,
      { missingFields: missing, providedFields: Object.keys(data) },
      requestId
    )
  }
}

// Pagination helper
export function validatePagination(
  limit?: string | null,
  offset?: string | null,
  maxLimit = 100,
  requestId?: string
): { limit: number; offset: number } {
  const parsedLimit = limit ? parseInt(limit, 10) : 50
  const parsedOffset = offset ? parseInt(offset, 10) : 0

  if (isNaN(parsedLimit) || parsedLimit < 1) {
    throw ErrorFactory.validation(
      'Limit must be a positive number',
      { providedLimit: limit },
      requestId
    )
  }

  if (parsedLimit > maxLimit) {
    throw ErrorFactory.validation(
      `Limit cannot exceed ${maxLimit}`,
      { providedLimit: limit, maxLimit },
      requestId
    )
  }

  if (isNaN(parsedOffset) || parsedOffset < 0) {
    throw ErrorFactory.validation(
      'Offset must be a non-negative number',
      { providedOffset: offset },
      requestId
    )
  }

  return { limit: parsedLimit, offset: parsedOffset }
}

// Method validation helper
export function validateMethod(
  request: NextRequest,
  allowedMethods: string[],
  requestId?: string
): void {
  if (!allowedMethods.includes(request.method)) {
    throw ErrorFactory.validation(
      `Method ${request.method} not allowed. Allowed methods: ${allowedMethods.join(', ')}`,
      { method: request.method, allowedMethods },
      requestId
    )
  }
}

// Content-Type validation helper
export function validateContentType(
  request: NextRequest,
  expectedType = 'application/json',
  requestId?: string
): void {
  const contentType = request.headers.get('content-type')
  
  if (request.method !== 'GET' && (!contentType || !contentType.includes(expectedType))) {
    throw ErrorFactory.validation(
      `Invalid content-type. Expected: ${expectedType}`,
      { providedContentType: contentType, expectedContentType: expectedType },
      requestId
    )
  }
} 