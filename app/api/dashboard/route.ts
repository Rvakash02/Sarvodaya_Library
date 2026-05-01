import { NextResponse } from 'next/server';
import { readData } from '@/lib/data';
import { getActor, apiError } from '@/lib/api-utils';
import { dashboardSummary } from '@/lib/logic';

export async function GET(request: Request) {
  try {
    const data = await readData();
    const actor = await getActor(request, data);

    if (!actor) {
      return apiError('Authentication required', 401);
    }

    if (!['super_admin', 'staff'].includes(actor.role)) {
      return apiError('Permission denied', 403);
    }

    return NextResponse.json(dashboardSummary(data));
  } catch (err: any) {
    return apiError(err.message || 'Server error', 500);
  }
}
