import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const serverUrl =
      import.meta.env.VITE_SERVER_URL ||
      (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4000');
    socket = io(serverUrl, {
      autoConnect: false,
      withCredentials: true,
    });
  }
  return socket;
}

export function connectSocket(): Socket {
  const s = getSocket();
  const token = useAuthStore.getState().accessToken;

  if (token) {
    s.auth = { token };
  }

  if (!s.connected) {
    s.connect();
  }
  return s;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
  }
}
