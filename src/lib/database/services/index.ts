import { ConversationsService } from './conversations-service'

/**
 * Centralized Database Services
 * 
 * Provides singleton instances of database services
 * to ensure consistent connection management.
 */

// Singleton instances
let conversationsServiceInstance: ConversationsService | null = null

/**
 * Get the conversations service instance
 */
export function getConversationsService(): ConversationsService {
  if (!conversationsServiceInstance) {
    conversationsServiceInstance = new ConversationsService()
  }
  return conversationsServiceInstance
}

/**
 * Reset all service instances (useful for testing)
 */
export function resetServiceInstances(): void {
  conversationsServiceInstance = null
}

// Export service classes for direct instantiation if needed
export { ConversationsService } from './conversations-service'
export { BaseDatabaseService, DatabaseQueryError } from './base-database-service'

// Export types
export type {
  ConversationDetails,
  ConversationMessage,
  ConversationListItem,
  ConversationResponse,
  ConversationListResponse
} from './conversations-service'

export type {
  DatabaseMetrics
} from './base-database-service' 