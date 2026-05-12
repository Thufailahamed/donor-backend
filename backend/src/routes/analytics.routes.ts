import { Router, Response } from 'express';
import { prisma } from "../lib/prisma";
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { redis } from '../lib/redis';

const router = Router();

// Engagement metrics
router.get('/engagement', authenticate, requireRole('ADMIN', 'MODERATOR'), async (req: AuthRequest, res: Response) => {
  try {
    const cacheKey = 'analytics:engagement:overview';
    const cached = await redis?.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const sessions = await prisma.session.findMany({
      include: { _count: { select: { questions: true, feedback: true, voiceNotes: true } } },
      orderBy: { startTime: 'asc' },
    });

    const [totalQuestions, totalFeedback, totalVoiceNotes, totalUsers] = await Promise.all([
      prisma.question.count(),
      prisma.feedback.count(),
      prisma.voiceNote.count(),
      prisma.user.count(),
    ]);

    const result = {
      overview: { totalQuestions, totalFeedback, totalVoiceNotes, totalUsers },
      sessions: sessions.map((s: any) => ({
        id: s.id, title: s.title,
        questions: s._count.questions, feedback: s._count.feedback, voiceNotes: s._count.voiceNotes,
      })),
    };

    await redis?.set(cacheKey, JSON.stringify(result), 'EX', 120); // 2 minute cache
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch engagement metrics' });
  }
});

// Sentiment analysis
router.get('/sentiment', authenticate, requireRole('ADMIN', 'MODERATOR'), async (req: AuthRequest, res: Response) => {
  try {
    const feedback = await prisma.feedback.findMany({ select: { rating: true } });
    const positive = feedback.filter((f: any) => f.rating >= 4).length;
    const neutral = feedback.filter((f: any) => f.rating === 3).length;
    const negative = feedback.filter((f: any) => f.rating <= 2).length;
    const avg = feedback.length > 0 ? feedback.reduce((a: number, f: any) => a + f.rating, 0) / feedback.length : 0;

    res.json({ sentiment: { positive, neutral, negative, average: Math.round(avg * 10) / 10, total: feedback.length } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sentiment' });
  }
});

// Topic analysis
router.get('/topics', authenticate, requireRole('ADMIN', 'MODERATOR'), async (req: AuthRequest, res: Response) => {
  try {
    const questions = await prisma.question.findMany({ select: { text: true } });
    const stopWords = new Set(['the','a','an','is','are','was','were','to','of','in','for','on','with','at','by','and','or','but','not','this','that','it','how','what','why','when','where','who','can','do','does','will','would','should','could','has','have','had']);
    const wordCount: Record<string, number> = {};

    questions.forEach((q: any) => {
      q.text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).forEach((word: string) => {
        if (word.length > 2 && !stopWords.has(word)) wordCount[word] = (wordCount[word] || 0) + 1;
      });
    });

    const topics = Object.entries(wordCount).sort((a, b) => b[1] - a[1]).slice(0, 30).map(([word, count]) => ({ word, count }));
    res.json({ topics });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch topics' });
  }
});

// Engagement heatmap
router.get('/heatmap/:sessionId', authenticate, requireRole('ADMIN', 'MODERATOR'), async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const questions = await prisma.question.findMany({ where: { sessionId }, select: { createdAt: true }, orderBy: { createdAt: 'asc' } });

    const buckets: Record<string, number> = {};
    const startTime = session.startTime.getTime();
    const endTime = session.endTime.getTime();
    for (let t = startTime; t <= endTime; t += 15 * 60 * 1000) buckets[new Date(t).toISOString()] = 0;

    questions.forEach(q => {
      const bucketTime = Math.floor(q.createdAt.getTime() / (15 * 60 * 1000)) * (15 * 60 * 1000);
      const bucketKey = new Date(bucketTime).toISOString();
      if (buckets[bucketKey] !== undefined) buckets[bucketKey]++;
    });

    res.json({ heatmap: Object.entries(buckets).map(([time, count]) => ({ time, count })) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch heatmap' });
  }
});

// Engagement scores per user (Redis-backed leaderboard)
router.get('/engagement-scores', authenticate, requireRole('ADMIN', 'MODERATOR'), async (req: AuthRequest, res: Response) => {
  try {
    if (!redis) {
      // Fallback if Redis is not available
      const users = await prisma.user.findMany({
        take: 50,
        select: { id: true, name: true, role: true, _count: { select: { questions: true, feedback: true, pollVotes: true } } },
      });
      return res.json({ scores: users.map(u => ({ userId: u.id, userName: u.name, score: 0, breakdown: u._count })) });
    }

    // Get top 100 users from Redis
    const rawScores = await redis.zrevrange('engagement_leaderboard', 0, 99, 'WITHSCORES');
    
    // Redis returns [id1, score1, id2, score2, ...]
    const scores = [];
    for (let i = 0; i < rawScores.length; i += 2) {
      const userId = rawScores[i];
      const score = parseInt(rawScores[i + 1]);
      
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, role: true, _count: { select: { questions: true, feedback: true, pollVotes: true } } }
      });

      if (user) {
        scores.push({
          userId,
          userName: user.name,
          role: user.role,
          score,
          breakdown: {
            questionsAsked: user._count.questions,
            feedbackGiven: user._count.feedback,
            pollVotes: user._count.pollVotes,
          }
        });
      }
    }

    res.json({ scores });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Failed to fetch engagement scores' });
  }
});

// Questions over time
router.get('/questions-over-time', authenticate, requireRole('ADMIN', 'MODERATOR'), async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId, interval } = req.query;
    const where: any = {};
    if (sessionId) where.sessionId = sessionId as string;

    const questions = await prisma.question.findMany({
      where,
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const bucketMs = interval === '1h' ? 60 * 60 * 1000 : interval === '1d' ? 24 * 60 * 60 * 1000 : 15 * 60 * 1000;
    const buckets: Record<string, number> = {};

    questions.forEach(q => {
      const bucketTime = Math.floor(q.createdAt.getTime() / bucketMs) * bucketMs;
      const key = new Date(bucketTime).toISOString();
      buckets[key] = (buckets[key] || 0) + 1;
    });

    const data = Object.entries(buckets).map(([time, count]) => ({ time, count })).sort((a, b) => a.time.localeCompare(b.time));
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch questions over time' });
  }
});

// Engagement timeline (multi-series)
router.get('/engagement-timeline', authenticate, requireRole('ADMIN', 'MODERATOR'), async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId } = req.query;
    const where: any = {};
    if (sessionId) where.sessionId = sessionId as string;

    const [questions, upvotes, feedback] = await Promise.all([
      prisma.question.findMany({ where, select: { createdAt: true } }),
      prisma.questionUpvote.findMany({ where: sessionId ? { question: { sessionId: sessionId as string } } : {}, select: { createdAt: true } }),
      prisma.feedback.findMany({ where: sessionId ? { sessionId: sessionId as string } : {}, select: { createdAt: true } }),
    ]);

    const bucketMs = 15 * 60 * 1000;
    const buckets: Record<string, { questions: number; upvotes: number; feedback: number }> = {};

    const addToBucket = (items: any[], field: 'questions' | 'upvotes' | 'feedback') => {
      items.forEach((item: any) => {
        const bucketTime = Math.floor(item.createdAt.getTime() / bucketMs) * bucketMs;
        const key = new Date(bucketTime).toISOString();
        if (!buckets[key]) buckets[key] = { questions: 0, upvotes: 0, feedback: 0 };
        buckets[key][field]++;
      });
    };

    addToBucket(questions, 'questions');
    addToBucket(upvotes, 'upvotes');
    addToBucket(feedback, 'feedback');

    const data = Object.entries(buckets)
      .map(([time, counts]) => ({ time, ...counts }))
      .sort((a, b) => a.time.localeCompare(b.time));

    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch engagement timeline' });
  }
});

export default router;
