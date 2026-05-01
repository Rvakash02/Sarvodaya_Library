"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Users, 
  Scan, 
  Receipt, 
  Grid, 
  Clock, 
  BarChart3, 
  Bell, 
  Shield, 
  LogOut, 
  Moon, 
  Sun,
  Menu,
  X
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/' },
  { id: 'students', label: 'Students', icon: Users, href: '/students' },
  { id: 'attendance', label: 'Attendance', icon: Scan, href: '/attendance' },
  { id: 'fees', label: 'Fees', icon: Receipt, href: '/fees' },
  { id: 'seats', label: 'Seats', icon: Grid, href: '/seats' },
  { id: 'shifts', label: 'Shifts', icon: Clock, href: '/shifts' },
  { id: 'reports', label: 'Reports', icon: BarChart3, href: '/reports' },
  { id: 'notifications', label: 'Alerts', icon: Bell, href: '/notifications' },
  { id: 'settings', label: 'Settings', icon: Shield, href: '/settings' },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<any>(null);
  const [theme, setTheme] = useState("light");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const fetchMe = async () => {
      const token = localStorage.getItem("examdesk.token");
      if (!token) {
        router.push("/login");
        return;
      }

      try {
        const res = await fetch("/api/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Auth failed");
        const data = await res.json();
        setUser(data.user);
      } catch (err) {
        localStorage.removeItem("examdesk.token");
        router.push("/login");
      }
    };

    fetchMe();
  }, [router]);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    document.documentElement.dataset.theme = newTheme;
  };

  const logout = () => {
    localStorage.removeItem("examdesk.token");
    router.push("/login");
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#f7f8fb] flex text-slate-900">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex w-72 bg-white border-r border-slate-200 flex-col sticky top-0 h-screen shadow-sm">
        <div className="p-6 flex items-center gap-3">
          <div className="h-10 w-10 bg-[#0f766e] rounded-lg flex items-center justify-center text-white font-black text-xl shadow-lg shadow-teal-900/10">
            E
          </div>
          <span className="font-bold text-lg tracking-tight">ExamDesk <span className="text-[#0f766e]">OS</span></span>
        </div>

        <div className="px-6 mb-6">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Authenticated as</p>
            <p className="font-bold text-slate-900 truncate">{user.name}</p>
            <p className="text-xs text-slate-500 capitalize">{user.role.replace('_', ' ')}</p>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <button
                key={item.id}
                onClick={() => router.push(item.href)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all group",
                  isActive 
                    ? "bg-[#0f766e]/5 text-[#0f766e]" 
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <item.icon size={20} className={cn(isActive ? "text-[#0f766e]" : "text-slate-400 group-hover:text-slate-600")} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <button 
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-rose-500 hover:bg-rose-50 transition-all"
          >
            <LogOut size={20} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-20 bg-white/80 backdrop-blur-md border-bottom border-slate-200 sticky top-0 z-30 flex items-center justify-between px-6 lg:px-10">
          <div className="flex items-center gap-4 lg:hidden">
             <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-500">
               <Menu size={24} />
             </button>
             <div className="h-8 w-8 bg-[#0f766e] rounded-lg flex items-center justify-center text-white font-black text-sm">
                E
             </div>
          </div>

          <div className="hidden lg:block">
            <h1 className="text-xl font-bold text-slate-900 capitalize">
              {navItems.find(i => pathname === i.href || (i.href !== '/' && pathname.startsWith(i.href)))?.label || 'Dashboard'}
            </h1>
            <p className="text-sm text-slate-500">Manage your library reading room effectively.</p>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={toggleTheme}
              className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-all shadow-sm"
            >
              {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
            </button>
            <button className="hidden sm:flex items-center gap-2 px-4 py-2.5 bg-[#0f766e] text-white rounded-xl text-sm font-bold shadow-lg shadow-teal-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
              Add Student
            </button>
          </div>
        </header>

        <main className="p-6 lg:p-10 flex-1">
          {children}
        </main>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white flex flex-col animate-in slide-in-from-left duration-300">
            <div className="p-6 flex items-center justify-between">
               <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-[#0f766e] rounded-lg flex items-center justify-center text-white font-black text-xl">E</div>
                  <span className="font-bold text-lg">ExamDesk</span>
               </div>
               <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400"><X size={24} /></button>
            </div>
            <nav className="flex-1 px-4 space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => { router.push(item.href); setIsSidebarOpen(false); }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all",
                    pathname === item.href ? "bg-[#0f766e]/5 text-[#0f766e]" : "text-slate-500"
                  )}
                >
                  <item.icon size={20} />
                  {item.label}
                </button>
              ))}
            </nav>
            <div className="p-4 border-t border-slate-100">
              <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-3 text-rose-500 font-bold"><LogOut size={20} /> Sign Out</button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
