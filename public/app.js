const app = document.querySelector('#app');

const state = {
  token: localStorage.getItem('examdesk.token'),
  user: null,
  student: null,
  route: location.hash.replace('#/', '') || 'dashboard',
  publicPage: 'landing',
  theme: localStorage.getItem('examdesk.theme') || 'light',
  filters: {
    search: '',
    filter: 'all',
    shift: 'all',
    feeStatus: 'all',
    seatShift: 'shift-1',
    attendanceDate: new Date().toISOString().slice(0, 10)
  },
  data: {
    dashboard: null,
    students: [],
    shifts: [],
    seats: [],
    attendance: null,
    payments: [],
    notifications: [],
    reports: null,
    staff: [],
    profile: null
  },
  modal: null,
  searchTimer: null,
  lastActivityAt: Date.now(),
  inactivityTimer: null
};

const routeMeta = {
  dashboard: ['Admin Dashboard', 'Live health of students, seats, fees, and attendance.'],
  students: ['Student Management', 'Search, filter, add, edit, and protect complete student records.'],
  attendance: ['Attendance', 'QR check-in, check-out, absent lists, and peak hour visibility.'],
  fees: ['Fees & Billing', 'Collect subscriptions, generate receipts, and chase dues.'],
  seats: ['Seat Management', 'Visual seat layout with capacity controls and drag-and-drop assignment.'],
  shifts: ['Shift Management', 'Create shifts, manage capacity, and prevent overbooking.'],
  reports: ['Reports', 'Exportable analytics for revenue, occupancy, attendance, and growth.'],
  notifications: ['Notifications', 'Queue fee reminders for SMS and WhatsApp channels.'],
  settings: ['Settings', 'Security, backups, staff accounts, and admin controls.'],
  profile: ['Student Portal', 'Profile, membership, attendance, fee status, and receipts.']
};

const navItems = [
  ['dashboard', 'Dashboard', 'layout'],
  ['students', 'Students', 'users'],
  ['attendance', 'Attendance', 'scan'],
  ['fees', 'Fees', 'receipt'],
  ['seats', 'Seats', 'grid'],
  ['shifts', 'Shifts', 'clock'],
  ['reports', 'Reports', 'chart'],
  ['notifications', 'Alerts', 'bell'],
  ['settings', 'Settings', 'shield']
];

const studentNavItems = [
  ['profile', 'Profile', 'users'],
  ['attendance', 'Attendance', 'scan'],
  ['fees', 'Receipts', 'receipt']
];

function icon(name) {
  const paths = {
    layout: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="18" height="7" rx="1.5"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/>',
    receipt: '<path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 1 .67V2Z"/><path d="M8 7h8"/><path d="M8 11h8"/><path d="M8 15h5"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    chart: '<path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="5"/><rect x="12" y="8" width="3" height="9"/><rect x="17" y="5" width="3" height="12"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-5"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'
  };
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.layout}</svg>`;
}

function safe(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function money(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function niceDate(value) {
  if (!value) return 'Not set';
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function niceTime(value) {
  if (!value) return 'Open';
  return new Date(value).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function percent(value) {
  return `${Math.round(Number(value || 0))}%`;
}

function badge(value) {
  return `<span class="badge ${safe(value)}">${safe(String(value || 'unknown').replace('-', ' '))}</span>`;
}

function toast(message, tone = 'success') {
  const region = document.querySelector('.toast-region');
  if (!region) return;
  const node = document.createElement('div');
  node.className = `toast ${tone}`;
  node.textContent = message;
  region.append(node);
  setTimeout(() => node.remove(), 4200);
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const response = await fetch(path, {
    ...options,
    headers,
    body: options.body && !(options.body instanceof FormData) ? JSON.stringify(options.body) : options.body
  });
  if (response.status === 401) {
    logout(false);
    throw new Error('Please sign in again.');
  }
  const type = response.headers.get('content-type') || '';
  const payload = type.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    throw new Error(payload?.error || 'Something went wrong.');
  }
  return payload;
}

function resetInactivityTimer() {
  state.lastActivityAt = Date.now();
  clearInterval(state.inactivityTimer);
  state.inactivityTimer = setInterval(() => {
    if (Date.now() - state.lastActivityAt > 20 * 60 * 1000 && state.user) {
      logout(true);
    }
  }, 30000);
}

function setTheme(theme) {
  state.theme = theme;
  localStorage.setItem('examdesk.theme', theme);
  document.documentElement.dataset.theme = theme;
}

function setToken(token) {
  state.token = token;
  if (token) localStorage.setItem('examdesk.token', token);
  else localStorage.removeItem('examdesk.token');
}

function logout(showMessage = true) {
  setToken(null);
  state.user = null;
  state.student = null;
  state.route = 'dashboard';
  location.hash = '';
  render();
  if (showMessage) toast('Signed out for your security.', 'warning');
}

function adminRole() {
  return state.user && ['super_admin', 'staff'].includes(state.user.role);
}

function ownerRole() {
  return state.user?.role === 'super_admin';
}

async function bootstrap() {
  setTheme(state.theme);
  if (!state.token) {
    render();
    return;
  }
  try {
    const me = await api('/api/me');
    state.user = me.user;
    state.student = me.student;
    if (state.user.role === 'student') state.route = 'profile';
    await loadRouteData();
  } catch {
    setToken(null);
  }
  render();
  resetInactivityTimer();
}

async function navigate(route) {
  state.route = route;
  if (location.hash !== `#/${route}`) history.pushState(null, '', `#/${route}`);
  await loadRouteData();
  render();
}

async function loadRouteData() {
  if (!state.user) return;
  if (state.user.role === 'student') {
    const profile = await api(`/api/students/${state.user.studentId}`);
    state.data.profile = profile;
    state.student = profile.student;
    return;
  }

  if (!state.data.shifts.length || ['students', 'seats', 'shifts'].includes(state.route)) {
    const shifts = await api('/api/shifts');
    state.data.shifts = shifts.shifts;
    if (!state.filters.seatShift && shifts.shifts[0]) state.filters.seatShift = shifts.shifts[0].id;
  }

  if (state.route === 'dashboard') {
    state.data.dashboard = await api('/api/dashboard');
  }

  if (state.route === 'students') {
    const params = new URLSearchParams({
      search: state.filters.search,
      filter: state.filters.filter,
      shift: state.filters.shift,
      feeStatus: state.filters.feeStatus
    });
    const data = await api(`/api/students?${params}`);
    state.data.students = data.students;
  }

  if (state.route === 'attendance') {
    const data = await api(`/api/attendance?date=${state.filters.attendanceDate}`);
    state.data.attendance = data;
    const students = await api('/api/students');
    state.data.students = students.students;
  }

  if (state.route === 'fees') {
    const [payments, students] = await Promise.all([api('/api/payments'), api('/api/students')]);
    state.data.payments = payments.payments;
    state.data.students = students.students;
  }

  if (state.route === 'seats') {
    const data = await api(`/api/seats?shift=${state.filters.seatShift}`);
    state.data.seats = data.seats;
    state.data.students = data.students;
  }

  if (state.route === 'reports') {
    state.data.reports = await api('/api/reports');
  }

  if (state.route === 'notifications') {
    const [notifications, students] = await Promise.all([api('/api/notifications'), api('/api/students')]);
    state.data.notifications = notifications.notifications;
    state.data.students = students.students;
  }

  if (state.route === 'settings') {
    if (ownerRole()) {
      const staff = await api('/api/staff');
      state.data.staff = staff.staff;
    }
  }
}

function render() {
  document.documentElement.dataset.theme = state.theme;
  if (!state.user) {
    app.innerHTML = renderPublic();
  } else {
    app.innerHTML = renderShell();
  }
}

function renderPublic() {
  const content = {
    landing: renderLanding(),
    about: renderAbout(),
    pricing: renderPricing(),
    contact: renderContact()
  }[state.publicPage || 'landing'];

  return `
    <div class="auth-shell">
      <header class="public-nav">
        <button class="brand link-button" data-public="landing" aria-label="ExamDesk home">
          <span class="brand-mark">E</span>
          <span>ExamDesk Library OS</span>
        </button>
        <nav class="public-links" aria-label="Public pages">
          <button data-public="about">About</button>
          <button data-public="pricing">Pricing</button>
          <button data-public="contact">Contact</button>
          <button class="btn ghost" data-public="landing">Login</button>
        </nav>
      </header>
      <main class="auth-main">
        ${content}
        ${renderLoginCard()}
      </main>
    </div>
    <div class="toast-region"></div>
  `;
}

function renderLanding() {
  return `
    <section class="auth-copy">
      <span class="eyebrow">Secure reading room operations</span>
      <h1>Run a premium competitive exam library with calm, complete control.</h1>
      <p class="lead">Manage students, seats, shifts, attendance, fees, reminders, and reports from one private dashboard built for UPSC, SSC, Banking, JEE, NEET, CAT, and serious daily study spaces.</p>
      <div class="hero-proof" aria-label="Dashboard highlights">
        <div class="proof-tile"><strong>QR</strong><span>check-in and check-out attendance</span></div>
        <div class="proof-tile"><strong>RBAC</strong><span>owner-only controls for financial and sensitive data</span></div>
        <div class="proof-tile"><strong>Live</strong><span>seat, shift, fee, and membership analytics</span></div>
      </div>
      <div class="feature-band">
        ${feature('Students', 'Full student records, photos, expiry dates, seat allocation, and smart search.')}
        ${feature('Billing', 'UPI, cash, card, bank transfer, reminders, receipts, and pending fee views.')}
        ${feature('Seats', 'Visual layout with available, occupied, and reserved seat status.')}
        ${feature('Security', 'Hashed passwords, signed tokens, data backups, and inactivity logout.')}
      </div>
    </section>
  `;
}

function renderAbout() {
  return `
    <section class="auth-copy">
      <span class="eyebrow">Built for exam preparation spaces</span>
      <h1>Every daily library workflow, organized for speed.</h1>
      <p class="lead">ExamDesk focuses on real reading room operations: fixed study shifts, reusable seats, daily attendance, fee cycles, parent/contact records, and private owner-level reporting.</p>
      <div class="feature-band">
        ${feature('Owner dashboard', 'Monitor attendance, revenue, occupancy, pending dues, and expiring memberships.')}
        ${feature('Student portal', 'Students can view profile data, attendance, fee status, and receipts.')}
        ${feature('Private by default', 'The admin controls all sensitive edits and financial exports.')}
        ${feature('Responsive', 'Desktop dashboard, tablet views, and mobile bottom navigation are included.')}
      </div>
    </section>
  `;
}

function renderPricing() {
  return `
    <section class="auth-copy">
      <span class="eyebrow">SaaS-ready model</span>
      <h1>Designed to scale from one room to many branches.</h1>
      <p class="lead">The included architecture supports owner accounts, staff access, student self-service, payment records, reports, and future multi-branch billing plans.</p>
      <div class="hero-proof">
        <div class="proof-tile"><strong>Starter</strong><span>single reading room operations</span></div>
        <div class="proof-tile"><strong>Growth</strong><span>staff accounts and reminder automation</span></div>
        <div class="proof-tile"><strong>Scale</strong><span>analytics, exports, backups, and storage</span></div>
      </div>
    </section>
  `;
}

function renderContact() {
  return `
    <section class="auth-copy">
      <span class="eyebrow">Contact ready</span>
      <h1>A clean public front door for your library.</h1>
      <p class="lead">Use this area for your branch address, WhatsApp number, admission inquiry form, and public pricing once you connect a production backend and notification provider.</p>
      <div class="feature-band">
        ${feature('Admissions', 'Collect student inquiries and convert them into profiles.')}
        ${feature('WhatsApp', 'Connect fee due reminders and admission follow-ups.')}
      </div>
    </section>
  `;
}

function feature(title, copy) {
  return `
    <div class="feature-item">
      <span class="feature-icon">${icon('shield')}</span>
      <div><strong>${safe(title)}</strong><br><span class="muted">${safe(copy)}</span></div>
    </div>
  `;
}

function renderLoginCard() {
  return `
    <aside class="auth-card" aria-label="Secure login">
      <form id="login-form">
        <div>
          <h2>Secure Login</h2>
          <p class="muted">Admin, staff, and student access are separated with role-based permissions.</p>
        </div>
        <div class="field">
          <label for="identifier">Email or mobile</label>
          <input id="identifier" name="identifier" autocomplete="username" value="owner@examdesk.local" required />
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input id="password" name="password" type="password" autocomplete="current-password" value="Admin@12345" required />
        </div>
        <button class="btn primary" type="submit">${icon('shield')} Sign in securely</button>
        <p class="error-message" id="login-error"></p>
        <div class="demo-access">
          <strong>Local demo access</strong>
          <span>Owner: owner@examdesk.local / Admin@12345</span>
          <span>Student: aarav@examdesk.local / Student@123</span>
        </div>
      </form>
    </aside>
  `;
}

function renderShell() {
  const isStudent = state.user.role === 'student';
  const items = isStudent ? studentNavItems : navItems;
  const [title, subtitle] = routeMeta[state.route] || routeMeta.dashboard;
  return `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          <span class="brand-mark">E</span>
          <span>ExamDesk Library OS</span>
        </div>
        <div class="library-card">
          <strong>${safe(state.user.name)}</strong>
          <span class="muted">${safe(state.user.role.replace('_', ' '))}</span>
        </div>
        <nav class="nav-list" aria-label="Dashboard navigation">
          ${items.map(renderNavItem).join('')}
        </nav>
        <button class="btn ghost" data-logout>${icon('logout')} Sign out</button>
      </aside>
      <section class="main-region">
        <header class="topbar">
          <div class="page-title">
            <h2>${safe(title)}</h2>
            <p>${safe(subtitle)}</p>
          </div>
          <div class="top-actions">
            <button class="btn icon ghost" data-theme title="Toggle theme" aria-label="Toggle theme">${icon(state.theme === 'dark' ? 'sun' : 'moon')}</button>
            ${adminRole() ? `<button class="btn soft" data-open-student>${icon('plus')} Add student</button>` : ''}
            <button class="btn ghost" data-logout>${icon('logout')} Logout</button>
          </div>
        </header>
        <main class="content">${renderRoute()}</main>
      </section>
      <nav class="bottom-nav" aria-label="Mobile navigation">
        ${items.slice(0, 5).map(renderNavItem).join('')}
      </nav>
    </div>
    ${renderModal()}
    <div class="toast-region"></div>
  `;
}

function renderNavItem([route, label, iconName]) {
  return `
    <button class="nav-item ${state.route === route ? 'active' : ''}" data-nav="${safe(route)}">
      <span class="nav-icon">${icon(iconName)}</span>
      <span class="nav-label">${safe(label)}</span>
    </button>
  `;
}

function renderRoute() {
  if (state.user.role === 'student') {
    if (state.route === 'attendance') return renderStudentAttendance();
    if (state.route === 'fees') return renderStudentFees();
    return renderStudentProfile();
  }

  const routes = {
    dashboard: renderDashboard,
    students: renderStudents,
    attendance: renderAttendance,
    fees: renderFees,
    seats: renderSeats,
    shifts: renderShifts,
    reports: renderReports,
    notifications: renderNotifications,
    settings: renderSettings
  };
  return (routes[state.route] || renderDashboard)();
}

function renderDashboard() {
  const data = state.data.dashboard;
  if (!data) return renderEmpty('Dashboard data is loading.');
  const stats = data.stats;
  return `
    <section class="metric-grid">
      ${metric('Total students', stats.totalStudents, 'Across all memberships', 'users')}
      ${metric('Active memberships', stats.activeMemberships, `${stats.expiringMemberships} expiring soon`, 'shield')}
      ${metric('Pending fees', stats.pendingFees, 'Needs reminder follow-up', 'receipt')}
      ${metric('Monthly revenue', money(stats.monthlyRevenue), 'Collected this month', 'chart')}
      ${metric("Today's attendance", stats.todaysAttendance, 'QR check-ins recorded', 'scan')}
      ${metric('Empty seats', stats.emptySeats, 'Across active shifts', 'grid')}
      ${metric('Shift occupancy', `${Math.round(avg(data.shiftOccupancy.map((s) => s.percentage)))}%`, 'Average usage', 'clock')}
      ${metric('Student growth', data.studentGrowth.at(-1)?.students || 0, 'Current active base', 'chart')}
    </section>
    <section class="grid-2">
      <div class="panel">
        <div class="panel-header"><div><h3>Attendance Trend</h3><p>Present count for the last 7 days.</p></div></div>
        ${renderLineChart(data.attendanceTrend, 'present')}
      </div>
      <div class="panel">
        <div class="panel-header"><div><h3>Shift Occupancy</h3><p>Capacity usage by study shift.</p></div></div>
        ${renderBars(data.shiftOccupancy, 'name', 'percentage', '%')}
      </div>
    </section>
    <section class="grid-2">
      <div class="panel">
        <div class="panel-header"><div><h3>Pending Fee Follow-ups</h3><p>Students requiring reminders.</p></div><button class="btn soft" data-nav="fees">Open fees</button></div>
        ${renderStudentMiniList(data.pendingStudents)}
      </div>
      <div class="panel">
        <div class="panel-header"><div><h3>Expiring Memberships</h3><p>Renewals due within 7 days.</p></div><button class="btn soft" data-nav="students">Review</button></div>
        ${renderStudentMiniList(data.expiringMemberships)}
      </div>
    </section>
  `;
}

function metric(label, value, note, iconName) {
  return `
    <article class="metric-card">
      <header>
        <span class="metric-label">${safe(label)}</span>
        <span class="stat-icon">${icon(iconName)}</span>
      </header>
      <div>
        <strong class="metric-value">${safe(value)}</strong>
        <small>${safe(note)}</small>
      </div>
    </article>
  `;
}

function renderLineChart(items, key) {
  const max = Math.max(1, ...items.map((item) => Number(item[key] || 0)));
  return `
    <div class="line-chart">
      ${items
        .map(
          (item) => `
        <div class="line-column">
          <div class="line-bar" style="height:${Math.max(8, (Number(item[key] || 0) / max) * 180)}px"></div>
          <strong>${safe(item[key])}</strong>
          <span class="muted">${safe(item.label || item.month)}</span>
        </div>
      `
        )
        .join('')}
    </div>
  `;
}

function renderBars(items, labelKey, valueKey, suffix = '') {
  const max = Math.max(1, ...items.map((item) => Number(item[valueKey] || 0)));
  return `
    <div class="bar-chart">
      ${items
        .map(
          (item) => `
        <div class="bar-row">
          <strong>${safe(item[labelKey])}</strong>
          <div class="bar-track"><span class="bar-fill" style="width:${Math.max(4, (Number(item[valueKey] || 0) / max) * 100)}%"></span></div>
          <span class="muted">${safe(item[valueKey])}${suffix}</span>
        </div>
      `
        )
        .join('')}
    </div>
  `;
}

function renderStudentMiniList(students = []) {
  if (!students.length) return renderEmpty('Nothing needs attention here.');
  return `
    <div class="mini-list">
      ${students
        .map(
          (student) => `
        <div class="draggable-student">
          <div class="person-cell">
            <img class="avatar" alt="" src="${safe(student.photo)}" />
            <div><strong>${safe(student.fullName)}</strong><span class="muted">${safe(student.id)} · ${safe(student.seatNumber)} · ${safe(student.shiftName)}</span></div>
          </div>
          ${badge(student.feeStatus || student.membershipStatus)}
        </div>
      `
        )
        .join('')}
    </div>
  `;
}

function renderStudents() {
  const students = state.data.students || [];
  return `
    <section class="panel">
      <div class="panel-header">
        <div><h3>Smart Search</h3><p>Find students by name, phone, student ID, seat, shift, exam, or fee status.</p></div>
        <button class="btn primary" data-open-student>${icon('plus')} New student</button>
      </div>
      <div class="search-panel">
        <div class="field">
          <label>Search</label>
          <input class="search-input" data-student-search value="${safe(state.filters.search)}" placeholder="Name, phone, ID, seat, shift..." />
        </div>
        <div class="field">
          <label>Advanced filter</label>
          <select data-student-filter>
            ${option('all', 'All students', state.filters.filter)}
            ${option('active', 'Active students', state.filters.filter)}
            ${option('expired', 'Expired memberships', state.filters.filter)}
            ${option('pending-fees', 'Pending fees', state.filters.filter)}
            ${option('morning', 'Morning shift', state.filters.filter)}
            ${option('evening', 'Evening shift', state.filters.filter)}
            ${option('absent-many-days', 'Absent many days', state.filters.filter)}
          </select>
        </div>
        <div class="field">
          <label>Shift</label>
          <select data-student-shift>${option('all', 'All shifts', state.filters.shift)}${state.data.shifts.map((s) => option(s.id, s.name, state.filters.shift)).join('')}</select>
        </div>
        <div class="field">
          <label>Fee status</label>
          <select data-student-fee>
            ${option('all', 'All fees', state.filters.feeStatus)}
            ${option('paid', 'Paid', state.filters.feeStatus)}
            ${option('pending', 'Pending', state.filters.feeStatus)}
            ${option('overdue', 'Overdue', state.filters.feeStatus)}
          </select>
        </div>
        <button class="btn ghost" data-refresh-students>${icon('search')} Search</button>
      </div>
    </section>
    <section class="panel">
      <div class="table-header panel-header">
        <div><h3>Students</h3><p>${students.length} matching record${students.length === 1 ? '' : 's'}.</p></div>
      </div>
      ${
        students.length
          ? `<div class="table-shell">
        <table>
          <thead><tr><th>Student</th><th>Seat</th><th>Shift</th><th>Fee</th><th>Attendance</th><th>Expiry</th><th>Actions</th></tr></thead>
          <tbody>${students.map(renderStudentRow).join('')}</tbody>
        </table>
      </div>`
          : renderEmpty('No students match this search.')
      }
    </section>
    ${renderStudentProfileDirectory(students)}
  `;
}

function renderStudentRow(student) {
  return `
    <tr>
      <td>
        <div class="person-cell">
          <img class="avatar" src="${safe(student.photo)}" alt="" />
          <div>
            <strong>${safe(student.fullName)}</strong>
            <span class="muted">${safe(student.id)} · ${safe(student.mobile)}</span>
          </div>
        </div>
      </td>
      <td><strong>${safe(student.seatNumber)}</strong></td>
      <td>${safe(student.shiftName)}<br><span class="muted">${safe(student.shiftTiming)}</span></td>
      <td>${badge(student.feeStatus)}<br><span class="muted">${money(student.pendingAmount)} pending</span></td>
      <td><div class="progress"><span style="width:${student.attendancePercentage}%"></span></div><span class="muted">${percent(student.attendancePercentage)}</span></td>
      <td>${badge(student.membershipStatus)}<br><span class="muted">${niceDate(student.expiryDate)}</span></td>
      <td>
        <div class="row-actions">
          <button class="btn icon ghost" title="View" data-view-student="${safe(student.id)}">${icon('eye')}</button>
          <button class="btn icon ghost" title="Edit" data-edit-student="${safe(student.id)}">${icon('edit')}</button>
          <button class="btn icon soft" title="Collect payment" data-pay-student="${safe(student.id)}">${icon('receipt')}</button>
          ${ownerRole() ? `<button class="btn icon ghost" title="Delete" data-delete-student="${safe(student.id)}">${icon('trash')}</button>` : ''}
        </div>
      </td>
    </tr>
  `;
}

function renderStudentProfileDirectory(students = []) {
  if (!students.length) return '';
  return `
    <section class="profile-directory">
      <div class="panel-header">
        <div>
          <h3>Complete Student Profiles</h3>
          <p>Every matching student with personal, library, fee, attendance, and contact details.</p>
        </div>
      </div>
      <div class="student-profile-grid">
        ${students.map(renderStudentProfileCard).join('')}
      </div>
    </section>
  `;
}

function renderStudentProfileCard(student) {
  return `
    <article class="student-profile-card">
      <header class="student-profile-head">
        <div class="person-cell">
          <img class="avatar large" src="${safe(student.photo)}" alt="" />
          <div>
            <h3>${safe(student.fullName)}</h3>
            <span class="muted">${safe(student.id)} · ${safe(student.examTrack)}</span>
          </div>
        </div>
        <div class="chip-row">
          ${badge(student.membershipStatus)}
          ${badge(student.feeStatus)}
        </div>
      </header>
      <div class="profile-card-sections">
        ${detailSection('Personal Details', [
          ['Father name', student.fatherName],
          ['Gender', student.gender],
          ['Date of birth', niceDate(student.dob)],
          ['Mobile', student.mobile],
          ['Email', student.email || 'Not added'],
          ['Address', student.address || 'Not added']
        ])}
        ${detailSection('Library Details', [
          ['Date joined', niceDate(student.dateJoined)],
          ['Expiry date', niceDate(student.expiryDate)],
          ['Selected shift', student.shiftName],
          ['Shift timing', student.shiftTiming],
          ['Seat number', student.seatNumber],
          ['Study hours', `${student.studyHours} hours`]
        ])}
        ${detailSection('Fee Details', [
          ['Monthly fees', money(student.monthlyFees)],
          ['Paid amount', money(student.paidAmount)],
          ['Pending amount', money(student.pendingAmount)],
          ['Payment method', student.paymentMethod || 'Not recorded'],
          ['Due date', niceDate(student.dueDate)],
          ['Fee status', student.feeStatus]
        ])}
        ${detailSection('Attendance & Security', [
          ['Attendance', percent(student.attendancePercentage)],
          ['QR token', student.qrToken],
          ['Membership', student.membershipStatus],
          ['Notes', student.notes || 'No notes']
        ])}
      </div>
      <footer class="student-profile-actions">
        <button class="btn ghost" data-view-student="${safe(student.id)}">${icon('eye')} View logs</button>
        <button class="btn ghost" data-edit-student="${safe(student.id)}">${icon('edit')} Edit profile</button>
        <button class="btn soft" data-pay-student="${safe(student.id)}">${icon('receipt')} Collect fee</button>
      </footer>
    </article>
  `;
}

function detailSection(title, rows) {
  return `
    <div class="detail-section">
      <strong>${safe(title)}</strong>
      <div class="detail-list">
        ${rows
          .map(
            ([label, value]) => `
          <div class="detail-item">
            <span>${safe(label)}</span>
            <b>${safe(value ?? 'Not added')}</b>
          </div>
        `
          )
          .join('')}
      </div>
    </div>
  `;
}

function renderAttendance() {
  const data = state.data.attendance;
  const students = state.data.students || [];
  if (!data) return renderEmpty('Attendance data is loading.');
  return `
    <section class="grid-2">
      <div class="panel">
        <div class="panel-header">
          <div><h3>QR Attendance</h3><p>Select a student and mark secure check-in or check-out.</p></div>
        </div>
        <div class="form-grid two">
          <div class="field">
            <label>Student</label>
            <select data-qr-student>${students.map((s) => option(s.id, `${s.fullName} · ${s.id}`, '')).join('')}</select>
          </div>
          <div class="field">
            <label>Action</label>
            <select data-qr-action>${option('auto', 'Auto check-in/out', 'auto')}${option('check-in', 'Check in', '')}${option('check-out', 'Check out', '')}</select>
          </div>
        </div>
        <div class="qr-box">
          <div>
            ${renderQr(students[0]?.qrToken || 'ExamDesk')}
            <p class="muted">Student scan simulation for front desk QR attendance.</p>
            <button class="btn primary" data-scan-attendance>${icon('scan')} Mark attendance</button>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-header">
          <div><h3>Peak Hours</h3><p>Check-ins by hour for selected day.</p></div>
          <input type="date" class="search-input" data-attendance-date value="${safe(state.filters.attendanceDate)}" />
        </div>
        ${renderBars(data.peakHours.filter((h) => h.count > 0), 'hour', 'count')}
      </div>
    </section>
    <section class="grid-2">
      <div class="panel">
        <div class="panel-header"><div><h3>Daily Attendance</h3><p>${data.logs.length} students present on ${niceDate(data.date)}.</p></div></div>
        ${renderAttendanceTable(data.logs)}
      </div>
      <div class="panel">
        <div class="panel-header"><div><h3>Absent Students</h3><p>${data.absent.length} active students absent.</p></div></div>
        ${renderStudentMiniList(data.absent.slice(0, 12))}
      </div>
    </section>
  `;
}

function renderAttendanceTable(logs = []) {
  if (!logs.length) return renderEmpty('No attendance logs for this date.');
  return `
    <div class="table-shell">
      <table>
        <thead><tr><th>Student</th><th>Seat</th><th>Check in</th><th>Check out</th><th>Source</th></tr></thead>
        <tbody>
          ${logs
            .map(
              (log) => `
            <tr>
              <td><div class="person-cell"><img class="avatar" alt="" src="${safe(log.student.photo)}"><div><strong>${safe(log.student.fullName)}</strong><span class="muted">${safe(log.student.id)}</span></div></div></td>
              <td>${safe(log.student.seatNumber)}</td>
              <td>${niceTime(log.checkIn)}</td>
              <td>${niceTime(log.checkOut)}</td>
              <td>${badge(log.source)}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderFees() {
  const payments = state.data.payments || [];
  const pending = (state.data.students || []).filter((student) => ['pending', 'overdue'].includes(student.feeStatus));
  return `
    <section class="metric-grid">
      ${metric('Pending accounts', pending.length, 'Students with pending or overdue dues', 'receipt')}
      ${metric('Overdue', pending.filter((s) => s.feeStatus === 'overdue').length, 'Needs immediate follow-up', 'bell')}
      ${metric('Collected records', payments.length, 'Successful payment entries', 'chart')}
      ${metric('Pending amount', money(pending.reduce((sum, s) => sum + Number(s.pendingAmount || 0), 0)), 'Outstanding balance', 'shield')}
    </section>
    <section class="grid-2">
      <div class="panel">
        <div class="panel-header"><div><h3>Pending Fees</h3><p>Collect monthly subscriptions and send reminders.</p></div><button class="btn soft" data-send-reminders>${icon('bell')} Send reminders</button></div>
        ${renderPendingFeeList(pending)}
      </div>
      <div class="panel">
        <div class="panel-header"><div><h3>Recent Payments</h3><p>Open receipts or collect another payment.</p></div></div>
        ${renderPaymentTable(payments)}
      </div>
    </section>
  `;
}

function renderPaymentTable(payments = []) {
  if (!payments.length) return renderEmpty('No payments yet.');
  return `
    <div class="table-shell">
      <table>
        <thead><tr><th>Receipt</th><th>Student</th><th>Amount</th><th>Method</th><th>Date</th><th>Actions</th></tr></thead>
        <tbody>
          ${payments
            .map(
              (payment) => `
            <tr>
              <td><strong>${safe(payment.receiptNumber)}</strong><br><span class="muted">${safe(payment.month)}</span></td>
              <td>${safe(payment.student?.fullName || payment.studentId)}</td>
              <td>${money(payment.amount)}</td>
              <td>${badge(payment.method)}</td>
              <td>${niceDate(payment.paidAt)}</td>
              <td><button class="btn icon ghost" data-receipt="${safe(payment.id)}" title="Receipt">${icon('download')}</button></td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderPendingFeeList(students = []) {
  if (!students.length) return renderEmpty('No pending fee accounts right now.');
  return `
    <div class="mini-list">
      ${students
        .map(
          (student) => `
        <div class="draggable-student">
          <div class="person-cell">
            <img class="avatar" alt="" src="${safe(student.photo)}" />
            <div><strong>${safe(student.fullName)}</strong><span class="muted">${safe(student.id)} · ${safe(student.seatNumber)} · ${money(student.pendingAmount)} pending</span></div>
          </div>
          <button class="btn soft" data-pay-student="${safe(student.id)}">${icon('receipt')} Collect</button>
        </div>
      `
        )
        .join('')}
    </div>
  `;
}

function renderSeats() {
  const shifts = state.data.shifts || [];
  const seats = state.data.seats || [];
  const students = (state.data.students || []).filter((student) => student.selectedShift === state.filters.seatShift);
  return `
    <section class="panel">
      <div class="panel-header">
        <div><h3>Interactive Seat Layout</h3><p>Green is available, red is occupied, yellow is reserved. Drag a student onto an available seat.</p></div>
        <div class="field">
          <label>Shift view</label>
          <select data-seat-shift>${shifts.map((s) => option(s.id, s.name, state.filters.seatShift)).join('')}</select>
        </div>
      </div>
      <div class="seat-toolbar">
        <div>
          <h3>Students in shift</h3>
          <div class="draggable-list">
            ${students
              .map(
                (student) => `
              <div class="draggable-student" draggable="true" data-drag-student="${safe(student.id)}">
                <div><strong>${safe(student.fullName)}</strong><br><span class="muted">${safe(student.seatNumber)} · ${safe(student.id)}</span></div>
                ${badge(student.feeStatus)}
              </div>
            `
              )
              .join('')}
          </div>
        </div>
        <div class="seat-layout">
          ${seats
            .map(
              (seat) => `
            <button class="seat-cell ${safe(seat.status)}" data-seat="${safe(seat.number)}" title="${safe(seat.assignedStudentName || seat.notes || seat.status)}">
              <span class="seat-number">${safe(seat.number)}</span>
              <span class="seat-student">${safe(seat.assignedStudentName || seat.status)}</span>
            </button>
          `
            )
            .join('')}
        </div>
      </div>
    </section>
  `;
}

function renderShifts() {
  const shifts = state.data.shifts || [];
  return `
    <section class="panel">
      <div class="panel-header">
        <div><h3>Shift Capacity</h3><p>Add, edit, delete, and monitor every four-hour, combined, or full-day shift.</p></div>
        ${ownerRole() ? `<button class="btn primary" data-open-shift>${icon('plus')} New shift</button>` : ''}
      </div>
      <div class="shift-grid">
        ${shifts
          .map(
            (shift) => `
          <article class="shift-card">
            <header>
              <div><h3>${safe(shift.name)}</h3><span class="muted">${safe(shift.startsAt)} - ${safe(shift.endsAt)} · ${shift.studyHours} hours</span></div>
              ${badge(`${shift.percentage}%`)}
            </header>
            <div class="student-meta">
              <div class="meta-item"><span>Occupied</span><strong>${shift.occupied}</strong></div>
              <div class="meta-item"><span>Capacity</span><strong>${shift.capacity}</strong></div>
            </div>
            <div class="progress"><span style="width:${Math.min(100, shift.percentage)}%"></span></div>
            ${ownerRole() ? `<div class="row-actions" style="margin-top:12px"><button class="btn ghost" data-edit-shift="${safe(shift.id)}">${icon('edit')} Edit</button><button class="btn ghost" data-delete-shift="${safe(shift.id)}">${icon('trash')} Delete</button></div>` : ''}
          </article>
        `
          )
          .join('')}
      </div>
    </section>
  `;
}

function renderReports() {
  const data = state.data.reports;
  if (!data) return renderEmpty('Reports are loading.');
  return `
    <section class="report-grid">
      <article class="report-tile"><header><h3>Fee Aging</h3>${icon('receipt')}</header>${renderBars(Object.entries(data.feeAging).map(([name, value]) => ({ name, value })), 'name', 'value')}</article>
      <article class="report-tile"><header><h3>Revenue</h3>${icon('chart')}</header>${renderLineChart(data.revenueTrend, 'revenue')}</article>
      <article class="report-tile"><header><h3>Student Growth</h3>${icon('users')}</header>${renderLineChart(data.studentGrowth, 'students')}</article>
    </section>
    <section class="grid-2">
      <div class="panel">
        <div class="panel-header"><div><h3>Low Attendance Risk</h3><p>Students below 65% in the recent window.</p></div></div>
        ${renderStudentMiniList(data.lowAttendance)}
      </div>
      <div class="panel">
        <div class="panel-header"><div><h3>Exports & Audit</h3><p>Owner-only financial and student records.</p></div><button class="btn primary" data-export-students>${icon('download')} Export CSV</button></div>
        ${renderAuditTable(data.auditLog)}
      </div>
    </section>
  `;
}

function renderAuditTable(logs = []) {
  if (!logs.length) return renderEmpty('No audit activity yet.');
  return `
    <div class="table-shell">
      <table>
        <thead><tr><th>Action</th><th>Entity</th><th>Actor</th><th>Time</th></tr></thead>
        <tbody>${logs
          .map(
            (log) => `
          <tr><td>${safe(log.action)}</td><td>${safe(log.entity)} · ${safe(log.entityId)}</td><td>${safe(log.actorRole)}</td><td>${niceTime(log.createdAt)} ${niceDate(log.createdAt)}</td></tr>
        `
          )
          .join('')}</tbody>
      </table>
    </div>
  `;
}

function renderNotifications() {
  const notifications = state.data.notifications || [];
  const pending = (state.data.students || []).filter((student) => ['pending', 'overdue'].includes(student.feeStatus));
  return `
    <section class="metric-grid">
      ${metric('Queued reminders', notifications.filter((n) => n.status === 'queued').length, 'Ready for SMS or WhatsApp provider', 'bell')}
      ${metric('Students due', pending.length, 'Pending or overdue accounts', 'users')}
      ${metric('Channels', 'SMS + WhatsApp', 'Provider-ready architecture', 'shield')}
      ${metric('Privacy', 'Owner controlled', 'No financial data exposed publicly', 'shield')}
    </section>
    <section class="panel">
      <div class="panel-header">
        <div><h3>Reminder Center</h3><p>Queue reminders for all students with pending or overdue fees.</p></div>
        <button class="btn primary" data-send-reminders>${icon('bell')} Queue fee reminders</button>
      </div>
      <div class="notification-grid">
        ${notifications
          .map(
            (note) => `
          <article class="notification-card">
            <header><div><h3>${safe(note.title)}</h3><span class="muted">${safe(note.channel)} · ${niceDate(note.createdAt)}</span></div>${badge(note.status)}</header>
            <p class="muted">${safe(note.body)}</p>
          </article>
        `
          )
          .join('')}
      </div>
    </section>
  `;
}

function renderSettings() {
  return `
    <section class="grid-2">
      <div class="panel">
        <div class="panel-header"><div><h3>Security Controls</h3><p>Admin access is protected by signed tokens, role checks, inactivity logout, and hashed passwords.</p></div></div>
        <div class="feature-band">
          ${feature('JWT-style tokens', 'Eight-hour signed access tokens with client inactivity logout.')}
          ${feature('Encrypted passwords', 'PBKDF2 hashes and salts are stored instead of plain text.')}
          ${feature('Role-based access', 'Only the owner can delete records, export reports, create staff, and back up data.')}
          ${feature('Private storage', 'Photos and records stay inside the server data layer in this starter.')}
        </div>
        ${ownerRole() ? `<div class="button-row" style="margin-top:16px"><button class="btn primary" data-create-backup>${icon('download')} Create backup</button><button class="btn ghost" data-open-staff>${icon('plus')} Add staff</button></div>` : ''}
      </div>
      <div class="panel">
        <div class="panel-header"><div><h3>Staff Accounts</h3><p>Create front-desk accounts without owner financial export permissions.</p></div></div>
        ${ownerRole() ? renderStaffTable() : renderEmpty('Only the library owner can manage staff accounts.')}
      </div>
    </section>
  `;
}

function renderStaffTable() {
  const staff = state.data.staff || [];
  return `
    <div class="table-shell">
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr></thead>
        <tbody>${staff
          .map(
            (user) => `<tr><td>${safe(user.name)}</td><td>${safe(user.email)}</td><td>${badge(user.role)}</td><td>${badge(user.status)}</td></tr>`
          )
          .join('')}</tbody>
      </table>
    </div>
  `;
}

function renderStudentProfile() {
  const profile = state.data.profile;
  const student = profile?.student || state.student;
  if (!student) return renderEmpty('Profile is loading.');
  return `
    <section class="panel">
      <div class="profile-header">
        <div class="person-cell">
          <img class="avatar large" alt="" src="${safe(student.photo)}">
          <div><h2>${safe(student.fullName)}</h2><p class="muted">${safe(student.id)} · ${safe(student.examTrack)} · Seat ${safe(student.seatNumber)}</p></div>
        </div>
        ${badge(student.feeStatus)}
      </div>
      <div class="profile-grid">
        ${profileBlock('Library', [
          ['Shift', student.shiftName],
          ['Timing', student.shiftTiming],
          ['Joined', niceDate(student.dateJoined)],
          ['Expiry', niceDate(student.expiryDate)]
        ])}
        ${profileBlock('Fees', [
          ['Monthly', money(student.monthlyFees)],
          ['Paid', money(student.paidAmount)],
          ['Pending', money(student.pendingAmount)],
          ['Due date', niceDate(student.dueDate)]
        ])}
        ${profileBlock('Attendance', [
          ['Attendance', percent(student.attendancePercentage)],
          ['QR token', student.qrToken],
          ['Mobile', student.mobile],
          ['Address', student.address]
        ])}
      </div>
    </section>
  `;
}

function renderStudentAttendance() {
  const profile = state.data.profile;
  const logs = profile?.attendance || [];
  return `
    <section class="grid-2">
      <div class="panel">
        <div class="panel-header"><div><h3>My Attendance</h3><p>Recent check-in and check-out records.</p></div><button class="btn primary" data-student-scan>${icon('scan')} Scan QR</button></div>
        ${renderAttendanceTable(logs.map((log) => ({ ...log, student: profile.student })))}
      </div>
      <div class="panel">
        <div class="panel-header"><div><h3>My QR</h3><p>Use this token for secure attendance.</p></div></div>
        <div class="qr-box">${renderQr(profile.student.qrToken)}<p class="muted">${safe(profile.student.qrToken)}</p></div>
      </div>
    </section>
  `;
}

function renderStudentFees() {
  const profile = state.data.profile;
  const payments = profile?.payments || [];
  return `
    <section class="metric-grid">
      ${metric('Fee status', profile.student.feeStatus, `Due ${niceDate(profile.student.dueDate)}`, 'receipt')}
      ${metric('Monthly fee', money(profile.student.monthlyFees), 'Current subscription', 'chart')}
      ${metric('Paid amount', money(profile.student.paidAmount), 'This billing cycle', 'shield')}
      ${metric('Pending', money(profile.student.pendingAmount), 'Outstanding balance', 'bell')}
    </section>
    <section class="panel">
      <div class="panel-header"><div><h3>Receipts</h3><p>Download or print payment receipts.</p></div></div>
      ${renderPaymentTable(payments.map((payment) => ({ ...payment, student: profile.student })))}
    </section>
  `;
}

function profileBlock(title, rows) {
  return `
    <article class="profile-block">
      <h3>${safe(title)}</h3>
      ${rows.map(([label, value]) => `<div class="receipt-row"><span class="muted">${safe(label)}</span><strong>${safe(value)}</strong></div>`).join('')}
    </article>
  `;
}

function renderQr(value) {
  const text = String(value || 'ExamDesk');
  const cells = Array.from({ length: 49 }).map((_, index) => {
    const code = text.charCodeAt(index % text.length) + index * 17;
    return `<span style="opacity:${code % 3 === 0 ? 0.16 : 1}"></span>`;
  });
  return `<div class="qr-code" aria-label="QR style attendance token">${cells.join('')}</div>`;
}

function renderModal() {
  if (!state.modal) return '';
  const close = `<button class="btn icon ghost" data-close-modal aria-label="Close">${icon('x')}</button>`;
  const content = {
    studentForm: renderStudentFormModal,
    studentProfile: renderStudentProfileModal,
    paymentForm: renderPaymentModal,
    receipt: renderReceiptModal,
    shiftForm: renderShiftModal,
    staffForm: renderStaffModal
  }[state.modal.type]?.();
  return content
    ? `<div class="modal-backdrop" role="dialog" aria-modal="true"><section class="modal">${content.replace('<!--close-->', close)}</section></div>`
    : '';
}

function renderStudentFormModal() {
  const student = state.modal.student || {};
  const isEdit = Boolean(student.id);
  return `
    <div class="modal-header">
      <div><h3>${isEdit ? 'Edit Student' : 'Add Student'}</h3><p class="muted">Complete personal, library, fee, and membership information.</p></div>
      <!--close-->
    </div>
    <form class="modal-body form-grid" id="student-form">
      <div class="form-grid three">
        ${field('fullName', 'Full name', student.fullName, 'text', true)}
        ${field('fatherName', 'Father name', student.fatherName)}
        ${field('mobile', 'Mobile number', student.mobile, 'tel', true)}
      </div>
      <div class="form-grid three">
        ${field('email', 'Student login email', student.email || '')}
        ${field('dob', 'Date of birth', student.dob || '', 'date')}
        <div class="field"><label>Gender</label><select name="gender">${['Male', 'Female', 'Other'].map((g) => option(g, g, student.gender)).join('')}</select></div>
      </div>
      <div class="form-grid two">
        ${field('examTrack', 'Exam track', student.examTrack || 'UPSC CSE')}
        <div class="field"><label>Photo upload</label><input name="photoFile" type="file" accept="image/*" /><span class="field-help">Passport-size photo is stored as a local data URL in this starter.</span></div>
      </div>
      <div class="field"><label>Full address</label><textarea name="address">${safe(student.address || '')}</textarea></div>
      <div class="form-grid three">
        ${field('dateJoined', 'Date joined', student.dateJoined || new Date().toISOString().slice(0, 10), 'date', true)}
        ${field('expiryDate', 'Expiry date', student.expiryDate || '', 'date', true)}
        <div class="field"><label>Selected shift</label><select name="selectedShift" required>${state.data.shifts.map((s) => option(s.id, s.name, student.selectedShift)).join('')}</select></div>
      </div>
      <div class="form-grid three">
        ${field('seatNumber', 'Seat number', student.seatNumber || 'A01', 'text', true)}
        ${field('studyHours', 'Study hours', student.studyHours || 4, 'number')}
        ${field('monthlyFees', 'Monthly fees', student.monthlyFees || 0, 'number')}
      </div>
      <div class="form-grid three">
        ${field('paidAmount', 'Paid amount', student.paidAmount || 0, 'number')}
        ${field('dueDate', 'Due date', student.dueDate || '', 'date', true)}
        <div class="field"><label>Payment method</label><select name="paymentMethod">${['UPI', 'Cash', 'Card', 'Bank transfer'].map((m) => option(m, m, student.paymentMethod)).join('')}</select></div>
      </div>
      <div class="button-row">
        <button class="btn primary" type="submit">${icon('shield')} Save student</button>
        <button class="btn ghost" type="button" data-close-modal>Cancel</button>
      </div>
    </form>
  `;
}

function renderStudentProfileModal() {
  const profile = state.modal.profile;
  const student = profile.student;
  return `
    <div class="modal-header">
      <div class="person-cell"><img class="avatar large" alt="" src="${safe(student.photo)}"><div><h3>${safe(student.fullName)}</h3><p class="muted">${safe(student.id)} · ${safe(student.examTrack)}</p></div></div>
      <!--close-->
    </div>
    <div class="modal-body stack">
      <div class="profile-grid">
        ${profileBlock('Personal', [
          ['Student ID', student.id],
          ['Father', student.fatherName],
          ['Gender', student.gender],
          ['DOB', niceDate(student.dob)],
          ['Mobile', student.mobile],
          ['Email', student.email || 'Not added'],
          ['Address', student.address || 'Not added']
        ])}
        ${profileBlock('Library', [
          ['Date joined', niceDate(student.dateJoined)],
          ['Shift', student.shiftName],
          ['Timing', student.shiftTiming],
          ['Seat', student.seatNumber],
          ['Study hours', student.studyHours],
          ['Expiry', niceDate(student.expiryDate)],
          ['Membership', student.membershipStatus]
        ])}
        ${profileBlock('Fee', [
          ['Monthly', money(student.monthlyFees)],
          ['Paid', money(student.paidAmount)],
          ['Pending', money(student.pendingAmount)],
          ['Method', student.paymentMethod || 'Not recorded'],
          ['Due date', niceDate(student.dueDate)],
          ['Status', student.feeStatus],
          ['Attendance', percent(student.attendancePercentage)],
          ['QR token', student.qrToken]
        ])}
      </div>
      <div class="panel" style="box-shadow:none">
        <div class="panel-header"><h3>Payment History</h3></div>
        ${renderPaymentTable(profile.payments.map((payment) => ({ ...payment, student })))}
      </div>
      <div class="panel" style="box-shadow:none">
        <div class="panel-header"><h3>Attendance Logs</h3></div>
        ${renderAttendanceTable(profile.attendance.map((log) => ({ ...log, student })))}
      </div>
    </div>
  `;
}

function renderPaymentModal() {
  const student = state.modal.student;
  return `
    <div class="modal-header">
      <div><h3>Collect Payment</h3><p class="muted">${safe(student.fullName)} · Pending ${money(student.pendingAmount)}</p></div>
      <!--close-->
    </div>
    <form class="modal-body form-grid" id="payment-form">
      <input type="hidden" name="studentId" value="${safe(student.id)}" />
      <div class="form-grid two">
        ${field('amount', 'Amount', student.pendingAmount || student.monthlyFees, 'number', true)}
        <div class="field"><label>Method</label><select name="method">${['UPI', 'Cash', 'Card', 'Bank transfer'].map((m) => option(m, m, 'UPI')).join('')}</select></div>
      </div>
      ${field('month', 'Billing month', new Date().toLocaleString('en', { month: 'long', year: 'numeric' }))}
      <div class="field"><label>Notes</label><textarea name="notes">Monthly library subscription</textarea></div>
      <div class="button-row">
        <button class="btn primary" type="submit">${icon('receipt')} Save payment</button>
        <button class="btn ghost" type="button" data-close-modal>Cancel</button>
      </div>
    </form>
  `;
}

function renderReceiptModal() {
  const receipt = state.modal.receipt;
  const { payment, student, library, city } = receipt;
  return `
    <div class="modal-header">
      <div><h3>Digital Receipt</h3><p class="muted">${safe(payment.receiptNumber)}</p></div>
      <!--close-->
    </div>
    <div class="modal-body stack">
      <div class="receipt">
        <div class="profile-header">
          <div><h2>${safe(library)}</h2><p class="muted">${safe(city)} · Competitive Exam Library</p></div>
          ${badge('success')}
        </div>
        <div class="receipt-row"><span>Receipt no.</span><strong>${safe(payment.receiptNumber)}</strong></div>
        <div class="receipt-row"><span>Student</span><strong>${safe(student.fullName)}</strong></div>
        <div class="receipt-row"><span>Student ID</span><strong>${safe(student.id)}</strong></div>
        <div class="receipt-row"><span>Seat / Shift</span><strong>${safe(student.seatNumber)} · ${safe(student.shiftName)}</strong></div>
        <div class="receipt-row"><span>Amount</span><strong>${money(payment.amount)}</strong></div>
        <div class="receipt-row"><span>Method</span><strong>${safe(payment.method)}</strong></div>
        <div class="receipt-row"><span>Paid on</span><strong>${niceDate(payment.paidAt)}</strong></div>
        <div class="receipt-row"><span>Status</span><strong>Paid</strong></div>
      </div>
      <div class="button-row"><button class="btn primary" data-print-receipt>${icon('download')} Download PDF</button></div>
    </div>
  `;
}

function renderShiftModal() {
  const shift = state.modal.shift || {};
  return `
    <div class="modal-header">
      <div><h3>${shift.id ? 'Edit Shift' : 'New Shift'}</h3><p class="muted">Capacity controls prevent overbooking.</p></div>
      <!--close-->
    </div>
    <form class="modal-body form-grid" id="shift-form">
      ${field('name', 'Shift name', shift.name || '', 'text', true)}
      <div class="form-grid two">${field('startsAt', 'Starts at', shift.startsAt || '06:00', 'time', true)}${field('endsAt', 'Ends at', shift.endsAt || '10:00', 'time', true)}</div>
      <div class="form-grid two">${field('studyHours', 'Study hours', shift.studyHours || 4, 'number', true)}${field('capacity', 'Capacity', shift.capacity || 20, 'number', true)}</div>
      ${field('color', 'Color', shift.color || '#0f766e', 'color')}
      <div class="button-row"><button class="btn primary" type="submit">${icon('clock')} Save shift</button><button class="btn ghost" type="button" data-close-modal>Cancel</button></div>
    </form>
  `;
}

function renderStaffModal() {
  return `
    <div class="modal-header">
      <div><h3>Add Staff Account</h3><p class="muted">Staff can manage operations but cannot access owner-only exports or backups.</p></div>
      <!--close-->
    </div>
    <form class="modal-body form-grid" id="staff-form">
      <div class="form-grid two">${field('name', 'Name', '', 'text', true)}${field('email', 'Email', '', 'email', true)}</div>
      <div class="form-grid two">${field('mobile', 'Mobile', '', 'tel')}${field('password', 'Password', 'Staff@12345', 'password')}</div>
      <div class="button-row"><button class="btn primary" type="submit">${icon('shield')} Create staff</button><button class="btn ghost" type="button" data-close-modal>Cancel</button></div>
    </form>
  `;
}

function field(name, label, value = '', type = 'text', required = false) {
  return `<div class="field"><label>${safe(label)}</label><input name="${safe(name)}" type="${safe(type)}" value="${safe(value)}" ${required ? 'required' : ''} /></div>`;
}

function option(value, label, selected) {
  return `<option value="${safe(value)}" ${String(value) === String(selected) ? 'selected' : ''}>${safe(label)}</option>`;
}

function renderEmpty(message) {
  return `<div class="empty-state"><p>${safe(message)}</p></div>`;
}

function avg(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length;
}

async function fileToDataUrl(file) {
  if (!file) return null;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function formObject(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  if (form.elements.photoFile?.files?.[0]) {
    data.photo = await fileToDataUrl(form.elements.photoFile.files[0]);
  }
  delete data.photoFile;
  return data;
}

async function refreshCurrent() {
  await loadRouteData();
  render();
}

document.addEventListener('submit', async (event) => {
  const form = event.target;
  if (form.id === 'login-form') {
    event.preventDefault();
    const error = document.querySelector('#login-error');
    error.textContent = '';
    try {
      const payload = await api('/api/auth/login', {
        method: 'POST',
        body: {
          identifier: form.identifier.value,
          password: form.password.value
        }
      });
      setToken(payload.token);
      state.user = payload.user;
      state.route = payload.user.role === 'student' ? 'profile' : 'dashboard';
      await loadRouteData();
      render();
      resetInactivityTimer();
      toast('Welcome back. Your secure dashboard is ready.');
    } catch (err) {
      error.textContent = err.message;
    }
  }

  if (form.id === 'student-form') {
    event.preventDefault();
    try {
      const body = await formObject(form);
      const student = state.modal.student;
      if (student?.id) {
        await api(`/api/students/${student.id}`, { method: 'PUT', body });
        toast('Student updated.');
      } else {
        await api('/api/students', { method: 'POST', body });
        toast('Student created with student portal access.');
      }
      state.modal = null;
      await refreshCurrent();
    } catch (err) {
      toast(err.message, 'danger');
    }
  }

  if (form.id === 'payment-form') {
    event.preventDefault();
    try {
      const payment = await api('/api/payments', { method: 'POST', body: Object.fromEntries(new FormData(form).entries()) });
      toast(`Payment collected: ${money(payment.payment.amount)}.`);
      state.modal = null;
      await refreshCurrent();
    } catch (err) {
      toast(err.message, 'danger');
    }
  }

  if (form.id === 'shift-form') {
    event.preventDefault();
    try {
      const body = Object.fromEntries(new FormData(form).entries());
      if (state.modal.shift?.id) {
        await api(`/api/shifts/${state.modal.shift.id}`, { method: 'PUT', body });
        toast('Shift updated.');
      } else {
        await api('/api/shifts', { method: 'POST', body });
        toast('Shift created.');
      }
      state.modal = null;
      await refreshCurrent();
    } catch (err) {
      toast(err.message, 'danger');
    }
  }

  if (form.id === 'staff-form') {
    event.preventDefault();
    try {
      await api('/api/staff', { method: 'POST', body: Object.fromEntries(new FormData(form).entries()) });
      toast('Staff account created.');
      state.modal = null;
      await refreshCurrent();
    } catch (err) {
      toast(err.message, 'danger');
    }
  }
});

document.addEventListener('click', async (event) => {
  const target = event.target.closest('button');
  if (!target) return;
  state.lastActivityAt = Date.now();

  if (target.dataset.public) {
    state.publicPage = target.dataset.public;
    render();
  }

  if (target.dataset.nav) {
    const route = target.dataset.nav === 'students' && state.route !== 'students' ? 'students' : target.dataset.nav;
    await navigate(route);
  }

  if (target.dataset.logout !== undefined) logout(true);

  if (target.dataset.theme !== undefined) {
    setTheme(state.theme === 'dark' ? 'light' : 'dark');
    render();
  }

  if (target.dataset.closeModal !== undefined) {
    state.modal = null;
    render();
  }

  if (target.dataset.openStudent !== undefined) {
    state.modal = { type: 'studentForm', student: null };
    render();
  }

  if (target.dataset.viewStudent) {
    try {
      const profile = await api(`/api/students/${target.dataset.viewStudent}`);
      state.modal = { type: 'studentProfile', profile };
      render();
    } catch (err) {
      toast(err.message, 'danger');
    }
  }

  if (target.dataset.editStudent) {
    const profile = await api(`/api/students/${target.dataset.editStudent}`);
    state.modal = { type: 'studentForm', student: profile.student };
    render();
  }

  if (target.dataset.deleteStudent) {
    const student = state.data.students.find((candidate) => candidate.id === target.dataset.deleteStudent);
    if (!confirm(`Delete ${student?.fullName || 'this student'}? This cannot be undone.`)) return;
    try {
      await api(`/api/students/${target.dataset.deleteStudent}`, { method: 'DELETE' });
      toast('Student deleted.');
      await refreshCurrent();
    } catch (err) {
      toast(err.message, 'danger');
    }
  }

  if (target.dataset.payStudent) {
    const student = state.data.students.find((candidate) => candidate.id === target.dataset.payStudent);
    state.modal = { type: 'paymentForm', student };
    render();
  }

  if (target.dataset.receipt) {
    try {
      const payload = await api(`/api/receipts/${target.dataset.receipt}`);
      state.modal = { type: 'receipt', receipt: payload.receipt };
      render();
    } catch (err) {
      toast(err.message, 'danger');
    }
  }

  if (target.dataset.printReceipt !== undefined) {
    window.print();
  }

  if (target.dataset.refreshStudents !== undefined) {
    await refreshCurrent();
  }

  if (target.dataset.scanAttendance !== undefined) {
    const studentId = document.querySelector('[data-qr-student]')?.value;
    const action = document.querySelector('[data-qr-action]')?.value || 'auto';
    try {
      const payload = await api('/api/attendance/scan', { method: 'POST', body: { studentId, action } });
      toast(`Attendance ${payload.mode.replace('-', ' ')} recorded.`);
      await refreshCurrent();
    } catch (err) {
      toast(err.message, 'danger');
    }
  }

  if (target.dataset.studentScan !== undefined) {
    try {
      const payload = await api('/api/attendance/scan', {
        method: 'POST',
        body: { studentId: state.user.studentId, action: 'auto' }
      });
      toast(`Attendance ${payload.mode.replace('-', ' ')} recorded.`);
      await refreshCurrent();
    } catch (err) {
      toast(err.message, 'danger');
    }
  }

  if (target.dataset.openShift !== undefined) {
    state.modal = { type: 'shiftForm', shift: null };
    render();
  }

  if (target.dataset.editShift) {
    const shift = state.data.shifts.find((candidate) => candidate.id === target.dataset.editShift);
    state.modal = { type: 'shiftForm', shift };
    render();
  }

  if (target.dataset.deleteShift) {
    if (!confirm('Delete this shift? Students must be moved out first.')) return;
    try {
      await api(`/api/shifts/${target.dataset.deleteShift}`, { method: 'DELETE' });
      toast('Shift deleted.');
      await refreshCurrent();
    } catch (err) {
      toast(err.message, 'danger');
    }
  }

  if (target.dataset.exportStudents !== undefined) {
    try {
      const csv = await api('/api/export/students', { headers: { Accept: 'text/csv' } });
      const blob = new Blob([csv], { type: 'text/csv' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'students-report.csv';
      link.click();
      URL.revokeObjectURL(link.href);
      toast('Student report exported.');
    } catch (err) {
      toast(err.message, 'danger');
    }
  }

  if (target.dataset.sendReminders !== undefined) {
    try {
      const result = await api('/api/notifications/reminders', { method: 'POST', body: { channels: ['WhatsApp', 'SMS'] } });
      toast(`${result.notifications.length} reminders queued.`);
      if (state.route !== 'notifications') await navigate('notifications');
      else await refreshCurrent();
    } catch (err) {
      toast(err.message, 'danger');
    }
  }

  if (target.dataset.createBackup !== undefined) {
    try {
      const result = await api('/api/backups', { method: 'POST', body: {} });
      toast(`Backup created: ${result.backup}.`);
      await refreshCurrent();
    } catch (err) {
      toast(err.message, 'danger');
    }
  }

  if (target.dataset.openStaff !== undefined) {
    state.modal = { type: 'staffForm' };
    render();
  }
});

document.addEventListener('input', (event) => {
  const target = event.target;
  state.lastActivityAt = Date.now();
  if (target.matches('[data-student-search]')) {
    state.filters.search = target.value;
    clearTimeout(state.searchTimer);
    state.searchTimer = setTimeout(refreshCurrent, 250);
  }
});

document.addEventListener('change', async (event) => {
  const target = event.target;
  state.lastActivityAt = Date.now();
  if (target.matches('[data-student-filter]')) {
    state.filters.filter = target.value;
    await refreshCurrent();
  }
  if (target.matches('[data-student-shift]')) {
    state.filters.shift = target.value;
    await refreshCurrent();
  }
  if (target.matches('[data-student-fee]')) {
    state.filters.feeStatus = target.value;
    await refreshCurrent();
  }
  if (target.matches('[data-seat-shift]')) {
    state.filters.seatShift = target.value;
    await refreshCurrent();
  }
  if (target.matches('[data-attendance-date]')) {
    state.filters.attendanceDate = target.value;
    await refreshCurrent();
  }
});

document.addEventListener('dragstart', (event) => {
  const item = event.target.closest('[data-drag-student]');
  if (!item) return;
  event.dataTransfer.setData('text/plain', item.dataset.dragStudent);
});

document.addEventListener('dragover', (event) => {
  const seat = event.target.closest('[data-seat]');
  if (!seat) return;
  event.preventDefault();
  seat.classList.add('drag-over');
});

document.addEventListener('dragleave', (event) => {
  const seat = event.target.closest('[data-seat]');
  if (seat) seat.classList.remove('drag-over');
});

document.addEventListener('drop', async (event) => {
  const seat = event.target.closest('[data-seat]');
  if (!seat) return;
  event.preventDefault();
  seat.classList.remove('drag-over');
  const studentId = event.dataTransfer.getData('text/plain');
  if (!studentId) return;
  try {
    await api('/api/seats/assign', {
      method: 'POST',
      body: { studentId, seatNumber: seat.dataset.seat, shiftId: state.filters.seatShift }
    });
    toast(`Seat ${seat.dataset.seat} assigned.`);
    await refreshCurrent();
  } catch (err) {
    toast(err.message, 'danger');
  }
});

window.addEventListener('hashchange', async () => {
  const route = location.hash.replace('#/', '');
  if (route && route !== state.route && state.user) {
    state.route = route;
    await loadRouteData();
    render();
  }
});

['mousemove', 'keydown', 'touchstart', 'scroll'].forEach((eventName) => {
  document.addEventListener(eventName, () => {
    state.lastActivityAt = Date.now();
  }, { passive: true });
});

bootstrap();
