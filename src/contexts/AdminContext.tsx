import { createContext, useContext, useState } from "react";
import { type ReactNode } from "react";

type AppointmentStatus = "confirmed" | "pending" | "cancelled";

export interface Appointment {
  id: string;
  time: string;
  date: string;
  patient: {
    name: string;
    id: string;
    initials: string;
    color: string;
  };
  professional: string;
  status: AppointmentStatus;
  service?: string;
  visitMethod?: string;
}

interface AdminContextType {
  appointments: Appointment[];
  confirmAppointment: (id: string) => void;
  cancelAppointment: (id: string) => void;
  rebookAppointment: (id: string) => void;
  addAppointment: (appointment: Appointment) => void;
}

const initialAppointments: Appointment[] = [
  {
    id: "1",
    time: "09:00 AM",
    date: "Today, Oct 25",
    patient: {
      name: "John Doe",
      id: "#P-10294",
      initials: "JD",
      color: "bg-blue-100 text-primary",
    },
    professional: "Dr. Sarah Smith",
    status: "confirmed",
    service: "General Consultation",
    visitMethod: "in-person",
  },
  {
    id: "2",
    time: "10:30 AM",
    date: "Today, Oct 25",
    patient: {
      name: "Alice Wong",
      id: "#P-10452",
      initials: "AW",
      color: "bg-orange-100 text-orange-600",
    },
    professional: "Dr. Michael Chen",
    status: "pending",
    service: "Specialty Screening",
    visitMethod: "virtual",
  },
  {
    id: "3",
    time: "01:15 PM",
    date: "Today, Oct 25",
    patient: {
      name: "Robert Johnson",
      id: "#P-09881",
      initials: "RJ",
      color: "bg-gray-100 text-gray-600",
    },
    professional: "Dr. Emily Brooks",
    status: "cancelled",
    service: "Follow-up Visit",
    visitMethod: "in-person",
  },
];

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [appointments, setAppointments] =
    useState<Appointment[]>(initialAppointments);

  const confirmAppointment = (id: string) => {
    setAppointments((prev) =>
      prev.map((apt) =>
        apt.id === id
          ? { ...apt, status: "confirmed" as AppointmentStatus }
          : apt,
      ),
    );
  };

  const cancelAppointment = (id: string) => {
    setAppointments((prev) =>
      prev.map((apt) =>
        apt.id === id
          ? { ...apt, status: "cancelled" as AppointmentStatus }
          : apt,
      ),
    );
  };

  const rebookAppointment = (id: string) => {
    setAppointments((prev) =>
      prev.map((apt) =>
        apt.id === id
          ? { ...apt, status: "pending" as AppointmentStatus }
          : apt,
      ),
    );
  };

  const addAppointment = (appointment: Appointment) => {
    setAppointments((prev) => [...prev, appointment]);
  };

  return (
    <AdminContext.Provider
      value={{
        appointments,
        confirmAppointment,
        cancelAppointment,
        rebookAppointment,
        addAppointment,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error("useAdmin must be used within an AdminProvider");
  }
  return context;
}
