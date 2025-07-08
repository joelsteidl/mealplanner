"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Globe, RefreshCw, Check } from "lucide-react";
import { useToast } from "@/components/ui/toast";

interface CalendarSource {
  id: string;
  name: string;
  url: string;
  color: string;
  enabled: boolean;
}

export function CalendarSettings() {
  const { showToast } = useToast();
  const [sources, setSources] = useState<CalendarSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshComplete, setRefreshComplete] = useState(false);
  const [newSource, setNewSource] = useState({
    name: "",
    url: "",
    color: "#4285f4",
  });

  // Load calendar sources
  const loadSources = useCallback(async () => {
    try {
      const response = await fetch('/api/calendar/sources');
      if (response.ok) {
        const data = await response.json();
        setSources(data);
      }
    } catch (error) {
      console.error('Error loading calendar sources:', error);
      showToast('Failed to load calendar sources', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  const addSource = async () => {
    if (!newSource.name.trim() || !newSource.url.trim()) {
      showToast('Please enter both name and URL', 'error');
      return;
    }

    // Basic URL validation
    try {
      new URL(newSource.url);
    } catch {
      showToast('Please enter a valid URL', 'error');
      return;
    }

    setIsAdding(true);
    try {
      const response = await fetch('/api/calendar/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSource),
      });

      if (response.ok) {
        showToast('Calendar added successfully', 'success');
        setNewSource({ name: "", url: "", color: "#4285f4" });
        await loadSources();
      } else {
        throw new Error('Failed to add calendar');
      }
    } catch (error) {
      console.error('Error adding calendar:', error);
      showToast('Failed to add calendar', 'error');
    } finally {
      setIsAdding(false);
    }
  };

  const removeSource = async (id: string) => {
    try {
      const response = await fetch(`/api/calendar/sources?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        showToast('Calendar removed', 'success');
        await loadSources();
      } else {
        throw new Error('Failed to remove calendar');
      }
    } catch (error) {
      console.error('Error removing calendar:', error);
      showToast('Failed to remove calendar', 'error');
    }
  };

  // Refresh calendar data
  const refreshCalendarData = async () => {
    setIsRefreshing(true);
    setRefreshComplete(false);
    
    try {
      // Call the debug endpoint to clear cache and refresh calendar data
      const response = await fetch('/api/calendar/debug', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        showToast('Calendar data refreshed successfully', 'success');
        setRefreshComplete(true);
        
        // Reset the completion state after a delay
        setTimeout(() => {
          setRefreshComplete(false);
        }, 2000);
      } else {
        throw new Error('Failed to refresh calendar data');
      }
    } catch (error) {
      console.error('Error refreshing calendar data:', error);
      showToast('Failed to refresh calendar data', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const toggleSource = async (id: string, enabled: boolean) => {
    try {
      const response = await fetch('/api/calendar/sources', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, enabled }),
      });

      if (response.ok) {
        await loadSources();
      } else {
        throw new Error('Failed to update calendar');
      }
    } catch (error) {
      console.error('Error updating calendar:', error);
      showToast('Failed to update calendar', 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Calendar Integration</h2>
        <div className="space-y-3">
          <div className="h-16 bg-gray-200 rounded"></div>
          <div className="h-16 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-medium text-gray-900 mb-4">Calendar Integration</h2>
      <p className="text-sm text-gray-600 mb-6">
        Add ICS calendar URLs to show events in your meal planner. Event filtering can be configured via environment variables (set NEXT_PUBLIC_EVENT_FILTER_HOUR to a number 0-23, or &lsquo;none&rsquo; to show all events).
      </p>

      {/* Add new calendar form */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
        <h3 className="text-md font-medium text-gray-900 mb-3">Add Calendar</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">
              Calendar Name
            </label>
            <input
              type="text"
              value={newSource.name}
              onChange={(e) => setNewSource(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Personal Calendar"
              className="w-full px-3 py-2 border-2 border-gray-300 bg-white text-gray-900 placeholder-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">
              ICS URL
            </label>
            <input
              type="url"
              value={newSource.url}
              onChange={(e) => setNewSource(prev => ({ ...prev, url: e.target.value }))}
              placeholder="https://calendar.google.com/calendar/ical/..."
              className="w-full px-3 py-2 border-2 border-gray-300 bg-white text-gray-900 placeholder-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">
              Color
            </label>
            <div className="flex gap-2">
              <input
                type="color"
                value={newSource.color}
                onChange={(e) => setNewSource(prev => ({ ...prev, color: e.target.value }))}
                className="w-12 h-10 border-2 border-gray-300 rounded cursor-pointer"
              />
              <input
                type="text"
                value={newSource.color}
                onChange={(e) => setNewSource(prev => ({ ...prev, color: e.target.value }))}
                className="flex-1 px-3 py-2 border-2 border-gray-300 bg-white text-gray-900 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>
          </div>
          <div className="flex items-end">
            <button
              onClick={addSource}
              disabled={isAdding}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Plus className="w-4 h-4" />
              {isAdding ? 'Adding...' : 'Add Calendar'}
            </button>
          </div>
        </div>
      </div>

      {/* Calendar sources list */}
      <div className="space-y-3">
        {sources.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Globe className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p>No calendars configured</p>
            <p className="text-sm">Add your first calendar above to get started</p>
          </div>
        ) : (
          sources.map((source) => (
            <div
              key={source.id}
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: source.color }}
                />
                <div>
                  <h4 className="font-medium text-gray-900">{source.name}</h4>
                  <p className="text-sm text-gray-500 truncate max-w-md">{source.url}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={source.enabled}
                    onChange={(e) => toggleSource(source.id, e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Enabled</span>
                </label>
                <button
                  onClick={() => removeSource(source.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  title="Remove calendar"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Calendar Refresh Section */}
      <div className="mt-8">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Calendar Data</h3>
        <div className="p-4 border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">Refresh Calendar Events</h4>
              <p className="text-sm text-gray-500 mt-1">
                Clear cache and fetch the latest events from all calendar sources
              </p>
            </div>
            <button
              onClick={refreshCalendarData}
              disabled={isRefreshing}
              className={`
                inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all
                ${isRefreshing 
                  ? 'bg-blue-50 text-blue-600 cursor-not-allowed' 
                  : refreshComplete
                    ? 'bg-green-50 text-green-600'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }
              `}
            >
              {refreshComplete ? (
                <>
                  <Check className="w-4 h-4" />
                  Refreshed
                </>
              ) : (
                <>
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  {isRefreshing ? 'Refreshing...' : 'Refresh Calendar'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="text-sm font-medium text-blue-900 mb-2">How to get your calendar URL:</h3>
        <div className="text-sm text-blue-800 space-y-1">
          <p><strong>Google Calendar:</strong> Calendar Settings → Integrate calendar → Secret address in iCal format</p>
          <p><strong>Outlook/Hotmail:</strong> Calendar Settings → Shared calendars → Publish a calendar</p>
          <p><strong>Apple iCloud:</strong> Calendar app → Share Calendar → Public Calendar</p>
        </div>
      </div>
    </div>
  );
}
