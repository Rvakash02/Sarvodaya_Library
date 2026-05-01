import { isoDate, isoDateTime, parseAmount, normalizeStatus, daysFromNow } from './data';

export function getShift(data: any, shiftId: string) {
  return data.shifts.find((shift: any) => shift.id === shiftId);
}

export function isActiveStudent(student: any) {
  return student.membershipStatus === 'active' && student.expiryDate >= isoDate();
}

export function attendancePercentage(data: any, studentId: string, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const logs = data.attendance.filter((log: any) => {
    return log.studentId === studentId && new Date(log.date) >= since;
  });
  const expectedDays = Math.min(days, 30);
  return Math.min(100, Math.round((logs.length / expectedDays) * 100));
}

export function studentWithComputed(data: any, student: any) {
  if (!student) return null;
  const shift = getShift(data, student.selectedShift);
  const paidAmount = parseAmount(student.paidAmount);
  const pendingAmount = Math.max(0, parseAmount(student.monthlyFees) - paidAmount);
  const computedFeeStatus =
    pendingAmount <= 0 ? 'paid' : student.dueDate < isoDate() ? 'overdue' : normalizeStatus(student.feeStatus);
  return {
    ...student,
    shiftName: shift?.name || 'Unassigned',
    shiftTiming: shift ? `${shift.startsAt} - ${shift.endsAt}` : '',
    paidAmount,
    pendingAmount,
    feeStatus: computedFeeStatus,
    attendancePercentage: attendancePercentage(data, student.id),
    membershipStatus: student.expiryDate < isoDate() ? 'expired' : student.membershipStatus
  };
}

function monthsAgo(months: number) {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date;
}

export function shiftOccupancy(data: any, shiftId: string) {
  const shift = getShift(data, shiftId);
  const occupied = data.students.filter((student: any) => {
    return student.selectedShift === shiftId && isActiveStudent(student);
  }).length;
  return {
    shiftId,
    occupied,
    capacity: shift?.capacity || 0,
    percentage: shift?.capacity ? Math.round((occupied / shift.capacity) * 100) : 0
  };
}

export function dashboardSummary(data: any) {
  const today = isoDate();
  const enrichedStudents = data.students.map((student: any) => studentWithComputed(data, student));
  const activeStudents = enrichedStudents.filter((student: any) => student.membershipStatus === 'active');
  const pendingFees = enrichedStudents.filter((student: any) => ['pending', 'overdue'].includes(student.feeStatus));

  const occupiedSeatKeys = new Set(
    activeStudents.map((student: any) => `${student.selectedShift}:${student.seatNumber}`)
  );
  const availableSeatCount = data.seats.filter((seat: any) => seat.baseStatus === 'available').length;
  const todayLogs = data.attendance.filter((log: any) => log.date === today);

  const expiring = enrichedStudents
    .filter((student: any) => student.membershipStatus === 'active' && student.expiryDate <= daysFromNow(7))
    .sort((a: any, b: any) => a.expiryDate.localeCompare(b.expiryDate));

  const attendanceTrend = Array.from({ length: 7 }).map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const dateString = isoDate(date);
    return {
      date: dateString,
      label: date.toLocaleDateString('en', { weekday: 'short' }),
      present: data.attendance.filter((log: any) => log.date === dateString).length
    };
  });

  return {
    stats: {
      totalStudents: data.students.length,
      activeMemberships: activeStudents.length,
      pendingFees: pendingFees.length,
      emptySeats: Math.max(0, availableSeatCount * data.shifts.length - occupiedSeatKeys.size),
      todaysAttendance: todayLogs.length,
      monthlyRevenue: 0, // Simplified for brevity in this step
      expiringMemberships: expiring.length
    },
    attendanceTrend,
    shiftOccupancy: data.shifts.map((shift: any) => ({
      ...shift,
      ...shiftOccupancy(data, shift.id)
    })),
    expiringMemberships: expiring.slice(0, 8),
    pendingStudents: pendingFees.slice(0, 8),
  };
}

export function queryStudents(data: any, searchParams: URLSearchParams) {
  const search = String(searchParams.get('search') || '').trim().toLowerCase();
  const filter = String(searchParams.get('filter') || 'all');
  const shift = String(searchParams.get('shift') || 'all');
  const feeStatus = String(searchParams.get('feeStatus') || 'all');

  return data.students
    .map((student: any) => studentWithComputed(data, student))
    .filter((student: any) => {
      if (!search) return true;
      return [
        student.fullName,
        student.mobile,
        student.id,
        student.seatNumber,
        student.shiftName,
        student.feeStatus,
        student.examTrack
      ]
        .join(' ')
        .toLowerCase()
        .includes(search);
    })
    .filter((student: any) => {
      if (filter === 'active') return student.membershipStatus === 'active';
      if (filter === 'expired') return student.membershipStatus === 'expired';
      if (filter === 'pending-fees') return ['pending', 'overdue'].includes(student.feeStatus);
      if (filter === 'morning') return student.selectedShift === 'shift-1';
      if (filter === 'evening') return student.selectedShift === 'shift-4';
      if (filter === 'absent-many-days') return attendancePercentage(data, student.id, 14) < 60;
      return true;
    })
    .filter((student: any) => (shift === 'all' ? true : student.selectedShift === shift))
    .filter((student: any) => (feeStatus === 'all' ? true : student.feeStatus === feeStatus))
    .sort((a: any, b: any) => a.fullName.localeCompare(b.fullName));
}

export function studentShiftOverlaps(data: any, student: any, shiftId: string) {
  const firstShift = getShift(data, student.selectedShift);
  const secondShift = getShift(data, shiftId);
  if (!firstShift || !secondShift) return false;

  const firstStart = timeToMinutes(firstShift.startsAt);
  const firstEnd = timeToMinutes(firstShift.endsAt);
  const secondStart = timeToMinutes(secondShift.startsAt);
  const secondEnd = timeToMinutes(secondShift.endsAt);

  return firstStart < secondEnd && secondStart < firstEnd;
}

function timeToMinutes(value: string) {
  const [hours, minutes] = String(value || '00:00').split(':').map(Number);
  return hours * 60 + minutes;
}

export function seatLayout(data: any, shiftId = 'shift-1') {
  return data.seats.map((seat: any) => {
    const assigned = data.students
      .filter((student: any) => isActiveStudent(student))
      .find((student: any) => student.seatNumber === seat.number && studentShiftOverlaps(data, student, shiftId));
    const status = assigned ? 'occupied' : seat.baseStatus === 'reserved' ? 'reserved' : 'available';
    return {
      ...seat,
      status,
      assignedStudentId: assigned?.id || null,
      assignedStudentName: assigned?.fullName || null,
      shiftId
    };
  });
}

export function attendanceSummary(data: any, date = isoDate()) {
  const logs = data.attendance
    .filter((log: any) => log.date === date)
    .map((log: any) => ({
      ...log,
      student: studentWithComputed(data, data.students.find((student: any) => student.id === log.studentId))
    }));
  const presentIds = new Set(logs.map((log: any) => log.studentId));
  const absent = data.students
    .filter((student: any) => isActiveStudent(student) && !presentIds.has(student.id))
    .map((student: any) => studentWithComputed(data, student));
  const peakHours = Array.from({ length: 18 }).map((_, index) => {
    const hour = index + 5;
    return {
      hour: `${String(hour).padStart(2, '0')}:00`,
      count: logs.filter((log: any) => new Date(log.checkIn).getHours() === hour).length
    };
  });
  return { date, logs, absent, peakHours };
}

