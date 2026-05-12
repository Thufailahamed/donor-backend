import { prisma } from '../lib/prisma';
import { Server as SocketIOServer } from 'socket.io';

let ioInstance: SocketIOServer | null = null;
const activityBuffer: any[] = [];
const moderatorBuffer: any[] = [];
const FLUSH_INTERVAL = 5000; // 5 seconds

export const setActivityLogIO = (io: SocketIOServer) => {
  ioInstance = io;
};

// Periodic flush
setInterval(async () => {
  if (activityBuffer.length > 0) {
    const logs = [...activityBuffer];
    activityBuffer.length = 0;
    try {
      await prisma.activityLog.createMany({ data: logs });
    } catch (error) {
      console.error('Failed to flush activity logs:', error);
    }
  }
  if (moderatorBuffer.length > 0) {
    const logs = [...moderatorBuffer];
    moderatorBuffer.length = 0;
    try {
      await prisma.moderatorActionLog.createMany({ data: logs });
    } catch (error) {
      console.error('Failed to flush moderator logs:', error);
    }
  }
}, FLUSH_INTERVAL);

export async function logActivity(params: {
  userId?: string;
  userName: string;
  action: string;
  targetType?: string;
  targetId?: string;
  sessionId?: string;
  details?: string;
}): Promise<void> {
  // 1. Immediate socket emission for real-time admin view
  if (ioInstance) {
    ioInstance.to('admin-room').emit('new-activity', { ...params, createdAt: new Date() });
  }

  // 2. Buffer for DB write
  activityBuffer.push({ ...params, createdAt: new Date() });
}

export async function logModeratorAction(params: {
  moderatorId: string;
  moderatorName: string;
  action: string;
  targetType?: string;
  targetId?: string;
  sessionId?: string;
  reason?: string;
  details?: string;
}): Promise<void> {
  const { details, ...data } = params;
  moderatorBuffer.push({ ...data, createdAt: new Date() });
}
