import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
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

    // Create a transaction to swap the content (recipe and notes) while keeping dates
    const transaction = client.transaction();

    if (sourceMealPlan && targetMealPlan) {
      // Both days have meal plans - swap their content
      console.log('Swapping content of both meal plans');
      transaction.patch(sourceMealPlan._id, {
        set: { 
          recipe: targetMealPlan.recipe || null,
          note: targetMealPlan.note || ""
        },
      });
      transaction.patch(targetMealPlan._id, {
        set: { 
          recipe: sourceMealPlan.recipe || null,
          note: sourceMealPlan.note || ""
        },
      });
    } else if (sourceMealPlan && !targetMealPlan) {
      // Only source has a meal plan - create target with source content, clear source content
      console.log('Moving content from source to target, creating new target meal plan and clearing source');
      
      // Create new meal plan for target date with source content
      transaction.create({
        _type: 'mealPlan',
        date: targetDate,
        user: { _type: 'reference', _ref: session.user.id },
        recipe: sourceMealPlan.recipe || null,
        note: sourceMealPlan.note || ""
      });
      
      // Clear source meal plan content (but keep the meal plan with its date)
      transaction.patch(sourceMealPlan._id, {
        set: { 
          recipe: null,
          note: ""
        },
      });
      
    } else if (!sourceMealPlan && targetMealPlan) {
      // Only target has a meal plan - create source with target content, clear target content
      console.log('Moving content from target to source, creating new source meal plan and clearing target');
      
      // Create new meal plan for source date with target content
      transaction.create({
        _type: 'mealPlan',
        date: sourceDate,
        user: { _type: 'reference', _ref: session.user.id },
        recipe: targetMealPlan.recipe || null,
        note: targetMealPlan.note || ""
      });
      
      // Clear target meal plan content (but keep the meal plan with its date)
      transaction.patch(targetMealPlan._id, {
        set: { 
          recipe: null,
          note: ""
        },
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
