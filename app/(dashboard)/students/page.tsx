"use client";

import { useEffect, useState } from "react";
import { Search, UserPlus, Eye, Edit2, Receipt, Trash2, MoreHorizontal } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import Modal from "@/components/shared/Modal";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function StudentsPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [feeStatus, setFeeStatus] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    mobile: "",
    selectedShift: "shift-1",
    seatNumber: "A01",
    monthlyFees: "2500",
    paidAmount: "0",
  });

  const fetchStudents = async () => {
    setLoading(true);
    const token = localStorage.getItem("examdesk.token");
    const params = new URLSearchParams({ search, filter, feeStatus });
    try {
      const res = await fetch(`/api/students?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setStudents(json.students || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(fetchStudents, 300);
    return () => clearTimeout(timer);
  }, [search, filter, feeStatus]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("examdesk.token");
    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setIsModalOpen(false);
        setFormData({
          fullName: "",
          mobile: "",
          selectedShift: "shift-1",
          seatNumber: "A01",
          monthlyFees: "2500",
          paidAmount: "0",
        });
        fetchStudents();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex-1 space-y-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Student Management</h2>
            <p className="text-sm text-slate-500 mt-1">Search, filter, and manage complete student records.</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 mb-1 block">Smart Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Name, ID, Seat..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 mb-1 block">Membership</label>
              <select 
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none cursor-pointer"
              >
                <option value="all">All Students</option>
                <option value="active">Active Members</option>
                <option value="expired">Expired</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 mb-1 block">Fee Status</label>
              <select 
                value={feeStatus}
                onChange={(e) => setFeeStatus(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none cursor-pointer"
              >
                <option value="all">Any Fee Status</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
          </div>
        </div>

        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-[#0f766e] text-white rounded-2xl font-bold text-sm shadow-lg shadow-teal-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all shrink-0"
        >
          <UserPlus size={18} />
          Register Student
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Student</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Seat & Shift</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Fee Status</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Attendance</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Expiry</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-medium italic">Loading student records...</td></tr>
              ) : students.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-medium italic">No students found matching your criteria.</td></tr>
              ) : students.map((student) => (
                <tr key={student.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full border-2 border-white shadow-sm overflow-hidden bg-slate-100 shrink-0">
                         <img src={student.photo} alt="" className="h-full w-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">{student.fullName}</p>
                        <p className="text-[11px] text-slate-400 font-medium">{student.id} · {student.mobile}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-slate-700">Seat {student.seatNumber}</p>
                    <p className="text-[11px] text-slate-400 font-medium">{student.shiftName}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider",
                      student.feeStatus === 'paid' ? "bg-green-50 text-green-600" : 
                      student.feeStatus === 'overdue' ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600"
                    )}>
                      {student.feeStatus}
                    </span>
                    {student.pendingAmount > 0 && (
                      <p className="text-[10px] text-slate-400 mt-1 font-bold">₹{student.pendingAmount} due</p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="w-24 space-y-1.5">
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-[#0f766e] rounded-full" 
                          style={{ width: `${student.attendancePercentage}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold">{student.attendancePercentage}% Present</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-slate-700">{new Date(student.expiryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</p>
                    <span className={cn(
                      "text-[10px] font-bold",
                      student.membershipStatus === 'active' ? "text-green-500" : "text-rose-500"
                    )}>
                      {student.membershipStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-2 text-slate-400 hover:text-[#0f766e] hover:bg-[#0f766e]/5 rounded-lg transition-all" title="View Logs"><Eye size={16} /></button>
                      <button className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all" title="Edit Profile"><Edit2 size={16} /></button>
                      <button className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-all" title="Collect Payment"><Receipt size={16} /></button>
                      <button className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all" title="Delete"><Trash2 size={16} /></button>
                    </div>
                    <button className="p-2 text-slate-400 group-hover:hidden"><MoreHorizontal size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Register New Student"
        subtitle="Create a new student profile and assign study resources."
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Full Name</label>
                <input 
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0f766e]/20 focus:border-[#0f766e] transition-all font-medium" 
                  placeholder="Enter full name"
                />
             </div>
             <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Mobile Number</label>
                <input 
                  required
                  value={formData.mobile}
                  onChange={(e) => setFormData({...formData, mobile: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0f766e]/20 focus:border-[#0f766e] transition-all font-medium" 
                  placeholder="Enter phone number"
                />
             </div>
             <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Study Shift</label>
                <select 
                  value={formData.selectedShift}
                  onChange={(e) => setFormData({...formData, selectedShift: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0f766e]/20 focus:border-[#0f766e] transition-all font-medium"
                >
                  <option value="shift-1">Morning Focus</option>
                  <option value="shift-6">Full Day</option>
                </select>
             </div>
             <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Seat Assignment</label>
                <input 
                  required
                  value={formData.seatNumber}
                  onChange={(e) => setFormData({...formData, seatNumber: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0f766e]/20 focus:border-[#0f766e] transition-all font-medium uppercase" 
                  placeholder="e.g. A01"
                />
             </div>
             <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Monthly Fees</label>
                <input 
                  type="number"
                  required
                  value={formData.monthlyFees}
                  onChange={(e) => setFormData({...formData, monthlyFees: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0f766e]/20 focus:border-[#0f766e] transition-all font-medium" 
                />
             </div>
             <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Initial Payment</label>
                <input 
                  type="number"
                  required
                  value={formData.paidAmount}
                  onChange={(e) => setFormData({...formData, paidAmount: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0f766e]/20 focus:border-[#0f766e] transition-all font-medium" 
                />
             </div>
          </div>
          
          <div className="pt-6 flex justify-end gap-3">
             <button 
               type="button"
               onClick={() => setIsModalOpen(false)}
               className="px-6 py-3 rounded-2xl text-sm font-bold text-slate-500 hover:bg-slate-50 transition-all"
             >
               Cancel
             </button>
             <button 
               type="submit"
               className="px-8 py-3 bg-[#0f766e] text-white rounded-2xl text-sm font-bold shadow-lg shadow-teal-900/20 hover:bg-primary-strong transition-all"
             >
               Save Student
             </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
