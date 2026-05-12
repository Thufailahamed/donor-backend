import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 15000,
      randomizationFactor: 0.5,
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });
  }
  return socket;
};

export const connectSocket = (userId: string, name: string, role: string) => {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  s.emit('identify', { userId, name, role });
  return s;
};

export const disconnectSocket = () => {
  if (socket?.connected) {
    socket.disconnect();
  }
};

export const joinSession = (sessionId: string) => {
  const s = getSocket();
  s.emit('join-session', { sessionId });
};

export const leaveSession = (sessionId: string) => {
  const s = getSocket();
  s.emit('leave-session', { sessionId });
};
