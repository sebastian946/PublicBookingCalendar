import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

class SocketService {
  private socket: Socket | null = null;
  private tenantId: string | null = null;

  connect(tenantId: string) {
    if (this.socket?.connected && this.tenantId === tenantId) {
      return;
    }

    this.disconnect();
    this.tenantId = tenantId;

    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    this.socket.on('connect', () => {
      console.log('Socket connected');
      this.socket?.emit('join:tenant', tenantId);
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });
  }

  disconnect() {
    if (this.socket) {
      if (this.tenantId) {
        this.socket.emit('leave:tenant', this.tenantId);
      }
      this.socket.disconnect();
      this.socket = null;
      this.tenantId = null;
    }
  }

  // Subscribe to booking events
  onBookingCreated(callback: (data: any) => void) {
    this.socket?.on('booking:created', callback);
    return () => this.socket?.off('booking:created', callback);
  }

  onBookingUpdated(callback: (data: any) => void) {
    this.socket?.on('booking:updated', callback);
    return () => this.socket?.off('booking:updated', callback);
  }

  onBookingConfirmed(callback: (data: any) => void) {
    this.socket?.on('booking:confirmed', callback);
    return () => this.socket?.off('booking:confirmed', callback);
  }

  onBookingCancelled(callback: (data: any) => void) {
    this.socket?.on('booking:cancelled', callback);
    return () => this.socket?.off('booking:cancelled', callback);
  }

  onBookingRescheduled(callback: (data: any) => void) {
    this.socket?.on('booking:rescheduled', callback);
    return () => this.socket?.off('booking:rescheduled', callback);
  }

  onPaymentCompleted(callback: (data: any) => void) {
    this.socket?.on('payment:completed', callback);
    return () => this.socket?.off('payment:completed', callback);
  }

  // Generic event subscription
  on(event: string, callback: (data: any) => void) {
    this.socket?.on(event, callback);
    return () => this.socket?.off(event, callback);
  }

  off(event: string, callback?: (data: any) => void) {
    if (callback) {
      this.socket?.off(event, callback);
    } else {
      this.socket?.removeAllListeners(event);
    }
  }
}

export const socketService = new SocketService();
export default socketService;
