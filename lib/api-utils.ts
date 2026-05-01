import { NextResponse } from 'next/server';
import { verifyToken } from './auth';
import { readData } from './data';

export async function getActor(request: Request, data: any) {
  const authHeader = request.headers.get('authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match ? match[1] : null;

  if (!token) return null;

  const decoded = verifyToken(token);
  if (!decoded) return null;

  const user = data.users.find((candidate: any) => candidate.id === decoded.sub);
  if (!user || user.status !== 'active') return null;

  return user;
}

export function apiError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
