import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';

const router = Router();

// List moderator action logs (paginated, filterable)
router.get('/', authenticate, requireRole('ADMIN', 'MODERATOR'), async (req: AuthRequest, res: Response) => {
  try {
    const { moderatorId, action, sessionId, from, to, page = '1', limit = '50' } = req.query;
    const where: any = {};

    if (moderatorId) where.moderatorId = moderatorId as string;
    if (action) where.action = action as string;
    if (sessionId) where.sessionId = sessionId as string;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from as string);
      if (to) where.createdAt.lte = new Date(to as string);
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const [logs, total] = await Promise.all([
      prisma.moderatorActionLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      prisma.moderatorActionLog.count({ where }),
    ]);

    res.json({ logs, total, page: parseInt(page as string), totalPages: Math.ceil(total / take) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch moderator logs' });
  }
});

// Moderator action stats
router.get('/stats', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const byAction = await prisma.moderatorActionLog.groupBy({
      by: ['action'],
      _count: true,
      orderBy: { _count: { action: 'desc' } },
    });

    const byModerator = await prisma.moderatorActionLog.groupBy({
      by: ['moderatorId', 'moderatorName'],
      _count: true,
      orderBy: { _count: { moderatorId: 'desc' } },
    });

    res.json({
      byAction: byAction.map((a: any) => ({ action: a.action, count: a._count })),
      byModerator: byModerator.map((m: any) => ({ moderatorId: m.moderatorId, moderatorName: m.moderatorName, count: m._count })),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch moderator stats' });
  }
});

export default router;
