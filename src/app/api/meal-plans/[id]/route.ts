import { getServerSession } from "next-auth";
import { client } from "@/sanity/lib/client";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { recipeId, note } = await request.json();

    // Allow clearing notes when there's a recipe, but don't allow clearing both
    if (!recipeId && note === undefined) {
      return new NextResponse("Either a recipe or a note must be provided", { status: 400 });
    }

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
    const mealPlan = await client
      .patch(params.id)
      .set({
        note: finalNote !== undefined ? finalNote : "", // Explicitly handle empty strings
        recipe: recipeId ? {
          _type: "reference",
          _ref: recipeId
        } : null, // Use null instead of undefined for clearing
      })
      .commit();

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
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    // Delete the meal plan document
    await client.delete(params.id);

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
