# Component Structure

The current implementation is a dependency-free SPA in `public/app.js`. In a production React or Next.js build, split it into these reusable components.

## Layout

```text
app/
├── (public)/
│   ├── landing/page.tsx
│   ├── about/page.tsx
│   ├── pricing/page.tsx
│   ├── contact/page.tsx
│   └── login/page.tsx
├── dashboard/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── students/page.tsx
│   ├── attendance/page.tsx
│   ├── fees/page.tsx
│   ├── seats/page.tsx
│   ├── shifts/page.tsx
│   ├── reports/page.tsx
│   ├── notifications/page.tsx
│   └── settings/page.tsx
└── student/
    ├── profile/page.tsx
    ├── attendance/page.tsx
    └── receipts/page.tsx
```

## Reusable UI Components

```text
components/
├── layout/
│   ├── AppShell.tsx
│   ├── Sidebar.tsx
│   ├── Topbar.tsx
│   └── MobileBottomNav.tsx
├── students/
│   ├── StudentTable.tsx
│   ├── StudentCard.tsx
│   ├── StudentForm.tsx
│   ├── StudentProfileDrawer.tsx
│   └── StudentSearchFilters.tsx
├── seats/
│   ├── SeatGrid.tsx
│   ├── SeatCell.tsx
│   └── SeatTransferDialog.tsx
├── attendance/
│   ├── QRScanner.tsx
│   ├── AttendanceTable.tsx
│   └── PeakHoursChart.tsx
├── billing/
│   ├── PaymentForm.tsx
│   ├── Receipt.tsx
│   └── FeeStatusBadge.tsx
├── analytics/
│   ├── MetricCard.tsx
│   ├── OccupancyChart.tsx
│   ├── RevenueChart.tsx
│   └── AttendanceTrendChart.tsx
└── shared/
    ├── Button.tsx
    ├── Modal.tsx
    ├── DataTable.tsx
    ├── Badge.tsx
    ├── EmptyState.tsx
    └── ThemeToggle.tsx
```

## State Management

Recommended production approach:

- Server state: TanStack Query
- Tables: TanStack Table
- Forms: React Hook Form with Zod validation
- Drag/drop: dnd-kit
- Charts: Recharts
- Toasts: Sonner
- Theme: next-themes

## Design Tokens

Keep tokens centralized:

- Color roles: background, surface, text, muted, line, primary, danger, warning, success
- Radius: max 8px for cards and controls
- Spacing: 4px scale
- Typography: Inter or Geist with no negative tracking
- Motion: short transitions under 200ms for hover, modal, and row interactions

