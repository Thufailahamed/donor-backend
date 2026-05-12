import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { io } from '../server';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { validate, schemas } from '../middleware/validation.middleware';
import { broadcastToSession } from '../services/socket.service';
import { moderateContent, findSimilarQuestion } from '../services/ai.service';
import { logActivity, logModeratorAction } from '../services/activity-log.service';
import { redis } from '../lib/redis';

const router = Router();

// Helper to increment engagement score in Redis
const incrementScore = async (userId: string, points: number) => {
  if (redis) {
    try {
      await redis.zincrby('engagement_leaderboard', points, userId);
    } catch (e) { /* ignore */ }
  }
};

// Submit a question to a session
router.post('/session/:sessionId', authenticate, validate(schemas.submitQuestion), async (req: AuthRequest, res: Response) => {
  try {
    const { text, parentId } = req.body;
    const sessionId = req.params.sessionId as string;

    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // 1. Create question immediately with ANALYZING status
    const question = await prisma.question.create({
      data: { 
        text, 
        sessionId, 
        userId: req.user!.id, 
        parentId: parentId || null,
        status: 'ANALYZING' 
      },
      include: {
        user: { select: { id: true, name: true, isGuest: true } },
        _count: { select: { upvotes: true } },
      },
    });

    // 2. Broadcast and respond right away
    broadcastToSession(io, sessionId, 'new-question', {
      ...question,
      upvoteCount: 0,
      hasUpvoted: false,
    });

    res.status(201).json({ question: { ...question, upvoteCount: 0 } });

    // 3. Perform AI analysis in the background
    (async () => {
      try {
        const recentQuestions = !parentId ? await prisma.question.findMany({
          where: { sessionId, parentId: null, id: { not: question.id }, status: { in: ['PENDING', 'HIGHLIGHTED'] } },
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: { id: true, text: true }
        }) : [];

        const [moderation, duplicateCheck] = await Promise.all([
          moderateContent(text),
          !parentId && recentQuestions.length > 0 ? findSimilarQuestion(text, recentQuestions) : Promise.resolve({ isDuplicate: false, duplicateOfId: null })
        ]);

        let isFlagged = false;
        if (!moderation.isAppropriate) {
          isFlagged = true;
          await prisma.flaggedContent.create({
            data: {
              questionId: question.id,
              reason: moderation.reason || 'Flagged by AI moderation',
              severity: 'HIGH',
            },
          });
        }

        let finalStatus = 'PENDING';
        let actualParentId = parentId || null;
        let wasMergedAsSimilar = false;

        // Handle duplicate detection (similar to merge)
        if (!actualParentId && duplicateCheck.isDuplicate && duplicateCheck.duplicateOfId) {
          actualParentId = duplicateCheck.duplicateOfId;
          wasMergedAsSimilar = true;

          // Add upvote to original question
          const existingVote = await prisma.questionUpvote.findUnique({
            where: { questionId_userId: { questionId: actualParentId, userId: question.userId } }
          });

          if (!existingVote) {
            await prisma.questionUpvote.create({
              data: { questionId: actualParentId, userId: question.userId }
            });
            const upvoteCount = await prisma.questionUpvote.count({ where: { questionId: actualParentId } });
            broadcastToSession(io, sessionId, 'question-upvoted', { questionId: actualParentId, upvoteCount });
          }

          // Instead of deleting, we re-parent it to the original question
          await prisma.question.update({
            where: { id: question.id },
            data: { 
              parentId: actualParentId,
              status: 'PENDING', // It's now a reply
              isSimilarMerge: true
            }
          });

          // Broadcast that it's now a reply (status changed from ANALYZING to PENDING)
          broadcastToSession(io, sessionId, 'question-status-changed', { 
            questionId: question.id, 
            status: 'PENDING',
            parentId: actualParentId,
            isSimilarMerge: true
          });
          return;
        }

        // Update the question with final results
        const updatedQuestion = await prisma.question.update({
          where: { id: question.id },
          data: { 
            status: finalStatus,
            isFlagged,
            isSimilarMerge: wasMergedAsSimilar
          },
          include: {
            user: { select: { id: true, name: true, isGuest: true } },
            _count: { select: { upvotes: true } },
          },
        });

        // Broadcast the update (status change from ANALYZING to PENDING)
        broadcastToSession(io, sessionId, 'question-status-changed', { 
          questionId: updatedQuestion.id, 
          status: finalStatus,
          isFlagged,
          isSimilarMerge: wasMergedAsSimilar
        });

        logActivity({
          userId: updatedQuestion.userId,
          userName: updatedQuestion.user.name,
          action: 'ASK_QUESTION_COMPLETE',
          targetType: 'QUESTION',
          targetId: updatedQuestion.id,
          sessionId,
        });

      } catch (bgError) {
        console.error('Background AI analysis error:', bgError);
        // Fallback: set to PENDING anyway
        await prisma.question.update({ where: { id: question.id }, data: { status: 'PENDING' } }).catch(() => {});
        broadcastToSession(io, sessionId, 'question-status-changed', { questionId: question.id, status: 'PENDING' });
      }
    })();

    logActivity({
      userId: req.user!.id,
      userName: req.user!.name,
      action: 'ASK_QUESTION_STARTED',
      targetType: 'QUESTION',
      targetId: question.id,
      sessionId,
    });

    // Increment score for asking a question
    incrementScore(req.user!.id, parentId ? 2 : 3);

    // Clear cache for all sessions
    const redisClient = redis;
    if (redisClient && typeof redisClient.keys === 'function') {
      const keys = await redisClient.keys(`questions:list:${sessionId}:*`);
      if (keys.length > 0) await redisClient.del(...keys);
    }

  } catch (error) {
    console.error('Submit question error:', error);
    res.status(500).json({ error: 'Failed to submit question' });
  }
});

// List questions for a session
router.get('/session/:sessionId', async (req, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    const { sort, status } = req.query;
    const userId = req.headers['x-user-id'] as string;

    // Try to get from cache first (short 10s cache for high speed refreshes)
    const cacheKey = `questions:list:${sessionId}:${sort || 'popular'}:${status || 'all'}`;
    const redisClient = redis;
    const cached = redisClient ? await redisClient.get(cacheKey) : null;
    if (cached) {
      const parsed = JSON.parse(cached);
      // Update hasUpvoted flag for the current user
      const userAdjusted = parsed.map((q: any) => ({
        ...q,
        hasUpvoted: userId ? q.upvoteUserIds?.includes(userId) : false,
        replies: q.replies?.map((r: any) => ({
          ...r,
          hasUpvoted: userId ? r.upvoteUserIds?.includes(userId) : false,
        }))
      }));
      return res.json({ questions: userAdjusted });
    }

    const where: any = { sessionId, parentId: null };
    if (status && ['PENDING', 'ANSWERED', 'HIGHLIGHTED', 'DISMISSED', 'ANALYZING'].includes(status as string)) {
      where.status = status;
    }

    let orderBy: any = { createdAt: 'desc' };
    if (sort === 'popular') orderBy = { upvotes: { _count: 'desc' } };
    else if (sort === 'oldest') orderBy = { createdAt: 'asc' };

    const questions = await prisma.question.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, isGuest: true } },
        _count: { select: { upvotes: true } },
        upvotes: { 
          select: { userId: true, user: { select: { name: true } } },
        },
        replies: {
          include: {
            user: { select: { id: true, name: true, isGuest: true } },
            _count: { select: { upvotes: true } },
            upvotes: { 
              select: { userId: true, user: { select: { name: true } } },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy,
    });

    const formattedQuestions = questions.map((q: any) => ({
      ...q,
      upvoteCount: q._count.upvotes,
      upvoteUserIds: q.upvotes.map((u: any) => u.userId), // Store for cache reuse
      hasUpvoted: userId ? q.upvotes.some((u: any) => u.userId === userId) : false,
      recentUpvoters: q.upvotes.slice(0, 3).map((u: any) => u.user?.name).filter(Boolean),
      upvotes: undefined,
      _count: undefined,
      replies: (q.replies || []).map((r: any) => ({
        ...r,
        upvoteCount: r._count?.upvotes || 0,
        upvoteUserIds: r.upvotes.map((u: any) => u.userId),
        hasUpvoted: userId ? r.upvotes.some((u: any) => u.userId === userId) : false,
        recentUpvoters: r.upvotes.slice(0, 3).map((u: any) => u.user?.name).filter(Boolean),
        upvotes: undefined,
        _count: undefined,
      })),
    }));

    // Cache the result for 10 seconds
    if (redisClient) {
      await redisClient.set(cacheKey, JSON.stringify(formattedQuestions), 'EX', 10);
    }

    res.json({ questions: formattedQuestions });
  } catch (error: any) {
    console.error('List questions error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch questions' });
  }
});

// Upvote/unvote a question
router.post('/:id/upvote', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;

    const existing = await prisma.questionUpvote.findUnique({
      where: { questionId_userId: { questionId: id, userId } },
    });

    if (existing) {
      await prisma.questionUpvote.delete({ where: { id: existing.id } });
    } else {
      await prisma.questionUpvote.create({ data: { questionId: id, userId } });
    }

    const upvoteCount = await prisma.questionUpvote.count({ where: { questionId: id } });
    const question = await prisma.question.findUnique({ where: { id }, select: { sessionId: true } });

    if (question) {
      broadcastToSession(io, question.sessionId, 'question-upvoted', {
        questionId: id, upvoteCount, userId, action: existing ? 'removed' : 'added',
      });
    }

    if (!existing) {
      logActivity({
        userId,
        userName: req.user!.name,
        action: 'UPVOTE',
        targetType: 'QUESTION',
        targetId: id,
        sessionId: question?.sessionId,
      });

      // Increment score for receiving an upvote
      if (question) {
        // We need the recipient's ID. Let's fetch it if not already known.
        // For now, let's assume we can fetch it. 
        const targetQuestion = await prisma.question.findUnique({ where: { id }, select: { userId: true } });
        if (targetQuestion) {
          incrementScore(targetQuestion.userId, 1);
        }
      }
    }

    res.json({ upvoteCount, hasUpvoted: !existing });
  } catch (error) {
    console.error('Upvote error:', error);
    res.status(500).json({ error: 'Failed to toggle upvote' });
  }
});

// Admin Highlight/Unhighlight a question
router.put('/:id/admin-highlight', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { isAdminHighlighted } = req.body;

    const question = await prisma.question.update({
      where: { id },
      data: { isAdminHighlighted },
      include: {
        user: { select: { id: true, name: true, isGuest: true } },
      },
    });

    broadcastToSession(io, question.sessionId, 'question-admin-highlighted', {
      questionId: id,
      isAdminHighlighted: question.isAdminHighlighted
    });

    logModeratorAction({
      moderatorId: req.user!.id,
      moderatorName: req.user!.name,
      action: isAdminHighlighted ? 'ADMIN_HIGHLIGHT' : 'ADMIN_UNHIGHLIGHT',
      targetType: 'QUESTION',
      targetId: id,
      sessionId: question.sessionId,
    });

    // Invalidate cache
    const patterns = await redis?.keys(`questions:list:${question.sessionId}:*`);
    if (patterns && patterns.length > 0) {
      await redis?.del(...patterns);
    }

    res.json({ question });
  } catch (error) {
    res.status(500).json({ error: 'Failed to admin highlight question' });
  }
});

// Pin/Unpin a question
router.put('/:id/pin', authenticate, requireRole('MODERATOR', 'ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { isPinned } = req.body;

    const question = await prisma.question.update({
      where: { id },
      data: { isPinned },
      include: {
        user: { select: { id: true, name: true, isGuest: true } },
      },
    });

    broadcastToSession(io, question.sessionId, 'question-pinned', question);

    logModeratorAction({
      moderatorId: req.user!.id,
      moderatorName: req.user!.name,
      action: isPinned ? 'PIN' : 'UNPIN',
      targetType: 'QUESTION',
      targetId: id,
      sessionId: question.sessionId,
    });

    res.json({ question });
  } catch (error) {
    res.status(500).json({ error: 'Failed to pin question' });
  }
});

// Update question status (moderator/speaker/admin)
router.put('/:id/status', authenticate, requireRole('MODERATOR', 'SPEAKER', 'ADMIN'), validate(schemas.updateQuestionStatus), async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;
    const question = await prisma.question.update({
      where: { id: req.params.id as string },
      data: { status },
      include: { user: { select: { id: true, name: true } } },
    });

    broadcastToSession(io, question.sessionId, 'question-status-changed', {
      questionId: question.id, status: question.status, userId: question.userId,
    });

    logActivity({
      userId: req.user!.id,
      userName: req.user!.name,
      action: 'CHANGE_STATUS',
      targetType: 'QUESTION',
      targetId: question.id,
      sessionId: question.sessionId,
      details: status,
    });

    logModeratorAction({
      moderatorId: req.user!.id,
      moderatorName: req.user!.name,
      action: `STATUS_${status}`,
      targetType: 'QUESTION',
      targetId: question.id,
      sessionId: question.sessionId,
    });

    // Invalidate cache
    const patterns = await redis?.keys(`questions:list:${question.sessionId}:*`);
    if (patterns && patterns.length > 0) {
      await redis?.del(...patterns);
    }

    res.json({ question });
  } catch (error) {
    console.error('Update question status error:', error);
    res.status(500).json({ error: 'Failed to update question status' });
  }
});

// Update moderator notes
router.put('/:id/notes', authenticate, requireRole('MODERATOR', 'ADMIN', 'SPEAKER'), async (req: AuthRequest, res: Response) => {
  try {
    const { moderatorNotes } = req.body;
    if (typeof moderatorNotes !== 'string' || moderatorNotes.length > 2000) {
      return res.status(400).json({ error: 'Notes must be a string under 2000 characters' });
    }

    const question = await prisma.question.update({
      where: { id: req.params.id as string },
      data: { moderatorNotes },
    });

    logModeratorAction({
      moderatorId: req.user!.id,
      moderatorName: req.user!.name,
      action: 'UPDATE_NOTES',
      targetType: 'QUESTION',
      targetId: question.id,
      sessionId: question.sessionId,
    });

    res.json({ question });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update notes' });
  }
});

// Merge questions
router.post('/merge', authenticate, requireRole('MODERATOR', 'ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { targetId, sourceIds } = req.body;
    if (!targetId || !Array.isArray(sourceIds) || sourceIds.length === 0) {
      return res.status(400).json({ error: 'targetId and sourceIds[] required' });
    }

    const target = await prisma.question.findUnique({ where: { id: targetId } });
    if (!target) return res.status(404).json({ error: 'Target question not found' });

    await prisma.$transaction(async (tx) => {
      for (const sourceId of sourceIds) {
        // Move upvotes to target (skip duplicates)
        const sourceUpvotes = await tx.questionUpvote.findMany({ where: { questionId: sourceId } });
        for (const uv of sourceUpvotes) {
          const exists = await tx.questionUpvote.findUnique({
            where: { questionId_userId: { questionId: targetId, userId: uv.userId } },
          });
          if (!exists) {
            await tx.questionUpvote.create({ data: { questionId: targetId, userId: uv.userId } });
          }
        }

        // Move replies to target
        await tx.question.updateMany({ where: { parentId: sourceId }, data: { parentId: targetId } });

        // Delete source
        await tx.questionUpvote.deleteMany({ where: { questionId: sourceId } });
        await tx.question.delete({ where: { id: sourceId } });
      }
    });

    const updatedTarget = await prisma.question.findUnique({
      where: { id: targetId },
      include: { _count: { select: { upvotes: true } } },
    });

    const upvoteCount = updatedTarget?._count.upvotes || 0;
    broadcastToSession(io, target.sessionId, 'question-upvoted', { questionId: targetId, upvoteCount });

    logModeratorAction({
      moderatorId: req.user!.id,
      moderatorName: req.user!.name,
      action: 'MERGE_QUESTIONS',
      targetType: 'QUESTION',
      targetId,
      sessionId: target.sessionId,
      details: JSON.stringify({ sourceIds }),
    });

    res.json({ message: 'Questions merged', targetId, newUpvoteCount: upvoteCount });
  } catch (error) {
    console.error('Merge error:', error);
    res.status(500).json({ error: 'Failed to merge questions' });
  }
});

// Delete question (owner or moderator/admin)
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const question = await prisma.question.findUnique({
      where: { id: req.params.id as string },
      select: { sessionId: true, userId: true },
    });

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    if (question.userId !== req.user!.id && !['MODERATOR', 'ADMIN'].includes(req.user!.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const questionId = req.params.id as string;

    await prisma.$transaction([
      prisma.question.deleteMany({ where: { parentId: questionId } }),
      prisma.question.delete({ where: { id: questionId } })
    ]);

    broadcastToSession(io, question.sessionId, 'question-deleted', {
      questionId,
    });

    logActivity({
      userId: req.user!.id,
      userName: req.user!.name,
      action: 'DELETE_QUESTION',
      targetType: 'QUESTION',
      targetId: req.params.id as string,
      sessionId: question.sessionId,
    });

    if (['MODERATOR', 'ADMIN'].includes(req.user!.role)) {
      logModeratorAction({
        moderatorId: req.user!.id,
        moderatorName: req.user!.name,
        action: 'DELETE_QUESTION',
        targetType: 'QUESTION',
        targetId: req.params.id as string,
        sessionId: question.sessionId,
      });
    }

    // Invalidate cache
    const patterns = await redis?.keys(`questions:list:${question.sessionId}:*`);
    if (patterns && patterns.length > 0) {
      await redis?.del(...patterns);
    }

    res.json({ message: 'Question deleted' });
  } catch (error) {
    console.error('Delete question error:', error);
    res.status(500).json({ error: 'Failed to delete question' });
  }
});

// Bulk delete questions (MODERATOR/ADMIN)
router.post('/bulk-delete', authenticate, requireRole('MODERATOR', 'ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { questionIds, sessionId } = req.body;
    if (!Array.isArray(questionIds) || !sessionId) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    // Delete questions and their replies
    await prisma.$transaction([
      prisma.question.deleteMany({ where: { parentId: { in: questionIds } } }),
      prisma.question.deleteMany({ where: { id: { in: questionIds } } })
    ]);

    // Broadcast to session
    questionIds.forEach(id => {
      broadcastToSession(io, sessionId, 'question-deleted', { questionId: id });
    });

    logActivity({
      userId: req.user!.id,
      userName: req.user!.name,
      action: 'BULK_DELETE_QUESTIONS',
      sessionId,
      details: `Deleted ${questionIds.length} questions`
    });

    // Invalidate cache
    const patterns = await redis?.keys(`questions:list:${sessionId}:*`);
    if (patterns && patterns.length > 0) {
      await redis?.del(...patterns);
    }

    res.json({ message: `Deleted ${questionIds.length} questions` });
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({ error: 'Failed to delete questions' });
  }
});

// Delete all questions for a session (ADMIN only)
router.delete('/session/:sessionId/all', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId } = req.params;
    if (typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'Invalid sessionId' });
    }

    await prisma.question.deleteMany({ where: { sessionId: sessionId } });

    broadcastToSession(io, sessionId, 'all-questions-deleted', {});

    logActivity({
      userId: req.user!.id,
      userName: req.user!.name,
      action: 'DELETE_ALL_QUESTIONS',
      sessionId: sessionId,
    });

    // Invalidate cache
    const redisClient = redis;
    if (redisClient && typeof redisClient.keys === 'function') {
      const patterns = await redisClient.keys(`questions:list:${sessionId}:*`);
      if (patterns && patterns.length > 0) {
        await redisClient.del(...patterns);
      }
    }

    res.json({ message: 'All questions deleted' });
  } catch (error) {
    console.error('Delete all questions error:', error);
    res.status(500).json({ error: 'Failed to delete all questions' });
  }
});

export default router;
