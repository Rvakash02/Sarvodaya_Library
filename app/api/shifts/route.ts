import { NextResponse } from 'next/server';
import { readData, writeData, parseAmount } from '@/lib/data';
import { getActor, apiError } from '@/lib/api-utils';
import { shiftOccupancy } from '@/lib/logic';

export async function GET(request: Request) {
  try {
    const data = await readData();
    const actor = await getActor(request, data);

    if (!actor) {
      return apiError('Authentication required', 401);
    }

    return NextResponse.json({ 
      shifts: data.shifts.map((shift: any) => ({
        ...shift,
        ...shiftOccupancy(data, shift.id)
      }))
    });
  } catch (err: any) {
    return apiError(err.message || 'Server error', 500);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = await readData();
    const actor = await getActor(request, data);

    if (!actor || actor.role !== 'super_admin') {
      return apiError('Permission denied', 403);
    }

    const shift = {
      id: `shift-${Date.now()}`,
      name: String(body.name || 'New Shift').trim(),
      startsAt: String(body.startsAt || '06:00'),
      endsAt: String(body.endsAt || '10:00'),
      studyHours: parseAmount(body.studyHours),
      capacity: parseAmount(body.capacity),
      color: String(body.color || '#0f766e')
    };

    data.shifts.push(shift);
    await writeData(data);

    return NextResponse.json({ shift }, { status: 201 });
  } catch (err: any) {
    return apiError(err.message || 'Server error', 500);
  }
}
