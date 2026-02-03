import { useEffect, useCallback } from 'react';
import { socketService } from '../services/socket';

interface BookingEvent {
  id: string;
  professional_id: string;
  date: string;
  start_time: string;
  end_time?: string;
}

interface UseRealTimeBookingsOptions {
  onBookingCreated?: (data: BookingEvent) => void;
  onBookingUpdated?: (data: BookingEvent & { status: string }) => void;
  onBookingConfirmed?: (data: { id: string }) => void;
  onBookingCancelled?: (data: BookingEvent) => void;
  onBookingRescheduled?: (data: {
    id: string;
    old_date: string;
    old_start_time: string;
    new_date: string;
    new_start_time: string;
  }) => void;
  onPaymentCompleted?: (data: { booking_id: string }) => void;
}

export function useRealTimeBookings(options: UseRealTimeBookingsOptions = {}) {
  const {
    onBookingCreated,
    onBookingUpdated,
    onBookingConfirmed,
    onBookingCancelled,
    onBookingRescheduled,
    onPaymentCompleted,
  } = options;

  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    if (onBookingCreated) {
      unsubscribers.push(socketService.onBookingCreated(onBookingCreated));
    }

    if (onBookingUpdated) {
      unsubscribers.push(socketService.onBookingUpdated(onBookingUpdated));
    }

    if (onBookingConfirmed) {
      unsubscribers.push(socketService.onBookingConfirmed(onBookingConfirmed));
    }

    if (onBookingCancelled) {
      unsubscribers.push(socketService.onBookingCancelled(onBookingCancelled));
    }

    if (onBookingRescheduled) {
      unsubscribers.push(socketService.onBookingRescheduled(onBookingRescheduled));
    }

    if (onPaymentCompleted) {
      unsubscribers.push(socketService.onPaymentCompleted(onPaymentCompleted));
    }

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [
    onBookingCreated,
    onBookingUpdated,
    onBookingConfirmed,
    onBookingCancelled,
    onBookingRescheduled,
    onPaymentCompleted,
  ]);
}

export default useRealTimeBookings;
