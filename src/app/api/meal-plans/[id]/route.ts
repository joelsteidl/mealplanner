import { getServerSession } from "next-auth";
import { client } from "@/sanity/lib/client";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { id } = await params;
    const { recipeId, note } = await request.json();

    // Allow clearing notes when there's a recipe, but don't allow clearing both
    if (!recipeId && note === undefined) {
      return new NextResponse("Either a recipe or a note must be provided", { status: 400 });
    }

    // Get the current meal plan to check for existing recipe
    const currentMealPlan = await client.fetch(
      `*[_type == "mealPlan" && _id == $id][0] { recipe }`,
      { id }
    );

    const previousRecipeId = currentMealPlan?.recipe?._ref;

    // If a recipe is selected and no note is provided, fetch recipe notes to use as default
    let finalNote = note !== undefined ? note?.trim() || "" : undefined;
    if (recipeId && finalNote === undefined) {
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

    // Update the meal plan document
    const updateData: {
      note?: string;
      recipe?: { _type: string; _ref: string } | null;
    } = {};

    // Always update the note if provided
    if (note !== undefined) {
      updateData.note = finalNote !== undefined ? finalNote : "";
    }

    // Only update recipe if a recipeId is explicitly provided (including null to clear)
    if (recipeId !== undefined) {
      updateData.recipe = recipeId ? {
        _type: "reference",
        _ref: recipeId
      } : null;
    }

    const mealPlan = await client
      .patch(id)
      .set(updateData)
      .commit();

    // Handle recipe count updates
    if (previousRecipeId && previousRecipeId !== recipeId) {
      // Recipe was removed or changed - decrement the old recipe's count
      try {
        await client
          .patch(previousRecipeId)
          .dec({ timesCooked: 1 })
          .commit();
        console.log(`Decremented timesCooked for removed recipe: ${previousRecipeId}`);
      } catch (error) {
        console.error("Error decrementing previous recipe count:", error);
        // Don't fail the request if this fails
      }
    }

    if (recipeId && recipeId !== previousRecipeId) {
      // New recipe was added - increment the new recipe's count and update cook history
      try {
        const now = new Date().toISOString();
        await client
          .patch(recipeId)
          .set({ lastCooked: now })
          .setIfMissing({ cookHistory: [] })
          .append("cookHistory", [now])
          .inc({ timesCooked: 1 })
          .commit();
        console.log(`Incremented timesCooked for new recipe: ${recipeId}`);
      } catch (error) {
        console.error("Error incrementing new recipe count:", error);
        // Don't fail the request if this fails
      }
    }

    return NextResponse.json(mealPlan, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error("Error updating meal plan:", error);
    if (error instanceof Error) {
      return new NextResponse(error.message, { status: 500 });
    }
    return new NextResponse("Error updating meal plan", { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { id } = await params;
    // Get the meal plan before deleting to check if it has a recipe
    const mealPlan = await client.fetch(
      `*[_type == "mealPlan" && _id == $id][0] { recipe }`,
      { id }
    );

    if (!mealPlan) {
      return new NextResponse("Meal plan not found", { status: 404 });
    }

    const recipeId = mealPlan.recipe?._ref;

    // Delete the meal plan document
    await client.delete(id);

    // If the meal plan had a recipe, decrement its count
    if (recipeId) {
      try {
        await client
          .patch(recipeId)
          .dec({ timesCooked: 1 })
          .commit();
        console.log(`Decremented timesCooked for deleted meal plan recipe: ${recipeId}`);
      } catch (error) {
        console.error("Error decrementing recipe count after meal plan deletion:", error);
        // Don't fail the request if this fails - the meal plan is already deleted
      }
    }

    return NextResponse.json({ success: true }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error("Error deleting meal plan:", error);
    if (error instanceof Error) {
      return new NextResponse(error.message, { status: 500 });
    }
    return new NextResponse("Error deleting meal plan", { status: 500 });
  }
}
