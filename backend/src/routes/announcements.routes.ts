import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { io } from '../server';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { broadcastToSession } from '../services/socket.service';

const router = Router();

// Create an announcement
router.post('/session/:sessionId', authenticate, requireRole('MODERATOR', 'ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Announcement text is required' });
    }

    const announcement = await prisma.announcement.create({
      data: {
        text: text.trim(),
        sessionId,
        createdBy: req.user!.id,
      },
      include: {
        author: { select: { id: true, name: true } }
      }
    });

    broadcastToSession(io, sessionId, 'new-announcement', announcement);

    res.status(201).json({ announcement });
  } catch (error) {
    console.error('Create announcement error:', error);
    res.status(500).json({ error: 'Failed to create announcement' });
  }
});

// Get active announcements for a session
router.get('/session/:sessionId/active', async (req, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;

    const announcements = await prisma.announcement.findMany({
      where: { sessionId, isActive: true },
      include: {
        author: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ announcements });
  } catch (error) {
    console.error('Get announcements error:', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

// Deactivate (dismiss) an announcement
router.delete('/:id', authenticate, requireRole('MODERATOR', 'ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    const announcement = await prisma.announcement.findUnique({ where: { id } });
    if (!announcement) return res.status(404).json({ error: 'Announcement not found' });

    await prisma.announcement.update({ where: { id }, data: { isActive: false } });

    broadcastToSession(io, announcement.sessionId, 'dismiss-announcement', { id });

    res.json({ message: 'Announcement dismissed' });
  } catch (error) {
    console.error('Dismiss announcement error:', error);
    res.status(500).json({ error: 'Failed to dismiss announcement' });
  }
});

export default router;
