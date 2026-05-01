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

    const student = actor.studentId
      ? studentWithComputed(data, data.students.find((candidate: any) => candidate.id === actor.studentId))
      : null;

    const { passwordHash, salt, ...safeUser } = actor;

    return NextResponse.json({ user: safeUser, student });
  } catch (err: any) {
    return apiError(err.message || 'Server error', 500);
  }
}
