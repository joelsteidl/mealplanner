import { getServerSession } from "next-auth";
import { client } from "@/sanity/lib/client";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { id } = await params;
    const recipe = await client.fetch(`*[_type == "recipe" && _id == $id][0]`, {
      id,
    });

    if (!recipe) {
      return new NextResponse("Recipe not found", { status: 404 });
    }

    return NextResponse.json(recipe);
  } catch (error) {
    console.error("Error fetching recipe:", error);
    return new NextResponse(
      error instanceof Error ? error.message : "Failed to fetch recipe",
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    // Clean up empty ingredients and directions
    const ingredients = body.ingredients.filter((i: string) => i.trim());
    const directions = body.directions.filter((d: string) => d.trim());

    // Update the recipe document
    const recipe = await client
      .patch(id)
      .set({
        title: body.title,
        sourceUrl: body.sourceUrl || undefined,
        rating: body.rating || undefined,
        difficulty: body.difficulty || undefined,
        tags: body.tags || [],
        ingredients,
        directions,
        notes: body.notes || undefined,
      })
      .commit();

    return NextResponse.json(recipe);
  } catch (error) {
    console.error("Error updating recipe:", error);
    return new NextResponse(
      error instanceof Error ? error.message : "Failed to update recipe",
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { id } = await params;
    // Check if recipe exists
    const recipe = await client.fetch(`*[_type == "recipe" && _id == $id][0]`, {
      id,
    });

    if (!recipe) {
      return new NextResponse("Recipe not found", { status: 404 });
    }

    // Check if recipe is used in any meal plans
    const mealPlans = await client.fetch(
      `*[_type == "mealPlan" && references($id)][0]`,
      { id }
    );

    if (mealPlans) {
      return new NextResponse(
        "Cannot delete recipe that is used in meal plans",
        { status: 400 }
      );
    }

    // Delete the recipe
    await client.delete(id);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Error deleting recipe:", error);
    return new NextResponse(
      error instanceof Error ? error.message : "Failed to delete recipe",
      { status: 500 }
    );
  }
}
