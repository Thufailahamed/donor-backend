import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { getMetricsSnapshot } from '../middleware/metrics.middleware';
import { getConnectedUsers, getPeakConcurrent, getSessionParticipants } from '../services/socket.service';
import { prisma } from '../lib/prisma';

const router = Router();

// Detailed health check (admin)
router.get('/detailed', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const apiMetrics = getMetricsSnapshot();
    const users = getConnectedUsers();
    const sessionMap = getSessionParticipants();

    let dbStatus = 'connected';
    let dbLatency = 0;
    try {
      const start = process.hrtime.bigint();
      await prisma.$queryRaw`SELECT 1`;
      dbLatency = Number(process.hrtime.bigint() - start) / 1_000_000;
    } catch {
      dbStatus = 'error';
    }

    res.json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      api: apiMetrics,
      socket: {
        connectedUsers: users.length,
        peakConcurrent: getPeakConcurrent(),
        activeRooms: Object.keys(sessionMap).length,
      },
      database: {
        status: dbStatus,
        latencyMs: Math.round(dbLatency * 100) / 100,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch health data' });
  }
});

export default router;
