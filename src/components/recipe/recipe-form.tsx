"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface Recipe {
  _id?: string;
  title: string;
  sourceUrl?: string;
  rating?: number;
  difficulty?: "Easy" | "Medium" | "Hard";
  tags: string[];
  ingredients: string[];
  directions: string[];
  notes?: string;
}

interface RecipeFormProps {
  recipe?: Recipe;
}

const AVAILABLE_TAGS = [
  { title: "Friends Over", value: "friends-over" },
  { title: "Take a Meal", value: "take-a-meal" },
  { title: "Gluten Free", value: "gluten-free" },
  { title: "Vegetarian", value: "vegetarian" },
];

export function RecipeForm({ recipe: initialRecipe }: RecipeFormProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [recipe, setRecipe] = useState<Recipe>({
    title: "",
    sourceUrl: "",
    rating: undefined,
    difficulty: undefined,
    tags: [],
    ingredients: [""],
    directions: [""],
    notes: "",
  });

  useEffect(() => {
    if (initialRecipe) {
      setRecipe(initialRecipe);
    }
  }, [initialRecipe]);

  // Auto-resize all ingredient and direction textareas when content changes
  useEffect(() => {
    const resizeTextareas = () => {
      const ingredientTextareas = document.querySelectorAll('textarea[placeholder*="ingredient"]');
      const directionTextareas = document.querySelectorAll('textarea[placeholder*="direction"]');
      
      [...ingredientTextareas, ...directionTextareas].forEach((textarea) => {
        const element = textarea as HTMLTextAreaElement;
        element.style.height = 'auto';
        element.style.height = Math.max(40, element.scrollHeight) + 'px';
      });
    };

    // Use a small delay to ensure DOM is updated
    const timeoutId = setTimeout(resizeTextareas, 10);
    return () => clearTimeout(timeoutId);
  }, [recipe.ingredients, recipe.directions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Validate required fields
      if (!recipe.title.trim()) {
        throw new Error("Title is required");
      }

      // Filter out empty entries
      const ingredients = recipe.ingredients.filter(i => i.trim());
      const directions = recipe.directions.filter(d => d.trim());

      if (ingredients.length === 0) {
        throw new Error("At least one ingredient is required");
      }

      if (directions.length === 0) {
        throw new Error("At least one direction step is required");
      }

      const url = initialRecipe?._id 
        ? `/api/recipes/${initialRecipe._id}`
        : "/api/recipes";
      
      const method = initialRecipe?._id ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...recipe,
          ingredients,
          directions,
        }),
      });

      const data = await response.text();
      
      if (!response.ok) {
        throw new Error(data || (initialRecipe?._id ? "Failed to update recipe" : "Failed to create recipe"));
      }

      showToast(
        initialRecipe?._id ? "Recipe updated successfully!" : "Recipe created successfully!",
        "success"
      );
      router.push("/recipes");
      router.refresh();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Failed to save recipe",
        "error"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!initialRecipe?._id) return;
    
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/recipes/${initialRecipe._id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Failed to delete recipe");
      }

      showToast("Recipe deleted successfully!", "success");
      router.push("/recipes");
      router.refresh();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Failed to delete recipe",
        "error"
      );
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const importFromUrl = async () => {
    if (!recipe.sourceUrl) return;
    
    setIsImporting(true);
    try {
      const response = await fetch("/api/recipes/scrape", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: recipe.sourceUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || "Failed to import recipe");
      }

      // Show confidence level to user
      const confidenceMessage = data.confidence >= 75 
        ? "High confidence import - recipe looks complete!" 
        : data.confidence >= 50
        ? "Medium confidence import - please review and edit as needed"
        : data.confidence >= 25
        ? "Low confidence import - significant editing may be required"
        : "Minimal data found - please review carefully";

      // Update all fields with imported data, but don't overwrite existing content unless it's empty
      setRecipe(prev => ({
        ...prev,
        title: data.title || prev.title,
        ingredients: data.ingredients?.length > 0 
          ? [...data.ingredients, ""] // Add empty item for new entries
          : prev.ingredients,
        directions: data.directions?.length > 0
          ? [...data.directions, ""] // Add empty item for new entries
          : prev.directions,
        // Keep rating and difficulty empty - let user set them
      }));

      showToast(`${confidenceMessage} (${data.confidence}% confidence)`, data.confidence >= 50 ? "success" : "info");
      
      // Log details for debugging
      console.log("Recipe import details:", {
        url: recipe.sourceUrl,
        confidence: data.confidence,
        ingredientCount: data.ingredients?.length || 0,
        directionCount: data.directions?.length || 0,
        hasTitle: !!data.title
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to import recipe";
      showToast(errorMessage, "error");
      console.error("Recipe import error:", error);
    } finally {
      setIsImporting(false);
    }
  };

  // HTML entity decoding for pasted content
  const decodeHtmlEntities = (text: string): string => {
    const htmlEntities: Record<string, string> = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&apos;': "'",
      '&nbsp;': ' ',
      '&frac14;': '¼',
      '&frac12;': '½',
      '&frac34;': '¾',
      '&deg;': '°',
      '&rsquo;': '\u2019',
      '&lsquo;': '\u2018',
      '&rdquo;': '\u201D',
      '&ldquo;': '\u201C',
    };
    
    let decoded = text;
    for (const [entity, replacement] of Object.entries(htmlEntities)) {
      decoded = decoded.replace(new RegExp(entity, 'gi'), replacement);
    }
    
    // Handle numeric entities
    decoded = decoded.replace(/&#(\d+);/g, (match, num) => {
      try {
        const code = parseInt(num, 10);
        if (code >= 0 && code <= 0x10FFFF) {
          return String.fromCharCode(code);
        }
        return match;
      } catch {
        return match;
      }
    });
    
    return decoded;
  };

  // Smart parsing function for ingredients
  const parseIngredients = (text: string): string[] => {
    // Decode HTML entities first
    const decodedText = decodeHtmlEntities(text);
    
    console.log('parseIngredients called with:', decodedText);
    
    // Simple approach: split by newlines and clean up
    const lines = decodedText.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    
    console.log('Split into lines:', lines);
    
    if (lines.length > 1) {
      // Clean up each line
      const cleanedLines = lines.map(line => {
        return line
          .replace(/^[-•·*]\s*/, '') // Remove leading bullets
          .replace(/^\d+[\.\)]\s*/, '') // Remove leading numbers
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();
      }).filter(line => line.length > 0);
      
      console.log('Cleaned lines:', cleanedLines);
      return cleanedLines;
    }
    
    // If no newlines, try other separators
    if (decodedText.includes(';')) {
      const parts = decodedText.split(';').map(part => part.trim()).filter(Boolean);
      if (parts.length > 1) {
        console.log('Split by semicolons:', parts);
        return parts;
      }
    }
    
    // Return single item if no splitting worked
    console.log('No splitting possible, returning single item');
    return [decodedText.trim()];
  };

  // Smart parsing function for directions  
  const parseDirections = (text: string): string[] => {
    // Decode HTML entities first
    const decodedText = decodeHtmlEntities(text);
    
    console.log('Parsing directions from:', decodedText);
    
    // First, try splitting by numbered steps (most common for directions)
    let steps = decodedText.split(/(?:^|(?<=\n))\s*(?:Step\s*)?\d+[\.\:\)\-]\s*/mi).map(step => step.trim()).filter(Boolean);
    
    if (steps.length > 1) {
      console.log('Split by numbered steps:', steps.length, 'steps');
    } else {
      // Try splitting by double newlines (paragraphs)
      steps = decodedText.split(/\n\s*\n/).map(step => step.trim()).filter(Boolean);
      
      if (steps.length > 1) {
        console.log('Split by paragraphs:', steps.length, 'steps');
      } else {
        // Try splitting by single newlines if they seem to be separate steps
        steps = decodedText.split(/\r?\n/).map(step => step.trim()).filter(Boolean);
        
        // Only use newline splitting if each line looks like a step (reasonable length)
        const avgLength = steps.reduce((sum, step) => sum + step.length, 0) / steps.length;
        if (steps.length > 1 && avgLength > 15 && avgLength < 200) {
          console.log('Split by single newlines:', steps.length, 'steps');
        } else {
          // Try splitting by periods followed by capital letters (sentence boundaries)
          if (decodedText.length > 100) {
            steps = decodedText.split(/\.\s+(?=[A-Z])/).map(step => step.trim()).filter(Boolean);
            
            // Add periods back except to the last step
            steps = steps.map((step, index) => {
              if (index < steps.length - 1 && !step.endsWith('.')) {
                return step + '.';
              }
              return step;
            });
            
            if (steps.length > 1) {
              console.log('Split by sentences:', steps.length, 'steps');
            }
          }
        }
      }
    }
    
    // Clean up step numbers and formatting
    const cleanedSteps = steps.map(step => {
      return step
        .replace(/^(?:Step\s*)?\d+[\.\:\)\-\s]*/i, '') // Remove "Step 1:" etc.
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
    }).filter(step => step.length > 0);
    
    console.log('Final parsed directions:', cleanedSteps);
    return cleanedSteps;
  };

  const manualParseIngredients = (index: number) => {
    const value = recipe.ingredients[index];
    if (!value || value.trim().length < 5) {
      showToast("Please enter some ingredients to parse", "error");
      return;
    }
    
    const parsedIngredients = parseIngredients(value);
    
    if (parsedIngredients.length > 1) {
      const newIngredients = [...recipe.ingredients];
      newIngredients[index] = parsedIngredients[0];
      
      // Add the rest of the parsed ingredients
      for (let i = 1; i < parsedIngredients.length; i++) {
        if (index + i < newIngredients.length) {
          newIngredients[index + i] = parsedIngredients[i];
        } else {
          newIngredients.push(parsedIngredients[i]);
        }
      }
      
      // Add empty ingredient at the end
      newIngredients.push("");
      
      setRecipe({ ...recipe, ingredients: newIngredients });
      showToast(`Manually parsed ${parsedIngredients.length} ingredients!`, "success");
    } else {
      showToast("Could not split this into multiple ingredients", "info");
    }
  };

  const manualParseDirections = (index: number) => {
    const value = recipe.directions[index];
    if (!value || value.trim().length < 10) {
      showToast("Please enter some directions to parse", "error");
      return;
    }
    
    const parsedDirections = parseDirections(value);
    
    if (parsedDirections.length > 1) {
      const newDirections = [...recipe.directions];
      newDirections[index] = parsedDirections[0];
      
      // Add the rest of the parsed directions
      for (let i = 1; i < parsedDirections.length; i++) {
        if (index + i < newDirections.length) {
          newDirections[index + i] = parsedDirections[i];
        } else {
          newDirections.push(parsedDirections[i]);
        }
      }
      
      // Add empty direction at the end
      newDirections.push("");
      
      setRecipe({ ...recipe, directions: newDirections });
      showToast(`Manually parsed ${parsedDirections.length} directions!`, "success");
    } else {
      showToast("Could not split this into multiple directions", "info");
    }
  };

  const handleIngredientChange = (index: number, value: string) => {
    // Debug logging
    console.log('handleIngredientChange called with:', { index, valueLength: value.length, value: value.substring(0, 100) + '...' });
    
    // Check if this looks like a pasted list - be more sensitive to detect pastes
    const hasNewlines = value.includes('\n') || value.includes('\r');
    const hasMultipleLines = hasNewlines && value.split(/\r?\n/).filter(line => line.trim().length > 0).length > 1;
    const hasBullets = /[•·*-]\s/.test(value);
    const hasNumbers = /\d+[\.\)]\s/.test(value);
    const hasSemicolons = value.includes(';');
    const hasDoubleSpaces = /\s{2,}/.test(value);
    const hasTabs = value.includes('\t');
    
    // Also check if it looks like a typical ingredient list (measurements + food words)
    const hasIngredientWords = /\b(tablespoons?|teaspoons?|cups?|pounds?|ounces?|cloves?|salt|pepper|oil|garlic|onion|chicken|beef|sugar|flour|vinegar|lemon|mustard)\b/i.test(value);
    const hasFractions = /[¼½¾⅓⅔⅛⅜⅝⅞]/.test(value);
    
    // More lenient detection - if it has newlines and looks like ingredients, try to parse
    const isPastedList = hasMultipleLines || hasBullets || hasNumbers || hasSemicolons || hasDoubleSpaces || hasTabs || 
                        (hasNewlines && (hasIngredientWords || hasFractions) && value.length > 15);
    
    console.log('Detection flags:', {
      hasNewlines,
      hasMultipleLines, 
      hasBullets, 
      hasNumbers, 
      hasIngredientWords, 
      hasFractions,
      isPastedList,
      valueLength: value.length
    });
    
    if (isPastedList && value.trim().length > 10) {
      console.log('Detected ingredient paste, attempting to parse...');
      
      // Parse the pasted content
      const parsedIngredients = parseIngredients(value);
      
      console.log('Parsed result:', parsedIngredients);
      
      if (parsedIngredients.length > 1) {
        console.log('Successfully parsed multiple ingredients:', parsedIngredients.length);
        
        // Replace current ingredients with parsed ones
        const newIngredients = [...recipe.ingredients];
        newIngredients[index] = parsedIngredients[0];
        
        // Add the rest of the parsed ingredients
        for (let i = 1; i < parsedIngredients.length; i++) {
          if (index + i < newIngredients.length) {
            newIngredients[index + i] = parsedIngredients[i];
          } else {
            newIngredients.push(parsedIngredients[i]);
          }
        }
        
        // Add empty ingredient at the end
        newIngredients.push("");
        
        setRecipe({ ...recipe, ingredients: newIngredients });
        showToast(`Parsed ${parsedIngredients.length} ingredients!`, "success");
        return;
      } else {
        console.log('Could not parse multiple ingredients from:', value);
      }
    } else {
      console.log('Not detected as pasted list');
    }
    
    // Normal handling for single ingredient
    const newIngredients = [...recipe.ingredients];
    newIngredients[index] = value;
    setRecipe({ ...recipe, ingredients: newIngredients });

    // Add new empty ingredient if last one is being typed in
    if (index === recipe.ingredients.length - 1 && value.trim() !== "") {
      setRecipe((prev: Recipe) => ({
        ...prev,
        ingredients: [...prev.ingredients, ""]
      }));
    }
  };

  const handleDirectionChange = (index: number, value: string) => {
    // Check if this looks like a pasted list of directions - be more sensitive
    const isPastedList = value.includes('\n') || 
                        value.includes('\r') ||
                        /Step\s*\d+/i.test(value) || 
                        /^\d+[\.\)]\s/.test(value) ||
                        value.split(/\n/).length > 1 || // Multiple lines
                        (value.length > 50 && value.split('.').length > 2); // Long text with multiple sentences
    
    if (isPastedList && value.trim().length > 20) { // Reduced minimum length
      // Parse the pasted content
      const parsedDirections = parseDirections(value);
      
      if (parsedDirections.length > 1) {
        // Replace current directions with parsed ones
        const newDirections = [...recipe.directions];
        newDirections[index] = parsedDirections[0];
        
        // Add the rest of the parsed directions
        for (let i = 1; i < parsedDirections.length; i++) {
          if (index + i < newDirections.length) {
            newDirections[index + i] = parsedDirections[i];
          } else {
            newDirections.push(parsedDirections[i]);
          }
        }
        
        // Add empty direction at the end
        newDirections.push("");
        
        setRecipe({ ...recipe, directions: newDirections });
        showToast(`Parsed ${parsedDirections.length} directions!`, "success");
        return;
      }
    }
    
    // Normal handling for single direction
    const newDirections = [...recipe.directions];
    newDirections[index] = value;
    setRecipe({ ...recipe, directions: newDirections });

    // Add new empty direction if last one is being typed in
    if (index === recipe.directions.length - 1 && value.trim() !== "") {
      setRecipe((prev: Recipe) => ({
        ...prev,
        directions: [...prev.directions, ""]
      }));
    }
  };

  const removeIngredient = (index: number) => {
    if (recipe.ingredients.length > 1) {
      setRecipe((prev: Recipe) => ({
        ...prev,
        ingredients: prev.ingredients.filter((_: string, i: number) => i !== index)
      }));
    }
  };

  const removeDirection = (index: number) => {
    if (recipe.directions.length > 1) {
      setRecipe((prev: Recipe) => ({
        ...prev,
        directions: prev.directions.filter((_: string, i: number) => i !== index)
      }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="space-y-6">
        <div>
          <label className="block text-base font-semibold text-gray-900 mb-2">
            Source URL (Optional)
          </label>
          <div className="space-y-3">
            <div className="flex gap-3">
              <input
                type="url"
                value={recipe.sourceUrl}
                onChange={e => setRecipe({ ...recipe, sourceUrl: e.target.value })}
                className="flex-1 px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                placeholder="https://example.com/recipe-url"
              />
              <button
                type="button"
                onClick={importFromUrl}
                disabled={!recipe.sourceUrl || isImporting}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[120px] font-medium"
              >
                {isImporting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Importing
                  </span>
                ) : "Import Recipe"}
              </button>
            </div>
            <div className="text-sm text-gray-800">
              <p>📋 <strong>Import feature:</strong> Automatically extracts recipe data from popular cooking websites</p>
              <p>💡 <strong>Tip:</strong> Works best with major recipe sites like AllRecipes, Food Network, BBC Good Food, etc.</p>
              <p>🚧 <strong>Note:</strong> Some sites block automated requests - if import fails, copy and paste the content instead</p>
              <p>✨ <strong>AI-enhanced:</strong> Uses multiple extraction methods for maximum compatibility</p>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-base font-semibold text-gray-900 mb-2">
            Recipe Title
          </label>
          <input
            type="text"
            value={recipe.title}
            onChange={e => setRecipe({ ...recipe, title: e.target.value })}
            required
            className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
            placeholder="Enter recipe title..."
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-base font-semibold text-gray-900 mb-2">
            Rating
          </label>
          <select
            value={recipe.rating || ""}
            onChange={e => setRecipe({ ...recipe, rating: e.target.value ? Number(e.target.value) : undefined })}
            className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
          >
            <option value="">Select rating...</option>
            {[1, 2, 3, 4, 5].map(rating => (
              <option key={rating} value={rating}>
                {"★".repeat(rating)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-base font-semibold text-gray-900 mb-2">
            Difficulty
          </label>
          <select
            value={recipe.difficulty || ""}
            onChange={e => setRecipe({ ...recipe, difficulty: e.target.value ? e.target.value as "Easy" | "Medium" | "Hard" : undefined })}
            className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
          >
            <option value="">Select difficulty...</option>
            {["Easy", "Medium", "Hard"].map(level => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-base font-semibold text-gray-900 mb-2">Tags</label>
        <div className="flex flex-wrap gap-2">
          {AVAILABLE_TAGS.map(tag => (
            <button
              key={tag.value}
              type="button"
              onClick={() => {
                const newTags = recipe.tags.includes(tag.value)
                  ? recipe.tags.filter((t: string) => t !== tag.value)
                  : [...recipe.tags, tag.value];
                setRecipe({ ...recipe, tags: newTags });
              }}
              className={`px-3 py-1 rounded-full text-sm ${
                recipe.tags.includes(tag.value)
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {tag.title}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-base font-semibold text-gray-900 mb-2">
          Ingredients
          <span className="text-xs text-gray-700 font-normal ml-2">
            (Tip: You can paste a list and it will be automatically split)
          </span>
        </label>
        <div className="space-y-2">
          {recipe.ingredients.map((ingredient: string, index: number) => (
            <div 
              key={index} 
              className="flex gap-2 group"
              draggable={recipe.ingredients.filter(i => i.trim()).length > 1}
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', index.toString());
                e.dataTransfer.effectAllowed = 'move';
                e.currentTarget.style.opacity = '0.5';
              }}
              onDragEnd={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                e.currentTarget.style.backgroundColor = '#f3f4f6';
              }}
              onDragLeave={(e) => {
                e.currentTarget.style.backgroundColor = '';
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.style.backgroundColor = '';
                const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                const toIndex = index;
                
                if (fromIndex !== toIndex) {
                  const newIngredients = [...recipe.ingredients];
                  const [movedItem] = newIngredients.splice(fromIndex, 1);
                  newIngredients.splice(toIndex, 0, movedItem);
                  setRecipe({ ...recipe, ingredients: newIngredients });
                }
              }}
              style={{
                cursor: recipe.ingredients.filter(i => i.trim()).length > 1 ? 'grab' : 'default'
              }}
            >
              {recipe.ingredients.filter(i => i.trim()).length > 1 && (
                <div className="flex items-center text-gray-600 px-1 opacity-60 group-hover:opacity-100 transition-opacity">
                  <span className="text-xs select-none">⋮⋮</span>
                </div>
              )}
              <textarea
                value={ingredient}
                onChange={e => handleIngredientChange(index, e.target.value)}
                className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 resize-none"
                placeholder="Enter an ingredient or paste a list..."
                rows={1}
                style={{ 
                  minHeight: '40px',
                  height: ingredient.includes('\n') ? 'auto' : '40px'
                }}
                onInput={(e) => {
                  // Auto-resize textarea based on content
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = Math.max(40, target.scrollHeight) + 'px';
                }}
                ref={(el) => {
                  // Also auto-resize when ref is set (for programmatic content changes)
                  if (el) {
                    el.style.height = 'auto';
                    el.style.height = Math.max(40, el.scrollHeight) + 'px';
                  }
                }}
              />
              {ingredient.trim().length > 10 && recipe.ingredients.filter(i => i.trim()).length === 1 && (
                <button
                  type="button"
                  onClick={() => manualParseIngredients(index)}
                  className="px-3 py-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
                  title="Split this into multiple ingredients"
                >
                  Split
                </button>
              )}
              {index > 0 && (
                <button
                  type="button"
                  onClick={() => removeIngredient(index)}
                  className="p-2 text-red-500 hover:text-red-700"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-base font-semibold text-gray-900 mb-2">
          Directions
          <span className="text-xs text-gray-700 font-normal ml-2">
            (Tip: You can paste numbered steps and they will be automatically split)
          </span>
        </label>
        <div className="space-y-2">
          {recipe.directions.map((direction: string, index: number) => (
            <div 
              key={index} 
              className="flex gap-2 group"
              draggable={recipe.directions.filter(d => d.trim()).length > 1}
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', index.toString());
                e.dataTransfer.effectAllowed = 'move';
                e.currentTarget.style.opacity = '0.5';
              }}
              onDragEnd={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                e.currentTarget.style.backgroundColor = '#f3f4f6';
              }}
              onDragLeave={(e) => {
                e.currentTarget.style.backgroundColor = '';
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.style.backgroundColor = '';
                const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                const toIndex = index;
                
                if (fromIndex !== toIndex) {
                  const newDirections = [...recipe.directions];
                  const [movedItem] = newDirections.splice(fromIndex, 1);
                  newDirections.splice(toIndex, 0, movedItem);
                  setRecipe({ ...recipe, directions: newDirections });
                }
              }}
              style={{
                cursor: recipe.directions.filter(d => d.trim()).length > 1 ? 'grab' : 'default'
              }}
            >
              {recipe.directions.filter(d => d.trim()).length > 1 && (
                <div className="flex items-center text-gray-400 px-1 opacity-50 group-hover:opacity-100 transition-opacity">
                  <span className="text-xs select-none">⋮⋮</span>
                </div>
              )}
              <textarea
                value={direction}
                onChange={e => handleDirectionChange(index, e.target.value)}
                className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700 resize-none"
                placeholder="Enter a direction step or paste numbered steps..."
                rows={2}
                style={{ 
                  minHeight: '60px'
                }}
                onInput={(e) => {
                  // Auto-resize textarea based on content
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = Math.max(60, target.scrollHeight) + 'px';
                }}
                ref={(el) => {
                  // Also auto-resize when ref is set (for programmatic content changes)
                  if (el) {
                    el.style.height = 'auto';
                    el.style.height = Math.max(60, el.scrollHeight) + 'px';
                  }
                }}
              />
              {direction.trim().length > 20 && recipe.directions.filter(d => d.trim()).length === 1 && (
                <button
                  type="button"
                  onClick={() => manualParseDirections(index)}
                  className="px-3 py-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
                  title="Split this into multiple steps"
                >
                  Split
                </button>
              )}
              {index > 0 && (
                <button
                  type="button"
                  onClick={() => removeDirection(index)}
                  className="p-2 text-red-500 hover:text-red-700"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-base font-semibold text-gray-900 mb-2">Notes (Optional)</label>
        <textarea
          value={recipe.notes}
          onChange={e => setRecipe({ ...recipe, notes: e.target.value })}
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700"
          placeholder="Enter any additional notes..."
          rows={3}
        />
      </div>

      <div className="flex justify-between">
        {initialRecipe?._id && (
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isDeleting}
            className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {isDeleting ? "Deleting..." : "Delete Recipe"}
          </button>
        )}
        <button
          type="submit"
          disabled={isLoading}
          className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors disabled:opacity-50"
        >
          {isLoading ? (initialRecipe?._id ? "Updating..." : "Creating...") : (initialRecipe?._id ? "Update Recipe" : "Create Recipe")}
        </button>
      </div>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Recipe"
        message="Are you sure you want to delete this recipe? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
      />
    </form>
  );
}
