import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { RecipeForm } from "@/components/recipe/recipe-form";

export default async function NewRecipePage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white rounded-xl shadow p-6">
          <h1 className="text-2xl font-semibold mb-6 text-gray-900">New Recipe</h1>
          <RecipeForm />
        </div>
      </div>
    </main>
  );
}
