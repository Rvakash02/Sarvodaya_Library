import { NextResponse } from 'next/server';
import { readData } from '@/lib/data';
import { getActor, apiError } from '@/lib/api-utils';
import { seatLayout, studentWithComputed } from '@/lib/logic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const shiftId = String(searchParams.get('shift') || 'shift-1');
    const data = await readData();
    const actor = await getActor(request, data);

    if (!actor) {
      return apiError('Authentication required', 401);
    }

    return NextResponse.json({ 
      shiftId,
      seats: seatLayout(data, shiftId),
      students: data.students.map((s: any) => studentWithComputed(data, s))
    });
  } catch (err: any) {
    return apiError(err.message || 'Server error', 500);
  }
}
