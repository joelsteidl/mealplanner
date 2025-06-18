"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Search, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface Recipe {
  _id: string;
  title: string;
  rating: number;
  tags: string[];
}

interface MealPlan {
  _id: string;
  date: string;
  recipe?: {
    _id: string;
    title: string;
    rating: number;
  };
  note?: string;
}

interface AddMealFormProps {
  date?: Date;
  initialMealPlan?: MealPlan;
}

// Helper function to get contextual messages
const getContextualMessage = (
  hasRecipe: boolean,
  hasNote: boolean,
  searchActive: boolean,
  isSearching: boolean
): { text: string; type: 'info' | 'success' | 'warning' | null } => {
  if (isSearching) return { text: "", type: null };
  if (hasRecipe) return { text: "Recipe selected! You can add an optional note or save the meal plan.", type: 'success' };
  if (searchActive) return { text: "Type at least 2 characters to search recipes", type: 'info' };
  if (hasNote) return { text: "Note added! You can also search for a recipe if you'd like.", type: 'success' };
  return { text: "Select a recipe or add a note about the meal", type: 'info' };
};

export function AddMealForm({ date, initialMealPlan }: AddMealFormProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<string | null>(null);
  const [selectedRecipeTitle, setSelectedRecipeTitle] = useState<string>("");
  const [note, setNote] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [formErrors, setFormErrors] = useState<{
    recipe?: string;
    note?: string;
  }>({});
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [searchActive, setSearchActive] = useState(false);

  // Calculate the contextual message
  const contextualMessage = useMemo(() => 
    getContextualMessage(
      !!selectedRecipe,
      note.length > 0,
      searchActive,
      isSearching
    ),
    [selectedRecipe, note.length, searchActive, isSearching]
  );

  // Initialize form with meal plan data if editing
  useEffect(() => {
    if (initialMealPlan) {
      if (initialMealPlan.recipe) {
        setSelectedRecipe(initialMealPlan.recipe._id);
        setSelectedRecipeTitle(initialMealPlan.recipe.title);
      }
      if (initialMealPlan.note) {
        setNote(initialMealPlan.note);
      }
    }
  }, [initialMealPlan]);

  const searchRecipes = async (query: string) => {
    setIsSearching(true);
    setSearchError("");
    try {
      const response = await fetch(`/api/recipes/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) {
        throw new Error("Failed to search recipes");
      }
      const data = await response.json();
      setRecipes(data);
    } catch (error) {
      setSearchError("Failed to search recipes. Please try again.");
      showToast("Failed to search recipes", "error");
    } finally {
      setIsSearching(false);
    }
  };

  const validateForm = (): boolean => {
    const errors: { recipe?: string; note?: string } = {};
    let isValid = true;

    if (!selectedRecipe && !note.trim()) {
      errors.recipe = "Please select a recipe or add a note";
      errors.note = "Please select a recipe or add a note";
      isValid = false;
    }

    if (note.trim() && note.trim().length < 3) {
      errors.note = "Note must be at least 3 characters long";
      isValid = false;
    }

    setFormErrors(errors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});

    if (!validateForm()) {
      showToast("Please fill in all required fields", "error");
      return;
    }

    setIsLoading(true);

    try {
      const url = initialMealPlan
        ? `/api/meal-plans/${initialMealPlan._id}`
        : "/api/meal-plans";
      
      const method = initialMealPlan ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          date: date ? format(date, "yyyy-MM-dd") : initialMealPlan?.date,
          recipeId: selectedRecipe,
          note: note,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || (initialMealPlan ? "Failed to update meal plan" : "Failed to create meal plan"));
      }

      showToast(initialMealPlan ? "Meal plan updated successfully!" : "Meal plan created successfully!", "success");
      
      // Navigate back to home
      router.push("/");
      router.refresh();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Failed to save meal plan",
        "error"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearRecipe = () => {
    setSelectedRecipe(null);
    setSelectedRecipeTitle("");
    setSearchQuery("");
    setFormErrors({});
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          {initialMealPlan ? "Edit meal plan" : `Plan meal for ${format(date as Date, "EEEE, MMMM d, yyyy")}`}
        </h2>
      </div>

      {contextualMessage.text && (
        <div
          className={`p-4 rounded-lg ${
            contextualMessage.type === 'success'
              ? 'bg-green-50 border-2 border-green-200 text-green-800'
              : 'bg-blue-50 border-2 border-blue-200 text-blue-800'
          }`}
        >
          {contextualMessage.text}
        </div>
      )}

      <div>
        <label className="block text-base font-semibold text-gray-900 mb-2">
          Search Recipes
          {selectedRecipe && (
            <span className="ml-2 text-sm text-gray-600 font-normal">
              (Recipe selected)
            </span>
          )}
        </label>
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSearchActive(e.target.value.length > 0);
              if (!e.target.value) {
                setSelectedRecipe(null);
                setSelectedRecipeTitle("");
              }
              if (e.target.value.length >= 2) {
                searchRecipes(e.target.value);
              }
            }}
            placeholder="Search recipes..."
            className={`w-full pl-10 ${selectedRecipe ? 'pr-10' : 'pr-4'} py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white ${
              formErrors.recipe && !selectedRecipe ? 'border-red-500' : ''
            }`}
          />
          <Search className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
        </div>

        {searchQuery.length >= 2 && recipes.length > 0 && !selectedRecipe && (
          <div className="mt-2 p-2 bg-white border-2 border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
            {recipes.map((recipe) => (
              <button
                key={recipe._id}
                type="button"
                onClick={() => {
                  setSelectedRecipe(recipe._id);
                  setSelectedRecipeTitle(recipe.title);
                  setSearchQuery(recipe.title);
                  setRecipes([]);
                }}
                className="w-full text-left px-4 py-2 hover:bg-gray-50 rounded text-gray-900"
              >
                <span className="font-medium">{recipe.title}</span>
                {recipe.tags.length > 0 && (
                  <div className="text-sm text-gray-600 mt-1">
                    {recipe.tags.join(", ")}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="block text-base font-semibold text-gray-900 mb-2">
          Add a Note
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={`w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white ${
            formErrors.note ? "border-red-500" : ""
          }`}
          placeholder="Add any notes about the meal..."
          rows={3}
        />
        {formErrors.note && (
          <p className="mt-1 text-sm text-red-600 font-medium">{formErrors.note}</p>
        )}
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg transition-colors disabled:opacity-50 font-medium text-base"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              {initialMealPlan ? "Updating..." : "Saving..."}
            </span>
          ) : (
            initialMealPlan ? "Update Meal Plan" : "Save Meal Plan"
          )}
        </button>
      </div>

      <ConfirmDialog
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={() => {
          setSelectedRecipe(null);
          setSelectedRecipeTitle("");
          setSearchQuery("");
          setFormErrors({});
          setShowClearConfirm(false);
        }}
        title="Clear Selected Recipe"
        message="Are you sure you want to clear the selected recipe? You'll need to search again to select it."
        confirmText="Clear Recipe"
        cancelText="Keep Recipe"
      />
    </form>
  );
}
