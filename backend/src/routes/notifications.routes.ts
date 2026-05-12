import { Router, Response } from 'express';
import { prisma } from "../lib/prisma";
import { io } from "../server";
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const unreadCount = await prisma.notification.count({
      where: { userId: req.user!.id, isRead: false },
    });
    res.json({ notifications, unreadCount });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

router.put('/:id/read', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.notification.update({
      where: { id: req.params.id as string },
      data: { isRead: true },
    });
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

router.post('/broadcast', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { title, message, type } = req.body;
    const users = await prisma.user.findMany({ select: { id: true } });
    await prisma.notification.createMany({
      data: users.map((u: { id: string }) => ({
        title, message, type: type || 'announcement', userId: u.id,
      })),
    });
    io.emit('notification', { title, message, type: type || 'announcement' });
    res.json({ message: `Notification sent to ${users.length} users` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to broadcast notification' });
  }
});

export default router;
