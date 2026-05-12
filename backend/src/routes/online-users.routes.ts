import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { getConnectedUsers, getSessionParticipants, getPeakConcurrent } from '../services/socket.service';

const router = Router();

// Detailed online users (admin)
router.get('/', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const users = getConnectedUsers();
    const sessionMap = getSessionParticipants();
    const peakConcurrent = getPeakConcurrent();

    const sessionIds = Object.keys(sessionMap);
    const sessions = sessionIds.length > 0
      ? await prisma.session.findMany({
          where: { id: { in: sessionIds } },
          select: { id: true, title: true },
        })
      : [];

    res.json({
      onlineCount: users.length,
      peakConcurrent,
      users,
      sessions: sessions.map(s => ({
        sessionId: s.id,
        sessionTitle: s.title,
        count: sessionMap[s.id] || 0,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch online users' });
  }
});

// Public count only
router.get('/count', async (req, res: Response) => {
  try {
    const users = getConnectedUsers();
    const peakConcurrent = getPeakConcurrent();
    res.json({ onlineCount: users.length, peakConcurrent });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch online count' });
  }
});

export default router;
