"use client";

import { useState, useEffect, useRef } from "react";
import { Search, ChevronDown, X } from "lucide-react";
import Link from "next/link";

interface Recipe {
  _id: string;
  title: string;
  rating?: number;
  difficulty?: string;
  tags: string[];
  lastCooked?: string;
  timesCooked: number;
}

function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [minRating, setMinRating] = useState<number>(0);
  const [sortBy, setSortBy] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [filteredRecipes, setFilteredRecipes] = useState<Recipe[]>([]);
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
  const tagDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadRecipes = async () => {
      const response = await fetch("/api/recipes");
      const data = await response.json();
      setRecipes(data);
      setFilteredRecipes(data);
      setIsLoading(false);
    };
    loadRecipes();
  }, []);

  const allTags = Array.from(
    new Set(recipes.flatMap(recipe => recipe.tags || []))
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(event.target as Node)) {
        setIsTagDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    let filtered = [...recipes];

    // Search by title
    if (searchQuery) {
      filtered = filtered.filter(recipe =>
        recipe.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by difficulty
    if (selectedDifficulty) {
      filtered = filtered.filter(
        recipe => recipe.difficulty === selectedDifficulty
      );
    }

    // Filter by tags
    if (selectedTags.length > 0) {
      filtered = filtered.filter(recipe =>
        selectedTags.every(tag => recipe.tags?.includes(tag))
      );
    }

    // Filter by rating
    if (minRating > 0) {
      filtered = filtered.filter(
        recipe => (recipe.rating || 0) >= minRating
      );
    }

    // Sort recipes
    if (sortBy === "most-cooked") {
      filtered = filtered.sort((a, b) => (b.timesCooked || 0) - (a.timesCooked || 0));
    } else if (sortBy === "recently-cooked") {
      filtered = filtered.sort((a, b) => {
        const aDate = a.lastCooked ? new Date(a.lastCooked).getTime() : 0;
        const bDate = b.lastCooked ? new Date(b.lastCooked).getTime() : 0;
        return bDate - aDate;
      });
    } else if (sortBy === "rating-high") {
      filtered = filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sortBy === "alphabetical") {
      filtered = filtered.sort((a, b) => a.title.localeCompare(b.title));
    }

    setFilteredRecipes(filtered);
  }, [searchQuery, selectedDifficulty, selectedTags, minRating, sortBy, recipes]);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center py-12 text-gray-700">Loading recipes...</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Recipes</h1>
          <Link 
            href="/recipes/new" 
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
          >
            New Recipe
          </Link>
        </div>
        
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {/* Search Input */}
            <div className="col-span-full md:col-span-1">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search recipes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border-2 border-gray-300 bg-white text-gray-900 placeholder-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            {/* Difficulty Dropdown */}
            <div>
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-300 bg-white text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors appearance-none cursor-pointer"
              >
                <option value="">All Difficulties</option>
                {["Easy", "Medium", "Hard"].map(difficulty => (
                  <option key={difficulty} value={difficulty}>
                    {difficulty}
                  </option>
                ))}
              </select>
            </div>

            {/* Rating Dropdown */}
            <div>
              <select
                value={minRating}
                onChange={(e) => setMinRating(Number(e.target.value))}
                className="w-full px-4 py-2 border-2 border-gray-300 bg-white text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors appearance-none cursor-pointer"
              >
                <option value={0}>All Ratings</option>
                {[1, 2, 3, 4, 5].map(rating => (
                  <option key={rating} value={rating}>
                    {rating}+ Stars
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Dropdown */}
            <div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-300 bg-white text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors appearance-none cursor-pointer"
              >
                <option value="">Default Order</option>
                <option value="most-cooked">🔥 Most Cooked</option>
                <option value="recently-cooked">⏰ Recently Cooked</option>
                <option value="rating-high">⭐ Highest Rated</option>
                <option value="alphabetical">📝 A-Z</option>
              </select>
            </div>

            {/* Tags Dropdown */}
            <div className="relative" ref={tagDropdownRef}>
              <button
                type="button"
                onClick={() => setIsTagDropdownOpen(!isTagDropdownOpen)}
                className="w-full px-4 py-2 border-2 border-gray-300 bg-white text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-left flex items-center justify-between"
              >
                <span className={selectedTags.length === 0 ? "text-gray-500" : "text-gray-900"}>
                  {selectedTags.length === 0 
                    ? "All Tags" 
                    : selectedTags.length === 1 
                      ? selectedTags[0] 
                      : `${selectedTags.length} tags selected`
                  }
                </span>
                <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${isTagDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {isTagDropdownOpen && allTags.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border-2 border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  <div className="p-2">
                    {allTags.map(tag => (
                      <label
                        key={tag}
                        className="flex items-center px-3 py-2 hover:bg-gray-50 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTags.includes(tag)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTags(prev => [...prev, tag]);
                            } else {
                              setSelectedTags(prev => prev.filter(t => t !== tag));
                            }
                          }}
                          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                        />
                        <span className="ml-3 text-gray-900">{tag}</span>
                      </label>
                    ))}
                  </div>
                  {selectedTags.length > 0 && (
                    <div className="border-t border-gray-200 p-2">
                      <button
                        onClick={() => setSelectedTags([])}
                        className="w-full px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded transition-colors"
                      >
                        Clear all tags
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Selected Tags Display */}
          {selectedTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <span className="text-sm font-medium text-gray-700 py-1">Selected tags:</span>
              {selectedTags.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800 border border-blue-200"
                >
                  {tag}
                  <button
                    onClick={() => setSelectedTags(prev => prev.filter(t => t !== tag))}
                    className="ml-2 hover:text-blue-600 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Results Summary */}
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>
              {filteredRecipes.length} recipe{filteredRecipes.length !== 1 ? 's' : ''} 
              {sortBy && sortBy !== "" && (
                <span className="ml-1">
                  • Sorted by {
                    sortBy === "most-cooked" ? "most cooked" :
                    sortBy === "recently-cooked" ? "recently cooked" :
                    sortBy === "rating-high" ? "highest rated" :
                    sortBy === "alphabetical" ? "name (A-Z)" : ""
                  }
                </span>
              )}
            </span>
            {(searchQuery || selectedDifficulty || selectedTags.length > 0 || minRating > 0) && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedDifficulty("");
                  setSelectedTags([]);
                  setMinRating(0);
                  setSortBy("");
                }}
                className="text-blue-600 hover:text-blue-800 transition-colors"
              >
                Clear all filters
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRecipes.map((recipe) => (
              <Link
                key={recipe._id}
                href={`/recipes/${recipe._id}`}
                className="bg-white rounded-xl shadow p-4 hover:shadow-md transition-shadow"
              >
                <h2 className="text-lg font-semibold text-gray-900 mb-2">{recipe.title}</h2>
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                  <span className="text-yellow-400">{"★".repeat(recipe.rating || 0)}</span>
                  {recipe.difficulty && (
                    <span className="px-2 py-0.5 bg-gray-200 text-gray-800 rounded-full font-medium">
                      {recipe.difficulty}
                    </span>
                  )}
                  {recipe.timesCooked >= 5 && (
                    <span className="px-2 py-0.5 bg-orange-100 text-orange-800 rounded-full font-medium text-xs">
                      🔥 Popular
                    </span>
                  )}
                </div>
                {recipe.tags && recipe.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {recipe.tags.map((tag: string) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 bg-gray-200 text-gray-800 rounded-full text-xs font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <div className="text-sm text-gray-500 flex items-center justify-between">
                  <div>
                    {recipe.timesCooked > 0 ? (
                      <p className="flex items-center gap-1">
                        <span>🍽️</span>
                        <span className="font-medium text-gray-700">
                          {recipe.timesCooked} time{recipe.timesCooked !== 1 ? 's' : ''}
                        </span>
                      </p>
                    ) : (
                      <p className="text-gray-400">Not cooked yet</p>
                    )}
                  </div>
                  {recipe.lastCooked && (
                    <div className="text-xs text-gray-400">
                      {(() => {
                        const days = Math.floor((Date.now() - new Date(recipe.lastCooked).getTime()) / (1000 * 60 * 60 * 24));
                        if (days === 0) return "Today";
                        if (days === 1) return "Yesterday";
                        if (days < 7) return `${days}d ago`;
                        if (days < 30) return `${Math.floor(days / 7)}w ago`;
                        return `${Math.floor(days / 30)}mo ago`;
                      })()}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {filteredRecipes.length === 0 && (
            <div className="text-center py-12 text-gray-600">
              No recipes match your filters
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default RecipesPage;
