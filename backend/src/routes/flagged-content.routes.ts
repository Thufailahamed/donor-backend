import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { logModeratorAction } from '../services/activity-log.service';

const router = Router();

// List flagged content
router.get('/', authenticate, requireRole('ADMIN', 'MODERATOR'), async (req: AuthRequest, res: Response) => {
  try {
    const { isResolved, severity } = req.query;
    const where: any = {};
    if (isResolved !== undefined) where.isResolved = isResolved === 'true';
    if (severity) where.severity = severity as string;

    const flagged = await prisma.flaggedContent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Enrich with question data
    const questionIds = flagged.map((f: any) => f.questionId).filter((id: string) => id !== 'pending');
    const questions = questionIds.length > 0
      ? await prisma.question.findMany({
          where: { id: { in: questionIds } },
          include: { user: { select: { id: true, name: true, isGuest: true } } },
        })
      : [];

    const questionMap = Object.fromEntries(questions.map((q: any) => [q.id, q]));

    const result = flagged.map((f: any) => ({
      ...f,
      question: questionMap[f.questionId] || null,
    }));

    res.json({ flagged: result });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch flagged content' });
  }
});

// Resolve flagged content
router.put('/:id/resolve', authenticate, requireRole('ADMIN', 'MODERATOR'), async (req: AuthRequest, res: Response) => {
  try {
    const { action } = req.body; // "APPROVE" | "DELETE"
    const flagged = await prisma.flaggedContent.findUnique({ where: { id: req.params.id as string } });
    if (!flagged) return res.status(404).json({ error: 'Flagged content not found' });

    if (action === 'APPROVE') {
      await prisma.$transaction([
        prisma.flaggedContent.update({
          where: { id: req.params.id as string },
          data: { isResolved: true, resolvedBy: req.user!.id, resolvedAt: new Date() },
        }),
        prisma.question.update({
          where: { id: flagged.questionId },
          data: { isFlagged: false },
        }),
      ]);
    } else if (action === 'DELETE') {
      await prisma.$transaction([
        prisma.flaggedContent.update({
          where: { id: req.params.id as string },
          data: { isResolved: true, resolvedBy: req.user!.id, resolvedAt: new Date() },
        }),
        prisma.question.delete({ where: { id: flagged.questionId } }),
      ]);
    }

    logModeratorAction({
      moderatorId: req.user!.id,
      moderatorName: req.user!.name,
      action: action === 'APPROVE' ? 'APPROVE_FLAGGED' : 'DELETE_FLAGGED',
      targetType: 'QUESTION',
      targetId: flagged.questionId,
    });

    res.json({ message: `Flagged content ${action.toLowerCase()}d` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to resolve flagged content' });
  }
});

// Bulk resolve flagged content
router.put('/bulk-resolve', authenticate, requireRole('ADMIN', 'MODERATOR'), async (req: AuthRequest, res: Response) => {
  try {
    const { ids, action } = req.body as { ids: string[]; action: 'APPROVE' | 'DELETE' };

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids must be a non-empty array' });
    }

    if (!['APPROVE', 'DELETE'].includes(action)) {
      return res.status(400).json({ error: 'action must be APPROVE or DELETE' });
    }

    await prisma.$transaction(async (tx) => {
      if (action === 'APPROVE') {
        const flaggedItems = await tx.flaggedContent.findMany({
          where: { id: { in: ids } },
          select: { id: true, questionId: true },
        });

        await tx.flaggedContent.updateMany({
          where: { id: { in: ids } },
          data: { isResolved: true, resolvedBy: req.user!.id, resolvedAt: new Date() },
        });

        const questionIds = flaggedItems.map((f) => f.questionId);
        if (questionIds.length > 0) {
          await tx.question.updateMany({
            where: { id: { in: questionIds } },
            data: { isFlagged: false },
          });
        }
      }

      if (action === 'DELETE') {
        const flaggedItems = await tx.flaggedContent.findMany({
          where: { id: { in: ids } },
          select: { id: true, questionId: true },
        });

        const questionIds = flaggedItems.map((f) => f.questionId);
        if (questionIds.length > 0) {
          await tx.question.deleteMany({
            where: { id: { in: questionIds } },
          });
        }

        await tx.flaggedContent.deleteMany({
          where: { id: { in: ids } },
        });
      }
    });

    res.json({ message: 'Resolved', count: ids.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to bulk resolve flagged content' });
  }
});

export default router;
