import { toZonedTime, fromZonedTime, format as formatTz } from 'date-fns-tz';

/**
 * Get the default timezone from environment variables
 */
export function getDefaultTimezone(): string {
  return process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE || 'America/Los_Angeles';
}

/**
 * Get the user's browser timezone if available, otherwise use default
 */
export function getUserTimezone(): string {
  if (typeof window !== 'undefined') {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      // Fallback to default if browser timezone detection fails
      return getDefaultTimezone();
    }
  }
  return getDefaultTimezone();
}

/**
 * Convert a date to a specific timezone
 */
export function toTimeZone(date: Date, timeZone: string): Date {
  return toZonedTime(date, timeZone);
}

/**
 * Convert a date from a specific timezone to UTC
 */
export function fromTimeZone(date: Date, timeZone: string): Date {
  return fromZonedTime(date, timeZone);
}

/**
 * Format a date in a specific timezone
 */
export function formatInTimeZone(
  date: Date, 
  timeZone: string, 
  formatString: string
): string {
  return formatTz(date, formatString, { timeZone });
}

/**
 * Check if a date is all-day by examining if it has time components
 */
export function isAllDayEvent(start: Date, end: Date): boolean {
  // Check if start time is at midnight and duration is in full days
  const startHours = start.getHours();
  const startMinutes = start.getMinutes();
  const startSeconds = start.getSeconds();
  
  // If start is at midnight and end is either at midnight or 23:59:59
  if (startHours === 0 && startMinutes === 0 && startSeconds === 0) {
    const endHours = end.getHours();
    const endMinutes = end.getMinutes();
    const endSeconds = end.getSeconds();
    
    // Either ends at midnight of next day or at 23:59:59
    return (endHours === 0 && endMinutes === 0 && endSeconds === 0) ||
           (endHours === 23 && endMinutes === 59 && endSeconds === 59);
  }
  
  return false;
}

/**
 * Get the start and end of day in a specific timezone
 */
export function getDayBoundsInTimezone(date: Date, timeZone: string): { start: Date; end: Date } {
  // Get the year, month, and day in the target timezone
  const zonedDate = toTimeZone(date, timeZone);
  const year = zonedDate.getFullYear();
  const month = zonedDate.getMonth();
  const day = zonedDate.getDate();
  
  // Create start of day (00:00:00) in the target timezone
  const startOfDayLocal = new Date(year, month, day, 0, 0, 0, 0);
  const startOfDay = fromTimeZone(startOfDayLocal, timeZone);
  
  // Create end of day (23:59:59.999) in the target timezone  
  const endOfDayLocal = new Date(year, month, day, 23, 59, 59, 999);
  const endOfDay = fromTimeZone(endOfDayLocal, timeZone);
  
  return {
    start: startOfDay,
    end: endOfDay
  };
}

/**
 * Get the minimum hour for event display (configurable via environment variable)
 */
export function getEventFilterHour(): number | null {
  const filterSetting = process.env.NEXT_PUBLIC_EVENT_FILTER_HOUR;
  if (filterSetting === 'none' || filterSetting === undefined) {
    return null; // No filtering
  }
  const hour = parseInt(filterSetting);
  return isNaN(hour) ? null : hour;
}

/**
 * Check if an event should be shown based on configurable time filtering
 */
export function shouldShowEvent(event: { start: Date; end: Date; allDay: boolean }): boolean {
  const filterHour = getEventFilterHour();
  
  // If no filtering is configured, show all events
  if (filterHour === null) {
    return true;
  }
  
  // Always show all-day events
  if (event.allDay) {
    return true;
  }
  
  // Convert to user's timezone for proper hour checking
  const userTz = getUserTimezone();
  const eventStartInUserTz = toTimeZone(event.start, userTz);
  const eventHour = eventStartInUserTz.getHours();
  
  return eventHour >= filterHour;
}
