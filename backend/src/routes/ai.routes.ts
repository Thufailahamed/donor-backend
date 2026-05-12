import { Router, Response } from 'express';
import { prisma } from "../lib/prisma";
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { generateSessionSummary, clusterQuestions } from '../services/ai.service';

const router = Router();

// Generate a summary for a session (Admin/Moderator)
router.get('/session/:sessionId/summary', authenticate, requireRole('ADMIN', 'MODERATOR'), async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;

    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Fetch session data for the AI to summarize
    const questions = await prisma.question.findMany({
      where: { sessionId, parentId: null },
      orderBy: { upvotes: { _count: 'desc' } },
      take: 20, // Top 20 questions
      include: {
        _count: { select: { upvotes: true, replies: true } }
      }
    });

    const polls = await prisma.poll.findMany({
      where: { sessionId },
      include: {
        options: {
          include: {
            _count: { select: { userVotes: true } }
          }
        }
      }
    });

    const sessionData = {
      title: session.title,
      description: session.description,
      topQuestions: questions.map(q => ({
        text: q.text,
        upvotes: q._count.upvotes,
        replies: q._count.replies,
        status: q.status
      })),
      polls: polls.map(p => ({
        question: p.question,
        options: p.options.map(o => ({
          text: o.text,
          votes: o._count.userVotes
        }))
      }))
    };

    const summary = await generateSessionSummary(sessionData);

    res.json({ summary });
  } catch (error) {
    console.error('Session summary error:', error);
    res.status(500).json({ error: 'Failed to generate session summary' });
  }
});

// AI-powered question clustering
router.get('/session/:sessionId/clusters', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;

    const questions = await prisma.question.findMany({
      where: { sessionId, parentId: null },
      orderBy: { createdAt: 'desc' },
      take: 80,
      select: { id: true, text: true }
    });

    if (questions.length < 3) {
      return res.json({ clusters: [] });
    }

    const clusters = await clusterQuestions(questions);
    res.json({ clusters });
  } catch (error) {
    console.error('Clustering error:', error);
    res.status(500).json({ error: 'Failed to cluster questions' });
  }
});

export default router;
