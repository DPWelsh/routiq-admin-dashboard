import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from "@clerk/nextjs/server";

export async function GET(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const daysBack = parseInt(searchParams.get('days_back') || '30');

    // TODO: Interface with Python data access layer
    // For now, return mock data structure matching the dashboard chart format
    const dailyVolume = [
      { date: "2025-05-08", phone: 45, chat: 23, email: 12 },
      { date: "2025-05-09", phone: 52, chat: 28, email: 15 },
      { date: "2025-05-10", phone: 38, chat: 31, email: 18 },
      { date: "2025-05-11", phone: 44, chat: 25, email: 14 },
      { date: "2025-05-12", phone: 35, chat: 22, email: 16 },
      { date: "2025-05-13", phone: 28, chat: 19, email: 11 },
      { date: "2025-05-14", phone: 31, chat: 21, email: 13 },
      { date: "2025-05-15", phone: 48, chat: 29, email: 17 },
      { date: "2025-05-16", phone: 41, chat: 26, email: 15 },
      { date: "2025-05-17", phone: 39, chat: 24, email: 12 },
      { date: "2025-05-18", phone: 46, chat: 32, email: 19 },
      { date: "2025-05-19", phone: 33, chat: 27, email: 16 },
      { date: "2025-05-20", phone: 37, chat: 23, email: 14 },
      { date: "2025-05-21", phone: 42, chat: 30, email: 18 },
      { date: "2025-05-22", phone: 29, chat: 20, email: 10 },
      { date: "2025-05-23", phone: 34, chat: 25, email: 13 },
      { date: "2025-05-24", phone: 47, chat: 28, email: 16 },
      { date: "2025-05-25", phone: 40, chat: 24, email: 15 },
      { date: "2025-05-26", phone: 43, chat: 31, email: 17 },
      { date: "2025-05-27", phone: 36, chat: 22, email: 12 },
      { date: "2025-05-28", phone: 32, chat: 26, email: 14 },
      { date: "2025-05-29", phone: 45, chat: 29, email: 18 },
      { date: "2025-05-30", phone: 38, chat: 27, email: 16 },
      { date: "2025-05-31", phone: 41, chat: 25, email: 15 },
      { date: "2025-06-01", phone: 44, chat: 30, email: 17 },
      { date: "2025-06-02", phone: 39, chat: 28, email: 13 },
      { date: "2025-06-03", phone: 46, chat: 32, email: 19 },
      { date: "2025-06-04", phone: 42, chat: 24, email: 16 },
      { date: "2025-06-05", phone: 48, chat: 33, email: 20 },
      { date: "2025-06-06", phone: 37, chat: 26, email: 14 }
    ];

    // Filter to requested days back
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);
    
    const filteredData = dailyVolume.filter(item => 
      new Date(item.date) >= cutoffDate
    );

    return NextResponse.json(filteredData);
  } catch (error) {
    console.error('Error fetching daily volume:', error);
    return NextResponse.json(
      { error: 'Failed to fetch daily volume data' },
      { status: 500 }
    );
  }
} 