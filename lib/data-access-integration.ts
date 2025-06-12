// Integration layer for Chatwoot data access
// This would call the Python data access methods via API endpoints

interface AgentPerformance {
  agent_name: string;
  total_messages: number;
  avg_response_time: number;
  conversations_handled: number;
  avg_message_length: number;
}

interface ConversationSummary {
  id: number;
  status: string;
  created_at: string;
  total_messages: number;
  customer_messages: number;
  agent_messages: number;
  avg_response_time_minutes: number;
  customer_name: string;
  phone_number: string;
}

export class ChatwootDataAccess {
  private baseUrl: string;

  constructor(baseUrl: string = '/api/chatwoot') {
    this.baseUrl = baseUrl;
  }

  async getAgentPerformance(): Promise<AgentPerformance[]> {
    const response = await fetch(`${this.baseUrl}/agent-performance`);
    return response.json();
  }

  async getConversationSummary(status?: string, daysBack?: number): Promise<ConversationSummary[]> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (daysBack) params.append('days_back', daysBack.toString());
    
    const response = await fetch(`${this.baseUrl}/conversations?${params}`);
    return response.json();
  }

  async getResponseTimes(agentName?: string, daysBack: number = 7) {
    const params = new URLSearchParams();
    if (agentName) params.append('agent_name', agentName);
    params.append('days_back', daysBack.toString());
    
    const response = await fetch(`${this.baseUrl}/response-times?${params}`);
    return response.json();
  }

  async getDailyMessageVolume(daysBack: number = 30) {
    const response = await fetch(`${this.baseUrl}/daily-volume?days_back=${daysBack}`);
    return response.json();
  }
} 