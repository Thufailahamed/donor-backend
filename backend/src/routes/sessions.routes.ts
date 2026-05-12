import { Router, Response } from 'express';
import { prisma } from "../lib/prisma";
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { validate, schemas } from '../middleware/validation.middleware';
import { io } from '../server';

import { redis, cacheGet, cacheSet } from '../lib/redis';

const router = Router();

const CACHE_TTL = 300; // 5 minutes for lightning fast landing page load

// List all sessions (public)
router.get('/', async (req, res: Response) => {
  try {
    const { day } = req.query;
    const cacheKey = day ? `sessions:day:${day}` : 'sessions:all';
    
    // Attempt to fetch from Redis
    const cachedData = await cacheGet<{ sessions: any[] }>(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    const where: any = {};
    if (day) where.day = parseInt(day as string);

    const sessions = await prisma.session.findMany({
      where,
      include: {
        speakers: {
          include: {
            speaker: { select: { id: true, name: true, avatarUrl: true, role: true } },
          },
        },
        _count: { select: { questions: true, feedback: true } },
      },
      orderBy: [{ day: 'asc' }, { order: 'asc' }, { startTime: 'asc' }],
    });

    const responseData = { sessions };
    
    // Store in Redis
    await cacheSet(cacheKey, responseData, CACHE_TTL);

    res.json(responseData);
  } catch (error) {
    console.error('List sessions error:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// Get session detail (public)
router.get('/:id', async (req, res: Response) => {
  try {
    const sessionId = req.params.id as string;
    const cacheKey = `session:detail:${sessionId}`;

    const cached = await cacheGet<any>(cacheKey);
    if (cached) return res.json(cached);

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        speakers: {
          include: {
            speaker: { select: { id: true, name: true, avatarUrl: true, role: true, bio: true, organization: true } },
          },
        },
        _count: { select: { questions: true, feedback: true, voiceNotes: true } },
      },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const responseData = { session };
    await cacheSet(cacheKey, responseData, 60); // 1 minute cache

    res.json(responseData);
  } catch (error: any) {
    console.error('Get session error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch session' });
  }
});

// Create session (admin only)
router.post('/', authenticate, requireRole('ADMIN'), validate(schemas.createSession), async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, objectives, track, location, startTime, endTime, order, day, speakerIds } = req.body;

    const session = await prisma.session.create({
      data: {
        title, description, objectives, track, location,
        startTime: new Date(startTime), endTime: new Date(endTime),
        order: order || 0, day: day || 1,
        speakers: speakerIds ? { create: speakerIds.map((id: string) => ({ speakerId: id })) } : undefined,
      },
      include: { speakers: { include: { speaker: { select: { id: true, name: true, avatarUrl: true } } } } },
    });

    io.to('admin-room').emit('session-updated', { action: 'created', session });
    res.status(201).json({ session });
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Update session (admin only)
router.put('/:id', authenticate, requireRole('ADMIN'), validate(schemas.updateSession), async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, objectives, track, location, startTime, endTime, isActive, order, day } = req.body;

    const session = await prisma.session.update({
      where: { id: req.params.id as string },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(objectives !== undefined && { objectives }),
        ...(track !== undefined && { track }),
        ...(location !== undefined && { location }),
        ...(startTime !== undefined && { startTime: new Date(startTime) }),
        ...(endTime !== undefined && { endTime: new Date(endTime) }),
        ...(isActive !== undefined && { isActive }),
        ...(order !== undefined && { order }),
        ...(day !== undefined && { day }),
      },
      include: { speakers: { include: { speaker: { select: { id: true, name: true, avatarUrl: true } } } } },
    });

    io.to('admin-room').emit('session-updated', { action: 'updated', session });
    io.emit('session-status-changed', { sessionId: session.id, isActive: session.isActive });
    res.json({ session });
  } catch (error) {
    console.error('Update session error:', error);
    res.status(500).json({ error: 'Failed to update session' });
  }
});

// Toggle session active
router.patch('/:id/toggle', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const redisClient = redis;
    const targetId = req.params.id as string;
    const current = await prisma.session.findUnique({ where: { id: targetId } });
    if (!current) return res.status(404).json({ error: 'Session not found' });

    const newStatus = !current.isActive;

    if (newStatus === true) {
      // Deactivate ALL other sessions first to ensure only one is live
      await prisma.session.updateMany({
        where: { id: { not: targetId }, isActive: true },
        data: { isActive: false },
      });
      // Clear cache for all sessions
      if (redisClient && typeof redisClient.keys === 'function') {
        const keys = await redisClient.keys('sessions:*');
        if (keys.length > 0) await redisClient.del(keys);
      }
    }

    const session = await prisma.session.update({
      where: { id: targetId },
      data: { isActive: newStatus },
    });

    // Clear cache for this specific session and lists
    if (redisClient && typeof redisClient.del === 'function') {
      await redisClient.del(`session:detail:${targetId}`);
      const listKeys = await redisClient.keys('sessions:*');
      if (listKeys.length > 0) await redisClient.del(listKeys);
    }

    io.to('admin-room').emit('session-updated', { action: 'updated', session });
    io.emit('session-status-changed', { sessionId: session.id, isActive: session.isActive });
    res.json({ session });
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle session' });
  }
});

// Update session speakers
router.put('/:id/speakers', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { speakerIds } = req.body;
    const sessionId = req.params.id as string;

    await prisma.$transaction([
      prisma.sessionSpeaker.deleteMany({ where: { sessionId } }),
      prisma.sessionSpeaker.createMany({
        data: speakerIds.map((speakerId: string) => ({ sessionId, speakerId })),
      }),
    ]);

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { speakers: { include: { speaker: { select: { id: true, name: true, avatarUrl: true } } } } },
    });

    res.json({ session });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update speakers' });
  }
});

// Reorder sessions
router.put('/reorder/batch', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { orders } = req.body;
    await prisma.$transaction(
      orders.map((item: { id: string; order: number }) =>
        prisma.session.update({ where: { id: item.id }, data: { order: item.order } })
      )
    );
    res.json({ message: 'Sessions reordered' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reorder sessions' });
  }
});

// Delete session (admin only)
router.delete('/:id', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    await prisma.session.delete({ where: { id } });
    io.to('admin-room').emit('session-updated', { action: 'deleted', sessionId: id });
    res.json({ message: 'Session deleted' });
  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

export default router;
