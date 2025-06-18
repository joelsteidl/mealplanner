"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { format, addDays } from "date-fns";
import { Edit, Trash2, ChefHat, Calendar, X, ExternalLink } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import DOMPurify from "dompurify";

interface Recipe {
  _id: string;
  title: string;
  sourceUrl?: string;
  rating?: number;
  difficulty?: string;
  tags: string[];
  ingredients: string[];
  directions: string[];
  notes?: string;
  timesCooked: number;
  lastCooked?: string;
  _createdAt: string;
}

interface RecipeDetailProps {
  recipe: Recipe;
}

export function RecipeDetail({ recipe }: RecipeDetailProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCooking, setIsCooking] = useState(false);
  const [showCookModal, setShowCookModal] = useState(false);
  const [availableDays, setAvailableDays] = useState<Array<{date: string, label: string}>>([]);
  const [loadingDays, setLoadingDays] = useState(false);
  
  // Check if user came from calendar via query parameter
  const cameFromCalendar = searchParams.get('from') === 'calendar';

  // Fetch available days when cook modal opens
  const fetchAvailableDays = useCallback(async () => {
    setLoadingDays(true);
    try {
      // Generate dates for the next 8 days (today + 7 future days)
      const dates = Array.from({ length: 8 }, (_, i) => {
        const date = addDays(new Date(), i);
        return format(date, 'yyyy-MM-dd');
      });

      const startDate = dates[0];
      const endDate = dates[dates.length - 1];

      // Fetch existing meal plans for this date range
      const response = await fetch(`/api/meal-plans/get?startDate=${startDate}&endDate=${endDate}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch meal plans');
      }

      const existingPlans = await response.json();
      const occupiedDates = new Set(existingPlans.map((plan: { date: string }) => plan.date));

      // Filter out occupied dates and format for display
      const available = dates
        .filter(date => !occupiedDates.has(date))
        .map(date => {
          // Parse the date string more carefully to avoid timezone issues
          const [year, month, day] = date.split('-').map(Number);
          const dateObj = new Date(year, month - 1, day); // month is 0-indexed
          const isToday = format(new Date(), 'yyyy-MM-dd') === date;
          const label = isToday ? 'Today' : format(dateObj, 'EEEE, MMM d');
          return { date, label };
        });

      setAvailableDays(available);
    } catch (error) {
      console.error('Error fetching available days:', error);
      showToast('Failed to load available days', 'error');
    } finally {
      setLoadingDays(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (showCookModal) {
      fetchAvailableDays();
    }
  }, [showCookModal, fetchAvailableDays]);

  const handleCookNow = () => {
    setShowCookModal(true);
  };

  const handleCookOnDate = async (selectedDate: string) => {
    setIsCooking(true);
    try {
      const response = await fetch("/api/meal-plans", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          date: selectedDate, // Keep the date as YYYY-MM-DD string format
          recipeId: recipe._id,
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text() || "Failed to add to meal plan");
      }

      // Parse the date more carefully to avoid timezone issues
      const [year, month, day] = selectedDate.split('-').map(Number);
      const selectedDateObj = new Date(year, month - 1, day); // month is 0-indexed
      const isToday = format(new Date(), 'yyyy-MM-dd') === selectedDate;
      const dateLabel = isToday ? 'today' : format(selectedDateObj, 'EEEE, MMM d');
      
      showToast(`Added to meal plan for ${dateLabel}!`, "success");
      setShowCookModal(false);
      router.refresh();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Failed to add to meal plan",
        "error"
      );
    } finally {
      setIsCooking(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/recipes/${recipe._id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(await response.text() || "Failed to delete recipe");
      }

      showToast("Recipe deleted successfully!", "success");
      router.push("/recipes");
      router.refresh();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Failed to delete recipe",
        "error"
      );
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          {cameFromCalendar ? (
            <Link
              href="/"
              className="text-blue-600 hover:text-blue-800 flex items-center gap-2"
            >
              ← Back to Calendar
            </Link>
          ) : (
            <Link
              href="/recipes"
              className="text-blue-600 hover:text-blue-800 flex items-center gap-2"
            >
              ← Back to Recipes
            </Link>
          )}
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={handleCookNow}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            disabled={isCooking}
          >
            <ChefHat className="w-4 h-4" />
            {isCooking ? "Adding..." : "Cook Now"}
          </button>
          <Link
            href={`/recipes/${recipe._id}/edit`}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
          >
            <Edit className="w-4 h-4" />
            Edit
          </Link>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            disabled={isDeleting}
          >
            <Trash2 className="w-4 h-4" />
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 flex-1">{recipe.title}</h1>
          {recipe.sourceUrl && (
            <a
              href={recipe.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 transition-colors p-2 hover:bg-blue-50 rounded-lg"
              title="View original source"
            >
              <ExternalLink className="w-6 h-6" />
            </a>
          )}
        </div>
        
        {/* Notes - Right under the title */}
        {recipe.notes && (
          <div className="mb-8 p-4 bg-amber-50 border-l-4 border-amber-400 rounded-r-lg">
            <div 
              className="text-gray-800 leading-relaxed prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ 
                __html: DOMPurify.sanitize(recipe.notes, {
                  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'br', 'p', 'span', 'u'],
                  ALLOWED_ATTR: []
                })
              }}
            />
          </div>
        )}
        
        {/* Ingredients and Directions - Side by Side Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Ingredients - Left Column */}
          <div>
            <h2 className="text-xl font-semibold mb-4 text-green-800">Ingredients</h2>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <ul className="space-y-2">
                {recipe.ingredients.map((ingredient, index) => (
                  <li key={index} className="flex items-start">
                    <span className="inline-block w-2 h-2 bg-green-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                    <div 
                      className="text-gray-800 leading-relaxed prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ 
                        __html: DOMPurify.sanitize(ingredient, {
                          ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'br', 'span', 'u'],
                          ALLOWED_ATTR: []
                        })
                      }}
                    />
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Directions - Right Column */}
          <div>
            <h2 className="text-xl font-semibold mb-4 text-blue-800">Directions</h2>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <ol className="space-y-4">
                {recipe.directions.map((step, index) => (
                  <li key={index} className="flex items-start">
                    <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-600 text-white text-sm font-bold rounded-full mr-3 flex-shrink-0 mt-0.5">
                      {index + 1}
                    </span>
                    <div 
                      className="text-gray-800 leading-relaxed prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ 
                        __html: DOMPurify.sanitize(step, {
                          ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'br', 'p', 'span', 'u'],
                          ALLOWED_ATTR: []
                        })
                      }}
                    />
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>

        {/* Recipe Details - Full Width Below */}
        <div className="border-t pt-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Recipe Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recipe.sourceUrl && (
              <div>
                <dt className="font-medium text-gray-800 mb-1">Source:</dt>
                <dd>
                  <a
                    href={recipe.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    {(() => {
                      try {
                        return new URL(recipe.sourceUrl).hostname.replace('www.', '');
                      } catch {
                        return recipe.sourceUrl;
                      }
                    })()}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </dd>
              </div>
            )}
            {recipe.difficulty && (
              <div>
                <dt className="font-medium text-gray-800 mb-1">Difficulty:</dt>
                <dd className="capitalize text-gray-900">{recipe.difficulty}</dd>
              </div>
            )}
            <div>
              <dt className="font-medium text-gray-800 mb-1">Times Cooked:</dt>
              <dd className="text-gray-900">{recipe.timesCooked}</dd>
            </div>
            {recipe.lastCooked && (
              <div>
                <dt className="font-medium text-gray-800 mb-1">Last Cooked:</dt>
                <dd className="text-gray-900">{format(new Date(recipe.lastCooked), "PPP")}</dd>
              </div>
            )}
            <div>
              <dt className="font-medium text-gray-800 mb-1">Created:</dt>
              <dd className="text-gray-900">{format(new Date(recipe._createdAt), "PPP")}</dd>
            </div>
            {recipe.tags.length > 0 && (
              <div className="md:col-span-2 lg:col-span-3">
                <dt className="font-medium text-gray-800 mb-2">Tags:</dt>
                <dd className="flex flex-wrap gap-2">
                  {recipe.tags.map((tag) => (
                    <span
                      key={tag}
                      className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                </dd>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cook Now Modal */}
      {showCookModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Choose a Day to Cook
                </h3>
                <button
                  onClick={() => setShowCookModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="mt-2 text-sm text-gray-600">
                Select an available day to add &ldquo;{recipe.title}&rdquo; to your meal plan
              </p>
            </div>
            
            <div className="p-6">
              {loadingDays ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
                  <span className="ml-3 text-gray-600">Loading available days...</span>
                </div>
              ) : availableDays.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 mb-2">No available days found</p>
                  <p className="text-sm text-gray-500">
                    All days in the next week already have meals planned
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {availableDays.map(({ date, label }) => {
                    // Parse date carefully for display
                    const [year, month, day] = date.split('-').map(Number);
                    const dateObj = new Date(year, month - 1, day);
                    
                    return (
                      <button
                        key={date}
                        onClick={() => handleCookOnDate(date)}
                        disabled={isCooking}
                        className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-green-300 hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900">{label}</span>
                          <span className="text-sm text-gray-500">
                            {format(dateObj, 'MMM d')}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-lg">
              <button
                onClick={() => setShowCookModal(false)}
                className="w-full px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Recipe"
        message="Are you sure you want to delete this recipe? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
}
