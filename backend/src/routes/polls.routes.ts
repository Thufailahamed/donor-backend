import { Router, Response } from 'express';
import { prisma } from "../lib/prisma";
import { io } from "../server";
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { broadcastToSession } from '../services/socket.service';

const router = Router();

// Create a new poll (Admin/Moderator)
router.post('/session/:sessionId', authenticate, requireRole('ADMIN', 'MODERATOR', 'SPEAKER'), async (req: AuthRequest, res: Response) => {
  try {
    const { question, options } = req.body;
    
    // Deactivate existing active polls for this session
    await prisma.poll.updateMany({
      where: { sessionId: req.params.sessionId as string, isActive: true },
      data: { isActive: false }
    });

    const poll = await prisma.poll.create({
      data: {
        question,
        sessionId: req.params.sessionId as string,
        isActive: true,
        options: {
          create: options.map((opt: string) => ({ text: opt }))
        }
      },
      include: { options: true }
    });

    broadcastToSession(io, req.params.sessionId as string, 'poll-started', poll);

    res.status(201).json({ poll });
  } catch (error) {
    console.error('Create poll error:', error);
    res.status(500).json({ error: 'Failed to create poll' });
  }
});

// Get active poll for session
router.get('/session/:sessionId/active', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const poll = await prisma.poll.findFirst({
      where: { sessionId: req.params.sessionId as string, isActive: true },
      include: { 
        options: {
          include: {
            _count: { select: { userVotes: true } }
          }
        } 
      }
    });

    if (!poll) return res.json({ poll: null });

    // Check if user has voted
    const userVote = await prisma.pollVote.findFirst({
      where: { pollId: poll.id, userId: req.user!.id }
    });

    res.json({ poll: { ...poll, hasVoted: !!userVote, votedOptionId: userVote?.pollOptionId } });
  } catch (error) {
    console.error('Get active poll error:', error);
    res.status(500).json({ error: 'Failed to fetch poll' });
  }
});

// Vote in a poll
router.post('/:pollId/vote', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const optionId = req.body.optionId as string;
    const pollId = req.params.pollId as string;
    const userId = req.user!.id;

    // Check if already voted
    const existing = await prisma.pollVote.findFirst({
      where: { pollId: pollId as string, userId: userId as string }
    });

    if (existing) {
      return res.status(400).json({ error: 'Already voted in this poll' });
    }

    // Create vote and increment option counter
    await prisma.$transaction([
      prisma.pollVote.create({
        data: { pollId: pollId as string, pollOptionId: optionId as string, userId: userId as string }
      }),
      // prisma.pollOption.update is cleaner but we can just count votes dynamically
    ]);

    // Broadcast updated results
    const poll = await prisma.poll.findUnique({
      where: { id: pollId as string },
      include: { 
        options: {
          include: {
            _count: { select: { userVotes: true } }
          }
        } 
      }
    });

    broadcastToSession(io, poll!.sessionId, 'poll-voted', poll);

    res.json({ success: true, poll });
  } catch (error) {
    console.error('Vote error:', error);
    res.status(500).json({ error: 'Failed to vote' });
  }
});

// End a poll (Admin/Moderator)
router.post('/:pollId/end', authenticate, requireRole('ADMIN', 'MODERATOR', 'SPEAKER'), async (req: AuthRequest, res: Response) => {
  try {
    const poll = await prisma.poll.update({
      where: { id: req.params.pollId as string },
      data: { isActive: false },
      include: { options: true }
    });

    broadcastToSession(io, poll.sessionId, 'poll-ended', poll);

    res.json({ poll });
  } catch (error) {
    console.error('End poll error:', error);
    res.status(500).json({ error: 'Failed to end poll' });
  }
});

export default router;
