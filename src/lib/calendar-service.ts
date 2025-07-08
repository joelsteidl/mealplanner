import ICAL from 'ical.js';
import { getCalendarSources, type CalendarSource } from './calendar-settings';
import { 
  getUserTimezone, 
  toTimeZone, 
  shouldShowEvent,
  getDayBoundsInTimezone 
} from './timezone-utils';

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
  console.log(`Fetching events from ${sources.length} calendar sources between ${startDate.toISOString()} and ${endDate.toISOString()}`);
  
  if (sources.length === 0) {
    console.warn('No calendar sources configured');
    return [];
  }

  const allEvents: CalendarEvent[] = [];
  const sourceResults: Record<string, { success: boolean; count: number; error?: string }> = {};

  for (const source of sources) {
    try {
      console.log(`Fetching events from source: ${source.name} (${source.id})`);
      const events = await fetchEventsFromSource(source, startDate, endDate);
      allEvents.push(...events);
      sourceResults[source.name] = { success: true, count: events.length };
      console.log(`Successfully fetched ${events.length} events from ${source.name}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to fetch events from ${source.name}:`, error);
      sourceResults[source.name] = { success: false, count: 0, error: errorMessage };
      // Continue with other sources even if one fails
    }
  }

  console.log('Calendar source results:', sourceResults);
  console.log(`Total events before filtering: ${allEvents.length}`);

  // Apply configurable event filtering (can be disabled via environment variable)
  const filteredEvents = allEvents.filter(event => shouldShowEvent(event));
  console.log(`Total events after filtering: ${filteredEvents.length}`);

  // Sort by start time
  const sortedEvents = filteredEvents.sort((a, b) => a.start.getTime() - b.start.getTime());
  
  // Log event distribution by source
  const eventsBySource = sortedEvents.reduce((acc, event) => {
    acc[event.source] = (acc[event.source] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  console.log('Final events by source:', eventsBySource);

  return sortedEvents;
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
    console.log(`Using cached events for ${source.name}: ${cached.events.length} events`);
    return cached.events;
  }

  console.log(`Fetching fresh events from ${source.name} at ${source.url}`);

  try {
    // Fetch the ICS file with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(source.url, {
      headers: {
        'User-Agent': 'Meal Planner Calendar Integration',
        'Accept': 'text/calendar, text/plain, */*',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const icsData = await response.text();
    console.log(`Downloaded ICS data for ${source.name}: ${icsData.length} characters`);

    if (!icsData || icsData.length === 0) {
      throw new Error('Empty ICS data received');
    }

    // Parse the ICS data
    let jcalData;
    try {
      jcalData = ICAL.parse(icsData);
    } catch (parseError) {
      console.error(`ICAL parse error for ${source.name}:`, parseError);
      console.log(`ICS data preview for ${source.name}:`, icsData.substring(0, 500));
      throw new Error(`Failed to parse ICS data: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`);
    }

    const comp = new ICAL.Component(jcalData);
    const vevents = comp.getAllSubcomponents('vevent');
    console.log(`Found ${vevents.length} VEVENT components in ${source.name}`);

    const events: CalendarEvent[] = [];
    let eventsInRange = 0;
    let eventsOutOfRange = 0;

    for (const vevent of vevents) {
      try {
        const event = new ICAL.Event(vevent);
        
        // Check if this is a recurring event
        const isRecurring = event.isRecurring();
        
        if (isRecurring) {
          console.log(`RECURRING EVENT found in ${source.name}:`, {
            summary: event.summary,
            startDate: event.startDate.toJSDate().toISOString(),
            rrule: event.component.getFirstPropertyValue('rrule')?.toString()
          });
          
          // For recurring events, we need to expand the occurrences
          try {
            const iterator = event.iterator();
            let occurrence;
            let occurrenceCount = 0;
            const maxOccurrences = 100; // Limit to prevent infinite loops
            
            while ((occurrence = iterator.next()) && occurrenceCount < maxOccurrences) {
              const occurrenceStart = occurrence.toJSDate();
              // Calculate duration for this occurrence
              const duration = event.endDate.toJSDate().getTime() - event.startDate.toJSDate().getTime();
              const actualEnd = new Date(occurrenceStart.getTime() + duration);
              
              // Check if this occurrence falls within our date range
              const inRange = occurrenceStart <= endDate && actualEnd >= startDate;
              
              if (inRange) {
                console.log(`  -> Occurrence ${occurrenceCount + 1} IN RANGE:`, {
                  start: occurrenceStart.toISOString(),
                  end: actualEnd.toISOString()
                });
                
                events.push({
                  id: `${source.id}-${event.uid}-${occurrenceStart.getTime()}`,
                  title: event.summary || 'Untitled Event',
                  start: occurrenceStart,
                  end: actualEnd,
                  allDay: event.startDate.isDate,
                  source: source.name,
                  color: source.color,
                });
                eventsInRange++;
              } else {
                eventsOutOfRange++;
                // Stop if we're past our date range
                if (occurrenceStart > endDate) {
                  break;
                }
              }
              
              occurrenceCount++;
            }
          } catch (recurError) {
            console.warn(`Error processing recurring event in ${source.name}:`, recurError);
          }
        } else {
          // Handle non-recurring events as before
          const startTime = event.startDate.toJSDate();
          const endTime = event.endDate.toJSDate();
          const isAllDay = event.startDate.isDate;
          
          const inRange = startTime <= endDate && endTime >= startDate;
          if (inRange) {
            eventsInRange++;
            events.push({
              id: `${source.id}-${event.uid}`,
              title: event.summary || 'Untitled Event',
              start: startTime,
              end: endTime,
              allDay: isAllDay,
              source: source.name,
              color: source.color,
            });
          } else {
            eventsOutOfRange++;
          }
        }
      } catch (eventError) {
        console.warn(`Error processing individual event in ${source.name}:`, eventError);
        // Continue processing other events
      }
    }

    console.log(`${source.name}: ${eventsInRange} events in range, ${eventsOutOfRange} events out of range`);

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

// Helper function to get events for a specific day (timezone-aware)
export async function getEventsForDate(date: Date): Promise<CalendarEvent[]> {
  // Get day boundaries in user's timezone
  const userTimezone = getUserTimezone();
  const { start: startOfDay, end: endOfDay } = getDayBoundsInTimezone(date, userTimezone);

  const events = await fetchCalendarEvents(startOfDay, endOfDay);
  
  // Filter to events that occur on this specific day in user's timezone
  return events.filter(event => {
    if (event.allDay) {
      // For all-day events, check if the date falls within the event's date range
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);
      const targetDate = new Date(date);
      
      // Reset time components for date-only comparison
      eventStart.setHours(0, 0, 0, 0);
      eventEnd.setHours(23, 59, 59, 999);
      targetDate.setHours(12, 0, 0, 0); // Use noon to avoid timezone edge cases
      
      return targetDate >= eventStart && targetDate <= eventEnd;
    } else {
      // For timed events, convert to user's timezone and check the date
      const eventInUserTz = toTimeZone(event.start, userTimezone);
      const targetInUserTz = toTimeZone(date, userTimezone);
      
      return eventInUserTz.getDate() === targetInUserTz.getDate() &&
             eventInUserTz.getMonth() === targetInUserTz.getMonth() &&
             eventInUserTz.getFullYear() === targetInUserTz.getFullYear();
    }
  });
}

// Clear cache (useful for testing or manual refresh)
export function clearEventCache(): void {
  console.log('Clearing calendar event cache');
  eventCache.clear();
}

// Diagnostic function to test calendar connectivity
export async function testCalendarSources(): Promise<Record<string, { 
  success: boolean; 
  error?: string; 
  eventCount?: number;
  responseSize?: number;
}>> {
  const sources = getCalendarSources();
  const results: Record<string, { success: boolean; error?: string; eventCount?: number; responseSize?: number }> = {};

  for (const source of sources) {
    try {
      console.log(`Testing calendar source: ${source.name}`);
      
      const response = await fetch(source.url, {
        headers: {
          'User-Agent': 'Meal Planner Calendar Integration Test',
        },
      });

      if (!response.ok) {
        results[source.name] = {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`
        };
        continue;
      }

      const icsData = await response.text();
      const responseSize = icsData.length;

      // Try to parse the data
      const jcalData = ICAL.parse(icsData);
      const comp = new ICAL.Component(jcalData);
      const vevents = comp.getAllSubcomponents('vevent');

      results[source.name] = {
        success: true,
        eventCount: vevents.length,
        responseSize
      };

    } catch (error) {
      results[source.name] = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  return results;
}
