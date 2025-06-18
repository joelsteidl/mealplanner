import { AddMealForm } from "@/components/meal-plan/add-meal-form";
import { client } from "@/sanity/lib/client";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

interface Props {
  params: {
    id: string;
  };
}

export default async function EditMealPlan({ params }: Props) {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  const mealPlan = await client.fetch(`
    *[_type == "mealPlan" && _id == $id][0] {
      _id,
      date,
      note,
      "recipe": recipe-> {
        _id,
        title,
        rating
      }
    }
  `, { id: params.id });

  if (!mealPlan) {
    redirect("/");
  }

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        <AddMealForm initialMealPlan={mealPlan} />
      </div>
    </main>
  );
}
