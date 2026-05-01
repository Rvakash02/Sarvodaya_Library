import { NextResponse } from 'next/server';
import { readData, writeData, isoDateTime } from '@/lib/data';
import { comparePassword, createToken } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = await readData();

    const identifier = String(body.identifier || '').trim().toLowerCase();
    const password = String(body.password || '');

    const user = data.users.find((candidate: any) => {
      return (
        candidate.status === 'active' &&
        [candidate.email, candidate.mobile]
          .filter(Boolean)
          .map((value) => value.toLowerCase())
          .includes(identifier)
      );
    });

    if (!user || !comparePassword(password, user)) {
      return NextResponse.json({ error: 'Invalid email/mobile or password' }, { status: 401 });
    }

    user.lastLoginAt = isoDateTime();
    await writeData(data);

    const { passwordHash, salt, ...safeUser } = user;

    return NextResponse.json({
      token: createToken(user),
      user: safeUser,
      expiresInMinutes: 480, // Original TOKEN_TTL_MS is 8 hours
      inactivityLogoutMinutes: data.meta.inactivityLogoutMinutes
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
