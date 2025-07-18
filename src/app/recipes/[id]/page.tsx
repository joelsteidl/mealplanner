import { RecipeDetail } from "@/components/recipe/recipe-detail";
import { client } from "@/sanity/lib/client";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Metadata } from "next";

interface Props {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const recipe = await client.fetch(
    `*[_type == "recipe" && _id == $id][0].title`,
    { id }
  );

  return {
    title: recipe ? `${recipe} | Recipe Details` : "Recipe Details",
  };
}

export default async function RecipePage({ params }: Props) {
  const { id } = await params;
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  const recipe = await client.fetch(`
    *[_type == "recipe" && _id == $id][0] {
      _id,
      _createdAt,
      title,
      sourceUrl,
      rating,
      difficulty,
      tags,
      ingredients,
      directions,
      notes,
      timesCooked,
      lastCooked
    }
  `, { id });

  if (!recipe) {
    redirect("/recipes");
  }

  return <RecipeDetail recipe={recipe} />;
}
