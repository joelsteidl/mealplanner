import { getServerSession } from "next-auth";
import { client } from "@/sanity/lib/client";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

interface MealPlanResponse {
  _id: string;
  date: string;
  note?: string;
  recipe?: {
    _id: string;
    title: string;
    rating: number;
  };
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!startDate || !endDate) {
      return new NextResponse("Start and end dates are required", { status: 400 });
    }

    const mealPlans: MealPlanResponse[] = await client.fetch(`
      *[_type == "mealPlan" && date >= $startDate && date <= $endDate && user._ref == $userId] {
        _id,
        date,
        note,
        "recipe": recipe-> {
          _id,
          title,
          rating
        }
      }
    `, { startDate, endDate, userId: session.user.id });

    console.log('Meal plans fetched for user:', {
      userId: session.user.id,
      startDate,
      endDate,
      count: mealPlans.length,
      plans: mealPlans.map((p: MealPlanResponse) => ({ id: p._id, date: p.date }))
    });

    return NextResponse.json(mealPlans, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error("Error fetching meal plans:", error);
    return new NextResponse("Error fetching meal plans", { status: 500 });
  }
}
