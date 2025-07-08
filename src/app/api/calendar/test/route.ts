import { NextResponse } from 'next/server';
import { testCalendarSources } from '@/lib/calendar-service';

export async function GET() {
  try {
    const results = await testCalendarSources();
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results
    });
  } catch (error) {
    console.error('Error testing calendar sources:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
