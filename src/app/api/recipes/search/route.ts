import { getServerSession } from "next-auth";
import { client } from "@/sanity/lib/client";
import { groq } from "next-sanity";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query) {
    return NextResponse.json([]);
  }

  // Escape the query to prevent GROQ injection
  const sanitizedQuery = query.replace(/["\\']/g, '');
  
  const recipes = await client.fetch(
    groq`*[_type == "recipe" && (
      title match "${sanitizedQuery}" + "*" ||
      title match "* " + "${sanitizedQuery}" + "*"
    )] | order(rating desc) {
      _id,
      title,
      rating,
      tags
    }[0...10]`
  );

  return NextResponse.json(recipes);
}
