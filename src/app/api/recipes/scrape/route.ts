import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { authOptions } from "@/lib/auth";

interface RecipeStep {
  "@type"?: string;
  text?: string;
  itemListElement?: {
    text: string;
  };
}

interface RecipeJsonLD {
  "@type": string;
  name: string;
  recipeIngredient?: string[];
  recipeInstructions?: (string | RecipeStep)[];
}

interface ScrapedRecipe {
  title: string;
  ingredients: string[];
  directions: string[];
  sourceUrl: string;
  confidence: number; // 0-100 indicating how confident we are in the scraping
}

// HTML entity decoding map
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
  '&hellip;': '…',
  '&mdash;': '—',
  '&ndash;': '–',
  '&rsquo;': '\u2019',
  '&lsquo;': '\u2018',
  '&rdquo;': '\u201D',
  '&ldquo;': '\u201C',
  '&prime;': '′',
  '&Prime;': '″',
  '&times;': '×',
  '&divide;': '÷',
  '&plusmn;': '±',
  '&sup2;': '²',
  '&sup3;': '³',
  '&frac13;': '⅓',
  '&frac23;': '⅔',
  '&frac15;': '⅕',
  '&frac25;': '⅖',
  '&frac35;': '⅗',
  '&frac45;': '⅘',
  '&frac16;': '⅙',
  '&frac56;': '⅚',
  '&frac18;': '⅛',
  '&frac38;': '⅜',
  '&frac58;': '⅝',
  '&frac78;': '⅞',
  '&minus;': '−',
  '&copy;': '©',
  '&reg;': '®',
  '&trade;': '™',
};

// Decode HTML entities
function decodeHtmlEntities(text: string): string {
  // First handle named entities (case-insensitive)
  let decoded = text;
  for (const [entity, replacement] of Object.entries(htmlEntities)) {
    decoded = decoded.replace(new RegExp(entity, 'gi'), replacement);
  }
  
  // Handle numeric entities (&#123; and &#x123;)
  decoded = decoded.replace(/&#(\d+);/g, (match, num) => {
    try {
      const code = parseInt(num, 10);
      // Only decode valid Unicode code points
      if (code >= 0 && code <= 0x10FFFF) {
        return String.fromCharCode(code);
      }
      return match;
    } catch {
      return match;
    }
  });
  
  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => {
    try {
      const code = parseInt(hex, 16);
      // Only decode valid Unicode code points
      if (code >= 0 && code <= 0x10FFFF) {
        return String.fromCharCode(code);
      }
      return match;
    } catch {
      return match;
    }
  });
  
  return decoded;
}

// Enhanced text cleaning function
function cleanText(text: string): string {
  return decodeHtmlEntities(text)
    .replace(/^▢\s*/, '') // Remove checkbox symbols (common in Cafe Delites)
    .replace(/^\d+\.\s*/, '') // Remove leading numbers with dots (e.g., "1. ")
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/[""]/g, '"') // Normalize quotes
    .replace(/['']/g, "'") // Normalize apostrophes
    .replace(/\u00a0/g, ' ') // Replace non-breaking spaces
    .trim();
}

// Validate if text looks like an ingredient
function looksLikeIngredient(text: string): boolean {
  const lower = text.toLowerCase();
  const hasNumber = /\d/.test(text);
  const hasMeasurement = /\b(cup|cups|tbsp|tsp|tablespoon|teaspoon|pound|pounds|lb|lbs|oz|ounce|ounces|gram|grams|g|ml|milliliter|liter|l|kg|kilogram|inch|inches|clove|cloves|can|cans|bottle|bottles|package|packages|bag|bags|dash|pinch|handful)\b/.test(lower);
  const hasCommonIngredients = /\b(salt|pepper|oil|butter|flour|sugar|water|milk|egg|eggs|cheese|chicken|beef|pork|fish|onion|garlic|tomato|potato|lobster|shrimp|crab|seafood|stock|broth|cream|wine|herbs|spices|thyme|tarragon|cayenne|paprika|bouillon)\b/.test(lower);
  const startsWithQuantity = /^\d+/.test(text.trim());
  
  return text.length > 2 && text.length < 200 && (hasNumber || hasMeasurement || hasCommonIngredients || startsWithQuantity);
}

// Validate if text looks like a cooking instruction
function looksLikeInstruction(text: string): boolean {
  const lower = text.toLowerCase();
  const cookingVerbs = /\b(add|mix|stir|cook|bake|boil|fry|saute|heat|preheat|combine|blend|whisk|pour|place|put|set|remove|serve|garnish|season|taste|adjust|simmer|reduce|increase|decrease|cut|chop|dice|slice|mince|fold|beat|whip)\b/.test(lower);
  const hasTemperature = /\d+\s*[°]?[fFcC]|\b(degrees|temperature)\b/.test(text);
  const hasTime = /\d+\s*(minutes?|mins?|hours?|hrs?|seconds?|secs?)\b/.test(lower);
  
  return text.length >= 10 && text.length < 1000 && (cookingVerbs || hasTemperature || hasTime);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { url } = await request.json();

    if (!url) {
      return new NextResponse("URL is required", { status: 400 });
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return new NextResponse("Invalid URL format", { status: 400 });
    }

    console.log(`Scraping recipe from: ${url}`);

    // Fetch with better headers to avoid blocking
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0',
        'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error(`This website blocks automated requests (403 Forbidden). Try copying and pasting the recipe content instead.`);
      } else if (response.status === 429) {
        throw new Error(`Too many requests to this website (429). Please try again later.`);
      } else if (response.status === 404) {
        throw new Error(`Recipe not found (404). Please check the URL.`);
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    let confidence = 0;
    const result: Partial<ScrapedRecipe> = {
      sourceUrl: url,
      ingredients: [],
      directions: [],
    };

    // Step 1: Try JSON-LD structured data (highest confidence)
    const jsonLdScripts = $('script[type="application/ld+json"]');
    for (let i = 0; i < jsonLdScripts.length; i++) {
      try {
        const jsonText = $(jsonLdScripts[i]).html();
        if (!jsonText) continue;
        
        const data = JSON.parse(jsonText);
        let recipeData: RecipeJsonLD | null = null;
        
        if (Array.isArray(data)) {
          recipeData = data.find(item => item["@type"] === "Recipe") as RecipeJsonLD;
        } else if (data["@type"] === "Recipe") {
          recipeData = data as RecipeJsonLD;
        } else if (data["@graph"]) {
          recipeData = data["@graph"].find((item: { "@type": string }) => item["@type"] === "Recipe") as RecipeJsonLD;
        }

        if (recipeData) {
          result.title = cleanText(recipeData.name);
          result.ingredients = recipeData.recipeIngredient?.map(cleanText).filter(Boolean) || [];
          result.directions = recipeData.recipeInstructions?.map((step: string | RecipeStep) => {
            if (typeof step === "string") return cleanText(step);
            return cleanText(step.text || step.itemListElement?.text || "");
          }).filter(Boolean) || [];

          confidence = 90;
          console.log("Found structured JSON-LD recipe data");
          break;
        }
      } catch (error) {
        console.log("Error parsing JSON-LD:", error);
        continue;
      }
    }

    // Step 2: Try microdata (medium-high confidence)
    if (confidence < 50) {
      const recipeName = $('[itemtype*="schema.org/Recipe"] [itemprop="name"]').first().text().trim();
      const recipeIngredients = $('[itemtype*="schema.org/Recipe"] [itemprop="recipeIngredient"]')
        .map((_, el) => cleanText($(el).text()))
        .get()
        .filter(Boolean);
      const recipeInstructions = $('[itemtype*="schema.org/Recipe"] [itemprop="recipeInstructions"]')
        .map((_, el) => cleanText($(el).text()))
        .get()
        .filter(looksLikeInstruction);

      if (recipeName && (recipeIngredients.length > 0 || recipeInstructions.length > 0)) {
        result.title = recipeName;
        result.ingredients = recipeIngredients;
        result.directions = recipeInstructions;
        confidence = 75;
        console.log("Found microdata recipe");
      }
    }

    // Step 3: Try common recipe site patterns (medium confidence)
    if (confidence < 50) {
      // Special handling for Cafe Delites narrative instructions
      const hostname = new URL(url).hostname.toLowerCase();
      if (hostname.includes('cafedelites.com')) {
        console.log("Detected Cafe Delites - looking for narrative instructions");
        
        // Look for numbered narrative instructions like "1. Pat It Dry. Rinse the pork..."
        const narrativeInstructions: string[] = [];
        
        // Try to find the section with numbered instructions
        const textContent = $.root().text();
        const lines = textContent.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          // Look for patterns like "1. Pat It Dry." or "2. Flavor Load."
          const match = line.match(/^(\d+)\.\s*(.+)/);
          if (match) {
            const stepNumber = parseInt(match[1]);
            let instruction = match[2];
            
            // Look ahead for the full instruction text
            let j = i + 1;
            while (j < lines.length && !lines[j].trim().match(/^\d+\./)) {
              const nextLine = lines[j].trim();
              if (nextLine && !nextLine.match(/^(Tips!|Note:|Notes:)/)) {
                instruction += ' ' + nextLine;
              }
              j++;
            }
            
            // Clean and validate the instruction
            instruction = cleanText(instruction);
            if (instruction.length >= 20 && looksLikeInstruction(instruction)) {
              narrativeInstructions.push(instruction);
              console.log(`Found narrative instruction ${stepNumber}: ${instruction.substring(0, 60)}...`);
            }
          }
        }
        
        if (narrativeInstructions.length >= 3) {
          result.directions = narrativeInstructions;
          confidence = Math.max(confidence, 70);
          console.log(`✓ Found ${narrativeInstructions.length} narrative instructions from Cafe Delites`);
        }
      }
      
      // Enhanced title extraction
      const titleSelectors = [
        // Cafe Delites specific selectors
        '.wprm-recipe-name',
        '.wp-recipe-maker-recipe-name',
        
        // General selectors
        'h1.recipe-title',
        'h1[class*="recipe"]',
        'h1[class*="title"]',
        '.recipe-header h1',
        '.entry-title',
        'h1',
        'meta[property="og:title"]',
        'title'
      ];

      for (const selector of titleSelectors) {
        const title = selector.includes('meta') 
          ? $(selector).attr('content')
          : $(selector).first().text().trim();
        if (title && title.length > 0) {
          result.title = cleanText(title);
          confidence = Math.max(confidence, 40);
          break;
        }
      }

      // Enhanced ingredient extraction with better selectors
      const ingredientSelectors = [
        // Cafe Delites specific selectors
        '.wprm-recipe-ingredient-group .wprm-recipe-ingredient',
        '.wprm-recipe-ingredients .wprm-recipe-ingredient',
        
        // General selectors
        '.recipe-ingredients li',
        '.ingredients-list li',
        '.ingredients li',
        '.ingredient-list li',
        '[class*="ingredient"] li',
        '[class*="recipe-ingredient"]',
        '[data-ingredient]',
        '.recipe-card .ingredients li',
        '.wprm-recipe-ingredient',
        '.tasty-recipes-ingredients li',
        '.mv-recipe-card-ingredients li',
        '.recipe-summary-ingredients li',
        'ul[class*="ingredient"] li',
        'li[class*="ingredient"]'
      ];

      for (const selector of ingredientSelectors) {
        const ingredients = $(selector)
          .map((_, el) => cleanText($(el).text()))
          .get()
          .filter(text => text.length > 0 && looksLikeIngredient(text));

        if (ingredients.length >= 3) { // Need at least 3 ingredients for confidence
          result.ingredients = ingredients;
          confidence = Math.max(confidence, 60);
          console.log(`Found ${ingredients.length} ingredients using selector: ${selector}`);
          break;
        }
      }

      // Enhanced directions extraction with more comprehensive selectors
      const directionSelectors = [
        // Cafe Delites specific selectors - try narrative steps first
        '.wprm-recipe-instruction-group .wprm-recipe-instruction',
        '.wprm-recipe-instructions .wprm-recipe-instruction',
        '.wprm-recipe-instruction .wprm-recipe-instruction-text',
        
        // Common class-based selectors
        '.recipe-directions li',
        '.recipe-steps li', 
        '.instructions li',
        '.directions li',
        '.method li',
        '.steps li',
        '.preparation li',
        '.recipe-instructions li',
        '.recipe-method li',
        '.cooking-instructions li',
        '.how-to-make li',
        
        // Wildcard class selectors
        '[class*="instruction"] li',
        '[class*="direction"] li',
        '[class*="method"] li',
        '[class*="step"] li',
        '[class*="preparation"] li',
        
        // Popular recipe plugin selectors
        '.recipe-card .instructions li',
        '.wprm-recipe-instruction',
        '.wprm-recipe-instruction-text',
        '.tasty-recipes-instructions li', 
        '.mv-recipe-card-instructions li',
        '.recipe-summary-instructions li',
        '.wp-block-recipe-card-instructions li',
        '.recipe-card-instructions li',
        '.easyrecipe-instructions li',
        '.zlrecipe-instructions li',
        '.recipe-instructions-list li',
        '.instructions-list li',
        
        // List-based selectors
        'ol[class*="instruction"] li',
        'ol[class*="direction"] li',
        'ol[class*="method"] li',
        'ol[class*="step"] li',
        'ul[class*="instruction"] li',
        'ul[class*="direction"] li',
        
        // Individual item selectors
        'li[class*="instruction"]',
        'li[class*="direction"]',
        'li[class*="method"]',
        'li[class*="step"]',
        
        // Div-based instructions (some sites use divs instead of lists)
        '.recipe-instructions div[class*="step"]',
        '.instructions div[class*="step"]',
        '.method div[class*="step"]',
        'div[class*="instruction-step"]',
        'div[class*="recipe-step"]',
        
        // Paragraph-based instructions
        '.recipe-instructions p',
        '.instructions p',
        '.method p',
        'div[class*="instruction"] p',
        
        // Ordered list without specific classes (fallback)
        '.recipe ol li',
        '.recipe-card ol li',
        '.instructions ol li'
      ];

      for (const selector of directionSelectors) {
        const directions = $(selector)
          .map((_, el) => cleanText($(el).text()))
          .get()
          .filter(text => text.length >= 10 && looksLikeInstruction(text));

        console.log(`Trying directions selector: ${selector}, found ${directions.length} directions`);
        if (directions.length > 0) {
          console.log(`Sample directions found:`, directions.slice(0, 2));
        }

        if (directions.length >= 2) { // Need at least 2 steps for confidence
          result.directions = directions;
          confidence = Math.max(confidence, 60);
          console.log(`✓ Found ${directions.length} directions using selector: ${selector}`);
          break;
        } else if (directions.length === 1 && directions[0].length >= 50) {
          // Single long instruction might be valid - store it but don't break (keep looking for better)
          if (!result.directions || result.directions.length === 0) {
            result.directions = directions;
            confidence = Math.max(confidence, 30);
            console.log(`Found 1 long direction (${directions[0].length} chars) using selector: ${selector}`);
          }
        }
      }
    }

    // Step 4: Fallback to generic patterns (low confidence)
    if (confidence < 30) {
      console.log("Attempting fallback extraction...");
      
      // Very generic ingredient detection
      const allLists = $('ul li, ol li');
      const potentialIngredients = allLists
        .map((_, el) => cleanText($(el).text()))
        .get()
        .filter(text => text.length > 0 && looksLikeIngredient(text));

      if (potentialIngredients.length >= 3) {
        result.ingredients = potentialIngredients.slice(0, 20); // Limit to first 20
        confidence = Math.max(confidence, 25);
      }

      // Very generic instruction detection - try lists first
      const potentialInstructions = allLists
        .map((_, el) => cleanText($(el).text()))
        .get()
        .filter(text => text.length >= 20 && looksLikeInstruction(text));

      if (potentialInstructions.length >= 2) {
        result.directions = potentialInstructions.slice(0, 15); // Limit to first 15
        confidence = Math.max(confidence, 25);
      } else {
        // If no list instructions found, try looking in paragraphs
        console.log("No list instructions found, trying paragraphs...");
        const paragraphs = $('p')
          .map((_, el) => cleanText($(el).text()))
          .get()
          .filter(text => text.length >= 30 && looksLikeInstruction(text));
        
        if (paragraphs.length >= 1) {
          result.directions = paragraphs.slice(0, 10); // Limit to first 10
          confidence = Math.max(confidence, 20);
          console.log(`Found ${paragraphs.length} paragraph instructions`);
        }
      }
    }

    // Validate and clean up results
    if (!result.title) {
      result.title = `Recipe from ${new URL(url).hostname}`;
    }

    // Remove duplicates and empty entries
    result.ingredients = [...new Set(result.ingredients?.filter(Boolean))];
    result.directions = [...new Set(result.directions?.filter(Boolean))];

    const finalResult: ScrapedRecipe = {
      title: result.title,
      ingredients: result.ingredients || [],
      directions: result.directions || [],
      sourceUrl: url,
      confidence
    };

    console.log(`Recipe extraction completed with ${confidence}% confidence`, {
      title: finalResult.title,
      ingredientCount: finalResult.ingredients.length,
      directionCount: finalResult.directions.length
    });

    return NextResponse.json(finalResult, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store',
      },
    });

  } catch (error) {
    console.error("Error scraping recipe:", error);
    
    // Return more detailed error information
    let errorMessage = "Failed to scrape recipe";
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorMessage = "Request timed out - the website took too long to respond";
      } else if (error.message.includes('HTTP')) {
        errorMessage = `Website returned an error: ${error.message}`;
      } else {
        errorMessage = error.message;
      }
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
