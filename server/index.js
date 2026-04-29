import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const dataDir = path.join(rootDir, 'data');
const dataFile = path.join(dataDir, 'library-data.json');
const backupsDir = path.join(dataDir, 'backups');

const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || '127.0.0.1';
const TOKEN_SECRET =
  process.env.AUTH_SECRET ||
  'local-dev-secret-change-before-production-competitive-exam-library';
const TOKEN_TTL_MS = 1000 * 60 * 60 * 8;
const PASSWORD_ITERATIONS = 160000;
const PASSWORD_KEYLEN = 64;
const PASSWORD_DIGEST = 'sha512';

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

const securityHeaders = {
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cache-Control': 'no-store'
};

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function fromBase64url(input) {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf8');
}

function sign(value) {
  return base64url(
    crypto.createHmac('sha256', TOKEN_SECRET).update(value).digest()
  );
}

function createToken(user) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64url(
    JSON.stringify({
      sub: user.id,
      role: user.role,
      name: user.name,
      studentId: user.studentId || null,
      iat: Date.now(),
      exp: Date.now() + TOKEN_TTL_MS
    })
  );
  const signature = sign(`${header}.${payload}`);
  return `${header}.${payload}.${signature}`;
}

function verifyToken(token) {
  const [header, payload, signature] = String(token || '').split('.');
  if (!header || !payload || !signature) return null;
  const expected = sign(`${header}.${payload}`);
  if (signature.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }
  const decoded = JSON.parse(fromBase64url(payload));
  if (!decoded.exp || decoded.exp < Date.now()) return null;
  return decoded;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto
    .pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, PASSWORD_KEYLEN, PASSWORD_DIGEST)
    .toString('hex');
  return { salt, passwordHash: hash };
}

function comparePassword(password, user) {
  if (!user?.salt || !user?.passwordHash) return false;
  const attempt = hashPassword(password, user.salt).passwordHash;
  return crypto.timingSafeEqual(Buffer.from(attempt), Buffer.from(user.passwordHash));
}

function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, salt, ...safe } = user;
  return safe;
}

function isoDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function isoDateTime(date = new Date()) {
  return date.toISOString();
}

function daysFromNow(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return isoDate(date);
}

function monthsAgo(months) {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date;
}

function receiptNumber() {
  return `RCP-${new Date().getFullYear()}-${crypto.randomInt(100000, 999999)}`;
}

function slugEmail(name, domain = 'student.local') {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/(^\.|\.$)/g, '')}@${domain}`;
}

function studentId(nextNumber) {
  return `STU-${new Date().getFullYear()}-${String(nextNumber).padStart(4, '0')}`;
}

function avatarDataUri(name, accent = '#0f766e') {
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" rx="32" fill="#f8fafc"/><rect x="14" y="14" width="132" height="132" rx="26" fill="${accent}"/><circle cx="80" cy="58" r="25" fill="#fff" opacity=".9"/><path d="M38 133c7-25 23-39 42-39s35 14 42 39" fill="#fff" opacity=".88"/><text x="80" y="88" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" font-weight="700" fill="${accent}">${initials}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function parseAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
}

function normalizeStatus(value) {
  const status = String(value || '').toLowerCase();
  if (['paid', 'pending', 'overdue'].includes(status)) return status;
  return 'pending';
}

async function ensureDataDir() {
  await fs.mkdir(dataDir, { recursive: true });
}

async function readData() {
  await ensureDataDir();
  if (!fsSync.existsSync(dataFile)) {
    const data = seedData();
    await writeData(data);
    return data;
  }
  const raw = await fs.readFile(dataFile, 'utf8');
  return JSON.parse(raw);
}

async function writeData(data) {
  await ensureDataDir();
  data.meta.updatedAt = isoDateTime();
  const tmp = `${dataFile}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2));
  await fs.rename(tmp, dataFile);
}

async function createBackup(data) {
  await fs.mkdir(backupsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupsDir, `library-data-${stamp}.json`);
  await fs.writeFile(backupPath, JSON.stringify(data, null, 2));
  return backupPath;
}

function seedData() {
  const now = isoDateTime();
  const adminPass = hashPassword('Admin@12345');
  const staffPass = hashPassword('Staff@12345');
  const studentPass = hashPassword('Student@123');
  const shifts = [
    { id: 'shift-1', name: 'Morning Focus', startsAt: '06:00', endsAt: '10:00', studyHours: 4, capacity: 48, color: '#14b8a6' },
    { id: 'shift-2', name: 'Late Morning', startsAt: '10:00', endsAt: '14:00', studyHours: 4, capacity: 48, color: '#2563eb' },
    { id: 'shift-3', name: 'Afternoon Deep Work', startsAt: '14:00', endsAt: '18:00', studyHours: 4, capacity: 48, color: '#7c3aed' },
    { id: 'shift-4', name: 'Evening Revision', startsAt: '18:00', endsAt: '22:00', studyHours: 4, capacity: 48, color: '#f97316' },
    { id: 'shift-5', name: 'Combined 10 AM - 6 PM', startsAt: '10:00', endsAt: '18:00', studyHours: 8, capacity: 32, color: '#0f766e' },
    { id: 'shift-6', name: 'Full Day', startsAt: '06:00', endsAt: '22:00', studyHours: 16, capacity: 24, color: '#111827' }
  ];

  const seats = [];
  for (const row of ['A', 'B', 'C', 'D', 'E', 'F']) {
    for (let number = 1; number <= 10; number += 1) {
      const seatNumber = `${row}${String(number).padStart(2, '0')}`;
      seats.push({
        number: seatNumber,
        zone: ['A', 'B'].includes(row) ? 'Quiet Hall' : ['C', 'D'].includes(row) ? 'Window Wing' : 'Premium Cabin',
        baseStatus: ['A10', 'C05', 'F02'].includes(seatNumber) ? 'reserved' : 'available',
        notes: ['A10', 'C05', 'F02'].includes(seatNumber) ? 'Owner reserved' : '',
        history: []
      });
    }
  }

  const students = [
    {
      fullName: 'Aarav Sharma',
      fatherName: 'Mahesh Sharma',
      gender: 'Male',
      dob: '2002-08-14',
      mobile: '9876501001',
      email: 'aarav@examdesk.local',
      address: 'Rajendra Nagar, New Delhi',
      examTrack: 'UPSC CSE',
      shiftId: 'shift-6',
      seatNumber: 'A01',
      monthlyFees: 5200,
      paidAmount: 5200,
      feeStatus: 'paid',
      dueOffset: 16,
      joinedOffset: -90,
      expiryOffset: 16,
      accent: '#0f766e'
    },
    {
      fullName: 'Priya Verma',
      fatherName: 'Suresh Verma',
      gender: 'Female',
      dob: '2003-02-20',
      mobile: '9876501002',
      email: 'priya@examdesk.local',
      address: 'Mukherjee Nagar, New Delhi',
      examTrack: 'SSC CGL',
      shiftId: 'shift-1',
      seatNumber: 'A02',
      monthlyFees: 2200,
      paidAmount: 1600,
      feeStatus: 'pending',
      dueOffset: 3,
      joinedOffset: -44,
      expiryOffset: 3,
      accent: '#2563eb'
    },
    {
      fullName: 'Kabir Khan',
      fatherName: 'Rizwan Khan',
      gender: 'Male',
      dob: '2001-11-03',
      mobile: '9876501003',
      email: 'kabir@examdesk.local',
      address: 'Kankarbagh, Patna',
      examTrack: 'Banking',
      shiftId: 'shift-2',
      seatNumber: 'B04',
      monthlyFees: 2400,
      paidAmount: 0,
      feeStatus: 'overdue',
      dueOffset: -6,
      joinedOffset: -130,
      expiryOffset: -6,
      accent: '#dc2626'
    },
    {
      fullName: 'Sneha Iyer',
      fatherName: 'Raman Iyer',
      gender: 'Female',
      dob: '2004-04-11',
      mobile: '9876501004',
      email: 'sneha@examdesk.local',
      address: 'Anna Nagar, Chennai',
      examTrack: 'NEET',
      shiftId: 'shift-5',
      seatNumber: 'C02',
      monthlyFees: 4200,
      paidAmount: 4200,
      feeStatus: 'paid',
      dueOffset: 24,
      joinedOffset: -72,
      expiryOffset: 24,
      accent: '#7c3aed'
    },
    {
      fullName: 'Rohan Mehta',
      fatherName: 'Dinesh Mehta',
      gender: 'Male',
      dob: '2002-05-09',
      mobile: '9876501005',
      email: 'rohan@examdesk.local',
      address: 'Vastrapur, Ahmedabad',
      examTrack: 'CAT',
      shiftId: 'shift-4',
      seatNumber: 'D06',
      monthlyFees: 2600,
      paidAmount: 1800,
      feeStatus: 'pending',
      dueOffset: 7,
      joinedOffset: -31,
      expiryOffset: 7,
      accent: '#f97316'
    },
    {
      fullName: 'Nisha Patel',
      fatherName: 'Paresh Patel',
      gender: 'Female',
      dob: '2003-09-26',
      mobile: '9876501006',
      email: 'nisha@examdesk.local',
      address: 'Civil Lines, Jaipur',
      examTrack: 'JEE',
      shiftId: 'shift-3',
      seatNumber: 'E04',
      monthlyFees: 2800,
      paidAmount: 2800,
      feeStatus: 'paid',
      dueOffset: 19,
      joinedOffset: -55,
      expiryOffset: 19,
      accent: '#0891b2'
    },
    {
      fullName: 'Vikram Singh',
      fatherName: 'Ajeet Singh',
      gender: 'Male',
      dob: '2000-12-18',
      mobile: '9876501007',
      email: 'vikram@examdesk.local',
      address: 'Hazratganj, Lucknow',
      examTrack: 'UPSC CSE',
      shiftId: 'shift-6',
      seatNumber: 'F04',
      monthlyFees: 5200,
      paidAmount: 3000,
      feeStatus: 'pending',
      dueOffset: 1,
      joinedOffset: -160,
      expiryOffset: 1,
      accent: '#334155'
    },
    {
      fullName: 'Meera Joshi',
      fatherName: 'Harish Joshi',
      gender: 'Female',
      dob: '2004-01-06',
      mobile: '9876501008',
      email: 'meera@examdesk.local',
      address: 'Indiranagar, Bengaluru',
      examTrack: 'Banking',
      shiftId: 'shift-1',
      seatNumber: 'B01',
      monthlyFees: 2200,
      paidAmount: 2200,
      feeStatus: 'paid',
      dueOffset: 28,
      joinedOffset: -22,
      expiryOffset: 28,
      accent: '#16a34a'
    },
    {
      fullName: 'Arjun Rao',
      fatherName: 'Keshav Rao',
      gender: 'Male',
      dob: '2002-06-30',
      mobile: '9876501009',
      email: 'arjun@examdesk.local',
      address: 'Banjara Hills, Hyderabad',
      examTrack: 'SSC CHSL',
      shiftId: 'shift-2',
      seatNumber: 'C08',
      monthlyFees: 2400,
      paidAmount: 2400,
      feeStatus: 'paid',
      dueOffset: 12,
      joinedOffset: -18,
      expiryOffset: 12,
      accent: '#0d9488'
    },
    {
      fullName: 'Tara Kapoor',
      fatherName: 'Vijay Kapoor',
      gender: 'Female',
      dob: '2001-07-21',
      mobile: '9876501010',
      email: 'tara@examdesk.local',
      address: 'Salt Lake, Kolkata',
      examTrack: 'UPSC CSE',
      shiftId: 'shift-5',
      seatNumber: 'E08',
      monthlyFees: 4200,
      paidAmount: 0,
      feeStatus: 'overdue',
      dueOffset: -2,
      joinedOffset: -62,
      expiryOffset: -2,
      accent: '#be123c'
    }
  ].map((student, index) => {
    const id = studentId(index + 1);
    const pendingAmount = Math.max(0, student.monthlyFees - student.paidAmount);
    return {
      id,
      photo: avatarDataUri(student.fullName, student.accent),
      fullName: student.fullName,
      fatherName: student.fatherName,
      gender: student.gender,
      dob: student.dob,
      mobile: student.mobile,
      email: student.email,
      address: student.address,
      examTrack: student.examTrack,
      dateJoined: daysFromNow(student.joinedOffset),
      expiryDate: daysFromNow(student.expiryOffset),
      membershipStatus: student.expiryOffset < 0 ? 'expired' : 'active',
      selectedShift: student.shiftId,
      seatNumber: student.seatNumber,
      studyHours: shifts.find((shift) => shift.id === student.shiftId)?.studyHours || 4,
      monthlyFees: student.monthlyFees,
      paidAmount: student.paidAmount,
      pendingAmount,
      paymentMethod: student.paidAmount > 0 ? 'UPI' : 'Cash',
      dueDate: daysFromNow(student.dueOffset),
      feeStatus: student.feeStatus,
      qrToken: `LIB-QR-${id}-${crypto.createHash('sha256').update(id).digest('hex').slice(0, 8)}`,
      notes: `${student.examTrack} preparation`,
      createdAt: now,
      updatedAt: now
    };
  });

  const payments = students
    .filter((student) => student.paidAmount > 0)
    .map((student, index) => ({
      id: `pay-${index + 1}`,
      receiptNumber: receiptNumber(),
      studentId: student.id,
      amount: student.paidAmount,
      method: student.paymentMethod,
      month: new Date().toLocaleString('en', { month: 'long', year: 'numeric' }),
      paidAt: daysFromNow(index % 3 === 0 ? -2 : -10),
      collectedBy: 'usr-admin',
      status: 'success',
      notes: 'Monthly library subscription'
    }));

  const attendance = [];
  students.forEach((student, studentIndex) => {
    for (let day = 0; day < 14; day += 1) {
      if ((studentIndex + day) % 5 === 0) continue;
      const date = new Date();
      date.setDate(date.getDate() - day);
      const checkInHour = student.selectedShift === 'shift-1' ? 6 : student.selectedShift === 'shift-4' ? 18 : 10;
      const checkIn = new Date(date);
      checkIn.setHours(checkInHour, 8 + (studentIndex % 9), 0, 0);
      const checkOut = new Date(checkIn);
      checkOut.setHours(checkIn.getHours() + Math.min(student.studyHours, 8), 0, 0, 0);
      attendance.push({
        id: `att-${student.id}-${isoDate(date)}`,
        studentId: student.id,
        date: isoDate(date),
        checkIn: checkIn.toISOString(),
        checkOut: checkOut.toISOString(),
        source: 'qr',
        status: 'present'
      });
    }
  });

  const users = [
    {
      id: 'usr-admin',
      name: 'Library Owner',
      email: 'owner@examdesk.local',
      mobile: '9999990001',
      role: 'super_admin',
      status: 'active',
      createdAt: now,
      ...adminPass
    },
    {
      id: 'usr-staff',
      name: 'Front Desk Staff',
      email: 'staff@examdesk.local',
      mobile: '9999990002',
      role: 'staff',
      status: 'active',
      createdAt: now,
      ...staffPass
    },
    {
      id: 'usr-student-aarav',
      name: 'Aarav Sharma',
      email: 'aarav@examdesk.local',
      mobile: '9876501001',
      role: 'student',
      studentId: 'STU-2026-0001',
      status: 'active',
      createdAt: now,
      ...studentPass
    }
  ];

  return {
    meta: {
      name: 'ExamDesk Library',
      city: 'New Delhi',
      createdAt: now,
      updatedAt: now,
      nextStudentNumber: students.length + 1,
      tokenTtlMinutes: TOKEN_TTL_MS / 60000,
      inactivityLogoutMinutes: 20
    },
    users,
    students,
    shifts,
    seats,
    attendance,
    payments,
    notifications: [
      {
        id: 'note-1',
        type: 'fee_due',
        channel: 'WhatsApp',
        title: 'Fee reminder prepared',
        body: 'Pending fee reminders are ready for students due this week.',
        status: 'queued',
        createdAt: now
      }
    ],
    auditLog: []
  };
}

function json(res, status, payload, headers = {}) {
  res.writeHead(status, {
    ...securityHeaders,
    'Content-Type': 'application/json; charset=utf-8',
    ...headers
  });
  res.end(JSON.stringify(payload));
}

function text(res, status, payload, contentType = 'text/plain; charset=utf-8', headers = {}) {
  res.writeHead(status, {
    ...securityHeaders,
    'Content-Type': contentType,
    ...headers
  });
  res.end(payload);
}

function error(res, status, message, details) {
  json(res, status, { error: message, details });
}

async function parseBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString('utf8');
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function getBearer(req) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

function authenticate(req, data) {
  const decoded = verifyToken(getBearer(req));
  if (!decoded) return null;
  const user = data.users.find((candidate) => candidate.id === decoded.sub);
  if (!user || user.status !== 'active') return null;
  return user;
}

function requireAuth(req, res, data, roles = []) {
  const actor = authenticate(req, data);
  if (!actor) {
    error(res, 401, 'Authentication required');
    return null;
  }
  if (roles.length && !roles.includes(actor.role)) {
    error(res, 403, 'You do not have permission to perform this action');
    return null;
  }
  return actor;
}

function audit(data, actor, action, entity, entityId, details = {}) {
  data.auditLog.unshift({
    id: `audit-${Date.now()}-${crypto.randomInt(1000, 9999)}`,
    actorId: actor?.id || 'system',
    actorRole: actor?.role || 'system',
    action,
    entity,
    entityId,
    details,
    createdAt: isoDateTime()
  });
  data.auditLog = data.auditLog.slice(0, 250);
}

function getShift(data, shiftId) {
  return data.shifts.find((shift) => shift.id === shiftId);
}

function isActiveStudent(student) {
  return student.membershipStatus === 'active' && student.expiryDate >= isoDate();
}

function shiftStudents(data, shiftId, options = {}) {
  return data.students.filter((student) => {
    if (options.excludeStudentId && student.id === options.excludeStudentId) return false;
    return student.selectedShift === shiftId && isActiveStudent(student);
  });
}

function shiftOccupancy(data, shiftId) {
  const shift = getShift(data, shiftId);
  const occupied = shiftStudents(data, shiftId).length;
  return {
    shiftId,
    occupied,
    capacity: shift?.capacity || 0,
    percentage: shift?.capacity ? Math.round((occupied / shift.capacity) * 100) : 0
  };
}

function hasSeatConflict(data, seatNumber, shiftId, excludeStudentId) {
  return data.students.some((student) => {
    return (
      student.id !== excludeStudentId &&
      isActiveStudent(student) &&
      student.seatNumber === seatNumber &&
      student.selectedShift === shiftId
    );
  });
}

function canFitShift(data, shiftId, excludeStudentId) {
  const shift = getShift(data, shiftId);
  if (!shift) return false;
  return shiftStudents(data, shiftId, { excludeStudentId }).length < shift.capacity;
}

function validateStudentPayload(data, body, existingStudent) {
  const fullName = String(body.fullName || existingStudent?.fullName || '').trim();
  const mobile = String(body.mobile || existingStudent?.mobile || '').trim();
  const selectedShift = String(body.selectedShift || existingStudent?.selectedShift || '').trim();
  const seatNumber = String(body.seatNumber || existingStudent?.seatNumber || '').trim().toUpperCase();
  const seat = data.seats.find((candidate) => candidate.number === seatNumber);

  if (!fullName) return 'Student full name is required';
  if (!mobile) return 'Mobile number is required';
  if (!getShift(data, selectedShift)) return 'A valid shift is required';
  if (!seat) return 'A valid seat number is required';
  if (seat.baseStatus === 'reserved' && existingStudent?.seatNumber !== seatNumber) {
    return 'This seat is reserved by the owner';
  }
  if (hasSeatConflict(data, seatNumber, selectedShift, existingStudent?.id)) {
    return 'This seat is already occupied for the selected shift';
  }
  if (!canFitShift(data, selectedShift, existingStudent?.id)) {
    return 'The selected shift is already full';
  }
  return null;
}

function attendancePercentage(data, studentId, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const logs = data.attendance.filter((log) => {
    return log.studentId === studentId && new Date(log.date) >= since;
  });
  const expectedDays = Math.min(days, 30);
  return Math.min(100, Math.round((logs.length / expectedDays) * 100));
}

function studentWithComputed(data, student) {
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

function queryStudents(data, searchParams) {
  const search = String(searchParams.get('search') || '').trim().toLowerCase();
  const filter = String(searchParams.get('filter') || 'all');
  const shift = String(searchParams.get('shift') || 'all');
  const feeStatus = String(searchParams.get('feeStatus') || 'all');

  return data.students
    .map((student) => studentWithComputed(data, student))
    .filter((student) => {
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
    .filter((student) => {
      if (filter === 'active') return student.membershipStatus === 'active';
      if (filter === 'expired') return student.membershipStatus === 'expired';
      if (filter === 'pending-fees') return ['pending', 'overdue'].includes(student.feeStatus);
      if (filter === 'morning') return student.selectedShift === 'shift-1';
      if (filter === 'evening') return student.selectedShift === 'shift-4';
      if (filter === 'absent-many-days') return attendancePercentage(data, student.id, 14) < 60;
      return true;
    })
    .filter((student) => (shift === 'all' ? true : student.selectedShift === shift))
    .filter((student) => (feeStatus === 'all' ? true : student.feeStatus === feeStatus))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

function dashboardSummary(data) {
  const today = isoDate();
  const currentMonth = new Date().toISOString().slice(0, 7);
  const enrichedStudents = data.students.map((student) => studentWithComputed(data, student));
  const activeStudents = enrichedStudents.filter((student) => student.membershipStatus === 'active');
  const pendingFees = enrichedStudents.filter((student) => ['pending', 'overdue'].includes(student.feeStatus));
  const occupiedSeatKeys = new Set(
    activeStudents.map((student) => `${student.selectedShift}:${student.seatNumber}`)
  );
  const availableSeatCount = data.seats.filter((seat) => seat.baseStatus === 'available').length;
  const todayLogs = data.attendance.filter((log) => log.date === today);
  const monthlyRevenue = data.payments
    .filter((payment) => payment.paidAt.slice(0, 7) === currentMonth && payment.status === 'success')
    .reduce((sum, payment) => sum + parseAmount(payment.amount), 0);
  const expiring = enrichedStudents
    .filter((student) => student.membershipStatus === 'active' && student.expiryDate <= daysFromNow(7))
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

  const attendanceTrend = Array.from({ length: 7 }).map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const dateString = isoDate(date);
    return {
      date: dateString,
      label: date.toLocaleDateString('en', { weekday: 'short' }),
      present: data.attendance.filter((log) => log.date === dateString).length
    };
  });

  const revenueTrend = Array.from({ length: 6 }).map((_, index) => {
    const date = monthsAgo(5 - index);
    const key = date.toISOString().slice(0, 7);
    return {
      month: date.toLocaleString('en', { month: 'short' }),
      revenue: data.payments
        .filter((payment) => payment.paidAt.slice(0, 7) === key)
        .reduce((sum, payment) => sum + parseAmount(payment.amount), 0)
    };
  });

  const studentGrowth = Array.from({ length: 6 }).map((_, index) => {
    const date = monthsAgo(5 - index);
    const key = date.toISOString().slice(0, 7);
    return {
      month: date.toLocaleString('en', { month: 'short' }),
      students: data.students.filter((student) => student.dateJoined.slice(0, 7) <= key).length
    };
  });

  return {
    stats: {
      totalStudents: data.students.length,
      activeMemberships: activeStudents.length,
      pendingFees: pendingFees.length,
      emptySeats: Math.max(0, availableSeatCount * data.shifts.length - occupiedSeatKeys.size),
      todaysAttendance: todayLogs.length,
      monthlyRevenue,
      expiringMemberships: expiring.length
    },
    attendanceTrend,
    revenueTrend,
    studentGrowth,
    shiftOccupancy: data.shifts.map((shift) => ({
      ...shift,
      ...shiftOccupancy(data, shift.id)
    })),
    expiringMemberships: expiring.slice(0, 8),
    pendingStudents: pendingFees.slice(0, 8),
    recentPayments: data.payments.slice(-8).reverse(),
    recentAttendance: todayLogs.map((log) => ({
      ...log,
      student: studentWithComputed(data, data.students.find((student) => student.id === log.studentId))
    }))
  };
}

function seatLayout(data, shiftId = 'shift-1') {
  return data.seats.map((seat) => {
    const assigned = data.students
      .filter((student) => isActiveStudent(student))
      .find((student) => student.seatNumber === seat.number && student.selectedShift === shiftId);
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

function attendanceSummary(data, date = isoDate()) {
  const logs = data.attendance
    .filter((log) => log.date === date)
    .map((log) => ({
      ...log,
      student: studentWithComputed(data, data.students.find((student) => student.id === log.studentId))
    }));
  const presentIds = new Set(logs.map((log) => log.studentId));
  const absent = data.students
    .filter((student) => isActiveStudent(student) && !presentIds.has(student.id))
    .map((student) => studentWithComputed(data, student));
  const peakHours = Array.from({ length: 18 }).map((_, index) => {
    const hour = index + 5;
    return {
      hour: `${String(hour).padStart(2, '0')}:00`,
      count: logs.filter((log) => new Date(log.checkIn).getHours() === hour).length
    };
  });
  return { date, logs, absent, peakHours };
}

function csvEscape(value) {
  const textValue = String(value ?? '');
  if (/[",\n]/.test(textValue)) return `"${textValue.replace(/"/g, '""')}"`;
  return textValue;
}

function studentsCsv(data) {
  const columns = [
    'Student ID',
    'Name',
    'Mobile',
    'Exam',
    'Shift',
    'Seat',
    'Joined',
    'Expiry',
    'Monthly Fees',
    'Paid',
    'Pending',
    'Fee Status',
    'Attendance %'
  ];
  const rows = data.students.map((student) => {
    const enriched = studentWithComputed(data, student);
    return [
      enriched.id,
      enriched.fullName,
      enriched.mobile,
      enriched.examTrack,
      enriched.shiftName,
      enriched.seatNumber,
      enriched.dateJoined,
      enriched.expiryDate,
      enriched.monthlyFees,
      enriched.paidAmount,
      enriched.pendingAmount,
      enriched.feeStatus,
      enriched.attendancePercentage
    ];
  });
  return [columns, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
}

function updatePaymentStatus(student) {
  const pendingAmount = Math.max(0, parseAmount(student.monthlyFees) - parseAmount(student.paidAmount));
  student.pendingAmount = pendingAmount;
  student.feeStatus = pendingAmount <= 0 ? 'paid' : student.dueDate < isoDate() ? 'overdue' : 'pending';
  return student;
}

async function handleApi(req, res, url) {
  const data = await readData();
  const { pathname, searchParams } = url;

  if (req.method === 'GET' && pathname === '/api/health') {
    json(res, 200, { ok: true, name: data.meta.name, time: isoDateTime() });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/auth/login') {
    const body = await parseBody(req);
    const identifier = String(body.identifier || '').trim().toLowerCase();
    const password = String(body.password || '');
    const user = data.users.find((candidate) => {
      return (
        candidate.status === 'active' &&
        [candidate.email, candidate.mobile].filter(Boolean).map((value) => value.toLowerCase()).includes(identifier)
      );
    });
    if (!user || !comparePassword(password, user)) {
      error(res, 401, 'Invalid email/mobile or password');
      return;
    }
    user.lastLoginAt = isoDateTime();
    await writeData(data);
    json(res, 200, {
      token: createToken(user),
      user: sanitizeUser(user),
      expiresInMinutes: TOKEN_TTL_MS / 60000,
      inactivityLogoutMinutes: data.meta.inactivityLogoutMinutes
    });
    return;
  }

  const actor = requireAuth(req, res, data);
  if (!actor) return;

  if (req.method === 'GET' && pathname === '/api/me') {
    const student = actor.studentId
      ? studentWithComputed(data, data.students.find((candidate) => candidate.id === actor.studentId))
      : null;
    json(res, 200, { user: sanitizeUser(actor), student });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/dashboard') {
    if (!requireAuth(req, res, data, ['super_admin', 'staff'])) return;
    json(res, 200, dashboardSummary(data));
    return;
  }

  if (req.method === 'GET' && pathname === '/api/students') {
    if (!requireAuth(req, res, data, ['super_admin', 'staff'])) return;
    json(res, 200, { students: queryStudents(data, searchParams) });
    return;
  }

  const studentMatch = pathname.match(/^\/api\/students\/([^/]+)$/);
  if (studentMatch) {
    const target = data.students.find((student) => student.id === decodeURIComponent(studentMatch[1]));
    if (!target) {
      error(res, 404, 'Student not found');
      return;
    }
    if (req.method === 'GET') {
      if (actor.role === 'student' && actor.studentId !== target.id) {
        error(res, 403, 'Students can view only their own profile');
        return;
      }
      json(res, 200, {
        student: studentWithComputed(data, target),
        payments: data.payments.filter((payment) => payment.studentId === target.id).reverse(),
        attendance: data.attendance.filter((log) => log.studentId === target.id).reverse().slice(0, 60)
      });
      return;
    }
    if (req.method === 'PUT') {
      if (!requireAuth(req, res, data, ['super_admin', 'staff'])) return;
      const body = await parseBody(req);
      const validationError = validateStudentPayload(data, body, target);
      if (validationError) {
        error(res, 422, validationError);
        return;
      }
      const oldSeat = target.seatNumber;
      Object.assign(target, {
        photo: body.photo || target.photo,
        fullName: String(body.fullName || target.fullName).trim(),
        fatherName: String(body.fatherName || target.fatherName || '').trim(),
        gender: String(body.gender || target.gender || 'Other'),
        dob: String(body.dob || target.dob || ''),
        mobile: String(body.mobile || target.mobile).trim(),
        email: String(body.email || target.email || '').trim(),
        address: String(body.address || target.address || '').trim(),
        examTrack: String(body.examTrack || target.examTrack || '').trim(),
        dateJoined: String(body.dateJoined || target.dateJoined),
        expiryDate: String(body.expiryDate || target.expiryDate),
        membershipStatus: String(body.expiryDate || target.expiryDate) < isoDate() ? 'expired' : 'active',
        selectedShift: String(body.selectedShift || target.selectedShift),
        seatNumber: String(body.seatNumber || target.seatNumber).toUpperCase(),
        studyHours: parseAmount(body.studyHours || target.studyHours),
        monthlyFees: parseAmount(body.monthlyFees ?? target.monthlyFees),
        paidAmount: parseAmount(body.paidAmount ?? target.paidAmount),
        paymentMethod: String(body.paymentMethod || target.paymentMethod || 'UPI'),
        dueDate: String(body.dueDate || target.dueDate),
        feeStatus: normalizeStatus(body.feeStatus || target.feeStatus),
        notes: String(body.notes || target.notes || ''),
        updatedAt: isoDateTime()
      });
      updatePaymentStatus(target);
      if (oldSeat !== target.seatNumber) {
        const seat = data.seats.find((candidate) => candidate.number === target.seatNumber);
        seat?.history.unshift({
          studentId: target.id,
          from: oldSeat,
          to: target.seatNumber,
          shiftId: target.selectedShift,
          movedAt: isoDateTime(),
          movedBy: actor.id
        });
      }
      audit(data, actor, 'update', 'student', target.id);
      await writeData(data);
      json(res, 200, { student: studentWithComputed(data, target) });
      return;
    }
    if (req.method === 'DELETE') {
      if (!requireAuth(req, res, data, ['super_admin'])) return;
      data.students = data.students.filter((student) => student.id !== target.id);
      data.users = data.users.filter((user) => user.studentId !== target.id);
      audit(data, actor, 'delete', 'student', target.id, { name: target.fullName });
      await writeData(data);
      json(res, 200, { ok: true });
      return;
    }
  }

  if (req.method === 'POST' && pathname === '/api/students') {
    if (!requireAuth(req, res, data, ['super_admin', 'staff'])) return;
    const body = await parseBody(req);
    const validationError = validateStudentPayload(data, body);
    if (validationError) {
      error(res, 422, validationError);
      return;
    }
    const id = studentId(data.meta.nextStudentNumber);
    data.meta.nextStudentNumber += 1;
    const shift = getShift(data, body.selectedShift);
    const email = String(body.email || slugEmail(body.fullName)).trim().toLowerCase();
    const newStudent = updatePaymentStatus({
      id,
      photo: body.photo || avatarDataUri(body.fullName, '#0f766e'),
      fullName: String(body.fullName).trim(),
      fatherName: String(body.fatherName || '').trim(),
      gender: String(body.gender || 'Other'),
      dob: String(body.dob || ''),
      mobile: String(body.mobile).trim(),
      email,
      address: String(body.address || '').trim(),
      examTrack: String(body.examTrack || 'Competitive Exam'),
      dateJoined: String(body.dateJoined || isoDate()),
      expiryDate: String(body.expiryDate || daysFromNow(30)),
      membershipStatus: String(body.expiryDate || daysFromNow(30)) < isoDate() ? 'expired' : 'active',
      selectedShift: String(body.selectedShift),
      seatNumber: String(body.seatNumber).trim().toUpperCase(),
      studyHours: parseAmount(body.studyHours || shift.studyHours),
      monthlyFees: parseAmount(body.monthlyFees || 0),
      paidAmount: parseAmount(body.paidAmount || 0),
      paymentMethod: String(body.paymentMethod || 'UPI'),
      dueDate: String(body.dueDate || daysFromNow(30)),
      feeStatus: normalizeStatus(body.feeStatus || 'pending'),
      qrToken: `LIB-QR-${id}-${crypto.createHash('sha256').update(id).digest('hex').slice(0, 8)}`,
      notes: String(body.notes || ''),
      createdAt: isoDateTime(),
      updatedAt: isoDateTime()
    });
    data.students.push(newStudent);
    const password = hashPassword('Student@123');
    data.users.push({
      id: `usr-${id.toLowerCase()}`,
      name: newStudent.fullName,
      email,
      mobile: newStudent.mobile,
      role: 'student',
      studentId: id,
      status: 'active',
      createdAt: isoDateTime(),
      ...password
    });
    audit(data, actor, 'create', 'student', id);
    await writeData(data);
    json(res, 201, { student: studentWithComputed(data, newStudent), defaultPassword: 'Student@123' });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/shifts') {
    if (!requireAuth(req, res, data, ['super_admin', 'staff'])) return;
    json(res, 200, {
      shifts: data.shifts.map((shift) => ({
        ...shift,
        ...shiftOccupancy(data, shift.id)
      }))
    });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/shifts') {
    if (!requireAuth(req, res, data, ['super_admin'])) return;
    const body = await parseBody(req);
    const shift = {
      id: `shift-${Date.now()}`,
      name: String(body.name || 'New Shift').trim(),
      startsAt: String(body.startsAt || '06:00'),
      endsAt: String(body.endsAt || '10:00'),
      studyHours: parseAmount(body.studyHours || 4),
      capacity: parseAmount(body.capacity || 20),
      color: String(body.color || '#0f766e')
    };
    data.shifts.push(shift);
    audit(data, actor, 'create', 'shift', shift.id);
    await writeData(data);
    json(res, 201, { shift });
    return;
  }

  const shiftMatch = pathname.match(/^\/api\/shifts\/([^/]+)$/);
  if (shiftMatch) {
    if (!requireAuth(req, res, data, ['super_admin'])) return;
    const shift = data.shifts.find((candidate) => candidate.id === decodeURIComponent(shiftMatch[1]));
    if (!shift) {
      error(res, 404, 'Shift not found');
      return;
    }
    if (req.method === 'PUT') {
      const body = await parseBody(req);
      const newCapacity = parseAmount(body.capacity ?? shift.capacity);
      if (newCapacity < shiftStudents(data, shift.id).length) {
        error(res, 422, 'Capacity cannot be lower than current occupancy');
        return;
      }
      Object.assign(shift, {
        name: String(body.name || shift.name).trim(),
        startsAt: String(body.startsAt || shift.startsAt),
        endsAt: String(body.endsAt || shift.endsAt),
        studyHours: parseAmount(body.studyHours || shift.studyHours),
        capacity: newCapacity,
        color: String(body.color || shift.color)
      });
      audit(data, actor, 'update', 'shift', shift.id);
      await writeData(data);
      json(res, 200, { shift: { ...shift, ...shiftOccupancy(data, shift.id) } });
      return;
    }
    if (req.method === 'DELETE') {
      if (shiftStudents(data, shift.id).length) {
        error(res, 422, 'Move students out of this shift before deleting it');
        return;
      }
      data.shifts = data.shifts.filter((candidate) => candidate.id !== shift.id);
      audit(data, actor, 'delete', 'shift', shift.id);
      await writeData(data);
      json(res, 200, { ok: true });
      return;
    }
  }

  if (req.method === 'GET' && pathname === '/api/seats') {
    if (!requireAuth(req, res, data, ['super_admin', 'staff'])) return;
    const shiftId = String(searchParams.get('shift') || data.shifts[0]?.id || 'shift-1');
    json(res, 200, {
      shiftId,
      seats: seatLayout(data, shiftId),
      students: data.students.map((student) => studentWithComputed(data, student))
    });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/seats/assign') {
    if (!requireAuth(req, res, data, ['super_admin', 'staff'])) return;
    const body = await parseBody(req);
    const target = data.students.find((student) => student.id === body.studentId);
    if (!target) {
      error(res, 404, 'Student not found');
      return;
    }
    const seatNumber = String(body.seatNumber || '').trim().toUpperCase();
    const shiftId = String(body.shiftId || target.selectedShift);
    const requestedSeat = data.seats.find((seat) => seat.number === seatNumber);
    if (!requestedSeat) {
      error(res, 422, 'Invalid seat number');
      return;
    }
    if (requestedSeat.baseStatus === 'reserved') {
      error(res, 422, 'This seat is reserved by the owner');
      return;
    }
    if (!getShift(data, shiftId)) {
      error(res, 422, 'Invalid shift');
      return;
    }
    if (hasSeatConflict(data, seatNumber, shiftId, target.id)) {
      error(res, 422, 'This seat is already occupied for the selected shift');
      return;
    }
    if (!canFitShift(data, shiftId, target.id)) {
      error(res, 422, 'The selected shift is already full');
      return;
    }
    const oldSeat = target.seatNumber;
    target.seatNumber = seatNumber;
    target.selectedShift = shiftId;
    target.studyHours = getShift(data, shiftId).studyHours;
    target.updatedAt = isoDateTime();
    const seat = data.seats.find((candidate) => candidate.number === seatNumber);
    seat.history.unshift({
      studentId: target.id,
      from: oldSeat,
      to: seatNumber,
      shiftId,
      movedAt: isoDateTime(),
      movedBy: actor.id
    });
    audit(data, actor, 'assign', 'seat', seatNumber, { studentId: target.id, from: oldSeat });
    await writeData(data);
    json(res, 200, { student: studentWithComputed(data, target), seats: seatLayout(data, shiftId) });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/attendance') {
    if (!requireAuth(req, res, data, ['super_admin', 'staff'])) return;
    json(res, 200, attendanceSummary(data, String(searchParams.get('date') || isoDate())));
    return;
  }

  if (req.method === 'POST' && pathname === '/api/attendance/scan') {
    const body = await parseBody(req);
    const target = data.students.find((student) => {
      return student.id === body.studentId || student.qrToken === body.qrToken;
    });
    if (!target) {
      error(res, 404, 'Student not found for this QR token');
      return;
    }
    if (actor.role === 'student' && actor.studentId !== target.id) {
      error(res, 403, 'Students can mark attendance only for their own profile');
      return;
    }
    const today = isoDate();
    const existing = data.attendance.find(
      (log) => log.studentId === target.id && log.date === today && !log.checkOut
    );
    const action = String(body.action || 'auto');
    if (existing && ['auto', 'check-out'].includes(action)) {
      existing.checkOut = isoDateTime();
      audit(data, actor, 'checkout', 'attendance', existing.id, { studentId: target.id });
      await writeData(data);
      json(res, 200, { mode: 'check-out', log: existing });
      return;
    }
    const log = {
      id: `att-${target.id}-${today}-${Date.now()}`,
      studentId: target.id,
      date: today,
      checkIn: isoDateTime(),
      checkOut: null,
      source: 'qr',
      status: 'present'
    };
    data.attendance.unshift(log);
    audit(data, actor, 'checkin', 'attendance', log.id, { studentId: target.id });
    await writeData(data);
    json(res, 201, { mode: 'check-in', log });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/payments') {
    if (!requireAuth(req, res, data, ['super_admin', 'staff'])) return;
    json(res, 200, {
      payments: data.payments
        .map((payment) => ({
          ...payment,
          student: studentWithComputed(data, data.students.find((student) => student.id === payment.studentId))
        }))
        .reverse()
    });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/payments') {
    if (!requireAuth(req, res, data, ['super_admin', 'staff'])) return;
    const body = await parseBody(req);
    const target = data.students.find((student) => student.id === body.studentId);
    if (!target) {
      error(res, 404, 'Student not found');
      return;
    }
    const amount = parseAmount(body.amount);
    if (amount <= 0) {
      error(res, 422, 'Payment amount must be greater than zero');
      return;
    }
    const payment = {
      id: `pay-${Date.now()}`,
      receiptNumber: receiptNumber(),
      studentId: target.id,
      amount,
      method: String(body.method || 'UPI'),
      month: String(body.month || new Date().toLocaleString('en', { month: 'long', year: 'numeric' })),
      paidAt: isoDate(),
      collectedBy: actor.id,
      status: 'success',
      notes: String(body.notes || 'Monthly library subscription')
    };
    data.payments.push(payment);
    target.paidAmount = parseAmount(target.paidAmount) + amount;
    target.paymentMethod = payment.method;
    updatePaymentStatus(target);
    target.updatedAt = isoDateTime();
    audit(data, actor, 'collect', 'payment', payment.id, { studentId: target.id, amount });
    await writeData(data);
    json(res, 201, { payment, student: studentWithComputed(data, target) });
    return;
  }

  const receiptMatch = pathname.match(/^\/api\/receipts\/([^/]+)$/);
  if (req.method === 'GET' && receiptMatch) {
    const payment = data.payments.find((candidate) => candidate.id === decodeURIComponent(receiptMatch[1]));
    if (!payment) {
      error(res, 404, 'Receipt not found');
      return;
    }
    const student = data.students.find((candidate) => candidate.id === payment.studentId);
    if (actor.role === 'student' && actor.studentId !== student?.id) {
      error(res, 403, 'Students can download only their own receipts');
      return;
    }
    json(res, 200, {
      receipt: {
        library: data.meta.name,
        city: data.meta.city,
        payment,
        student: studentWithComputed(data, student)
      }
    });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/reports') {
    if (!requireAuth(req, res, data, ['super_admin'])) return;
    const dashboard = dashboardSummary(data);
    const feeAging = {
      paid: data.students.filter((student) => studentWithComputed(data, student).feeStatus === 'paid').length,
      pending: data.students.filter((student) => studentWithComputed(data, student).feeStatus === 'pending').length,
      overdue: data.students.filter((student) => studentWithComputed(data, student).feeStatus === 'overdue').length
    };
    const lowAttendance = data.students
      .map((student) => studentWithComputed(data, student))
      .filter((student) => student.attendancePercentage < 65)
      .sort((a, b) => a.attendancePercentage - b.attendancePercentage)
      .slice(0, 10);
    json(res, 200, { ...dashboard, feeAging, lowAttendance, auditLog: data.auditLog.slice(0, 50) });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/export/students') {
    if (!requireAuth(req, res, data, ['super_admin'])) return;
    text(res, 200, studentsCsv(data), 'text/csv; charset=utf-8', {
      'Content-Disposition': 'attachment; filename="students-report.csv"'
    });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/notifications') {
    if (!requireAuth(req, res, data, ['super_admin', 'staff'])) return;
    json(res, 200, { notifications: data.notifications });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/notifications/reminders') {
    if (!requireAuth(req, res, data, ['super_admin', 'staff'])) return;
    const body = await parseBody(req);
    const channels = Array.isArray(body.channels) && body.channels.length ? body.channels : ['WhatsApp', 'SMS'];
    const targetIds = Array.isArray(body.studentIds) ? new Set(body.studentIds) : null;
    const targets = data.students
      .map((student) => studentWithComputed(data, student))
      .filter((student) => ['pending', 'overdue'].includes(student.feeStatus))
      .filter((student) => (targetIds ? targetIds.has(student.id) : true));
    const created = targets.flatMap((student) =>
      channels.map((channel) => ({
        id: `note-${Date.now()}-${crypto.randomInt(1000, 9999)}`,
        type: 'fee_due',
        channel,
        studentId: student.id,
        title: `Fee reminder: ${student.fullName}`,
        body: `Pending amount Rs ${student.pendingAmount} is due on ${student.dueDate}.`,
        status: 'queued',
        createdAt: isoDateTime()
      }))
    );
    data.notifications.unshift(...created);
    audit(data, actor, 'send', 'notification', 'fee_due', { count: created.length });
    await writeData(data);
    json(res, 201, { notifications: created });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/staff') {
    if (!requireAuth(req, res, data, ['super_admin'])) return;
    json(res, 200, {
      staff: data.users.filter((user) => ['super_admin', 'staff'].includes(user.role)).map(sanitizeUser)
    });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/staff') {
    if (!requireAuth(req, res, data, ['super_admin'])) return;
    const body = await parseBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    if (!email || data.users.some((user) => user.email === email)) {
      error(res, 422, 'A unique staff email is required');
      return;
    }
    const user = {
      id: `usr-${Date.now()}`,
      name: String(body.name || 'Staff Member').trim(),
      email,
      mobile: String(body.mobile || '').trim(),
      role: 'staff',
      status: 'active',
      createdAt: isoDateTime(),
      ...hashPassword(String(body.password || 'Staff@12345'))
    };
    data.users.push(user);
    audit(data, actor, 'create', 'staff', user.id);
    await writeData(data);
    json(res, 201, { staff: sanitizeUser(user), defaultPassword: body.password ? null : 'Staff@12345' });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/backups') {
    if (!requireAuth(req, res, data, ['super_admin'])) return;
    const backupPath = await createBackup(data);
    audit(data, actor, 'create', 'backup', path.basename(backupPath));
    await writeData(data);
    json(res, 201, { ok: true, backup: path.basename(backupPath) });
    return;
  }

  error(res, 404, 'API endpoint not found');
}

async function serveStatic(req, res, url) {
  const pathname = decodeURIComponent(url.pathname);
  const requested = pathname === '/' ? '/index.html' : pathname;
  const resolved = path.resolve(publicDir, `.${requested}`);
  if (!resolved.startsWith(publicDir)) {
    error(res, 403, 'Forbidden');
    return;
  }
  let filePath = resolved;
  if (!fsSync.existsSync(filePath) || fsSync.statSync(filePath).isDirectory()) {
    filePath = path.join(publicDir, 'index.html');
  }
  const ext = path.extname(filePath);
  const body = await fs.readFile(filePath);
  res.writeHead(200, {
    ...securityHeaders,
    'Content-Type': mimeTypes[ext] || 'application/octet-stream',
    'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=3600'
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
      return;
    }
    await serveStatic(req, res, url);
  } catch (err) {
    console.error(err);
    error(res, 500, 'Unexpected server error');
  }
});

server.listen(PORT, HOST, () => {
  const displayHost = HOST === '0.0.0.0' ? 'localhost' : HOST;
  console.log(`ExamDesk Library is running at http://${displayHost}:${PORT}`);
});
