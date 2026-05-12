import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';

const router = Router();

// List access logs (paginated, filterable)
router.get('/', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { search, role, action, from, to, page = '1', limit = '20' } = req.query;
    const where: any = {};

    if (search) where.name = { contains: search as string };
    if (role) where.role = role as string;
    if (action) where.action = action as string;
    if (from || to) {
      where.loginAt = {};
      if (from) where.loginAt.gte = new Date(from as string);
      if (to) where.loginAt.lte = new Date(to as string);
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const [logs, total] = await Promise.all([
      prisma.accessLog.findMany({ where, orderBy: { loginAt: 'desc' }, skip, take }),
      prisma.accessLog.count({ where }),
    ]);

    res.json({ logs, total, page: parseInt(page as string), totalPages: Math.ceil(total / take) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch access logs' });
  }
});

// Access log stats
router.get('/stats', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const [totalLogins, uniqueUsers, byDevice, byRole] = await Promise.all([
      prisma.accessLog.count({ where: { action: { in: ['LOGIN', 'SOCKET_CONNECT'] } } }),
      prisma.accessLog.groupBy({ by: ['userId'], where: { userId: { not: null } } }).then(r => r.length),
      prisma.accessLog.groupBy({ by: ['deviceType'], _count: true, where: { deviceType: { not: null } } }),
      prisma.accessLog.groupBy({ by: ['role'], _count: true, where: { role: { not: null } } }),
    ]);

    res.json({
      totalLogins,
      uniqueUsers,
      byDevice: Object.fromEntries(byDevice.map((d: any) => [d.deviceType, d._count])),
      byRole: Object.fromEntries(byRole.map((r: any) => [r.role, r._count])),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch access log stats' });
  }
});

export default router;
