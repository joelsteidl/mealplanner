"use client";

import { useState, useEffect } from "react";
import { format, isToday } from "date-fns";
import { Plus, ExternalLink, GripVertical } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

interface DayPlanProps {
  date: Date;
  mealPlan?: {
    id: string;
    recipe?: {
      _id: string;
      title: string;
      rating: number;
    };
    note?: string;
  };
  onAddMeal?: (date: Date) => void; // Made optional since we're not using it
  onAddRecipe: (date: Date) => void;
  onSwapMealPlans: (sourceDate: Date, targetDate: Date) => Promise<void>;
  onRefresh?: () => void;
  isSwapping?: boolean;
}

export function DayPlan({ 
  date, 
  mealPlan, 
  onAddRecipe, 
  onSwapMealPlans,
  onRefresh,
  isSwapping: globalSwapping = false
}: DayPlanProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);

  // Initialize noteText when component mounts or mealPlan changes
  useEffect(() => {
    console.log('Updating noteText from mealPlan:', { mealPlan, note: mealPlan?.note });
    setNoteText(mealPlan?.note || "");
  }, [mealPlan]);

  const handleSaveNote = async (text: string) => {
    setIsSaving(true);
    console.log('Saving note:', { text, trimmed: text.trim(), mealPlan });
    try {
      if (mealPlan) {
        // Update existing meal plan
        if (!text.trim() && !mealPlan.recipe) {
          // If no text and no recipe, delete the meal plan
          console.log('Deleting meal plan - no text and no recipe');
          const response = await fetch(`/api/meal-plans/${mealPlan.id}`, {
            method: "DELETE",
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
            },
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error('DELETE request failed:', response.status, errorText);
            throw new Error(`Failed to delete meal plan: ${errorText}`);
          }
          
          console.log('Meal plan deleted successfully');
        } else {
          // Update the meal plan note (including clearing it if empty)
          console.log('Updating meal plan note:', { 
            note: text.trim() || "", 
            recipeId: mealPlan.recipe?._id || null 
          });
          const response = await fetch(`/api/meal-plans/${mealPlan.id}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
            },
            body: JSON.stringify({
              note: text.trim() || "", // Explicitly set empty string instead of undefined
              recipeId: mealPlan.recipe?._id || null, // Preserve existing recipe
            }),
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error('PUT request failed:', response.status, errorText);
            throw new Error(`Failed to update meal plan: ${errorText}`);
          }
          
          const updatedMealPlan = await response.json();
          console.log('Meal plan note updated successfully:', updatedMealPlan);
        }
      } else if (text.trim()) {
        // Create new meal plan with just a note
        await fetch("/api/meal-plans", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            date: date.toISOString(),
            note: text.trim(),
          }),
        });
      }

      // Force refresh with a small delay to ensure API has processed the change
      if (onRefresh) {
        setTimeout(() => {
          console.log('Triggering calendar refresh after note save');
          onRefresh();
        }, 100);
      }
    } catch (error) {
      console.error("Error saving meal plan:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleNoteChange = (text: string) => {
    console.log('Note text changed:', { text, length: text.length });
    setNoteText(text);
    
    // Clear existing timeout
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    
    // Set new timeout to save after 1 second of no typing
    const timeout = setTimeout(() => {
      console.log('Auto-save timeout triggered for text:', text);
      handleSaveNote(text);
    }, 1000);
    
    setSaveTimeout(timeout);
  };

  const handleStartEditing = () => {
    // Not needed anymore, the textarea is always available
    setNoteText(mealPlan?.note || "");
  };

  const handleBlur = () => {
    console.log('Textarea blur event, current noteText:', noteText);
    // Save immediately on blur if there are unsaved changes
    if (saveTimeout) {
      console.log('Clearing timeout and saving immediately on blur');
      clearTimeout(saveTimeout);
      setSaveTimeout(null);
      handleSaveNote(noteText);
    }
  };

  const handleClearRecipe = async () => {
    if (!mealPlan) return;
    
    setIsSaving(true);
    try {
      // Update the meal plan to remove the recipe
      await fetch(`/api/meal-plans/${mealPlan.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipeId: null, // Clear the recipe
          note: mealPlan.note || "", // Keep the existing note
        }),
      });

      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error("Error clearing recipe:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Drag handlers
  const handleDragStart = (e: React.DragEvent) => {
    if (!mealPlan || globalSwapping) {
      e.preventDefault();
      return;
    }
    console.log('Drag started from date:', format(date, 'yyyy-MM-dd'));
    e.dataTransfer.setData("text/plain", date.toISOString());
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear drag over if we're actually leaving this element
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const sourceDateStr = e.dataTransfer.getData("text/plain");
    if (!sourceDateStr) {
      console.error('No source date found in drag data');
      return;
    }
    
    const sourceDate = new Date(sourceDateStr);
    const targetDate = date;

    // Use date strings for comparison to avoid timezone issues
    const sourceDateString = format(sourceDate, 'yyyy-MM-dd');
    const targetDateString = format(targetDate, 'yyyy-MM-dd');

    console.log('Drop attempt:', {
      sourceDate: sourceDateString,
      targetDate: targetDateString,
      sourceDateStr
    });

    if (sourceDateString === targetDateString) {
      console.log('Source and target are the same, ignoring');
      return;
    }

    // No need to set local loading state - parent handles optimistic updates
    try {
      await onSwapMealPlans(sourceDate, targetDate);
      console.log('Swap completed successfully');
    } catch (error) {
      console.error('Swap failed:', error);
    }
  };

  const todayClass = isToday(date) 
    ? "ring-2 ring-blue-500 bg-blue-50/30" 
    : "";

  const dragOverClass = isDragOver 
    ? "ring-2 ring-blue-400 bg-blue-50" 
    : "";

  return (
    <div
      className={`
        relative p-4 bg-white rounded-lg shadow hover:shadow-md transition-all transform hover:scale-105
        ${todayClass}
        ${dragOverClass}
        ${mealPlan ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}
        ${globalSwapping ? 'opacity-75' : ''}
      `}
      // Native HTML5 drag and drop - make sure ALL days can receive drops
      draggable={!!mealPlan && !globalSwapping}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Drag indicator for meals */}
      {mealPlan && (
        <div className="absolute top-2 right-2 text-gray-400">
          <GripVertical className="w-4 h-4" />
        </div>
      )}
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-semibold text-gray-900">
            {format(date, "EEEE")}
          </h3>
          <p className="text-sm text-gray-600">
            {format(date, "MMM d")}
          </p>
        </div>
        {!mealPlan && (
          <button
            onClick={handleStartEditing}
            className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
            title="Add meal plan"
          >
            <Plus className="w-5 h-5 text-gray-600" />
          </button>
        )}
      </div>

      {mealPlan ? (
        <div className="space-y-3">
          {mealPlan.recipe ? (
            <div>
              <Link
                href={`/recipes/${mealPlan.recipe._id}?from=calendar`}
                className="group flex items-start gap-1 text-blue-600 hover:text-blue-800 font-medium"
              >
                <span className="flex-1">{mealPlan.recipe.title}</span>
                <ExternalLink className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            </div>
          ) : null}
          
          {/* Always show textarea for notes, whether meal plan has recipe or not */}
          <div className="relative">
            <textarea
              value={noteText}
              onChange={(e) => handleNoteChange(e.target.value)}
              onBlur={handleBlur}
              placeholder={mealPlan.recipe ? "Add notes..." : "Meal plan..."}
              className="w-full p-2 text-sm text-gray-900 placeholder-gray-500 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none bg-white hover:bg-gray-50 focus:bg-white transition-colors"
              rows={noteText ? Math.max(1, Math.ceil(noteText.length / 50)) : 1}
            />
            {isSaving && (
              <div className="absolute top-2 right-2 text-xs text-gray-500 flex items-center gap-1">
                <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                Saving...
              </div>
            )}
          </div>

          {isHovered && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }}
              className="flex gap-2 pt-2 border-t border-gray-100"
            >
              {mealPlan.recipe ? (
                <button
                  onClick={() => handleClearRecipe()}
                  className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="Clear recipe"
                >
                  Clear Recipe
                </button>
              ) : (
                <button
                  onClick={() => onAddRecipe(date)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded hover:bg-blue-100 transition-colors"
                  title="Choose recipe"
                >
                  <Plus className="w-3 h-3" />
                  Choose Recipe
                </button>
              )}
            </motion.div>
          )}
        </div>
      ) : (
        <div className="py-4 space-y-3">
          <div className="relative">
            <textarea
              value={noteText}
              onChange={(e) => handleNoteChange(e.target.value)}
              onBlur={handleBlur}
              onFocus={handleStartEditing}
              placeholder="Add meal plan..."
              className="w-full p-3 text-sm text-gray-900 placeholder-gray-500 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none bg-white hover:bg-gray-50 focus:bg-white transition-colors"
              rows={2}
            />
            {isSaving && (
              <div className="absolute top-2 right-2 text-xs text-gray-500 flex items-center gap-1">
                <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                Saving...
              </div>
            )}
          </div>
          <button
            onClick={() => onAddRecipe(date)}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-sm bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Choose Recipe
          </button>
        </div>
      )}
    </div>
  );
}
