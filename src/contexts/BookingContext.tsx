import { createContext, useContext, useState, ReactNode } from 'react';

type ServiceType = 'general' | 'specialty' | 'followup';
type VisitMethod = 'in-person' | 'virtual';

export interface BookingData {
  // Appointment details
  selectedDate: Date | null;
  selectedTime: string | null;
  selectedService: ServiceType;
  visitMethod: VisitMethod;

  // Patient details
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string;

  // Medical details
  reasonForVisit: string;
  symptoms: string;

  // Insurance details
  insuranceProvider: string;
  insuranceId: string;
}

interface BookingContextType {
  bookingData: BookingData;
  updateBookingData: (data: Partial<BookingData>) => void;
  resetBookingData: () => void;
}

const initialBookingData: BookingData = {
  selectedDate: null,
  selectedTime: null,
  selectedService: 'general',
  visitMethod: 'in-person',
  fullName: '',
  email: '',
  phone: '',
  dateOfBirth: '',
  reasonForVisit: '',
  symptoms: '',
  insuranceProvider: '',
  insuranceId: '',
};

const BookingContext = createContext<BookingContextType | undefined>(undefined);

export function BookingProvider({ children }: { children: ReactNode }) {
  const [bookingData, setBookingData] = useState<BookingData>(initialBookingData);

  const updateBookingData = (data: Partial<BookingData>) => {
    setBookingData(prev => ({ ...prev, ...data }));
  };

  const resetBookingData = () => {
    setBookingData(initialBookingData);
  };

  return (
    <BookingContext.Provider value={{ bookingData, updateBookingData, resetBookingData }}>
      {children}
    </BookingContext.Provider>
  );
}

export function useBooking() {
  const context = useContext(BookingContext);
  if (context === undefined) {
    throw new Error('useBooking must be used within a BookingProvider');
  }
  return context;
}
