import ICAL from 'ical.js';
import { getCalendarSources, type CalendarSource } from './calendar-settings';

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  source: string; // Which calendar this event came from
  color: string;
}

// Cache to avoid repeated fetching
const eventCache = new Map<string, { events: CalendarEvent[]; timestamp: number }>();
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

export async function fetchCalendarEvents(
  startDate: Date,
  endDate: Date
): Promise<CalendarEvent[]> {
  const sources = getCalendarSources();
  if (sources.length === 0) {
    return [];
  }

  const allEvents: CalendarEvent[] = [];

  for (const source of sources) {
    try {
      const events = await fetchEventsFromSource(source, startDate, endDate);
      allEvents.push(...events);
    } catch (error) {
      console.error(`Failed to fetch events from ${source.name}:`, error);
      // Continue with other sources even if one fails
    }
  }

  // Filter events to only show those after 4 PM or all-day events
  const filteredEvents = allEvents.filter(event => {
    if (event.allDay) return true;
    const eventHour = event.start.getHours();
    return eventHour >= 16; // 4 PM or later
  });

  // Sort by start time
  return filteredEvents.sort((a, b) => a.start.getTime() - b.start.getTime());
}

async function fetchEventsFromSource(
  source: CalendarSource,
  startDate: Date,
  endDate: Date
): Promise<CalendarEvent[]> {
  const cacheKey = `${source.id}-${startDate.toISOString()}-${endDate.toISOString()}`;
  const cached = eventCache.get(cacheKey);
  
  // Check cache first
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`Using cached events for ${source.name}`);
    return cached.events;
  }

  console.log(`Fetching fresh events from ${source.name}`);

  try {
    // Fetch the ICS file
    const response = await fetch(source.url, {
      headers: {
        'User-Agent': 'Meal Planner Calendar Integration',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const icsData = await response.text();
    
    // Parse the ICS data
    const jcalData = ICAL.parse(icsData);
    const comp = new ICAL.Component(jcalData);
    const vevents = comp.getAllSubcomponents('vevent');

    const events: CalendarEvent[] = [];

    for (const vevent of vevents) {
      const event = new ICAL.Event(vevent);
      const startTime = event.startDate.toJSDate();
      const endTime = event.endDate.toJSDate();

      // Only include events within our date range
      if (startTime <= endDate && endTime >= startDate) {
        events.push({
          id: `${source.id}-${event.uid}`,
          title: event.summary || 'Untitled Event',
          start: startTime,
          end: endTime,
          allDay: event.startDate.isDate, // ICAL.js way to check if it's all-day
          source: source.name,
          color: source.color,
        });
      }
    }

    // Cache the results
    eventCache.set(cacheKey, {
      events,
      timestamp: Date.now(),
    });

    return events;
  } catch (error) {
    console.error(`Error fetching calendar events from ${source.name}:`, error);
    throw error;
  }
}

// Helper function to get events for a specific day
export async function getEventsForDate(date: Date): Promise<CalendarEvent[]> {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const events = await fetchCalendarEvents(startOfDay, endOfDay);
  
  // Filter to events that occur on this specific day
  return events.filter(event => {
    const eventDate = new Date(event.start);
    return eventDate.getDate() === date.getDate() &&
           eventDate.getMonth() === date.getMonth() &&
           eventDate.getFullYear() === date.getFullYear();
  });
}

// Clear cache (useful for testing or manual refresh)
export function clearEventCache(): void {
  eventCache.clear();
}
