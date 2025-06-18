"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { addDays, format } from "date-fns";
import { DayPlan } from "./day-plan";
import { useToast } from "@/components/ui/toast";
import { RecipePickerModal } from "@/components/meal-plan/recipe-picker-modal";

interface Recipe {
  _id: string;
  title: string;
  rating: number;
}

interface MealPlan {
  _id: string;
  date: string;
  recipe?: Recipe;
  note?: string;
}

export function MealCalendar() {
  const { showToast } = useToast();
  const [baseDate, setBaseDate] = useState(() => new Date());
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isRecipePickerOpen, setIsRecipePickerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [swapProgress, setSwapProgress] = useState<{
    isSwapping: boolean;
    sourceDate?: string;
    targetDate?: string;
  }>({ isSwapping: false });

  // Calculate date range starting from baseDate (showing 9 days total)
  const { dates, startDate } = useMemo(() => {
    const start = baseDate;
    const datesArray = Array.from({ length: 9 }, (_, i) => addDays(start, i));
    return { dates: datesArray, startDate: start };
  }, [baseDate]);

  // Centralized fetch function
  const fetchMealPlans = useCallback(async () => {
    console.log('fetchMealPlans called - refreshing data');
    try {
      const start = format(startDate, 'yyyy-MM-dd');
      const end = format(dates[dates.length - 1], 'yyyy-MM-dd');
      
      // Add cache-busting parameters
      const timestamp = Date.now();
      const response = await fetch(
        `/api/meal-plans/get?startDate=${start}&endDate=${end}&_t=${timestamp}`,
        {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch meal plans");
      }

      const data = await response.json();
      console.log('Successfully fetched meal plans:', data.length, 'plans');
      setMealPlans(data);
    } catch (error) {
      console.error("Error fetching meal plans:", error);
      showToast("Failed to load meal plans", "error");
    }
  }, [startDate, dates, showToast]);

  // Fetch meal plans when the date range changes or refresh is triggered
  useEffect(() => {
    fetchMealPlans();
  }, [dates, startDate, refreshTrigger, fetchMealPlans]);

  // Listen for focus events to refresh data when returning to the page
  useEffect(() => {
    const handleFocus = () => {
      // Trigger a refresh by updating the refresh trigger
      setRefreshTrigger(prev => prev + 1);
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // Navigation handlers
  const goToPreviousWeek = () => {
    setBaseDate(prev => addDays(prev, -7));
  };

  const goToNextWeek = () => {
    setBaseDate(prev => addDays(prev, 7));
  };

  const goToToday = () => {
    setBaseDate(new Date());
  };

  // Handle meal plan swapping with optimistic updates
  const handleSwapMealPlans = async (sourceDate: Date, targetDate: Date) => {
    const sourceDateStr = format(sourceDate, 'yyyy-MM-dd');
    const targetDateStr = format(targetDate, 'yyyy-MM-dd');
    
    console.log('handleSwapMealPlans called with:', {
      sourceDate: sourceDateStr,
      targetDate: targetDateStr
    });

    // Store original state for rollback on error
    const originalMealPlans = [...mealPlans];

    // Find the meal plans to swap
    const sourceMealPlan = mealPlans.find(plan => plan.date === sourceDateStr);
    const targetMealPlan = mealPlans.find(plan => plan.date === targetDateStr);

    console.log('Found meal plans for swap:', {
      sourceMealPlan: sourceMealPlan ? { id: sourceMealPlan._id, date: sourceMealPlan.date } : null,
      targetMealPlan: targetMealPlan ? { id: targetMealPlan._id, date: targetMealPlan.date } : null
    });

    // Create optimistic state
    let optimisticMealPlans = [...mealPlans];

    if (sourceMealPlan && targetMealPlan) {
      // Both dates have meal plans - swap them
      optimisticMealPlans = mealPlans.map(plan => {
        if (plan._id === sourceMealPlan._id) {
          return { ...sourceMealPlan, date: targetDateStr };
        } else if (plan._id === targetMealPlan._id) {
          return { ...targetMealPlan, date: sourceDateStr };
        }
        return plan;
      });
    } else if (sourceMealPlan && !targetMealPlan) {
      // Only source has a meal plan - move it to target
      optimisticMealPlans = mealPlans.map(plan => {
        if (plan._id === sourceMealPlan._id) {
          return { ...sourceMealPlan, date: targetDateStr };
        }
        return plan;
      });
    } else if (!sourceMealPlan && targetMealPlan) {
      // Only target has a meal plan - move it to source
      optimisticMealPlans = mealPlans.map(plan => {
        if (plan._id === targetMealPlan._id) {
          return { ...targetMealPlan, date: sourceDateStr };
        }
        return plan;
      });
    } else {
      // Neither has a meal plan - nothing to do
      console.log('No meal plans to swap');
      return;
    }

    // Update UI immediately
    setMealPlans(optimisticMealPlans);
    
    // Show progress indicator
    setSwapProgress({ 
      isSwapping: true, 
      sourceDate: sourceDateStr, 
      targetDate: targetDateStr 
    });

    try {
      const response = await fetch('/api/meal-plans/swap', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        cache: 'no-store',
        body: JSON.stringify({
          sourceDate: sourceDateStr,
          targetDate: targetDateStr,
        }),
      });

      console.log('Swap API response:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Swap API error:', errorText);
        
        // Revert the optimistic update on error
        await fetchMealPlans();
        throw new Error(`Failed to swap meal plans: ${errorText}`);
      }

      const result = await response.json();
      console.log('Swap API result:', result);

      showToast("Meal plans swapped successfully", "success");
      
      // Verify the save worked by re-fetching after a short delay
      setTimeout(async () => {
        console.log('Verifying swap by re-fetching data...');
        try {
          await fetchMealPlans();
        } catch (verifyError) {
          console.error('Error during verification fetch:', verifyError);
        }
      }, 1000);
    } catch (error) {
      console.error("Error swapping meal plans:", error);
      
      // Revert to original state on error
      setMealPlans(originalMealPlans);
      showToast("Failed to swap meal plans - changes reverted", "error");
    } finally {
      setSwapProgress({ isSwapping: false });
    }
  };

  // Handlers for meal plan actions
  const handleRefresh = () => {
    console.log('handleRefresh called, triggering data refresh');
    setRefreshTrigger(prev => prev + 1);
  };

  const handleAddRecipe = (date: Date) => {
    setSelectedDate(date);
    setIsRecipePickerOpen(true);
  };

  const handleRecipeSelect = async (recipe: { _id: string; title: string; rating?: number }) => {
    if (!selectedDate) return;

    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      console.log('Adding recipe to date:', dateStr, 'Recipe:', recipe);
      
      // Check if there's already a meal plan for this date
      const existingMealPlan = mealPlans.find(plan => plan.date === dateStr);
      console.log('Existing meal plan found:', existingMealPlan);
      
      let response;
      
      if (existingMealPlan) {
        // Update existing meal plan with the recipe
        console.log('Updating existing meal plan:', existingMealPlan._id);
        response = await fetch(`/api/meal-plans/${existingMealPlan._id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            recipeId: recipe._id,
            note: existingMealPlan.note || "", // Preserve existing note
          }),
        });
      } else {
        // Create new meal plan with recipe
        console.log('Creating new meal plan');
        const postData = {
          date: format(selectedDate, 'yyyy-MM-dd'), // Use consistent date format
          recipeId: recipe._id,
        };
        console.log('POST data:', postData);
        
        response = await fetch("/api/meal-plans", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(postData),
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', response.status, errorText);
        throw new Error(`Failed to save meal plan: ${errorText}`);
      }

      const result = await response.json();
      console.log('API Success:', result);

      // Close the modal
      setIsRecipePickerOpen(false);
      setSelectedDate(null);

      showToast(`Added "${recipe.title}" to ${format(selectedDate, 'EEEE, MMM d')}`, "success");
      
      // Force refresh meal plans with a slight delay to ensure API has processed
      setTimeout(() => {
        setRefreshTrigger(prev => prev + 1);
      }, 100);
      
    } catch (error) {
      console.error("Error saving meal plan:", error);
      showToast("Failed to add meal plan", "error");
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Meal Calendar</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={goToPreviousWeek}
              className="px-3 py-2 text-sm bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-lg transition-colors border border-gray-300"
            >
              ← Previous
            </button>
            <button
              onClick={goToToday}
              className="px-3 py-2 text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors"
            >
              Today
            </button>
            <button
              onClick={goToNextWeek}
              className="px-3 py-2 text-sm bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-lg transition-colors border border-gray-300"
            >
              Next →
            </button>
          </div>
        </div>
        <div className="text-gray-600 text-sm">
          {format(startDate, 'MMM d')} - {format(dates[dates.length - 1], 'MMM d, yyyy')}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {dates.map((date) => {
          const mealPlan = mealPlans.find(
            plan => plan.date === format(date, 'yyyy-MM-dd')
          );
          
          const dateStr = format(date, 'yyyy-MM-dd');
          const isSwapping = swapProgress.isSwapping && 
            (swapProgress.sourceDate === dateStr || swapProgress.targetDate === dateStr);
          
          return (
            <DayPlan
              key={date.toISOString()}
              date={date}
              mealPlan={mealPlan ? {
                id: mealPlan._id,
                recipe: mealPlan.recipe,
                note: mealPlan.note
              } : undefined}
              onAddRecipe={handleAddRecipe}
              onSwapMealPlans={handleSwapMealPlans}
              onRefresh={handleRefresh}
              isSwapping={isSwapping}
            />
          );
        })}
      </div>
      
      {/* Global progress indicator */}
      {swapProgress.isSwapping && (
        <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
          <span>Saving swap...</span>
        </div>
      )}

      {/* Recipe Picker Modal */}
      <RecipePickerModal
        isOpen={isRecipePickerOpen}
        onClose={() => setIsRecipePickerOpen(false)}
        onSelectRecipe={handleRecipeSelect}
        selectedDate={selectedDate ? selectedDate.toISOString() : ""}
      />
    </div>
  );
}
