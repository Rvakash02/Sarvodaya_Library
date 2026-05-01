import { NextResponse } from 'next/server';
import { readData, writeData, studentId, isoDate, isoDateTime, parseAmount } from '@/lib/data';
import { getActor, apiError } from '@/lib/api-utils';
import { queryStudents } from '@/lib/logic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const data = await readData();
    const actor = await getActor(request, data);

    if (!actor) {
      return apiError('Authentication required', 401);
    }

    if (!['super_admin', 'staff'].includes(actor.role)) {
      return apiError('Permission denied', 403);
    }

    return NextResponse.json({ students: queryStudents(data, searchParams) });
  } catch (err: any) {
    return apiError(err.message || 'Server error', 500);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = await readData();
    const actor = await getActor(request, data);

    if (!actor || !['super_admin', 'staff'].includes(actor.role)) {
      return apiError('Permission denied', 403);
    }

    const id = studentId(data.meta.nextStudentNumber);
    data.meta.nextStudentNumber += 1;

    const newStudent = {
      id,
      photo: body.photo || `data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" rx="32" fill="#f8fafc"/><rect x="14" y="14" width="132" height="132" rx="26" fill="#0f766e"/><circle cx="80" cy="58" r="25" fill="#fff" opacity=".9"/><path d="M38 133c7-25 23-39 42-39s35 14 42 39" fill="#fff" opacity=".88"/><text x="80" y="88" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" font-weight="700" fill="#0f766e">ST</text></svg>')}`,
      fullName: String(body.fullName).trim(),
      mobile: String(body.mobile).trim(),
      email: body.email || '',
      dateJoined: body.dateJoined || isoDate(),
      expiryDate: body.expiryDate || isoDate(),
      membershipStatus: 'active',
      selectedShift: body.selectedShift || 'shift-1',
      seatNumber: String(body.seatNumber || 'A01').toUpperCase(),
      monthlyFees: parseAmount(body.monthlyFees),
      paidAmount: parseAmount(body.paidAmount),
      pendingAmount: parseAmount(body.monthlyFees) - parseAmount(body.paidAmount),
      dueDate: body.dueDate || isoDate(),
      feeStatus: 'pending',
      qrToken: `LIB-QR-${id}-${Math.random().toString(36).substring(7)}`,
      createdAt: isoDateTime(),
      updatedAt: isoDateTime()
    };

    data.students.push(newStudent);
    await writeData(data);

    return NextResponse.json({ student: newStudent }, { status: 201 });
  } catch (err: any) {
    return apiError(err.message || 'Server error', 500);
  }
}
