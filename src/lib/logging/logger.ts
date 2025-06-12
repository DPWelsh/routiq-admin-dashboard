/**
 * Centralized logging utility for the Surf Rehab Dashboard
 * Provides consistent logging patterns with emoji indicators and categories
 */

export enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  DEBUG = 'DEBUG'
}

export enum LogCategory {
  AUTH = 'AUTH',
  API = 'API',
  UI = 'UI',
  DB = 'DB',
  MIDDLEWARE = 'MIDDLEWARE',
  GENERAL = 'GENERAL'
}

const levelEmojis = {
  [LogLevel.INFO]: 'ℹ️',
  [LogLevel.WARN]: '⚠️',
  [LogLevel.ERROR]: '❌',
  [LogLevel.DEBUG]: '🐛'
}

interface UserData {
  id?: string
  email?: string
  name?: string
  role?: string
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development'
  
  private log(level: LogLevel, category: LogCategory, message: string, data?: unknown) {
    if (!this.isDevelopment && level === LogLevel.DEBUG) {
      return // Skip debug logs in production
    }

    const levelEmoji = levelEmojis[level]
    const logMessage = `${levelEmoji} [${category}] ${message}`
    
    switch (level) {
      case LogLevel.ERROR:
        console.error(logMessage, data || '')
        break
      case LogLevel.WARN:
        console.warn(logMessage, data || '')
        break
      case LogLevel.DEBUG:
        console.debug(logMessage, data || '')
        break
      default:
        console.log(logMessage, data || '')
    }
  }

  // Auth specific logging
  auth = {
    loginAttempt: (email: string) => 
      this.log(LogLevel.INFO, LogCategory.AUTH, `Login attempt for: ${email}`),
    
    loginSuccess: (user: UserData) => 
      this.log(LogLevel.INFO, LogCategory.AUTH, `Login successful for: ${user.email}`, user),
    
    loginFailed: (email: string, reason: string) => 
      this.log(LogLevel.WARN, LogCategory.AUTH, `Login failed for: ${email} - ${reason}`),
    
    logout: (email: string) => 
      this.log(LogLevel.INFO, LogCategory.AUTH, `User logged out: ${email}`),
    
    sessionCreated: (session: unknown) => 
      this.log(LogLevel.INFO, LogCategory.AUTH, `Session created`, session),
    
    sessionExpired: (userId: string) => 
      this.log(LogLevel.INFO, LogCategory.AUTH, `Session expired for user: ${userId}`),
    
    unauthorized: (path: string) => 
      this.log(LogLevel.WARN, LogCategory.AUTH, `Unauthorized access attempt to: ${path}`),
  }

  // API specific logging
  api = {
    request: (method: string, path: string, params?: unknown) => 
      this.log(LogLevel.INFO, LogCategory.API, `${method} ${path}`, params),
    
    response: (method: string, path: string, status: number, data?: unknown) => 
      this.log(LogLevel.INFO, LogCategory.API, `${method} ${path} - ${status}`, data),
    
    error: (method: string, path: string, error: unknown) => 
      this.log(LogLevel.ERROR, LogCategory.API, `${method} ${path} - Error`, error),
  }

  // Database specific logging
  db = {
    query: (operation: string, table: string, params?: unknown) => 
      this.log(LogLevel.DEBUG, LogCategory.DB, `${operation} on ${table}`, params),
    
    error: (operation: string, table: string, error: unknown) => 
      this.log(LogLevel.ERROR, LogCategory.DB, `${operation} failed on ${table}`, error),
    
    connection: (status: 'connected' | 'disconnected' | 'error') => 
      this.log(LogLevel.INFO, LogCategory.DB, `Database ${status}`),
  }

  // UI specific logging
  ui = {
    componentMount: (componentName: string) => 
      this.log(LogLevel.DEBUG, LogCategory.UI, `Component mounted: ${componentName}`),
    
    componentUnmount: (componentName: string) => 
      this.log(LogLevel.DEBUG, LogCategory.UI, `Component unmounted: ${componentName}`),
    
    userAction: (action: string, details?: unknown) => 
      this.log(LogLevel.INFO, LogCategory.UI, `User action: ${action}`, details),
    
    error: (component: string, error: unknown) => 
      this.log(LogLevel.ERROR, LogCategory.UI, `UI Error in ${component}`, error),
  }

  // Middleware specific logging
  middleware = {
    routeAccess: (path: string, allowed: boolean, reason?: string) => 
      this.log(
        allowed ? LogLevel.INFO : LogLevel.WARN, 
        LogCategory.MIDDLEWARE, 
        `Route ${path} ${allowed ? 'allowed' : 'denied'}${reason ? ` - ${reason}` : ''}`
      ),
    
    authCheck: (path: string, hasToken: boolean) => 
      this.log(LogLevel.DEBUG, LogCategory.MIDDLEWARE, `Auth check for ${path}: ${hasToken ? 'has token' : 'no token'}`),
  }

  // General purpose logging
  info = (message: string, data?: unknown) => this.log(LogLevel.INFO, LogCategory.GENERAL, message, data)
  warn = (message: string, data?: unknown) => this.log(LogLevel.WARN, LogCategory.GENERAL, message, data)
  error = (message: string, data?: unknown) => this.log(LogLevel.ERROR, LogCategory.GENERAL, message, data)
  debug = (message: string, data?: unknown) => this.log(LogLevel.DEBUG, LogCategory.GENERAL, message, data)
}

export const logger = new Logger()

// Export for backward compatibility with existing console.log patterns
export const authLog = logger.auth
export const apiLog = logger.api
export const dbLog = logger.db
export const uiLog = logger.ui
export const middlewareLog = logger.middleware 