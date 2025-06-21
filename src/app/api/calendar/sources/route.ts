import { NextRequest, NextResponse } from 'next/server';
import { 
  getAllCalendarSources, 
  addCalendarSource, 
  removeCalendarSource, 
  updateCalendarSource 
} from '@/lib/calendar-settings';

export async function GET() {
  try {
    const sources = getAllCalendarSources();
    return NextResponse.json(sources);
  } catch (error) {
    console.error('Error fetching calendar sources:', error);
    return NextResponse.json(
      { error: 'Failed to fetch calendar sources' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, url, color } = await request.json();

    if (!name || !url) {
      return NextResponse.json(
        { error: 'Name and URL are required' },
        { status: 400 }
      );
    }

    addCalendarSource({
      name,
      url,
      color: color || '#4285f4',
      enabled: true,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error adding calendar source:', error);
    return NextResponse.json(
      { error: 'Failed to add calendar source' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { id, ...updates } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Calendar ID is required' },
        { status: 400 }
      );
    }

    updateCalendarSource(id, updates);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating calendar source:', error);
    return NextResponse.json(
      { error: 'Failed to update calendar source' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Calendar ID is required' },
        { status: 400 }
      );
    }

    removeCalendarSource(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing calendar source:', error);
    return NextResponse.json(
      { error: 'Failed to remove calendar source' },
      { status: 500 }
    );
  }
}
