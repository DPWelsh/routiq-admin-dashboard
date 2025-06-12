import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from "@clerk/nextjs/server";

export async function GET(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // TODO: Interface with Python data access layer
    // For now, return mock data structure matching the Python output
    const agentPerformance = [
      {
        agent_name: "Sarah Johnson",
        total_messages: 145,
        avg_response_time: 8.5,
        conversations_handled: 23,
        avg_message_length: 67
      },
      {
        agent_name: "Mike Chen",
        total_messages: 132,
        avg_response_time: 12.3,
        conversations_handled: 19,
        avg_message_length: 82
      },
      {
        agent_name: "Emma Wilson",
        total_messages: 98,
        avg_response_time: 6.2,
        conversations_handled: 15,
        avg_message_length: 45
      }
    ];

    return NextResponse.json(agentPerformance);
  } catch (error) {
    console.error('Error fetching agent performance:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agent performance data' },
      { status: 500 }
    );
  }
} 