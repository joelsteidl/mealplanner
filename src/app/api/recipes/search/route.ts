import { getServerSession } from "next-auth";
import { client } from "@/sanity/lib/client";
import { groq } from "next-sanity";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await getServerSession();

  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query) {
    return NextResponse.json([]);
  }

  const recipes = await client.fetch(
    groq`*[_type == "recipe" && (
      title match $query + "*" ||
      title match "* " + $query + "*"
    )] | order(rating desc) {
      _id,
      title,
      rating,
      tags
    }[0...10]`,
    { query }
  );

  return NextResponse.json(recipes);
}
