# Timezone Handling in Calendar Integration

## Overview
The meal planner now includes proper timezone handling for ICS calendar integration. This ensures that calendar events display at the correct times regardless of server/user timezone differences.

## Features Implemented

### 1. Environment Configuration
- `TZ=America/Los_Angeles` - Server timezone
- `NEXT_PUBLIC_DEFAULT_TIMEZONE=America/Los_Angeles` - Default user timezone

### 2. Timezone Utilities (`src/lib/timezone-utils.ts`)
- **`getUserTimezone()`** - Gets user's browser timezone or fallback
- **`toTimeZone(date, timezone)`** - Convert date to specific timezone
- **`fromTimeZone(date, timezone)`** - Convert date from specific timezone to UTC
- **`formatInTimeZone(date, timezone, format)`** - Format date in specific timezone
- **`shouldShowEvent(event)`** - Configurable event filtering (can be disabled via environment variable)
- **`getDayBoundsInTimezone(date, timezone)`** - Get day start/end in timezone

### 3. Calendar Service Updates (`src/lib/calendar-service.ts`)
- Proper timezone preservation from ICS files
- Configurable event filtering (can be disabled for comprehensive calendar view)
- Improved day-boundary calculations for event queries

### 4. Frontend Display (`src/components/calendar/day-plan.tsx`)
- Event times display in user's local timezone
- Timezone indicator in calendar header

## How It Works

### Event Time Display
```typescript
// Before: Used server timezone
format(event.start, 'h:mm a')

// After: Uses user's timezone
formatInTimeZone(event.start, getUserTimezone(), 'h:mm a')
```

### Event Filtering (4 PM Rule)
```typescript
// Before: Server timezone
const eventHour = event.start.getHours();
return eventHour >= 16;

// After: User timezone
const userTz = getUserTimezone();
const eventStartInUserTz = toTimeZone(event.start, userTz);
return eventStartInUserTz.getHours() >= 16;
```

### All-Day Events
- All-day events are properly detected using ICAL.js `isDate` property
- No timezone conversion needed for all-day events (they're date-based)
- Date boundaries respect user's timezone for filtering

## Testing

To test timezone handling:

1. **Different Browser Timezones**: Change your system timezone and verify events show correct times
2. **Server vs User Timezone**: Deploy to a server in different timezone and verify times
3. **All-Day Events**: Ensure all-day events appear on correct dates
4. **4 PM Filtering**: Events after 4 PM in your timezone should be visible

## Benefits

- ✅ **Accurate Times**: Events display in user's local time
- ✅ **Proper Filtering**: "After 4 PM" rule works correctly across timezones  
- ✅ **All-Day Handling**: All-day events appear on correct dates
- ✅ **User Experience**: Clear timezone indicator in UI
- ✅ **Server Agnostic**: Works regardless of server timezone

## Dependencies Added
- `date-fns-tz` - For timezone-aware date operations

## Future Enhancements
- User-configurable timezone preferences
- Multiple timezone display
- Timezone conflict warnings
- Meeting time suggestions across timezones
