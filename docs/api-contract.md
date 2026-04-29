# API Contract

Base URL: same origin as the web app.

All protected endpoints require:

```http
Authorization: Bearer <token>
```

## Auth

### POST `/api/auth/login`

Request:

```json
{
  "identifier": "owner@examdesk.local",
  "password": "Admin@12345"
}
```

Response:

```json
{
  "token": "signed-token",
  "user": {
    "id": "usr-admin",
    "role": "super_admin",
    "name": "Library Owner"
  },
  "expiresInMinutes": 480,
  "inactivityLogoutMinutes": 20
}
```

### GET `/api/me`

Returns the authenticated user and linked student profile when applicable.

## Dashboard

### GET `/api/dashboard`

Roles: `super_admin`, `staff`

Returns cards, trends, shift occupancy, expiring memberships, pending fee students, recent payments, and recent attendance.

## Students

### GET `/api/students`

Roles: `super_admin`, `staff`

Query parameters:

- `search`
- `filter`: `all`, `active`, `expired`, `pending-fees`, `morning`, `evening`, `absent-many-days`
- `shift`
- `feeStatus`: `all`, `paid`, `pending`, `overdue`

### POST `/api/students`

Roles: `super_admin`, `staff`

Creates a student, validates shift capacity, prevents same-seat same-shift conflicts, and creates student portal access.

### GET `/api/students/:id`

Roles: owner/staff for any student, student for self only.

### PUT `/api/students/:id`

Roles: `super_admin`, `staff`

Updates profile, fee, membership, shift, and seat data.

### DELETE `/api/students/:id`

Roles: `super_admin`

Deletes student and linked student login.

## Shifts

### GET `/api/shifts`

Returns shifts with occupancy.

### POST `/api/shifts`

Roles: `super_admin`

### PUT `/api/shifts/:id`

Roles: `super_admin`

Rejects capacity lower than current occupancy.

### DELETE `/api/shifts/:id`

Roles: `super_admin`

Rejects deletion while active students are assigned.

## Seats

### GET `/api/seats?shift=shift-1`

Roles: `super_admin`, `staff`

Returns visual seat layout for the selected shift.

### POST `/api/seats/assign`

Roles: `super_admin`, `staff`

Request:

```json
{
  "studentId": "STU-2026-0001",
  "seatNumber": "A03",
  "shiftId": "shift-1"
}
```

Validates reserved seats, shift capacity, and same-seat same-shift conflicts.

## Attendance

### GET `/api/attendance?date=YYYY-MM-DD`

Roles: `super_admin`, `staff`

Returns daily logs, absent students, and peak-hour data.

### POST `/api/attendance/scan`

Roles: `super_admin`, `staff`, `student`

Request:

```json
{
  "studentId": "STU-2026-0001",
  "action": "auto"
}
```

Students can mark only their own attendance.

## Payments

### GET `/api/payments`

Roles: `super_admin`, `staff`

### POST `/api/payments`

Roles: `super_admin`, `staff`

Request:

```json
{
  "studentId": "STU-2026-0001",
  "amount": 2200,
  "method": "UPI",
  "month": "April 2026"
}
```

## Receipts

### GET `/api/receipts/:paymentId`

Students can access only their own receipts.

## Reports & Exports

### GET `/api/reports`

Roles: `super_admin`

### GET `/api/export/students`

Roles: `super_admin`

Returns CSV.

## Notifications

### GET `/api/notifications`

Roles: `super_admin`, `staff`

### POST `/api/notifications/reminders`

Roles: `super_admin`, `staff`

Queues SMS and WhatsApp fee reminders for pending and overdue students.

## Staff & Backup

### GET `/api/staff`

Roles: `super_admin`

### POST `/api/staff`

Roles: `super_admin`

### POST `/api/backups`

Roles: `super_admin`

