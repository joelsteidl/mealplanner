import { getServerSession } from "next-auth";
import { client } from "@/sanity/lib/client";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession();

  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const recipes = await client.fetch(`*[_type == "recipe"] | order(title asc) {
      _id,
      title,
      rating,
      difficulty,
      tags,
      lastCooked,
      timesCooked
    }`);

    return NextResponse.json(recipes);
  } catch (error) {
    console.error("Error fetching recipes:", error);
    return new NextResponse(
      error instanceof Error ? error.message : "Failed to fetch recipes",
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await getServerSession();

  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const body = await request.json();

    // Validate required fields
    if (!body.title) {
      return new NextResponse("Title is required", { status: 400 });
    }

    if (!Array.isArray(body.ingredients) || !Array.isArray(body.directions)) {
      return new NextResponse("Invalid ingredients or directions format", { status: 400 });
    }

    // Clean up empty ingredients and directions
    const ingredients = body.ingredients.filter((i: string) => i.trim());
    const directions = body.directions.filter((d: string) => d.trim());

    if (ingredients.length === 0 || directions.length === 0) {
      return new NextResponse("At least one ingredient and one direction is required", { status: 400 });
    }

    // Create the recipe document
    const recipe = await client.create({
      _type: "recipe",
      title: body.title.trim(),
      sourceUrl: body.sourceUrl ? body.sourceUrl.trim() : undefined,
      rating: typeof body.rating === 'number' ? body.rating : undefined,
      difficulty: body.difficulty || undefined,
      tags: Array.isArray(body.tags) ? body.tags : [],
      ingredients,
      directions,
      notes: body.notes ? body.notes.trim() : undefined,
      timesCooked: 0,
      createdBy: {
        _type: "reference",
        _ref: session.user.id
      }
    });

    return NextResponse.json(recipe);
  } catch (error) {
    console.error("Error creating recipe:", error);
    
    // Check for specific Sanity errors
    if (error instanceof Error) {
      if (error.message.includes("uniqueness constraint")) {
        return new NextResponse("A recipe with this title already exists", { status: 409 });
      }
      return new NextResponse(error.message, { status: 500 });
    }
    
    return new NextResponse("Failed to create recipe", { status: 500 });
  }
}
