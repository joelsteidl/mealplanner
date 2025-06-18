import { getServerSession } from "next-auth";
import { client } from "@/sanity/lib/client";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { date, recipeId, note } = await request.json();
    console.log('POST meal-plan request:', { date, recipeId, note });

    if (!date) {
      console.log('Validation error: Date is required');
      return new NextResponse("Date is required", { status: 400 });
    }

    if (!recipeId && !note?.trim()) {
      console.log('Validation error: Either a recipe or a note must be provided');
      return new NextResponse("Either a recipe or a note must be provided", { status: 400 });
    }

    // If a recipe is selected and no note is provided, fetch recipe notes to use as default
    let finalNote = note?.trim();
    if (recipeId && !finalNote) {
      try {
        const recipe = await client.fetch(
          `*[_type == "recipe" && _id == $recipeId][0] { notes }`,
          { recipeId }
        );
        if (recipe?.notes) {
          finalNote = recipe.notes;
        }
      } catch (error) {
        console.error("Error fetching recipe notes:", error);
        // Continue without notes if there's an error
      }
    }

    // Create the meal plan document
    const finalDate = typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/) 
      ? date // If already in YYYY-MM-DD format, use as-is
      : new Date(date).toISOString().split('T')[0]; // Otherwise convert
    
    console.log('Creating meal plan with:', { 
      date: finalDate, 
      note: finalNote, 
      recipeId 
    });
    
    const mealPlan = await client.create({
      _type: "mealPlan",
      date: finalDate,
      note: finalNote || undefined,
      recipe: recipeId ? {
        _type: "reference",
        _ref: recipeId
      } : undefined,
      user: {
        _type: "reference",
        _ref: session.user.id
      }
    });

    // If a recipe was selected, update its lastCooked date and cookHistory
    if (recipeId) {
      const now = new Date().toISOString();
      await client
        .patch(recipeId)
        .set({
          lastCooked: now
        })
        .setIfMissing({ cookHistory: [] })
        .append("cookHistory", [now])
        .inc({ timesCooked: 1 })
        .commit();
    }

    console.log('Meal plan created successfully:', mealPlan);
    
    return NextResponse.json(mealPlan, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error("Error creating meal plan:", error);
    if (error instanceof Error) {
      return new NextResponse(error.message, { status: 500 });
    }
    return new NextResponse("Error creating meal plan", { status: 500 });
  }
}
