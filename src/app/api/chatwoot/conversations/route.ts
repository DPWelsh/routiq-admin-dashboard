import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from "@clerk/nextjs/server";

export async function GET(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const daysBack = searchParams.get('days_back');

    // TODO: Interface with Python data access layer
    // For now, return mock data structure matching the Python output
    const conversationSummary = [
      {
        id: 12345,
        status: "resolved",
        created_at: "2025-06-05T10:30:00Z",
        total_messages: 14,
        customer_messages: 8,
        agent_messages: 6,
        avg_response_time_minutes: 12.5,
        customer_name: "Miguel Leitao",
        phone_number: "+34662191692"
      },
      {
        id: 12346,
        status: "open",
        created_at: "2025-06-06T15:20:00Z",
        total_messages: 7,
        customer_messages: 4,
        agent_messages: 3,
        avg_response_time_minutes: 8.2,
        customer_name: "Daniel Welsh",
        phone_number: "+61412345678"
      },
      {
        id: 12347,
        status: "pending",
        created_at: "2025-06-07T09:15:00Z",
        total_messages: 3,
        customer_messages: 2,
        agent_messages: 1,
        avg_response_time_minutes: 25.0,
        customer_name: "Alister Cran",
        phone_number: "+61487654321"
      }
    ];

    // Apply filters if provided
    let filteredData = conversationSummary;
    
    if (status) {
      filteredData = filteredData.filter(conv => conv.status === status);
    }

    if (daysBack) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - parseInt(daysBack));
      filteredData = filteredData.filter(conv => new Date(conv.created_at) >= cutoffDate);
    }

    return NextResponse.json(filteredData);
  } catch (error) {
    console.error('Error fetching conversation summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversation summary' },
      { status: 500 }
    );
  }
} 