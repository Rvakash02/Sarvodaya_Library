"use client";

import { useEffect, useState } from "react";
import { 
  Users, 
  Shield, 
  Receipt, 
  BarChart3, 
  Scan, 
  Grid, 
  Clock, 
  TrendingUp 
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

function MetricCard({ title, value, note, icon: Icon, trend }: any) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className="p-3 bg-slate-50 rounded-xl text-primary">
          <Icon size={24} />
        </div>
        {trend && (
          <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-lg">
            <TrendingUp size={12} />
            {trend}
          </span>
        )}
      </div>
      <div>
        <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">{title}</p>
        <h3 className="text-3xl font-black text-slate-900 mt-1">{value}</h3>
        <p className="text-xs text-slate-500 mt-2">{note}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem("examdesk.token");
      try {
        const res = await fetch("/api/dashboard", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400 font-bold">Loading dashboard...</div>;
  if (!data) return <div className="text-rose-500">Failed to load dashboard data.</div>;

  const stats = data.stats;

  return (
    <div className="space-y-10">
      {/* Metric Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard 
          title="Total Students" 
          value={stats.totalStudents} 
          note="Across all memberships" 
          icon={Users} 
        />
        <MetricCard 
          title="Active Members" 
          value={stats.activeMemberships} 
          note={`${stats.expiringMemberships} expiring soon`} 
          icon={Shield} 
        />
        <MetricCard 
          title="Pending Fees" 
          value={stats.pendingFees} 
          note="Needs reminder follow-up" 
          icon={Receipt} 
        />
        <MetricCard 
          title="Daily Attendance" 
          value={stats.todaysAttendance} 
          note="QR check-ins recorded today" 
          icon={Scan} 
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Attendance Trend</h3>
              <p className="text-sm text-slate-500">Daily present count for the last 7 days.</p>
            </div>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.attendanceTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="label" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }}
                  dy={10}
                />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="present" 
                  stroke="#0f766e" 
                  strokeWidth={4} 
                  dot={{ r: 6, fill: '#0f766e', strokeWidth: 3, stroke: '#fff' }}
                  activeDot={{ r: 8, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Shift Occupancy</h3>
              <p className="text-sm text-slate-500">Capacity usage by study shift.</p>
            </div>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.shiftOccupancy} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fill: '#475569', fontSize: 12, fontWeight: 700 }}
                  width={100}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar 
                  dataKey="percentage" 
                  fill="#0f766e" 
                  radius={[0, 4, 4, 0]} 
                  barSize={24}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Lists Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
            <h3 className="font-bold text-slate-900">Pending Fee Follow-ups</h3>
            <button className="text-xs font-bold text-primary hover:underline">View All</button>
          </div>
          <div className="divide-y divide-slate-50">
            {data.pendingStudents.map((student: any) => (
              <div key={student.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <img src={student.photo} alt="" className="h-10 w-10 rounded-full border border-slate-100" />
                  <div>
                    <p className="text-sm font-bold text-slate-900">{student.fullName}</p>
                    <p className="text-xs text-slate-400">{student.id} · {student.seatNumber}</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg uppercase tracking-wider">
                  {student.feeStatus}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
            <h3 className="font-bold text-slate-900">Expiring Memberships</h3>
            <button className="text-xs font-bold text-primary hover:underline">Review</button>
          </div>
          <div className="divide-y divide-slate-50">
            {data.expiringMemberships.map((student: any) => (
              <div key={student.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <img src={student.photo} alt="" className="h-10 w-10 rounded-full border border-slate-100" />
                  <div>
                    <p className="text-sm font-bold text-slate-900">{student.fullName}</p>
                    <p className="text-xs text-slate-400">Expires: {new Date(student.expiryDate).toLocaleDateString()}</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded-lg uppercase tracking-wider">
                  Expiring
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
