import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { client } from "@/sanity/lib/client";
import { RecipeForm } from "@/components/recipe/recipe-form";

interface EditRecipePageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditRecipePage({ params }: EditRecipePageProps) {
  const { id } = await params;
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  const recipe = await client.fetch(`*[_type == "recipe" && _id == $id][0]`, {
    id
  });

  if (!recipe) {
    redirect("/recipes");
  }

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white rounded-xl shadow p-6">
          <h1 className="text-2xl font-semibold mb-6">Edit Recipe</h1>
          <RecipeForm recipe={recipe} />
        </div>
      </div>
    </main>
  );
}
