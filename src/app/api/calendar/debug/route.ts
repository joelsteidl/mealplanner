import { NextRequest, NextResponse } from 'next/server';
import { fetchCalendarEvents, clearEventCache } from '@/lib/calendar-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || '2025-07-08';
    const endDate = searchParams.get('endDate') || '2025-07-08';
    const clearCache = searchParams.get('clearCache') === 'true';

    console.log('Debug API called with:', { startDate, endDate, clearCache });

    if (clearCache) {
      clearEventCache();
      console.log('Cache cleared for debugging');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    console.log('DEBUG: Fetching events for July 8th specifically:', start.toISOString(), 'to', end.toISOString());

    const events = await fetchCalendarEvents(start, end);

    return NextResponse.json({
      success: true,
      dateRange: { start: start.toISOString(), end: end.toISOString() },
      eventCount: events.length,
      events: events,
      debug: true
    });
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch debug calendar events',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    console.log('Calendar refresh requested - clearing cache');
    
    // Clear the event cache
    clearEventCache();
    
    console.log('Calendar cache cleared successfully');

    return NextResponse.json({
      success: true,
      message: 'Calendar cache cleared successfully'
    });
  } catch (error) {
    console.error('Error clearing calendar cache:', error);
    return NextResponse.json(
      { 
        error: 'Failed to clear calendar cache',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
