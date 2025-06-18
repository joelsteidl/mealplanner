import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { client } from '@/sanity/lib/client';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  console.log('Swap API - Session check:', { 
    hasSession: !!session, 
    hasUser: !!session?.user,
    hasUserId: !!session?.user?.id,
    userId: session?.user?.id 
  });

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { sourceDate, targetDate } = await request.json();

    console.log('Swap API called with:', { sourceDate, targetDate, userId: session.user.id });

    if (!sourceDate || !targetDate) {
      return NextResponse.json(
        { error: 'Source and target dates are required' },
        { status: 400 }
      );
    }

    // Get meal plans for both dates
    console.log('Fetching meal plans with queries:', {
      sourceQuery: `*[_type == "mealPlan" && date == "${sourceDate}" && user._ref == "${session.user.id}"][0]`,
      targetQuery: `*[_type == "mealPlan" && date == "${targetDate}" && user._ref == "${session.user.id}"][0]`
    });

    const [sourceMealPlan, targetMealPlan] = await Promise.all([
      client.fetch(
        `*[_type == "mealPlan" && date == $sourceDate && user._ref == $userId][0] {
          _id,
          date,
          note,
          user,
          recipe
        }`,
        { sourceDate, userId: session.user.id }
      ),
      client.fetch(
        `*[_type == "mealPlan" && date == $targetDate && user._ref == $userId][0] {
          _id,
          date,
          note,
          user,
          recipe
        }`,
        { targetDate, userId: session.user.id }
      ),
    ]);

    console.log('Found meal plans:', { 
      sourceMealPlan: sourceMealPlan ? { id: sourceMealPlan._id, date: sourceMealPlan.date } : null,
      targetMealPlan: targetMealPlan ? { id: targetMealPlan._id, date: targetMealPlan.date } : null
    });

    // Create a transaction to swap the dates
    const transaction = client.transaction();

    if (sourceMealPlan && targetMealPlan) {
      // Both days have meal plans - swap them
      console.log('Swapping both meal plans');
      transaction.patch(sourceMealPlan._id, {
        set: { date: targetDate },
      });
      transaction.patch(targetMealPlan._id, {
        set: { date: sourceDate },
      });
    } else if (sourceMealPlan && !targetMealPlan) {
      // Only source has a meal plan - move it to target
      console.log('Moving source meal plan to target');
      transaction.patch(sourceMealPlan._id, {
        set: { date: targetDate },
      });
    } else if (!sourceMealPlan && targetMealPlan) {
      // Only target has a meal plan - move it to source
      console.log('Moving target meal plan to source');
      transaction.patch(targetMealPlan._id, {
        set: { date: sourceDate },
      });
    } else {
      // Neither has a meal plan
      console.log('No meal plans found for either date');
      return NextResponse.json({ success: true, message: 'No meal plans to swap' });
    }

    console.log('Committing transaction...');
    const result = await transaction.commit();
    console.log('Transaction committed successfully:', result);

    // Add a small delay to ensure Sanity has processed the transaction
    await new Promise(resolve => setTimeout(resolve, 100));

    return NextResponse.json({ success: true }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Failed to swap meal plans:', error);
    return NextResponse.json(
      { error: 'Failed to swap meal plans' },
      { status: 500 }
    );
  }
}
