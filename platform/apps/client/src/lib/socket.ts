import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from './config';
import { getStoredAuth } from './auth';

let socket: Socket | null = null;

export function connectSocket() {
  const auth = getStoredAuth();
  if (!auth?.token) return null;

  if (!socket) {
    socket = io(API_BASE_URL.replace('/api/v1', ''), {
      auth: {
        token: auth.token,
      },
      query: {
        token: auth.token, // Fallback
      },
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      console.log('🔌 Socket connected');
    });

    socket.on('disconnect', () => {
      console.log('🔌 Socket disconnected');
    });
  }

  return socket;
}

export function getSocket() {
  if (!socket) {
    return connectSocket();
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

