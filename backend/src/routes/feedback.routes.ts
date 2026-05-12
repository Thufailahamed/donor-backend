import { Router, Response } from 'express';
import { prisma } from "../lib/prisma";
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { validate, schemas } from '../middleware/validation.middleware';
import { logActivity } from '../services/activity-log.service';

const router = Router();

// Submit feedback
router.post('/session/:sessionId', authenticate, validate(schemas.submitFeedback), async (req: AuthRequest, res: Response) => {
  try {
    const { rating, text, type } = req.body;
    const { sessionId } = req.params;
    const userId = req.user!.id;

    const existing = await prisma.feedback.findFirst({
      where: { userId, sessionId: (type === 'overall' ? null : sessionId) as string | null, type: (type || 'session') as any },
    });
    if (existing) {
      return res.status(409).json({ error: 'You have already submitted feedback for this session' });
    }

    const feedback = await prisma.feedback.create({
      data: {
        rating,
        text: text || null,
        type: (type || 'session') as any,
        sessionId: (type === 'overall' ? null : sessionId) as string | null,
        userId,
      },
      include: { user: { select: { id: true, name: true } } },
    });

    logActivity({
      userId,
      userName: req.user!.name,
      action: 'SUBMIT_FEEDBACK',
      targetType: 'FEEDBACK',
      targetId: feedback.id,
      sessionId: type === 'overall' ? undefined : (sessionId as string | undefined),
    });

    res.status(201).json({ feedback });
  } catch (error) {
    console.error('Submit feedback error:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

// List feedback for a session (moderator/admin)
router.get('/session/:sessionId', authenticate, requireRole('MODERATOR', 'ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const feedback = await prisma.feedback.findMany({
      where: { sessionId: req.params.sessionId as string },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ feedback });
  } catch (error) {
    console.error('List feedback error:', error);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

// Get overall feedback
router.get('/overall', authenticate, requireRole('MODERATOR', 'ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const feedback = await prisma.feedback.findMany({
      where: { type: 'overall' },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ feedback });
  } catch (error) {
    console.error('Get overall feedback error:', error);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

export default router;
