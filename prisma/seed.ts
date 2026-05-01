import { PrismaClient, UserRole, UserStatus, GenderType, MembershipStatus, FeeStatus, SeatBaseStatus, AttendanceStatus, PaymentMethod, NotificationChannel, NotificationStatus } from '@prisma/client';
import fs from 'node:fs/promises';
import path from 'node:path';

const prisma = new PrismaClient();

async function main() {
  const dataPath = path.join(process.cwd(), 'data', 'library-data.json');
  const rawData = await fs.readFile(dataPath, 'utf8');
  const data = JSON.parse(rawData);

  // 1. Create Library
  const library = await prisma.library.create({
    data: {
      name: data.meta.name,
      city: data.meta.city,
    },
  });

  console.log(`Created library: ${library.name}`);

  // 2. Create Shifts
  const shiftMap = new Map();
  for (const s of data.shifts) {
    const shift = await prisma.shift.create({
      data: {
        libraryId: library.id,
        name: s.name,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        studyHours: s.studyHours,
        capacity: s.capacity,
        color: s.color,
      },
    });
    shiftMap.set(s.id, shift.id);
  }

  // 3. Create Seats
  const seatMap = new Map();
  for (const s of data.seats) {
    const seat = await prisma.seat.create({
      data: {
        libraryId: library.id,
        seatNumber: s.number,
        zone: s.zone,
        baseStatus: s.baseStatus === 'reserved' ? SeatBaseStatus.reserved : SeatBaseStatus.available,
        notes: s.notes,
      },
    });
    seatMap.set(s.number, seat.id);
  }

  // 4. Create Students (without user link yet)
  const studentMap = new Map();
  for (const s of data.students) {
    const student = await prisma.student.create({
      data: {
        libraryId: library.id,
        studentCode: s.id, // STU-2026-0001
        fullName: s.fullName,
        photoUrl: s.photo,
        fatherName: s.fatherName,
        gender: s.gender as GenderType,
        dob: s.dob ? new Date(s.dob) : null,
        mobile: s.mobile,
        email: s.email,
        address: s.address,
        examTrack: s.examTrack,
        dateJoined: new Date(s.dateJoined),
        expiryDate: new Date(s.expiryDate),
        membershipStatus: s.membershipStatus as MembershipStatus,
        shiftId: shiftMap.get(s.selectedShift),
        seatId: seatMap.get(s.seatNumber),
        studyHours: s.studyHours,
        monthlyFees: s.monthlyFees,
        paidAmount: s.paidAmount,
        pendingAmount: s.pendingAmount,
        dueDate: new Date(s.dueDate),
        feeStatus: s.feeStatus as FeeStatus,
        qrSecret: s.qrToken,
        notes: s.notes,
      },
    });
    studentMap.set(s.id, student.id);
  }

  // 5. Create Users
  for (const u of data.users) {
    await prisma.user.create({
      data: {
        libraryId: library.id,
        name: u.name,
        email: u.email,
        mobile: u.mobile,
        role: u.role as UserRole,
        status: u.status as UserStatus,
        passwordHash: u.passwordHash,
        passwordSalt: u.salt,
        studentId: u.studentId ? studentMap.get(u.studentId) : null,
      },
    });
  }

  // 6. Create Payments
  for (const p of data.payments) {
    await prisma.payment.create({
      data: {
        libraryId: library.id,
        studentId: studentMap.get(p.studentId),
        receiptNumber: p.receiptNumber,
        amount: p.amount,
        method: p.method.replace(' ', '_') as PaymentMethod, // UPI, Cash, etc.
        billingMonth: p.month,
        paidAt: new Date(p.paidAt),
        status: p.status,
        notes: p.notes,
      },
    });
  }

  // 7. Create Attendance
  for (const a of data.attendance) {
    await prisma.attendanceLog.create({
      data: {
        libraryId: library.id,
        studentId: studentMap.get(a.studentId),
        attendanceDate: new Date(a.date),
        checkInAt: a.checkIn ? new Date(a.checkIn) : null,
        checkOutAt: a.checkOut ? new Date(a.checkOut) : null,
        source: a.source,
        status: a.status as AttendanceStatus,
      },
    });
  }

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
