import { AddMealForm } from "@/components/meal-plan/add-meal-form";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

interface PageProps {
  searchParams: { date?: string };
}

export default async function AddMealPage({ searchParams }: PageProps) {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  const date = searchParams.date ? new Date(searchParams.date) : new Date();

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white rounded-xl shadow p-6">
          <AddMealForm date={date} />
        </div>
      </div>
    </main>
  );
}
