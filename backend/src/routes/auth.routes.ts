import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from "../lib/prisma";
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { validate, schemas } from '../middleware/validation.middleware';
import { logActivity } from '../services/activity-log.service';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set');
  process.exit(1);
}

function parseDeviceType(ua: string): string {
  if (/iPad|Tablet/i.test(ua)) return 'tablet';
  if (/Mobile|Android|iPhone/i.test(ua)) return 'mobile';
  return 'desktop';
}

async function logLogin(req: any, user: { id: string; name: string; role: string }) {
  const ua = req.headers['user-agent'] || '';
  const ip = req.ip || req.headers['x-forwarded-for'] || '';
  try {
    await prisma.accessLog.create({
      data: {
        userId: user.id,
        name: user.name,
        role: user.role,
        ipAddress: typeof ip === 'string' ? ip : (Array.isArray(ip) ? ip[0] : ''),
        userAgent: ua,
        deviceType: parseDeviceType(ua),
        action: 'LOGIN',
      },
    });
  } catch (e) { /* ignore */ }
  logActivity({ userId: user.id, userName: user.name, action: 'LOGIN' });
}

// Guest login - no password required, just a name
router.post('/guest', validate(schemas.guestLogin), async (req, res: Response) => {
  try {
    const { name } = req.body;

    const existingGuest = await prisma.user.findFirst({
      where: { name, isGuest: true, email: null },
      orderBy: { createdAt: 'desc' },
    });

    if (existingGuest) {
      const token = jwt.sign({ userId: existingGuest.id }, JWT_SECRET!, { expiresIn: 604800 });
      await logLogin(req, { id: existingGuest.id, name: existingGuest.name, role: existingGuest.role });
      return res.json({
        token,
        user: { id: existingGuest.id, name: existingGuest.name, role: existingGuest.role, isGuest: true },
      });
    }

    const user = await prisma.user.create({
      data: { 
        name, 
        role: 'PARTICIPANT', 
        isGuest: true,
        email: `guest-${require('uuid').v4()}@ides.internal`
      },
    });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET!, { expiresIn: 604800 });
    await logLogin(req, { id: user.id, name: user.name, role: user.role });

    res.json({
      token,
      user: { id: user.id, name: user.name, role: user.role, isGuest: true },
    });
  } catch (error: any) {
    console.error('Guest login error:', error);
    res.status(500).json({ error: 'Failed to create guest session' });
  }
});

// Admin/Speaker/Moderator login
router.post('/login', validate(schemas.login), async (req, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.isActive === false) {
      return res.status(403).json({ error: 'Account deactivated' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET!, { expiresIn: 604800 });
    await logLogin(req, { id: user.id, name: user.name, role: user.role });

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, isGuest: false },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Register (admin only)
router.post('/register', authenticate, requireRole('ADMIN'), validate(schemas.register), async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, name, role } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, password: hashedPassword, name, role: role || 'PARTICIPANT', isGuest: false },
    });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET!, { expiresIn: 604800 });

    res.status(201).json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, isGuest: false },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Get current user profile
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    res.json({ user: req.user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

export default router;
