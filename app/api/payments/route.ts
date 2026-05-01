import { NextResponse } from 'next/server';
import { readData } from '@/lib/data';
import { getActor, apiError } from '@/lib/api-utils';
import { studentWithComputed } from '@/lib/logic';

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

    const payments = data.payments
      .map((payment: any) => ({
        ...payment,
        student: studentWithComputed(data, data.students.find((s: any) => s.id === payment.studentId))
      }))
      .reverse();

    return NextResponse.json({ payments });
  } catch (err: any) {
    return apiError(err.message || 'Server error', 500);
  }
}
