"""
Chatwoot Data Access Layer
Easy integration for pulling conversation data from Supabase
"""

import psycopg2
import psycopg2.extras
import pandas as pd
from typing import Dict, List, Optional, Any
import json
from datetime import datetime, timedelta

class ChatwootDataAccess:
    """
    Data access layer for Chatwoot conversation database
    Provides easy methods to query and analyze conversation data
    """
    
    def __init__(self, database_url: str):
        """
        Initialize connection to Chatwoot database
        
        Args:
            database_url: PostgreSQL connection string
        """
        self.database_url = database_url
        self.connection = None
    
    def connect(self):
        """Establish database connection"""
        try:
            self.connection = psycopg2.connect(
                self.database_url,
                cursor_factory=psycopg2.extras.RealDictCursor
            )
            return True
        except Exception as e:
            print(f"Database connection failed: {e}")
            return False
    
    def disconnect(self):
        """Close database connection"""
        if self.connection:
            self.connection.close()
    
    def execute_query(self, query: str, params: tuple = None) -> List[Dict]:
        """
        Execute a SQL query and return results as list of dictionaries
        
        Args:
            query: SQL query string
            params: Query parameters
            
        Returns:
            List of dictionaries containing query results
        """
        if not self.connection:
            if not self.connect():
                return []
        
        try:
            cursor = self.connection.cursor()
            cursor.execute(query, params)
            results = cursor.fetchall()
            cursor.close()
            return [dict(row) for row in results]
        except Exception as e:
            print(f"Query execution failed: {e}")
            return []
    
    def get_dataframe(self, query: str, params: tuple = None) -> pd.DataFrame:
        """
        Execute query and return results as pandas DataFrame
        
        Args:
            query: SQL query string
            params: Query parameters
            
        Returns:
            pandas DataFrame with query results
        """
        results = self.execute_query(query, params)
        return pd.DataFrame(results)
    
    # =====================================================
    # CUSTOMER MESSAGE ANALYSIS
    # =====================================================
    
    def get_customer_messages(self, limit: int = None, days_back: int = None) -> pd.DataFrame:
        """
        Get all customer messages for sentiment analysis
        
        Args:
            limit: Maximum number of messages to return
            days_back: Only return messages from last N days
            
        Returns:
            DataFrame with customer messages and metadata
        """
        query = """
        SELECT 
            m.id,
            m.content,
            m.created_at,
            m.word_count,
            m.sentiment,
            c.name as customer_name,
            c.phone_number,
            c.cliniko_id,
            conv.status as conversation_status
        FROM chatwoot_messages m
        JOIN chatwoot_conversations conv ON m.conversation_id = conv.id
        JOIN chatwoot_contacts c ON conv.contact_id = c.id
        WHERE m.is_customer_message = true
        """
        
        params = []
        if days_back:
            query += " AND m.created_at > %s"
            params.append(datetime.now() - timedelta(days=days_back))
        
        query += " ORDER BY m.created_at DESC"
        
        if limit:
            query += " LIMIT %s"
            params.append(limit)
        
        return self.get_dataframe(query, tuple(params) if params else None)
    
    def get_customer_messages_by_contact(self, cliniko_id: str = None, phone_number: str = None) -> pd.DataFrame:
        """
        Get customer messages for a specific contact
        
        Args:
            cliniko_id: Cliniko patient ID
            phone_number: Customer phone number
            
        Returns:
            DataFrame with customer messages for the contact
        """
        query = """
        SELECT 
            m.content,
            m.created_at,
            m.word_count,
            conv.id as conversation_id,
            conv.status
        FROM chatwoot_messages m
        JOIN chatwoot_conversations conv ON m.conversation_id = conv.id
        JOIN chatwoot_contacts c ON conv.contact_id = c.id
        WHERE m.is_customer_message = true
        """
        
        params = []
        if cliniko_id:
            query += " AND c.cliniko_id = %s"
            params.append(cliniko_id)
        elif phone_number:
            query += " AND c.phone_number = %s"
            params.append(phone_number)
        else:
            raise ValueError("Must provide either cliniko_id or phone_number")
        
        query += " ORDER BY m.created_at ASC"
        
        return self.get_dataframe(query, tuple(params))
    
    # =====================================================
    # AGENT PERFORMANCE ANALYSIS
    # =====================================================
    
    def get_agent_performance(self) -> pd.DataFrame:
        """
        Get agent performance metrics
        
        Returns:
            DataFrame with agent performance data
        """
        query = """
        SELECT 
            m.sender_name as agent_name,
            COUNT(*) as total_messages,
            AVG(m.response_time_minutes) as avg_response_time,
            COUNT(DISTINCT m.conversation_id) as conversations_handled,
            AVG(m.word_count) as avg_message_length
        FROM chatwoot_messages m
        WHERE m.is_agent_message = true
        GROUP BY m.sender_name
        ORDER BY avg_response_time ASC
        """
        
        return self.get_dataframe(query)
    
    def get_response_times(self, agent_name: str = None, days_back: int = 7) -> pd.DataFrame:
        """
        Get response time data for analysis
        
        Args:
            agent_name: Specific agent name (optional)
            days_back: Number of days to look back
            
        Returns:
            DataFrame with response time data
        """
        query = """
        SELECT 
            m.sender_name as agent_name,
            m.response_time_minutes,
            m.created_at,
            conv.id as conversation_id
        FROM chatwoot_messages m
        JOIN chatwoot_conversations conv ON m.conversation_id = conv.id
        WHERE m.is_agent_message = true 
        AND m.response_time_minutes IS NOT NULL
        AND m.created_at > %s
        """
        
        params = [datetime.now() - timedelta(days=days_back)]
        
        if agent_name:
            query += " AND m.sender_name = %s"
            params.append(agent_name)
        
        query += " ORDER BY m.created_at DESC"
        
        return self.get_dataframe(query, tuple(params))
    
    # =====================================================
    # CONVERSATION ANALYSIS
    # =====================================================
    
    def get_conversation_summary(self, status: str = None, days_back: int = None) -> pd.DataFrame:
        """
        Get conversation summary with metrics
        
        Args:
            status: Filter by conversation status (open, resolved, etc.)
            days_back: Only return conversations from last N days
            
        Returns:
            DataFrame with conversation summaries
        """
        query = """
        SELECT 
            conv.id,
            conv.status,
            conv.created_at,
            conv.total_messages,
            conv.customer_messages,
            conv.agent_messages,
            conv.avg_response_time_minutes,
            c.name as customer_name,
            c.phone_number,
            c.cliniko_id,
            (SELECT m.sender_name FROM chatwoot_messages m 
             WHERE m.conversation_id = conv.id AND m.is_agent_message = true 
             LIMIT 1) as assigned_agent
        FROM chatwoot_conversations conv
        LEFT JOIN chatwoot_contacts c ON conv.contact_id = c.id
        WHERE 1=1
        """
        
        params = []
        if status:
            query += " AND conv.status = %s"
            params.append(status)
        
        if days_back:
            query += " AND conv.created_at > %s"
            params.append(datetime.now() - timedelta(days=days_back))
        
        query += " ORDER BY conv.created_at DESC"
        
        return self.get_dataframe(query, tuple(params) if params else None)
    
    def get_conversation_messages(self, conversation_id: int) -> pd.DataFrame:
        """
        Get all messages for a specific conversation
        
        Args:
            conversation_id: Conversation ID
            
        Returns:
            DataFrame with all messages in the conversation
        """
        query = """
        SELECT 
            m.id,
            m.content,
            m.message_type,
            m.sender_name,
            m.created_at,
            m.is_customer_message,
            m.is_agent_message,
            m.word_count,
            m.response_time_minutes
        FROM chatwoot_messages m
        WHERE m.conversation_id = %s
        ORDER BY m.created_at ASC
        """
        
        return self.get_dataframe(query, (conversation_id,))
    
    # =====================================================
    # CONTACT MANAGEMENT
    # =====================================================
    
    def get_contacts(self, has_cliniko_id: bool = None) -> pd.DataFrame:
        """
        Get contact information
        
        Args:
            has_cliniko_id: Filter contacts with/without Cliniko ID
            
        Returns:
            DataFrame with contact information
        """
        query = """
        SELECT 
            id,
            name,
            phone_number,
            email,
            cliniko_id,
            custom_attributes,
            created_at
        FROM chatwoot_contacts
        WHERE 1=1
        """
        
        params = []
        if has_cliniko_id is not None:
            if has_cliniko_id:
                query += " AND cliniko_id IS NOT NULL"
            else:
                query += " AND cliniko_id IS NULL"
        
        query += " ORDER BY created_at DESC"
        
        return self.get_dataframe(query, tuple(params) if params else None)
    
    def get_contact_conversation_history(self, cliniko_id: str = None, phone_number: str = None) -> pd.DataFrame:
        """
        Get conversation history for a specific contact
        
        Args:
            cliniko_id: Cliniko patient ID
            phone_number: Customer phone number
            
        Returns:
            DataFrame with conversation history
        """
        query = """
        SELECT 
            conv.id,
            conv.status,
            conv.created_at,
            conv.total_messages,
            conv.avg_response_time_minutes,
            c.name as customer_name
        FROM chatwoot_conversations conv
        JOIN chatwoot_contacts c ON conv.contact_id = c.id
        WHERE 1=1
        """
        
        params = []
        if cliniko_id:
            query += " AND c.cliniko_id = %s"
            params.append(cliniko_id)
        elif phone_number:
            query += " AND c.phone_number = %s"
            params.append(phone_number)
        else:
            raise ValueError("Must provide either cliniko_id or phone_number")
        
        query += " ORDER BY conv.created_at DESC"
        
        return self.get_dataframe(query, tuple(params))
    
    # =====================================================
    # ANALYTICS & REPORTING
    # =====================================================
    
    def get_daily_message_volume(self, days_back: int = 30) -> pd.DataFrame:
        """
        Get daily message volume statistics
        
        Args:
            days_back: Number of days to analyze
            
        Returns:
            DataFrame with daily message counts
        """
        query = """
        SELECT 
            DATE(created_at) as date,
            COUNT(*) as total_messages,
            COUNT(CASE WHEN is_customer_message THEN 1 END) as customer_messages,
            COUNT(CASE WHEN is_agent_message THEN 1 END) as agent_messages
        FROM chatwoot_messages
        WHERE created_at > %s
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        """
        
        return self.get_dataframe(query, (datetime.now() - timedelta(days=days_back),))
    
    def get_conversation_status_distribution(self) -> pd.DataFrame:
        """
        Get distribution of conversation statuses
        
        Returns:
            DataFrame with status counts
        """
        query = """
        SELECT 
            status,
            COUNT(*) as count,
            ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
        FROM chatwoot_conversations
        GROUP BY status
        ORDER BY count DESC
        """
        
        return self.get_dataframe(query)

# =====================================================
# USAGE EXAMPLE
# =====================================================

if __name__ == "__main__":
    # Example usage
    DATABASE_URL = "postgresql://postgres.ytkiskslhjfstopwfmej:AAjd!!0t2m2025@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres"
    
    # Initialize data access
    db = ChatwootDataAccess(DATABASE_URL)
    
    if db.connect():
        print("✅ Connected to database")
        
        # Get recent customer messages
        customer_msgs = db.get_customer_messages(limit=10)
        print(f"📝 Found {len(customer_msgs)} recent customer messages")
        
        # Get agent performance
        agent_perf = db.get_agent_performance()
        print(f"👥 Agent performance data for {len(agent_perf)} agents")
        
        # Get conversation summary
        conversations = db.get_conversation_summary(days_back=7)
        print(f"💬 Found {len(conversations)} conversations in last 7 days")
        
        db.disconnect()
    else:
        print("❌ Failed to connect to database") 