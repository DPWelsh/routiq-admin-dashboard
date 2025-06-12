/**
 * Centralized Logging Utility for Production Debugging
 * Logs appear in Vercel Console for debugging
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug'

interface LogContext {
  [key: string]: unknown
}

class Logger {
  private formatLog(level: LogLevel, message: string, context?: LogContext) {
    const timestamp = new Date().toISOString()
    const logData = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...(context && { context }),
      // Add deployment info
      deployment: {
        env: process.env.NODE_ENV,
        vercel: !!process.env.VERCEL,
        region: process.env.VERCEL_REGION || 'unknown'
      }
    }
    
    return logData
  }

  info(message: string, context?: LogContext) {
    const logData = this.formatLog('info', message, context)
    console.log('🔵 [INFO]', JSON.stringify(logData, null, 2))
  }

  warn(message: string, context?: LogContext) {
    const logData = this.formatLog('warn', message, context)
    console.warn('🟡 [WARN]', JSON.stringify(logData, null, 2))
  }

  error(message: string, error?: Error | unknown, context?: LogContext) {
    const errorContext: LogContext = context ? { ...context } : {}
    
    if (error) {
      errorContext.error = {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : 'Unknown'
      }
    }
    
    const logData = this.formatLog('error', message, errorContext)
    console.error('🔴 [ERROR]', JSON.stringify(logData, null, 2))
  }

  debug(message: string, context?: LogContext) {
    // Only log debug in development or when debug flag is set
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG_LOGS === 'true') {
      const logData = this.formatLog('debug', message, context)
      console.log('🟢 [DEBUG]', JSON.stringify(logData, null, 2))
    }
  }

  // Specific method for API request logging
  apiRequest(method: string, path: string, context?: LogContext) {
    this.info(`API ${method} ${path}`, {
      type: 'api_request',
      method,
      path,
      ...context
    })
  }

  // Specific method for API response logging
  apiResponse(method: string, path: string, status: number, duration?: number, context?: LogContext) {
    const level = status >= 400 ? 'error' : status >= 300 ? 'warn' : 'info'
    const logMethod = level === 'error' ? this.error : level === 'warn' ? this.warn : this.info
    
    logMethod.call(this, `API ${method} ${path} - ${status}`, {
      type: 'api_response',
      method,
      path,
      status,
      ...(duration && { duration_ms: duration }),
      ...context
    })
  }

  // Middleware logging
  middleware(message: string, context?: LogContext) {
    this.info(`Middleware: ${message}`, {
      type: 'middleware',
      ...context
    })
  }

  // Auth logging
  auth(message: string, context?: LogContext) {
    this.info(`Auth: ${message}`, {
      type: 'auth',
      ...context
    })
  }

  // Cliniko API logging
  cliniko(message: string, context?: LogContext) {
    this.info(`Cliniko: ${message}`, {
      type: 'cliniko',
      ...context
    })
  }
}

export const logger = new Logger()

// Helper for manual API route logging
export function logApiRequest(request: Request, routeName: string) {
  const method = request.method
  const path = new URL(request.url).pathname
  
  logger.apiRequest(method, path, {
    routeName,
    userAgent: request.headers.get('user-agent'),
    origin: request.headers.get('origin')
  })
  
  return Date.now() // Return start time for duration calculation
}

export function logApiResponse(request: Request, response: Response, startTime: number, routeName: string) {
  const method = request.method
  const path = new URL(request.url).pathname
  const duration = Date.now() - startTime
  
  logger.apiResponse(method, path, response.status, duration, {
    routeName
  })
} 