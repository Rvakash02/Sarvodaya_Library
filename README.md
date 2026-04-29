# Competitive Exam Library Management System

A modern, secure, responsive full-stack starter for managing competitive exam libraries, reading rooms, seats, shifts, attendance, fees, notifications, and student self-service.

## Run locally

```bash
npm run dev
```

Open `http://localhost:4173`.

Demo accounts:

- Super Admin: `owner@examdesk.local` / `Admin@12345`
- Student: `aarav@examdesk.local` / `Student@123`

## What is included

- Secure login with PBKDF2 password hashing and signed JWT-style tokens
- Role-based access control for Super Admin, Staff, and Student
- Admin dashboard with analytics cards, charts, search, filters, reports, and exports
- Student profiles with photo upload, fee history, attendance, seat, shift, and membership details
- Interactive seat dashboard with status colors and drag-and-drop assignment
- Shift capacity management and overbooking prevention
- QR-style attendance flow for student check-in/check-out
- Fee collection, reminders, and printable receipt view
- Dark/light mode and mobile-first responsive navigation
- Production architecture, API contract, auth flow, and PostgreSQL schema docs

## Project structure

```text
.
├── public/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── server/
│   └── index.js
├── docs/
│   ├── api-contract.md
│   ├── architecture.md
│   ├── auth-flow.md
│   ├── component-structure.md
│   └── database-schema.sql
├── data/
│   └── library-data.json
├── package.json
└── README.md
```

## Production upgrade path

This repo is intentionally runnable without package downloads. For a production SaaS build, keep the domain model and API contract, then move to:

- Frontend: Next.js, React, Tailwind CSS, shadcn/ui, TanStack Table, Recharts
- Backend: Node.js, Express or NestJS, Prisma
- Database: PostgreSQL
- Storage: S3 or Cloudinary for photos and documents
- Notifications: WhatsApp Business API and SMS provider
- Auth: JWT with refresh tokens, Clerk, or a hardened in-house auth service

See the `docs/` folder for the detailed schema, API, and auth architecture.
