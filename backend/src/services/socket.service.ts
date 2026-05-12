import { Server as SocketIOServer, Socket } from 'socket.io';
import { prisma } from '../lib/prisma';
import { logActivity } from './activity-log.service';
import { logger } from '../lib/logger';

interface ConnectedUser {
  socketId: string;
  userId: string;
  name: string;
  role: string;
  sessionId?: string;
}

const connectedUsers: Map<string, ConnectedUser> = new Map();
const sessionParticipants: Map<string, Set<string>> = new Map();
let peakConcurrent = 0;

function updatePeak() {
  const current = connectedUsers.size;
  if (current > peakConcurrent) peakConcurrent = current;
}

function parseDeviceType(ua: string): string {
  if (/iPad|Tablet/i.test(ua)) return 'tablet';
  if (/Mobile|Android|iPhone/i.test(ua)) return 'mobile';
  return 'desktop';
}

export const initializeSocket = (io: SocketIOServer) => {
  io.on('connection', (socket: Socket) => {
    logger.info(`🔌 Client connected: ${socket.id}`);
    updatePeak();
    io.to('admin-room').emit('online-users-updated', { onlineCount: connectedUsers.size, peakConcurrent });

    // User identifies themselves
    socket.on('identify', async (data: { userId: string; name: string; role: string }) => {
      connectedUsers.set(socket.id, {
        socketId: socket.id,
        userId: data.userId,
        name: data.name,
        role: data.role,
      });

      // Auto-join admin room for admin/moderator users
      if (['ADMIN', 'MODERATOR'].includes(data.role)) {
        socket.join('admin-room');
      }

      // Access log for socket connect
      const ua = socket.handshake.headers['user-agent'] || '';
      const ip = socket.handshake.address || socket.handshake.headers['x-forwarded-for'] as string || '';
      try {
        await prisma.accessLog.create({
          data: {
            userId: data.userId,
            name: data.name,
            role: data.role,
            ipAddress: typeof ip === 'string' ? ip : ip[0],
            userAgent: ua,
            deviceType: parseDeviceType(ua),
            action: 'SOCKET_CONNECT',
          },
        });
      } catch (e) { /* ignore log errors */ }

      logActivity({ userId: data.userId, userName: data.name, action: 'SOCKET_CONNECT' });
      io.to('admin-room').emit('online-users-updated', { onlineCount: connectedUsers.size, peakConcurrent });
      logger.info(`👤 User identified: ${data.name} (${data.role})`);
    });

    // Join a session room
    socket.on('join-session', (data: { sessionId: string }) => {
      const user = connectedUsers.get(socket.id);
      // Even if user is not yet identified, let them join the room
      // They might identify shortly after (race condition)

      // Leave previous session if any
      if (user?.sessionId) {
        socket.leave(`session:${user.sessionId}`);
        const prevParticipants = sessionParticipants.get(user.sessionId);
        if (prevParticipants) {
          prevParticipants.delete(socket.id);
          io.to(`session:${user.sessionId}`).emit('participant-count', {
            sessionId: user.sessionId,
            count: prevParticipants.size,
          });
        }
      }

      // Join new session
      if (user) user.sessionId = data.sessionId;
      socket.join(`session:${data.sessionId}`);

      if (!sessionParticipants.has(data.sessionId)) {
        sessionParticipants.set(data.sessionId, new Set());
      }
      sessionParticipants.get(data.sessionId)!.add(socket.id);

      // Broadcast updated participant count
      const count = sessionParticipants.get(data.sessionId)!.size;
      io.to(`session:${data.sessionId}`).emit('participant-count', {
        sessionId: data.sessionId,
        count,
      });

      if (user) {
        logActivity({ userId: user.userId, userName: user.name, action: 'JOIN_SESSION', sessionId: data.sessionId });
        logger.info(`📌 ${user.name} joined session ${data.sessionId} (${count} participants)`);
      } else {
        logger.info(`📌 Anonymous client joined session ${data.sessionId} (${count} participants)`);
      }
    });

    // Leave a session room
    socket.on('leave-session', (data: { sessionId: string }) => {
      const user = connectedUsers.get(socket.id);

      socket.leave(`session:${data.sessionId}`);
      const participants = sessionParticipants.get(data.sessionId);
      if (participants) {
        participants.delete(socket.id);
        io.to(`session:${data.sessionId}`).emit('participant-count', {
          sessionId: data.sessionId,
          count: participants.size,
        });
      }
      if (user) user.sessionId = undefined;

      if (user) {
        logActivity({ userId: user.userId, userName: user.name, action: 'LEAVE_SESSION', sessionId: data.sessionId });
      }
    });

    // Typing indicators
    socket.on('typing-start', (data: { sessionId: string }) => {
      const user = connectedUsers.get(socket.id);
      if (user) {
        socket.to(`session:${data.sessionId}`).emit('typing-start', {
          userId: user.userId,
          name: user.name,
        });
      }
    });

    socket.on('typing-stop', (data: { sessionId: string }) => {
      const user = connectedUsers.get(socket.id);
      if (user) {
        socket.to(`session:${data.sessionId}`).emit('typing-stop', {
          userId: user.userId,
        });
      }
    });

    // Live Reactions
    socket.on('new-reaction', (data: { sessionId: string; emoji: string }) => {
      const user = connectedUsers.get(socket.id);
      if (user) {
        io.to(`session:${data.sessionId}`).emit('new-reaction', {
          id: Math.random().toString(36).substring(7),
          emoji: data.emoji,
          userId: user.userId,
          name: user.name,
        });
      }
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      const user = connectedUsers.get(socket.id);
      if (user?.sessionId) {
        const participants = sessionParticipants.get(user.sessionId);
        if (participants) {
          participants.delete(socket.id);
          io.to(`session:${user.sessionId}`).emit('participant-count', {
            sessionId: user.sessionId,
            count: participants.size,
          });
        }
      }

      if (user) {
        try {
          await prisma.accessLog.create({
            data: {
              userId: user.userId,
              name: user.name,
              role: user.role,
              action: 'SOCKET_DISCONNECT',
            },
          });
        } catch (e) { /* ignore */ }
        logActivity({ userId: user.userId, userName: user.name, action: 'SOCKET_DISCONNECT' });
      }

      connectedUsers.delete(socket.id);
      io.to('admin-room').emit('online-users-updated', { onlineCount: connectedUsers.size, peakConcurrent });
      logger.info(`❌ Client disconnected: ${socket.id}`);
    });
  });
};

// Helper to broadcast to a session
export const broadcastToSession = (io: SocketIOServer, sessionId: string, event: string, data: any) => {
  io.to(`session:${sessionId}`).emit(event, data);
};

// Helper to get participant count for a session
export const getSessionParticipantCount = (sessionId: string): number => {
  return sessionParticipants.get(sessionId)?.size || 0;
};

// Exported for online-users route
export const getConnectedUsers = (): ConnectedUser[] => {
  return Array.from(connectedUsers.values());
};

export const getSessionParticipants = (): Record<string, number> => {
  const result: Record<string, number> = {};
  sessionParticipants.forEach((set, sessionId) => {
    result[sessionId] = set.size;
  });
  return result;
};

export const getPeakConcurrent = (): number => peakConcurrent;
