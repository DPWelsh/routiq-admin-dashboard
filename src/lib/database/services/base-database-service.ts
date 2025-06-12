import { logger } from '../../logging/logger'
import { DatabaseError, ErrorFactory } from '../../errors'

/**
 * Base Database Service
 * 
 * Provides standardized database connection and query execution
 * using the proven raw SQL pattern from active-patients service.
 * 
 * This replaces Prisma connections to avoid prepared statement conflicts.
 */

export interface DatabaseConfig {
  connectionString?: string
  ssl?: {
    rejectUnauthorized: boolean
  }
  maxConnections?: number
  connectionTimeoutMs?: number
}

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[]
  rowCount: number
  fields: Array<{ name: string; dataTypeID: number }>
}

export interface DatabaseMetrics {
  queryCount: number
  averageQueryTime: number
  connectionErrors: number
  lastError?: string
}

export abstract class BaseDatabaseService {
  protected metrics: DatabaseMetrics = {
    queryCount: 0,
    averageQueryTime: 0,
    connectionErrors: 0
  }

  private createDbClient() {
    // For ConversationService and other main app services, use the main DATABASE_URL
    // CHATWOOT_DATABASE_URL is only for Chatwoot-specific operations in ChatwootDataAccess
    const connectionString = process.env.DATABASE_URL
    
    if (!connectionString) {
      throw ErrorFactory.database('Database connection failed: DATABASE_URL environment variable is not set. This service requires the main application database.')
    }
    
    console.log('🔗 BaseDatabaseService connecting to main database:', {
      urlPrefix: connectionString.substring(0, 20) + '...',
      environment: process.env.NODE_ENV,
      service: this.constructor.name
    })
    
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Client } = require('pg')
    return new Client({
      connectionString,
      ssl: { rejectUnauthorized: false }
    })
  }

  /**
   * Execute a database query with proper error handling and logging
   */
  protected async executeQuery<T = Record<string, unknown>>(
    query: string, 
    params: unknown[] = [],
    context?: string,
    requestId?: string
  ): Promise<T[]> {
    const client = this.createDbClient()
    const startTime = Date.now()
    const queryPreview = query.length > 100 ? query.substring(0, 100) + '...' : query
    
    // Enhanced production debugging
    console.log('🔍 === BaseDatabaseService.executeQuery START ===')
    console.log('📝 Query details:', {
      context: context || 'unknown',
      queryLength: query.length,
      queryPreview,
      paramCount: params.length,
      requestId,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV
    })
    
    try {
      console.log('🔌 Connecting to database...')
      await client.connect()
      console.log('✅ Database connection established')
      
      logger.info('Executing database query', { 
        query: queryPreview,
        params: params.length > 0 ? `${params.length} params` : 'no params',
        context: context || 'unknown',
        requestId
      })
      
      console.log('⚡ Executing query...', { context, startTime })
      const result = await client.query(query, params)
      const executionTime = Date.now() - startTime
      
      // Update metrics
      this.metrics.queryCount++
      this.metrics.averageQueryTime = (
        (this.metrics.averageQueryTime * (this.metrics.queryCount - 1) + executionTime) / 
        this.metrics.queryCount
      )
      
      console.log('🎯 Query execution complete:', {
        rowCount: result.rows.length,
        executionTime: `${executionTime}ms`,
        context: context || 'unknown',
        fieldsCount: result.fields?.length || 0
      })
      
      // Log sample of results for debugging (first 2 rows, truncated)
      if (result.rows.length > 0) {
        console.log('📊 Sample results (first 2 rows):', 
          result.rows.slice(0, 2).map((row: Record<string, unknown>) => {
            const sample: Record<string, unknown> = {}
            Object.keys(row).slice(0, 5).forEach(key => {
              const value = row[key]
              sample[key] = typeof value === 'string' && value.length > 50 
                ? value.substring(0, 50) + '...' 
                : value
            })
            return sample
          })
        )
      }
      
      logger.info('Query executed successfully', { 
        rowCount: result.rows.length,
        executionTime: `${executionTime}ms`,
        context: context || 'unknown',
        requestId
      })
      
      console.log('✅ === BaseDatabaseService.executeQuery SUCCESS ===')
      return result.rows
      
    } catch (error) {
      const executionTime = Date.now() - startTime
      this.metrics.connectionErrors++
      this.metrics.lastError = error instanceof Error ? error.message : 'Unknown error'
      
      console.error('💥 === BaseDatabaseService.executeQuery ERROR ===')
      console.error('❌ Query failed after:', executionTime, 'ms')
      console.error('🔍 Error context:', {
        context: context || 'unknown',
        queryPreview,
        paramCount: params.length,
        requestId,
        environment: process.env.NODE_ENV
      })
      console.error('📝 Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: this.metrics.lastError,
        code: error && typeof error === 'object' && 'code' in error ? error.code : undefined,
        stack: error instanceof Error ? error.stack : undefined
      })
      
      // Check for specific error types
      if (error instanceof Error) {
        if (error.message.includes('prepared statement')) {
          console.error('🚨 PREPARED STATEMENT ERROR in BaseDatabaseService!')
          console.error('💡 This suggests multiple concurrent queries with same name')
        }
        
        if (error.message.includes('connection')) {
          console.error('🚨 DATABASE CONNECTION ERROR!')
          console.error('💡 Check DATABASE_URL and network connectivity')
        }
        
        if (error.message.includes('does not exist')) {
          console.error('�� TABLE/COLUMN NOT FOUND ERROR!')
          console.error('💡 Check database schema and migrations')
        }
      }
      
      logger.error('Database query failed', { 
        error: this.metrics.lastError,
        query: queryPreview,
        executionTime: `${executionTime}ms`,
        context: context || 'unknown',
        requestId
      })
      
      console.error('🏁 === BaseDatabaseService.executeQuery ERROR END ===')
      
      // Use the new standardized error system
      throw ErrorFactory.database(
        `Database query failed: ${this.metrics.lastError}`,
        error,
        requestId
      )
    } finally {
      try {
        console.log('🔌 Closing database connection...')
        await client.end()
        console.log('✅ Database connection closed')
      } catch (closeError) {
        console.error('⚠️ Error closing database connection:', closeError)
      }
    }
  }

  /**
   * Execute a query and return a single result
   */
  protected async executeQuerySingle<T = Record<string, unknown>>(
    query: string, 
    params: unknown[] = [],
    context?: string,
    requestId?: string
  ): Promise<T | null> {
    const results = await this.executeQuery<T>(query, params, context, requestId)
    return results.length > 0 ? results[0] : null
  }

  /**
   * Execute a query that returns a count
   */
  protected async executeQueryCount(
    query: string, 
    params: unknown[] = [],
    context?: string,
    requestId?: string
  ): Promise<number> {
    const result = await this.executeQuerySingle<{ count: string | number }>(
      query, 
      params, 
      context,
      requestId
    )
    return result ? Number(result.count) : 0
  }

  /**
   * Execute multiple queries in sequence (not a transaction)
   */
  protected async executeQueriesBatch<T = Record<string, unknown>>(
    queries: Array<{ query: string; params?: unknown[]; context?: string }>,
    stopOnError = true,
    requestId?: string
  ): Promise<T[][]> {
    const results: T[][] = []
    
    for (const { query, params = [], context } of queries) {
      try {
        const result = await this.executeQuery<T>(query, params, context, requestId)
        results.push(result)
      } catch (error) {
        if (stopOnError) {
          throw error
        }
        logger.warn('Batch query failed, continuing...', { error, context, requestId })
        results.push([])
      }
    }
    
    return results
  }

  /**
   * Get database service metrics
   */
  public getMetrics(): DatabaseMetrics {
    return { ...this.metrics }
  }

  /**
   * Reset metrics (useful for testing)
   */
  public resetMetrics(): void {
    this.metrics = {
      queryCount: 0,
      averageQueryTime: 0,
      connectionErrors: 0
    }
  }

  /**
   * Health check for the database connection
   */
  public async healthCheck(requestId?: string): Promise<{ healthy: boolean; latency?: number; error?: string }> {
    const startTime = Date.now()
    
    try {
      await this.executeQuery('SELECT 1 as health_check', [], 'health-check', requestId)
      const latency = Date.now() - startTime
      
      return { 
        healthy: true, 
        latency 
      }
    } catch (error) {
      return { 
        healthy: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

/**
 * @deprecated Use ErrorFactory.database() instead
 * Custom error class for database query failures
 */
export class DatabaseQueryError extends Error {
  constructor(
    message: string,
    public query: string,
    public params: unknown[],
    public originalError: unknown
  ) {
    super(message)
    this.name = 'DatabaseQueryError'
  }
} 