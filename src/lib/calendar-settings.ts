// Global calendar settings - stored in a simple JSON file for now
// In the future, this could be moved to environment variables or a database

export interface CalendarSource {
  id: string;
  name: string;
  url: string;
  color: string;
  enabled: boolean;
}

// Default calendar configuration
export const DEFAULT_CALENDAR_SOURCES: CalendarSource[] = [
  {
    id: 'joel_and_lauren',
    name: 'Joel and Lauren',
    url: 'https://calendar.google.com/calendar/ical/teo56smm1r09mvashqum8vpe80%40group.calendar.google.com/private-4219bc813d23179510fac76435432a56/basic.ics',
    color: '#4285f4',
    enabled: true
  },
  {
    id: 'church_cg',
    name: 'chruch/cg',
    url: 'https://calendar.google.com/calendar/ical/d8g96un74cc7ah2vi7u8j4h3gs%40group.calendar.google.com/private-a79eadad2603bf2d598222821c028974/basic.ics',
    color: '#ff9800',
    enabled: true
  },
  {
    id: 'joel',
    name: 'Joel',
    url: 'https://calendar.google.com/calendar/ical/joelsteidl%40gmail.com/private-9c72f7dad497e44bf794917053658903/basic.ics',
    color: '#34a853',
    enabled: true
  },
  {
    id: 'lauren',
    name: 'Lauren',
    url: 'https://calendar.google.com/calendar/ical/laurensteidl%40gmail.com/private-73431085618319af6fcd06c6df5a4c25/basic.ics',
    color: '#ea4335',
    enabled: true
  },
];

// Simple in-memory storage for now - could be replaced with file/database storage
let calendarSources: CalendarSource[] = [...DEFAULT_CALENDAR_SOURCES];

export function getCalendarSources(): CalendarSource[] {
  return calendarSources.filter(source => source.enabled);
}

export function addCalendarSource(source: Omit<CalendarSource, 'id'>): void {
  const newSource: CalendarSource = {
    ...source,
    id: `calendar-${Date.now()}`,
  };
  calendarSources.push(newSource);
}

export function removeCalendarSource(id: string): void {
  calendarSources = calendarSources.filter(source => source.id !== id);
}

export function updateCalendarSource(id: string, updates: Partial<CalendarSource>): void {
  const index = calendarSources.findIndex(source => source.id === id);
  if (index !== -1) {
    calendarSources[index] = { ...calendarSources[index], ...updates };
  }
}

export function getAllCalendarSources(): CalendarSource[] {
  return calendarSources;
}
