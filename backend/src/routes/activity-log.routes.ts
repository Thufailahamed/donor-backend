import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';

const router = Router();

// List activity logs (paginated, filterable)
router.get('/', authenticate, requireRole('ADMIN', 'MODERATOR'), async (req: AuthRequest, res: Response) => {
  try {
    const { action, sessionId, userId, from, to, page = '1', limit = '50' } = req.query;
    const where: any = {};

    if (action) where.action = action as string;
    if (sessionId) where.sessionId = sessionId as string;
    if (userId) where.userId = userId as string;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from as string);
      if (to) where.createdAt.lte = new Date(to as string);
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      prisma.activityLog.count({ where }),
    ]);

    res.json({ logs, total, page: parseInt(page as string), totalPages: Math.ceil(total / take) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch activity logs' });
  }
});

// Activity stats
router.get('/stats', authenticate, requireRole('ADMIN', 'MODERATOR'), async (req: AuthRequest, res: Response) => {
  try {
    const byAction = await prisma.activityLog.groupBy({
      by: ['action'],
      _count: true,
      orderBy: { _count: { action: 'desc' } },
    });

    res.json({
      byAction: byAction.map((a: any) => ({ action: a.action, count: a._count })),
      total: byAction.reduce((sum: number, a: any) => sum + a._count, 0),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch activity stats' });
  }
});

export default router;
