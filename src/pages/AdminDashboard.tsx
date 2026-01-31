import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminSidebar } from '../components/AdminSidebar';
import { useAdmin } from '../contexts/AdminContext';

type TabType = 'all' | 'pending' | 'confirmed';
type AppointmentStatus = 'confirmed' | 'pending' | 'cancelled';

const statusStyles: Record<AppointmentStatus, { bg: string; text: string; dot: string; label: string }> = {
  confirmed: { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500', label: 'Confirmed' },
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-500', label: 'Pending' },
  cancelled: { bg: 'bg-gray-200', text: 'text-gray-600', dot: 'bg-gray-400', label: 'Cancelled' },
};

export function AdminDashboard() {
  const { appointments, confirmAppointment, cancelAppointment, rebookAppointment } = useAdmin();
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState({ title: '', message: '' });

  const showNotification = (title: string, message: string) => {
    setToastMessage({ title, message });
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleConfirm = (id: string, patientName: string) => {
    confirmAppointment(id);
    showNotification('Appointment Confirmed', `${patientName}'s appointment has been confirmed.`);
  };

  const handleCancel = (id: string, patientName: string) => {
    cancelAppointment(id);
    showNotification('Appointment Cancelled', `${patientName}'s appointment has been cancelled.`);
  };

  const handleRebook = (id: string, patientName: string) => {
    rebookAppointment(id);
    showNotification('Appointment Re-booked', `${patientName}'s appointment has been re-booked.`);
  };

  const filteredAppointments = appointments.filter((apt) => {
    if (activeTab === 'all') return true;
    return apt.status === activeTab;
  });

  return (
    <div className="bg-background-light min-h-screen flex overflow-x-hidden">
      <AdminSidebar />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-background-light">
        {/* Top Navigation */}
        <header className="h-16 border-b border-border-light bg-white px-8 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold">Appointment Management</h2>
            <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-500">v3.4.0</span>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 text-text-secondary hover:bg-gray-100 rounded-lg">
              <span className="material-symbols-outlined">search</span>
            </button>
            <button className="p-2 text-text-secondary hover:bg-gray-100 rounded-lg relative">
              <span className="material-symbols-outlined">notifications</span>
              <span className="absolute top-2 right-2 size-2 bg-red-500 rounded-full border-2 border-white" />
            </button>
            <div className="h-8 w-px bg-border-light mx-2" />
            <Link
              to="/"
              className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              New Booking
            </Link>
          </div>
        </header>

        <div className="p-8 space-y-8">
          {/* Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl border border-border flex flex-col gap-1">
              <div className="flex justify-between items-start">
                <p className="text-sm font-medium text-text-secondary">Total Bookings Today</p>
                <span className="p-2 bg-primary/10 text-primary rounded-lg material-symbols-outlined text-sm">
                  calendar_today
                </span>
              </div>
              <div className="flex items-end gap-2 mt-2">
                <p className="text-3xl font-bold leading-none">42</p>
                <p className="text-green-600 text-sm font-semibold flex items-center">
                  <span className="material-symbols-outlined text-xs">arrow_upward</span>5%
                </p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-border flex flex-col gap-1">
              <div className="flex justify-between items-start">
                <p className="text-sm font-medium text-text-secondary">New Patients</p>
                <span className="p-2 bg-blue-100 text-blue-600 rounded-lg material-symbols-outlined text-sm">
                  person_add
                </span>
              </div>
              <div className="flex items-end gap-2 mt-2">
                <p className="text-3xl font-bold leading-none">12</p>
                <p className="text-green-600 text-sm font-semibold flex items-center">
                  <span className="material-symbols-outlined text-xs">arrow_upward</span>2%
                </p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-border flex flex-col gap-1">
              <div className="flex justify-between items-start">
                <p className="text-sm font-medium text-text-secondary">Occupancy Rate</p>
                <span className="p-2 bg-orange-100 text-orange-600 rounded-lg material-symbols-outlined text-sm">
                  analytics
                </span>
              </div>
              <div className="flex items-end gap-2 mt-2">
                <p className="text-3xl font-bold leading-none">85%</p>
                <p className="text-orange-500 text-sm font-semibold flex items-center">
                  <span className="material-symbols-outlined text-xs">trending_flat</span>0%
                </p>
              </div>
            </div>
          </div>

          {/* Filters & Tabs */}
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <div className="border-b border-border px-6">
              <div className="flex gap-8">
                {(['all', 'pending', 'confirmed'] as TabType[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex flex-col items-center justify-center border-b-2 pb-4 pt-5 transition-colors ${
                      activeTab === tab
                        ? 'border-primary text-primary'
                        : 'border-transparent text-text-secondary hover:text-primary'
                    }`}
                  >
                    <p className="text-sm font-bold tracking-tight capitalize">
                      {tab === 'all' ? 'All Appointments' : tab}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Search and Filters */}
            <div className="p-6 flex flex-wrap items-center gap-4 border-b border-border">
              <div className="flex-1 min-w-[300px]">
                <label className="relative block">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-text-secondary">
                    <span className="material-symbols-outlined">search</span>
                  </span>
                  <input
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                    placeholder="Search by patient name..."
                  />
                </label>
              </div>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <select className="appearance-none bg-gray-50 border border-border rounded-lg pl-4 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer">
                    <option>Professional: All</option>
                    <option>Dr. Sarah Smith</option>
                    <option>Dr. Michael Chen</option>
                    <option>Dr. Emily Brooks</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-2 pointer-events-none text-gray-400">
                    expand_more
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="date"
                    defaultValue="2023-10-25"
                    className="bg-gray-50 border border-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
            </div>

            {/* Appointment Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 text-[11px] uppercase tracking-wider text-text-secondary font-bold border-b border-border">
                    <th className="px-6 py-4">Time</th>
                    <th className="px-6 py-4">Patient</th>
                    <th className="px-6 py-4">Professional</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredAppointments.map((apt) => (
                    <tr
                      key={apt.id}
                      className={`hover:bg-gray-50 transition-colors ${apt.status === 'cancelled' ? 'opacity-60' : ''}`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold">{apt.time}</div>
                        <div className="text-[11px] text-text-secondary">{apt.date}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className={`size-8 rounded-full flex items-center justify-center font-bold text-xs ${apt.patient.color}`}>
                            {apt.patient.initials}
                          </div>
                          <div>
                            <div className="text-sm font-bold">{apt.patient.name}</div>
                            <div className="text-[11px] text-text-secondary">{apt.patient.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{apt.professional}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold ${statusStyles[apt.status].bg} ${statusStyles[apt.status].text}`}>
                          <span className={`size-1.5 rounded-full ${statusStyles[apt.status].dot}`} />
                          {statusStyles[apt.status].label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                        {apt.status === 'pending' && (
                          <button
                            onClick={() => handleConfirm(apt.id, apt.patient.name)}
                            className="text-[11px] font-bold text-green-600 hover:underline"
                          >
                            Confirm
                          </button>
                        )}
                        {apt.status !== 'cancelled' && (
                          <>
                            <button className="text-[11px] font-bold text-primary hover:underline">Reschedule</button>
                            <button
                              onClick={() => handleCancel(apt.id, apt.patient.name)}
                              className="text-[11px] font-bold text-red-500 hover:underline"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                        {apt.status === 'cancelled' && (
                          <button
                            onClick={() => handleRebook(apt.id, apt.patient.name)}
                            className="text-[11px] font-bold text-primary hover:underline"
                          >
                            Re-book
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="p-6 border-t border-border flex items-center justify-between">
              <p className="text-xs text-text-secondary font-medium">Showing 1-10 of 42 results</p>
              <div className="flex items-center gap-2">
                <button className="size-8 flex items-center justify-center rounded-lg border border-border text-gray-400 hover:bg-gray-50">
                  <span className="material-symbols-outlined text-base">chevron_left</span>
                </button>
                <button className="size-8 flex items-center justify-center rounded-lg border border-primary bg-primary text-white text-xs font-bold">
                  1
                </button>
                <button className="size-8 flex items-center justify-center rounded-lg border border-border text-xs font-bold hover:bg-gray-50">
                  2
                </button>
                <button className="size-8 flex items-center justify-center rounded-lg border border-border text-xs font-bold hover:bg-gray-50">
                  3
                </button>
                <button className="size-8 flex items-center justify-center rounded-lg border border-border text-gray-400 hover:bg-gray-50">
                  <span className="material-symbols-outlined text-base">chevron_right</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Toast Notification */}
        {showToast && (
          <div className="fixed bottom-8 right-8 z-50">
            <div className="bg-gray-900 text-white rounded-xl shadow-2xl p-4 flex items-center gap-4 border border-white/10 min-w-[320px]">
              <div className="size-10 bg-primary rounded-lg flex items-center justify-center text-white shrink-0">
                <span className="material-symbols-outlined">check_circle</span>
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold">{toastMessage.title}</h4>
                <p className="text-xs opacity-80 mt-0.5">{toastMessage.message}</p>
              </div>
              <button
                onClick={() => setShowToast(false)}
                className="text-gray-400 hover:text-white"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
